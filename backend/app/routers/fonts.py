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
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app import models

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/fonts", tags=["fonts"])

FONTS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "assets", "fonts"))
DESIGN_SYSTEM_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data", "design-system"))
FONT_PAIRS_FILE = os.path.join(DESIGN_SYSTEM_DIR, "font-pairs.json")

ALLOWED_FONT_EXTENSIONS = {".ttf", ".otf", ".woff", ".woff2"}

os.makedirs(FONTS_DIR, exist_ok=True)


def _get_safe_font_path(filename: str) -> Path | None:
    """Validate and resolve font file path strictly inside FONTS_DIR."""
    safe_name = Path(filename).name.strip()
    if not safe_name:
        return None
    ext = Path(safe_name).suffix.lower()
    if ext not in ALLOWED_FONT_EXTENSIONS:
        return None

    fonts_dir_path = Path(FONTS_DIR).resolve()
    target = (fonts_dir_path / safe_name).resolve()
    try:
        if not target.is_relative_to(fonts_dir_path):
            return None
    except AttributeError:
        # Fallback for Python < 3.9
        if not str(target).startswith(str(fonts_dir_path)):
            return None

    return target


class DownloadGoogleFontRequest(BaseModel):
    font_family: str = Field(..., min_length=2, max_length=60, description="Name of Google Font (e.g. 'Outfit', 'Plus Jakarta Sans', 'Cabinet Grotesk')")
    weight: Optional[str] = Field("700", description="Font weight (e.g. '400', '700', 'Bold')")


class AddCustomPairRequest(BaseModel):
    id: str = Field(..., min_length=1, max_length=100, description="Unique pair ID")
    heading_font: str = Field(..., min_length=1, max_length=100, description="Heading font name")
    body_font: str = Field(..., min_length=1, max_length=100, description="Body font name")
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


@router.get("/file/{filename}")
def get_font_file(filename: str):
    """Serve font binary safely strictly from FONTS_DIR."""
    target = _get_safe_font_path(filename)
    if target and target.is_file():
        ext = target.suffix.lower()
        media_type = "font/ttf" if ext == ".ttf" else ("font/otf" if ext == ".otf" else "font/woff2")
        return FileResponse(str(target), media_type=media_type)
    raise HTTPException(status_code=404, detail="Font file not found")


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

    safe_original_name = Path(file.filename).name
    ext = Path(safe_original_name).suffix.lower()
    if ext not in ALLOWED_FONT_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail="Invalid font format. Only .ttf, .otf, .woff, and .woff2 are supported.",
        )

    # Sanitize filename
    safe_name = re.sub(r"[^a-zA-Z0-9_\-\.]", "_", safe_original_name)
    target = _get_safe_font_path(safe_name)
    if not target:
        raise HTTPException(status_code=400, detail="Invalid filename format.")

    content = await file.read()
    with open(target, "wb") as f:
        f.write(content)

    font_family = safe_name.rsplit(".", 1)[0].split("-")[0]

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
        target = _get_safe_font_path(safe_filename)
        if not target:
            raise ValueError("Invalid target font name.")

        with open(target, "wb") as f:
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
def add_custom_font_pair(
    body: AddCustomPairRequest,
    current_user: models.User = Depends(get_current_user),
):
    """
    Register a new font pair in the design system. Requires authentication.
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
def delete_custom_font(
    filename: str,
    current_user: models.User = Depends(get_current_user),
):
    """
    Remove an installed font file safely. Requires authentication.
    """
    target = _get_safe_font_path(filename)
    if target and target.is_file():
        try:
            target.unlink()
            return {"status": "deleted", "filename": target.name}
        except Exception as e:
            logger.error("Failed to delete font %s: %s", target.name, e)
            raise HTTPException(status_code=500, detail="Failed to delete font file.")
    raise HTTPException(status_code=404, detail="Font file not found")
