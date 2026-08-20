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
    elements_a = [{"type": "text", "role": "body", "color": "#CCCCCC", "content": "Hello"}]
    print("Initial Opacity: 0.0")
    final_opacity = run_contrast_check(elements_a, background_color="#EEEEEE", overlay_opacity=0.0)
    print(f"Final Opacity: {final_opacity:.2f}\n")

    print("--- Test A2: Contrast Fix via Text-Color Swap ---")
    # Light-gray text ("#EEEEEE") on a white background ("#FFFFFF") with initial overlay_opacity = 0.0.
    # Text color swap should change text color to dark ("#000000" or "#121212") and fix contrast at opacity 0.0.
    elements_a2 = [{"type": "text", "role": "headline", "color": "#EEEEEE", "content": "Headline text"}]
    final_opacity_a2 = run_contrast_check(elements_a2, background_color="#FFFFFF", overlay_opacity=0.0)
    print(f"Initial color: #EEEEEE -> Fixed text color: {elements_a2[0]['color']}")
    print(f"Final Opacity: {final_opacity_a2:.2f}")
    assert final_opacity_a2 == 0.0, "Contrast should be fixed via text color swap without increasing opacity"
    assert elements_a2[0]['color'] in ["#000000", "#121212", "#1D1D1F"], "Text color should swap to dark variant"
    print("Text-color swap test passed successfully!\n")

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
    # Case 1: Short headline that fits cleanly without shrinking
    elements_c1 = [
        {"type": "text", "role": "headline", "content": "Short Title", "x": 0, "y": 0, "w": 400, "h": 100, "font_size": 40}
    ]
    run_text_fit_check(elements_c1)
    print(f"Case 1 (Fits): initial 40 -> final font size: {elements_c1[0]['font_size']}")
    assert elements_c1[0]['font_size'] == 40, "Short headline should not shrink"

    # Case 2: Long headline that needs shrinking
    elements_c2 = [
        {"type": "text", "role": "headline", "content": "This is a very long headline that definitely will not fit in this small box without shrinking significantly.", "x": 0, "y": 0, "w": 200, "h": 50, "font_size": 40}
    ]
    run_text_fit_check(elements_c2)
    print(f"Case 2 (Long/Shrinks): initial 40 -> final font size: {elements_c2[0]['font_size']}")
    assert elements_c2[0]['font_size'] < 40, "Long headline should shrink"

    # Case 3: Real font metrics vs old 0.6 approximation (wide 'W's vs narrow 'i's)
    # Old approx treated 19 characters (10 chars + 9 spaces) as 19 * 0.6 * 40 = 456px width for BOTH strings,
    # causing both to wrap to 2 lines and shrink identically.
    # With real font metrics:
    # 'i i i i i i i i i i' at 40pt is ~220px wide (fits on 1 line in 250px box, stays font_size 40).
    # 'W W W W W W W W W W' at 40pt is ~470px wide (wraps to multiple lines in 250px box, height > 60, so it shrinks).
    elements_c3_narrow = [{"type": "text", "role": "headline", "content": "i i i i i i i i i i", "x": 0, "y": 0, "w": 250, "h": 60, "font_size": 40, "font_name": "arial"}]
    elements_c3_wide = [{"type": "text", "role": "headline", "content": "W W W W W W W W W W", "x": 0, "y": 0, "w": 250, "h": 60, "font_size": 40, "font_name": "arial"}]

    run_text_fit_check(elements_c3_narrow)
    run_text_fit_check(elements_c3_wide)

    print(f"Case 3 (Narrow 'i's): initial 40 -> final font size: {elements_c3_narrow[0]['font_size']}")
    print(f"Case 3 (Wide 'W's): initial 40 -> final font size: {elements_c3_wide[0]['font_size']}")
    assert elements_c3_narrow[0]['font_size'] > elements_c3_wide[0]['font_size'], "Real metrics should distinguish character widths"

    # Case 4: Horizontal Overflow (Single Word)
    # "WEEKEND PIZZA DELIVERY" in w: 648, h: 324, font_size: 60.
    from unittest.mock import patch
    
    class MockWideFont:
        def getmetrics(self): return (50, 10)
        def getlength(self, s: str): 
            # Mock it so that "DELIVERY" is 700px wide (exceeds 648)
            return len(s) * 100.0

    with patch('backend.app.services.composition_validator.get_font_path', return_value=MockWideFont()):
        elements_c4 = [{"type": "text", "role": "headline", "content": "WEEKEND PIZZA DELIVERY", "x": 108, "y": 432, "w": 648, "h": 324, "font_size": 60, "font_name": "oswald"}]
        run_text_fit_check(elements_c4)
        print(f"Case 4 (Horizontal Overflow): initial 60 -> final font size: {elements_c4[0]['font_size']}")
        print(f"Case 4 final text content: {elements_c4[0]['content']}")
        assert elements_c4[0]['font_size'] < 60 or "..." in elements_c4[0]['content'], "Horizontal overflow should trigger shrink or truncation"

    print("All Text Fit tests passed successfully!\n")

if __name__ == '__main__':
    run_tests()
