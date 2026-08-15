import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import app.services.prompt_studio_renderer # Sets up GTK/Cairo path on Windows
from app.services.resource_resolver_unified import resolve_resource
from app.services.poster_renderer import render_icon_or_emoji_layer
from PIL import Image

def test():
    print("Testing Art Director icon path directly...")
    
    # 1. Resolve a real icon description (orchestrator behavior)
    # We do NOT pass allow_fallback, so we test the default.
    desc = "pizza"
    res = resolve_resource(
        asset_type="icon",
        description=desc,
        db=None
    )
    resolved_icon = res.get("resolved")
    print(f"Resolved '{desc}' -> {resolved_icon}")
    
    # 2. Rasterize via poster_renderer (Art Director behavior)
    el = {
        "w": 100,
        "h": 100,
        "resolved": resolved_icon
    }
    palette = {"accent": "#ff0055"}
    
    img = render_icon_or_emoji_layer(el, palette)
    if img:
        print(f"Successfully rendered! Image size: {img.size}")
        img.save("test_ad_icon.png")
    else:
        print("Render failed or returned None.")

if __name__ == "__main__":
    test()
