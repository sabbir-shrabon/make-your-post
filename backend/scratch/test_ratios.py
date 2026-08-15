import sys
import os
import base64

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.services.poster_component_renderer import render_archetype_poster

def test_aspect_ratios():
    ratios = {
        "1:1": (1080, 1080),
        "4:5": (1080, 1350),
        "9:16": (1080, 1920),
        "16:9": (1920, 1080),
    }

    print("Testing Multi-Aspect Ratio Rendering...")
    scratch_dir = os.path.join(os.path.dirname(__file__), "scratch")
    os.makedirs(scratch_dir, exist_ok=True)

    for ratio_name, (w, h) in ratios.items():
        clean_name = ratio_name.replace(":", "_")
        b64_str, _ = render_archetype_poster(
            archetype_id="social-card",
            headline="5 HABITS OF HIGH-PERFORMING FOUNDERS",
            subheadline="Small daily optimizations that compound over 12 months.",
            badge_text="PRO TIP",
            brand_name="AutoPoster AI",
            handle="@autoposter",
            image_url="https://images.pexels.com/photos/3183150/pexels-photo-3183150.jpeg?auto=compress&cs=tinysrgb&w=800",
            canvas_w=w,
            canvas_h=h,
        )
        out_path = os.path.join(scratch_dir, f"test_ratio_{clean_name}.png")
        raw = base64.b64decode(b64_str.split(",", 1)[1])
        with open(out_path, "wb") as f:
            f.write(raw)
        print(f"[OK] Rendered {ratio_name} ({w}x{h}) -> {out_path} ({len(raw)} bytes)")

    print("All aspect ratios tested successfully!")

if __name__ == "__main__":
    test_aspect_ratios()
