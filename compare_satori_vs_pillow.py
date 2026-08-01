import sys
import os
import json
import base64

try:
    from app.services.poster_renderer import render_poster_to_base64
    from app.services.poster_renderer_satori import render_poster_to_base64_satori
    from app.services.art_director import TEMPLATES, PALETTES, FONT_PAIRS
except ImportError:
    from backend.app.services.poster_renderer import render_poster_to_base64
    from backend.app.services.poster_renderer_satori import render_poster_to_base64_satori
    from backend.app.services.art_director import TEMPLATES, PALETTES, FONT_PAIRS

def run_comparison_poc():
    print("=== Satori vs Pillow POC Comparison ===")
    
    # 1. Choose POC template: "centered-hero"
    template_id = "centered-hero"
    palette_id = "ink-sun"
    font_pair_id = "serif-bold"
    canvas_w, canvas_h = 1080, 1080
    overlay_opacity = 0.2
    
    # Elements for centered-hero POC layout
    elements = [
        {
            "type": "text", "role": "headline", "content": "GRAND OPENING SALE",
            "x": 108, "y": 410, "w": 864, "h": 216, "font_size": 52, "color": "#FFFFFF", "align": "center"
        },
        {
            "type": "text", "role": "subheadline", "content": "Get 50% Off Everything This Weekend Only",
            "x": 162, "y": 648, "w": 756, "h": 108, "font_size": 28, "color": "#F8C630", "align": "center"
        },
        {
            "type": "icon", "slot": "accent_icon", "resolved": "tabler:pizza", "description": "pizza",
            "x": 453, "y": 216, "w": 172, "h": 172
        },
        {
            "type": "shape", "resolved": "badge", "description": "badge", "opacity": 80,
            "x": 800, "y": 80, "w": 180, "h": 180
        }
    ]
    
    scratch_dir = os.path.join(os.path.dirname(__file__), "backend", "scratch")
    os.makedirs(scratch_dir, exist_ok=True)
    
    path_pillow = os.path.join(scratch_dir, "poc_pillow.png")
    path_satori = os.path.join(scratch_dir, "poc_satori.png")
    
    # Render via Pillow
    print("Rendering POC template via Pillow...")
    b64_pillow, out_p = render_poster_to_base64(
        elements=elements, template_id=template_id, palette_id=palette_id,
        font_pair_id=font_pair_id, canvas_w=canvas_w, canvas_h=canvas_h,
        overlay_opacity=overlay_opacity
    )
    with open(path_pillow, "wb") as f:
        f.write(base64.b64decode(b64_pillow))
    print(f"Pillow output saved to: {path_pillow}")

    # Render via Satori
    print("Rendering POC template via Satori (Node.js subprocess)...")
    b64_satori, out_s = render_poster_to_base64_satori(
        elements=elements, template_id=template_id, palette_id=palette_id,
        font_pair_id=font_pair_id, canvas_w=canvas_w, canvas_h=canvas_h,
        overlay_opacity=overlay_opacity
    )
    with open(path_satori, "wb") as f:
        f.write(base64.b64decode(b64_satori))
    print(f"Satori output saved to: {path_satori}")

    print("\nPOC Comparison completed successfully!")
    print(f"Pillow image: {path_pillow}")
    print(f"Satori image: {path_satori}")

if __name__ == '__main__':
    run_comparison_poc()
