import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from PIL import Image
from app.services.prompt_studio_renderer import _assemble_from_llm_instructions

def run_tests():
    print("Running Extended Layer Tests...")
    
    bg = Image.new("RGBA", (800, 800), (34, 34, 34, 255))
    
    # --- Test 1: Emoji Layer ---
    print("\n--- Test 1: Emoji Layer ---")
    template_json = {
        "canvas_width": 800,
        "canvas_height": 800,
        "layers": [
            {
                "id": "emoji_layer",
                "type": "emoji",
                "description": "grinning face",
                "position_x_percent": 10,
                "position_y_percent": 10,
                "width_percent": 20,
                "height_percent": 20
            }
        ]
    }
    llm_instructions = {
        "layers": [{"layer_id": "emoji_layer", "description": "grinning face"}]
    }
    
    img_bytes = _assemble_from_llm_instructions(template_json, bg, None, llm_instructions, None, 1)
    status = template_json["layers"][0].get("render_status", "rendered")
    print(f"Emoji layer status: {status}")
    with open("test_emoji.png", "wb") as f:
        f.write(img_bytes)
    print("Emoji layer generated test_emoji.png")

    # --- Test 2: Badge Layer (resolvable) ---
    print("\n--- Test 2: Badge Layer (resolvable icon) ---")
    template_json_badge = {
        "canvas_width": 800,
        "canvas_height": 800,
        "layers": [
            {
                "id": "badge_layer",
                "type": "badge",
                "position_x_percent": 10,
                "position_y_percent": 10,
                "width_percent": 50,
                "height_percent": 15
            }
        ]
    }
    llm_instructions_badge = {
        "layers": [
            {
                "layer_id": "badge_layer",
                "badge_text": "New Item",
                "badge_icon": "star",
                "color_hex": "#ffffff",
                "fill_color_hex": "#e11d48",
                "font_size_percent": 4.0
            }
        ]
    }
    img_bytes2 = _assemble_from_llm_instructions(template_json_badge, bg, None, llm_instructions_badge, None, 1)
    status2 = template_json_badge["layers"][0].get("render_status", "rendered")
    print(f"Badge (resolvable) status: {status2}")
    with open("test_badge_resolvable.png", "wb") as f:
        f.write(img_bytes2)
    print("Badge layer generated test_badge_resolvable.png")

    # --- Test 3: Badge Layer (unresolvable) ---
    print("\n--- Test 3: Badge Layer (unresolvable icon) ---")
    template_json_badge_bad = {
        "canvas_width": 800,
        "canvas_height": 800,
        "layers": [
            {
                "id": "badge_layer_bad",
                "type": "badge",
                "position_x_percent": 10,
                "position_y_percent": 10,
                "width_percent": 50,
                "height_percent": 15
            }
        ]
    }
    llm_instructions_badge_bad = {
        "layers": [
            {
                "layer_id": "badge_layer_bad",
                "badge_text": "Missing Icon",
                "badge_icon": "a completely made up and unresolvable non-existent visual object that iconify does not have",
                "color_hex": "#ffffff",
                "fill_color_hex": "#e11d48"
            }
        ]
    }
    img_bytes3 = _assemble_from_llm_instructions(template_json_badge_bad, bg, None, llm_instructions_badge_bad, None, 1)
    status3 = template_json_badge_bad["layers"][0].get("render_status", "rendered")
    print(f"Badge (unresolvable) status: {status3}")
    # Compare with pure background
    bg_bytes = _assemble_from_llm_instructions({"canvas_width": 800, "canvas_height": 800, "layers": []}, bg, None, {}, None, 1)
    if img_bytes3 == bg_bytes:
        print("Output is identical to blank background (badge was correctly dropped!).")
    else:
        print("Output differs from blank background. Badge may have partially rendered!")

    # --- Test 4: Shape Layer ---
    print("\n--- Test 4: Shape Layer ---")
    template_json_shape = {
        "canvas_width": 800,
        "canvas_height": 800,
        "layers": [
            {
                "id": "shape_layer",
                "type": "shape",
                "shape_type": "pill",
                "position_x_percent": 20,
                "position_y_percent": 20,
                "width_percent": 40,
                "height_percent": 10
            }
        ]
    }
    llm_instructions_shape = {
        "layers": [
            {
                "layer_id": "shape_layer",
                "fill_color_hex": "#10b981",
                "stroke_color_hex": "#047857"
            }
        ]
    }
    img_bytes4 = _assemble_from_llm_instructions(template_json_shape, bg, None, llm_instructions_shape, None, 1)
    status4 = template_json_shape["layers"][0].get("render_status", "rendered")
    print(f"Shape layer status: {status4}")
    with open("test_shape.png", "wb") as f:
        f.write(img_bytes4)
    print("Shape layer generated test_shape.png")

if __name__ == "__main__":
    run_tests()
