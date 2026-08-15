import logging
from typing import Dict, Any, List

logger = logging.getLogger(__name__)

def _get_luminance(hex_color: str) -> float:
    hex_color = hex_color.lstrip('#')
    if len(hex_color) == 3:
        hex_color = "".join([c*2 for c in hex_color])
    try:
        r = int(hex_color[0:2], 16) / 255.0
        g = int(hex_color[2:4], 16) / 255.0
        b = int(hex_color[4:6], 16) / 255.0
    except ValueError:
        return 1.0 # default white

    def adjust(c: float) -> float:
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4

    r, g, b = adjust(r), adjust(g), adjust(b)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b

def _get_contrast_ratio(color1: str, color2: str) -> float:
    l1 = _get_luminance(color1)
    l2 = _get_luminance(color2)
    bright = max(l1, l2)
    dark = min(l1, l2)
    return (bright + 0.05) / (dark + 0.05)

def _blend_colors(fg: str, bg: str, opacity: float) -> str:
    # simple blend
    try:
        fg_r = int(fg.lstrip('#')[0:2], 16)
        fg_g = int(fg.lstrip('#')[2:4], 16)
        fg_b = int(fg.lstrip('#')[4:6], 16)
        bg_r = int(bg.lstrip('#')[0:2], 16)
        bg_g = int(bg.lstrip('#')[2:4], 16)
        bg_b = int(bg.lstrip('#')[4:6], 16)
        r = int(fg_r * opacity + bg_r * (1 - opacity))
        g = int(fg_g * opacity + bg_g * (1 - opacity))
        b = int(fg_b * opacity + bg_b * (1 - opacity))
        return f"#{r:02x}{g:02x}{b:02x}"
    except Exception:
        return bg

def _extract_palette_candidates(palette: dict | None) -> list[str]:
    """Extract light and dark color variants from a palette for contrast swaps.
    Returns palette-harmonious colors ordered light-first, dark-second."""
    if not palette:
        return []

    candidates = []
    seen = set()

    def _add(color: str | None):
        if color and isinstance(color, str) and color.startswith("#") and color not in seen:
            seen.add(color)
            candidates.append(color)

    # Primary text color from palette (designed for this palette's background)
    _add(palette.get("text_color"))
    _add(palette.get("text_on_dark"))
    _add(palette.get("text_on_light"))

    # Accent color (may work for subheadlines / emphasis)
    _add(palette.get("accent_color"))
    _add(palette.get("accent"))

    # Background colors can serve as dark/light extremes for text
    for bg_c in (palette.get("background_colors") or []):
        _add(bg_c)

    return candidates


def run_contrast_check(elements: List[Dict], background_color: str, overlay_opacity: float, overlay_color: str = "#000000", palette: dict | None = None) -> float:
    effective_bg = _blend_colors(overlay_color, background_color, overlay_opacity)

    # Build candidate colors: palette-harmonious first, then generic fallbacks
    palette_candidates = _extract_palette_candidates(palette)
    generic_fallbacks = ["#FFFFFF", "#000000", "#121212", "#F9FAFB", "#1D1D1F"]
    # Deduplicate while preserving order (palette colors take priority)
    seen = set()
    all_candidates = []
    for c in palette_candidates + generic_fallbacks:
        if c not in seen:
            seen.add(c)
            all_candidates.append(c)

    for el in elements:
        if el.get("type") == "text":
            text_color = el.get("color", "#FFFFFF")
            ratio = _get_contrast_ratio(text_color, effective_bg)
            
            threshold = 3.0 if el.get("role") == "headline" else 4.5
            
            if ratio < threshold:
                # 1. Try text color swap first — palette-harmonious, then generic
                best_color = text_color
                best_ratio = ratio
                
                for cand in all_candidates:
                    cand_ratio = _get_contrast_ratio(cand, effective_bg)
                    if cand_ratio >= threshold:
                        best_color = cand
                        best_ratio = cand_ratio
                        break
                    elif cand_ratio > best_ratio:
                        best_color = cand
                        best_ratio = cand_ratio

                if best_ratio >= threshold:
                    el["color"] = best_color
                    continue

                # If text color swap alone wasn't enough, set el color to best candidate so far
                el["color"] = best_color
                text_color = best_color
                ratio = best_ratio

                # 2. Fall back to increasing overlay opacity (last resort)
                while ratio < threshold and overlay_opacity < 0.85:
                    overlay_opacity += 0.1
                    effective_bg = _blend_colors(overlay_color, background_color, overlay_opacity)
                    ratio = _get_contrast_ratio(text_color, effective_bg)
                
                if ratio < threshold:
                    logger.warning(f"Contrast ratio {ratio:.2f} too low for {el.get('role')} despite max opacity.")
    
    return min(overlay_opacity, 0.85)

