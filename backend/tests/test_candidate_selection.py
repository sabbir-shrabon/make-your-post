import sys
import os
import json

try:
    from app.services.aesthetic_scorer import score_poster_aesthetic
except ImportError:
    from backend.app.services.aesthetic_scorer import score_poster_aesthetic

from PIL import Image, ImageDraw
import io

def test_aesthetic_scorer():
    print("--- Test F: Aesthetic Scorer Unit Test ---")
    # 1. Create a well-balanced image
    img_good = Image.new("RGB", (1080, 1080), color=(30, 30, 30))
    draw = ImageDraw.Draw(img_good)
    draw.rectangle([100, 100, 980, 400], fill=(240, 240, 240))
    
    buf_good = io.BytesIO()
    img_good.save(buf_good, format="PNG")
    bytes_good = buf_good.getvalue()
    
    elements_good = [
        {"x": 100, "y": 100, "w": 880, "h": 300}
    ]
    
    score_good = score_poster_aesthetic(bytes_good, elements_good)
    print(f"Aesthetic score for balanced poster: {score_good:.3f}")
    assert 0.0 <= score_good <= 1.0, "Score should be between 0.0 and 1.0"
    
    # 2. Create a blank image with zero elements
    img_blank = Image.new("RGB", (1080, 1080), color=(0, 0, 0))
    buf_blank = io.BytesIO()
    img_blank.save(buf_blank, format="PNG")
    score_blank = score_poster_aesthetic(buf_blank.getvalue(), [])
    print(f"Aesthetic score for blank poster: {score_blank:.3f}")
    assert 0.0 <= score_blank <= 1.0, "Score should be bounded"
    
    print("Aesthetic Scorer unit test passed successfully!\n")

if __name__ == '__main__':
    test_aesthetic_scorer()
