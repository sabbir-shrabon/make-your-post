import os
import sys
from PIL import Image
import logging

logging.basicConfig(level=logging.INFO, stream=sys.stdout, format='%(levelname)s: %(message)s')

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from app.services.prompt_studio_renderer import _assemble_from_llm_instructions, _calculate_contrast_ratio
from unittest.mock import MagicMock, patch

def test_all():
    print("Running Test 1: Text Layer Shrinking and Truncation...")
    template_json = {
        "canvas_width": 1000,
        "canvas_height": 1000,
        "layers": [
            {
                "id": "text_layer_1",
                "type": "text",
                "position_x_percent": 10,
                "position_y_percent": 10,
                "width_percent": 20,
                "height_percent": 5,
                "font_size_percent": 10,
                "font_weight": "regular"
            }
        ]
    }
    llm_instructions = {
        "layers": [
            {
                "layer_id": "text_layer_1",
                "text": "This is a very long text that will definitely not fit in a 200x50 box if rendered at 100px or even 12px. It should be truncated but we will see what happens instead.",
                "color_hex": "#ffffff"
            }
        ]
    }
    bg = Image.new("RGBA", (1000, 1000), (0, 0, 0, 255))
    mock_db = MagicMock()
    
    _assemble_from_llm_instructions(
        template_json, bg, None, llm_instructions, mock_db, user_id=1
    )
    
    print("-" * 50)
    print("Running Test 2: Badge Layer Overflow Clamping...")
    template_json = {
        "canvas_width": 1000,
        "canvas_height": 1000,
        "layers": [
            {
                "id": "badge_layer_1",
                "type": "badge",
                "position_x_percent": 50,
                "position_y_percent": 50,
                "width_percent": 20,
                "height_percent": 10,
            }
        ]
    }
    llm_instructions = {
        "layers": [
            {
                "layer_id": "badge_layer_1",
                "badge_text": "Extremely long badge text that should overflow completely out of the badge",
                "badge_icon": "lucide:pizza",
                "color_hex": "#000000",
                "fill_color_hex": "#ffffff"
            }
        ]
    }
    bg = Image.new("RGBA", (1000, 1000), (0, 0, 0, 0)) 
    
    _assemble_from_llm_instructions(
        template_json, bg, None, llm_instructions, mock_db, user_id=1
    )

    print("-" * 50)
    print("Running Test 3: Text Layer Contrast...")
    template_json = {
        "canvas_width": 1000,
        "canvas_height": 1000,
        "layers": [
            {
                "id": "text_layer_2",
                "type": "text",
                "position_x_percent": 10,
                "position_y_percent": 10,
                "width_percent": 80,
                "height_percent": 20,
                "font_size_percent": 10,
                "role": "body"
            }
        ]
    }
    original_color = "#050505"
    llm_instructions = {
        "layers": [
            {
                "layer_id": "text_layer_2",
                "text": "Low contrast text here!",
                "color_hex": original_color
            }
        ]
    }
    # Dark background
    bg = Image.new("RGBA", (1000, 1000), (10, 10, 10, 255))
    
    before_ratio = _calculate_contrast_ratio(original_color, (10, 10, 10))
    print(f"Before Contrast Ratio: {before_ratio:.2f}")

    with patch('app.services.prompt_studio_renderer.render_text_layer_pango') as mock_render:
        mock_render.return_value = Image.new("RGBA", (800, 200), (0, 0, 0, 0))
        
        _assemble_from_llm_instructions(
            template_json, bg, None, llm_instructions, mock_db, user_id=1
        )
        
        final_color = mock_render.call_args.kwargs['text_color_hex']
        final_ratio = _calculate_contrast_ratio(final_color, (10, 10, 10))
        print(f"Final Color Used: {final_color}")
        print(f"Final Contrast Ratio: {final_ratio:.2f}")

if __name__ == "__main__":
    test_all()
