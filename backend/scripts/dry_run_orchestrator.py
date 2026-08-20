"""
Dry run script for poster generation orchestrator.
Tests the generation flow without touching the generate_post_image API endpoint.
"""
import json
import os
import sys
import time
from pathlib import Path
from typing import Dict, List, Any
from PIL import Image, ImageDraw, ImageFont
import io

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.services.art_director import (
    TEMPLATES, PALETTES, FONT_PAIRS,
    get_template_ids, get_palette_ids, get_font_pair_ids
)
from app.services.composition_validator import validate_and_fix_composition

# Configuration
OUTPUT_DIR = Path("./dry_run_output")
OUTPUT_DIR.mkdir(exist_ok=True)
SUMMARY_FILE = OUTPUT_DIR / "dry_run_summary.json"

# Canvas dimensions
CANVAS_W, CANVAS_H = 1080, 1080


def parse_hex_color(hex_str: str, default=(255, 255, 255, 255)) -> tuple:
    """Parse hex color to RGBA tuple."""
    hex_str = (hex_str or "").strip().lstrip('#')
    if len(hex_str) == 3:
        hex_str = "".join([c*2 for c in hex_str])
    try:
        r = int(hex_str[0:2], 16)
        g = int(hex_str[2:4], 16)
        b = int(hex_str[4:6], 16)
        a = int(hex_str[6:8], 16) if len(hex_str) >= 8 else 255
        return (r, g, b, a)
    except (ValueError, IndexError):
        return default


def render_gradient_background(palette: Dict, canvas_w: int, canvas_h: int) -> Image.Image:
    """Render gradient background from palette config."""
    bg_config = palette.get("background", {})
    bg_type = bg_config.get("type", "solid")
    
    if bg_type == "solid":
        hex_color = bg_config.get("hex", "#121212")
        color = parse_hex_color(hex_color)
        return Image.new("RGBA", (canvas_w, canvas_h), color)
    
    elif bg_type == "gradient":
        from_hex = bg_config.get("from", "#000000")
        to_hex = bg_config.get("to", "#ffffff")
        angle_deg = bg_config.get("angle_deg", 135)
        
        # Simple vertical gradient for now
        c1 = parse_hex_color(from_hex)
        c2 = parse_hex_color(to_hex)
        
        img = Image.new("RGBA", (canvas_w, canvas_h))
        pixels = img.load()
        
        for y in range(canvas_h):
            t = y / max(canvas_h - 1, 1)
            r = int(c1[0] + (c2[0] - c1[0]) * t)
            g = int(c1[1] + (c2[1] - c1[1]) * t)
            b = int(c1[2] + (c2[2] - c1[2]) * t)
            for x in range(canvas_w):
                pixels[x, y] = (r, g, b, 255)
        
        return img
    
    # Fallback
    return Image.new("RGBA", (canvas_w, canvas_h), (30, 30, 30, 255))


