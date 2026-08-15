"""
vector_assets.py
----------------
Curated vector illustrations, backgrounds, decorative stamps, and framing elements.
Provides parameterized SVGs with dynamic color injection for Canva-grade poster generation.
"""

from __future__ import annotations

import io
import logging
import re
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

# Complete catalog of thematic SVG assets
SVG_CATALOG: Dict[str, Dict[str, Any]] = {
    # ---------------------------------------------------------------------------
    # Backgrounds & Atmosphere
    # ---------------------------------------------------------------------------
    "sunburst-rays": {
        "id": "sunburst-rays",
        "category": "background",
        "name": "Tropical Sunburst Rays",
        "tags": ["summer", "tropical", "sale", "promo", "energy", "sunburst", "rays"],
        "svg": """<svg viewBox="0 0 1080 1080" fill="none" xmlns="http://www.w3.org/2000/svg">
  <g opacity="{{opacity|0.25}}">
    <path d="M540 540L500 0H580L540 540Z" fill="{{accent|#F59E0B}}" />
    <path d="M540 540L830 0H910L540 540Z" fill="{{accent|#F59E0B}}" />
    <path d="M540 540L1080 170V250L540 540Z" fill="{{accent|#F59E0B}}" />
    <path d="M540 540L1080 500V580L540 540Z" fill="{{accent|#F59E0B}}" />
    <path d="M540 540L1080 830V910L540 540Z" fill="{{accent|#F59E0B}}" />
    <path d="M540 540L910 1080H830L540 540Z" fill="{{accent|#F59E0B}}" />
    <path d="M540 540L580 1080H500L540 540Z" fill="{{accent|#F59E0B}}" />
    <path d="M540 540L250 1080H170L540 540Z" fill="{{accent|#F59E0B}}" />
    <path d="M540 540L0 910V830L540 540Z" fill="{{accent|#F59E0B}}" />
    <path d="M540 540L0 580V500L540 540Z" fill="{{accent|#F59E0B}}" />
    <path d="M540 540L0 250V170L540 540Z" fill="{{accent|#F59E0B}}" />
    <path d="M540 540L170 0H250L540 540Z" fill="{{accent|#F59E0B}}" />
  </g>
</svg>""",
    },
    "radial-glow": {
        "id": "radial-glow",
        "category": "background",
        "name": "Radial Glow Spotlight",
        "tags": ["glow", "spotlight", "focal", "radial", "light"],
        "svg": """<svg viewBox="0 0 1080 1080" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="radialGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="{{accent|#F59E0B}}" stop-opacity="{{opacity|0.45}}" />
      <stop offset="60%" stop-color="{{accent|#F59E0B}}" stop-opacity="{{opacity|0.15}}" />
      <stop offset="100%" stop-color="{{accent|#F59E0B}}" stop-opacity="0" />
    </radialGradient>
  </defs>
  <rect width="1080" height="1080" fill="url(#radialGlow)" />
</svg>""",
    },
    "dot-matrix": {
        "id": "dot-matrix",
        "category": "background",
        "name": "Geometric Dot Matrix Grid",
        "tags": ["tech", "grid", "modern", "dots", "saas", "pattern"],
        "svg": """<svg viewBox="0 0 400 400" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <pattern id="dotPattern" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
      <circle cx="20" cy="20" r="2.5" fill="{{accent|#3B82F6}}" opacity="{{opacity|0.35}}" />
    </pattern>
  </defs>
  <rect width="400" height="400" fill="url(#dotPattern)" />
</svg>""",
    },
    "abstract-waves": {
        "id": "abstract-waves",
        "category": "background",
        "name": "Organic Flow Waves",
        "tags": ["waves", "organic", "creative", "smooth", "flow"],
        "svg": """<svg viewBox="0 0 1080 400" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M0 200C240 100 480 300 720 200C960 100 1040 250 1080 300V400H0V200Z" fill="{{accent|#3B82F6}}" opacity="{{opacity|0.2}}" />
  <path d="M0 260C300 180 540 340 800 240C980 180 1050 280 1080 320V400H0V260Z" fill="{{primary|#6366F1}}" opacity="{{opacity|0.25}}" />
</svg>""",
    },

    # ---------------------------------------------------------------------------
    # Corner & Framing Elements
    # ---------------------------------------------------------------------------
    "tropical-palm-fronds": {
        "id": "tropical-palm-fronds",
        "category": "corner_accent",
        "name": "Tropical Palm Leaves",
        "tags": ["summer", "tropical", "leaves", "botanical", "palm", "nature"],
        "svg": """<svg viewBox="0 0 300 300" fill="none" xmlns="http://www.w3.org/2000/svg">
  <g opacity="{{opacity|0.9}}">
    <!-- Main stem -->
    <path d="M0 0C60 90 140 180 280 260" stroke="{{accent|#10B981}}" stroke-width="4" stroke-linecap="round" />
    <!-- Fronds -->
    <path d="M40 50C100 40 180 70 220 120C180 100 110 90 40 50Z" fill="{{accent|#10B981}}" opacity="0.85" />
    <path d="M70 90C140 70 220 110 250 170C200 140 130 130 70 90Z" fill="{{accent|#10B981}}" opacity="0.9" />
    <path d="M100 130C170 120 240 160 270 220C220 190 150 170 100 130Z" fill="{{accent|#10B981}}" opacity="0.95" />
    <path d="M140 180C200 170 260 220 280 270C240 240 180 220 140 180Z" fill="{{accent|#10B981}}" />
    <!-- Leaf veins -->
    <path d="M50 60C110 50 170 80 200 110" stroke="{{text_on_dark|#FFFFFF}}" stroke-width="1.5" opacity="0.4" />
    <path d="M80 100C140 85 200 120 230 155" stroke="{{text_on_dark|#FFFFFF}}" stroke-width="1.5" opacity="0.4" />
  </g>
</svg>""",
    },
    "tech-corner-brackets": {
        "id": "tech-corner-brackets",
        "category": "corner_accent",
        "name": "Tech Cyber Brackets",
        "tags": ["tech", "cyber", "brackets", "frame", "saas", "modern"],
        "svg": """<svg viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg">
  <g opacity="{{opacity|0.85}}">
    <path d="M10 80V10H80" stroke="{{accent|#3B82F6}}" stroke-width="6" stroke-linecap="square" />
    <path d="M25 50V25H50" stroke="{{accent|#3B82F6}}" stroke-width="2" stroke-linecap="square" opacity="0.6" />
    <circle cx="10" cy="10" r="4" fill="{{accent|#3B82F6}}" />
  </g>
</svg>""",
    },
    "vintage-flourish": {
        "id": "vintage-flourish",
        "category": "corner_accent",
        "name": "Vintage Editorial Flourish",
        "tags": ["vintage", "editorial", "luxury", "quote", "classic"],
        "svg": """<svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M10 10C60 10 100 50 100 100C100 150 140 190 190 190M10 10C10 60 50 100 100 100M10 10L40 40M190 190L160 160" stroke="{{accent|#D97706}}" stroke-width="4" stroke-linecap="round" opacity="{{opacity|0.75}}" />
</svg>""",
    },

    # ---------------------------------------------------------------------------
    # Badges, Ribbons, & Seals
    # ---------------------------------------------------------------------------
    "starburst-badge": {
        "id": "starburst-badge",
        "category": "badge",
        "name": "Starburst Promo Badge",
        "tags": ["starburst", "sale", "discount", "offer", "retail", "sticker"],
        "svg": """<svg viewBox="0 0 240 240" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M120 8L138 52L178 27L171 74L218 67L187 104L232 120L187 136L218 173L171 166L178 213L138 188L120 232L102 188L62 213L69 166L22 173L53 136L8 120L53 104L22 67L69 74L62 27L102 52L120 8Z" fill="{{accent|#EF4444}}" />
  <circle cx="120" cy="120" r="82" fill="{{primary|#B91C1C}}" opacity="0.3" />
  <circle cx="120" cy="120" r="76" stroke="{{text_on_dark|#FFFFFF}}" stroke-width="3" stroke-dasharray="6 4" opacity="0.8" />
</svg>""",
    },
    "ribbon-banner": {
        "id": "ribbon-banner",
        "category": "badge",
        "name": "Folded Ribbon Banner",
        "tags": ["ribbon", "banner", "award", "announcement", "promo"],
        "svg": """<svg viewBox="0 0 340 120" fill="none" xmlns="http://www.w3.org/2000/svg">
  <!-- Ribbon Tails -->
  <path d="M20 30L45 60L20 90H60V30H20Z" fill="{{primary|#1E293B}}" />
  <path d="M320 30L295 60L320 90H280V30H320Z" fill="{{primary|#1E293B}}" />
  <!-- Under folds -->
  <path d="M45 60L60 90V75L45 60Z" fill="#000000" opacity="0.3" />
  <path d="M295 60L280 90V75L295 60Z" fill="#000000" opacity="0.3" />
  <!-- Main Banner Body -->
  <path d="M40 20H300V80H40V20Z" fill="{{accent|#F59E0B}}" />
  <!-- Subtle border -->
  <path d="M44 24H296V76H44V24Z" stroke="{{text_on_dark|#FFFFFF}}" stroke-width="2" stroke-opacity="0.6" />
</svg>""",
    },
    "arched-banner": {
        "id": "arched-banner",
        "category": "badge",
        "name": "Arched Stage Banner",
        "tags": ["arch", "banner", "summer", "limited-time", "stage", "curved"],
        "svg": """<svg viewBox="0 0 400 110" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M20 90C100 45 300 45 380 90L370 35C290 -5 110 -5 30 35L20 90Z" fill="{{accent|#0D9488}}" />
  <path d="M26 80C104 38 296 38 374 80" stroke="{{text_on_dark|#FFFFFF}}" stroke-width="3" stroke-opacity="0.8" />
</svg>""",
    },
    "price-bubble": {
        "id": "price-bubble",
        "category": "badge",
        "name": "Circular Price / Value Bubble",
        "tags": ["price", "bubble", "circle", "discount", "promo"],
        "svg": """<svg viewBox="0 0 220 220" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="110" cy="110" r="96" fill="{{accent|#F59E0B}}" />
  <circle cx="110" cy="110" r="82" stroke="{{text_on_dark|#FFFFFF}}" stroke-width="4" stroke-dasharray="10 8" opacity="0.85" />
</svg>""",
    },
    "verified-seal": {
        "id": "verified-seal",
        "category": "badge",
        "name": "Certified Guarantee Seal",
        "tags": ["seal", "guarantee", "proof", "verified", "quality", "badge"],
        "svg": """<svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M100 0L117 17L141 11L153 32L176 34L180 57L200 68L195 91L200 114L180 125L176 148L153 150L141 171L117 165L100 182L83 165L59 171L47 150L24 148L20 125L0 114L5 91L0 68L20 57L24 34L47 32L59 11L83 17L100 0Z" fill="{{accent|#3B82F6}}" />
  <circle cx="100" cy="100" r="68" fill="{{primary|#1E3A8A}}" />
  <circle cx="100" cy="100" r="60" stroke="{{text_on_dark|#FFFFFF}}" stroke-width="2" opacity="0.7" />
</svg>""",
    },

    # ---------------------------------------------------------------------------
    # Focal Shapes & Backdrops
    # ---------------------------------------------------------------------------
    "sun-disc": {
        "id": "sun-disc",
        "category": "focal_shape",
        "name": "Sun Focal Disc",
        "tags": ["sun", "disc", "circle", "summer", "focal", "glow"],
        "svg": """<svg viewBox="0 0 600 600" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="300" cy="300" r="280" fill="{{accent|#FBBF24}}" opacity="{{opacity|0.9}}" />
  <circle cx="300" cy="300" r="250" fill="{{primary|#F59E0B}}" opacity="0.7" />
  <circle cx="300" cy="300" r="240" stroke="{{text_on_dark|#FFFFFF}}" stroke-width="6" stroke-opacity="0.6" stroke-dasharray="16 12" />
</svg>""",
    },
    "quote-marks": {
        "id": "quote-marks",
        "category": "focal_shape",
        "name": "Oversized Editorial Quotation Marks",
        "tags": ["quote", "editorial", "marks", "thoughts", "founder"],
        "svg": """<svg viewBox="0 0 160 120" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M0 70C0 35 25 10 60 0L70 20C45 28 35 45 35 60H70V120H0V70ZM90 70C90 35 115 10 150 0L160 20C135 28 125 45 125 60H160V120H90V70Z" fill="{{accent|#F59E0B}}" opacity="{{opacity|0.35}}" />
</svg>""",
    },
    "stage-brackets": {
        "id": "stage-brackets",
        "category": "focal_shape",
        "name": "Stage Framing Accents",
        "tags": ["brackets", "stage", "frame", "focal", "highlight"],
        "svg": """<svg viewBox="0 0 500 120" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M40 20H10V100H40" stroke="{{accent|#0D9488}}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" />
  <path d="M460 20H490V100H460" stroke="{{accent|#0D9488}}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" />
</svg>""",
    }
}


