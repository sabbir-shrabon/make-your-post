"""
campaign_generator.py
---------------------
Unified Campaign & Post Generation Engine.

Orchestrates a single cognitive pass that generates:
1. Optimized Facebook Post Copy (Hook, Value Body, CTA).
2. Curated Hashtags.
3. Matching Semantic Graphic Concept (Headline, Subheadline, Badge, Visual Query, Mood).
4. Direct rendering of multi-variant graphic posters via poster_orchestrator.
"""

from __future__ import annotations

import json
import logging
import time
from datetime import datetime, timedelta, timezone
from typing import Optional, Any
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app import models
from app.providers.llm_providers import generate_text_for_user
from app.services.poster_orchestrator import generatePoster
from app.services.poster_component_renderer import render_archetype_poster
from app.services.photo_background import _search_pexels_multiple

logger = logging.getLogger(__name__)


class GraphicConcept(BaseModel):
    archetype_id: str = Field("social-card", description="One of: social-card, editorial-hero, metric-callout, checklist-framework, promo-banner, minimal-quote")
    headline: str = Field(..., description="Punchy 2-5 word visual hook for the poster")
    subheadline: Optional[str] = Field(None, description="Supporting subtitle or takeaway")
    badge_text: Optional[str] = Field("PRO TIP", description="Short badge label like PRO TIP or GUIDE")
    stat_number: Optional[str] = Field(None, description="Oversized stat for metric-callout, e.g. +4.5X or 85%")
    items: Optional[list[str]] = Field(default_factory=list, description="3-4 step items for checklist-framework")
    cta_text: Optional[str] = Field(None, description="CTA button text for promo-banner or editorial-hero")
    suggested_mood: Optional[str] = Field(None, description="Aesthetic mood descriptor")
    visual_asset_query: Optional[str] = Field(None, description="Search query for background photo")
    image_candidates: list[str] = Field(default_factory=list, description="List of 3-4 Pexels photo candidates for live swapping")


class UnifiedCampaignData(BaseModel):
    campaign_theme: str
    post_content: str
    hashtags: list[str] = Field(default_factory=list)
    graphic_concept: GraphicConcept
    poster_winner: dict
    poster_variants: list[dict] = Field(default_factory=list)
    page_name: Optional[str] = None
    page_picture_url: Optional[str] = None
    persona_name: Optional[str] = None
    brand_palette_id: Optional[str] = None
    brand_font_pair_id: Optional[str] = None
    total_ms: int = 0


def _clean_llm_json(raw_text: str) -> dict:
    cleaned = raw_text.strip()
    if "```" in cleaned:
        start = cleaned.find("```json")
        if start != -1:
            start += 7
        else:
            start = cleaned.find("```") + 3
        end = cleaned.rfind("```")
        cleaned = cleaned[start:end].strip()

    try:
        return json.loads(cleaned)
    except Exception as exc:
        logger.warning(f"Failed direct json parse, attempting heuristic extract: {exc}")
        first_brace = cleaned.find("{")
        last_brace = cleaned.rfind("}")
        if first_brace != -1 and last_brace != -1:
            return json.loads(cleaned[first_brace : last_brace + 1])
        raise


