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

def run_contrast_check(elements: List[Dict], background_color: str, overlay_opacity: float, overlay_color: str = "#000000") -> float:
    effective_bg = _blend_colors(overlay_color, background_color, overlay_opacity)
    
    fixes = []
    
    for el in elements:
        if el.get("type") == "text":
            text_color = el.get("color", "#FFFFFF")
            ratio = _get_contrast_ratio(text_color, effective_bg)
            
            threshold = 3.0 if el.get("role") == "headline" else 4.5
            
            if ratio < threshold:
                # Auto-fix: try to increase opacity
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

def run_overlap_check(elements: List[Dict]):
    # Sort elements by priority (text is high priority, icons/shapes are lower)
    # So we nudge icons/shapes first
    def get_priority(el):
        t = el.get("type", "shape")
        if t == "text": return 2
        if t == "logo": return 1
        return 0 # shape/icon
        
    elements.sort(key=get_priority, reverse=True)
    
    for i in range(len(elements)):
        for j in range(i + 1, len(elements)):
            el1, el2 = elements[i], elements[j]
            if _rect_overlap(el1, el2):
                # el2 is lower priority, nudge it down
                nudge_amount = (el1["y"] + el1["h"]) - el2["y"] + 10
                el2["y"] += nudge_amount
                
def run_text_fit_check(elements: List[Dict]):
    # Approximation: average char width is about 0.6 * font_size
    for el in elements:
        if el.get("type") == "text":
            text = el.get("content", "")
            w, h = el.get("w", 0), el.get("h", 0)
            font_size = el.get("font_size", 40)
            
            # Simple word wrap calculation
            words = text.split()
            lines = 1
            current_line_width = 0
            for word in words:
                word_width = len(word) * (font_size * 0.6)
                if current_line_width + word_width > w:
                    lines += 1
                    current_line_width = word_width
                else:
                    current_line_width += word_width + (font_size * 0.3) # space
            
            total_height = lines * font_size * 1.2 # 1.2 line height
            
            # Shrink font if too tall
            while total_height > h and font_size > 12:
                font_size = int(font_size * 0.9) # 10% decrement
                lines = 1
                current_line_width = 0
                for word in words:
                    word_width = len(word) * (font_size * 0.6)
                    if current_line_width + word_width > w:
                        lines += 1
                        current_line_width = word_width
                    else:
                        current_line_width += word_width + (font_size * 0.3)
                total_height = lines * font_size * 1.2
                
            el["font_size"] = font_size

def validate_and_fix_composition(
    elements: List[Dict], 
    canvas_w: int, 
    canvas_h: int, 
    background_color: str, 
    overlay_opacity: float, 
    overlay_color: str = "#000000"
) -> float:
    """
    Runs deterministic checks and applies auto-fixes in place.
    Returns the updated overlay_opacity.
    """
    overlay_opacity = run_contrast_check(elements, background_color, overlay_opacity, overlay_color)
    run_safe_zone_check(elements, canvas_w, canvas_h)
    run_text_fit_check(elements)
    run_overlap_check(elements)
    # Check safe zone again after nudge
    run_safe_zone_check(elements, canvas_w, canvas_h)
    
    return overlay_opacity
