import json
import logging
import os
import random
from pydantic import BaseModel, Field
from typing import Literal, Optional, List
from app.providers.llm_providers import generate_text, generate_text_for_user
from app.design_system_data import SHAPE_TYPES

logger = logging.getLogger(__name__)

# Load design system resources to build the prompt dynamically
RESOURCES_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "design-system")

def load_json_resource(filename: str) -> list:
    try:
        with open(os.path.join(RESOURCES_DIR, filename), "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Failed to load {filename}: {e}")
        return []

TEMPLATES = load_json_resource("templates.json")
PALETTES = load_json_resource("palettes.json")
FONT_PAIRS = load_json_resource("font-pairs.json") or load_json_resource("font_pairs.json")

def get_template_ids() -> list[str]:
    return [t["id"] for t in TEMPLATES]

def get_palette_ids() -> list[str]:
    return [p["id"] for p in PALETTES]

def get_font_pair_ids() -> list[str]:
    return [fp["id"] for fp in FONT_PAIRS]

class BackgroundChoice(BaseModel):
    type: Literal["photo", "solid", "gradient"]
    pexels_query: Optional[str] = None
    fallback_type: Literal["solid", "gradient"] = "solid"

class ElementItem(BaseModel):
    """A decorative element slot in the poster.

    IMPORTANT: The Art Director must NEVER put a specific asset ID here.
    It outputs a free-text `description` of what it wants — the Resource
    Resolver translates that description to a real asset at render time.
    """
    type: Literal["icon", "emoji", "cat_photo", "shape", "badge"]
    description: str  # e.g. "pizza slice", "fire", "cat wearing sunglasses"
    slot: str         # e.g. "accent_icon", "decorative_top_right"
    shape_id: Optional[str] = None  # only set when type == "shape" or "badge"
    badge_text: Optional[str] = None  # e.g. "50% OFF"
    badge_icon: Optional[str] = None  # e.g. "pizza slice"

class TextLogo(BaseModel):
    content: str
    style_hint: Optional[str] = None

class DetailsBlock(BaseModel):
    date_time: Optional[str] = None
    location: Optional[str] = None
    featuring: List[str] = Field(default_factory=list)

class ArtDirectorOutput(BaseModel):
    design_rationale: Optional[str] = None
    headline: str
    subheadline: str
    mood: str
    template_id: str
    palette_id: str
    font_pair_id: str
    background_choice: BackgroundChoice
    use_contrast_overlay: bool
    elements: List[ElementItem] = Field(default_factory=list)
    text_logo: Optional[TextLogo] = None
    details_block: Optional[DetailsBlock] = None
    cta_text: Optional[str] = None