def inject_svg_tokens(svg_template: str, tokens: Dict[str, Any]) -> str:
    """
    Replaces tokens in SVG template formatted like `{{token_name|default_value}}` or `{{token_name}}`.
    """
    def _replacer(match: re.Match) -> str:
        full_token = match.group(1).strip()
        if "|" in full_token:
            key, default_val = full_token.split("|", 1)
            key = key.strip()
            default_val = default_val.strip()
        else:
            key = full_token
            default_val = ""

        val = tokens.get(key)
        if val is None or str(val).strip() == "":
            return default_val
        return str(val)

    return re.sub(r"\{\{([^}]+)\}\}", _replacer, svg_template)


def get_vector_asset_svg(asset_id: str, tokens: Optional[Dict[str, Any]] = None) -> Optional[str]:
    """Retrieve injected SVG string for a given asset ID."""
    clean_id = asset_id.lower().strip().replace("_", "-")
    asset = SVG_CATALOG.get(clean_id)
    if not asset:
        return None

    tokens = tokens or {}
    return inject_svg_tokens(asset["svg"], tokens)


def search_vector_assets(query: str, category: Optional[str] = None) -> list[Dict[str, Any]]:
    """Search catalog by semantic query keywords and category."""
    q_words = set(query.lower().replace("-", " ").replace("_", " ").split())
    results = []

    for asset_id, item in SVG_CATALOG.items():
        if category and item.get("category") != category:
            continue

        item_tags = set(item.get("tags", []))
        item_words = set(item.get("name", "").lower().split())
        score = len(q_words.intersection(item_tags)) * 2 + len(q_words.intersection(item_words))

        if score > 0 or not query.strip():
            results.append({
                **item,
                "relevance_score": score
            })

    results.sort(key=lambda x: x.get("relevance_score", 0), reverse=True)
    return results


def rasterize_svg_to_pil(svg_content: str, width: int, height: int):
    """Rasterize an SVG string directly to a PIL RGBA Image."""
    # 1. Try cairosvg
    try:
        import cairosvg
        from PIL import Image
        png_bytes = cairosvg.svg2png(
            bytestring=svg_content.encode("utf-8"),
            output_width=width,
            output_height=height,
        )
        return Image.open(io.BytesIO(png_bytes)).convert("RGBA")
    except Exception:
        pass

    # 2. Try resvg_py
    try:
        import resvg_py
        from PIL import Image
        png_bytes = resvg_py.svg_to_bytes(svg_content, width=width, height=height)
        return Image.open(io.BytesIO(png_bytes)).convert("RGBA")
    except Exception:
        pass

    return None