def get_font_path(font_name: str, font_size: int) -> ImageFont.ImageFont:
    """Get a PIL font for the given font name."""
    # Try multiple font paths
    font_candidates = [
        f"backend/assets/fonts/{font_name}.ttf",
        f"assets/fonts/{font_name}.ttf",
        f"backend/assets/fonts/{font_name}-Bold.ttf",
        f"assets/fonts/{font_name}-Bold.ttf",
        "C:\\Windows\\Fonts\\arial.ttf",
        "C:\\Windows\\Fonts\\arialbd.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]
    
    for font_path in font_candidates:
        if os.path.isfile(font_path):
            try:
                return ImageFont.truetype(font_path, font_size)
            except Exception:
                continue
    
    # Fallback to default
    return ImageFont.load_default()


def render_text(text: str, x: int, y: int, w: int, h: int, 
                font_name: str, font_size: int, color: str, 
                align: str = "left") -> Image.Image:
    """Render text layer."""
    layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    
    font = get_font_path(font_name, font_size)
    color_rgb = parse_hex_color(color)[:3]
    
    # Calculate text position based on alignment
    bbox = draw.textbbox((0, 0), text, font=font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]
    
    if align == "center":
        text_x = max(0, (w - text_w) // 2)
        text_y = max(0, (h - text_h) // 2)
    elif align == "right":
        text_x = max(0, w - text_w)
        text_y = max(0, (h - text_h) // 2)
    else:  # left
        text_x = 0
        text_y = max(0, (h - text_h) // 2)
    
    draw.text((text_x, text_y), text, font=font, fill=color_rgb)
    return layer


def resolve_template_slots(template_id: str, canvas_w: int, canvas_h: int) -> Dict[str, Dict]:
    """Resolve template slot percentages to pixel coordinates."""
    template = next((t for t in TEMPLATES if t["id"] == template_id), None)
    if not template:
        return {}
    
    slots = {}
    for slot_name, slot_config in template.get("slots", {}).items():
        x_pct = slot_config.get("x_pct", 0) / 100
        y_pct = slot_config.get("y_pct", 0) / 100
        w_pct = slot_config.get("w_pct", 100) / 100
        h_pct = slot_config.get("h_pct", 100) / 100
        
        slots[slot_name] = {
            "x": int(x_pct * canvas_w),
            "y": int(y_pct * canvas_h),
            "w": int(w_pct * canvas_w),
            "h": int(h_pct * canvas_h),
            "align": slot_config.get("align", "left")
        }
    
    return slots


def generate_poster_simple(topic: str, template_id: str = None, 
                            palette_id: str = None, font_pair_id: str = None) -> Dict[str, Any]:
    """
    Generate a poster using simple logic (no LLM required for dry run).
    This is a simplified version that uses the design resources directly.
    """
    start_time = time.time()
    
    # Auto-select if not provided
    if not template_id:
        template_id = TEMPLATES[0]["id"]
    if not palette_id:
        palette_id = PALETTES[0]["id"]
    if not font_pair_id:
        font_pair_id = FONT_PAIRS[0]["id"]
    
    # Look up resources
    template = next((t for t in TEMPLATES if t["id"] == template_id), TEMPLATES[0])
    palette = next((p for p in PALETTES if p["id"] == palette_id), PALETTES[0])
    font_pair = next((fp for fp in FONT_PAIRS if fp["id"] == font_pair_id), FONT_PAIRS[0])
    
    # Generate simple headline/subheadline from topic
    headline = topic.upper()[:50]
    subheadline = f"Special promotion • Limited time offer" if len(topic) < 30 else topic
    
    # Resolve template slots
    slots = resolve_template_slots(template_id, CANVAS_W, CANVAS_H)
    
    # Build elements list for composition validator
    elements = []
    
    # Render background
    background = render_gradient_background(palette, CANVAS_W, CANVAS_H)
    
    # Determine text colors based on palette
    text_color = palette.get("text_on_dark", "#FFFFFF")
    
    # Render headline if slot exists
    if "headline" in slots:
        slot = slots["headline"]
        elements.append({
            "type": "text",
            "role": "headline",
            "content": headline,
            "x": slot["x"],
            "y": slot["y"],
            "w": slot["w"],
            "h": slot["h"],
            "font_size": 60,
            "color": text_color
        })
    
    # Render subheadline if slot exists
    if "subheadline" in slots:
        slot = slots["subheadline"]
        elements.append({
            "type": "text",
            "role": "subheadline",
            "content": subheadline,
            "x": slot["x"],
            "y": slot["y"],
            "w": slot["w"],
            "h": slot["h"],
            "font_size": 30,
            "color": text_color
        })
    
    # Run composition validator
    overlay_opacity = 0.0
    try:
        overlay_opacity = validate_and_fix_composition(
            elements=elements,
            canvas_w=CANVAS_W,
            canvas_h=CANVAS_H,
            background_color=palette.get("background", {}).get("hex", "#121212"),
            overlay_opacity=overlay_opacity
        )
    except Exception as e:
        print(f"  [Warning] Composition validator error: {e}")
    
    # Compose final image
    final_image = background.copy()
    
    # Add overlay if needed
    if overlay_opacity > 0:
        overlay = Image.new("RGBA", (CANVAS_W, CANVAS_H), (0, 0, 0, int(overlay_opacity * 255)))
        final_image = Image.alpha_composite(final_image, overlay)
    
    # Render and composite text layers
    for el in elements:
        if el["type"] == "text":
            text_layer = render_text(
                text=el["content"],
                x=0, y=0,  # Layer is already sized
                w=el["w"],
                h=el["h"],
                font_name=font_pair["heading_font"],
                font_size=el["font_size"],
                color=el["color"],
                align=slots.get(el["role"], {}).get("align", "left")
            )
            final_image.paste(text_layer, (el["x"], el["y"]), text_layer)
    
    execution_time = time.time() - start_time
    
    return {
        "image": final_image,
        "template_id": template_id,
        "palette_id": palette_id,
        "font_pair_id": font_pair_id,
        "execution_time": execution_time,
        "headline": headline,
        "subheadline": subheadline,
        "overlay_opacity": overlay_opacity
    }


def main():
    """Run dry run tests with diverse topics."""
    
    # 12 diverse test topics
    test_topics = [
        ("Summer Sale", "centered-hero", "sunset-energy", "anton-montserrat"),
        ("Tech Conference 2024", "top-heavy-headline", "midnight-mint", "space-grotesk-dm-sans"),
        ("Healthy Living Tips", "minimal-quote", "white-emerald", "libre-baskerville-karla"),
        ("Flash Sale - 50% Off", "corner-badge-promo", "ink-sun", "bebas-neue-inter"),
        ("Coffee Shop Grand Opening", "bottom-banner", "cream-berry", "fraunces-nunito"),
        ("Fitness Challenge", "split-image-left", "forest-lime", "oswald-open-sans"),
        ("Music Festival", "diagonal-split", "cobalt-coral", "poppins-lato"),
        ("Luxury Watch Collection", "product-showcase", "plum-gold", "playfair-source-sans"),
        ("Winter Collection", "right-rail", "charcoal-lilac", "playfair-source-sans"),
        ("Food Delivery Service", "list-steps", "paper-tomato", "oswald-open-sans"),
        ("Nightlife Event", "black-neon", "black-neon", "anton-montserrat"),
        ("Artisan Bakery", "before-after-split", "rose-espresso", "fraunces-nunito"),
    ]
    
    summary = []
    
    print(f"Starting dry run with {len(test_topics)} test topics...")
    print(f"Output directory: {OUTPUT_DIR.absolute()}\n")
    
    for i, (topic, template_id, palette_id, font_pair_id) in enumerate(test_topics, 1):
        print(f"[{i}/{len(test_topics)}] Generating: {topic}")
        print(f"  Template: {template_id}, Palette: {palette_id}, Font: {font_pair_id}")
        
        try:
            result = generate_poster_simple(
                topic=topic,
                template_id=template_id,
                palette_id=palette_id,
                font_pair_id=font_pair_id
            )
            
            # Save image
            filename = f"{i:02d}_{topic.lower().replace(' ', '_').replace('-', '_')}.png"
            output_path = OUTPUT_DIR / filename
            result["image"].save(output_path, "PNG")
            
            # Record summary
            summary.append({
                "index": i,
                "topic": topic,
                "filename": filename,
                "template_id": result["template_id"],
                "palette_id": result["palette_id"],
                "font_pair_id": result["font_pair_id"],
                "execution_time": round(result["execution_time"], 2),
                "headline": result["headline"],
                "subheadline": result["subheadline"],
                "overlay_opacity": result["overlay_opacity"],
                "status": "success"
            })
            
            print(f"  ✓ Saved: {filename} ({result['execution_time']:.2f}s)")
            
        except Exception as e:
            print(f"  ✗ Failed: {e}")
            summary.append({
                "index": i,
                "topic": topic,
                "status": "failed",
                "error": str(e)
            })
        
        print()
    
    # Save summary JSON
    with open(SUMMARY_FILE, "w") as f:
        json.dump(summary, f, indent=2)
    
    print(f"\n{'='*60}")
    print(f"Dry run complete!")
    print(f"Generated {len([s for s in summary if s['status'] == 'success'])}/{len(summary)} images")
    print(f"Summary saved to: {SUMMARY_FILE}")
    print(f"Images saved to: {OUTPUT_DIR.absolute()}")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
