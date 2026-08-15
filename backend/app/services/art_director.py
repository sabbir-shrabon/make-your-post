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

class CanvasElement(BaseModel):
    """A freeform element positioned on the 1080x1080 canvas."""
    type: str = "text"
    role: str # e.g. "headline", "subheadline", "accent_icon", "background"
    description: Optional[str] = None
    content: Optional[str] = None # For text
    
    # Spatial positioning via template slots
    slot: str
    z_index: int
    
    # Absolute coordinates (used mainly for mutated states from the frontend canvas)
    x: Optional[float] = None
    y: Optional[float] = None
    w: Optional[float] = None
    h: Optional[float] = None
    resolved: Optional[str] = None
    candidates: Optional[list[dict]] = None

    # Styling
    rotation: Optional[int] = 0
    opacity: Optional[float] = 1.0
    
    # Text-specific
    font_size: Optional[int] = None
    color: Optional[str] = None
    font_weight: Optional[str] = "regular"
    text_align: Optional[str] = "left"
    
    # Shape/Badge specific
    shape_id: Optional[str] = None
    badge_text: Optional[str] = None
    badge_icon: Optional[str] = None

class ArtDirectorOutput(BaseModel):
    design_rationale: Optional[str] = None
    mood: str
    template_id: str
    palette_id: str
    font_pair_id: str
    background_color: str
    elements: List[CanvasElement] = Field(default_factory=list)

