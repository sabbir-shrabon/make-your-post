import base64
import json
import logging
import os
import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session
from app.services.art_director import run_art_director
from app.services.composition_validator import validate_and_fix_composition
from app.services.vision_critic import run_vision_critic, VisionCriticResponse
from app.services.resource_resolver_unified import resolve_resource
from app.services.poster_renderer import render_poster_to_base64, resolve_template_slots, PALETTES
from app import models
from app.services.aesthetic_scorer import score_poster_aesthetic

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Per-run diagnostic logging
# ---------------------------------------------------------------------------
RUNS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(
    os.path.abspath(__file__)))), "runs")


def _write_run_log(run_id: str, data: dict) -> None:
    """Best-effort write of a per-run diagnostic JSON file."""
    try:
        os.makedirs(RUNS_DIR, exist_ok=True)
        path = os.path.join(RUNS_DIR, f"{run_id}.json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, default=str)
        logger.info("[run=%s] Diagnostic log written: %s", run_id, path)
    except Exception as exc:
        logger.warning("[run=%s] Failed to write diagnostic log: %s", run_id, exc)

def apply_vision_critic_patch(
    target_slot: str | None,
    suggested_change: str | None,
    validation_elements: list[dict],
    overlay_opacity: float,
) -> float:
    """
    Translates Vision Critic's text suggestion into layout adjustments.
    Modifies validation_elements in place and returns updated overlay_opacity.
    """
    target = (target_slot or "").lower()
    change = (suggested_change or "").lower()

    if not change and not target:
        return overlay_opacity

    applied = False

    # 1. Rule-based checks for overlay / contrast / background
    if target in ("background", "overlay") or any(w in change for w in ("overlay", "contrast", "darken", "opacity")):
        if any(w in change for w in ("decrease", "less", "lower", "reduce")):
            overlay_opacity = max(0.0, overlay_opacity - 0.15)
        else:
            overlay_opacity = min(0.85, overlay_opacity + 0.15)
        applied = True

    # 2. Rule-based checks for text elements & slot items
    for el in validation_elements:
        el_slot = (el.get("slot") or "").lower()
        el_role = (el.get("role") or "").lower()

        is_target_element = (
            (target and (target == el_slot or target == el_role)) or
            ("headline" in target and "headline" in el_role) or
            ("subheadline" in target and "subheadline" in el_role)
        )

        if is_target_element or (el.get("type") == "text" and any(w in change for w in ("font", "text", "headline"))):
            if any(w in change for w in ("shrink", "smaller", "reduce", "decrease")):
                if "font_size" in el:
                    el["font_size"] = max(12, int(el["font_size"] * 0.8))
                    applied = True
            elif any(w in change for w in ("grow", "larger", "increase", "bigger")):
                if "font_size" in el:
                    el["font_size"] = int(el["font_size"] * 1.2)
                    applied = True

        # Nudge / position checks
        if is_target_element and any(w in change for w in ("move", "nudge", "raise", "lower", "shift")):
            if "lower" in change or "down" in change:
                el["y"] += 20
                applied = True
            elif "raise" in change or "up" in change:
                el["y"] = max(0, el["y"] - 20)
                applied = True

    # 3. LLM Fallback if no rule matched
    if not applied and suggested_change:
        try:
            from app.providers.llm_providers import generate_text
            prompt = (
                f"Target slot: '{target_slot}', Suggestion: '{suggested_change}'. "
                f"Convert this into JSON: {{\"action\": \"opacity|font_size|nudge\", \"target\": \"{target_slot}\", \"factor\": 0.8, \"delta\": 0.15}}"
            )
            resp = generate_text(prompt=prompt, system_prompt="Output only valid JSON.", temperature=0.1, max_tokens=100)
            if resp and "opacity" in resp.lower():
                overlay_opacity = min(0.85, overlay_opacity + 0.15)
        except Exception as e:
            logger.warning(f"LLM patch fallback failed: {e}")

    return overlay_opacity


def _generate_single_candidate(
    topic: str,
    brand_palette_id: str | None,
    brand_font_pair_id: str | None,
    user_id: int,
    db: Session,
    candidate_index: int,
    temperature: float = 0.7,
) -> dict:
    run_id = str(uuid.uuid4())
    logger.info("[run=%s][Candidate #%d] Running AI Art Director (temp=%.2f)...", run_id, candidate_index, temperature)
    ad_output = run_art_director(
        topic=topic,
        brand_palette_id=brand_palette_id,
        brand_font_pair_id=brand_font_pair_id,
        user_id=user_id,
        db=db,
    )

    resolved_asset_refs: list[dict] = []
    for elem in ad_output.elements:
        asset_ref = resolve_resource(
            asset_type=elem.type,
            description=elem.description,
            user_id=user_id,
            db=db,
        )
        if asset_ref["resolved"] is None:
            logger.info("[run=%s] Dropping unresolved element: type=%s desc=%r", run_id, elem.type, elem.description)
            continue
        resolved_asset_refs.append({
            **elem.model_dump(),
            **asset_ref,
        })

    canvas_w, canvas_h = 1080, 1080
    overlay_opacity = 0.4 if ad_output.use_contrast_overlay else 0.0
    palette = next((p for p in PALETTES if p["id"] == ad_output.palette_id), PALETTES[0])
    background_color = palette.get("background", {}).get("hex", "#121212")
    text_color = palette.get("text_on_dark", "#FFFFFF")
    
    slots = resolve_template_slots(ad_output.template_id, canvas_w, canvas_h)
    validation_elements = []
    
    if "headline" in slots:
        slot = slots["headline"]
        validation_elements.append({
            "type": "text", "role": "headline", "content": ad_output.headline,
            "x": slot["x"], "y": slot["y"], "w": slot["w"], "h": slot["h"],
            "font_size": 60, "color": text_color
        })
        
    if "subheadline" in slots:
        slot = slots["subheadline"]
        validation_elements.append({
            "type": "text", "role": "subheadline", "content": ad_output.subheadline,
            "x": slot["x"], "y": slot["y"], "w": slot["w"], "h": slot["h"],
            "font_size": 30, "color": text_color
        })

    if ad_output.details_block and "details_block" in slots:
        slot = slots["details_block"]
        db_obj = ad_output.details_block
        parts = []
        if db_obj.date_time: parts.append(db_obj.date_time)
        if db_obj.location: parts.append(db_obj.location)
        if db_obj.featuring: parts.append("Ft: " + ", ".join(db_obj.featuring))
        content = " | ".join(parts)
        if content:
            validation_elements.append({
                "type": "text", "role": "details_block", "content": content,
                "x": slot["x"], "y": slot["y"], "w": slot["w"], "h": slot["h"],
                "font_size": 20, "color": text_color
            })

    if ad_output.cta_text and "cta_text" in slots:
        slot = slots["cta_text"]
        validation_elements.append({
            "type": "text", "role": "cta_text", "content": ad_output.cta_text,
            "x": slot["x"], "y": slot["y"], "w": slot["w"], "h": slot["h"],
            "font_size": 24, "color": text_color
        })
        
    for r in resolved_asset_refs:
        slot_name = r.get("slot")
        if slot_name in slots:
            slot = slots[slot_name]
            r["x"], r["y"], r["w"], r["h"] = slot["x"], slot["y"], slot["w"], slot["h"]
            validation_elements.append(r)
        else:
            logger.warning("[run=%s] Dropping element '%s' — slot '%s' not found in template '%s'", 
                           run_id, r.get("description"), slot_name, ad_output.template_id)

    final_opacity = validate_and_fix_composition(
        elements=validation_elements,
        canvas_w=canvas_w,
        canvas_h=canvas_h,
        background_color=background_color,
        overlay_opacity=overlay_opacity,
        palette=palette,
    )

    try:
        base64_img, output_path = render_poster_to_base64(
            elements=validation_elements,
            template_id=ad_output.template_id,
            palette_id=ad_output.palette_id,
            font_pair_id=ad_output.font_pair_id,
            canvas_w=canvas_w,
            canvas_h=canvas_h,
            overlay_opacity=final_opacity,
            background_choice=ad_output.background_choice.model_dump() if ad_output.background_choice else None,
            run_id=run_id,
        )
    except Exception as e:
        logger.error("[run=%s][Candidate #%d] Render failed: %s", run_id, candidate_index, e)
        base64_img, output_path = None, None

    original_critic = VisionCriticResponse(status="pass")
    fixed_critic = None

    if base64_img:
        try:
            image_bytes = base64.b64decode(base64_img)
            original_critic = run_vision_critic(image_bytes)
        except Exception as exc:
            logger.warning("[run=%s][Candidate #%d] Vision critic pass 1 failed: %s", run_id, candidate_index, exc)

        if original_critic.status == "needs_fix":
            final_opacity = apply_vision_critic_patch(
                target_slot=original_critic.target_slot,
                suggested_change=original_critic.suggested_change,
                validation_elements=validation_elements,
                overlay_opacity=final_opacity,
            )
            final_opacity = validate_and_fix_composition(
                elements=validation_elements,
                canvas_w=canvas_w, canvas_h=canvas_h,
                background_color=background_color, overlay_opacity=final_opacity,
                palette=palette,
            )
            try:
                new_base64_img, new_output_path = render_poster_to_base64(
                    elements=validation_elements,
                    template_id=ad_output.template_id,
                    palette_id=ad_output.palette_id,
                    font_pair_id=ad_output.font_pair_id,
                    canvas_w=canvas_w, canvas_h=canvas_h,
                    overlay_opacity=final_opacity,
                    background_choice=ad_output.background_choice.model_dump() if ad_output.background_choice else None,
                    run_id=run_id,
                )
                if new_base64_img:
                    base64_img, output_path = new_base64_img, new_output_path
                    try:
                        new_image_bytes = base64.b64decode(base64_img)
                        fixed_critic = run_vision_critic(new_image_bytes)
                    except Exception:
                        fixed_critic = VisionCriticResponse(status="pass")
            except Exception as e:
                logger.error("[run=%s][Candidate #%d] Re-render failed: %s", run_id, candidate_index, e)

    final_critic = fixed_critic or original_critic
    critic_score = 1.0 if final_critic.status == "pass" else 0.5
    
    image_bytes = base64.b64decode(base64_img) if base64_img else b""
    aesthetic_score = score_poster_aesthetic(image_bytes, validation_elements)
    composite_score = critic_score * 0.5 + aesthetic_score * 0.5

    # -- Per-run diagnostic log ------------------------------------------------
    _write_run_log(run_id, {
        "run_id": run_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "topic": topic,
        "candidate_index": candidate_index,
        "temperature": temperature,
        "art_director_output": ad_output.model_dump(),
        "resolved_assets": resolved_asset_refs,
        "background_choice": (
            ad_output.background_choice.model_dump()
            if ad_output.background_choice else None
        ),
        "template_id": ad_output.template_id,
        "palette_id": ad_output.palette_id,
        "font_pair_id": ad_output.font_pair_id,
        "validation_elements": validation_elements,
        "final_overlay_opacity": final_opacity,
        "vision_critic": final_critic.model_dump(),
        "aesthetic_score": aesthetic_score,
        "composite_score": composite_score,
        "output_path": output_path,
    })

    return {
        "run_id": run_id,
        "candidate_index": candidate_index,
        "composite_score": composite_score,
        "aesthetic_score": aesthetic_score,
        "critic_status": final_critic.status,
        "art_director": ad_output.model_dump(),
        "resolved_assets": resolved_asset_refs,
        "final_opacity": final_opacity,
        "vision_critic": final_critic.model_dump(),
        "original_vision_critic": original_critic.model_dump(),
        "fixed_vision_critic": fixed_critic.model_dump() if fixed_critic else None,
        "base64_image": base64_img,
        "output_path": output_path,
    }


async def generatePoster(
    topic: str,
    persona_id: int,
    db: Session,
    user_id: int,
    candidate_count: int | None = None,
):
    persona = None
    brand_palette_id = None
    brand_font_pair_id = None
    if persona_id:
        persona = db.query(models.AIPersona).filter(models.AIPersona.id == persona_id).first()
        if persona:
            brand_palette_id = persona.brand_palette_id
            brand_font_pair_id = persona.brand_font_pair_id

    num_candidates = candidate_count or (getattr(persona, "candidate_count", 3) if persona else 3) or 3
    num_candidates = max(1, min(num_candidates, 5))

    logger.info("Generating %d poster candidate(s)...", num_candidates)

    candidates = []
    temperatures = [0.7, 0.85, 0.9, 0.95, 1.0]

    for i in range(num_candidates):
        temp = temperatures[i % len(temperatures)]
        cand = _generate_single_candidate(
            topic=topic,
            brand_palette_id=brand_palette_id,
            brand_font_pair_id=brand_font_pair_id,
            user_id=user_id,
            db=db,
            candidate_index=i + 1,
            temperature=temp,
        )
        candidates.append(cand)

    candidates.sort(key=lambda c: c["composite_score"], reverse=True)
    winner = candidates[0]

    logger.info(
        "Selected winning candidate #%d with score %.3f (critic=%s, aesthetic=%.3f)",
        winner["candidate_index"], winner["composite_score"], winner["critic_status"], winner["aesthetic_score"],
    )

    # Discard non-selected candidate output files without leaving orphaned uploads
    for cand in candidates[1:]:
        discarded_path = cand.get("output_path")
        if discarded_path and os.path.exists(discarded_path):
            try:
                os.remove(discarded_path)
                logger.info("Purged discarded candidate #%d output file: %s", cand["candidate_index"], discarded_path)
            except Exception as e:
                logger.warning("Failed to purge discarded output file %s: %s", discarded_path, e)

    summary_scores = [
        {
            "candidate": c["candidate_index"],
            "composite_score": c["composite_score"],
            "aesthetic_score": c["aesthetic_score"],
            "critic_status": c["critic_status"],
            "is_winner": (c["candidate_index"] == winner["candidate_index"]),
        }
        for c in candidates
    ]

    return {
        "status": "success",
        "run_id": winner["run_id"],
        "winning_candidate_index": winner["candidate_index"],
        "candidate_scores": summary_scores,
        "art_director": winner["art_director"],
        "resolved_assets": winner["resolved_assets"],
        "final_opacity": winner["final_opacity"],
        "vision_critic": winner["vision_critic"],
        "original_vision_critic": winner.get("original_vision_critic"),
        "fixed_vision_critic": winner.get("fixed_vision_critic"),
        "aesthetic_score": winner["aesthetic_score"],
        "composite_score": winner["composite_score"],
        "base64_image": winner["base64_image"],
        "output_path": winner["output_path"],
    }

