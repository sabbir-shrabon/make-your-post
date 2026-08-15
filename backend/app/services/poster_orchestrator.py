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
    allow_pexels_bg: bool = False,
    allow_cat_bg: bool = False,
    headline_hint: str | None = None,
    subheadline_hint: str | None = None,
    badge_hint: str | None = None,
    visual_asset_query: str | None = None,
    mood_hint: str | None = None,
    template_id: str | None = None,
) -> dict:
    run_id = str(uuid.uuid4())
    logger.info("[run=%s][Candidate #%d] Running AI Art Director (temp=%.2f, template=%s)...", run_id, candidate_index, temperature, template_id)
    try:
        ad_output = run_art_director(
            topic=topic,
            brand_palette_id=brand_palette_id,
            brand_font_pair_id=brand_font_pair_id,
            user_id=user_id,
            db=db,
            mood_hint=mood_hint,
            allow_pexels_bg=allow_pexels_bg,
            allow_cat_bg=allow_cat_bg,
            headline_hint=headline_hint,
            subheadline_hint=subheadline_hint,
            badge_hint=badge_hint,
            visual_asset_query=visual_asset_query,
            template_id=template_id,
        )
    except Exception as exc:
        logger.error("[run=%s][Candidate #%d] Art Director failed: %s", run_id, candidate_index, exc)
        return {
            "run_id": run_id,
            "candidate_index": candidate_index,
            "composite_score": 0.0,
            "aesthetic_score": 0.0,
            "critic_status": "fail",
            "art_director": {},
            "resolved_assets": [],
            "final_opacity": 0.0,
            "vision_critic": {"status": "fail"},
            "original_vision_critic": {"status": "fail"},
            "fixed_vision_critic": None,
            "base64_image": None,
            "output_path": None,
        }

    background_choice_dict = None

    resolved_asset_refs: list[dict] = []
    for elem in ad_output.elements:
        asset_ref = resolve_resource(
            asset_type=elem.type,
            description=elem.description,
            user_id=user_id,
            db=db,
            allow_cat_bg=allow_cat_bg,
        )
        if asset_ref["resolved"] is None and elem.type in ["icon", "emoji", "cat_photo", "photo"]:
            logger.info("[run=%s] Dropping unresolved element: type=%s desc=%r", run_id, elem.type, elem.description)
            continue
        resolved_asset_refs.append({
            **elem.model_dump(),
            **asset_ref,
        })

    canvas_w, canvas_h = 1080, 1080
    overlay_opacity = 0.0
    palette = next((p for p in PALETTES if p["id"] == ad_output.palette_id), PALETTES[0])
    background_color = ad_output.background_color
    
    template_slots = resolve_template_slots(ad_output.template_id, canvas_w, canvas_h)
    validation_elements = []
    for elem in resolved_asset_refs:
        slot_name = elem.get("slot")
        if slot_name in template_slots:
            slot_config = template_slots[slot_name]
            elem["x"] = slot_config["x"]
            elem["y"] = slot_config["y"]
            elem["w"] = slot_config["w"]
            elem["h"] = slot_config["h"]
            elem["text_align"] = slot_config.get("align", "left")
            validation_elements.append(elem)
        elif (
            elem.get("type") in ("photo", "cat_photo")
            or elem.get("role") in ("background", "contrast_overlay", "backdrop")
            or slot_name in ("background", "canvas_background", "backdrop")
            or elem.get("z_index", 1) <= 1
        ):
            elem["x"] = 0
            elem["y"] = 0
            elem["w"] = canvas_w
            elem["h"] = canvas_h
            validation_elements.append(elem)
        else:
            logger.warning("[run=%s] Dropping element mapped to invalid slot: %r for template %r", run_id, slot_name, ad_output.template_id)

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
            background_color=background_color,
            run_id=run_id,
            allow_pexels_bg=allow_pexels_bg,
            allow_cat_bg=allow_cat_bg,
        )
    except Exception as e:
        import traceback
        logger.error("[run=%s][Candidate #%d] Render failed: %s\n%s", run_id, candidate_index, e, traceback.format_exc())
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
                    background_color=background_color,
                    run_id=run_id,
                    allow_pexels_bg=allow_pexels_bg,
                    allow_cat_bg=allow_cat_bg,
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
        "background_resolution": None,
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
    persona_id: int | None,
    db: Session,
    user_id: int,
    candidate_count: int | None = None,
    use_news_grounding: bool = False,
    allow_pexels_bg: bool = False,
    allow_cat_bg: bool = False,
    headline_hint: str | None = None,
    subheadline_hint: str | None = None,
    badge_hint: str | None = None,
    visual_asset_query: str | None = None,
    mood_hint: str | None = None,
    brand_palette_id: str | None = None,
    brand_font_pair_id: str | None = None,
    template_id: str | None = None,
):
    persona = None
    if persona_id:
        persona = db.query(models.AIPersona).filter(models.AIPersona.id == persona_id).first()
        if persona:
            brand_palette_id = brand_palette_id or persona.brand_palette_id
            brand_font_pair_id = brand_font_pair_id or persona.brand_font_pair_id

    num_candidates = candidate_count or (getattr(persona, "candidate_count", 3) if persona else 3) or 3
    num_candidates = max(1, min(num_candidates, 5))

    logger.info("Generating %d poster candidate(s) (template=%s)...", num_candidates, template_id)
    if use_news_grounding:
        logger.info("use_news_grounding requested, but Poster Studio has no dedicated Google News API text-generation path wired; skipping.")

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
            allow_pexels_bg=allow_pexels_bg,
            allow_cat_bg=allow_cat_bg,
            headline_hint=headline_hint,
            subheadline_hint=subheadline_hint,
            badge_hint=badge_hint,
            visual_asset_query=visual_asset_query,
            mood_hint=mood_hint,
            template_id=template_id,
        )
        candidates.append(cand)

    candidates.sort(key=lambda c: c["composite_score"], reverse=True)
    winner = candidates[0]

    if winner.get("base64_image") is None:
        logger.error("All poster candidates failed to generate.")
        raise RuntimeError("Poster pipeline failed: The AI model could not generate a valid design. Please try again or check your model connection.")

    logger.info(
        "Selected winning candidate #%d with score %.3f (critic=%s, aesthetic=%.3f)",
        winner["candidate_index"], winner["composite_score"], winner["critic_status"], winner["aesthetic_score"],
    )

    # Compile all generated variants for multi-variant selection
    variants = [
        {
            "candidate_index": c["candidate_index"],
            "composite_score": c["composite_score"],
            "aesthetic_score": c["aesthetic_score"],
            "critic_status": c["critic_status"],
            "is_winner": (c["candidate_index"] == winner["candidate_index"]),
            "base64_image": c["base64_image"],
            "output_path": c["output_path"],
            "art_director": c["art_director"],
            "resolved_assets": c["resolved_assets"],
            "final_opacity": c["final_opacity"],
            "vision_critic": c["vision_critic"],
        }
        for c in candidates
        if c.get("base64_image")
    ]

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
        "variants": variants,
        "art_director": winner["art_director"],
        "resolved_assets": winner["resolved_assets"],
        "background_resolution": None,
        "final_opacity": winner["final_opacity"],
        "vision_critic": winner["vision_critic"],
        "original_vision_critic": winner.get("original_vision_critic"),
        "fixed_vision_critic": winner.get("fixed_vision_critic"),
        "aesthetic_score": winner["aesthetic_score"],
        "composite_score": winner["composite_score"],
        "base64_image": winner["base64_image"],
        "output_path": winner["output_path"],
    }

