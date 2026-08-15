"""
campaign.py
-----------
API routes for Unified Campaign & Post Generation.
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
from app.services.campaign_generator import (
    generate_unified_campaign,
    generate_batch_campaign,
    schedule_batch_campaign,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/campaign", tags=["campaign"])


class UnifiedCampaignRequest(BaseModel):
    topic_or_niche: str = Field(..., min_length=2, description="Topic, niche, or high-level campaign prompt")
    page_connection_id: Optional[int] = Field(None, description="Connected Facebook Page ID")
    persona_id: Optional[int] = Field(None, description="Specific AI Persona ID")
    candidate_count: int = Field(3, ge=1, le=5, description="Number of poster design variations to render")
    allow_pexels_bg: bool = Field(True, description="Allow stock photo background search via Pexels")
    allow_cat_bg: bool = Field(False, description="Allow Cat API photo fallback")
    aspect_ratio: Literal["1:1", "16:9", "4:5", "9:16"] = Field("1:1", description="Canvas aspect ratio")


class BatchCampaignRequest(BaseModel):
    page_connection_id: Optional[int] = Field(None, description="Connected Facebook Page ID")
    persona_id: Optional[int] = Field(None, description="Specific AI Persona ID")
    days_count: int = Field(7, ge=1, le=14, description="Number of days in the campaign (1-14)")
    start_date: Optional[str] = Field(None, description="ISO starting date")
    custom_focus: Optional[str] = Field(None, description="Optional custom campaign focus or theme override")
    include_posters: bool = Field(True, description="Whether to render matching graphic posters for each day")
    allow_pexels_bg: bool = Field(True, description="Allow Pexels stock photo search")


class ScheduleBatchRequest(BaseModel):
    page_connection_id: int = Field(..., description="Target Facebook Page ID")
    persona_id: Optional[int] = Field(None, description="Optional AI Persona ID")
    posts: list[dict] = Field(..., description="List of approved post items with scheduled_at, content, poster")


@router.post("/generate-unified")
async def generate_unified(
    body: UnifiedCampaignRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Generate a synchronized Facebook Post + Matched Graphic Poster in a single pass.
    """
    if not body.topic_or_niche.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="topic_or_niche must not be empty",
        )

    try:
        result = await generate_unified_campaign(
            db=db,
            user_id=current_user.id,
            topic_or_niche=body.topic_or_niche.strip(),
            page_connection_id=body.page_connection_id,
            persona_id=body.persona_id,
            candidate_count=body.candidate_count,
            allow_pexels_bg=body.allow_pexels_bg,
            allow_cat_bg=body.allow_cat_bg,
            aspect_ratio=body.aspect_ratio,
        )
        return result
    except Exception as exc:
        logger.error("generate-unified failed for topic=%r: %s", body.topic_or_niche, exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unified campaign generation failed: {exc}",
        )


@router.post("/generate-batch")
async def generate_batch(
    body: BatchCampaignRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Generate a multi-day (3-14 days) content campaign with synchronized copy and posters.
    """
    try:
        result = await generate_batch_campaign(
            db=db,
            user_id=current_user.id,
            page_connection_id=body.page_connection_id,
            persona_id=body.persona_id,
            days_count=body.days_count,
            start_date=body.start_date,
            custom_focus=body.custom_focus,
            include_posters=body.include_posters,
            allow_pexels_bg=body.allow_pexels_bg,
        )
        return result
    except Exception as exc:
        logger.error("generate-batch failed: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Batch campaign generation failed: {exc}",
        )


@router.post("/schedule-batch")
def schedule_batch(
    body: ScheduleBatchRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Persist approved batch campaign posts directly into scheduled posts.
    """
    if not body.posts:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No posts provided in batch schedule request",
        )

    try:
        result = schedule_batch_campaign(
            db=db,
            user_id=current_user.id,
            page_connection_id=body.page_connection_id,
            persona_id=body.persona_id,
            posts_data=body.posts,
        )
        return {"success": True, "scheduled_count": len(result), "posts": result}
    except Exception as exc:
        logger.error("schedule-batch failed: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Batch scheduling failed: {exc}",
        )
