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
    font_candidates = [
        f"backend/assets/fonts/{font_name}.ttf",
        f"assets/fonts/{font_name}.ttf",
        f"backend/assets/fonts/{font_name}-Bold.ttf",
        f"assets/fonts/{font_name}-Bold.ttf",
        "C:\\Windows\\Fonts\\arial.ttf",
        "C:\\Windows\\Fonts\\arialbd.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]
    
    for font_path in font_candidates:
        if os.path.isfile(font_path):
            try:
                return ImageFont.truetype(font_path, font_size)
            except Exception:
                continue
                
    return ImageFont.load_default()

def render_text(text: str, x: int, y: int, w: int, h: int, 
                font_name: str, font_size: int, color: str, 
                align: str = "left") -> Image.Image:
    layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    
    font = get_font_path(font_name, font_size)
    color_rgb = parse_hex_color(color)[:3]
    
    bbox = draw.textbbox((0, 0), text, font=font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]
    
    if align == "center":
        text_x = max(0, (w - text_w) // 2)
        text_y = max(0, (h - text_h) // 2)
    elif align == "right":
        text_x = max(0, w - text_w)
        text_y = max(0, (h - text_h) // 2)
    else: 
        text_x = 0
        text_y = max(0, (h - text_h) // 2)
    
    draw.text((text_x, text_y), text, font=font, fill=color_rgb)
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
    w = max(10, el.get("w", 200))
    h = max(10, el.get("h", 100))
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
    w = max(20, el.get("w", 100))
    h = max(20, el.get("h", 100))
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
        font_size = max(12, int(h * 0.3))
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
    w = max(20, el.get("w", 100))
    h = max(20, el.get("h", 100))
    icon_id = str(el.get("resolved") or "lucide:sparkles")

    # Resolve accent color for the icon's circle background
    accent_hex = palette.get("accent_color", palette.get("accent", "#f59e0b"))
    if isinstance(accent_hex, list):
        accent_hex = accent_hex[0]
    bg_color = parse_hex_color(str(accent_hex))[:3] + (180,)

    # Create background circle
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw.ellipse([0, 0, w - 1, h - 1], fill=bg_color)

    # Rasterize the actual SVG icon
    from app.services.icon_renderer import rasterize_icon
    icon_size = max(16, int(min(w, h) * 0.55))
    icon_img = rasterize_icon(
        icon_id=icon_id,
        w=icon_size, h=icon_size,
        color="#FFFFFF",
        run_id=run_id,
    )
    if icon_img:
        # Center the icon on the background circle
        ix = (w - icon_size) // 2
        iy = (h - icon_size) // 2
        img.paste(icon_img, (ix, iy), icon_img)

    return img


def render_image_layer(el: Dict, w: int, h: int) -> Image.Image | None:
    url = str(el.get("resolved") or "")
    if not url or not (url.startswith("http") or url.startswith("data:image/")):
        return None
    try:
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
    background_choice: Dict | None = None,
    run_id: str = "",
) -> tuple[str, str]:
    palette = next((p for p in PALETTES if p["id"] == palette_id), PALETTES[0])
    font_pair = next((fp for fp in FONT_PAIRS if fp["id"] == font_pair_id), FONT_PAIRS[0])
    slots = resolve_template_slots(template_id, canvas_w, canvas_h)
    
    # --- Background: photo or gradient ---
    background = None
    if (background_choice
            and background_choice.get("type") == "photo"
            and background_choice.get("pexels_query")):
        from app.services.photo_background import fetch_photo_background
        background = fetch_photo_background(
            pexels_query=background_choice["pexels_query"],
            canvas_w=canvas_w,
            canvas_h=canvas_h,
            run_id=run_id,
        )

    if background is None:
        # Gradient/solid fallback (always works, no network)
        background = render_gradient_background(palette, canvas_w, canvas_h)

    final_image = background.copy()

    
    if overlay_opacity > 0:
        overlay = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, int(overlay_opacity * 255)))
        final_image = Image.alpha_composite(final_image, overlay)
        
    for el in elements:
        el_type = str(el.get("type", "")).lower()
        x, y = int(el.get("x", 0)), int(el.get("y", 0))
        w, h = max(10, int(el.get("w", 200))), max(10, int(el.get("h", 100)))

        if el_type == "text":
            role = el.get("role")
            slot = slots.get(role, {})
            text_layer = render_text(
                text=str(el.get("content", "")),
                x=0, y=0, 
                w=w, h=h,
                font_name=font_pair.get("heading_font", "arial"),
                font_size=int(el.get("font_size", 40)),
                color=str(el.get("color", "#FFFFFF")),
                align=slot.get("align", "left")
            )
            final_image.paste(text_layer, (x, y), text_layer)

        elif el_type == "shape":
            shape_layer = render_shape_layer(el, palette)
            final_image.paste(shape_layer, (x, y), shape_layer)

        elif el_type in ("icon", "emoji"):
            icon_layer = render_icon_or_emoji_layer(el, palette, run_id=run_id)
            final_image.paste(icon_layer, (x, y), icon_layer)

        elif el_type == "badge":
            badge_layer = render_badge_layer(el, palette, font_pair, run_id=run_id)
            if badge_layer:
                final_image.paste(badge_layer, (x, y), badge_layer)

        elif el_type in ("cat_photo", "photo", "library_image", "background_asset") or (el.get("resolved") and str(el.get("resolved")).startswith("http")):
            img_layer = render_image_layer(el, w, h)
            if img_layer:
                final_image.paste(img_layer, (x, y), img_layer)
            
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


