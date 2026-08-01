import json
import logging
from pydantic import BaseModel, Field
from typing import Literal, Optional, List
from app.providers.llm_providers import generate_text

logger = logging.getLogger(__name__)

# Load design system resources to build the prompt dynamically
import os

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
FONT_PAIRS = load_json_resource("font_pairs.json")

def get_template_ids() -> list[str]:
    return [t["id"] for t in TEMPLATES]

def get_palette_ids() -> list[str]:
    return [p["id"] for p in PALETTES]

def get_font_pair_ids() -> list[str]:
    return [fp["id"] for fp in FONT_PAIRS]

class BackgroundChoice(BaseModel):
    type: Literal["photo", "solid", "gradient"]
    pexels_query: Optional[str] = None
    fallback_type: Literal["solid", "gradient"]

class ElementItem(BaseModel):
    type: Literal["icon", "shape"]
    iconify_id: Optional[str] = None
    shape_id: Optional[str] = None
    slot: str

class TextLogo(BaseModel):
    content: str
    style_hint: Optional[str] = None

class ArtDirectorOutput(BaseModel):
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

def run_art_director(
    topic: str, 
    model: str = "gemini-2.0-flash",
    provider: str = "gemini",
    api_key: str = "",
    brand_palette_id: str = None,
    brand_font_pair_id: str = None
) -> ArtDirectorOutput:
    template_options = "\n".join([f"- {t['id']} (best for: {', '.join(t.get('best_for', []))})" for t in TEMPLATES])
    palette_options = "\n".join([f"- {p['id']} (mood: {', '.join(p.get('mood', []))})" for p in PALETTES])
    font_pair_options = "\n".join([f"- {fp['id']} (mood: {', '.join(fp.get('mood', []))})" for fp in FONT_PAIRS])

    system_prompt = f"""You are the AI Art Director for a poster generator.
Your job is to decide the creative content and select design resources from a curated library.
You MUST output ONLY valid JSON matching this schema:
{{
  "headline": "string",
  "subheadline": "string",
  "mood": "string",
  "template_id": "string",
  "palette_id": "string",
  "font_pair_id": "string",
  "background_choice": {{
    "type": "photo|solid|gradient",
    "pexels_query": "string (optional)",
    "fallback_type": "solid|gradient"
  }},
  "use_contrast_overlay": true|false,
  "elements": [
    {{ "type": "icon|shape", "iconify_id": "string (optional)", "shape_id": "string (optional)", "slot": "string" }}
  ],
  "text_logo": {{ "content": "string", "style_hint": "string (optional)" }}
}}

Rules:
1. `template_id` MUST be chosen from these options:
{template_options}

2. `palette_id` MUST be chosen from these options:
{palette_options}

3. `font_pair_id` MUST be chosen from these options:
{font_pair_options}

4. Before finalizing elements, check: would a shape/badge strengthen the focal point? Would an icon reinforce the topic? Only add elements that earn their place — an overcrowded poster is worse than a clean one.
"""

    if brand_palette_id:
        system_prompt += f"\nCRITICAL: The user has a brand kit. You MUST use palette_id '{brand_palette_id}'."
    if brand_font_pair_id:
        system_prompt += f"\nCRITICAL: The user has a brand kit. You MUST use font_pair_id '{brand_font_pair_id}'."

    user_prompt = f"Create a poster design for this topic: {topic}"

    response_text = generate_text(
        prompt=user_prompt,
        system_prompt=system_prompt,
        model_name=model,
        provider_name=provider,
        api_key=api_key,
        temperature=0.7,
        max_tokens=1000
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