def run_art_director(
    topic: str,
    brand_palette_id: str = None,
    brand_font_pair_id: str = None,
    user_id: int | None = None,
    db=None,
    mood_hint: str | None = None,
    allow_pexels_bg: bool = False,
    allow_cat_bg: bool = False,
    headline_hint: str | None = None,
    subheadline_hint: str | None = None,
    badge_hint: str | None = None,
    visual_asset_query: str | None = None,
    **kwargs,
) -> ArtDirectorOutput:
    template_options = "\n".join([f"- {t['id']}: Slots: {', '.join(t.get('slots', {}).keys())}" for t in TEMPLATES])
    palette_options = "\n".join([f"- {p['id']} (mood: {', '.join(p.get('mood', []))})" for p in PALETTES])
    font_pair_options = "\n".join([f"- {fp['id']} (mood: {', '.join(fp.get('mood', []))})" for fp in FONT_PAIRS])
    shape_options = "\n".join([f"- {s}" for s in SHAPE_TYPES])

    brand_kit_constraints = []
    if brand_palette_id:
        brand_kit_constraints.append(f"MUST use palette_id '{brand_palette_id}'")
    if brand_font_pair_id:
        brand_kit_constraints.append(f"MUST use font_pair_id '{brand_font_pair_id}'")
    brand_kit_str = ", ".join(brand_kit_constraints) if brand_kit_constraints else "None"

    concept_hints = []
    if headline_hint:
        concept_hints.append(f"RECOMMENDED HEADLINE: \"{headline_hint}\"")
    if subheadline_hint:
        concept_hints.append(f"RECOMMENDED SUBHEADLINE: \"{subheadline_hint}\"")
    if badge_hint:
        concept_hints.append(f"RECOMMENDED BADGE TEXT: \"{badge_hint}\"")
    if visual_asset_query:
        concept_hints.append(f"VISUAL ASSET SEARCH FOCUS: \"{visual_asset_query}\"")
    concept_hints_str = "\n".join(concept_hints) if concept_hints else "None (create your own punchy headline/subheadline)"

    if allow_pexels_bg and allow_cat_bg:
        background_policy = (
            "Photo backgrounds are allowed. If you want a photo background, add a CanvasElement with type='photo' and z_index=0."
            "Write a strong description for the pexels_query; the resolver will try Pexels first and fall back "
            "to Cat API if Pexels has zero usable results."
        )
    elif allow_pexels_bg:
        background_policy = (
            "Photo backgrounds are allowed and will resolve via Pexels. If you want a photo background, add a CanvasElement with type='photo' and z_index=0."
            "You MUST provide a description for the pexels_query."
        )
    elif allow_cat_bg:
        background_policy = (
            "Photo backgrounds are allowed and will resolve via Cat API. If you want a photo background, add a CanvasElement with type='photo' and z_index=0."
            "Write the description as a short visual theme for the cat photo resolver."
        )
    else:
        background_policy = (
            "Photo backgrounds are NOT allowed. Do not add any 'photo' or 'cat_photo' elements. Use 'background_color' and shapes."
        )

    system_prompt = f"""You are a Master Graphic Designer acting as the Art Director for a poster/social-post generation system. You have a full professional toolkit available — your job is to actually USE it thoughtfully for every single request, not default to the safest, plainest option.

You are designing using an explicit slot-based template system for a 1080x1080 canvas.
You must choose a `template_id` and assign EVERY element to a valid `slot` defined by that template.
The orchestrator will automatically calculate the exact X, Y, Width, and Height for each slot.
You must use your freedom to select the best template, typography (font_size), colors, overlapping (z_index), and visual assets to create highly attractive, dynamic designs.

AVAILABLE RESOURCES:

1. BACKGROUND: You must choose a `background_color`.
BACKGROUND SOURCE POLICY FOR THIS REQUEST:
{background_policy}

2. CONTRAST OVERLAY: If you use a photo background, you MUST ensure text is readable. You can do this by adding a semi-transparent `shape` (e.g. opacity 0.5, color #000000) behind the text with an appropriate z_index.

3. TYPOGRAPHY: Add text elements for headlines, subheadlines, quotes, or CTAs. 
   - Define your own `font_size`. Want a massive heading? Set font_size to 150.
   - Set `color`, `font_weight`, and `text_align`.

4. SHAPES/BADGES: ribbons, price bubbles, dividers, corner accents, arrows. These exist because flat text reads as unfinished. Use one when it would strengthen the focal point.

5. ICONS (200,000+ via Iconify) and EMOJI (Twemoji) — use to reinforce the topic visually, not as decoration for its own sake. Provide a description (e.g., "pizza slice") and the resolver will find it.

6. PALETTES, FONT PAIRS — selected by id from the provided lists.

---

IMPORTANT RULES:
1. `template_id` MUST be chosen from AVAILABLE TEMPLATES.
2. `palette_id` MUST be chosen from AVAILABLE PALETTES.
3. `font_pair_id` MUST be chosen from AVAILABLE FONT PAIRS.
4. For each element in `elements`:
   - Set `type` to one of: "text", "icon", "emoji", "cat_photo", "shape", "badge", "photo".
   - Set `slot` to a VALID slot name from your chosen `template_id`.
   - Set `description` to a concise English phrase for visual assets.
   - For `text`, set `content`, `font_size`, and `color`.
5. MUST output ONLY valid JSON matching the schema below.

Now generate the poster JSON for the following topic:

TOPIC: {topic}
MOOD HINT (optional): {mood_hint or "None"}
PERSONA BRAND KIT (if locked): {brand_kit_str}
CAMPAIGN GRAPHIC CONCEPT HINTS:
{concept_hints_str}

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
  "design_rationale": "string",
  "mood": "string",
  "template_id": "string",
  "palette_id": "string",
  "font_pair_id": "string",
  "background_color": "string (hex code)",
  "elements": [
    {{
      "type": "text|icon|emoji|cat_photo|shape|badge|photo",
      "role": "string (e.g. headline, background, accent)",
      "slot": "string (must exist in chosen template)",
      "description": "string (optional)",
      "content": "string (optional, for text)",
      "z_index": 1,
      "rotation": 0, "opacity": 1.0,
      "font_size": 80, "color": "#FFFFFF", "font_weight": "bold", "text_align": "left",
      "shape_id": "string (optional, for shape/badge)",
      "badge_text": "string (optional)",
      "badge_icon": "string (optional)"
    }}
  ]
}}
"""

    user_prompt = f"Create a poster design for this topic: {topic}"
    if headline_hint:
        user_prompt += f" with headline: \"{headline_hint}\""

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
        if "elements" in data and isinstance(data["elements"], list):
            for el in data["elements"]:
                if isinstance(el, dict):
                    el_type = str(el.get("type", "")).lower()
                    if "badge" in el_type:
                        el["type"] = "badge"
                    elif "icon" in el_type:
                        el["type"] = "icon"
                    elif "emoji" in el_type:
                        el["type"] = "emoji"
                    elif "shape" in el_type:
                        el["type"] = "shape"
                    elif any(w in el_type for w in ("photo", "image", "bg", "background")):
                        el["type"] = "photo"
        return ArtDirectorOutput(**data)
    except Exception as e:
        logger.error(f"Failed to parse Art Director output: {e}\nRaw output: {response_text}")
        raise ValueError(f"Art Director output validation failed: {e}")