def run_safe_zone_check(elements: List[Dict], canvas_w: int, canvas_h: int):
    margin_x = canvas_w * 0.05
    margin_y = canvas_h * 0.05
    
    for el in elements:
        x, y, w, h = el.get("x", 0), el.get("y", 0), el.get("w", 0), el.get("h", 0)
        
        # fix x bounds
        if x < margin_x:
            el["x"] = margin_x
        if x + w > canvas_w - margin_x:
            if w > canvas_w - 2 * margin_x:
                el["w"] = canvas_w - 2 * margin_x
                el["x"] = margin_x
            else:
                el["x"] = canvas_w - margin_x - w
                
        # fix y bounds
        if y < margin_y:
            el["y"] = margin_y
        if y + h > canvas_h - margin_y:
            if h > canvas_h - 2 * margin_y:
                el["h"] = canvas_h - 2 * margin_y
                el["y"] = margin_y
            else:
                el["y"] = canvas_h - margin_y - h

def _rect_overlap(r1, r2):
    return not (r1["x"] >= r2["x"] + r2["w"] or 
                r1["x"] + r1["w"] <= r2["x"] or 
                r1["y"] >= r2["y"] + r2["h"] or 
                r1["y"] + r1["h"] <= r2["y"])


def _calculate_text_metrics(text: str, font_name: str, font_size: int, max_width: float) -> tuple[float, float]:
    """Calculate approximate (total_height, max_line_width) for text given font_size and max_width."""
    if not text or font_size <= 0:
        return (0.0, 0.0)

    avg_char_w = max(1.0, font_size * 0.52)
    chars_per_line = max(1, int(max_width / avg_char_w)) if max_width > 0 else len(text)

    paragraphs = text.split("\n")
    all_lines = []
    for p in paragraphs:
        if not p.strip():
            all_lines.append("")
        else:
            words = p.split()
            current_line = []
            current_len = 0
            for word in words:
                word_len = len(word)
                if current_len + word_len + (1 if current_line else 0) <= chars_per_line:
                    current_line.append(word)
                    current_len += word_len + (1 if len(current_line) > 1 else 0)
                else:
                    if current_line:
                        all_lines.append(" ".join(current_line))
                    current_line = [word]
                    current_len = word_len
            if current_line:
                all_lines.append(" ".join(current_line))

    line_height = font_size * 1.25
    total_height = max(1, len(all_lines)) * line_height
    max_line_w = max((len(line) * avg_char_w for line in all_lines), default=0.0)
    return (total_height, max_line_w)


def _truncate_text_to_fit(text: str, font_name: str, font_size: int, max_w: float, max_h: float) -> str:
    """Truncates text with ellipsis if it overflows slot dimensions at minimum font size."""
    if not text:
        return text
    words = text.split()
    while words:
        candidate = " ".join(words) + "..."
        tot_h, line_w = _calculate_text_metrics(candidate, font_name, font_size, max_w)
        if tot_h <= max_h and line_w <= max_w:
            return candidate
        words.pop()
    return text[:10] + "..." if len(text) > 10 else text


def run_expand_to_fill_text_sizing(elements: List[Dict], max_headline_size: int = 140, min_size: int = 14):
    """
    P1: Binary-search dynamic text scaling that optimizes font size
    to legibly fill the available slot width/height while strictly preserving margins.
    """
    for el in elements:
        if el.get("type") == "text":
            text = str(el.get("content") or "").strip()
            if not text:
                continue
            w = float(el.get("w", 0))
            h = float(el.get("h", 0))
            if w <= 0 or h <= 0:
                continue

            font_name = el.get("font_name", "arial")
            role = el.get("role", "body")
            
            # Target max font size depends on the role
            if role == "headline":
                target_max = max_headline_size
            elif role == "subheadline":
                target_max = int(max_headline_size * 0.6)
            else:
                target_max = int(max_headline_size * 0.4)

            # Binary search for optimal font size that fits into bounding box (w, h)
            low = min_size
            high = target_max
            best_size = low

            while low <= high:
                mid = (low + high) // 2
                total_height, max_line_w = _calculate_text_metrics(text, font_name, mid, w)
                if total_height <= h and max_line_w <= w:
                    best_size = mid
                    low = mid + 1 # try larger
                else:
                    high = mid - 1 # try smaller

            # If user or LLM specified a size, we only scale if not set or if it overflows
            current_font_size = el.get("font_size")
            if not current_font_size:
                el["font_size"] = best_size
            else:
                # If current size overflows, shrink to best_size
                tot_h, line_w = _calculate_text_metrics(text, font_name, current_font_size, w)
                if tot_h > h or line_w > w:
                    el["font_size"] = best_size
                else:
                    # If it's a headline and significantly undersized, expand to fill
                    if role == "headline" and current_font_size < best_size * 0.8:
                        el["font_size"] = best_size