async def regeneratePosterLayer(
    element_index: int,
    current_state: dict,
    topic: str,
    db: Session,
    user_id: int,
    prompt_hint: str | None = None,
    allow_pexels_bg: bool = False,
    allow_cat_bg: bool = False,
):
    from app.services.art_director import run_art_director_layer_regen
    
    run_id = str(uuid.uuid4())
    logger.info("[run=%s] Regenerating single layer index %d for topic '%s'...", run_id, element_index, topic)

    resolved_assets = list(current_state.get("resolved_assets", []))
    if element_index < 0 or element_index >= len(resolved_assets):
        raise ValueError(f"Invalid element index {element_index} (total {len(resolved_assets)} elements)")

    target_elem = dict(resolved_assets[element_index])
    
    # 1. Ask LLM to regenerate copy/keywords for this specific layer
    regen_patch = run_art_director_layer_regen(
        target_element=target_elem,
        topic=topic,
        prompt_hint=prompt_hint,
        user_id=user_id,
        db=db,
    )

    # 2. Apply patch to target_elem
    for k, v in regen_patch.items():
        if v is not None:
            target_elem[k] = v

    # 3. If it's an asset layer (icon, emoji, photo), resolve fresh resource
    if target_elem.get("type") in ["icon", "emoji", "cat_photo", "photo"]:
        asset_ref = resolve_resource(
            asset_type=target_elem["type"],
            description=target_elem.get("description", topic),
            user_id=user_id,
            db=db,
            allow_cat_bg=allow_cat_bg,
        )
        if asset_ref.get("resolved"):
            target_elem.update(asset_ref)

    resolved_assets[element_index] = target_elem

    art_director = current_state.get("art_director", {})
    template_id = art_director.get("template_id", "centered-hero")
    palette_id = art_director.get("palette_id", "vibrant_indigo")
    font_pair_id = art_director.get("font_pair_id", "bold_modern")
    background_color = art_director.get("background_color", "#111827")

    canvas_w = current_state.get("canvas_w", 1080)
    canvas_h = current_state.get("canvas_h", 1080)

    palette = next((p for p in PALETTES if p["id"] == palette_id), PALETTES[0])

    final_opacity = validate_and_fix_composition(
        elements=resolved_assets,
        canvas_w=canvas_w,
        canvas_h=canvas_h,
        background_color=background_color,
        overlay_opacity=current_state.get("final_opacity", 0.0),
        palette=palette,
    )

    try:
        base64_img, output_path = render_poster_to_base64(
            elements=resolved_assets,
            template_id=template_id,
            palette_id=palette_id,
            font_pair_id=font_pair_id,
            canvas_w=canvas_w,
            canvas_h=canvas_h,
            overlay_opacity=final_opacity,
            background_color=background_color,
            run_id=run_id,
            allow_pexels_bg=allow_pexels_bg,
            allow_cat_bg=allow_cat_bg,
        )
    except Exception as e:
        logger.error("[run=%s] Render failed for layer regeneration: %s", run_id, e)
        base64_img, output_path = None, None

    return {
        "status": "success",
        "run_id": run_id,
        "regenerated_index": element_index,
        "art_director": art_director,
        "resolved_assets": resolved_assets,
        "final_opacity": final_opacity,
        "base64_image": base64_img,
        "output_path": output_path,
    }

