"""
meme_generator.py
-----------------
Cognitive engine for generating viral memes, witty social scenarios, and matching captions.
"""

from __future__ import annotations

import json
import logging
import random
import time
from typing import Optional, Literal
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app import models
from app.providers.llm_providers import generate_text_for_user
from app.services.meme_renderer import render_classic_meme, render_modern_card_meme

logger = logging.getLogger(__name__)

# Curated high-engagement built-in viral themes with fallback images
BUILTIN_MEME_THEMES = [
    {
        "id": "cat-humor",
        "name": "🐱 Cat & Pet Chaos",
        "category": "humor",
        "description": "Relatable pet behavior, dramatic cats, and hilarious domestic chaos.",
        "sample_queries": ["dramatic funny cat", "cat staring shocked", "cat working on laptop", "grumpy cat looking"],
        "fallback_images": [
            "https://images.pexels.com/photos/45201/kitty-cat-kitten-pet-45201.jpeg?auto=compress&cs=tinysrgb&w=800",
            "https://images.pexels.com/photos/104827/cat-pet-animal-domestic-104827.jpeg?auto=compress&cs=tinysrgb&w=800",
            "https://images.pexels.com/photos/2071873/pexels-photo-2071873.jpeg?auto=compress&cs=tinysrgb&w=800",
        ],
    },
    {
        "id": "tech-dev",
        "name": "💻 Tech & Dev Life",
        "category": "tech",
        "description": "Coding struggles, deployment disasters, coffee addiction, and AI takes.",
        "sample_queries": ["exhausted programmer night", "stressed developer laptop", "confused person computer"],
        "fallback_images": [
            "https://images.pexels.com/photos/1181263/pexels-photo-1181263.jpeg?auto=compress&cs=tinysrgb&w=800",
            "https://images.pexels.com/photos/574071/pexels-photo-574071.jpeg?auto=compress&cs=tinysrgb&w=800",
            "https://images.pexels.com/photos/3861969/pexels-photo-3861969.jpeg?auto=compress&cs=tinysrgb&w=800",
        ],
    },
    {
        "id": "startup-founder",
        "name": "🚀 Startup & Founder Grind",
        "category": "business",
        "description": "Pitch deck realities, bootstrapping stress, MVP launches, and coffee runs.",
        "sample_queries": ["founder working late coffee", "stressed business meeting", "startup chaos whiteboards"],
        "fallback_images": [
            "https://images.pexels.com/photos/3182812/pexels-photo-3182812.jpeg?auto=compress&cs=tinysrgb&w=800",
            "https://images.pexels.com/photos/3184360/pexels-photo-3184360.jpeg?auto=compress&cs=tinysrgb&w=800",
            "https://images.pexels.com/photos/1181438/pexels-photo-1181438.jpeg?auto=compress&cs=tinysrgb&w=800",
        ],
    },
    {
        "id": "fitness-gym",
        "name": "💪 Fitness & Gym Motivation",
        "category": "lifestyle",
        "description": "Leg day regrets, pre-workout kicking in, cheat meal logic, and gym culture.",
        "sample_queries": ["tired exhausted gym person", "person lifting heavy weights", "funny fitness workout"],
        "fallback_images": [
            "https://images.pexels.com/photos/841130/pexels-photo-841130.jpeg?auto=compress&cs=tinysrgb&w=800",
            "https://images.pexels.com/photos/1552242/pexels-photo-1552242.jpeg?auto=compress&cs=tinysrgb&w=800",
            "https://images.pexels.com/photos/949126/pexels-photo-949126.jpeg?auto=compress&cs=tinysrgb&w=800",
        ],
    },
]


def _clean_json(raw: str) -> dict:
    cleaned = raw.strip()
    if "```" in cleaned:
        start = cleaned.find("```json")
        if start != -1:
            start += 7
        else:
            start = cleaned.find("```") + 3
        end = cleaned.rfind("```")
        cleaned = cleaned[start:end].strip()
    return json.loads(cleaned)