def run_overlap_check(elements: List[Dict]):
    """
    P4: Selective Intentional Overlap.
    Allows badges, stickers, and accent icons with `allow_overlap=True` or
    corner badge slots to intentionally break boundaries for modern editorial designs,
    while resolving unintended text-on-text collisions.
    """
    # Sort elements by priority (text is high priority, icons/shapes are lower)
    def get_priority(el):
        t = el.get("type", "shape")
        if t == "text": return 2
        if t == "logo": return 1
        return 0 # shape/icon
        
    sorted_elements = sorted(elements, key=get_priority, reverse=True)
    
    for i in range(len(sorted_elements)):
        for j in range(i + 1, len(sorted_elements)):
            el1, el2 = sorted_elements[i], sorted_elements[j]

            # P4: Allow intentional overlap if flagged or if corner badge/accent
            if el1.get("allow_overlap") or el2.get("allow_overlap"):
                continue
            if el1.get("slot") in ("corner_badge", "accent_icon") or el2.get("slot") in ("corner_badge", "accent_icon"):
                continue
            if el1.get("role") in ("corner_badge", "accent_icon") or el2.get("role") in ("corner_badge", "accent_icon"):
                continue

            # Only nudge if both are text elements colliding directly
            if el1.get("type") == "text" and el2.get("type") == "text":
                if _rect_overlap(el1, el2):
                    nudge_amount = (el1["y"] + el1["h"]) - el2["y"] + 8
                    el2["y"] += nudge_amount

def run_text_fit_check(elements: List[Dict]):
    for el in elements:
        if el.get("type") == "text":
            text = str(el.get("content") or "").strip()
            if not text:
                continue
            w, h = el.get("w", 0), el.get("h", 0)
            font_size = el.get("font_size", 40)
            font_name = el.get("font_name", "arial")
            
            total_height, max_line_w = _calculate_text_metrics(text, font_name, font_size, w)
            
            # Shrink font if too tall or too wide
            while (total_height > h or max_line_w > w) and font_size > 12:
                font_size = int(font_size * 0.9) # 10% decrement
                total_height, max_line_w = _calculate_text_metrics(text, font_name, font_size, w)
                
            if (total_height > h or max_line_w > w) and font_size <= 12:
                logger.warning(f"Ellipsis truncation triggered for text slot '{el.get('role', 'unknown')}'. Text was too long even at minimum font size: '{text}'")
                text = _truncate_text_to_fit(text, font_name, font_size, w, h)
                el["content"] = text
                
            el["font_size"] = font_size

def validate_and_fix_composition(
    elements: List[Dict], 
    canvas_w: int, 
    canvas_h: int, 
    background_color: str, 
    overlay_opacity: float, 
    overlay_color: str = "#000000",
    palette: dict | None = None,
) -> float:
    """
    Art Director Composition Intelligence:
    1. Safe Zone Enforcment (5% margin)
    2. P1: Expand-to-Fill Dynamic Text Sizing (binary search fitting)
    3. P4: Overlap verification with intentional overlap support
    4. P2: WCAG 2.1 AA Color Harmony contrast verification
    """
    # 1. Expand to fill and fit check
    run_expand_to_fill_text_sizing(elements)
    run_text_fit_check(elements)

    # 2. Overlap checks
    run_overlap_check(elements)

    # 3. Safe zone margins
    run_safe_zone_check(elements, canvas_w, canvas_h)

    # 4. Color harmony & contrast checking
    final_opacity = run_contrast_check(
        elements=elements,
        background_color=background_color,
        overlay_opacity=overlay_opacity,
        overlay_color=overlay_color,
        palette=palette,
    )

    return final_opacity

