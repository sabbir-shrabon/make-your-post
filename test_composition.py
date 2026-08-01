import json
from backend.app.services.composition_validator import (
    validate_and_fix_composition,
    run_contrast_check,
    run_safe_zone_check,
    run_overlap_check,
    run_text_fit_check
)

def run_tests():
    print("--- Test A: Contrast Auto-fix ---")
    # light-gray text on a light background. 
    # Let's say background is "#EEEEEE", overlay is "#000000" at 0.0 opacity initially.
    # Text is "#CCCCCC". It will fail contrast until opacity increases.
    elements_a = [{"type": "text", "role": "body", "color": "#CCCCCC", "content": "Hello"}]
    print("Initial Opacity: 0.0")
    final_opacity = run_contrast_check(elements_a, background_color="#EEEEEE", overlay_opacity=0.0)
    print(f"Final Opacity: {final_opacity:.2f}\n")

    print("--- Test B: Overlap Nudge ---")
    # Two icons placed at identical coordinates. 
    elements_b = [
        {"type": "icon", "role": "icon1", "x": 50, "y": 50, "w": 40, "h": 40},
        {"type": "icon", "role": "icon2", "x": 50, "y": 50, "w": 40, "h": 40}
    ]
    print(f"Before nudge:\nIcon1 y: {elements_b[0]['y']}, Icon2 y: {elements_b[1]['y']}")
    run_overlap_check(elements_b)
    print(f"After nudge:\nIcon1 y: {elements_b[0]['y']}, Icon2 y: {elements_b[1]['y']}\n")

    print("--- Test C: Text Fit Check ---")
    # A headline too long for its slot
    # slot w=100, h=50. font_size=40 initially.
    elements_c = [
        {"type": "text", "role": "headline", "content": "This is a very long headline that definitely will not fit in this small box without shrinking significantly.", "x": 0, "y": 0, "w": 200, "h": 50, "font_size": 40}
    ]
    print(f"Before fit:\nFont size: {elements_c[0]['font_size']}")
    run_text_fit_check(elements_c)
    print(f"After fit:\nFont size: {elements_c[0]['font_size']}")

if __name__ == '__main__':
    run_tests()