def run_art_director(
    topic: str,
    brand_palette_id: str = None,
    brand_font_pair_id: str = None,
    user_id: int | None = None,
    db=None,
    mood_hint: str | None = None,
    **kwargs,
) -> ArtDirectorOutput:
    template_options = "\n".join([f"- {t['id']} (slots: {', '.join(t.get('slots', {}).keys())}) (best for: {', '.join(t.get('best_for', []))})" for t in TEMPLATES])
    palette_options = "\n".join([f"- {p['id']} (mood: {', '.join(p.get('mood', []))})" for p in PALETTES])
    font_pair_options = "\n".join([f"- {fp['id']} (mood: {', '.join(fp.get('mood', []))})" for fp in FONT_PAIRS])
    shape_options = "\n".join([f"- {s}" for s in SHAPE_TYPES])

    example_template_1 = random.choice(TEMPLATES)["id"] if TEMPLATES else "default_template"
    example_palette_1 = random.choice(PALETTES)["id"] if PALETTES else "default_palette"
    example_font_1 = random.choice(FONT_PAIRS)["id"] if FONT_PAIRS else "default_font"

    example_template_2 = random.choice(TEMPLATES)["id"] if TEMPLATES else "default_template"
    example_palette_2 = random.choice(PALETTES)["id"] if PALETTES else "default_palette"
    example_font_2 = random.choice(FONT_PAIRS)["id"] if FONT_PAIRS else "default_font"

    brand_kit_constraints = []
    if brand_palette_id:
        brand_kit_constraints.append(f"MUST use palette_id '{brand_palette_id}'")
    if brand_font_pair_id:
        brand_kit_constraints.append(f"MUST use font_pair_id '{brand_font_pair_id}'")
    brand_kit_str = ", ".join(brand_kit_constraints) if brand_kit_constraints else "None"

    system_prompt = f"""You are a Master Graphic Designer acting as the Art Director for a poster/social-post generation system. You have a full professional toolkit available — your job is to actually USE it thoughtfully for every single request, not default to the safest, plainest option.

AVAILABLE RESOURCES (you must actively choose from ALL of these categories every time, not just text + one background):

1. BACKGROUND — choose exactly one:
   - solid: a single flat color
   - gradient: two colors + angle, from the palette library
   - photo: a real photograph fetched from Pexels via a search query you write, OR a themed cat photo via the Cat API (only for humorous/meme/casual topics)

2. CONTRAST OVERLAY — if background is a photo, decide whether a dark gradient/solid overlay is needed for legibility, and how strong.

3. TYPOGRAPHY — headline, subheadline, and text logo are THREE SEPARATE elements. Each one gets its own deliberate size, color, and role. They should almost never all look the same size and color — that's a sign you're not using the hierarchy tools you have.

4. SHAPES/BADGES — ribbons, price bubbles, dividers, corner accents, arrows. These exist because flat text-on-background reads as unfinished. Use one when it would strengthen the focal point.

5. DETAILS BLOCK & CTA — populate `details_block` (date_time, location, featuring list) if the topic implies an event, show, or specific gathering. Provide a `cta_text` (Call To Action, e.g., "GET TICKETS NOW", "SWIPE TO SHOP") when there is a clear next step for the viewer.

6. ICONS (200,000+ via Iconify) and EMOJI (Twemoji) — use to reinforce the topic visually, not as decoration for its own sake.

7. CAT API — a real cat photo, for humorous/meme/casual posts only. Never force this into a serious, corporate, or somber topic.

8. TEMPLATES, PALETTES, FONT PAIRS — selected by id from the provided lists.

---

BEFORE YOU FINALIZE YOUR JSON, work through this checklist explicitly in a "design_rationale" field (2-4 short sentences, this is logged internally, not shown to the end user, but you must actually reason through it, not skip it):

1. Does the background choice match this specific topic's mood, or did I just default to a flat color out of habit? For anything food/lifestyle/product/travel/event-related, a real photo background is very often the stronger choice — actively consider it before ruling it out.
2. Do the headline, subheadline, and text logo have DELIBERATELY DIFFERENT sizes and colors that reflect their importance — not all white, not all the same size?
3. Is there at least one non-text visual element (icon, emoji, shape, or photo subject) that reinforces the topic — unless the mood is genuinely "minimal," in which case say so explicitly rather than by omission.
4. Does the palette's accent color actually appear somewhere visible (a shape, an icon tint, the subheadline) — or is the poster effectively monochrome despite having an accent color available?
5. If this is a promotional/sale/urgent topic, is there a shape or badge creating a focal point (a ribbon, a price bubble) — flat text alone under-sells urgency.

If your answer to any of these is "I didn't really consider it," go back and reconsider before outputting. A poster that uses only text and a flat background is a FAILURE STATE unless the topic is explicitly minimal/elegant and you've said so in design_rationale.

---

GOOD vs BAD EXAMPLES (calibrate against these):

BAD — topic: "Weekend Pizza Deal":
{{
  "background_choice": {{ "type": "solid" }},
  "headline": "Weekend Pizza Deal",
  "subheadline": "50% off all large pizzas",
  "elements": []
}}
Why this fails: flat background for a food topic that would benefit hugely from a real photo; headline and subheadline visually identical in importance; zero supporting elements despite having icons/shapes/photos available; nothing reinforces "pizza" or urgency.

GOOD — same topic:
{{
  "design_rationale": "Food topic benefits from a real photo background over flat color. Used the palette's accent yellow on the subheadline and a corner ribbon to create urgency for a weekend deal, plus a pizza icon reinforcing the topic directly.",
  "headline": "Weekend Pizza Deal",
  "subheadline": "50% OFF ALL LARGE PIZZAS",
  "mood": "energetic",
  "template_id": "{example_template_1}",
  "palette_id": "{example_palette_1}",
  "font_pair_id": "{example_font_1}",
  "background_choice": {{ "type": "photo", "pexels_query": "pizza on dark wood table, top down", "fallback_type": "gradient" }},
  "use_contrast_overlay": true,
  "elements": [
    {{ "type": "badge", "description": "discount badge", "slot": "corner_badge", "shape_id": "RibbonBanner", "badge_text": "50% OFF" }},
    {{ "type": "icon", "description": "pizza slice", "slot": "accent_icon" }}
  ]
}}

BAD — topic: "Monday Motivation Quote":
{{
  "background_choice": {{ "type": "photo", "pexels_query": "cat sitting on desk" }},
  "elements": [ {{ "type": "cat_photo", "description": "cat", "slot": "main" }} ]
}}
Why this fails: forcing a cat photo onto a serious/inspirational topic just because the Cat API exists. Resource usage must fit the topic's actual mood, not be used indiscriminately.

GOOD — same topic:
{{
  "design_rationale": "Motivational quote calls for a clean, minimal composition — a photo or extra elements would compete with the text rather than support it. Using palette's gradient and reserving contrast/size difference between headline and subheadline for hierarchy instead of added elements.",
  "headline": "PURSUE EXCELLENCE",
  "subheadline": "Success is not final, failure is not fatal.",
  "mood": "inspirational",
  "template_id": "{example_template_2}",
  "palette_id": "{example_palette_2}",
  "font_pair_id": "{example_font_2}",
  "background_choice": {{ "type": "gradient", "fallback_type": "gradient" }},
  "use_contrast_overlay": false,
  "elements": []
}}
Note: this is still a GOOD example specifically because it explicitly justifies minimalism rather than defaulting to it silently.
(Note: the template_id, palette_id, and font_pair_id in these examples are illustrative valid IDs picked from your available lists below)

---

IMPORTANT RULES:
1. `template_id` MUST be chosen from AVAILABLE TEMPLATES.
2. `palette_id` MUST be chosen from AVAILABLE PALETTES.
3. `font_pair_id` MUST be chosen from AVAILABLE FONT PAIRS.
4. For each element in `elements`:
   - Set `type` to one of: "icon", "emoji", "cat_photo", "shape", "badge".
   - Set `description` to a concise English phrase (e.g. "pizza slice", "party popper emoji", "smiling cat wearing a birthday hat").
   - Set `slot` to EXACTLY one of the slots defined in the chosen template's slots list. Do not invent slot names.
   - For `shape` or `badge` type, set `shape_id` to one of the AVAILABLE SHAPES.
   - For `badge` type, you MUST also provide either `badge_text` (e.g. "50% OFF") or `badge_icon` (e.g. "pizza slice").
   - NEVER put a specific Iconify ID, emoji codepoint, or URL in `description`. The Resource Resolver will translate descriptions.
5. MUST output ONLY valid JSON matching the schema below.

Now generate the poster JSON for the following topic:

TOPIC: {topic}
MOOD HINT (optional): {mood_hint or "None"}
PERSONA BRAND KIT (if locked): {brand_kit_str}

AVAILABLE TEMPLATES:
{template_options}

AVAILABLE PALETTES:
{palette_options}

AVAILABLE FONT PAIRS:
{font_pair_options}

AVAILABLE SHAPES:
{shape_options}

OUTPUT SCHEMA:
{{
  "design_rationale": "string (2-4 short sentences working through the checklist)",
  "headline": "string",
  "subheadline": "string",
  "mood": "string",
  "template_id": "string",
  "palette_id": "string",
  "font_pair_id": "string",
  "background_choice": {{
    "type": "photo|solid|gradient",
    "pexels_query": "string (optional, query for real photo if type is photo)",
    "fallback_type": "solid|gradient"
  }},
  "use_contrast_overlay": true|false,
  "elements": [
    {{
      "type": "icon|emoji|cat_photo|shape|badge",
      "description": "string",
      "slot": "string",
      "shape_id": "string (optional, only set if type=shape or badge)",
      "badge_text": "string (optional, only for badge)",
      "badge_icon": "string (optional, only for badge)"
    }}
  ],
  "text_logo": {{ "content": "string", "style_hint": "string (optional)" }},
  "details_block": {{
    "date_time": "string (optional)",
    "location": "string (optional)",
    "featuring": ["string", "string"]
  }},
  "cta_text": "string (optional)"
}}
"""

    user_prompt = f"Create a poster design for this topic: {topic}"

    model = kwargs.get("model")
    provider = kwargs.get("provider")
    api_key = kwargs.get("api_key", "")

    if provider and model:
        response_text = generate_text(
            prompt=user_prompt,
            system_prompt=system_prompt,
            model_name=model,
            provider_name=provider,
            api_key=api_key,
            temperature=0.7,
            max_tokens=1000,
        )
    else:
        response_text = generate_text_for_user(
            user_id=user_id,
            task_category="post_generation",
            prompt=user_prompt,
            system_prompt=system_prompt,
            temperature=0.7,
            max_tokens=1000,
            db=db,
        )

    if not response_text:
        raise RuntimeError("Art Director returned empty response")

    # Clean JSON
    cleaned = response_text.strip()
    if "```" in cleaned:
        start = cleaned.find("```json")
        if start != -1:
            start += 7
        else:
            start = cleaned.find("```") + 3
        end = cleaned.rfind("```")
        cleaned = cleaned[start:end].strip()

    try:
        data = json.loads(cleaned)
        return ArtDirectorOutput(**data)
    except Exception as e:
        logger.error(f"Failed to parse Art Director output: {e}\nRaw output: {response_text}")
        raise ValueError(f"Art Director output validation failed: {e}")
