from __future__ import annotations

import base64
import io
import json
import logging
import os
import uuid
import math
from datetime import datetime, timezone

from PIL import Image, ImageDraw, ImageFont, ImageOps
from sqlalchemy.orm import Session
import httpx

from app import models, schemas, design_system_data
from app.config import SUPABASE_URL, SUPABASE_SERVICE_KEY
from app.services.resource_resolver_unified import resolve_resource
from app.services.icon_renderer import rasterize_icon

# On Windows, add the gvsbuild GTK runtime DLLs to PATH so gi/pycairo can find them.
# Download from: https://github.com/wingtk/gvsbuild/releases → GTK3 bundle
_GTK_BIN = os.environ.get("GTK_BIN_PATH") or os.path.join("C:\\", "gtk", "bin")
if os.name == "nt" and os.path.isdir(_GTK_BIN):
    if _GTK_BIN not in os.environ.get("PATH", ""):
        os.environ["PATH"] = _GTK_BIN + os.pathsep + os.environ.get("PATH", "")
    _typellb = os.path.join(os.path.dirname(_GTK_BIN), "lib", "girepository-1.0")
    if os.path.isdir(_typellb) and _typellb not in os.environ.get("GI_TYPELIB_PATH", ""):
        os.environ["GI_TYPELIB_PATH"] = _typellb + os.pathsep + os.environ.get("GI_TYPELIB_PATH", "")

PANGO_AVAILABLE = False
_gi_import_error = None
try:
    import cairo
    import gi
    gi.require_version('Pango', '1.0')
    gi.require_version('PangoCairo', '1.0')
    from gi.repository import Pango, PangoCairo
    PANGO_AVAILABLE = True
except Exception as e:
    print(f"[Warning] Pango not available: {e}. Using PIL fallback for text.")
    _gi_import_error = ImportError(
        "Pango/Cairo dependencies missing. This application requires Pango/Cairo for "
        "proper complex text layout (Bengali ligatures, Arabic shaping, etc.).\n\n"
        "On Windows:\n"
        "  1. Run setup_windows_gtk.ps1 (in the project root) as Administrator:\n"
        "       PowerShell .\\setup_windows_gtk.ps1\n"
        "  2. This downloads the GTK3 runtime from gvsbuild, installs PyGObject/PyCairo,\n"
        "     and adds C:\\gtk\\bin to your system PATH.\n"
        "  3. Alternatively, download manually from:\n"
        "       https://github.com/wingtk/gvsbuild/releases  (GTK3 bundle)\n"
        "     Extract to C:\\gtk and run: .\\setenv_gtk.cmd\n\n"
        "On Linux/Docker:\n"
        "  apt-get install python3-gi python3-gi-cairo gir1.2-pango-1.0 \\\n"
        "      libpango-1.0-0 libcairo2 libcairo2-dev\n\n"
        "Original error: " + str(e)
    )
    cairo = None
    Pango = None
    PangoCairo = None


logger = logging.getLogger(__name__)

_PLACEHOLDER_BY_ROLE = {
    "headline": "Your Headline Here",
    "subheadline": "Supporting text goes here",
    "body": "Body text example",
}

def _get_font_family_name(font_path: str) -> str:
    try:
        from fontTools.ttLib import TTFont
        kwargs = {"fontNumber": 0} if font_path.lower().endswith(".ttc") else {}
        tt = TTFont(font_path, **kwargs)
        for record in tt["name"].names:
            if record.nameID == 1:
                return record.toUnicode()
    except Exception:
        pass
    import os
    name = os.path.splitext(os.path.basename(font_path))[0]
    return name.replace("-", " ").replace("_", " ")

