"""
meme_renderer.py
----------------
High-impact PIL composite renderer for viral memes and social cards.

Supports:
1. Classic Impact Top/Bottom Text Memes (with thick black text strokes).
2. Modern Card / Headline Memes (Twitter-style header with avatar + punchline + image).
"""

from __future__ import annotations

import base64
import io
import logging
import os
import urllib.request
from typing import Optional, Literal
from PIL import Image, ImageDraw, ImageFont

from app.services.security_utils import is_safe_public_url

logger = logging.getLogger(__name__)

FONTS_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "assets", "fonts")


def _get_font(font_name: str, size: int) -> ImageFont.ImageFont:
    """Load TTF from backend/assets/fonts/ or fallback to system Arial."""
    font_file = f"{font_name.replace(' ', '')}-Bold.ttf"
    font_path = os.path.join(FONTS_DIR, font_file)
    if os.path.exists(font_path):
        try:
            return ImageFont.truetype(font_path, size)
        except Exception:
            pass
    try:
        return ImageFont.truetype("arialbd.ttf", size)
    except Exception:
        try:
            return ImageFont.truetype("arial.ttf", size)
        except Exception:
            return ImageFont.load_default()


def _fetch_image(image_source: str, canvas_w: int = 1080, canvas_h: int = 1080) -> Image.Image:
    """Fetch image from safe HTTP URL, data URL, or local path and scale cleanly."""
    img: Optional[Image.Image] = None
    try:
        if image_source.startswith("data:image/"):
            _, b64 = image_source.split(",", 1)
            raw = base64.b64decode(b64)
            img = Image.open(io.BytesIO(raw)).convert("RGBA")
        elif (image_source.startswith("http://") or image_source.startswith("https://")) and is_safe_public_url(image_source):
            req = urllib.request.Request(image_source, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=8) as resp:
                raw = resp.read()
                img = Image.open(io.BytesIO(raw)).convert("RGBA")
        elif os.path.exists(image_source):
            img = Image.open(image_source).convert("RGBA")
    except Exception as e:
        logger.warning(f"Failed to fetch meme source image: {e}")

    if not img:
        # Fallback dark gradient canvas
        img = Image.new("RGBA", (canvas_w, canvas_h), (24, 28, 36, 255))
        d = ImageDraw.Draw(img)
        d.rectangle([20, 20, canvas_w - 20, canvas_h - 20], outline=(60, 68, 84, 255), width=4)

    # Scale to cover target dimensions
    img_w, img_h = img.size
    scale = max(canvas_w / max(1, img_w), canvas_h / max(1, img_h))
    new_w, new_h = max(1, int(img_w * scale)), max(1, int(img_h * scale))
    img = img.resize((new_w, new_h), Image.Resampling.LANCZOS)

    left = max(0, (new_w - canvas_w) // 2)
    top = max(0, (new_h - canvas_h) // 2)
    return img.crop((left, top, left + canvas_w, top + canvas_h))


def _wrap_text_lines(text: str, font: ImageFont.ImageFont, max_width: int, draw: ImageDraw.ImageDraw) -> list[str]:
    """Wrap text to fit within max_width."""
    words = text.split()
    if not words:
        return []
    lines = []
    current_line = []
    for word in words:
        test_line = " ".join(current_line + [word])
        bbox = draw.textbbox((0, 0), test_line, font=font)
        if (bbox[2] - bbox[0]) <= max_width:
            current_line.append(word)
        else:
            if current_line:
                lines.append(" ".join(current_line))
            current_line = [word]
    if current_line:
        lines.append(" ".join(current_line))
    return lines


def render_classic_meme(
    image_url: str,
    top_text: str = "",
    bottom_text: str = "",
    canvas_w: int = 1080,
    canvas_h: int = 1080,
) -> str:
    """
    Renders classic bold impact meme with black outline strokes.
    """
    bg = _fetch_image(image_url, canvas_w, canvas_h)
    draw = ImageDraw.Draw(bg)

    def draw_meme_text_block(text: str, is_top: bool):
        if not text.strip():
            return
        text = text.upper().strip()
        margin = int(canvas_w * 0.06)
        max_w = canvas_w - (margin * 2)
        
        # Binary search / step down font size
        font_size = int(canvas_w * 0.085)
        min_size = 24
        font = _get_font("Montserrat", font_size)
        lines = _wrap_text_lines(text, font, max_w, draw)
        
        while len(lines) > 3 and font_size > min_size:
            font_size = int(font_size * 0.85)
            font = _get_font("Montserrat", font_size)
            lines = _wrap_text_lines(text, font, max_w, draw)

        line_height = int(font_size * 1.2)
        total_h = len(lines) * line_height
        stroke_width = max(3, font_size // 14)

        start_y = int(canvas_h * 0.04) if is_top else (canvas_h - int(canvas_h * 0.04) - total_h)

        for i, line in enumerate(lines):
            bbox = draw.textbbox((0, 0), line, font=font)
            line_w = bbox[2] - bbox[0]
            line_x = max(margin, (canvas_w - line_w) // 2)
            line_y = start_y + (i * line_height)
            draw.text(
                (line_x, line_y),
                line,
                font=font,
                fill=(255, 255, 255, 255),
                stroke_width=stroke_width,
                stroke_fill=(0, 0, 0, 255),
            )

    draw_meme_text_block(top_text, is_top=True)
    draw_meme_text_block(bottom_text, is_top=False)

    buf = io.BytesIO()
    bg.convert("RGB").save(buf, format="PNG", quality=95)
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("utf-8")


def render_modern_card_meme(
    image_url: str,
    headline_text: str,
    brand_name: str = "Creator",
    handle: str = "@autocreator",
    avatar_url: Optional[str] = None,
    canvas_w: int = 1080,
    canvas_h: int = 1080,
) -> str:
    """
    Renders modern Twitter / LinkedIn card format with white header and anchored image.
    """
    canvas = Image.new("RGBA", (canvas_w, canvas_h), (255, 255, 255, 255))
    draw = ImageDraw.Draw(canvas)

    padding = int(canvas_w * 0.05)
    
    # 1. Avatar & Brand Header
    avatar_size = 64
    avatar_img = None
    if avatar_url and is_safe_public_url(avatar_url):
        try:
            req = urllib.request.Request(avatar_url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=5) as resp:
                avatar_img = Image.open(io.BytesIO(resp.read())).convert("RGBA").resize((avatar_size, avatar_size), Image.Resampling.LANCZOS)
        except Exception:
            pass

    if not avatar_img:
        avatar_img = Image.new("RGBA", (avatar_size, avatar_size), (99, 102, 241, 255))
        a_draw = ImageDraw.Draw(avatar_img)
        initial = (brand_name[:1] or "A").upper()
        f_init = _get_font("Inter", 32)
        a_draw.text((20, 12), initial, font=f_init, fill=(255, 255, 255, 255))

    # Make avatar circular
    mask = Image.new("L", (avatar_size, avatar_size), 0)
    m_draw = ImageDraw.Draw(mask)
    m_draw.ellipse([0, 0, avatar_size - 1, avatar_size - 1], fill=255)
    canvas.paste(avatar_img, (padding, padding), mask)

    # Brand text
    name_font = _get_font("Inter", 26)
    handle_font = _get_font("Inter", 20)
    draw.text((padding + avatar_size + 16, padding + 6), brand_name, font=name_font, fill=(17, 24, 39, 255))
    draw.text((padding + avatar_size + 16, padding + 36), handle, font=handle_font, fill=(107, 114, 128, 255))

    # 2. Headline / Joke text
    header_y = padding + avatar_size + 24
    headline_font = _get_font("Inter", 36)
    max_text_w = canvas_w - (padding * 2)
    lines = _wrap_text_lines(headline_text, headline_font, max_text_w, draw)
    line_h = 48

    for i, line in enumerate(lines):
        draw.text((padding, header_y + (i * line_h)), line, font=headline_font, fill=(17, 24, 39, 255))

    text_block_h = len(lines) * line_h
    img_y = header_y + text_block_h + 20
    img_h = max(200, canvas_h - img_y - padding)
    img_w = canvas_w - (padding * 2)

    # 3. Main Meme Image
    main_img = _fetch_image(image_url, img_w, img_h)
    
    # Rounded corners on image
    corner_mask = Image.new("L", (img_w, img_h), 0)
    c_draw = ImageDraw.Draw(corner_mask)
    c_draw.rounded_rectangle([0, 0, img_w - 1, img_h - 1], radius=20, fill=255)
    
    canvas.paste(main_img, (padding, img_y), corner_mask)
    draw.rounded_rectangle([padding, img_y, padding + img_w - 1, img_y + img_h - 1], radius=20, outline=(229, 231, 235, 255), width=2)

    buf = io.BytesIO()
    canvas.convert("RGB").save(buf, format="PNG", quality=95)
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("utf-8")
