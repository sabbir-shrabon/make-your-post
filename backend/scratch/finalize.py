import os

router_path = 'd:/my projects/my research/auto_poster_agentic_ai/backend/app/routers/persona_image_templates.py'
with open(router_path, 'r', encoding='utf8') as f:
    router_lines = f.readlines()

pango_lines = router_lines[15:56]

header = """from __future__ import annotations

import base64
import io
import json
import logging
import os
import uuid
import math
from datetime import datetime, timezone

from PIL import Image, ImageDraw, ImageFont, ImageOps
from sqlalchemy.orm import Session
import httpx

from app import models, schemas, design_system_data
from app.config import SUPABASE_URL, SUPABASE_SERVICE_KEY

"""

with open('d:/my projects/my research/auto_poster_agentic_ai/backend/scratch/extracted_funcs.py', 'r', encoding='utf8') as f:
    funcs_code = f.read()

renderer_code = header + ''.join(pango_lines) + '\nlogger = logging.getLogger(__name__)\n\n_PLACEHOLDER_BY_ROLE = {\n    "headline": "Your Headline Here",\n    "subheadline": "Supporting text goes here",\n    "body": "Body text example",\n}\n\n' + funcs_code

with open('d:/my projects/my research/auto_poster_agentic_ai/backend/app/services/prompt_studio_renderer.py', 'w', encoding='utf8') as f:
    f.write(renderer_code)

with open('d:/my projects/my research/auto_poster_agentic_ai/backend/scratch/stripped_router.py', 'r', encoding='utf8') as f:
    stripped_lines = f.readlines()
    
# Remove the pango_lines and _PLACEHOLDER_BY_ROLE from stripped_lines
new_stripped = []
skip = False
for line in stripped_lines:
    if line in pango_lines:
        continue
    if line.startswith('_PLACEHOLDER_BY_ROLE = {'):
        skip = True
        continue
    if skip:
        if line.startswith('}'):
            skip = False
        continue
    new_stripped.append(line)
    
# Find the exact import block
import_stmt = """from app.services.prompt_studio_renderer import (
    render_text_layer_pango, _render_gradient_background, _composite_layer_onto_base,
    _assemble_manual_template_preview, _assemble_from_llm_instructions, _assemble_template_image,
    analyze_zone_luminance, _image_to_png_bytes, _load_background_asset_image, _validate_background_override,
    _fit_within, _get_font_for_text, PANGO_AVAILABLE, _get_font_family_name, _lerp_channel, _lerp_hex,
    _resolve_font_path, _detect_script, _font_candidates_for_script, _get_font_for_asset, _layer_rotation_degrees,
    _pct, _parse_hex_color, _srgb_to_linear, _relative_luminance, _calculate_contrast_ratio, _get_font
)
"""

# wait, we must also import `_download_bytes` because `_load_background_asset_image` might use it. 
# actually let's see if `_download_bytes` was extracted. It was not in target_funcs! Let's check `_download_bytes` line number. I will add it to the import if it stays in router, but wait, `_load_background_asset_image` calls `_download_bytes`. `_download_bytes` is NOT moved.
# Let's import `_download_bytes` in prompt_studio_renderer!
# Ah, this means prompt_studio_renderer needs to import `_download_bytes` from `persona_image_templates`? That causes circular import!
# Let me just move `_download_bytes` to `prompt_studio_renderer.py` as well.
