"""
poster_component_renderer.py
----------------------------
Canva-Grade Component Poster Renderer.

Supports 6 high-converting, modern social archetypes:
1. `social-card`: Modern Tweet/LinkedIn/Insight Card (100% legibility).
2. `editorial-hero`: Magazine Display Typography with directional gradient scrim.
3. `metric-callout`: Oversized Stat/Metric (+4.5x, 85%, $1M) with highlight pill.
4. `checklist-framework`: Actionable Step-by-Step Pills (3-4 checklist rows).
5. `promo-banner`: High-Impact Promotion with category ribbon and CTA button.
6. `minimal-quote`: Mindset and Thought Leadership with author attribution.
"""

from __future__ import annotations

import base64
import io
import logging
import os
import urllib.request
from typing import Optional, List, Dict, Any, Literal
from PIL import Image, ImageDraw, ImageFont, ImageFilter

from app.services.art_director import PALETTES, FONT_PAIRS

logger = logging.getLogger(__name__)

FONTS_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "assets", "fonts")
DESIGN_FONTS_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "design-system", "fonts")


def _get_font(font_name: str, size: int, bold: bool = True) -> ImageFont.ImageFont:
    """Safely resolve font from assets/fonts, system fonts, or fallbacks."""
    size = int(max(10, size))
    clean_name = (font_name or "Roboto").strip()
    no_space = clean_name.replace(" ", "")

    candidates = [
        os.path.join(FONTS_DIR, f"{no_space}-Bold.ttf" if bold else f"{no_space}-Regular.ttf"),
        os.path.join(FONTS_DIR, f"{clean_name}.ttf"),
        os.path.join(FONTS_DIR, f"{no_space}.ttf"),
        os.path.join(FONTS_DIR, "Roboto-Bold.ttf" if bold else "Roboto-Regular.ttf"),
        os.path.join(DESIGN_FONTS_DIR, f"{clean_name}.ttf"),
        os.path.join(DESIGN_FONTS_DIR, "Montserrat-Bold.ttf"),
        "C:\\Windows\\Fonts\\arialbd.ttf" if bold else "C:\\Windows\\Fonts\\arial.ttf",
        "C:\\Windows\\Fonts\\segoeuib.ttf" if bold else "C:\\Windows\\Fonts\\segoeui.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]

    # Check FONTS_DIR dynamically for any installed custom/Google font
    if os.path.exists(FONTS_DIR):
        for f in os.listdir(FONTS_DIR):
            if f.lower().endswith((".ttf", ".otf")):
                f_base = os.path.splitext(f)[0].lower()
                if (clean_name.lower() in f_base or 
                    no_space.lower() in f_base.replace("-", "").replace("_", "")):
                    try:
                        return ImageFont.truetype(os.path.join(FONTS_DIR, f), size)
                    except Exception:
                        pass

def _get_font(font_name: str, size: int, bold: bool = False) -> ImageFont.ImageFont:
    """Load TTF from backend/assets/fonts/ or fallback to system Arial."""
    font_file = f"{font_name.replace(' ', '')}-{'Bold' if bold else 'Regular'}.ttf"
    font_path = os.path.join(FONTS_DIR, font_file)
    if os.path.exists(font_path):
        try:
            return ImageFont.truetype(font_path, size)
        except Exception:
            pass
    try:
        return ImageFont.truetype("arial.ttf", size)
    except Exception:
        return ImageFont.load_default()


def _fetch_image(image_source: str, target_w: int, target_h: int) -> Image.Image:
    """Fetch image from safe HTTP URL or data URL and scale cleanly."""
    img: Optional[Image.Image] = None
    try:
        if not image_source:
            pass
        elif image_source.startswith("data:image/"):
            _, b64 = image_source.split(",", 1)
            raw = base64.b64decode(b64)
            img = Image.open(io.BytesIO(raw)).convert("RGBA")
        elif (image_source.startswith("http://") or image_source.startswith("https://")) and is_safe_public_url(image_source):
            req = urllib.request.Request(image_source, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=6) as resp:
                raw = resp.read()
                img = Image.open(io.BytesIO(raw)).convert("RGBA")
        elif os.path.exists(image_source):
            img = Image.open(image_source).convert("RGBA")
    except Exception as e:
        logger.warning(f"Failed to fetch image source ({image_source[:60]}): {e}")

    if not img:
        # High quality abstract dark gradient canvas
        img = Image.new("RGBA", (target_w, target_h), (24, 28, 36, 255))
        d = ImageDraw.Draw(img)
        d.rectangle([0, 0, target_w, target_h], fill=(30, 35, 48, 255))

    img_w, img_h = img.size
    scale = max(target_w / max(1, img_w), target_h / max(1, img_h))
    new_w, new_h = max(1, int(img_w * scale)), max(1, int(img_h * scale))
    img = img.resize((new_w, new_h), Image.Resampling.LANCZOS)

    left = max(0, (new_w - target_w) // 2)
    top = max(0, (new_h - target_h) // 2)
    return img.crop((left, top, left + target_w, top + target_h))


def _wrap_text(text: str, font: ImageFont.ImageFont, max_width: int, draw: ImageDraw.ImageDraw) -> list[str]:
    """Word-wrap text within max_width."""
    if not text:
        return []
    words = text.split()
    lines = []
    current_line = []

    for word in words:
        test_line = " ".join(current_line + [word])
        bbox = draw.textbbox((0, 0), test_line, font=font)
        if bbox[2] - bbox[0] <= max_width:
            current_line.append(word)
        else:
            if current_line:
                lines.append(" ".join(current_line))
            current_line = [word]

    if current_line:
        lines.append(" ".join(current_line))

    return lines


def _draw_bottom_gradient_overlay(w: int, h: int, base_alpha: int = 180) -> Image.Image:
    """
    Creates a full-width vertical gradient darkening toward the bottom,
    giving maximum contrast for headlines.
    """
    overlay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    pixels = overlay.load()
    split_y = int(h * 0.45)

    for y in range(h):
        if y < split_y:
            alpha = int(base_alpha * (y / split_y) * 0.4)
        else:
            progress = (y - split_y) / (h - split_y)
            alpha = int(base_alpha * 0.4 + (base_alpha * 0.6 * progress))
        alpha = min(230, max(0, alpha))

        for x in range(w):
            pixels[x, y] = (15, 18, 25, alpha)

    return overlay


def _render_avatar(avatar_url: Optional[str], brand_name: str, size: int = 64) -> Image.Image:
    """Render circular brand avatar or styled initial."""
    avatar_img = None
    if avatar_url and is_safe_public_url(avatar_url):
        try:
            req = urllib.request.Request(avatar_url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=5) as resp:
                avatar_img = Image.open(io.BytesIO(resp.read())).convert("RGBA").resize((size, size), Image.Resampling.LANCZOS)
        except Exception:
            pass

    if not avatar_img:
        avatar_img = Image.new("RGBA", (size, size), (99, 102, 241, 255))
        a_draw = ImageDraw.Draw(avatar_img)
        initial = (brand_name[:1] or "A").upper()
        f_init = _get_font("Roboto", int(size * 0.5), bold=True)
        bbox = a_draw.textbbox((0, 0), initial, font=f_init)
        text_w = bbox[2] - bbox[0]
        text_h = bbox[3] - bbox[1]
        a_draw.text(((size - text_w) // 2, (size - text_h) // 2 - 2), initial, font=f_init, fill=(255, 255, 255, 255))

    # Mask to circle
    mask = Image.new("L", (size, size), 0)
    m_draw = ImageDraw.Draw(mask)
    m_draw.ellipse([0, 0, size - 1, size - 1], fill=255)
    
    circular = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    circular.paste(avatar_img, (0, 0), mask)
    return circular


# ---------------------------------------------------------------------------
# Archetype Renderers
# ---------------------------------------------------------------------------

def render_social_card(
    canvas_w: int,
    canvas_h: int,
    headline: str,
    subheadline: Optional[str],
    image_url: Optional[str],
    brand_name: str = "Creator",
    handle: str = "@creator",
    avatar_url: Optional[str] = None,
    badge_text: Optional[str] = None,
    palette: Optional[dict] = None,
    font_pair: Optional[dict] = None,
) -> Image.Image:
    """Archetype 1: Modern Tweet / Social Card."""
    canvas = Image.new("RGBA", (canvas_w, canvas_h), (255, 255, 255, 255))
    draw = ImageDraw.Draw(canvas)

    padding = int(canvas_w * 0.055)
    avatar_size = int(canvas_w * 0.065)

    # 1. Avatar + Brand
    avatar = _render_avatar(avatar_url, brand_name, size=avatar_size)
    canvas.paste(avatar, (padding, padding), avatar)

    name_font = _get_font(font_pair.get("heading_font", "Roboto") if font_pair else "Roboto", int(canvas_w * 0.026), bold=True)
    handle_font = _get_font(font_pair.get("body_font", "Roboto") if font_pair else "Roboto", int(canvas_w * 0.020), bold=False)

    draw.text((padding + avatar_size + 16, padding + 4), brand_name, font=name_font, fill=(17, 24, 39, 255))
    draw.text((padding + avatar_size + 16, padding + 34), handle, font=handle_font, fill=(107, 114, 128, 255))

    # Badge if present
    if badge_text:
        badge_font = _get_font("Roboto", int(canvas_w * 0.018), bold=True)
        b_bbox = draw.textbbox((0, 0), badge_text.upper(), font=badge_font)
        bw = (b_bbox[2] - b_bbox[0]) + 24
        bh = 28
        bx = canvas_w - padding - bw
        draw.rounded_rectangle([bx, padding + 8, bx + bw, padding + 8 + bh], radius=14, fill=(238, 242, 255, 255), outline=(199, 210, 254, 255), width=1)
        draw.text((bx + 12, padding + 14), badge_text.upper(), font=badge_font, fill=(79, 70, 229, 255))

    # 2. Headline & Subheadline
    header_y = padding + avatar_size + 24
    headline_font = _get_font(font_pair.get("heading_font", "Roboto") if font_pair else "Roboto", int(canvas_w * 0.038), bold=True)
    max_w = canvas_w - (padding * 2)

    lines = _wrap_text(headline, headline_font, max_w, draw)
    line_h = int(canvas_w * 0.048)

    for i, line in enumerate(lines[:3]):
        draw.text((padding, header_y + (i * line_h)), line, font=headline_font, fill=(17, 24, 39, 255))

    text_h = len(lines[:3]) * line_h

    # Subheadline if space allows
    sub_y = header_y + text_h + 8
    if subheadline and len(lines) <= 2:
        sub_font = _get_font(font_pair.get("body_font", "Roboto") if font_pair else "Roboto", int(canvas_w * 0.024), bold=False)
        sub_lines = _wrap_text(subheadline, sub_font, max_w, draw)
        for i, s_line in enumerate(sub_lines[:2]):
            draw.text((padding, sub_y + (i * 30)), s_line, font=sub_font, fill=(75, 85, 99, 255))
        sub_y += len(sub_lines[:2]) * 30 + 12

    # 3. Framed Bottom Image
    img_y = sub_y + 12
    img_w = canvas_w - (padding * 2)
    img_h = max(250, canvas_h - img_y - padding)

    hero_img = _fetch_image(image_url or "", img_w, img_h)
    
    # Rounded corners
    corner_mask = Image.new("L", (img_w, img_h), 0)
    c_draw = ImageDraw.Draw(corner_mask)
    c_draw.rounded_rectangle([0, 0, img_w - 1, img_h - 1], radius=24, fill=255)
    
    canvas.paste(hero_img, (padding, img_y), corner_mask)
    draw.rounded_rectangle([padding, img_y, padding + img_w - 1, img_y + img_h - 1], radius=24, outline=(229, 231, 235, 255), width=2)

    return canvas


def render_editorial_hero(
    canvas_w: int,
    canvas_h: int,
    headline: str,
    subheadline: Optional[str],
    image_url: Optional[str],
    brand_name: str = "Creator",
    badge_text: Optional[str] = "FEATURED",
    cta_text: Optional[str] = "READ GUIDE →",
    palette: Optional[dict] = None,
    font_pair: Optional[dict] = None,
) -> Image.Image:
    """Archetype 2: Magazine Display Typography with directional gradient scrim."""
    bg_img = _fetch_image(image_url or "", canvas_w, canvas_h)
    
    # Directional gradient scrim on bottom 60%
    scrim = _create_gradient_scrim(canvas_w, canvas_h, direction="bottom", max_opacity=0.92)
    bg_img.paste(scrim, (0, 0), scrim)
    
    draw = ImageDraw.Draw(bg_img)
    margin = int(canvas_w * 0.065)
    max_w = canvas_w - (margin * 2)

    # Top Brand / Badge Bar
    top_y = margin
    if badge_text:
        badge_font = _get_font("Roboto", int(canvas_w * 0.020), bold=True)
        b_bbox = draw.textbbox((0, 0), badge_text.upper(), font=badge_font)
        bw = (b_bbox[2] - b_bbox[0]) + 28
        bh = 36
        draw.rounded_rectangle([margin, top_y, margin + bw, top_y + bh], radius=8, fill=(244, 63, 94, 230))
        draw.text((margin + 14, top_y + 8), badge_text.upper(), font=badge_font, fill=(255, 255, 255, 255))

    brand_font = _get_font("Roboto", int(canvas_w * 0.022), bold=True)
    draw.text((canvas_w - margin - 200, top_y + 8), brand_name.upper(), font=brand_font, fill=(255, 255, 255, 200))

    # Bottom Content Area
    headline_font = _get_font(font_pair.get("heading_font", "Roboto") if font_pair else "Roboto", int(canvas_w * 0.062), bold=True)
    lines = _wrap_text(headline.upper(), headline_font, max_w, draw)
    line_h = int(canvas_w * 0.072)
    total_h = len(lines[:3]) * line_h

    start_y = canvas_h - margin - total_h - (120 if subheadline else 60)

    for i, line in enumerate(lines[:3]):
        draw.text((margin, start_y + (i * line_h)), line, font=headline_font, fill=(255, 255, 255, 255))

    curr_y = start_y + total_h + 16

    if subheadline:
        sub_font = _get_font(font_pair.get("body_font", "Roboto") if font_pair else "Roboto", int(canvas_w * 0.028), bold=False)
        sub_lines = _wrap_text(subheadline, sub_font, max_w, draw)
        for i, s_line in enumerate(sub_lines[:2]):
            draw.text((margin, curr_y + (i * 36)), s_line, font=sub_font, fill=(229, 231, 235, 255))
        curr_y += len(sub_lines[:2]) * 36 + 20

    if cta_text:
        cta_font = _get_font("Roboto", int(canvas_w * 0.020), bold=True)
        c_bbox = draw.textbbox((0, 0), cta_text.upper(), font=cta_font)
        cw = (c_bbox[2] - c_bbox[0]) + 32
        ch = 38
        draw.rounded_rectangle([margin, canvas_h - margin - ch, margin + cw, canvas_h - margin], radius=19, fill=(255, 255, 255, 255))
        draw.text((margin + 16, canvas_h - margin - ch + 9), cta_text.upper(), font=cta_font, fill=(17, 24, 39, 255))

    return bg_img


def render_metric_callout(
    canvas_w: int,
    canvas_h: int,
    stat_number: str,
    headline: str,
    subheadline: Optional[str],
    image_url: Optional[str],
    brand_name: str = "Creator",
    badge_text: Optional[str] = "KEY STATISTIC",
    palette: Optional[dict] = None,
    font_pair: Optional[dict] = None,
) -> Image.Image:
    """Archetype 3: Big Number & Stat Showcase."""
    canvas = Image.new("RGBA", (canvas_w, canvas_h), (15, 23, 42, 255)) # Dark slate
    
    if image_url:
        bg_photo = _fetch_image(image_url, canvas_w, canvas_h)
        scrim = Image.new("RGBA", (canvas_w, canvas_h), (15, 23, 42, 225))
        bg_photo.paste(scrim, (0, 0), scrim)
        canvas = bg_photo

    draw = ImageDraw.Draw(canvas)
    margin = int(canvas_w * 0.07)
    max_w = canvas_w - (margin * 2)

    # Top Badge + Brand
    top_y = margin
    if badge_text:
        badge_font = _get_font("Roboto", int(canvas_w * 0.020), bold=True)
        b_bbox = draw.textbbox((0, 0), badge_text.upper(), font=badge_font)
        bw = (b_bbox[2] - b_bbox[0]) + 28
        bh = 36
        draw.rounded_rectangle([margin, top_y, margin + bw, top_y + bh], radius=8, fill=(16, 185, 129, 255)) # Emerald green
        draw.text((margin + 14, top_y + 8), badge_text.upper(), font=badge_font, fill=(255, 255, 255, 255))

    # Giant Stat Number Block
    stat_str = stat_number or "+4.5X"
    stat_font = _get_font("Roboto", int(canvas_w * 0.16), bold=True)
    stat_bbox = draw.textbbox((0, 0), stat_str, font=stat_font)
    stat_w = stat_bbox[2] - stat_bbox[0]
    stat_h = stat_bbox[3] - stat_bbox[1]

    stat_y = top_y + 80
    # Stat highlight glow / box
    draw.rounded_rectangle([margin, stat_y, margin + stat_w + 40, stat_y + stat_h + 30], radius=16, fill=(30, 41, 59, 240), outline=(51, 65, 85, 255), width=2)
    draw.text((margin + 20, stat_y + 10), stat_str, font=stat_font, fill=(52, 211, 153, 255)) # Light emerald

    # Headline
    head_y = stat_y + stat_h + 60
    head_font = _get_font(font_pair.get("heading_font", "Roboto") if font_pair else "Roboto", int(canvas_w * 0.046), bold=True)
    lines = _wrap_text(headline, head_font, max_w, draw)
    line_h = int(canvas_w * 0.056)

    for i, line in enumerate(lines[:3]):
        draw.text((margin, head_y + (i * line_h)), line, font=head_font, fill=(255, 255, 255, 255))

    sub_y = head_y + (len(lines[:3]) * line_h) + 16
    if subheadline:
        sub_font = _get_font(font_pair.get("body_font", "Roboto") if font_pair else "Roboto", int(canvas_w * 0.026), bold=False)
        sub_lines = _wrap_text(subheadline, sub_font, max_w, draw)
        for i, s_line in enumerate(sub_lines[:2]):
            draw.text((margin, sub_y + (i * 34)), s_line, font=sub_font, fill=(148, 163, 184, 255))

    # Footer
    draw.text((margin, canvas_h - margin), brand_name.upper(), font=_get_font("Roboto", int(canvas_w * 0.022), bold=True), fill=(100, 116, 139, 255))

    return canvas


def render_checklist_framework(
    canvas_w: int,
    canvas_h: int,
    headline: str,
    items: List[str],
    image_url: Optional[str],
    brand_name: str = "Creator",
    badge_text: Optional[str] = "ACTION PLAN",
    palette: Optional[dict] = None,
    font_pair: Optional[dict] = None,
) -> Image.Image:
    """Archetype 4: Checklist & Step Framework."""
    canvas = Image.new("RGBA", (canvas_w, canvas_h), (248, 250, 252, 255)) # Soft grey canvas
    draw = ImageDraw.Draw(canvas)
    margin = int(canvas_w * 0.065)
    max_w = canvas_w - (margin * 2)

    # 1. Header Bar
    top_y = margin
    if badge_text:
        badge_font = _get_font("Roboto", int(canvas_w * 0.020), bold=True)
        b_bbox = draw.textbbox((0, 0), badge_text.upper(), font=badge_font)
        bw = (b_bbox[2] - b_bbox[0]) + 28
        bh = 34
        draw.rounded_rectangle([margin, top_y, margin + bw, top_y + bh], radius=8, fill=(99, 102, 241, 255))
        draw.text((margin + 14, top_y + 7), badge_text.upper(), font=badge_font, fill=(255, 255, 255, 255))

    head_y = top_y + 48
    head_font = _get_font(font_pair.get("heading_font", "Roboto") if font_pair else "Roboto", int(canvas_w * 0.042), bold=True)
    lines = _wrap_text(headline, head_font, max_w, draw)
    line_h = int(canvas_w * 0.050)

    for i, line in enumerate(lines[:2]):
        draw.text((margin, head_y + (i * line_h)), line, font=head_font, fill=(15, 23, 42, 255))

    items_start_y = head_y + (len(lines[:2]) * line_h) + 24
    row_h = int(canvas_w * 0.095)
    row_gap = 16
    pill_font = _get_font(font_pair.get("body_font", "Roboto") if font_pair else "Roboto", int(canvas_w * 0.026), bold=True)

    checklist_items = items if items else [
        "1. Prioritize High-Impact Tasks",
        "2. Timebox 90-Min Focus Blocks",
        "3. Turn Off Non-Essential Alerts",
        "4. Review Progress at End of Day",
    ]

    for i, item_text in enumerate(checklist_items[:4]):
        ry = items_start_y + (i * (row_h + row_gap))
        # Draw pill card
        draw.rounded_rectangle([margin, ry, margin + max_w, ry + row_h], radius=16, fill=(255, 255, 255, 255), outline=(226, 232, 240, 255), width=2)
        # Number badge circle
        circle_size = int(row_h * 0.6)
        cy = ry + (row_h - circle_size) // 2
        cx = margin + 16
        draw.ellipse([cx, cy, cx + circle_size, cy + circle_size], fill=(238, 242, 255, 255))
        
        num_str = str(i + 1)
        num_font = _get_font("Roboto", int(circle_size * 0.55), bold=True)
        nb = draw.textbbox((0, 0), num_str, font=num_font)
        nw = nb[2] - nb[0]
        nh = nb[3] - nb[1]
        draw.text((cx + (circle_size - nw) // 2, cy + (circle_size - nh) // 2 - 2), num_str, font=num_font, fill=(79, 70, 229, 255))

        # Text item
        clean_text = item_text.lstrip("0123456789.- ").strip()
        draw.text((cx + circle_size + 20, ry + (row_h - 30) // 2), clean_text[:45], font=pill_font, fill=(30, 41, 59, 255))

    # Footer
    draw.text((margin, canvas_h - margin + 10), brand_name.upper(), font=_get_font("Roboto", int(canvas_w * 0.020), bold=True), fill=(148, 163, 184, 255))

    return canvas


def render_promo_banner(
    canvas_w: int,
    canvas_h: int,
    headline: str,
    subheadline: Optional[str],
    image_url: Optional[str],
    brand_name: str = "Creator",
    badge_text: Optional[str] = "LIMITED OFFER",
    cta_text: Optional[str] = "GET 50% OFF NOW →",
    palette: Optional[dict] = None,
    font_pair: Optional[dict] = None,
) -> Image.Image:
    """Archetype 5: High-Impact Promotion."""
    bg_img = _fetch_image(image_url or "", canvas_w, canvas_h)
    scrim = _create_gradient_scrim(canvas_w, canvas_h, direction="bottom", max_opacity=0.90)
    bg_img.paste(scrim, (0, 0), scrim)
    draw = ImageDraw.Draw(bg_img)

    margin = int(canvas_w * 0.065)
    max_w = canvas_w - (margin * 2)

    # Top Ribbon
    ribbon_font = _get_font("Roboto", int(canvas_w * 0.022), bold=True)
    r_text = (badge_text or "SPECIAL PROMO").upper()
    rb = draw.textbbox((0, 0), r_text, font=ribbon_font)
    rw = (rb[2] - rb[0]) + 36
    rh = 44
    draw.rounded_rectangle([margin, margin, margin + rw, margin + rh], radius=8, fill=(234, 179, 8, 255)) # Yellow gold
    draw.text((margin + 18, margin + 10), r_text, font=ribbon_font, fill=(17, 24, 39, 255))

    # Headline
    head_font = _get_font(font_pair.get("heading_font", "Roboto") if font_pair else "Roboto", int(canvas_w * 0.060), bold=True)
    lines = _wrap_text(headline.upper(), head_font, max_w, draw)
    line_h = int(canvas_w * 0.070)
    total_h = len(lines[:3]) * line_h

    head_y = canvas_h - margin - total_h - 150

    for i, line in enumerate(lines[:3]):
        draw.text((margin, head_y + (i * line_h)), line, font=head_font, fill=(255, 255, 255, 255))

    sub_y = head_y + total_h + 16
    if subheadline:
        sub_font = _get_font(font_pair.get("body_font", "Roboto") if font_pair else "Roboto", int(canvas_w * 0.028), bold=False)
        draw.text((margin, sub_y), subheadline[:60], font=sub_font, fill=(254, 240, 138, 255)) # Soft yellow

    # Giant CTA Button Pill
    cta_font = _get_font("Roboto", int(canvas_w * 0.026), bold=True)
    c_text = (cta_text or "CLAIM NOW →").upper()
    cb = draw.textbbox((0, 0), c_text, font=cta_font)
    cw = (cb[2] - cb[0]) + 48
    ch = 54
    cta_y = canvas_h - margin - ch
    draw.rounded_rectangle([margin, cta_y, margin + cw, cta_y + ch], radius=27, fill=(234, 179, 8, 255))
    draw.text((margin + 24, cta_y + 14), c_text, font=cta_font, fill=(17, 24, 39, 255))

    return bg_img


def render_minimal_quote(
    canvas_w: int,
    canvas_h: int,
    headline: str,
    brand_name: str = "Creator",
    handle: str = "@creator",
    avatar_url: Optional[str] = None,
    image_url: Optional[str] = None,
    palette: Optional[dict] = None,
    font_pair: Optional[dict] = None,
) -> Image.Image:
    """Archetype 6: Mindset & Minimalist Quote."""
    canvas = Image.new("RGBA", (canvas_w, canvas_h), (24, 24, 27, 255)) # Dark zinc
    draw = ImageDraw.Draw(canvas)
    margin = int(canvas_w * 0.08)
    max_w = canvas_w - (margin * 2)

    # Giant Decorative Quote Mark
    quote_font = _get_font("Roboto", int(canvas_w * 0.20), bold=True)
    draw.text((margin - 10, margin - 40), "“", font=quote_font, fill=(63, 63, 70, 255))

    # Quote Body Text
    body_font = _get_font(font_pair.get("heading_font", "Roboto") if font_pair else "Roboto", int(canvas_w * 0.044), bold=False)
    clean_quote = headline.strip(' "“\'”')
    lines = _wrap_text(f'"{clean_quote}"', body_font, max_w, draw)
    line_h = int(canvas_w * 0.056)
    start_y = margin + 110

    for i, line in enumerate(lines[:5]):
        draw.text((margin, start_y + (i * line_h)), line, font=body_font, fill=(244, 244, 245, 255))

    # Author / Brand Attribution at bottom
    avatar_size = int(canvas_w * 0.065)
    avatar_y = canvas_h - margin - avatar_size
    avatar = _render_avatar(avatar_url, brand_name, size=avatar_size)
    canvas.paste(avatar, (margin, avatar_y), avatar)

    name_font = _get_font("Roboto", int(canvas_w * 0.026), bold=True)
    handle_font = _get_font("Roboto", int(canvas_w * 0.020), bold=False)

    draw.text((margin + avatar_size + 16, avatar_y + 4), brand_name, font=name_font, fill=(255, 255, 255, 255))
    draw.text((margin + avatar_size + 16, avatar_y + 34), handle, font=handle_font, fill=(161, 161, 170, 255))

    return canvas


# ---------------------------------------------------------------------------
# Master Dispatcher
# ---------------------------------------------------------------------------

def render_archetype_poster(
    archetype_id: str,
    headline: str,
    subheadline: Optional[str] = None,
    image_url: Optional[str] = None,
    brand_name: str = "Creator",
    handle: str = "@creator",
    avatar_url: Optional[str] = None,
    badge_text: Optional[str] = None,
    stat_number: Optional[str] = None,
    items: Optional[List[str]] = None,
    cta_text: Optional[str] = None,
    canvas_w: int = 1080,
    canvas_h: int = 1080,
    palette_id: Optional[str] = None,
    font_pair_id: Optional[str] = None,
) -> tuple[str, Image.Image]:
    """
    Renders any of the 6 Canva-grade archetypes.
    Returns: (base64_data_uri, PIL_Image)
    """
    palette = next((p for p in PALETTES if p["id"] == palette_id), None)
    font_pair = next((fp for fp in FONT_PAIRS if fp["id"] == font_pair_id), None)

    clean_arch = (archetype_id or "social-card").lower().replace("_", "-")

    if clean_arch in ("social-card", "modern-card", "tweet-card"):
        img = render_social_card(
            canvas_w, canvas_h, headline, subheadline, image_url,
            brand_name, handle, avatar_url, badge_text, palette, font_pair
        )
    elif clean_arch in ("editorial-hero", "magazine-hero", "editorial"):
        img = render_editorial_hero(
            canvas_w, canvas_h, headline, subheadline, image_url,
            brand_name, badge_text, cta_text, palette, font_pair
        )
    elif clean_arch in ("metric-callout", "stat-callout", "big-number"):
        img = render_metric_callout(
            canvas_w, canvas_h, stat_number or "+4.5X", headline, subheadline, image_url,
            brand_name, badge_text, palette, font_pair
        )
    elif clean_arch in ("checklist-framework", "checklist", "framework", "steps"):
        img = render_checklist_framework(
            canvas_w, canvas_h, headline, items or [], image_url,
            brand_name, badge_text, palette, font_pair
        )
    elif clean_arch in ("promo-banner", "promo", "commercial", "sale"):
        img = render_promo_banner(
            canvas_w, canvas_h, headline, subheadline, image_url,
            brand_name, badge_text, cta_text, palette, font_pair
        )
    elif clean_arch in ("minimal-quote", "quote", "mindset"):
        img = render_minimal_quote(
            canvas_w, canvas_h, headline, brand_name, handle, avatar_url, image_url, palette, font_pair
        )
    else:
        # Default fallback to social-card
        img = render_social_card(
            canvas_w, canvas_h, headline, subheadline, image_url,
            brand_name, handle, avatar_url, badge_text, palette, font_pair
        )

    buf = io.BytesIO()
    img.convert("RGB").save(buf, format="PNG", quality=95)
    b64_str = "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("utf-8")
    return b64_str, img
