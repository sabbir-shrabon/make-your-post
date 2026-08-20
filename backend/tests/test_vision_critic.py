import json
import base64
from PIL import Image, ImageDraw, ImageFont
from io import BytesIO
import os

from backend.app.services.vision_critic import run_vision_critic

def create_bad_image():
    # Create an image with overlapping text to test the critic
    img = Image.new('RGB', (800, 600), color = (255, 255, 255))
    d = ImageDraw.Draw(img)
    
    # Try to use a default font
    try:
        font = ImageFont.truetype("arial.ttf", 60)
    except IOError:
        font = ImageFont.load_default()
        
    # Draw overlapping text
    d.text((100, 100), "This is overlapping", fill=(0,0,0), font=font)
    d.text((120, 120), "This text overlaps!", fill=(255,0,0), font=font)
    
    # Draw tiny unreadable text
    d.text((400, 500), "Can you even read this?", fill=(200,200,200))
    
    buffered = BytesIO()
    img.save(buffered, format="PNG")
    return buffered.getvalue()

try:
    from app.services.poster_orchestrator import apply_vision_critic_patch
except ImportError:
    from backend.app.services.poster_orchestrator import apply_vision_critic_patch

def test_patch_application():
    print("--- Test E: Apply Vision Critic Patch Unit Tests ---")
    elements = [
        {"type": "text", "role": "headline", "content": "Big Title", "font_size": 60, "x": 50, "y": 50, "w": 300, "h": 100},
        {"type": "icon", "slot": "accent_icon", "x": 100, "y": 100, "w": 50, "h": 50}
    ]
    
    # 1. Test overlay opacity patch
    new_opacity = apply_vision_critic_patch("background", "increase overlay opacity on background", elements, 0.4)
    print(f"Opacity adjustment: 0.4 -> {new_opacity:.2f}")
    assert new_opacity > 0.4, "Overlay opacity should increase"

    # 2. Test text shrink patch
    apply_vision_critic_patch("headline", "shrink headline font size", elements, new_opacity)
    print(f"Headline font size after shrink: {elements[0]['font_size']}")
    assert elements[0]['font_size'] < 60, "Headline font size should shrink"

    # 3. Test element position nudge patch
    apply_vision_critic_patch("accent_icon", "nudge accent_icon lower", elements, new_opacity)
    print(f"Icon y after lower nudge: {elements[1]['y']}")
    assert elements[1]['y'] > 100, "Icon y coordinate should increase (nudge lower)"

    print("All Vision Critic Patch unit tests passed successfully!\n")

def run_tests():
    test_patch_application()

    print("--- Test D: Vision Critic API Pass ---")
    image_bytes = create_bad_image()
    
    import app.config
    gemini_key = app.config.GEMINI_API_KEY
    if not gemini_key:
        print("GEMINI_API_KEY not found in config, skipping Vision Critic API call test.")
        return
        
    try:
        response = run_vision_critic(image_bytes, api_key=gemini_key)
        print("Vision Critic Output:")
        print(json.dumps(response.model_dump(), indent=2))
    except Exception as e:
        print(f"Vision critic failed: {e}")

if __name__ == '__main__':
    run_tests()
