import os
import io
import base64
from typing import Dict, List, Any
from PIL import Image, ImageDraw, ImageFont

from app.services.art_director import TEMPLATES, PALETTES, FONT_PAIRS

def parse_hex_color(hex_str: str, default=(255, 255, 255, 255)) -> tuple:
    hex_str = (hex_str or "").strip().lstrip('#')
    if len(hex_str) == 3:
        hex_str = "".join([c*2 for c in hex_str])
    try:
        r = int(hex_str[0:2], 16)
        g = int(hex_str[2:4], 16)
        b = int(hex_str[4:6], 16)
        a = int(hex_str[6:8], 16) if len(hex_str) >= 8 else 255
        return (r, g, b, a)
    except (ValueError, IndexError):
        return default

def render_gradient_background(palette: Dict, canvas_w: int, canvas_h: int) -> Image.Image:
    bg_config = palette.get("background", {})
    bg_type = bg_config.get("type", "solid")
    
    if bg_type == "solid":
        hex_color = bg_config.get("hex", "#121212")
        color = parse_hex_color(hex_color)
        return Image.new("RGBA", (canvas_w, canvas_h), color)
    
    elif bg_type == "gradient":
        from_hex = bg_config.get("from", "#000000")
        to_hex = bg_config.get("to", "#ffffff")
        
        c1 = parse_hex_color(from_hex)
        c2 = parse_hex_color(to_hex)
        
        img = Image.new("RGBA", (canvas_w, canvas_h))
        pixels = img.load()
        
        for y in range(canvas_h):
            t = y / max(canvas_h - 1, 1)
            r = int(c1[0] + (c2[0] - c1[0]) * t)
            g = int(c1[1] + (c2[1] - c1[1]) * t)
            b = int(c1[2] + (c2[2] - c1[2]) * t)
            for x in range(canvas_w):
                pixels[x, y] = (r, g, b, 255)
        
        return img
    
    return Image.new("RGBA", (canvas_w, canvas_h), (30, 30, 30, 255))