async def mutatePoster(

    mutation_prompt: str,
    current_state: dict,
    db: Session,
    user_id: int,
    allow_pexels_bg: bool = False,
    allow_cat_bg: bool = False,
):
    from app.services.art_director import run_art_director_mutation
    
    run_id = str(uuid.uuid4())
    logger.info("[run=%s] Running AI Art Director Mutation...", run_id)
    
    # 1. Ask LLM to mutate the JSON
    try:
        ad_output = run_art_director_mutation(
            mutation_prompt=mutation_prompt,
            current_state=current_state,
            user_id=user_id,
            db=db,
        )
    except Exception as exc:
        logger.error("[run=%s] Mutation failed: %s", run_id, exc)
        raise exc

    # 2. Resolve missing assets
    resolved_asset_refs = []
    for elem in ad_output.elements:
        elem_dict = elem.model_dump()
        
        # If the LLM changed the description or type, or didn't preserve the 'resolved' field, resolve it again
        if not elem_dict.get("resolved") and elem_dict.get("type") in ["icon", "emoji", "cat_photo", "photo"]:
            asset_ref = resolve_resource(
                asset_type=elem_dict["type"],
                description=elem_dict["description"],
                user_id=user_id,
                db=db,
                allow_cat_bg=allow_cat_bg,
            )
            if asset_ref["resolved"] is None:
                continue
            elem_dict.update(asset_ref)
            
        resolved_asset_refs.append(elem_dict)

    # 3. Ensure slots/coordinates are applied if LLM reset them
    canvas_w, canvas_h = 1080, 1080 # default, can be passed
    template_slots = resolve_template_slots(ad_output.template_id, canvas_w, canvas_h)
    
    validation_elements = []
    for elem in resolved_asset_refs:
        # if LLM stripped coordinates, re-apply them from slots
        if elem.get("x") is None:
            slot_name = elem.get("slot")
            if slot_name in template_slots:
                slot_config = template_slots[slot_name]
                elem["x"] = slot_config["x"]
                elem["y"] = slot_config["y"]
                elem["w"] = slot_config["w"]
                elem["h"] = slot_config["h"]
                elem["text_align"] = slot_config.get("align", "left")
            elif elem.get("type") in ("photo", "cat_photo") and elem.get("z_index", 1) == 0:
                elem["x"] = 0
                elem["y"] = 0
                elem["w"] = canvas_w
                elem["h"] = canvas_h
        validation_elements.append(elem)

    palette = next((p for p in PALETTES if p["id"] == ad_output.palette_id), PALETTES[0])
    
    # We skip Vision Critic for mutations to keep it fast, or we could run it.
    final_opacity = validate_and_fix_composition(
        elements=validation_elements,
        canvas_w=canvas_w,
        canvas_h=canvas_h,
        background_color=ad_output.background_color,
        overlay_opacity=0.0,
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
            background_color=ad_output.background_color,
            run_id=run_id,
            allow_pexels_bg=allow_pexels_bg,
            allow_cat_bg=allow_cat_bg,
        )
    except Exception as e:
        logger.error("[run=%s] Render failed for mutation: %s", run_id, e)
        base64_img, output_path = None, None

    return {
        "status": "success",
        "run_id": run_id,
        "art_director": ad_output.model_dump(),
        "resolved_assets": validation_elements,
        "final_opacity": final_opacity,
        "base64_image": base64_img,
        "output_path": output_path,
    }
