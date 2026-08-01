import logging
from sqlalchemy.orm import Session
from app.services.art_director import run_art_director
from app.services.composition_validator import validate_and_fix_composition
from app.services.vision_critic import run_vision_critic
from app import models

logger = logging.getLogger(__name__)

async def generatePoster(topic: str, persona_id: int, db: Session, user_id: int):
    # 1. Load Persona Brand Kit (Task 5)
    persona = None
    brand_palette_id = None
    brand_font_pair_id = None
    if persona_id:
        persona = db.query(models.AIPersona).filter(models.AIPersona.id == persona_id).first()
        if persona:
            brand_palette_id = persona.brand_palette_id
            brand_font_pair_id = persona.brand_font_pair_id

    # 2. Run Art Director (Task 2)
    logger.info("Running AI Art Director...")
    try:
        # Pass brand kit so the prompt enforces them if present
        ad_output = run_art_director(
            topic=topic,
            brand_palette_id=brand_palette_id,
            brand_font_pair_id=brand_font_pair_id
        )
    except Exception as e:
        logger.error(f"Art Director failed: {e}")
        raise

    # In a full system, we would resolve the template_id, palette_id, font_pair_id from ad_output
    # against the design-resources JSONs to get concrete hex codes, fonts, and template slots.
    # For now, let's pretend we have a `resolved_elements` list and `background_color`.
    
    # 3. Resolve Template (Mocked for integration)
    resolved_elements = [
        {"type": "text", "role": "headline", "content": ad_output.headline, "x": 100, "y": 100, "w": 800, "h": 200, "font_size": 120, "color": "#FFFFFF"},
        {"type": "text", "role": "subheadline", "content": ad_output.subheadline, "x": 100, "y": 350, "w": 800, "h": 100, "font_size": 60, "color": "#FFFFFF"}
    ]
    if ad_output.text_logo:
        resolved_elements.append(
            {"type": "text", "role": "logo", "content": ad_output.text_logo.content, "x": 100, "y": 800, "w": 300, "h": 100, "font_size": 40, "color": "#FFFFFF"}
        )
    canvas_w, canvas_h = 1080, 1080
    background_color = "#121212" # Resolved from palette
    overlay_opacity = 0.4 if ad_output.use_contrast_overlay else 0.0

    # 4. Background Resolution & Secondary Stock Photo Fallback (Task 6 handled inside stock_photos.py)
    # If photo requested, we'd call stock_photos.py search_stock_photos. If it fails, fallback to solid/gradient.
    
    # 5. Composition Validator (Task 3)
    logger.info("Running Composition Validator...")
    final_opacity = validate_and_fix_composition(
        elements=resolved_elements,
        canvas_w=canvas_w,
        canvas_h=canvas_h,
        background_color=background_color,
        overlay_opacity=overlay_opacity
    )

    # 6. Render Engine (Mocked - would call HTML-to-image or PIL pipeline)
    # image_bytes = render_poster(resolved_elements, background_color, final_opacity)
    image_bytes = b"MOCK_PNG_DATA"

    # 7. Vision Critic Pass (Task 4)
    logger.info("Running Vision Critic...")
    critic_res = run_vision_critic(image_bytes)
    
    if critic_res.status == "needs_fix":
        logger.info(f"Vision critic suggested fix for {critic_res.target_slot}: {critic_res.suggested_change}")
        # In full implementation, loop back to step 5 applying the suggested_change patch (max 2 iterations)

    logger.info("Poster generation complete.")
    return {
        "status": "success",
        "art_director": ad_output.model_dump(),
        "final_opacity": final_opacity,
        "vision_critic": critic_res.model_dump()
    }