def get_font_path(font_name: str, font_size: int) -> ImageFont.ImageFont:
    font_size = int(max(10, font_size))
    clean_name = font_name.strip()
    no_space_name = clean_name.replace(" ", "")
    
    # Check assets/fonts directory dynamically
    fonts_dir = os.path.join(os.path.dirname(__file__), "..", "..", "assets", "fonts")
    if os.path.exists(fonts_dir):
        # Direct match or partial match in fonts_dir
        for f in os.listdir(fonts_dir):
            if f.lower().endswith((".ttf", ".otf")):
                f_base = os.path.splitext(f)[0].lower()
                if (clean_name.lower() in f_base or 
                    no_space_name.lower() in f_base.replace("-", "").replace("_", "")):
                    try:
                        return ImageFont.truetype(os.path.join(fonts_dir, f), font_size)
                    except Exception:
                        pass

    font_candidates = [
        f"backend/assets/fonts/{clean_name}.ttf",
        f"backend/assets/fonts/{no_space_name}.ttf",
        f"backend/assets/fonts/{no_space_name}-Bold.ttf",
        f"backend/assets/fonts/{no_space_name}-Regular.ttf",
        f"assets/fonts/{clean_name}.ttf",
        f"assets/fonts/{no_space_name}-Bold.ttf",
        "C:\\Windows\\Fonts\\arial.ttf",
        "C:\\Windows\\Fonts\\arialbd.ttf",
        "C:\\Windows\\Fonts\\segoeui.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]
    
    for font_path in font_candidates:
        if os.path.isfile(font_path):
            try:
                return ImageFont.truetype(font_path, font_size)
            except Exception:
                continue
                
    return ImageFont.load_default()

def wrap_text_to_width(text: str, font: ImageFont.ImageFont, max_w: int, draw: ImageDraw.ImageDraw) -> list[str]:
    """Break text into lines that do not exceed max_w."""
    if not text:
        return []
    words = text.split()
    if not words:
        return [text]
    lines = []
    current_line = []
    for word in words:
        test_line = " ".join(current_line + [word])
        bbox = draw.textbbox((0, 0), test_line, font=font)
        line_w = bbox[2] - bbox[0]
        if line_w <= max_w or not current_line:
            current_line.append(word)
        else:
            lines.append(" ".join(current_line))
            current_line = [word]
    if current_line:
        lines.append(" ".join(current_line))
    return lines

def create_modern_gradient_overlay(canvas_w: int, canvas_h: int, opacity: float, style: str = "bottom_fade") -> Image.Image:
    """Create a soft, modern directional gradient overlay for legibility without muddying stock photos."""
    overlay = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
    pixels = overlay.load()
    base_alpha = int(opacity * 255)
    
    for y in range(canvas_h):
        t = y / max(1, canvas_h - 1)
        if style == "bottom_fade":
            alpha = int(base_alpha * (0.15 + 0.85 * (t ** 1.3)))
        elif style == "top_fade":
            alpha = int(base_alpha * (0.85 * ((1.0 - t) ** 1.3) + 0.15))
        elif style == "center_soft":
            dist = abs(t - 0.5) * 2
            alpha = int(base_alpha * (0.8 - 0.4 * dist))
        else:
            alpha = base_alpha
            
        for x in range(canvas_w):
            pixels[x, y] = (10, 12, 16, min(255, alpha))
            
    return overlay

def render_text(text: str, x: int, y: int, w: int, h: int, 
                font_name: str, font_size: int, color: str, 
                align: str = "left", with_shadow: bool = True) -> Image.Image:
    layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    
    curr_font_size = font_size
    font = get_font_path(font_name, curr_font_size)
    lines = wrap_text_to_width(text, font, w, draw)
    
    # If total text height exceeds container, dynamically step down font size
    line_height = int(curr_font_size * 1.25)
    total_height = len(lines) * line_height
    min_font_size = 14
    
    while total_height > h and curr_font_size > min_font_size:
        curr_font_size = max(min_font_size, int(curr_font_size * 0.88))
        font = get_font_path(font_name, curr_font_size)
        lines = wrap_text_to_width(text, font, w, draw)
        line_height = int(curr_font_size * 1.25)
        total_height = len(lines) * line_height
        
    color_rgb = parse_hex_color(color)[:3]
    start_y = max(0, (h - total_height) // 2)
    shadow_offset = max(1, curr_font_size // 26)
    shadow_color = (0, 0, 0, 160)
    
    for i, line in enumerate(lines):
        bbox = draw.textbbox((0, 0), line, font=font)
        line_w = bbox[2] - bbox[0]
        if align == "center":
            line_x = max(0, (w - line_w) // 2)
        elif align == "right":
            line_x = max(0, w - line_w)
        else: 
            line_x = 0
            
        line_y = start_y + (i * line_height)
        if with_shadow:
            draw.text((line_x + shadow_offset, line_y + shadow_offset), line, font=font, fill=shadow_color)
        draw.text((line_x, line_y), line, font=font, fill=color_rgb)
        
    return layer

def resolve_template_slots(template_id: str, canvas_w: int, canvas_h: int) -> Dict[str, Dict]:
    template = next((t for t in TEMPLATES if t["id"] == template_id), None)
    if not template:
        return {}
    
    slots = {}
    for slot_name, slot_config in template.get("slots", {}).items():
        x_pct = slot_config.get("x_pct", 0) / 100
        y_pct = slot_config.get("y_pct", 0) / 100
        w_pct = slot_config.get("w_pct", 100) / 100
        h_pct = slot_config.get("h_pct", 100) / 100
        
        slots[slot_name] = {
            "x": int(x_pct * canvas_w),
            "y": int(y_pct * canvas_h),
            "w": int(w_pct * canvas_w),
            "h": int(h_pct * canvas_h),
            "align": slot_config.get("align", "left")
        }
    
    return slots

import urllib.request
import logging

logger = logging.getLogger(__name__)

def render_shape_layer(el: Dict, palette: Dict) -> Image.Image:
    w = int(max(10, float(el.get("w", 200) or 200)))
    h = int(max(10, float(el.get("h", 100) or 100)))
    shape_kind = str(el.get("resolved") or el.get("description") or "rectangle").lower()

    hex_color = palette.get("accent") or palette.get("primary") or "#3b82f6"
    if isinstance(hex_color, list):
        hex_color = hex_color[0]
    r, g, b, _ = parse_hex_color(str(hex_color), default=(59, 130, 246, 255))
    
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    fill_color = (r, g, b, int(255 * (float(el.get("opacity", 80)) / 100.0)))
    
    if "pill" in shape_kind or "badge" in shape_kind:
        radius = max(4, min(w, h) // 2)
        draw.rounded_rectangle([0, 0, w - 1, h - 1], radius=radius, fill=fill_color)
    elif "circle" in shape_kind or "bubble" in shape_kind:
        draw.ellipse([0, 0, w - 1, h - 1], fill=fill_color)
    elif "divider" in shape_kind:
        bar_h = max(2, h // 4)
        top = (h - bar_h) // 2
        draw.rectangle([0, top, w - 1, top + bar_h], fill=fill_color)
    else:
        radius = max(2, min(16, min(w, h) // 4))
        draw.rounded_rectangle([0, 0, w - 1, h - 1], radius=radius, fill=fill_color)
        
    return img


def render_badge_layer(el: Dict, palette: Dict, font_pair: Dict, run_id: str = "") -> Image.Image | None:
    """Render a badge element (background shape + text or icon). If content fails, drop the badge."""
    w = int(max(20, float(el.get("w", 100) or 100)))
    h = int(max(20, float(el.get("h", 100) or 100)))
    badge_text = el.get("badge_text")
    badge_icon = el.get("badge_icon")
    
    if not badge_text and not badge_icon:
        logger.warning(f"[run={run_id}] render_badge_layer dropping badge: no badge_text or badge_icon resolved for slot '{el.get('slot', 'unknown')}'.")
        el["render_status"] = "dropped_content_resolution"
        return None
        
    img = render_shape_layer(el, palette)
    draw = ImageDraw.Draw(img)
    text_color = palette.get("text_on_dark", "#FFFFFF")
    
    if badge_text:
        font_size = max(12, int(h * 0.35))
        font = get_font_path(font_pair.get("heading_font", "arial"), font_size)
        bbox = draw.textbbox((0, 0), badge_text, font=font)
        tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
        draw.text(((w - tw) // 2, (h - th) // 2), badge_text, font=font, fill=text_color)
    elif badge_icon:
        from app.services.icon_renderer import rasterize_icon
        icon_size = max(16, int(min(w, h) * 0.55))
        icon_img = rasterize_icon(badge_icon, icon_size, icon_size, text_color, run_id)
        if not icon_img:
            el["render_status"] = "dropped_rasterization_failed"
            return None
        img.paste(icon_img, ((w - icon_size) // 2, (h - icon_size) // 2), icon_img)
        
    el["render_status"] = "rendered"
    return img


def render_icon_or_emoji_layer(el: Dict, palette: Dict, run_id: str = "") -> Image.Image:
    """Render an icon element using real SVG rasterization."""
    w = int(max(20, float(el.get("w", 100) or 100)))
    h = int(max(20, float(el.get("h", 100) or 100)))
    icon_id = str(el.get("resolved") or "lucide:sparkles")

    accent_hex = palette.get("accent_color", palette.get("accent", "#f59e0b"))
    if isinstance(accent_hex, list):
        accent_hex = accent_hex[0]
    bg_color = parse_hex_color(str(accent_hex))[:3] + (180,)

    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw.ellipse([0, 0, w - 1, h - 1], fill=bg_color)

    from app.services.icon_renderer import rasterize_icon
    icon_size = max(16, int(min(w, h) * 0.55))
    icon_img = rasterize_icon(
        icon_id=icon_id,
        w=icon_size, h=icon_size,
        color="#FFFFFF",
        run_id=run_id,
    )
    if icon_img:
        ix = (w - icon_size) // 2
        iy = (h - icon_size) // 2
        img.paste(icon_img, (ix, iy), icon_img)

    return img


def render_image_layer(el: Dict, w: int, h: int) -> Image.Image | None:
    url = str(el.get("resolved") or "")
    if not url or not (url.startswith("http") or url.startswith("data:image/")):
        return None
    try:
        w = int(max(10, float(w)))
        h = int(max(10, float(h)))
        if url.startswith("data:image/"):
            header, b64 = url.split(",", 1)
            raw = base64.b64decode(b64)
            img = Image.open(io.BytesIO(raw)).convert("RGBA")
        else:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=5) as resp:
                raw = resp.read()
                img = Image.open(io.BytesIO(raw)).convert("RGBA")
        
        img_w, img_h = img.size
        scale = max(w / max(1, img_w), h / max(1, img_h))
        new_w, new_h = max(1, int(img_w * scale)), max(1, int(img_h * scale))
        img = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
        
        left = max(0, (new_w - w) // 2)
        top = max(0, (new_h - h) // 2)
        cropped = img.crop((left, top, left + w, top + h))
        return cropped
    except Exception as e:
        logger.warning(f"Failed to load image layer '{url[:30]}...': {e}")
        return None


def render_poster_to_base64(
    elements: List[Dict],
    template_id: str,
    palette_id: str,
    font_pair_id: str, 
    canvas_w: int,
    canvas_h: int,
    overlay_opacity: float,
    background_color: str,
    run_id: str = "",
    allow_pexels_bg: bool = False,
    allow_cat_bg: bool = False,
) -> tuple[str, str]:
    palette = next((p for p in PALETTES if p["id"] == palette_id), PALETTES[0])
    font_pair = next((fp for fp in FONT_PAIRS if fp["id"] == font_pair_id), FONT_PAIRS[0])
    
    r, g, b, _ = parse_hex_color(background_color, default=(18, 18, 18, 255))
    final_image = Image.new("RGBA", (canvas_w, canvas_h), (r, g, b, 255))

    elements.sort(key=lambda e: int(e.get("z_index", 0)))

    
    for el in elements:
        el_type = str(el.get("type", "")).lower()
        x, y = int(el.get("x", 0)), int(el.get("y", 0))
        w, h = max(10, int(el.get("w", 200))), max(10, int(el.get("h", 100)))

        layer = None
        if el_type == "text":
            layer = render_text(
                text=str(el.get("content", "")),
                x=0, y=0, 
                w=w, h=h,
                font_name=font_pair.get("heading_font", "arial"),
                font_size=int(el.get("font_size", 40)),
                color=str(el.get("color", "#FFFFFF")),
                align=str(el.get("text_align", "left"))
            )
        elif el_type == "shape":
            layer = render_shape_layer(el, palette)
        elif el_type in ("icon", "emoji"):
            layer = render_icon_or_emoji_layer(el, palette, run_id=run_id)
        elif el_type == "badge":
            layer = render_badge_layer(el, palette, font_pair, run_id=run_id)
        elif el_type == "photo" and el.get("role") == "background":
            from app.services.resource_resolver_unified import resolve_background_photo
            bg_layer, _ = resolve_background_photo(
                query=el.get("description", ""),
                canvas_w=canvas_w, canvas_h=canvas_h,
                run_id=run_id,
                allow_pexels_bg=allow_pexels_bg,
                allow_cat_bg=allow_cat_bg
            )
            layer = bg_layer
        elif el_type in ("cat_photo", "photo", "library_image", "background_asset") or (el.get("resolved") and str(el.get("resolved")).startswith("http")):
            layer = render_image_layer(el, w, h)
            
        if layer:
            rotation = int(el.get("rotation", 0))
            if rotation != 0:
                layer = layer.rotate(rotation, resample=Image.BICUBIC, expand=True)
            
            opacity = float(el.get("opacity", 1.0))
            if opacity < 1.0:
                alpha = layer.split()[3]
                alpha = alpha.point(lambda p: int(p * opacity))
                layer.putalpha(alpha)
                
            final_image.paste(layer, (x, y), layer)

            # If this is a background photo, apply soft directional gradient overlay directly on top
            if el_type == "photo" and el.get("role") == "background" and overlay_opacity > 0:
                gradient_overlay = create_modern_gradient_overlay(canvas_w, canvas_h, overlay_opacity, style="bottom_fade")
                final_image = Image.alpha_composite(final_image, gradient_overlay)
            
    # Save image output to dry_run_output and scratch/test_shape_output.png
    import time
    backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    dry_run_dir = os.path.join(backend_dir, "dry_run_output")
    scratch_dir = os.path.join(backend_dir, "scratch")
    os.makedirs(dry_run_dir, exist_ok=True)
    os.makedirs(scratch_dir, exist_ok=True)

    filename = f"poster_{int(time.time())}.png"
    output_path = os.path.join(dry_run_dir, filename)
    final_image.save(output_path, format="PNG")

    # Also save/copy to scratch/test_shape_output.png
    test_shape_path = os.path.join(scratch_dir, "test_shape_output.png")
    final_image.save(test_shape_path, format="PNG")

    # convert to base64
    buffered = io.BytesIO()
    final_image.save(buffered, format="PNG")
    img_str = base64.b64encode(buffered.getvalue()).decode("utf-8")
    return img_str, output_path
