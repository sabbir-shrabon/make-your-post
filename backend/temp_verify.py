import io
import json
from PIL import Image

# Import from the old (before refactoring) file
from temp_old_router import _assemble_template_image as old_assemble

# Import from the new (after refactoring) file
from app.services.prompt_studio_renderer import _assemble_template_image as new_assemble

def create_dummy_png():
    img = Image.new("RGBA", (200, 200), (50, 100, 150, 255))
    out = io.BytesIO()
    img.save(out, format="PNG")
    return out.getvalue()

def main():
    template_json = {
        "canvas_width": 200,
        "canvas_height": 200,
        "aspect_ratio": "1:1",
        "background_type": "solid_color",
        "layers": [
            {
                "type": "text",
                "z_index": 1,
                "position_x_percent": 10.0,
                "position_y_percent": 10.0,
                "width_percent": 80.0,
                "height_percent": 20.0,
                "font_size_percent": 10.0,
                "font_weight": "bold",
                "text_color_hex": "#FFFFFF",
                "text_align": "center"
            }
        ]
    }
    
    bg_bytes = create_dummy_png()
    logo_bytes = None
    overlay_texts = [{"layer_index": 0, "text": "Test Headline"}]
    layer_overrides = []
    
    old_output = old_assemble(template_json, bg_bytes, logo_bytes, overlay_texts, layer_overrides)
    new_output = new_assemble(template_json, bg_bytes, logo_bytes, overlay_texts, layer_overrides)
    
    with open("scratch/old_out.png", "wb") as f:
        f.write(old_output)
    with open("scratch/new_out.png", "wb") as f:
        f.write(new_output)
        
    old_img = Image.open(io.BytesIO(old_output)).convert("RGBA")
    new_img = Image.open(io.BytesIO(new_output)).convert("RGBA")
    
    from PIL import ImageChops
    diff = ImageChops.difference(old_img, new_img)
    bbox = diff.getbbox()
    
    if bbox is None:
        print("SUCCESS: The images are pixel-perfect identical!")
    else:
        print(f"FAILURE: The images differ. Bounding box of differences: {bbox}")

if __name__ == "__main__":
    main()