async def generate_meme_post(
    db: Session,
    user_id: int,
    theme_id: Optional[str] = None,
    custom_theme_id: Optional[str] = None,
    custom_prompt: Optional[str] = None,
    custom_image_url: Optional[str] = None,
    format_style: Literal["classic", "modern_card"] = "modern_card",
    page_connection_id: Optional[int] = None,
    persona_id: Optional[int] = None,
) -> dict:
    """
    Generate a full viral meme + matching Facebook caption in 1 click using active Persona humor guidelines.
    """
    t_start = time.perf_counter()

    # 1. Resolve Page / Persona / Brand Context
    page = None
    persona = None
    if persona_id:
        persona = db.query(models.AIPersona).filter(
            models.AIPersona.id == persona_id,
            models.AIPersona.user_id == user_id,
        ).first()

    if page_connection_id:
        page = db.query(models.FacebookConnection).filter(
            models.FacebookConnection.id == page_connection_id,
            models.FacebookConnection.user_id == user_id,
        ).first()

    if not persona and page_connection_id:
        persona = db.query(models.AIPersona).filter(
            models.AIPersona.page_connection_id == page_connection_id,
            models.AIPersona.is_active == True,
        ).first()

    brand_profile = db.query(models.BrandProfile).filter(models.BrandProfile.user_id == user_id).first()
    brand_name = page.page_name if page else (brand_profile.brand_name if brand_profile else "Creator")
    avatar_url = page.page_picture_url if page else (brand_profile.logo_url if brand_profile else None)
    handle = "@" + brand_name.lower().replace(" ", "")

    if persona:
        if persona.meme_format_preference and format_style == "modern_card":
            if persona.meme_format_preference in ("classic", "modern_card"):
                format_style = persona.meme_format_preference  # type: ignore
        if persona.meme_theme_id and not theme_id and not custom_theme_id:
            theme_id = persona.meme_theme_id

    # 2. Resolve Theme & Source Image
    theme_meta = None
    target_image = custom_image_url

    if custom_theme_id:
        custom_theme = db.query(models.CustomTheme).filter(
            models.CustomTheme.id == custom_theme_id,
            models.CustomTheme.user_id == user_id,
        ).first()
        if custom_theme:
            theme_meta = {
                "name": custom_theme.name,
                "description": custom_theme.description or custom_theme.name,
            }
            if custom_theme.assets and not target_image:
                selected_asset = random.choice(custom_theme.assets)
                target_image = selected_asset.image_url
                if selected_asset.caption_prompt_hint and not custom_prompt:
                    custom_prompt = selected_asset.caption_prompt_hint

    if not theme_meta:
        theme_meta = next((t for t in BUILTIN_MEME_THEMES if t["id"] == theme_id), BUILTIN_MEME_THEMES[0])

    if not target_image:
        try:
            from app.services.photo_background import _search_pexels_multiple
            query = random.choice(theme_meta.get("sample_queries", ["funny meme photo"]))
            candidates = _search_pexels_multiple(query)
            if candidates:
                target_image = candidates[0]
        except Exception:
            pass

        if not target_image:
            target_image = random.choice(theme_meta.get("fallback_images", [BUILTIN_MEME_THEMES[0]["fallback_images"][0]]))

    # 3. AI Cognitive Humor Generation
    system_prompt = (
        "You are a master meme creator and social media viral strategist. "
        "Your memes get thousands of shares because they are punchy, hilarious, hyper-relatable, and concise. "
        "Output ONLY a valid JSON object matching the requested schema."
    )

    persona_context = ""
    if persona:
        persona_context = f"""
PERSONA HUMOR DNA & BRAND VOICE:
- Persona Name: {persona.persona_name}
- Target Niche / Audience: {persona.niche}
- Tone Tags: {persona.tone_tags}
- Custom Humor Guidelines: {persona.custom_instructions or 'None'}
- Special Directives: {persona.custom_prompt or 'None'}
"""

    user_prompt = f"""
MEME TOPIC & CONTEXT:
- Theme: {theme_meta.get('name')} ({theme_meta.get('description')})
- User Focus / Topic: {custom_prompt or (persona.niche if persona else 'Create a top-tier viral meme for this theme')}
- Brand Name: {brand_name}
- Format Style: {format_style}
{persona_context}

INSTRUCTIONS:
1. Create a hilarious meme concept:
   - For Modern Card style: `headline_setup` (a witty 1-2 line observation, e.g. "Nobody warned me that 80% of adulthood is just staring at your screen wondering what you forgot to do.")
   - For Classic style: `top_text` (setup in 3-6 words) and `bottom_text` (punchline in 3-6 words)
2. Write a captivating, conversational Facebook post caption:
   - Short, punchy hook.
   - Relatable observation or self-deprecating humor matching the persona tone.
   - Low-friction engagement question (e.g. "Tag someone who does this daily 😂" or "Drop your honest score 1-10 👇").
3. Curate 3-4 trending hashtags.

OUTPUT JSON SCHEMA:
{{
  "headline_setup": "Punchy tweet/card headline joke...",
  "top_text": "WHEN YOU FIX ONE BUG",
  "bottom_text": "AND CREATE TEN NEW ONES",
  "post_caption": "Full Facebook post text with humor and engagement question...",
  "hashtags": ["#TechMemes", "#DeveloperLife", "#Relatable"]
}}
"""

    llm_resp = generate_text_for_user(
        user_id=user_id,
        task_category="post_generation",
        prompt=user_prompt,
        system_prompt=system_prompt,
        temperature=0.85,
        max_tokens=1500,
    )

    data = _clean_json(llm_resp)

    headline_setup = data.get("headline_setup") or "When everything is on fire but you just clocked out:"
    top_text = data.get("top_text") or "ME PRETENDING EVERYTHING IS FINE"
    bottom_text = data.get("bottom_text") or "EVERYTHING IS NOT FINE"
    post_caption = data.get("post_caption") or f"Tell me you relate without telling me you relate... 😂\n\nDrop a comment below! 👇"
    hashtags = data.get("hashtags") or ["#ViralHumor", "#Relatable"]

    # 4. Render Composite Graphic
    if format_style == "classic":
        rendered_b64 = render_classic_meme(
            image_url=target_image,
            top_text=top_text,
            bottom_text=bottom_text,
        )
    else:
        rendered_b64 = render_modern_card_meme(
            image_url=target_image,
            headline_text=headline_setup,
            brand_name=brand_name,
            handle=handle,
            avatar_url=avatar_url,
        )

    total_ms = int((time.perf_counter() - t_start) * 1000)

    return {
        "status": "success",
        "theme": theme_meta.get("name"),
        "format_style": format_style,
        "headline_setup": headline_setup,
        "top_text": top_text,
        "bottom_text": bottom_text,
        "post_caption": post_caption,
        "hashtags": hashtags,
        "source_image_url": target_image,
        "base64_image": rendered_b64,
        "brand_name": brand_name,
        "persona_id": persona.id if persona else None,
        "persona_name": persona.persona_name if persona else None,
        "total_ms": total_ms,
    }
