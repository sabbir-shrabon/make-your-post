"""
poster_templates.py
--------------------
Unified Poster Templates router:
- Lists all 11 system design templates enriched with slot definitions, categories, and realistic demo poster content.
- Manages user-created custom poster templates stored in database.
- Provides endpoints to create, update, delete, import, export, and convert canvas states into reusable templates.
"""

from __future__ import annotations

import json
import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any, Literal

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.auth import get_current_user
from app.database import get_db
from app import models

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/poster/templates", tags=["poster-templates"])

RESOURCES_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "design-system")

# ---------------------------------------------------------------------------
# Demo Poster Presets for each system template
# ---------------------------------------------------------------------------
SYSTEM_TEMPLATES_METADATA: Dict[str, Dict[str, Any]] = {
    "centered-hero": {
        "category": "Sales & Promo",
        "description": "Centered visual focus with prominent badge, hero title, and punchy call to action.",
        "best_for": ["sale", "promo", "announcement", "summer", "retail"],
        "demo_sample": {
            "headline": "SUMMER MEGA SALE",
            "subheadline": "Up to 50% off all modern tropical essentials & accessories",
            "badge_text": "50% OFF",
            "accent_icon": "lucide:sparkles",
            "cta_text": "SHOP THE SALE →",
            "details_block": "Limited weekend access · Free global shipping",
            "text_logo": "LUMEN STUDIO",
            "gradient": ["#4F46E5", "#06B6D4"],
            "bg_color": "#0F172A",
            "accent_color": "#F59E0B",
        }
    },
    "top-heavy-headline": {
        "category": "Tech & SaaS",
        "description": "High-contrast editorial header anchoring the top third with strong body copy below.",
        "best_for": ["tech", "saas", "announcement", "news", "launch"],
        "demo_sample": {
            "headline": "THE FUTURE OF AI AGENTS",
            "subheadline": "Build, deploy, and scale intelligent autonomous workflows 10x faster with zero friction.",
            "corner_badge": "NEW V2.0",
            "cta_text": "EXPLORE PLATFORM →",
            "details_block": "Trusted by 15,000+ modern engineering teams",
            "text_logo": "NEXUS AI",
            "gradient": ["#1E1B4B", "#312E81"],
            "bg_color": "#090D16",
            "accent_color": "#38BDF8",
        }
    },
    "bottom-banner": {
        "category": "Sales & Promo",
        "description": "Spacious hero visual area with anchored bottom announcement banner.",
        "best_for": ["product", "sale", "apparel", "minimalist"],
        "demo_sample": {
            "headline": "DISCOVER MINIMALIST LIVING",
            "subheadline": "Curated Scandinavian furniture crafted for modern architectural serenity.",
            "details_block": "Spring 2026 Collection Available Online",
            "cta_text": "VIEW COLLECTION →",
            "text_logo": "NORDIC SPACES",
            "accent_icon": "lucide:home",
            "gradient": ["#1C1917", "#292524"],
            "bg_color": "#18181B",
            "accent_color": "#E2E8F0",
        }
    },
    "split-image-left": {
        "category": "Editorial & Story",
        "description": "Two-column layout: media visual on the left, compelling typographic narrative on the right.",
        "best_for": ["testimonial", "product", "informative", "hardware"],
        "demo_sample": {
            "headline": "CRAFTED FOR CREATORS",
            "subheadline": "Experience precision acoustics with studio-grade spatial clarity and zero latency.",
            "cta_text": "LEARN MORE →",
            "text_logo": "AURA ACOUSTICS",
            "gradient": ["#022C22", "#064E3B"],
            "bg_color": "#06281E",
            "accent_color": "#34D399",
        }
    },
    "split-image-right": {
        "category": "Editorial & Story",
        "description": "Two-column layout: typographic narrative on the left, media visual on the right.",
        "best_for": ["tech", "product", "features", "solutions"],
        "demo_sample": {
            "headline": "SCALE WITHOUT LIMITS",
            "subheadline": "High-performance cloud infrastructure engineered for mission-critical applications.",
            "cta_text": "START FREE TRIAL →",
            "text_logo": "HYPERSTACK",
            "gradient": ["#1E293B", "#0F172A"],
            "bg_color": "#0B0F19",
            "accent_color": "#60A5FA",
        }
    },
    "corner-badge-promo": {
        "category": "Sales & Promo",
        "description": "High-converting retail layout featuring an attention-grabbing corner badge and prominent CTA.",
        "best_for": ["sale", "discount", "promo", "retail", "flash"],
        "demo_sample": {
            "headline": "FLASH SALE: 48 HOURS ONLY",
            "subheadline": "Massive seasonal discounts across our entire catalog of premium essentials.",
            "corner_badge": "FLASH DEAL",
            "details_block": "Use code FLASH48 at checkout",
            "cta_text": "CLAIM DISCOUNT →",
            "text_logo": "VELOCITY GEAR",
            "gradient": ["#7F1D1D", "#991B1B"],
            "bg_color": "#450A0A",
            "accent_color": "#FBBF24",
        }
    },
    "minimal-quote": {
        "category": "Quotes & Mindset",
        "description": "Elegant typography featuring oversized quotation marks, reflective wisdom, and author attribution.",
        "best_for": ["quote", "mindset", "wisdom", "founder", "inspiration"],
        "demo_sample": {
            "headline": "“Simplicity is the ultimate sophistication.”",
            "subheadline": "Mastery is achieved not when there is nothing more to add, but when there is nothing left to take away.",
            "accent_icon": "lucide:quote",
            "text_logo": "LEONARDO DA VINCI",
            "gradient": ["#18181B", "#27272A"],
            "bg_color": "#121214",
            "accent_color": "#F43F5E",
        }
    },
    "list-steps": {
        "category": "Lists & How-To",
        "description": "Clean, structured step-by-step checklist framework ideal for tips, habits, and tutorials.",
        "best_for": ["how-to", "tips", "framework", "cheatsheet", "education"],
        "demo_sample": {
            "headline": "4 HABITS OF ELITE FOUNDERS",
            "subheadline": "1. Relentless Prioritization\n2. Rapid Daily Prototyping\n3. Direct Customer Listening\n4. Consistent Execution",
            "details_block": "A proven framework for enduring business growth",
            "text_logo": "FOUNDER PLAYBOOK",
            "gradient": ["#134E4A", "#042F2E"],
            "bg_color": "#022C22",
            "accent_color": "#2DD4BF",
        }
    },
    "before-after-split": {
        "category": "Comparison & Results",
        "description": "Direct side-by-side comparison illustrating transformation, efficiency gains, or workflow upgrades.",
        "best_for": ["comparison", "transformation", "before-after", "productivity"],
        "demo_sample": {
            "headline": "THE AUTOMATION UPGRADE",
            "text_before": "BEFORE: 14h manual design grind",
            "text_after": "AFTER: 1-click agentic posters",
            "subheadline": "Transform your visual marketing workflow with zero manual overhead.",
            "cta_text": "TRY FOR FREE →",
            "gradient": ["#312E81", "#1E1B4B"],
            "bg_color": "#0F172A",
            "accent_color": "#A855F7",
        }
    },
    "asymmetric-editorial": {
        "category": "Editorial & Story",
        "description": "Modern asymmetrical magazine layout with badge tag, offset headline, and balanced footer.",
        "best_for": ["editorial", "insights", "thought-leadership", "article"],
        "demo_sample": {
            "headline": "THE NEXT ERA OF COMPUTING",
            "subheadline": "How neural networks are radically transforming creative design and production workflows.",
            "corner_badge": "SPECIAL REPORT",
            "details_block": "Volume 14 · Autumn Issue",
            "text_logo": "SYNAPSE JOURNAL",
            "cta_text": "READ ESSAY →",
            "gradient": ["#111827", "#1F2937"],
            "bg_color": "#030712",
            "accent_color": "#E11D48",
        }
    },
    "stat-metric-callout": {
        "category": "Data & Stats",
        "description": "Oversized metric stat highlight block commanding immediate authority and proof.",
        "best_for": ["stats", "data", "growth", "proof", "authority", "milestones"],
        "demo_sample": {
            "headline": "+340% REVENUE GROWTH",
            "subheadline": "Verified benchmark metrics achieved by creators using autonomous publishing workflows.",
            "corner_badge": "GROWTH AUDIT",
            "details_block": "Audited across 1.2M live post generations",
            "text_logo": "BENCHMARK LABS",
            "gradient": ["#064E3B", "#022C22"],
            "bg_color": "#052016",
            "accent_color": "#10B981",
        }
    }
}


