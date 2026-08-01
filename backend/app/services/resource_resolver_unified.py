"""
resource_resolver_unified.py
-----------------------------
Task D — Single entry point the orchestrator uses for ALL asset resolution.

The Art Director outputs a plain description per element:
    { "type": "icon", "description": "pizza slice", "slot": "accent_icon" }

The orchestrator calls resolve_resource() which dispatches to the right
strategy underneath and returns a concrete, ready-to-place asset reference.

Return shape (always a dict, never raises):
    {
        "type":           str,         # mirrors input type
        "resolved":       str | None,  # icon_id / emoji char / image URL
        "low_confidence": bool,
        "description":    str,         # the generated visual description (cat/library)
        "candidates":     list[dict],  # library results (multiple choices for UI)
    }

If resolved is None, the orchestrator should drop the element rather than
place a broken/empty asset.
"""

from __future__ import annotations

import logging
from typing import Literal, Optional

logger = logging.getLogger(__name__)

# Valid asset types the orchestrator/Art Director may request
AssetType = Literal["icon", "emoji", "cat_photo", "library_image", "background_asset"]


def resolve_resource(
    asset_type: AssetType,
    description: str,
    *,
    scope: Optional[Literal["media_library", "backgrounds"]] = None,
    persona_id: Optional[int] = None,
    user_id: Optional[int] = None,
    db=None,  # SQLAlchemy Session — required for library_image / background_asset
    allow_fallback: bool = True,
) -> dict:
    """
    Unified asset resolver. Dispatches to the correct strategy based on type.

    Parameters
    ----------
    asset_type   : one of "icon" | "emoji" | "cat_photo" | "library_image" | "background_asset"
    description  : free-text description from the Art Director
    scope        : override for library scope; auto-derived from type when omitted
    persona_id   : optional – used for future persona-scoped library filtering
    user_id      : required for library queries (scopes results to owner)
    db           : SQLAlchemy Session (required for library types)
    allow_fallback: if True, allows icon resolution to fallback to generic names

    Returns
    -------
    dict with keys: type, resolved, low_confidence, description, candidates
    """
    result: dict = {
        "type": asset_type,
        "resolved": None,
        "low_confidence": False,
        "description": "",
        "candidates": [],
    }

    try:
        if asset_type == "icon":
            _resolve_icon(description, result, allow_fallback)

        elif asset_type == "emoji":
            _resolve_emoji(description, result)

        elif asset_type == "cat_photo":
            _resolve_cat_photo(description, result)

        elif asset_type == "shape":
            _resolve_shape(description, result)

        elif asset_type in ("library_image", "background_asset"):
            effective_scope: Literal["media_library", "backgrounds"] = (
                scope
                if scope in ("media_library", "backgrounds")
                else ("media_library" if asset_type == "library_image" else "backgrounds")
            )
            _resolve_library(description, effective_scope, user_id, db, result)

        else:
            logger.info("resolve_resource: unknown type '%s', defaulting resolved to description", asset_type)
            result["resolved"] = description or asset_type
            result["low_confidence"] = False

    except Exception as exc:
        logger.error(
            "resolve_resource: unhandled exception for type='%s' desc='%s': %s",
            asset_type, description, exc, exc_info=True,
        )
        result["resolved"] = description or asset_type
        result["low_confidence"] = True

    return result



# ---------------------------------------------------------------------------
# Private dispatchers
# ---------------------------------------------------------------------------

def _resolve_icon(description: str, result: dict, allow_fallback: bool = True) -> None:
    from app.services.resource_resolver import resolve_icon  # Task A

    icon_id = resolve_icon(description, allow_fallback=allow_fallback)
    result["resolved"] = icon_id
    result["low_confidence"] = icon_id is None
    logger.info("Icon resolved: '%s' → %s", description, icon_id)


def _resolve_emoji(description: str, result: dict) -> None:
    from app.services.resource_resolver import resolve_emoji  # Task A

    emoji_char = resolve_emoji(description)
    result["resolved"] = emoji_char
    result["low_confidence"] = emoji_char is None
    logger.info("Emoji resolved: '%s' → %s", description, emoji_char)


def _resolve_shape(description: str, result: dict) -> None:
    desc_lower = (description or "").lower()
    shape_kind = "rectangle"
    for k in ["pill", "circle", "rectangle", "starburst", "card", "badge", "divider", "ribbon", "bubble"]:
        if k in desc_lower:
            shape_kind = k
            break
    result["resolved"] = shape_kind
    result["low_confidence"] = False
    logger.info("Shape resolved: '%s' → %s", description, shape_kind)


def _resolve_cat_photo(description: str, result: dict) -> None:

    from app.services.cat_photo_resolver import resolve_cat_photo  # Task B

    cat_result = resolve_cat_photo(description)
    result["resolved"] = cat_result.get("url")
    result["description"] = cat_result.get("description", "")
    result["low_confidence"] = cat_result.get("low_confidence", False)
    logger.info(
        "Cat photo resolved: '%s' → %s (low_confidence=%s)",
        description, result["resolved"], result["low_confidence"],
    )


def _resolve_library(
    description: str,
    scope: Literal["media_library", "backgrounds"],
    user_id: Optional[int],
    db,
    result: dict,
) -> None:
    from app.services.library_resolver import resolve_from_library  # Task C

    if db is None:
        logger.warning("resolve_resource: db session required for library lookup, skipping.")
        result["low_confidence"] = True
        return

    candidates = resolve_from_library(description, scope, db, user_id=user_id, limit=5)

    if candidates:
        best = candidates[0]
        result["resolved"] = best.get("url")
        result["description"] = best.get("caption", "")
        result["candidates"] = candidates
        # Low confidence if the best match ts_rank is very low (< 0.05)
        result["low_confidence"] = float(best.get("rank", 0)) < 0.05
        logger.info(
            "Library resolved: '%s' → %s (rank=%.3f, scope=%s)",
            description, result["resolved"],
            float(best.get("rank", 0)), scope,
        )
    else:
        result["low_confidence"] = True
        logger.info("Library resolve: no match for '%s' in scope=%s", description, scope)