def render_text_layer_pango(
    text: str,
    font_path: str,
    font_size_px: int,
    text_color_hex: str,
    layer_width_px: int,
    layer_height_px: int,
    text_align: str,
    font_weight: str,
    stroke_color_hex: str | None = None,
    stroke_width_px: int = 0,
    highlight_bg_hex: str | None = None,
    fit_mode: str = "fixed"
) -> Image.Image:
    if not PANGO_AVAILABLE:
        print(f"[Info] Using PIL fallback renderer for text: '{text[:40]}...'")
        img = Image.new("RGBA", (layer_width_px, layer_height_px), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)
        font_candidates = [
            font_path,
            "backend/assets/fonts/NotoSansBengali-Regular.ttf",
            "assets/fonts/NotoSansBengali-Regular.ttf",
            "/usr/share/fonts/truetype/noto/NotoSansBengali-Regular.ttf",
            "/usr/share/fonts/opentype/noto/NotoSansBengali-Regular.ttf",
        ]
        
        # Auto-fit with 10% step shrink and ellipsis truncation at 12pt floor
        if fit_mode == "auto_fit":
            def _check_fit(test_text, size_px):
                font_obj = None
                for fp in font_candidates:
                    try:
                        font_obj = ImageFont.truetype(fp, size_px)
                        break
                    except Exception:
                        continue
                if font_obj is None:
                    font_obj = ImageFont.load_default()
                bbox = draw.textbbox((0, 0), test_text, font=font_obj)
                return (bbox[2] - bbox[0], bbox[3] - bbox[1]), font_obj
                
            (tw, th), font_obj = _check_fit(text, font_size_px)
            while (tw > layer_width_px or th > layer_height_px) and font_size_px > 12:
                next_size = int(font_size_px * 0.9)
                if next_size <= 12:
                    font_size_px = 12
                    (tw, th), font_obj = _check_fit(text, font_size_px)
                    break
                font_size_px = next_size
                (tw, th), font_obj = _check_fit(text, font_size_px)
                
            if (tw > layer_width_px or th > layer_height_px) and font_size_px <= 12:
                logger.warning(f"Ellipsis truncation triggered for Prompt Studio text (PIL fallback). Text was too long even at {font_size_px}px floor: '{text}'")
                words = text.split()
                found_fit = False
                if words:
                    for i in range(len(words) - 1, -1, -1):
                        test_t = " ".join(words[:i+1]) + "..."
                        (tw, th), font_obj = _check_fit(test_t, font_size_px)
                        if tw <= layer_width_px and th <= layer_height_px:
                            text = test_t
                            found_fit = True
                            break
                    if not found_fit:
                        first = words[0]
                        for i in range(len(first) - 1, 0, -1):
                            test_t = first[:i] + "..."
                            (tw, th), font_obj = _check_fit(test_t, font_size_px)
                            if tw <= layer_width_px and th <= layer_height_px:
                                text = test_t
                                found_fit = True
                                break
                    if not found_fit:
                        text = "..."
                        _, font_obj = _check_fit(text, font_size_px)
        else:
            font_obj = None
            for fp in font_candidates:
                try:
                    font_obj = ImageFont.truetype(fp, font_size_px)
                    break
                except Exception:
                    continue
            if font_obj is None:
                font_obj = ImageFont.load_default()

        bbox = draw.textbbox((0, 0), text, font=font_obj)
        tw = bbox[2] - bbox[0]
        th = bbox[3] - bbox[1]
        x = max(0, (layer_width_px - tw) // 2) if text_align == 'center' else 0
        y = max(0, (layer_height_px - th) // 2)

        # Highlight Box
        if highlight_bg_hex:
            hr, hg, hb, ha = _parse_hex_color(highlight_bg_hex, default=(255, 255, 0, 255))
            pad_x, pad_y = 8, 4
            hx1, hy1 = max(0, x - pad_x), max(0, y - pad_y)
            hx2, hy2 = min(layer_width_px, x + tw + pad_x), min(layer_height_px, y + th + pad_y)
            draw.rounded_rectangle([hx1, hy1, hx2, hy2], radius=4, fill=(hr, hg, hb, ha))

        # Stroke (PIL fallback: 4 offsets)
        if stroke_width_px > 0 and stroke_color_hex:
            sr, sg, sb, sa = _parse_hex_color(stroke_color_hex, default=(0, 0, 0, 255))
            stroke_fill = (sr, sg, sb, 255)
            for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                draw.text((x + dx * stroke_width_px, y + dy * stroke_width_px), text, font=font_obj, fill=stroke_fill)

        draw.text((x, y), text, font=font_obj, fill=text_color_hex)
        return img

    print(f"[Info] Using Pango/Cairo renderer for text: '{text[:40]}...'")

    surface = cairo.ImageSurface(cairo.FORMAT_ARGB32, layer_width_px, layer_height_px)
    ctx = cairo.Context(surface)
    ctx.set_source_rgba(0, 0, 0, 0)
    ctx.paint()
    
    layout = PangoCairo.create_layout(ctx)
    layout.set_wrap(Pango.WrapMode.WORD_CHAR)
    
    align_map = {
        'center': Pango.Alignment.CENTER,
        'right': Pango.Alignment.RIGHT,
        'left': Pango.Alignment.LEFT
    }
    layout.set_alignment(align_map.get(text_align, Pango.Alignment.LEFT))
    
    custom_family = _get_font_family_name(font_path) if font_path else ""
    fallback_families = [
        "Nirmala UI", "Noto Sans Bengali", "Noto Serif Bengali", "Noto Sans Arabic",
        "Noto Sans Devanagari", "Noto Sans", "Segoe UI", "sans-serif",
    ]
    all_families = ", ".join([custom_family] + fallback_families) if custom_family else ", ".join(fallback_families)
    
    # Auto-fit with 10% step shrink and ellipsis truncation at 12pt floor
    if fit_mode == "auto_fit":
        def _check_fit(test_text, size_px):
            layout.set_text(test_text, -1)
            fd = Pango.FontDescription()
            fd.set_absolute_size(size_px * Pango.SCALE)
            fd.set_weight(Pango.Weight.BOLD if font_weight == 'bold' else Pango.Weight.NORMAL)
            fd.set_family(all_families)
            layout.set_font_description(fd)
            layout.set_width(layer_width_px * Pango.SCALE)
            return layout.get_pixel_size()
            
        tw, th = _check_fit(text, font_size_px)
        while (tw > layer_width_px or th > layer_height_px) and font_size_px > 12:
            next_size = int(font_size_px * 0.9)
            if next_size <= 12:
                font_size_px = 12
                tw, th = _check_fit(text, font_size_px)
                break
            font_size_px = next_size
            tw, th = _check_fit(text, font_size_px)
            
        if (tw > layer_width_px or th > layer_height_px) and font_size_px <= 12:
            logger.warning(f"Ellipsis truncation triggered for Prompt Studio text. Text was too long even at {font_size_px}px floor: '{text}'")
            words = text.split()
            found_fit = False
            if words:
                for i in range(len(words) - 1, -1, -1):
                    test_t = " ".join(words[:i+1]) + "..."
                    tw, th = _check_fit(test_t, font_size_px)
                    if tw <= layer_width_px and th <= layer_height_px:
                        text = test_t
                        found_fit = True
                        break
                if not found_fit:
                    first = words[0]
                    for i in range(len(first) - 1, 0, -1):
                        test_t = first[:i] + "..."
                        tw, th = _check_fit(test_t, font_size_px)
                        if tw <= layer_width_px and th <= layer_height_px:
                            text = test_t
                            found_fit = True
                            break
                if not found_fit:
                    text = "..."
                    _check_fit(text, font_size_px)

    font_desc = Pango.FontDescription()
    font_desc.set_absolute_size(font_size_px * Pango.SCALE)
    font_desc.set_weight(Pango.Weight.BOLD if font_weight == 'bold' else Pango.Weight.NORMAL)
    font_desc.set_family(all_families)
    layout.set_font_description(font_desc)
    layout.set_width(layer_width_px * Pango.SCALE)
    layout.set_text(text, -1)
    
    ink_rect, logical_rect = layout.get_pixel_extents()
    text_width, text_height = logical_rect.width, logical_rect.height
    
    y_offset = max(0, (layer_height_px - text_height) // 2)
    x_offset = 0
    
    # Highlight Box
    if highlight_bg_hex:
        hr, hg, hb, ha = _parse_hex_color(highlight_bg_hex, default=(255, 255, 0, 255))
        pad_x, pad_y = 8, 4
        rx = x_offset + logical_rect.x - pad_x
        ry = y_offset + logical_rect.y - pad_y
        rw = logical_rect.width + pad_x * 2
        rh = logical_rect.height + pad_y * 2
        
        ctx.set_source_rgba(hr/255.0, hg/255.0, hb/255.0, ha/255.0)
        radius = 4
        # approximate rounded rect via path operations
        ctx.move_to(rx + radius, ry)
        ctx.line_to(rx + rw - radius, ry)
        ctx.curve_to(rx + rw, ry, rx + rw, ry, rx + rw, ry + radius)
        ctx.line_to(rx + rw, ry + rh - radius)
        ctx.curve_to(rx + rw, ry + rh, rx + rw, ry + rh, rx + rw - radius, ry + rh)
        ctx.line_to(rx + radius, ry + rh)
        ctx.curve_to(rx, ry + rh, rx, ry + rh, rx, ry + rh - radius)
        ctx.line_to(rx, ry + radius)
        ctx.curve_to(rx, ry, rx, ry, rx + radius, ry)
        ctx.fill()

    ctx.move_to(x_offset, y_offset)

    tr, tg, tb, ta = _parse_hex_color(text_color_hex, default=(255, 255, 255, 255))
    tr, tg, tb = tr/255.0, tg/255.0, tb/255.0

    if stroke_width_px > 0 and stroke_color_hex:
        sr, sg, sb, sa = _parse_hex_color(stroke_color_hex, default=(0, 0, 0, 255))
        PangoCairo.layout_path(ctx, layout)
        ctx.set_source_rgba(sr/255.0, sg/255.0, sb/255.0, sa/255.0)
        ctx.set_line_width(stroke_width_px)
        ctx.stroke_preserve()
        ctx.set_source_rgba(tr, tg, tb, 1.0)
        ctx.fill()
    else:
        ctx.set_source_rgba(tr, tg, tb, 1.0)
        PangoCairo.show_layout(ctx, layout)

    import warnings
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", DeprecationWarning)
        buf = surface.get_data()
    return Image.frombuffer("RGBA", (layer_width_px, layer_height_px), bytes(buf), "raw", "BGRA", 0, 1)

def register_fonts_with_fontconfig():
    fonts_dir = os.path.abspath("assets/fonts")
    if not os.path.isdir(fonts_dir) and os.path.isdir(os.path.abspath("backend/assets/fonts")):
        fonts_dir = os.path.abspath("backend/assets/fonts")
    
    fontconfig_dir = os.path.expanduser("~/.config/fontconfig")
    os.makedirs(fontconfig_dir, exist_ok=True)
    
    conf_path = os.path.join(fontconfig_dir, "fonts.conf")
    conf_content = f"""<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <dir>{fonts_dir}</dir>
</fontconfig>"""
    
    with open(conf_path, 'w') as f:
        f.write(conf_content)
    import subprocess
    if os.name == 'nt':
        print(f"[OK] Fonts registered with fontconfig from {fonts_dir} (skipped fc-cache on Windows)")
        return
    try:
        subprocess.run(['fc-cache', '-f', fonts_dir], capture_output=True)
        print(f"[OK] Fonts registered with fontconfig from {fonts_dir}")
    except Exception as e:
        print(f"[WARNING] Failed to register fonts with fc-cache: {e}")

def verify_pango_bengali():
    if PANGO_AVAILABLE:
        print("[OK] Pango Bengali text rendering working correctly")
    else:
        print("[Warning] Pango not available — using PIL fallback for text rendering")

def _lerp_channel(a: int, b: int, t: float) -> int:
    return int(round(a + (b - a) * t))

def _lerp_hex(c1: str, c2: str, t: float) -> tuple[int, int, int, int]:
    r1, g1, b1, _ = _parse_hex_color(c1, default=(0, 0, 0, 255))
    r2, g2, b2, _ = _parse_hex_color(c2, default=(255, 255, 255, 255))
    return (
        _lerp_channel(r1, r2, t),
        _lerp_channel(g1, g2, t),
        _lerp_channel(b1, b2, t),
        255,
    )

def _render_gradient_background(stops: list[str], canvas_w: int, canvas_h: int) -> Image.Image:
    if not stops:
        return Image.new("RGBA", (canvas_w, canvas_h), (30, 30, 30, 255))
    if len(stops) == 1:
        return Image.new("RGBA", (canvas_w, canvas_h), _parse_hex_color(stops[0], default=(30, 30, 30, 255)))
    img = Image.new("RGBA", (canvas_w, canvas_h))
    pixels = img.load()
    max_y = max(canvas_h - 1, 1)
    seg_count = len(stops) - 1
    for y in range(canvas_h):
        t = y / max_y
        seg = min(int(t * seg_count), seg_count - 1)
        local_t = (t * seg_count) - seg
        color = _lerp_hex(stops[seg], stops[seg + 1], local_t)
        for x in range(canvas_w):
            pixels[x, y] = color
    return img

def _resolve_font_path(font_file_url: str) -> str | None:
    raw = (font_file_url or "").strip()
    if not raw:
        return None
    if os.path.isfile(raw):
        return raw
    candidates = [
        raw,
        os.path.join(os.getcwd(), raw),
        os.path.join(os.path.dirname(__file__), "..", "..", raw),
    ]
    for path in candidates:
        if os.path.isfile(path):
            return path
    return None

def _detect_script(text: str) -> str:
    for char in text or "":
        if char.isspace():
            continue
        cp = ord(char)
        if 0x0980 <= cp <= 0x09FF:
            return "bengali"
        if 0x0600 <= cp <= 0x06FF or 0x0750 <= cp <= 0x077F or 0x08A0 <= cp <= 0x08FF:
            return "arabic"
        if 0x0900 <= cp <= 0x097F:
            return "devanagari"
        if 0x0400 <= cp <= 0x04FF:
            return "cyrillic"
    return "latin"

def _font_candidates_for_script(script: str, weight: str, preferred_font_path: str | None = None) -> list[str]:
    w = (weight or "regular").strip().lower()
    bold = w == "bold"
    candidates: list[str] = []
    if script == "latin" and preferred_font_path:
        candidates.append(preferred_font_path)

    if script == "bengali":
        candidates.extend(
            [
                "backend/assets/fonts/NotoSansBengali-Bold.ttf" if bold else "backend/assets/fonts/NotoSansBengali-Regular.ttf",
                "assets/fonts/NotoSansBengali-Bold.ttf" if bold else "assets/fonts/NotoSansBengali-Regular.ttf",
                "/usr/share/fonts/truetype/noto/NotoSansBengali-Bold.ttf" if bold else "/usr/share/fonts/truetype/noto/NotoSansBengali-Regular.ttf",
                "/usr/share/fonts/opentype/noto/NotoSansBengali-Bold.ttf" if bold else "/usr/share/fonts/opentype/noto/NotoSansBengali-Regular.ttf",
                "C:\\Windows\\Fonts\\Nirmala.ttc",
            ]
        )
    elif script == "arabic":
        candidates.extend(
            [
                "backend/assets/fonts/NotoSansArabic-Bold.ttf" if bold else "backend/assets/fonts/NotoSansArabic-Regular.ttf",
                "assets/fonts/NotoSansArabic-Bold.ttf" if bold else "assets/fonts/NotoSansArabic-Regular.ttf",
                "/usr/share/fonts/truetype/noto/NotoSansArabic-Bold.ttf" if bold else "/usr/share/fonts/truetype/noto/NotoSansArabic-Regular.ttf",
                "/usr/share/fonts/opentype/noto/NotoSansArabic-Bold.ttf" if bold else "/usr/share/fonts/opentype/noto/NotoSansArabic-Regular.ttf",
                "C:\\Windows\\Fonts\\arial.ttf",
            ]
        )
    elif script == "devanagari":
        candidates.extend(
            [
                "backend/assets/fonts/NotoSansDevanagari-Bold.ttf" if bold else "backend/assets/fonts/NotoSansDevanagari-Regular.ttf",
                "assets/fonts/NotoSansDevanagari-Bold.ttf" if bold else "assets/fonts/NotoSansDevanagari-Regular.ttf",
                "/usr/share/fonts/truetype/noto/NotoSansDevanagari-Bold.ttf" if bold else "/usr/share/fonts/truetype/noto/NotoSansDevanagari-Regular.ttf",
                "/usr/share/fonts/opentype/noto/NotoSansDevanagari-Bold.ttf" if bold else "/usr/share/fonts/opentype/noto/NotoSansDevanagari-Regular.ttf",
                "C:\\Windows\\Fonts\\Nirmala.ttc",
                "C:\\Windows\\Fonts\\mangal.ttf",
            ]
        )
    elif script == "cyrillic":
        candidates.extend(
            [
                preferred_font_path or "",
                "backend/assets/fonts/NotoSans-Bold.ttf" if bold else "backend/assets/fonts/NotoSans-Regular.ttf",
                "assets/fonts/NotoSans-Bold.ttf" if bold else "assets/fonts/NotoSans-Regular.ttf",
                "C:\\Windows\\Fonts\\arial.ttf",
            ]
        )
    else:
        candidates.extend(
            [
                preferred_font_path or "",
                "backend/assets/fonts/Roboto-Bold.ttf" if bold else "backend/assets/fonts/Roboto-Regular.ttf",
                "assets/fonts/Roboto-Bold.ttf" if bold else "assets/fonts/Roboto-Regular.ttf",
                "backend/assets/fonts/NotoSans-Bold.ttf" if bold else "backend/assets/fonts/NotoSans-Regular.ttf",
                "assets/fonts/NotoSans-Bold.ttf" if bold else "assets/fonts/NotoSans-Regular.ttf",
                "C:\\Windows\\Fonts\\arialbd.ttf" if bold else "C:\\Windows\\Fonts\\arial.ttf",
            ]
        )

    candidates.extend(
        [
            "backend/assets/fonts/NotoSans-Bold.ttf" if bold else "backend/assets/fonts/NotoSans-Regular.ttf",
            "assets/fonts/NotoSans-Bold.ttf" if bold else "assets/fonts/NotoSans-Regular.ttf",
            "/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf",
            "/usr/share/fonts/opentype/noto/NotoSans-Bold.ttf" if bold else "/usr/share/fonts/opentype/noto/NotoSans-Regular.ttf",
            "C:\\Windows\\Fonts\\Nirmala.ttc",
            "C:\\Windows\\Fonts\\arial.ttf",
        ]
    )
    return [path for path in dict.fromkeys(candidates) if path]

def _get_font_for_text(
    text: str,
    font_asset: models.TemplateFontAsset | None,
    weight: str,
    size_px: int,
) -> tuple[ImageFont.FreeTypeFont | ImageFont.ImageFont, str, str]:
    preferred = _resolve_font_path(font_asset.font_file_url) if font_asset else None
    script = _detect_script(text)
    for candidate in _font_candidates_for_script(script, weight, preferred):
        resolved = _resolve_font_path(candidate)
        if not resolved:
            continue
        try:
            return ImageFont.truetype(resolved, size_px), script, resolved
        except Exception:
            continue
    return _get_font(weight, size_px), script, "PIL default fallback"

def _get_font_for_asset(font_asset: models.TemplateFontAsset | None, weight: str, size_px: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    font, _, _ = _get_font_for_text("", font_asset, weight, size_px)
    return font

async def _load_background_asset_image(
    db: Session,
    user_id: int,
    asset_id: str,
    canvas_w: int,
    canvas_h: int,
) -> Image.Image:
    asset = (
        db.query(models.TemplateBackgroundAsset)
        .filter(
            models.TemplateBackgroundAsset.id == asset_id,
            models.TemplateBackgroundAsset.user_id == user_id,
        )
        .first()
    )
    if not asset:
        return Image.new("RGBA", (canvas_w, canvas_h), (40, 40, 40, 255))

    config = asset.config or {}
    asset_type = str(asset.type or "").lower()

    if asset_type == "solid":
        return Image.new("RGBA", (canvas_w, canvas_h), _parse_hex_color(str(config.get("hex") or ""), default=(40, 40, 40, 255)))
    
    if asset_type == "gradient_linear":
        stops = [str(config.get("from_hex") or "#000000"), str(config.get("to_hex") or "#ffffff")]
        grad_img = _render_gradient_background(stops, canvas_w, canvas_h)
        angle_deg = float(config.get("angle_deg") or 0)
        if abs(angle_deg) > 0.1:
            from PIL import ImageDraw
            diag = int((canvas_w**2 + canvas_h**2)**0.5) + 1
            large_grad = _render_gradient_background(stops, diag, diag)
            rotated = large_grad.rotate(-angle_deg, resample=Image.Resampling.BICUBIC)
            left = (diag - canvas_w) // 2
            top = (diag - canvas_h) // 2
            grad_img = rotated.crop((left, top, left + canvas_w, top + canvas_h))
        return grad_img

    if asset_type == "gradient_radial":
        center_color = _parse_hex_color(str(config.get("center_hex") or "#ffffff"))
        edge_color = _parse_hex_color(str(config.get("edge_hex") or "#000000"))
        
        c1 = f"rgba({center_color[0]},{center_color[1]},{center_color[2]},{center_color[3]})"
        c2 = f"rgba({edge_color[0]},{edge_color[1]},{edge_color[2]},{edge_color[3]})"
        
        # Use simple pure PIL hack or ImageDraw
        # Create a large radial gradient by drawing concentric circles
        diag = int((canvas_w**2 + canvas_h**2)**0.5) + 1
        img = Image.new("RGBA", (canvas_w, canvas_h), edge_color)
        from PIL import ImageDraw
        draw = ImageDraw.Draw(img)
        cx, cy = canvas_w // 2, canvas_h // 2
        r_max = diag // 2
        
        # Drawing 100 circles for gradient (not perfectly smooth but pure PIL)
        # Or better: generate RGBA using a bytearray in pure python
        arr = bytearray(canvas_w * canvas_h * 4)
        r_c, g_c, b_c, a_c = center_color
        r_e, g_e, b_e, a_e = edge_color
        r_d, g_d, b_d, a_d = r_e - r_c, g_e - g_c, b_e - b_c, a_e - a_c
        
        idx = 0
        for y in range(canvas_h):
            dy = y - cy
            dy2 = dy * dy
            for x in range(canvas_w):
                dx = x - cx
                dist = (dx * dx + dy2)**0.5
                t = min(1.0, dist / r_max)
                arr[idx:idx+4] = [
                    int(r_c + r_d * t),
                    int(g_c + g_d * t),
                    int(b_c + b_d * t),
                    int(a_c + a_d * t)
                ]
                idx += 4
        return Image.frombytes("RGBA", (canvas_w, canvas_h), bytes(arr))

    if asset_type == "image":
        image_url = config.get("url") or asset.preview_url
        if image_url:
            blob = await _download_bytes(str(image_url))
            if blob:
                img = Image.open(io.BytesIO(blob)).convert("RGBA")
                fit = config.get("fit") or "cover"
                if fit == "cover":
                    from PIL import ImageOps
                    img = ImageOps.fit(img, (canvas_w, canvas_h), Image.Resampling.LANCZOS)
                else:
                    img = img.resize((canvas_w, canvas_h), Image.Resampling.LANCZOS)
                return img
    
    return Image.new("RGBA", (canvas_w, canvas_h), _parse_hex_color(str(config.get("hex") or ""), default=(40, 40, 40, 255)))

def _layer_rotation_degrees(layer: dict) -> float | None:
    raw = layer.get("rotation_degrees")
    if raw is None:
        return None
    try:
        deg = float(raw)
    except (TypeError, ValueError):
        return None
    if abs(deg) < 0.01:
        return None
    return deg

def _composite_layer_onto_base(
    base: Image.Image,
    layer_img: Image.Image,
    x: int,
    y: int,
    w: int,
    h: int,
    rotation_degrees: float | None,
    opacity: float = 100.0,
) -> Image.Image:
    """Paste layer content onto base, optionally rotating around the layer box center, and applying opacity."""
    canvas_w, canvas_h = base.size
    content = layer_img.convert("RGBA")
    
    if opacity < 100.0:
        # Multiply alpha channel by opacity/100
        alpha = content.getchannel("A")
        alpha = alpha.point(lambda p: int(p * (opacity / 100.0)))
        content.putalpha(alpha)

    if content.size != (w, h) and w > 0 and h > 0:
        content = content.resize((w, h), Image.Resampling.LANCZOS)

    layer_canvas = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
    if rotation_degrees is not None:
        rotated = content.rotate(-rotation_degrees, resample=Image.Resampling.BICUBIC, expand=True)
        cx = x + w // 2
        cy = y + h // 2
        paste_x = cx - rotated.width // 2
        paste_y = cy - rotated.height // 2
        layer_canvas.paste(rotated, (paste_x, paste_y), rotated)
    else:
        layer_canvas.paste(content, (x, y), content)
    return Image.alpha_composite(base, layer_canvas)

def _assemble_manual_template_preview(
    template_json: dict,
    background: Image.Image,
    logo_bytes: bytes | None,
    font_assets: dict[str, models.TemplateFontAsset],
) -> bytes:
    canvas_w = int(template_json.get("canvas_width") or 1024)
    canvas_h = int(template_json.get("canvas_height") or 1024)
    base = background.convert("RGBA").resize((canvas_w, canvas_h), Image.Resampling.LANCZOS)
    logo_img = Image.open(io.BytesIO(logo_bytes)).convert("RGBA") if logo_bytes else None

    layers = sorted(template_json.get("layers") or [], key=lambda layer: int(layer.get("z_index") or 0))
    for layer in layers:
        layer_type = str(layer.get("type") or "").lower()
        x = _pct(float(layer.get("position_x_percent") or 0), canvas_w)
        y = _pct(float(layer.get("position_y_percent") or 0), canvas_h)
        w = _pct(float(layer.get("width_percent") or 100), canvas_w)
        h = _pct(float(layer.get("height_percent") or 100), canvas_h)
        if w <= 0 or h <= 0:
            continue

        rotation = _layer_rotation_degrees(layer)

        if layer_type == "overlay":
            color_opts = layer.get("color_options") or []
            if not color_opts:
                continue
            opt = color_opts[0]
            r, g, b, _ = _parse_hex_color(str(opt.get("color_hex") or ""), default=(0, 0, 0, 255))
            opacity = max(0.0, min(1.0, float(opt.get("opacity") if opt.get("opacity") is not None else 0.35)))
            overlay = Image.new("RGBA", (w, h), (r, g, b, int(round(opacity * 255))))
            base = _composite_layer_onto_base(base, overlay, x, y, w, h, rotation)
        elif layer_type == "logo" and logo_img is not None:
            img_box = _fit_within(logo_img, w, h)
            base = _composite_layer_onto_base(base, img_box, x, y, w, h, rotation)
        elif layer_type == "shape":
            from PIL import ImageDraw
            shape_type = str(layer.get("shape_type") or "rectangle").lower()
            fill_hex = str(_first_option(layer.get("fill_color_options") or [], "color_hex") or "#ffffff")
            fr, fg, fb, _ = _parse_hex_color(fill_hex, default=(255, 255, 255, 255))
            
            stroke_width = int(layer.get("stroke_width") or 0)
            stroke_color = None
            if stroke_width > 0:
                stroke_hex = str(_first_option(layer.get("stroke_color_options") or [], "color_hex") or "#000000")
                sr, sg, sb, _ = _parse_hex_color(stroke_hex, default=(0, 0, 0, 255))
                stroke_color = (sr, sg, sb, 255)
                
            shape_img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
            draw = ImageDraw.Draw(shape_img)
            
            # Anti-aliasing scaling
            aa_scale = 4
            big_w, big_h = w * aa_scale, h * aa_scale
            big_img = Image.new("RGBA", (big_w, big_h), (0, 0, 0, 0))
            big_draw = ImageDraw.Draw(big_img)
            big_stroke_width = stroke_width * aa_scale
            
            if shape_type == "circle":
                big_draw.ellipse([0, 0, big_w - 1, big_h - 1], fill=(fr, fg, fb, 255), outline=stroke_color, width=big_stroke_width)
            elif shape_type == "pill":
                big_draw.rounded_rectangle([0, 0, big_w - 1, big_h - 1], radius=min(big_w, big_h) // 2, fill=(fr, fg, fb, 255), outline=stroke_color, width=big_stroke_width)
            else: # rectangle
                cr = int(layer.get("corner_radius") or 0) * aa_scale
                if cr > 0:
                    big_draw.rounded_rectangle([0, 0, big_w - 1, big_h - 1], radius=cr, fill=(fr, fg, fb, 255), outline=stroke_color, width=big_stroke_width)
                else:
                    big_draw.rectangle([0, 0, big_w - 1, big_h - 1], fill=(fr, fg, fb, 255), outline=stroke_color, width=big_stroke_width)
                    
            shape_img = big_img.resize((w, h), Image.Resampling.LANCZOS)
            
            layer_opacity = 100.0
            if layer.get("opacity") is not None:
                try:
                    layer_opacity = float(layer["opacity"])
                except (TypeError, ValueError):
                    pass
            base = _composite_layer_onto_base(base, shape_img, x, y, w, h, rotation, opacity=layer_opacity)
        elif layer_type == "divider":
            from PIL import ImageDraw
            import math
            
            orientation = str(layer.get("orientation") or "horizontal").lower()
            color_hex = str(_first_option(layer.get("color_options") or [], "color_hex") or "#ffffff")
            cr, cg, cb, _ = _parse_hex_color(color_hex, default=(255, 255, 255, 255))
            
            thickness = int(layer.get("thickness_px") or 2)
            
            # Start and width percentages
            x_start_pct = float(layer.get("x_start_pct") or 0)
            width_pct = float(layer.get("width_pct") or 100)
            y_pct = float(layer.get("y_pct") or 50)
            
            x_start_px = int(round((x_start_pct / 100.0) * canvas_w))
            line_w_px = int(round((width_pct / 100.0) * canvas_w))
            y_px = int(round((y_pct / 100.0) * canvas_h))
            
            x_end_px = x_start_px + line_w_px
            y_end_px = y_px
            
            if orientation == "diagonal":
                angle_deg = float(layer.get("angle_deg") or 0)
                # calculate vertical drop based on angle
                drop = int(round(math.tan(math.radians(angle_deg)) * line_w_px))
                y_end_px += drop
                
            divider_img = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
            draw = ImageDraw.Draw(divider_img)
            
            # Antialiasing scaling
            aa_scale = 4
            big_canvas_w, big_canvas_h = canvas_w * aa_scale, canvas_h * aa_scale
            big_img = Image.new("RGBA", (big_canvas_w, big_canvas_h), (0, 0, 0, 0))
            big_draw = ImageDraw.Draw(big_img)
            
            p1 = (x_start_px * aa_scale, y_px * aa_scale)
            p2 = (x_end_px * aa_scale, y_end_px * aa_scale)
            big_draw.line([p1, p2], fill=(cr, cg, cb, 255), width=thickness * aa_scale)
            
            divider_img = big_img.resize((canvas_w, canvas_h), Image.Resampling.LANCZOS)
            
            layer_opacity = 100.0
            if layer.get("opacity") is not None:
                try:
                    layer_opacity = float(layer["opacity"])
                except (TypeError, ValueError):
                    pass
            base = _composite_layer_onto_base(base, divider_img, 0, 0, canvas_w, canvas_h, rotation, opacity=layer_opacity)
        elif layer_type in ("icon", "emoji"):
            description = str(layer.get("description") or "star")
            res = resolve_resource(asset_type=layer_type, description=description)
            resolved_id = res.get("resolved")
            if not resolved_id:
                continue
            color_hex = str(_first_option(layer.get("color_options") or [], "color_hex") or "#ffffff")
            img = rasterize_icon(resolved_id, w, h, color=color_hex)
            layer_opacity = 100.0
            if layer.get("opacity") is not None:
                try:
                    layer_opacity = float(layer["opacity"])
                except:
                    pass
            if img:
                base = _composite_layer_onto_base(base, img, x, y, w, h, rotation, opacity=layer_opacity)
        elif layer_type == "badge":
            badge_text = str(layer.get("badge_text") or "Badge")
            badge_icon_desc = str(layer.get("badge_icon") or "star")
            res = resolve_resource(asset_type="icon", description=badge_icon_desc)
            resolved_id = res.get("resolved")
            if not resolved_id:
                continue
            from PIL import ImageDraw
            shape_type = str(layer.get("shape_type") or "pill").lower()
            fill_hex = str(_first_option(layer.get("fill_color_options") or [], "color_hex") or "#ffffff")
            fr, fg, fb, _ = _parse_hex_color(fill_hex, default=(255, 255, 255, 255))
            aa_scale = 4
            big_w, big_h = w * aa_scale, h * aa_scale
            big_img = Image.new("RGBA", (big_w, big_h), (0, 0, 0, 0))
            big_draw = ImageDraw.Draw(big_img)
            if shape_type == "pill":
                big_draw.rounded_rectangle([0, 0, big_w - 1, big_h - 1], radius=min(big_w, big_h) // 2, fill=(fr, fg, fb, 255))
            else:
                cr = int(layer.get("corner_radius") or 0) * aa_scale
                if cr > 0:
                    big_draw.rounded_rectangle([0, 0, big_w - 1, big_h - 1], radius=cr, fill=(fr, fg, fb, 255))
                else:
                    big_draw.rectangle([0, 0, big_w - 1, big_h - 1], fill=(fr, fg, fb, 255))
            shape_img = big_img.resize((w, h), Image.Resampling.LANCZOS)
            
            icon_color = str(_first_option(layer.get("icon_color_options") or [], "color_hex") or "#000000")
            icon_size = int(h * 0.6)
            icon_img = rasterize_icon(resolved_id, icon_size, icon_size, color=icon_color)
            if icon_img:
                ix = int(w * 0.1)
                iy = (h - icon_size) // 2
                shape_img.paste(icon_img, (ix, iy), icon_img)
                
            layer_opacity = 100.0
            if layer.get("opacity") is not None:
                try:
                    layer_opacity = float(layer["opacity"])
                except:
                    pass
            base = _composite_layer_onto_base(base, shape_img, x, y, w, h, rotation, opacity=layer_opacity)
        elif layer_type == "text":
            role = str(layer.get("role") or "body").lower()
            text_str = _PLACEHOLDER_BY_ROLE.get(role, _PLACEHOLDER_BY_ROLE["body"])
            font_opts = layer.get("font_options") or []
            color_opts = layer.get("color_options") or []
            if not font_opts or not color_opts:
                continue
            font_id = str(font_opts[0].get("font_asset_id") or "")
            font_asset = font_assets.get(font_id)
            min_pct = float(layer.get("font_size_min_percent") or 4.0)
            max_pct = float(layer.get("font_size_max_percent") or 7.0)
            font_px = max(10, int(round(((min_pct + max_pct) / 2.0) * canvas_h / 100.0)))
            weight = str(layer.get("font_weight") or (font_asset.weight if font_asset else "regular"))
            _, script, font_path_used = _get_font_for_text(text_str, font_asset, weight, font_px)
            color_hex = str(color_opts[0].get("color_hex") or "#ffffff")
            align_opts = layer.get("text_align_options") or ["center"]
            align = str(align_opts[0] if align_opts else "center").strip().lower()
            
            stroke_color_hex = str(layer.get("stroke_color_hex") or "") if layer.get("stroke_color_hex") else None
            stroke_width_px = int(layer.get("stroke_width_px") or 0)
            highlight_bg_hex = str(layer.get("highlight_bg_hex") or "") if layer.get("highlight_bg_hex") else None
            fit_mode = str(layer.get("fit_mode") or "fixed")

            text_layer = render_text_layer_pango(
                text=text_str,
                font_path=font_path_used,
                font_size_px=font_px,
                text_color_hex=color_hex,
                layer_width_px=w,
                layer_height_px=h,
                text_align=align,
                font_weight=weight,
                stroke_color_hex=stroke_color_hex,
                stroke_width_px=stroke_width_px,
                highlight_bg_hex=highlight_bg_hex,
                fit_mode=fit_mode
            )
            logger.info(
                'Text layer %s: script=%s font=%s size=%spx text="%s"',
                str(layer.get("id") or "preview"),
                script,
                font_path_used,
                font_px,
                text_str[:30],
            )
            base = _composite_layer_onto_base(base, text_layer, x, y, w, h, rotation)

    out = io.BytesIO()
    base.convert("RGB").save(out, format="PNG")
    return out.getvalue()

def _pct(value: float, total: int) -> int:
    return int(round((float(value) / 100.0) * total))

def _parse_hex_color(value: str | None, *, default=(0, 0, 0, 0)) -> tuple[int, int, int, int]:
    if not value:
        return default
    s = value.strip()
    if not s.startswith("#"):
        s = f"#{s}"
    if len(s) == 7:
        r = int(s[1:3], 16)
        g = int(s[3:5], 16)
        b = int(s[5:7], 16)
        return (r, g, b, 255)
    return default

def _srgb_to_linear(c: float) -> float:
    """Convert a single sRGB channel value (0-1) to linear light."""
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

def _relative_luminance(r: int, g: int, b: int) -> float:
    """Calculate WCAG relative luminance from 8-bit RGB values."""
    r_lin = _srgb_to_linear(r / 255.0)
    g_lin = _srgb_to_linear(g / 255.0)
    b_lin = _srgb_to_linear(b / 255.0)
    return 0.2126 * r_lin + 0.7152 * g_lin + 0.0722 * b_lin

def analyze_zone_luminance(
    background_image: "Image.Image",
    x_pct: float,
    y_pct: float,
    width_pct: float,
    height_pct: float,
) -> dict:
    """
    Analyze the luminance of a rectangular zone in a background image.

    Parameters are percentages (0-100) of the canvas dimensions.
    Returns a dict with:
      - "category": "light" | "dark"
      - "avg_color": (r, g, b) average pixel color of the zone
      - "luminance": float relative luminance (0-1)
    """
    try:
        img_w, img_h = background_image.size
        x1 = max(0, int(round(x_pct / 100.0 * img_w)))
        y1 = max(0, int(round(y_pct / 100.0 * img_h)))
        x2 = min(img_w, int(round((x_pct + width_pct) / 100.0 * img_w)))
        y2 = min(img_h, int(round((y_pct + height_pct) / 100.0 * img_h)))

        if x2 <= x1 or y2 <= y1:
            return {"category": "dark", "avg_color": (0, 0, 0), "luminance": 0.0}

        region = background_image.crop((x1, y1, x2, y2)).convert("RGB")
        pixels = list(region.getdata())
        n = len(pixels)
        if n == 0:
            return {"category": "dark", "avg_color": (0, 0, 0), "luminance": 0.0}

        avg_r = int(sum(p[0] for p in pixels) / n)
        avg_g = int(sum(p[1] for p in pixels) / n)
        avg_b = int(sum(p[2] for p in pixels) / n)
        L = _relative_luminance(avg_r, avg_g, avg_b)
        category = "light" if L > 0.35 else "dark"
        return {"category": category, "avg_color": (avg_r, avg_g, avg_b), "luminance": L}
    except Exception as exc:
        print(f"[WARN] analyze_zone_luminance failed: {exc}")
        return {"category": "dark", "avg_color": (0, 0, 0), "luminance": 0.0}

def _calculate_contrast_ratio(hex_color: str, bg_rgb: tuple) -> float:
    """
    Calculate WCAG contrast ratio between a foreground hex color and a background RGB tuple.
    Returns the ratio (1-21). Higher is more contrast.
    """
    try:
        r, g, b, _ = _parse_hex_color(hex_color, default=(255, 255, 255, 255))
        L_fg = _relative_luminance(r, g, b)
        L_bg = _relative_luminance(bg_rgb[0], bg_rgb[1], bg_rgb[2])
        lighter = max(L_fg, L_bg)
        darker = min(L_fg, L_bg)
        return (lighter + 0.05) / (darker + 0.05)
    except Exception:
        return 1.0

def _get_font(weight: str, size_px: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates: list[str] = []
    w = (weight or "regular").strip().lower()
    if w == "bold":
        candidates.extend(
            [
                "backend/assets/fonts/Roboto-Bold.ttf",
                "assets/fonts/Roboto-Bold.ttf",
                "C:\\Windows\\Fonts\\arialbd.ttf",
                "C:\\Windows\\Fonts\\arial.ttf",
            ]
        )
    else:
        candidates.extend(
            [
                "backend/assets/fonts/Roboto-Regular.ttf",
                "assets/fonts/Roboto-Regular.ttf",
                "C:\\Windows\\Fonts\\arial.ttf",
            ]
        )
    for path in candidates:
        try:
            return ImageFont.truetype(path, size_px)
        except Exception:
            continue
    return ImageFont.load_default()

def _fit_within(img: Image.Image, target_w: int, target_h: int) -> Image.Image:
    if target_w <= 0 or target_h <= 0:
        return Image.new("RGBA", (max(target_w, 1), max(target_h, 1)), (0, 0, 0, 0))
    src_w, src_h = img.size
    scale = min(target_w / src_w, target_h / src_h)
    new_w = max(1, int(round(src_w * scale)))
    new_h = max(1, int(round(src_h * scale)))
    resized = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
    out = Image.new("RGBA", (target_w, target_h), (0, 0, 0, 0))
    out.paste(resized, ((target_w - new_w) // 2, (target_h - new_h) // 2), resized)
    return out

async def _download_bytes(url: str | None) -> bytes | None:
    if not url:
        return None
    async with httpx.AsyncClient(timeout=45) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        return resp.content

def _first_option(options: list, key: str):
    if not options:
        return None
    return options[0].get(key) if isinstance(options[0], dict) else None

def _merge_llm_instructions_with_overrides(
    llm_instructions: dict,
    layer_overrides: list[dict] | None,
) -> dict:
    if not layer_overrides:
        return llm_instructions
    merged = {
        "chosen_background_asset_id": llm_instructions.get("chosen_background_asset_id"),
        "layers": [dict(layer) for layer in llm_instructions.get("layers") or []],
    }
    by_id = {str(layer.get("layer_id")): layer for layer in merged["layers"]}
    for override in layer_overrides or []:
        layer_id = str(override.get("layer_id") or "").strip()
        if not layer_id and override.get("layer_index") is not None:
            continue
        if layer_id not in by_id:
            continue
        target = by_id[layer_id]
        if override.get("text") is not None or override.get("new_text") is not None:
            target["text"] = str(override.get("new_text") or override.get("text") or target.get("text") or "")
        for key in ("font_asset_id", "color_hex", "font_size_percent", "text_align", "opacity"):
            if override.get(key) is not None:
                target[key] = override[key]
    return merged

import copy

def _apply_composition_validation(
    template_json: dict,
    instructions: dict,
    background_img: Image.Image,
    canvas_w: int,
    canvas_h: int,
    font_assets: dict
) -> tuple[dict, dict]:
    from app.services.composition_validator import (
        run_contrast_check,
        run_text_fit_check,
        run_safe_zone_check,
        run_overlap_check
    )
    
    t_json = copy.deepcopy(template_json)
    instr = copy.deepcopy(instructions)
    
    bg_color = "#ffffff"
    try:
        if background_img:
            r, g, b = background_img.convert("RGB").resize((1, 1)).getpixel((0, 0))
            bg_color = f"#{r:02x}{g:02x}{b:02x}"
    except Exception:
        pass
        
    overlay_opacity = 0.35
    overlay_color = "#000000"
    
    element_to_instr = []
    elements = []
    layer_map = {str(layer.get("id")): layer for layer in t_json.get("layers", [])}
    
    for layer in t_json.get("layers", []):
        layer_id = str(layer.get("id"))
        layer_type = str(layer.get("type", "")).lower()
        
        i_layer = next((i for i in instr.get("layers", []) if str(i.get("layer_id")) == layer_id), {})
        
        if layer_type == "overlay":
            try:
                overlay_opacity = float(i_layer.get("opacity") if i_layer.get("opacity") is not None else layer.get("color_options", [{}])[0].get("opacity", 0.35))
                overlay_color = str(i_layer.get("color_hex") or layer.get("color_options", [{}])[0].get("color_hex") or "#000000")
            except Exception:
                pass
            continue
            
        x = _pct(float(layer.get("position_x_percent") or 0), canvas_w)
        y = _pct(float(layer.get("position_y_percent") or 0), canvas_h)
        w = _pct(float(layer.get("width_percent") or 100), canvas_w)
        h = _pct(float(layer.get("height_percent") or 100), canvas_h)
        
        el_type = "shape" if layer_type in ("icon", "emoji", "badge", "shape") else layer_type
        
        el = {
            "id": layer_id,
            "type": el_type,
            "x": x,
            "y": y,
            "w": w,
            "h": h,
            "role": str(layer.get("role", "")),
        }
        
        if el_type == "text":
            el["content"] = str(i_layer.get("text") or layer.get("text") or "")
            el["color"] = str(i_layer.get("color_hex") or layer.get("text_color_hex") or "#ffffff")
            
            min_pct = float(layer.get("font_size_min_percent") or 4.0)
            max_pct = float(layer.get("font_size_max_percent") or 7.0)
            fs_pct = i_layer.get("font_size_percent")
            if fs_pct is None:
                fs_pct = (min_pct + max_pct) / 2.0
            else:
                fs_pct = float(fs_pct)
            el["font_size"] = max(10, int(round(fs_pct * canvas_h / 100.0)))
            
            font_id = str(i_layer.get("font_asset_id") or "")
            font_asset = font_assets.get(font_id)
            weight = str(layer.get("font_weight") or (font_asset.weight if font_asset else "regular"))
            
            # Use actual resolved local font path for composition validator
            _, _, font_path_used = _get_font_for_text(el["content"], font_asset, weight, el["font_size"])
            el["font_name"] = font_path_used
            
        elements.append(el)
        element_to_instr.append((el, i_layer, layer))
        
    run_overlap_check(elements)
    run_safe_zone_check(elements, canvas_w, canvas_h)
    run_text_fit_check(elements)
    
    # We must patch text layers before contrast check so text color swaps use correct font info?
    # No, contrast check just uses text color and background color
    new_overlay_opacity = run_contrast_check(elements, background_color=bg_color, overlay_opacity=overlay_opacity, overlay_color=overlay_color)
    
    for el, i_layer, layer in element_to_instr:
        if el["type"] == "text":
            i_layer["text"] = el["content"]
            i_layer["color_hex"] = el["color"]
            i_layer["font_size_percent"] = (el["font_size"] / canvas_h) * 100.0
            
            layer["position_x_percent"] = (el["x"] / canvas_w) * 100.0
            layer["position_y_percent"] = (el["y"] / canvas_h) * 100.0
            layer["width_percent"] = (el["w"] / canvas_w) * 100.0
            layer["height_percent"] = (el["h"] / canvas_h) * 100.0
        elif el["type"] == "shape":
            layer["position_x_percent"] = (el["x"] / canvas_w) * 100.0
            layer["position_y_percent"] = (el["y"] / canvas_h) * 100.0
            
    for i_layer in instr.get("layers", []):
        if i_layer.get("layer_id") and layer_map.get(str(i_layer["layer_id"]), {}).get("type") == "overlay":
            i_layer["opacity"] = new_overlay_opacity
            
    return t_json, instr

def _image_to_png_bytes(image: Image.Image) -> bytes:
    out = io.BytesIO()
    image.convert("RGB").save(out, format="PNG")
    return out.getvalue()

def _assemble_from_llm_instructions(
    template_json: dict,
    background: Image.Image,
    logo_bytes: bytes | None,
    llm_instructions: dict,
    db: Session,
    user_id: int,
    layer_overrides: list[dict] | None = None,
) -> bytes:
    instructions = _merge_llm_instructions_with_overrides(llm_instructions, layer_overrides)
    layer_map = {
        str(item.get("layer_id")): item for item in instructions.get("layers") or [] if item.get("layer_id")
    }

    font_ids: set[str] = set()
    for item in layer_map.values():
        fid = str(item.get("font_asset_id") or "").strip()
        if fid:
            font_ids.add(fid)
    font_assets: dict[str, models.TemplateFontAsset] = {}
    if font_ids:
        rows = (
            db.query(models.TemplateFontAsset)
            .filter(
                models.TemplateFontAsset.user_id == user_id,
                models.TemplateFontAsset.id.in_(font_ids),
            )
            .all()
        )
        font_assets = {row.id: row for row in rows}

    canvas_w = int(template_json.get("canvas_width") or 1024)
    canvas_h = int(template_json.get("canvas_height") or 1024)
    base = background.convert("RGBA").resize((canvas_w, canvas_h), Image.Resampling.LANCZOS)
    logo_img = Image.open(io.BytesIO(logo_bytes)).convert("RGBA") if logo_bytes else None

    template_json, instructions = _apply_composition_validation(
        template_json, instructions, base, canvas_w, canvas_h, font_assets
    )
    
    layer_map = {
        str(item.get("layer_id")): item for item in instructions.get("layers") or [] if item.get("layer_id")
    }

    layers = sorted(template_json.get("layers") or [], key=lambda layer: int(layer.get("z_index") or 0))
    for layer in layers:
        layer_id = str(layer.get("id") or "")
        layer_type = str(layer.get("type") or "").lower()
        x = _pct(float(layer.get("position_x_percent") or 0), canvas_w)
        y = _pct(float(layer.get("position_y_percent") or 0), canvas_h)
        w = _pct(float(layer.get("width_percent") or 100), canvas_w)
        h = _pct(float(layer.get("height_percent") or 100), canvas_h)
        if w <= 0 or h <= 0:
            continue

        rotation = _layer_rotation_degrees(layer)
        instr = layer_map.get(layer_id, {})
        
        # Determine global layer opacity (0-100)
        layer_opacity = 100.0
        if "opacity" in instr and instr.get("opacity") is not None:
            try:
                layer_opacity = float(instr["opacity"])
            except (TypeError, ValueError):
                pass
        elif "opacity" in layer and layer.get("opacity") is not None:
            try:
                layer_opacity = float(layer["opacity"])
            except (TypeError, ValueError):
                pass
        layer_opacity = max(0.0, min(100.0, layer_opacity))

        if layer_type == "overlay":
            color_hex = str(instr.get("color_hex") or _first_option(layer.get("color_options") or [], "color_hex") or "#000000")
            try:
                # the overlay color option opacity is separate (0-1.0)
                color_opacity = float(
                    (layer.get("color_options") or [{}])[0].get("opacity")
                    if layer.get("color_options")
                    else 0.35
                )
            except (TypeError, ValueError):
                color_opacity = 0.35
            r, g, b, _ = _parse_hex_color(color_hex, default=(0, 0, 0, 255))
            color_opacity = max(0.0, min(1.0, color_opacity))
            overlay = Image.new("RGBA", (w, h), (r, g, b, int(round(color_opacity * 255))))
            base = _composite_layer_onto_base(base, overlay, x, y, w, h, rotation, opacity=layer_opacity)
        elif layer_type == "logo" and logo_img is not None:
            img_box = _fit_within(logo_img, w, h)
            base = _composite_layer_onto_base(base, img_box, x, y, w, h, rotation, opacity=layer_opacity)
        elif layer_type == "shape":
            from PIL import ImageDraw
            shape_type = str(layer.get("shape_type") or "rectangle").lower()
            fill_hex = str(instr.get("fill_color_hex") or _first_option(layer.get("fill_color_options") or [], "color_hex") or "#ffffff")
            fr, fg, fb, _ = _parse_hex_color(fill_hex, default=(255, 255, 255, 255))
            
            stroke_width = int(layer.get("stroke_width") or 0)
            stroke_color = None
            if stroke_width > 0:
                stroke_hex = str(instr.get("stroke_color_hex") or _first_option(layer.get("stroke_color_options") or [], "color_hex") or "#000000")
                sr, sg, sb, _ = _parse_hex_color(stroke_hex, default=(0, 0, 0, 255))
                stroke_color = (sr, sg, sb, 255)
            
            shape_img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
            draw = ImageDraw.Draw(shape_img)
            
            # Anti-aliasing scaling
            aa_scale = 4
            big_w, big_h = w * aa_scale, h * aa_scale
            big_img = Image.new("RGBA", (big_w, big_h), (0, 0, 0, 0))
            big_draw = ImageDraw.Draw(big_img)
            big_stroke_width = stroke_width * aa_scale
            
            if shape_type == "circle":
                big_draw.ellipse([0, 0, big_w - 1, big_h - 1], fill=(fr, fg, fb, 255), outline=stroke_color, width=big_stroke_width)
            elif shape_type == "pill":
                big_draw.rounded_rectangle([0, 0, big_w - 1, big_h - 1], radius=min(big_w, big_h) // 2, fill=(fr, fg, fb, 255), outline=stroke_color, width=big_stroke_width)
            else: # rectangle
                cr = int(layer.get("corner_radius") or 0) * aa_scale
                if cr > 0:
                    big_draw.rounded_rectangle([0, 0, big_w - 1, big_h - 1], radius=cr, fill=(fr, fg, fb, 255), outline=stroke_color, width=big_stroke_width)
                else:
                    big_draw.rectangle([0, 0, big_w - 1, big_h - 1], fill=(fr, fg, fb, 255), outline=stroke_color, width=big_stroke_width)
                    
            shape_img = big_img.resize((w, h), Image.Resampling.LANCZOS)
            base = _composite_layer_onto_base(base, shape_img, x, y, w, h, rotation, opacity=layer_opacity)
        elif layer_type == "divider":
            from PIL import ImageDraw
            import math
            
            orientation = str(layer.get("orientation") or "horizontal").lower()
            color_hex = str(instr.get("color_hex") or _first_option(layer.get("color_options") or [], "color_hex") or "#ffffff")
            cr, cg, cb, _ = _parse_hex_color(color_hex, default=(255, 255, 255, 255))
            
            thickness = int(layer.get("thickness_px") or 2)
            
            # Start and width percentages
            x_start_pct = float(layer.get("x_start_pct") or 0)
            width_pct = float(layer.get("width_pct") or 100)
            y_pct = float(layer.get("y_pct") or 50)
            
            x_start_px = int(round((x_start_pct / 100.0) * canvas_w))
            line_w_px = int(round((width_pct / 100.0) * canvas_w))
            y_px = int(round((y_pct / 100.0) * canvas_h))
            
            x_end_px = x_start_px + line_w_px
            y_end_px = y_px
            
            if orientation == "diagonal":
                angle_deg = float(layer.get("angle_deg") or 0)
                # calculate vertical drop based on angle
                drop = int(round(math.tan(math.radians(angle_deg)) * line_w_px))
                y_end_px += drop
                
            divider_img = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
            draw = ImageDraw.Draw(divider_img)
            
            # Antialiasing scaling
            aa_scale = 4
            big_canvas_w, big_canvas_h = canvas_w * aa_scale, canvas_h * aa_scale
            big_img = Image.new("RGBA", (big_canvas_w, big_canvas_h), (0, 0, 0, 0))
            big_draw = ImageDraw.Draw(big_img)
            
            p1 = (x_start_px * aa_scale, y_px * aa_scale)
            p2 = (x_end_px * aa_scale, y_end_px * aa_scale)
            big_draw.line([p1, p2], fill=(cr, cg, cb, 255), width=thickness * aa_scale)
            
            divider_img = big_img.resize((canvas_w, canvas_h), Image.Resampling.LANCZOS)
            base = _composite_layer_onto_base(base, divider_img, 0, 0, canvas_w, canvas_h, rotation, opacity=layer_opacity)
        elif layer_type in ("icon", "emoji"):
            description = str(instr.get("description") or layer.get("description") or "star")
            res = resolve_resource(asset_type=layer_type, description=description)
            resolved_id = res.get("resolved")
            if not resolved_id:
                continue
            color_hex = str(instr.get("color_hex") or _first_option(layer.get("color_options") or [], "color_hex") or "#ffffff")
            img = rasterize_icon(resolved_id, w, h, color=color_hex)
            if img:
                base = _composite_layer_onto_base(base, img, x, y, w, h, rotation, opacity=layer_opacity)
        elif layer_type == "badge":
            badge_text = str(instr.get("badge_text") or layer.get("badge_text") or "Badge")
            badge_icon_desc = str(instr.get("badge_icon") or layer.get("badge_icon") or "star")
            res = resolve_resource(asset_type="icon", description=badge_icon_desc)
            resolved_id = res.get("resolved")
            if not resolved_id:
                continue
            from PIL import ImageDraw
            shape_type = str(layer.get("shape_type") or "pill").lower()
            fill_hex = str(instr.get("fill_color_hex") or _first_option(layer.get("fill_color_options") or [], "color_hex") or "#ffffff")
            fr, fg, fb, _ = _parse_hex_color(fill_hex, default=(255, 255, 255, 255))
            aa_scale = 4
            big_w, big_h = w * aa_scale, h * aa_scale
            big_img = Image.new("RGBA", (big_w, big_h), (0, 0, 0, 0))
            big_draw = ImageDraw.Draw(big_img)
            if shape_type == "pill":
                big_draw.rounded_rectangle([0, 0, big_w - 1, big_h - 1], radius=min(big_w, big_h) // 2, fill=(fr, fg, fb, 255))
            else:
                cr = int(layer.get("corner_radius") or 0) * aa_scale
                if cr > 0:
                    big_draw.rounded_rectangle([0, 0, big_w - 1, big_h - 1], radius=cr, fill=(fr, fg, fb, 255))
                else:
                    big_draw.rectangle([0, 0, big_w - 1, big_h - 1], fill=(fr, fg, fb, 255))
            shape_img = big_img.resize((w, h), Image.Resampling.LANCZOS)
            
            icon_color = str(instr.get("icon_color_hex") or _first_option(layer.get("icon_color_options") or [], "color_hex") or "#000000")
            icon_size = int(h * 0.6)
            icon_img = rasterize_icon(resolved_id, icon_size, icon_size, color=icon_color)
            if icon_img:
                ix = int(w * 0.1)
                iy = (h - icon_size) // 2
                shape_img.paste(icon_img, (ix, iy), icon_img)
            
            base = _composite_layer_onto_base(base, shape_img, x, y, w, h, rotation, opacity=layer_opacity)
        elif layer_type == "text":
            text_str = str(instr.get("text") or "").strip()
            if not text_str:
                continue
            font_id = str(instr.get("font_asset_id") or "")
            font_asset = font_assets.get(font_id)
            try:
                font_size_pct = float(instr.get("font_size_percent"))
            except (TypeError, ValueError):
                min_pct = float(layer.get("font_size_min_percent") or 4.0)
                max_pct = float(layer.get("font_size_max_percent") or 7.0)
                font_size_pct = (min_pct + max_pct) / 2.0
            font_px = max(10, int(round(font_size_pct * canvas_h / 100.0)))
            weight = str(layer.get("font_weight") or (font_asset.weight if font_asset else "regular"))
            _, script, font_path_used = _get_font_for_text(text_str, font_asset, weight, font_px)
            color_hex = str(instr.get("color_hex") or "#ffffff")
            align = str(instr.get("text_align") or "center").strip().lower()
            
            # Contrast Check is now handled by _apply_composition_validation
            # which patches the safe font_size_percent, color_hex, and text back into instr.
            # We can directly use color_hex and the updated text_str here!
            
            text_layer = render_text_layer_pango(
                text=text_str,
                font_path=font_path_used,
                font_size_px=font_px,
                text_color_hex=color_hex,
                layer_width_px=w,
                layer_height_px=h,
                text_align=align,
                font_weight=weight,
                fit_mode="fixed"
            )
            logger.info(
                'Text layer %s: script=%s font=%s size=%spx text="%s"',
                layer_id,
                script,
                font_path_used,
                font_px,
                text_str[:30],
            )
            base = _composite_layer_onto_base(base, text_layer, x, y, w, h, rotation, opacity=layer_opacity)
        elif layer_type in ("icon", "emoji"):
            desc = str(instr.get("description") or layer.get("description") or "").strip()
            if not desc:
                layer["render_status"] = "dropped_content_resolution"
                continue
            
            resolved_res = resolve_resource(
                asset_type=layer_type,
                description=desc,
                db=None,
                user_id=None,
                allow_fallback=False
            )
            resolved_value = resolved_res.get("resolved")
            
            if not resolved_value:
                layer["render_status"] = "dropped_content_resolution"
                continue
                
            if layer_type == "emoji":
                # For emoji, render it as text
                text_layer = render_text_layer_pango(
                    text=resolved_value,
                    font_path="", # rely on fallback emoji fonts
                    font_size_px=min(w, h),
                    text_color_hex="#ffffff", # Emojis typically ignore color, but just in case
                    layer_width_px=w,
                    layer_height_px=h,
                    text_align="center",
                    font_weight="regular"
                )
                base = _composite_layer_onto_base(base, text_layer, x, y, w, h, rotation, opacity=layer_opacity)
            elif layer_type == "icon":
                color_hex = str(instr.get("color_hex") or layer.get("color_hex") or "#ffffff")
                icon_img = rasterize_icon(
                    icon_id=resolved_value,
                    w=w,
                    h=h,
                    color=color_hex
                )
                if not icon_img:
                    layer["render_status"] = "dropped_rasterization_failed"
                    continue
                base = _composite_layer_onto_base(base, icon_img, x, y, w, h, rotation, opacity=layer_opacity)
                
        elif layer_type == "badge":
            badge_text = str(instr.get("badge_text") or "").strip()
            badge_icon_desc = str(instr.get("badge_icon") or "").strip()
            
            if not badge_text or not badge_icon_desc:
                layer["render_status"] = "dropped_content_resolution"
                continue
                
            resolved_res = resolve_resource(
                asset_type="icon",
                description=badge_icon_desc,
                db=None,
                user_id=None,
                allow_fallback=False
            )
            resolved_icon = resolved_res.get("resolved")
            
            if not resolved_icon:
                layer["render_status"] = "dropped_content_resolution"
                continue
                
            # Badge content configuration
            content_color_hex = str(instr.get("color_hex") or layer.get("color_hex") or "#000000")
            padding = h // 4
            inner_h = h - (padding * 2)
            
            # Resolve and rasterize icon BEFORE drawing anything
            icon_img = rasterize_icon(
                icon_id=resolved_icon,
                w=inner_h,
                h=inner_h,
                color=content_color_hex
            )
            
            if not icon_img:
                layer["render_status"] = "dropped_rasterization_failed"
                continue
                
            # Badge background shape
            from PIL import ImageDraw
            bg_color_hex = str(instr.get("fill_color_hex") or layer.get("fill_color_hex") or "#ffffff")
            br, bg, bb, _ = _parse_hex_color(bg_color_hex, default=(255, 255, 255, 255))
            
            badge_img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
            draw = ImageDraw.Draw(badge_img)
            
            # Draw pill shape
            draw.rounded_rectangle([0, 0, w - 1, h - 1], radius=min(w, h) // 2, fill=(br, bg, bb, 255))
            
            # Render text
            font_id = str(instr.get("font_asset_id") or layer.get("font_asset_id") or "")
            font_asset = font_assets.get(font_id)
            font_px = max(10, int(round(inner_h * 0.8)))
            weight = str(layer.get("font_weight") or (font_asset.weight if font_asset else "bold"))
            _, script, font_path_used = _get_font_for_text(badge_text, font_asset, weight, font_px)
            
            # Calculate approx text width to center the group
            text_w = len(badge_text) * (font_px // 2) # Rough approximation
            gap = padding // 2
            total_content_w = inner_h + gap + text_w
            
            start_x = max(padding, (w - total_content_w) // 2)
            
            # Paste icon
            badge_img.paste(icon_img, (start_x, padding), mask=icon_img)
            
            # Paste text
            text_layer = render_text_layer_pango(
                text=badge_text,
                font_path=font_path_used,
                font_size_px=font_px,
                text_color_hex=content_color_hex,
                layer_width_px=w - start_x - inner_h - gap,
                layer_height_px=inner_h,
                text_align="left",
                font_weight=weight,
                fit_mode="auto_fit"
            )
            badge_img.paste(text_layer, (start_x + inner_h + gap, padding), mask=text_layer)
            
            base = _composite_layer_onto_base(base, badge_img, x, y, w, h, rotation, opacity=layer_opacity)

    # Frame layer is drawn last if present
    for layer in layers:
        if str(layer.get("type") or "").lower() == "frame":
            layer_id = str(layer.get("id") or "")
            instr = layer_map.get(layer_id, {})
            
            # Determine global layer opacity (0-100)
            layer_opacity = 100.0
            if "opacity" in instr and instr.get("opacity") is not None:
                try:
                    layer_opacity = float(instr["opacity"])
                except (TypeError, ValueError):
                    pass
            elif "opacity" in layer and layer.get("opacity") is not None:
                try:
                    layer_opacity = float(layer["opacity"])
                except (TypeError, ValueError):
                    pass
            layer_opacity = max(0.0, min(100.0, layer_opacity))
            
            color_hex = str(instr.get("color_hex") or layer.get("color_hex") or "#ffffff")
            try:
                thickness_px = int(instr.get("thickness_px") or layer.get("thickness_px") or 4)
            except (TypeError, ValueError):
                thickness_px = 4
            
            try:
                inset_px = int(layer.get("inset_px") or 0)
            except (TypeError, ValueError):
                inset_px = 0
            
            r, g, b, _ = _parse_hex_color(color_hex, default=(255, 255, 255, 255))
            frame_alpha = int(round(255 * (layer_opacity / 100.0)))
            
            from PIL import ImageDraw
            frame_overlay = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
            draw = ImageDraw.Draw(frame_overlay)
            draw.rectangle(
                [inset_px, inset_px, canvas_w - inset_px, canvas_h - inset_px],
                outline=(r, g, b, frame_alpha),
                width=thickness_px
            )
            base = Image.alpha_composite(base, frame_overlay)

    return _image_to_png_bytes(base)

def _assemble_template_image(
    template_json: dict,
    background_bytes: bytes | None,
    logo_bytes: bytes | None,
    overlay_texts: list[dict],
    layer_overrides: list[dict] | None = None,
) -> bytes:
    canvas_w = int(template_json.get("canvas_width") or 1024)
    canvas_h = int(template_json.get("canvas_height") or 1024)
    base = Image.new("RGBA", (canvas_w, canvas_h), (255, 255, 255, 255))
    bg_type = str(template_json.get("background_type") or "").lower()
    if bg_type == "solid_color":
        base = Image.new("RGBA", (canvas_w, canvas_h), _parse_hex_color(template_json.get("background_color_hex"), default=(255, 255, 255, 255)))

    text_map = {int(item.get("layer_index")): str(item.get("text") or "") for item in overlay_texts or [] if item.get("layer_index") is not None}
    for item in layer_overrides or []:
        if item.get("layer_index") is not None:
            text_map[int(item.get("layer_index"))] = str(item.get("new_text") or item.get("text") or "")

    background_img = None
    if background_bytes:
        background_img = Image.open(io.BytesIO(background_bytes)).convert("RGBA").resize((canvas_w, canvas_h), Image.Resampling.LANCZOS)
    logo_img = Image.open(io.BytesIO(logo_bytes)).convert("RGBA") if logo_bytes else None

    indexed_layers = list(enumerate(template_json.get("layers") or []))
    indexed_layers.sort(key=lambda item: int(item[1].get("z_index") or 0))
    for layer_index, layer in indexed_layers:
        layer_type = str(layer.get("type") or "").lower()
        x = _pct(float(layer.get("position_x_percent") or 0), canvas_w)
        y = _pct(float(layer.get("position_y_percent") or 0), canvas_h)
        w = _pct(float(layer.get("width_percent") or 100), canvas_w)
        h = _pct(float(layer.get("height_percent") or 100), canvas_h)
        if w <= 0 or h <= 0:
            continue
        if layer_type == "background_image" and background_img is not None:
            base = Image.alpha_composite(base, background_img)
        elif layer_type == "overlay":
            r, g, b, _ = _parse_hex_color(layer.get("overlay_color_hex"), default=(0, 0, 0, 255))
            opacity = max(0.0, min(1.0, float(layer.get("overlay_opacity") if layer.get("overlay_opacity") is not None else 0.35)))
            overlay = Image.new("RGBA", (w, h), (r, g, b, int(round(opacity * 255))))
            layer_canvas = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
            layer_canvas.paste(overlay, (x, y), overlay)
            base = Image.alpha_composite(base, layer_canvas)
        elif layer_type == "logo" and logo_img is not None:
            img_box = _fit_within(logo_img, w, h)
            layer_canvas = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
            layer_canvas.paste(img_box, (x, y), img_box)
            base = Image.alpha_composite(base, layer_canvas)
        elif layer_type in ("icon", "emoji"):
            description = str(layer.get("content") or layer.get("description") or "star")
            res = resolve_resource(asset_type=layer_type, description=description)
            resolved_id = res.get("resolved")
            if not resolved_id:
                continue
            color_hex = str(layer.get("text_color_hex") or layer.get("color_hex") or "#ffffff")
            img = rasterize_icon(resolved_id, w, h, color=color_hex)
            if img:
                layer_canvas = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
                layer_canvas.paste(img, (x, y), img)
                base = Image.alpha_composite(base, layer_canvas)
        elif layer_type == "badge":
            badge_text = str(layer.get("badge_text") or layer.get("content") or "Badge")
            badge_icon_desc = str(layer.get("badge_icon") or "star")
            res = resolve_resource(asset_type="icon", description=badge_icon_desc)
            resolved_id = res.get("resolved")
            if not resolved_id:
                continue
            from PIL import ImageDraw
            shape_type = str(layer.get("shape_type") or "pill").lower()
            fill_hex = str(layer.get("fill_color_hex") or "#ffffff")
            fr, fg, fb, _ = _parse_hex_color(fill_hex, default=(255, 255, 255, 255))
            aa_scale = 4
            big_w, big_h = w * aa_scale, h * aa_scale
            big_img = Image.new("RGBA", (big_w, big_h), (0, 0, 0, 0))
            big_draw = ImageDraw.Draw(big_img)
            if shape_type == "pill":
                big_draw.rounded_rectangle([0, 0, big_w - 1, big_h - 1], radius=min(big_w, big_h) // 2, fill=(fr, fg, fb, 255))
            else:
                big_draw.rectangle([0, 0, big_w - 1, big_h - 1], fill=(fr, fg, fb, 255))
            shape_img = big_img.resize((w, h), Image.Resampling.LANCZOS)
            
            icon_color = str(layer.get("icon_color_hex") or "#000000")
            icon_size = int(h * 0.6)
            icon_img = rasterize_icon(resolved_id, icon_size, icon_size, color=icon_color)
            if icon_img:
                ix = int(w * 0.1)
                iy = (h - icon_size) // 2
                shape_img.paste(icon_img, (ix, iy), icon_img)
                
            layer_canvas = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
            layer_canvas.paste(shape_img, (x, y), shape_img)
            base = Image.alpha_composite(base, layer_canvas)
        elif layer_type == "text":
            text_str = text_map.get(layer_index, "")
            if not text_str:
                continue
            font_px = max(10, int(round(float(layer.get("font_size_percent") or 5.0) * canvas_h / 100.0)))
            weight = str(layer.get("font_weight") or "regular")
            _, script, font_path_used = _get_font_for_text(text_str, None, weight, font_px)
            color_hex = str(layer.get("text_color_hex") or "#ffffff")
            align = str(layer.get("text_align") or "left").strip().lower()
            
            text_layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
            shadow_layer = render_text_layer_pango(
                text=text_str,
                font_path=font_path_used,
                font_size_px=font_px,
                text_color_hex="#000000",
                layer_width_px=w,
                layer_height_px=h,
                text_align=align,
                font_weight=weight
            )
            text_layer.paste(shadow_layer, (1, 1), mask=shadow_layer)
            
            main_text_img = render_text_layer_pango(
                text=text_str,
                font_path=font_path_used,
                font_size_px=font_px,
                text_color_hex=color_hex,
                layer_width_px=w,
                layer_height_px=h,
                text_align=align,
                font_weight=weight
            )
            text_layer.paste(main_text_img, (0, 0), mask=main_text_img)
            
            logger.info(
                'Text layer %s: script=%s font=%s size=%spx text="%s"',
                str(layer.get("id") or layer_index),
                script,
                font_path_used,
                font_px,
                text_str[:30],
            )
            layer_canvas = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
            layer_canvas.paste(text_layer, (x, y), text_layer)
            base = Image.alpha_composite(base, layer_canvas)

    out = io.BytesIO()
    base.convert("RGB").save(out, format="PNG")
    return out.getvalue()

