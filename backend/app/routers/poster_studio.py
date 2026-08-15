"""
poster_studio.py
----------------
Poster Assembly Lab — backend endpoint.

POST /api/poster/assemble-trace
    Runs the same generatePoster() orchestrator that will power
    automated scheduled posts, but returns the full resolution trace
    as JSON instead of committing a post or returning a PNG.

    The Assembly Lab UI uses this trace to render the poster live
    in the browser and inspect every AI decision.
"""

from __future__ import annotations

import time
import logging
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app import models
from app.services.poster_orchestrator import generatePoster, mutatePoster, regeneratePosterLayer

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/poster", tags=["poster-studio"])

# ---------------------------------------------------------------------------
# Canvas dimensions per aspect ratio
# ---------------------------------------------------------------------------

RATIO_DIMENSIONS: dict[str, tuple[int, int]] = {
    "1:1":  (1080, 1080),
    "16:9": (1920, 1080),
    "4:5":  (1080, 1350),
    "9:16": (1080, 1920),
}


# ---------------------------------------------------------------------------
# Request / Response schemas
# ---------------------------------------------------------------------------

from app.services.poster_component_renderer import render_archetype_poster

class ReRenderArchetypeRequest(BaseModel):
    archetype_id: str = "social-card"
    headline: str = ""
    subheadline: Optional[str] = None
    badge_text: Optional[str] = None
    stat_number: Optional[str] = None
    items: Optional[list[str]] = None
    cta_text: Optional[str] = None
    image_url: Optional[str] = None
    brand_name: Optional[str] = "Creator"
    handle: Optional[str] = "@creator"
    avatar_url: Optional[str] = None
    palette_id: Optional[str] = None
    font_pair_id: Optional[str] = None
    aspect_ratio: Literal["1:1", "16:9", "4:5", "9:16"] = "1:1"

class AssembleTraceRequest(BaseModel):
    topic: str
    persona_id: Optional[int] = None
    aspect_ratio: Literal["1:1", "16:9", "4:5", "9:16"] = "1:1"
    use_news_grounding: bool = False
    allow_pexels_bg: bool = False
    allow_cat_bg: bool = False
    template_id: Optional[str] = None

class MutateTraceRequest(BaseModel):
    mutation_prompt: str
    current_state: dict
    aspect_ratio: Literal["1:1", "16:9", "4:5", "9:16"] = "1:1"
    allow_pexels_bg: bool = False
    allow_cat_bg: bool = False

class RegenerateLayerRequest(BaseModel):
    element_index: int
    current_state: dict
    topic: str
    prompt_hint: Optional[str] = None
    allow_pexels_bg: bool = False
    allow_cat_bg: bool = False


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/assemble-trace")
async def assemble_trace(
    body: AssembleTraceRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Run the poster generation pipeline and return a full resolution trace.

    This calls generatePoster() — the exact same function that will power
    automated scheduled posts once the render step is wired up.

    Returns structured JSON (not a PNG) that the Assembly Lab UI uses to:
      - Animate the poster layers building up on the canvas
      - Show per-step timing in the pipeline timeline
      - Power the asset inspector (description, resolved ID, confidence, candidates)
    """
    if not body.topic.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="topic must not be empty",
        )

    canvas_w, canvas_h = RATIO_DIMENSIONS[body.aspect_ratio]

    t_start = time.perf_counter()

    try:
        result = await generatePoster(
            topic=body.topic,
            persona_id=body.persona_id,
            db=db,
            user_id=current_user.id,
            use_news_grounding=body.use_news_grounding,
            allow_pexels_bg=body.allow_pexels_bg,
            allow_cat_bg=body.allow_cat_bg,
            template_id=body.template_id,
        )
    except Exception as exc:
        logger.error("assemble-trace failed for topic=%r: %s", body.topic, exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Pipeline failed: {exc}",
        )

    total_ms = int((time.perf_counter() - t_start) * 1000)

    return {
        **result,
        "aspect_ratio": body.aspect_ratio,
        "canvas_w": canvas_w,
        "canvas_h": canvas_h,
        "total_ms": total_ms,
    }

@router.post("/mutate-trace")
async def mutate_trace(
    body: MutateTraceRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Run a stateful mutation on an existing poster json state.
    """
    if not body.mutation_prompt.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="mutation_prompt must not be empty",
        )
    if not body.current_state:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="current_state must be provided",
        )

    canvas_w, canvas_h = RATIO_DIMENSIONS[body.aspect_ratio]

    t_start = time.perf_counter()

    try:
        result = await mutatePoster(
            mutation_prompt=body.mutation_prompt,
            current_state=body.current_state,
            db=db,
            user_id=current_user.id,
            allow_pexels_bg=body.allow_pexels_bg,
            allow_cat_bg=body.allow_cat_bg,
        )
    except Exception as exc:
        logger.error("mutate-trace failed for prompt=%r: %s", body.mutation_prompt, exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Pipeline mutation failed: {exc}",
        )

    total_ms = int((time.perf_counter() - t_start) * 1000)

    return {
        **result,
        "aspect_ratio": body.aspect_ratio,
        "canvas_w": canvas_w,
        "canvas_h": canvas_h,
        "total_ms": total_ms,
    }

