import json
import os
import logging

logger = logging.getLogger(__name__)

# Load design system libraries on startup
DATA_DIR = os.path.join(os.path.dirname(__file__), "data", "design-system")

try:
    with open(os.path.join(DATA_DIR, "palettes.json"), "r", encoding="utf-8") as f:
        PALETTES = json.load(f)
except Exception as e:
    logger.error(f"Failed to load palettes.json: {e}")
    PALETTES = []

try:
    with open(os.path.join(DATA_DIR, "font-pairs.json"), "r", encoding="utf-8") as f:
        FONT_PAIRS = json.load(f)
except Exception as e:
    logger.error(f"Failed to load font-pairs.json: {e}")
    FONT_PAIRS = []

try:
    with open(os.path.join(DATA_DIR, "layouts.json"), "r", encoding="utf-8") as f:
        LAYOUTS = json.load(f)
except Exception as e:
    logger.error(f"Failed to load layouts.json: {e}")
    LAYOUTS = []

SHAPE_TYPES = ["PriceBubble", "RibbonBanner", "Starburst", "Divider", "CornerAccent"]
TEXTURE_OPTIONS = ["none", "noise", "dot-grid", "diagonal-stripes"]

def get_palette(palette_id: str) -> dict | None:
    for p in PALETTES:
        if p["id"] == palette_id:
            return p
    return None

def get_font_pair(font_pair_id: str) -> dict | None:
    for fp in FONT_PAIRS:
        if fp["id"] == font_pair_id:
            return fp
    return None

def get_layout(layout_id: str) -> dict | None:
    for l in LAYOUTS:
        if l["id"] == layout_id:
            return l
    return None

def validate_palette_id(palette_id: str) -> bool:
    return any(p["id"] == palette_id for p in PALETTES)

def validate_font_pair_id(font_pair_id: str) -> bool:
    return any(fp["id"] == font_pair_id for fp in FONT_PAIRS)

def validate_layout_id(layout_id: str) -> bool:
    return any(l["id"] == layout_id for l in LAYOUTS)