async def generate_unified_campaign(
    db: Session,
    user_id: int,
    topic_or_niche: str,
    page_connection_id: Optional[int] = None,
    persona_id: Optional[int] = None,
    candidate_count: int = 3,
    allow_pexels_bg: bool = True,
    allow_cat_bg: bool = False,
    aspect_ratio: str = "1:1",
) -> dict:
    """
    Executes a single unified pass generating both the post copy and matched Canva-grade graphic poster.
    """
    t_start = time.perf_counter()

    # 1. Resolve Page & Persona Context
    page = None
    persona = None
    brand_profile = None

    if persona_id:
        persona = db.query(models.AIPersona).filter(models.AIPersona.id == persona_id).first()
        if persona and not page_connection_id:
            page_connection_id = persona.page_connection_id

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

    # Context values
    page_name = page.page_name if page else "My Brand"
    page_picture_url = page.page_picture_url if page else None
    handle = "@" + page_name.lower().replace(" ", "")
    persona_name = persona.persona_name if persona else "Default Creator"
    niche = (persona.niche if persona and persona.niche else topic_or_niche).strip()
    tone = (persona.tone_tags if persona and persona.tone_tags else "Engaging, Authoritative, Value-Packed").strip()
    custom_instructions = persona.custom_instructions if persona and persona.custom_instructions else ""
    brand_palette_id = persona.brand_palette_id if persona and persona.brand_palette_id else "midnight-mint"
    brand_font_pair_id = persona.brand_font_pair_id if persona and persona.brand_font_pair_id else "bebas-neue-inter"

    # 2. Build the Unified Campaign Cognitive Prompt
    system_prompt = f"""You are an elite Social Media Strategist and Canva-Grade Visual Director.
Your task is to craft a cohesive, high-converting Facebook post campaign for a brand.

A great social post consists of TWO perfectly synchronized assets:
1. POST COPY: An attention-grabbing hook, digestible valuable content (bullets or concise story), a clear engagement CTA (asking an engaging question or invitation to comment), and 3-5 relevant hashtags.
2. MATCHING CANVA-GRADE GRAPHIC POSTER CONCEPT:
   Select the best design ARCHETYPE for this topic:
   - `social-card`: For punchy observations, memes, viral insights, or advice.
   - `editorial-hero`: For thought leadership, deep dives, big announcements, or industry trends.
   - `metric-callout`: For statistics, case studies, growth milestones, or data insights.
   - `checklist-framework`: For step-by-step how-tos, cheatsheets, or frameworks (include 3-4 concise items).
   - `promo-banner`: For special offers, sales, product launches, or webinars.
   - `minimal-quote`: For inspirational quotes, mindset shifts, or founder philosophy.

BRAND PROFILE:
- Brand/Page Name: {page_name}
- Niche / Core Topic: {niche}
- Tone of Voice: {tone}
{f'- Custom Brand Guidelines: {custom_instructions}' if custom_instructions else ''}

OUTPUT FORMAT:
You MUST output ONLY a valid JSON object matching this exact structure:
{{
  "campaign_theme": "Brief 3-6 word theme or angle",
  "post_content": "The full Facebook post copy with hook, value points, CTA and emojis",
  "hashtags": ["#Tag1", "#Tag2", "#Tag3"],
  "graphic_concept": {{
    "archetype_id": "social-card",
    "headline": "2-5 WORD PUNCHY HEADLINE",
    "subheadline": "Supporting subtitle or statistic",
    "badge_text": "PRO TIP",
    "stat_number": "+4.5X",
    "items": ["1. First Action Step", "2. Second Action Step", "3. Third Action Step"],
    "cta_text": "READ GUIDE →",
    "suggested_mood": "modern-minimal",
    "visual_asset_query": "relevant photo search query keywords"
  }}
}}
"""

    user_prompt = f"Create a complete Facebook post campaign for this topic/request: {topic_or_niche}"

    logger.info("Generating unified campaign text & graphic concept for user %d...", user_id)
    raw_llm_response = generate_text_for_user(
        user_id=user_id,
        task_category="post_generation",
        prompt=user_prompt,
        system_prompt=system_prompt,
        temperature=0.7,
        max_tokens=1400,
        db=db,
    )

    if not raw_llm_response:
        raise RuntimeError("Failed to generate campaign content from AI model.")

    campaign_json = _clean_llm_json(raw_llm_response)
    campaign_theme = campaign_json.get("campaign_theme", topic_or_niche)
    post_content = campaign_json.get("post_content", "").strip()
    hashtags = campaign_json.get("hashtags", [])
    if isinstance(hashtags, str):
        hashtags = [t.strip() for t in hashtags.split() if t.startswith("#")]

    concept_dict = campaign_json.get("graphic_concept", {})
    archetype_id = concept_dict.get("archetype_id", "social-card")
    headline = concept_dict.get("headline", campaign_theme.upper()[:35])
    subheadline = concept_dict.get("subheadline")
    badge_text = concept_dict.get("badge_text", "PRO TIP")
    stat_number = concept_dict.get("stat_number", "+4.5X")
    items = concept_dict.get("items", [])
    cta_text = concept_dict.get("cta_text", "LEARN MORE →")
    visual_query = concept_dict.get("visual_asset_query", niche)

    # 3. Resolve background photo candidates from Pexels
    photo_candidates = []
    if allow_pexels_bg and visual_query:
        try:
            photo_candidates = _search_pexels_multiple(visual_query)
        except Exception as e:
            logger.warning(f"Pexels search failed for query '{visual_query}': {e}")

    primary_image_url = photo_candidates[0] if photo_candidates else (
        "https://images.pexels.com/photos/3183150/pexels-photo-3183150.jpeg?auto=compress&cs=tinysrgb&w=800"
    )

    graphic_concept = GraphicConcept(
        archetype_id=archetype_id,
        headline=headline,
        subheadline=subheadline,
        badge_text=badge_text,
        stat_number=stat_number,
        items=items,
        cta_text=cta_text,
        suggested_mood=concept_dict.get("suggested_mood"),
        visual_asset_query=visual_query,
        image_candidates=photo_candidates[:4],
    )

    # 4. Instant Render Primary Winner Poster
    b64_primary, _ = render_archetype_poster(
        archetype_id=archetype_id,
        headline=headline,
        subheadline=subheadline,
        image_url=primary_image_url,
        brand_name=page_name,
        handle=handle,
        avatar_url=page_picture_url,
        badge_text=badge_text,
        stat_number=stat_number,
        items=items,
        cta_text=cta_text,
        palette_id=brand_palette_id,
        font_pair_id=brand_font_pair_id,
    )

    winner = {
        "archetype_id": archetype_id,
        "base64_image": b64_primary,
        "image_url": primary_image_url,
        "headline": headline,
        "subheadline": subheadline,
        "badge_text": badge_text,
        "stat_number": stat_number,
        "items": items,
        "cta_text": cta_text,
    }

    # 5. Generate 2 Instant Alternate Variants
    alternate_archetypes = [a for a in ["social-card", "editorial-hero", "checklist-framework", "metric-callout"] if a != archetype_id][:2]
    variants = [winner]

    for alt_arch in alternate_archetypes:
        alt_img_url = photo_candidates[1] if len(photo_candidates) > 1 else primary_image_url
        try:
            b64_alt, _ = render_archetype_poster(
                archetype_id=alt_arch,
                headline=headline,
                subheadline=subheadline,
                image_url=alt_img_url,
                brand_name=page_name,
                handle=handle,
                avatar_url=page_picture_url,
                badge_text=badge_text,
                stat_number=stat_number,
                items=items,
                cta_text=cta_text,
                palette_id=brand_palette_id,
                font_pair_id=brand_font_pair_id,
            )
            variants.append({
                "archetype_id": alt_arch,
                "base64_image": b64_alt,
                "image_url": alt_img_url,
                "headline": headline,
                "subheadline": subheadline,
                "badge_text": badge_text,
                "stat_number": stat_number,
                "items": items,
                "cta_text": cta_text,
            })
        except Exception as e:
            logger.warning(f"Failed rendering alternate archetype {alt_arch}: {e}")

    total_ms = int((time.perf_counter() - t_start) * 1000)

    return {
        "campaign_theme": campaign_theme,
        "post_content": post_content,
        "hashtags": hashtags,
        "graphic_concept": graphic_concept.model_dump(),
        "poster_winner": winner,
        "poster_variants": variants,
        "page_name": page_name,
        "page_picture_url": page_picture_url,
        "persona_name": persona_name,
        "brand_palette_id": brand_palette_id,
        "brand_font_pair_id": brand_font_pair_id,
        "aspect_ratio": aspect_ratio,
        "image_candidates": photo_candidates[:4],
        "total_ms": total_ms,
    }