@router.post("/regenerate-layer")
async def regenerate_layer(
    body: RegenerateLayerRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Part 1 Phase 5: Re-generate only a single selected layer (e.g. headline text, icon, or background photo).
    """
    if not body.current_state:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="current_state must be provided",
        )

    try:
        result = await regeneratePosterLayer(
            element_index=body.element_index,
            current_state=body.current_state,
            topic=body.topic,
            prompt_hint=body.prompt_hint,
            db=db,
            user_id=current_user.id,
            allow_pexels_bg=body.allow_pexels_bg,
            allow_cat_bg=body.allow_cat_bg,
        )
        return result
    except Exception as exc:
        logger.error("regenerate-layer failed for index %d: %s", body.element_index, exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Layer regeneration failed: {exc}",
        )


@router.get("/archetypes")
def list_archetypes():
    """
    Returns the list of 6 Canva-grade social poster archetypes.
    """
    archetypes_path = os.path.join(os.path.dirname(__file__), "..", "data", "design-system", "archetypes.json")
    try:
        with open(archetypes_path, "r", encoding="utf-8") as f:
            import json
            return json.load(f)
    except Exception as e:
        logger.warning(f"Failed to load archetypes.json: {e}")
        return []


@router.post("/render-preview")
def render_poster_preview(body: ReRenderArchetypeRequest):
    """
    Fast sub-100ms live preview re-rendering of any Archetype without LLM invocation.
    """
    canvas_w, canvas_h = RATIO_DIMENSIONS.get(body.aspect_ratio, (1080, 1080))
    t_start = time.perf_counter()
    try:
        b64_str, _ = render_archetype_poster(
            archetype_id=body.archetype_id,
            headline=body.headline,
            subheadline=body.subheadline,
            image_url=body.image_url,
            brand_name=body.brand_name or "Creator",
            handle=body.handle or "@creator",
            avatar_url=body.avatar_url,
            badge_text=body.badge_text,
            stat_number=body.stat_number,
            items=body.items,
            cta_text=body.cta_text,
            canvas_w=canvas_w,
            canvas_h=canvas_h,
            palette_id=body.palette_id,
            font_pair_id=body.font_pair_id,
        )
        render_ms = int((time.perf_counter() - t_start) * 1000)
        return {
            "status": "success",
            "base64_image": b64_str,
            "render_ms": render_ms,
            "archetype_id": body.archetype_id,
        }
    except Exception as exc:
        logger.error("render_poster_preview failed: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Preview render failed: {exc}"
        )


