"""
fonts.py
--------
API routes for Custom Font Upload, Google Font Auto-Downloader, and Font Pairs Management.
"""

from __future__ import annotations

import json
import logging
import os
import re
import urllib.request
import urllib.parse
from typing import Optional
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app import models

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/fonts", tags=["fonts"])

FONTS_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "assets", "fonts")
DESIGN_SYSTEM_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "design-system")
FONT_PAIRS_FILE = os.path.join(DESIGN_SYSTEM_DIR, "font-pairs.json")

os.makedirs(FONTS_DIR, exist_ok=True)


class DownloadGoogleFontRequest(BaseModel):
    font_family: str = Field(..., min_length=2, max_length=60, description="Name of Google Font (e.g. 'Outfit', 'Plus Jakarta Sans', 'Cabinet Grotesk')")
    weight: Optional[str] = Field("700", description="Font weight (e.g. '400', '700', 'Bold')")


class AddCustomPairRequest(BaseModel):
    id: str = Field(..., description="Unique pair ID")
    heading_font: str = Field(..., description="Heading font name")
    body_font: str = Field(..., description="Body font name")
    mood: list[str] = Field(default_factory=lambda: ["custom", "brand"])


def _get_installed_fonts() -> list[dict]:
    """Scan FONTS_DIR and return all available fonts."""
    fonts = []
    if os.path.exists(FONTS_DIR):
        for f in sorted(os.listdir(FONTS_DIR)):
            if f.lower().endswith((".ttf", ".otf", ".woff", ".woff2")):
                fp = os.path.join(FONTS_DIR, f)
                name_clean = os.path.splitext(f)[0].replace("-Bold", " Bold").replace("-Regular", " Regular")
                family_clean = name_clean.split("-")[0].split(" Bold")[0].split(" Regular")[0]
                fonts.append({
                    "filename": f,
                    "name": name_clean,
                    "family": family_clean,
                    "size_kb": round(os.path.getsize(fp) / 1024, 1),
                    "file_path": fp,
                })
    return fonts


def _load_font_pairs() -> list[dict]:
    if os.path.exists(FONT_PAIRS_FILE):
        try:
            with open(FONT_PAIRS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return []


@router.get("")
def list_fonts():
    """
    List all installed custom/downloaded fonts and design system font pairs.
    """
    installed = _get_installed_fonts()
    pairs = _load_font_pairs()
    return {
        "installed_fonts": installed,
        "font_pairs": pairs,
    }


@router.post("/upload")
async def upload_custom_font(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Upload a custom font file (.ttf, .otf, .woff, .woff2).
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in (".ttf", ".otf", ".woff", ".woff2"):
        raise HTTPException(
            status_code=400,
            detail="Invalid font format. Only .ttf, .otf, .woff, and .woff2 are supported.",
        )

    # Sanitize filename
    safe_name = re.sub(r"[^a-zA-Z0-9_\-\.]", "_", file.filename)
    target_path = os.path.join(FONTS_DIR, safe_name)

    content = await file.read()
    with open(target_path, "wb") as f:
        f.write(content)

    font_family = os.path.splitext(safe_name)[0].split("-")[0]

    # Save to database record
    asset = models.FontAsset(
        name=font_family,
        url=f"/assets/fonts/{safe_name}",
    )
    db.add(asset)
    db.commit()

    return {
        "status": "success",
        "message": f"Font '{safe_name}' installed successfully.",
        "filename": safe_name,
        "font_family": font_family,
        "size_kb": round(len(content) / 1024, 1),
    }


@router.post("/download-google-font")
def download_google_font(
    body: DownloadGoogleFontRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Download a Google Font directly by family name into local fonts directory.
    """
    family = body.font_family.strip()
    encoded_family = urllib.parse.quote(family)
    weight = body.weight or "700"

    css_url = f"https://fonts.googleapis.com/css2?family={encoded_family}:wght@{weight}&display=swap"

    try:
        # Request with older User-Agent that triggers TTF font format in CSS
        req = urllib.request.Request(
            css_url,
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 6.1; rv:52.0) Gecko/20100101 Firefox/52.0"
            },
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            css_content = resp.read().decode("utf-8")

        # Extract TTF url from css: src: url(...)
        match = re.search(r"src:\s*url\((https://[^\)]+)\)", css_content)
        if not match:
            # Try WOFF2 fallback
            match = re.search(r"url\((https://[^\)]+)\)", css_content)
            if not match:
                raise ValueError(f"Could not find font binary URL for '{family}'")

        font_bin_url = match.group(1).replace("'", "").replace('"', "")

        # Download the binary TTF
        bin_req = urllib.request.Request(font_bin_url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(bin_req, timeout=15) as bin_resp:
            font_bytes = bin_resp.read()

        safe_filename = f"{family.replace(' ', '')}-Bold.ttf"
        save_path = os.path.join(FONTS_DIR, safe_filename)

        with open(save_path, "wb") as f:
            f.write(font_bytes)

        # Save to database
        asset = models.FontAsset(
            name=family,
            url=f"/assets/fonts/{safe_filename}",
        )
        db.add(asset)
        db.commit()

        return {
            "status": "success",
            "message": f"Google Font '{family}' downloaded and installed successfully!",
            "font_family": family,
            "filename": safe_filename,
            "size_kb": round(len(font_bytes) / 1024, 1),
        }

    except Exception as exc:
        logger.error("Failed to download Google Font '%s': %s", family, exc, exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Could not download Google Font '{family}': {exc}. Check the font family name.",
        )


@router.post("/pairs")
def add_custom_font_pair(body: AddCustomPairRequest):
    """
    Register a new font pair in the design system.
    """
    pairs = _load_font_pairs()
    # Check if exists
    for p in pairs:
        if p["id"] == body.id:
            p["heading_font"] = body.heading_font
            p["body_font"] = body.body_font
            p["mood"] = body.mood
            break
    else:
        pairs.append(body.model_dump())

    with open(FONT_PAIRS_FILE, "w", encoding="utf-8") as f:
        json.dump(pairs, f, indent=2)

    return {"status": "success", "font_pairs": pairs}


@router.delete("/{filename}")
def delete_custom_font(filename: str):
    """
    Remove an installed font file.
    """
    target = os.path.join(FONTS_DIR, filename)
    if os.path.exists(target):
        try:
            os.remove(target)
            return {"status": "deleted", "filename": filename}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to delete font: {e}")
    raise HTTPException(status_code=404, detail="Font file not found")
