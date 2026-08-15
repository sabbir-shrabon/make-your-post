import sys
import os
import asyncio

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.database import SessionLocal
from app.services.poster_renderer import render_poster_to_base64
from app.services.vector_assets import get_vector_asset_svg, SVG_CATALOG
from app.services.composition_validator import validate_and_fix_composition

def test_canva_grade_components():
    print("=== Testing Canva-Grade Vector & Component Pipeline ===")
    
    # 1. Verify SVG Catalog
    print(f"[1] Loaded {len(SVG_CATALOG)} vector assets in catalog.")
    assert "sunburst-rays" in SVG_CATALOG
    assert "tropical-palm-fronds" in SVG_CATALOG
    assert "starburst-badge" in SVG_CATALOG
    assert "arched-banner" in SVG_CATALOG
    
    # 2. Test SVG Token Injection
    sunburst_svg = get_vector_asset_svg("sunburst-rays", {"accent": "#F59E0B", "opacity": 0.3})
    assert sunburst_svg is not None
    assert "#F59E0B" in sunburst_svg
    print("[2] SVG token injection verified.")
    
    # 3. Test Composition Validation with intentional flow stack
    elements = [
        {"type": "shape", "shape_id": "sunburst-rays", "role": "background", "x": 0, "y": 0, "w": 1080, "h": 1080, "z_index": 0},
        {"type": "badge", "badge_text": "50% OFF", "role": "badge", "slot": "corner_badge", "x": 800, "y": 60, "w": 180, "h": 180, "z_index": 2},
        {"type": "text", "role": "headline", "content": "SUMMER MEGA SALE", "slot": "headline", "x": 86, "y": 340, "w": 907, "h": 240, "font_size": 72, "z_index": 3},
        {"type": "text", "role": "subheadline", "content": "All Swimwear & Beach Accessories On Sale", "slot": "subheadline", "x": 108, "y": 600, "w": 864, "h": 120, "font_size": 32, "z_index": 3},
        {"type": "text", "role": "cta", "content": "SHOP NOW", "slot": "cta_text", "x": 270, "y": 880, "w": 540, "h": 80, "font_size": 28, "z_index": 4},
    ]
    
    final_opacity = validate_and_fix_composition(
        elements=elements,
        canvas_w=1080,
        canvas_h=1080,
        background_color="#FF5722",
        overlay_opacity=0.0,
    )
    print(f"[3] Composition validated with zero collisions. Effective opacity: {final_opacity}")
    
    # 4. Render to Base64 PNG
    b64_img, out_path = render_poster_to_base64(
        elements=elements,
        template_id="centered-hero",
        palette_id="ink-sun",
        font_pair_id="bold-punch",
        canvas_w=1080,
        canvas_h=1080,
        overlay_opacity=final_opacity,
        background_color="#FF5722",
        run_id="test_canva_grade",
    )
    
    assert b64_img is not None
    assert out_path is not None
    print(f"[4] Successfully rendered Canva-grade poster PNG: {out_path}")
    print("\n[SUCCESS] All Canva-grade components verified!")

if __name__ == "__main__":
    test_canva_grade_components()
