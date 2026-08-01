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

def run_tests():
    print("--- Test D: Vision Critic Pass ---")
    image_bytes = create_bad_image()
    
    import app.config
    gemini_key = app.config.GEMINI_API_KEY
    if not gemini_key:
        print("GEMINI_API_KEY not found in config, skipping Vision Critic test.")
        return
        
    try:
        response = run_vision_critic(image_bytes, api_key=gemini_key)
        print("Vision Critic Output:")
        print(json.dumps(response.model_dump(), indent=2))
    except Exception as e:
        print(f"Vision critic failed: {e}")

if __name__ == '__main__':
    run_tests()