DEFAULT_NICHE_THEMES = [
    {"pillar": "Case Study & Real Transformation", "badge": "CASE STUDY", "angle": "Actionable breakdown from a real transformation or founder experience."},
    {"pillar": "Tactical How-To & Step-by-Step Guide", "badge": "PRO TIP", "angle": "Step-by-step practical guide that solves a specific pain point."},
    {"pillar": "Contrarian Take & Mindset Shift", "badge": "MINDSET", "angle": "Thought-provoking observation challenging conventional wisdom."},
    {"pillar": "Top Mistakes & Mythbuster", "badge": "MYTH BUSTER", "angle": "Top mistakes to avoid in this niche and what to do instead."},
    {"pillar": "Actionable Framework & Checklist", "badge": "CHECKLIST", "angle": "High-utility summary checklist or framework to implement today."},
    {"pillar": "Community Debate & Discussion Question", "badge": "COMMUNITY", "angle": "Engaging question to spur active comments and opinions."},
    {"pillar": "Weekly Roadmap & Growth Strategy", "badge": "ROADMAP", "angle": "Preparation tips and resource roundup for the coming week."},
]


async def generate_batch_campaign(
    db: Session,
    user_id: int,
    page_connection_id: Optional[int] = None,
    persona_id: Optional[int] = None,
    days_count: int = 7,
    start_date: Optional[str] = None,
    custom_focus: Optional[str] = None,
    include_posters: bool = True,
    allow_pexels_bg: bool = True,
) -> dict:
    """
    Generate a full multi-day batch campaign (3-14 days) mapped to daily engagement themes.
    """
    t_start = time.perf_counter()
    days_count = max(1, min(days_count, 14))

    # Resolve Page & Persona
    page = None
    persona = None
    if persona_id:
        persona = db.query(models.AIPersona).filter(models.AIPersona.id == persona_id).first()
        if persona and not page_connection_id:
            page_connection_id = persona.page_connection_id

    if page_connection_id:
        page = db.query(models.FacebookConnection).filter(
            models.FacebookConnection.id == page_connection_id,
            models.FacebookConnection.user_id == user_id,
        ).first()

    if not persona and page_connection_id:
        persona = db.query(models.AIPersona).filter(models.AIPersona.page_connection_id == page_connection_id).first()

    brand_profile = db.query(models.BrandProfile).filter(models.BrandProfile.user_id == user_id).first()

    niche = custom_focus or (persona.niche if persona else None) or (brand_profile.brand_json.get("niche_description") if brand_profile and brand_profile.brand_json else None) or "General Growth & Business"
    tone = (persona.tone_tags if persona and persona.tone_tags else None) or (brand_profile.tone if brand_profile else "Authoritative, Inspiring, High-Converting")
    if isinstance(tone, list):
        tone = ", ".join(tone)

    page_name = page.page_name if page else (brand_profile.brand_name if brand_profile else "My Brand")
    page_picture_url = page.page_picture_url if page else (brand_profile.logo_url if brand_profile else None)

    # Start date calculation
    base_dt = datetime.now(timezone.utc)
    if start_date:
        try:
            base_dt = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
        except Exception:
            pass

    # Build prompt for LLM
    themes_slice = [DEFAULT_NICHE_THEMES[i % len(DEFAULT_NICHE_THEMES)] for i in range(days_count)]

    system_prompt = (
        "You are an elite Social Media Strategist and Creative Director. "
        "Your mission is to generate a high-converting multi-day Facebook content campaign.\n"
        "Return ONLY a valid, parseable JSON object without markdown fences or extraneous text."
    )

    user_prompt = f"""
PAGE CONTEXT:
- Brand Name: {page_name}
- Page Niche: {niche}
- Brand Tone of Voice: {tone}
- Number of Days: {days_count}

DAILY THEME SCHEDULE:
{json.dumps(themes_slice, indent=2)}

INSTRUCTIONS:
1. For each day, create a complete, high-engagement Facebook post with hook, body bullet points, and CTA.
2. For each day, provide 3-5 curated hashtags.
3. For each day, define a matching graphic concept for an accompanying poster:
   - headline: 2-5 words punchy, high-impact uppercase text
   - subheadline: 1 brief sentence
   - badge_text: 1-2 words badge (e.g. PRO TIP, GUIDE, MISTAKE, CHECKLIST)
   - visual_asset_query: 2-4 words search query for stock photo (e.g. 'founder working late', 'minimal desk setup')
   - suggested_mood: 1-2 mood words (e.g. 'bold modern tech', 'clean minimalist')

OUTPUT JSON SCHEMA:
{{
  "campaign_name": "{days_count}-Day {niche} Campaign",
  "days": [
    {{
      "day_index": 1,
      "theme_pillar": "Case Study & Real Transformation",
      "post_content": "Full Facebook post text with hook and formatting...",
      "hashtags": ["#Tag1", "#Tag2", "#Tag3"],
      "graphic_concept": {{
        "headline": "PUNCHY VISUAL HEADLINE",
        "subheadline": "Brief explanatory subtitle.",
        "badge_text": "CASE STUDY",
        "visual_asset_query": "relevant photo query",
        "suggested_mood": "modern bold"
      }}
    }}
  ]
}}
"""

    llm_resp = generate_text_for_user(
        user_id=user_id,
        task_category="post_generation",
        prompt=user_prompt,
        system_prompt=system_prompt,
        temperature=0.75,
        max_tokens=3500,
    )

    data = _clean_llm_json(llm_resp)
    raw_days = data.get("days", [])

    processed_days = []
    for i, day_info in enumerate(raw_days):
        day_index = i + 1
        scheduled_time = (base_dt + timedelta(days=i)).replace(hour=9, minute=0, second=0, microsecond=0)
        
        g_data = day_info.get("graphic_concept", {})
        graphic_concept = GraphicConcept(
            headline=g_data.get("headline") or f"DAY {day_index} INSIGHT",
            subheadline=g_data.get("subheadline"),
            badge_text=g_data.get("badge_text") or "INSIGHT",
            visual_asset_query=g_data.get("visual_asset_query") or niche,
            suggested_mood=g_data.get("suggested_mood") or "modern",
        )

        poster_winner = None
        if include_posters:
            try:
                p_res = await generatePoster(
                    topic=f"{niche} - {graphic_concept.headline}",
                    persona_id=persona.id if persona else None,
                    db=db,
                    user_id=user_id,
                    candidate_count=1,
                    allow_pexels_bg=allow_pexels_bg,
                    headline_hint=graphic_concept.headline,
                    subheadline_hint=graphic_concept.subheadline,
                    badge_hint=graphic_concept.badge_text,
                    visual_asset_query=graphic_concept.visual_asset_query,
                    mood_hint=graphic_concept.suggested_mood,
                )
                if p_res.get("base64_image"):
                    poster_winner = {
                        "base64_image": p_res.get("base64_image"),
                        "template_id": p_res.get("art_director", {}).get("template_id"),
                        "score": p_res.get("composite_score", 0.8),
                    }
            except Exception as e:
                logger.warning("Failed to render batch poster for day %d: %s", day_index, e)

        day_label = scheduled_time.strftime("%A, %b %d")
        processed_days.append({
            "day_index": day_index,
            "day_label": day_label,
            "theme": day_info.get("theme_pillar", f"Day {day_index} Pillar"),
            "scheduled_at": scheduled_time.isoformat(),
            "post_content": day_info.get("post_content", ""),
            "hashtags": day_info.get("hashtags", []),
            "graphic_concept": graphic_concept.model_dump(),
            "poster": poster_winner,
        })

    total_ms = int((time.perf_counter() - t_start) * 1000)

    return {
        "campaign_name": data.get("campaign_name", f"{days_count}-Day Campaign"),
        "niche": niche,
        "start_date": base_dt.isoformat(),
        "days_count": len(processed_days),
        "page_name": page_name,
        "page_picture_url": page_picture_url,
        "days": processed_days,
        "total_ms": total_ms,
    }


def schedule_batch_campaign(
    db: Session,
    user_id: int,
    page_connection_id: int,
    persona_id: Optional[int],
    posts_data: list[dict],
) -> list[dict]:
    """
    Persist approved batch campaign posts into the database scheduler.
    """
    saved_posts = []
    for item in posts_data:
        media_urls = []
        if item.get("poster") and item["poster"].get("base64_image"):
            media_urls = [item["poster"]["base64_image"]]
        elif item.get("media_urls"):
            media_urls = item["media_urls"]

        sched_str = item.get("scheduled_at")
        sched_dt = datetime.now(timezone.utc)
        if sched_str:
            try:
                sched_dt = datetime.fromisoformat(sched_str.replace("Z", "+00:00"))
            except Exception:
                pass

        post = models.Post(
            user_id=user_id,
            page_connection_id=page_connection_id,
            content=item.get("post_content") or item.get("content", ""),
            scheduled_at=sched_dt,
            status="scheduled",
            auto_generated=True,
            ai_generated=True,
            media_urls=media_urls,
            persona_name=item.get("persona_name"),
        )
        db.add(post)
        saved_posts.append(post)

    db.commit()
    return [{"id": p.id, "scheduled_at": str(p.scheduled_at), "status": p.status} for p in saved_posts]