def run_art_director_mutation(
    mutation_prompt: str,
    current_state: dict,
    user_id: int | None = None,
    db=None,
    **kwargs,
) -> ArtDirectorOutput:
    system_prompt = f"""You are a Master Graphic Designer.
You have been provided with an EXISTING POSTER JSON state. The user wants to make a change to this poster.
Your job is to MUTATE the JSON to fulfill the user's request.

IMPORTANT RULES:
1. DO NOT change things the user didn't ask you to change (e.g. if they say "make title bigger", DO NOT change the background photo or template).
2. ONLY output valid JSON matching the exact same schema.
3. Keep the `resolved` fields and exact `x, y, w, h` coordinates for elements you are not actively modifying.
"""
    
    user_prompt = f"""CURRENT POSTER STATE:
```json
{json.dumps(current_state, indent=2)}
```

USER REQUEST: {mutation_prompt}

Please provide the updated JSON for the poster.
"""

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
            temperature=0.3, # lower temp for mutations
            max_tokens=1500,
        )
    else:
        response_text = generate_text_for_user(
            user_id=user_id,
            task_category="post_generation",
            prompt=user_prompt,
            system_prompt=system_prompt,
            temperature=0.3,
            max_tokens=1500,
            db=db,
        )

    if not response_text:
        raise RuntimeError("Art Director returned empty response for mutation")

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
        logger.error(f"Failed to parse Art Director mutation output: {e}\nRaw output: {response_text}")
        raise ValueError(f"Art Director mutation output validation failed: {e}")

def run_art_director_layer_regen(
    target_element: dict,
    topic: str,
    mood: str | None = None,
    prompt_hint: str | None = None,
    user_id: int | None = None,
    db=None,
    **kwargs,
) -> dict:
    """
    Regenerates only the content, description, or styling of a single element based on topic & context.
    """
    elem_type = target_element.get("type", "text")
    elem_role = target_element.get("role", "headline")
    current_content = target_element.get("content") or target_element.get("description") or ""

    system_prompt = f"""You are a Master Graphic Designer.
You are tasked with regenerating ONLY a SINGLE layer of a social poster design.
Layer type: {elem_type}
Layer role: {elem_role}
Current content/description: {current_content}
Poster Topic: {topic}
Optional user direction: {prompt_hint or 'Generate a fresh, creative alternative'}

Return ONLY a JSON object with the regenerated properties for this element:
For text elements:
{{
  "content": "Fresh punchy copy here",
  "font_size": 48,
  "color": "#HEX",
  "font_weight": "bold"
}}
For icon/photo elements:
{{
  "description": "Visual keyword description for resolver",
  "opacity": 1.0
}}
For shape/badge elements:
{{
  "badge_text": "Badge text",
  "color": "#HEX"
}}
"""
    user_prompt = f"Regenerate a creative alternative for this {elem_role} ({elem_type}) layer for the topic: '{topic}'."

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
            temperature=0.85,
            max_tokens=300,
        )
    else:
        response_text = generate_text_for_user(
            user_id=user_id,
            task_category="post_generation",
            prompt=user_prompt,
            system_prompt=system_prompt,
            temperature=0.85,
            max_tokens=300,
            db=db,
        )

    if not response_text:
        return {}

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
        return json.loads(cleaned)
    except Exception as e:
        logger.warning(f"Failed to parse layer regen output: {e}")
        return {}