def _load_system_templates() -> list[dict]:
    """Loads system templates from design-system/templates.json."""
    try:
        path = os.path.join(RESOURCES_DIR, "templates.json")
        with open(path, "r", encoding="utf-8") as f:
            raw_templates = json.load(f)
            
        enriched = []
        for t in raw_templates:
            tid = t.get("id")
            meta = SYSTEM_TEMPLATES_METADATA.get(tid, {
                "category": "General",
                "description": f"Layout template with {len(t.get('slots', {}))} configurable slots.",
                "best_for": t.get("best_for", ["general"]),
                "demo_sample": {
                    "headline": "HEADLINE TITLE",
                    "subheadline": "Supporting subheadline text description",
                    "cta_text": "GET STARTED →",
                }
            })
            enriched.append({
                "id": tid,
                "name": t.get("name", tid.replace("-", " ").title()),
                "category": meta.get("category", "General"),
                "description": meta.get("description", ""),
                "best_for": t.get("best_for", meta.get("best_for", [])),
                "slots": t.get("slots", {}),
                "demo_sample": meta.get("demo_sample", {}),
                "is_system": True,
                "aspect_ratio": "1:1",
                "canvas_width": 1080,
                "canvas_height": 1080,
            })
        return enriched
    except Exception as e:
        logger.error(f"Failed loading system templates: {e}")
        return []


