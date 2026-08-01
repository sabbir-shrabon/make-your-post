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
        
        # Binary search for auto_fit
        if fit_mode == "auto_fit":
            low, high = 10, 120
            best_size = 10
            best_font = None
            while low <= high:
                mid = (low + high) // 2
                font_obj = None
                for fp in font_candidates:
                    try:
                        font_obj = ImageFont.truetype(fp, mid)
                        break
                    except Exception:
                        continue
                if font_obj is None:
                    font_obj = ImageFont.load_default()
                bbox = draw.textbbox((0, 0), text, font=font_obj)
                tw = bbox[2] - bbox[0]
                th = bbox[3] - bbox[1]
                if tw <= layer_width_px and th <= layer_height_px:
                    best_size = mid
                    best_font = font_obj
                    low = mid + 1
                else:
                    high = mid - 1
            font_size_px = best_size
            font_obj = best_font
            if font_obj is None:
                font_obj = ImageFont.load_default()
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
    
    layout.set_text(text, -1)

    # Auto-fit binary search
    if fit_mode == "auto_fit":
        low, high = 10, 120
        best_size = 10
        while low <= high:
            mid = (low + high) // 2
            font_desc = Pango.FontDescription()
            font_desc.set_absolute_size(mid * Pango.SCALE)
            font_desc.set_weight(Pango.Weight.BOLD if font_weight == 'bold' else Pango.Weight.NORMAL)
            font_desc.set_family(all_families)
            layout.set_font_description(font_desc)
            
            layout.set_width(layer_width_px * Pango.SCALE)
            tw, th = layout.get_pixel_size()
            
            if tw <= layer_width_px and th <= layer_height_px:
                best_size = mid
                low = mid + 1
            else:
                high = mid - 1
        font_size_px = best_size

    font_desc = Pango.FontDescription()
    font_desc.set_absolute_size(font_size_px * Pango.SCALE)
    font_desc.set_weight(Pango.Weight.BOLD if font_weight == 'bold' else Pango.Weight.NORMAL)
    font_desc.set_family(all_families)
    layout.set_font_description(font_desc)
    layout.set_width(layer_width_px * Pango.SCALE)
    
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
            
            text_layer = render_text_layer_pango(
                text=text_str,
                font_path=font_path_used,
                font_size_px=font_px,
                text_color_hex=color_hex,
                layer_width_px=w,
                layer_height_px=h,
                text_align=align,
                font_weight=weight
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

