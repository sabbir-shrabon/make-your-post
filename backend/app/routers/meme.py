"""
meme.py
-------
API routes for Meme Studio, Custom Theme Engines, and Viral Meme Generation.
"""

from __future__ import annotations

import logging
from typing import Literal, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app import models
from app.services.meme_generator import BUILTIN_MEME_THEMES, generate_meme_post
from app.services.meme_renderer import render_classic_meme, render_modern_card_meme

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/meme", tags=["meme"])


class GenerateMemeRequest(BaseModel):
    theme_id: Optional[str] = Field(None, description="Built-in theme ID")
    custom_theme_id: Optional[str] = Field(None, description="User-uploaded custom theme ID")
    custom_prompt: Optional[str] = Field(None, description="Specific scenario, prompt, or joke idea")
    custom_image_url: Optional[str] = Field(None, description="Custom base image URL")
    format_style: Literal["classic", "modern_card"] = Field("modern_card", description="Meme layout style")
    page_connection_id: Optional[int] = Field(None, description="Target Facebook Page Connection ID")
    persona_id: Optional[int] = Field(None, description="Specific AI Persona ID to power humor DNA")


class ReRenderMemeRequest(BaseModel):
    image_url: str = Field(..., description="Base image source")
    format_style: Literal["classic", "modern_card"] = Field("modern_card")
    top_text: Optional[str] = Field("", description="Top text for classic meme")
    bottom_text: Optional[str] = Field("", description="Bottom text for classic meme")
    headline_text: Optional[str] = Field("", description="Headline setup for modern card")
    brand_name: Optional[str] = Field("Creator")
    handle: Optional[str] = Field("@creator")
    avatar_url: Optional[str] = Field(None)


class CreateThemeRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    description: Optional[str] = Field(None)
    category: str = Field("meme")


class AddThemeAssetRequest(BaseModel):
    image_url: str = Field(..., description="Public image URL or data URL")
    caption_prompt_hint: Optional[str] = Field(None)


@router.get("/themes")
def list_themes(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Returns built-in viral themes and user custom asset theme buckets.
    """
    user_themes = db.query(models.CustomTheme).filter(models.CustomTheme.user_id == current_user.id).all()
    
    custom_list = [
        {
            "id": ut.id,
            "name": ut.name,
            "description": ut.description,
            "category": ut.category,
            "is_custom": True,
            "asset_count": len(ut.assets),
            "sample_assets": [a.image_url for a in ut.assets[:3]],
        }
        for ut in user_themes
    ]

    return {
        "builtin_themes": BUILTIN_MEME_THEMES,
        "custom_themes": custom_list,
    }


@router.post("/themes")
def create_custom_theme(
    body: CreateThemeRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Create a new custom theme folder for user-uploaded assets.
    """
    theme = models.CustomTheme(
        user_id=current_user.id,
        name=body.name,
        description=body.description,
        category=body.category,
    )
    db.add(theme)
    db.commit()
    db.refresh(theme)
    return {"status": "created", "theme_id": theme.id, "name": theme.name}


@router.post("/themes/{theme_id}/assets")
def add_theme_asset(
    theme_id: str,
    body: AddThemeAssetRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Add an image asset to a custom theme.
    """
    theme = db.query(models.CustomTheme).filter(
        models.CustomTheme.id == theme_id,
        models.CustomTheme.user_id == current_user.id,
    ).first()
    if not theme:
        raise HTTPException(status_code=404, detail="Custom theme not found")

    asset = models.ThemeAsset(
        theme_id=theme.id,
        user_id=current_user.id,
        image_url=body.image_url,
        caption_prompt_hint=body.caption_prompt_hint,
    )
    db.add(asset)
    db.commit()
    return {"status": "added", "asset_id": asset.id}


@router.delete("/themes/{theme_id}")
def delete_custom_theme(
    theme_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    theme = db.query(models.CustomTheme).filter(
        models.CustomTheme.id == theme_id,
        models.CustomTheme.user_id == current_user.id,
    ).first()
    if not theme:
        raise HTTPException(status_code=404, detail="Custom theme not found")
    db.delete(theme)
    db.commit()
    return {"status": "deleted"}


@router.post("/generate")
async def generate_meme(
    body: GenerateMemeRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Generate viral meme graphic + Facebook caption in a single 1-click pass.
    """
    try:
        result = await generate_meme_post(
            db=db,
            user_id=current_user.id,
            theme_id=body.theme_id,
            custom_theme_id=body.custom_theme_id,
            custom_prompt=body.custom_prompt,
            custom_image_url=body.custom_image_url,
            format_style=body.format_style,
            page_connection_id=body.page_connection_id,
            persona_id=body.persona_id,
        )
        return result
    except Exception as exc:
        logger.error("generate_meme failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Meme generation failed: {exc}")


@router.post("/render-preview")
def render_preview(body: ReRenderMemeRequest):
    """
    Fast live preview re-rendering without calling LLM.
    """
    try:
        if body.format_style == "classic":
            b64 = render_classic_meme(
                image_url=body.image_url,
                top_text=body.top_text or "",
                bottom_text=body.bottom_text or "",
            )
        else:
            b64 = render_modern_card_meme(
                image_url=body.image_url,
                headline_text=body.headline_text or "",
                brand_name=body.brand_name or "Creator",
                handle=body.handle or "@creator",
                avatar_url=body.avatar_url,
            )
        return {"status": "success", "base64_image": b64}
    except Exception as exc:
        logger.error("render_preview failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Render preview failed: {exc}")