# ---------------------------------------------------------------------------
# Request & Response Schemas
# ---------------------------------------------------------------------------

class SlotBounds(BaseModel):
    x_pct: float
    y_pct: float
    w_pct: float
    h_pct: float
    align: Literal["left", "center", "right"] = "center"

class CreateCustomTemplateRequest(BaseModel):
    name: str
    description: Optional[str] = None
    category: Optional[str] = "Custom"
    aspect_ratio: str = "1:1"
    slots: Dict[str, SlotBounds]
    demo_sample: Optional[Dict[str, Any]] = None
    best_for: Optional[List[str]] = Field(default_factory=lambda: ["custom", "promo"])

class SaveCanvasAsTemplateRequest(BaseModel):
    name: str
    description: Optional[str] = None
    category: Optional[str] = "Custom"
    aspect_ratio: str = "1:1"
    canvas_state: Dict[str, Any]
    best_for: Optional[List[str]] = None


# ---------------------------------------------------------------------------
# API Endpoints
# ---------------------------------------------------------------------------

@router.get("")
def get_all_templates(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Returns unified list of all 11 system templates + all custom templates created by the user.
    """
    system_templates = _load_system_templates()

    # Load custom templates from database
    custom_records = (
        db.query(models.ImageTemplate)
        .filter(
            models.ImageTemplate.user_id == current_user.id,
            models.ImageTemplate.creation_method.in_(["poster_slots", "manual", "extracted"])
        )
        .order_by(models.ImageTemplate.created_at.desc())
        .all()
    )

    custom_templates = []
    for rec in custom_records:
        tj = rec.template_json or {}
        slots = tj.get("slots", {})
        
        # If slots are not directly in template_json (e.g. converted from layers), extract them
        if not slots and "layers" in tj:
            slots = {}
            for layer in tj.get("layers", []):
                role = layer.get("role") or layer.get("type", "element")
                slot_id = layer.get("slot") or f"{role}_{layer.get('id', '0')}"
                slots[slot_id] = {
                    "x_pct": layer.get("position_x_percent", 10),
                    "y_pct": layer.get("position_y_percent", 10),
                    "w_pct": layer.get("width_percent", 80),
                    "h_pct": layer.get("height_percent", 20),
                    "align": layer.get("text_align", "center") if layer.get("type") == "text" else "center"
                }

        custom_templates.append({
            "id": f"custom_{rec.id}",
            "db_id": rec.id,
            "name": rec.name,
            "category": tj.get("category", "My Custom Templates"),
            "description": tj.get("description", "Custom user-designed poster template"),
            "best_for": tj.get("best_for", ["custom", "branded"]),
            "slots": slots,
            "demo_sample": tj.get("demo_sample", {
                "headline": rec.name.upper(),
                "subheadline": "Custom template crafted for your social posts",
                "cta_text": "LEARN MORE →",
            }),
            "is_system": False,
            "aspect_ratio": rec.aspect_ratio or "1:1",
            "canvas_width": rec.canvas_width or 1080,
            "canvas_height": rec.canvas_height or 1080,
            "created_at": rec.created_at.isoformat() if rec.created_at else None,
        })

    return {
        "templates": system_templates + custom_templates,
        "total_count": len(system_templates) + len(custom_templates),
        "system_count": len(system_templates),
        "custom_count": len(custom_templates),
    }


@router.post("")
def create_custom_template(
    body: CreateCustomTemplateRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Creates a new custom slot-based poster template for the user.
    """
    if not body.name.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Template name is required",
        )
    if not body.slots:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Template must contain at least one slot",
        )

    slots_dict = {k: v.model_dump() for k, v in body.slots.items()}

    template_payload = {
        "slots": slots_dict,
        "category": body.category or "My Custom Templates",
        "description": body.description or "",
        "best_for": body.best_for or ["custom"],
        "demo_sample": body.demo_sample or {
            "headline": body.name.upper(),
            "subheadline": body.description or "Custom poster layout",
            "cta_text": "ACTION →",
        }
    }

    record = models.ImageTemplate(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        name=body.name.strip(),
        reference_image_url="",
        template_json=template_payload,
        canvas_width=1080,
        canvas_height=1080,
        aspect_ratio=body.aspect_ratio,
        creation_method="poster_slots",
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    logger.info(f"Created custom poster template id={record.id} for user={current_user.id}")

    return {
        "status": "success",
        "template": {
            "id": f"custom_{record.id}",
            "db_id": record.id,
            "name": record.name,
            "category": body.category,
            "description": body.description,
            "slots": slots_dict,
            "is_system": False,
            "aspect_ratio": body.aspect_ratio,
        }
    }


@router.post("/save-canvas-as-template")
def save_canvas_as_template(
    body: SaveCanvasAsTemplateRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Converts an active Poster Lab trace / canvas state into a reusable slot template.
    """
    if not body.name.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Template name is required",
        )

    state = body.canvas_state or {}
    resolved_assets = state.get("resolved_assets", [])
    
    # Derive slots from canvas elements
    slots: Dict[str, Any] = {}
    demo_sample: Dict[str, Any] = {}
    
    canvas_w = float(state.get("canvas_w", 1080) or 1080)
    canvas_h = float(state.get("canvas_h", 1080) or 1080)

    for i, asset in enumerate(resolved_assets):
        role = asset.get("role") or asset.get("type", f"element_{i}")
        slot_name = asset.get("slot") or f"{role}_{i}"

        # Calculate percentages
        x = float(asset.get("x", 0) or 0)
        y = float(asset.get("y", 0) or 0)
        w = float(asset.get("w", 200) or 200)
        h = float(asset.get("h", 80) or 80)

        x_pct = round((x / canvas_w) * 100, 1)
        y_pct = round((y / canvas_h) * 100, 1)
        w_pct = round((w / canvas_w) * 100, 1)
        h_pct = round((h / canvas_h) * 100, 1)

        slots[slot_name] = {
            "x_pct": max(0, min(100, x_pct)),
            "y_pct": max(0, min(100, y_pct)),
            "w_pct": max(5, min(100, w_pct)),
            "h_pct": max(2, min(100, h_pct)),
            "align": asset.get("text_align", "center"),
            "role": role,
            "type": asset.get("type", "text"),
        }

        # Populate demo sample with whatever was in this canvas element
        content = asset.get("content") or asset.get("badge_text") or asset.get("shape_id")
        if content:
            demo_sample[slot_name] = content
            if "headline" in role:
                demo_sample["headline"] = content
            elif "subheadline" in role:
                demo_sample["subheadline"] = content
            elif "badge" in role:
                demo_sample["badge_text"] = content
            elif "cta" in role:
                demo_sample["cta_text"] = content

    template_payload = {
        "slots": slots,
        "category": body.category or "Custom Saved Layouts",
        "description": body.description or f"Saved from Poster Lab canvas with {len(slots)} elements",
        "best_for": body.best_for or ["custom", "social-card"],
        "demo_sample": demo_sample,
        "source_canvas_elements": resolved_assets,
    }

    record = models.ImageTemplate(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        name=body.name.strip(),
        reference_image_url="",
        template_json=template_payload,
        canvas_width=int(canvas_w),
        canvas_height=int(canvas_h),
        aspect_ratio=body.aspect_ratio,
        creation_method="poster_slots",
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    logger.info(f"Saved canvas state as custom template id={record.id} for user={current_user.id}")

    return {
        "status": "success",
        "template": {
            "id": f"custom_{record.id}",
            "db_id": record.id,
            "name": record.name,
            "slots": slots,
            "is_system": False,
        }
    }


@router.delete("/{template_id}")
def delete_custom_template(
    template_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Deletes a user-owned custom poster template. System templates cannot be deleted.
    """
    clean_id = template_id.replace("custom_", "")
    rec = (
        db.query(models.ImageTemplate)
        .filter(models.ImageTemplate.id == clean_id, models.ImageTemplate.user_id == current_user.id)
        .first()
    )
    if not rec:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Custom template not found or unauthorized to delete",
        )

    db.delete(rec)
    db.commit()
    logger.info(f"Deleted custom template id={clean_id} for user={current_user.id}")
    return {"status": "success", "message": f"Template {clean_id} deleted."}


@router.get("/{template_id}/export")
def export_template_json(
    template_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Exports template as a downloadable JSON object.
    """
    if not template_id.startswith("custom_"):
        # System template
        system_templates = _load_system_templates()
        found = next((t for t in system_templates if t["id"] == template_id), None)
        if not found:
            raise HTTPException(status_code=404, detail="System template not found")
        return found

    clean_id = template_id.replace("custom_", "")
    rec = (
        db.query(models.ImageTemplate)
        .filter(models.ImageTemplate.id == clean_id, models.ImageTemplate.user_id == current_user.id)
        .first()
    )
    if not rec:
        raise HTTPException(status_code=404, detail="Custom template not found")

    return {
        "name": rec.name,
        "aspect_ratio": rec.aspect_ratio,
        "template_json": rec.template_json,
        "creation_method": rec.creation_method,
        "version": "1.0",
    }


@router.post("/import")
async def import_template_json(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Imports a custom template from an uploaded JSON file.
    """
    try:
        content = await file.read()
        data = json.loads(content.decode("utf-8"))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON file: {e}")

    name = data.get("name") or "Imported Template"
    tj = data.get("template_json") or data
    aspect_ratio = data.get("aspect_ratio") or "1:1"

    record = models.ImageTemplate(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        name=name.strip(),
        reference_image_url="",
        template_json=tj,
        canvas_width=1080,
        canvas_height=1080,
        aspect_ratio=aspect_ratio,
        creation_method="poster_slots",
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    return {
        "status": "success",
        "template": {
            "id": f"custom_{record.id}",
            "db_id": record.id,
            "name": record.name,
            "slots": tj.get("slots", {}),
            "is_system": False,
        }
    }
