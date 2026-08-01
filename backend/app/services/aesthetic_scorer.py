import io
import math
import logging
from PIL import Image, ImageStat

logger = logging.getLogger(__name__)

def score_poster_aesthetic(image_bytes: bytes, elements: list[dict] | None = None) -> float:
    """
    Computes an aesthetic quality score (0.0 to 1.0) for a poster design based on:
    1. Color & Contrast Harmony (luminance variance, saturation balance)
    2. Composition & Spatial Balance (center of mass alignment)
    3. Element Legibility & Breathing Room (coverage ratio)
    """
    if not image_bytes:
        return 0.5

    try:
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        w, h = img.size

        # 1. Luminance & Contrast Score
        stat = ImageStat.Stat(img)
        r, g, b = stat.mean
        luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
        # Ideal poster average luminance is between 40 and 210
        lum_score = 1.0 - (abs(luminance - 125) / 125.0) * 0.5

        # Standard deviation measures contrast/dynamic range
        stddev = stat.stddev
        avg_std = sum(stddev) / len(stddev)
        contrast_score = min(1.0, avg_std / 64.0)

        # 2. Quadrant Balance (Spatial Symmetry)
        half_w, half_h = w // 2, h // 2
        q1 = ImageStat.Stat(img.crop((0, 0, half_w, half_h))).mean
        q2 = ImageStat.Stat(img.crop((half_w, 0, w, half_h))).mean
        q3 = ImageStat.Stat(img.crop((0, half_h, half_w, h))).mean
        q4 = ImageStat.Stat(img.crop((half_w, half_h, w, h))).mean

        q_lum1 = 0.2126 * q1[0] + 0.7152 * q1[1] + 0.0722 * q1[2]
        q_lum2 = 0.2126 * q2[0] + 0.7152 * q2[1] + 0.0722 * q2[2]
        q_lum3 = 0.2126 * q3[0] + 0.7152 * q3[1] + 0.0722 * q3[2]
        q_lum4 = 0.2126 * q4[0] + 0.7152 * q4[1] + 0.0722 * q4[2]

        # Balance score: lower variance between quadrants implies stable balance
        q_avg = (q_lum1 + q_lum2 + q_lum3 + q_lum4) / 4.0
        q_var = sum((ql - q_avg) ** 2 for ql in (q_lum1, q_lum2, q_lum3, q_lum4)) / 4.0
        balance_score = max(0.2, 1.0 - (math.sqrt(q_var) / 128.0))

        # 3. Element Breathing Room / Coverage Score
        coverage_score = 0.85
        if elements:
            total_element_area = sum(el.get("w", 0) * el.get("h", 0) for el in elements)
            canvas_area = max(1, w * h)
            coverage_ratio = total_element_area / canvas_area
            # Ideal coverage is 20% to 55%
            if 0.15 <= coverage_ratio <= 0.60:
                coverage_score = 1.0
            else:
                coverage_score = max(0.3, 1.0 - abs(coverage_ratio - 0.35) * 1.5)

        # Weighted combination
        final_score = (
            lum_score * 0.25 +
            contrast_score * 0.35 +
            balance_score * 0.25 +
            coverage_score * 0.15
        )
        return max(0.0, min(1.0, round(final_score, 3)))

    except Exception as e:
        logger.warning(f"Aesthetic scoring failed: {e}")
        return 0.5
