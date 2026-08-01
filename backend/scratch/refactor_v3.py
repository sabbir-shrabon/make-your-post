import ast
import re

file_path = 'd:/my projects/my research/auto_poster_agentic_ai/backend/app/routers/persona_image_templates.py'
with open(file_path, 'r', encoding='utf8') as f:
    lines = f.readlines()

src = "".join(lines)
tree = ast.parse(src)

target_funcs = {
    "_get_font_family_name",
    "render_text_layer_pango",
    "register_fonts_with_fontconfig",
    "verify_pango_bengali",
    "_lerp_channel",
    "_lerp_hex",
    "_render_gradient_background",
    "_resolve_font_path",
    "_detect_script",
    "_font_candidates_for_script",
    "_get_font_for_text",
    "_get_font_for_asset",
    "_load_background_asset_image",
    "_layer_rotation_degrees",
    "_composite_layer_onto_base",
    "_assemble_manual_template_preview",
    "_pct",
    "_parse_hex_color",
    "_srgb_to_linear",
    "_relative_luminance",
    "analyze_zone_luminance",
    "_calculate_contrast_ratio",
    "_get_font",
    "_fit_within",
    "_download_bytes",
    "_first_option",
    "_merge_llm_instructions_with_overrides",
    "_image_to_png_bytes",
    "_assemble_from_llm_instructions",
    "_assemble_template_image"
}

to_move = []
for node in tree.body:
    if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
        if node.name in target_funcs:
            to_move.append((node.name, node.lineno, node.end_lineno))

to_move.sort(key=lambda x: x[1], reverse=True)

extracted_code_blocks = []
for name, start, end in sorted(to_move, key=lambda x: x[1]):
    extracted_code_blocks.append("".join(lines[start-1:end]) + "\n")

pango_lines = lines[15:56]
keep_lines = [True] * len(lines)
for i in range(15, 56):
    keep_lines[i] = False

placeholder_start = -1
for i, line in enumerate(lines):
    if line.startswith('_PLACEHOLDER_BY_ROLE = {'):
        placeholder_start = i
    if placeholder_start != -1 and line.startswith('}'):
        for j in range(placeholder_start, i+1):
            keep_lines[j] = False
        break

for name, start, end in to_move:
    for i in range(start-1, end):
        keep_lines[i] = False

new_lines = [lines[i] for i in range(len(lines)) if keep_lines[i]]

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

renderer_code = header + ''.join(pango_lines) + '\nlogger = logging.getLogger(__name__)\n\n_PLACEHOLDER_BY_ROLE = {\n    "headline": "Your Headline Here",\n    "subheadline": "Supporting text goes here",\n    "body": "Body text example",\n}\n\n' + "".join(extracted_code_blocks)

with open('d:/my projects/my research/auto_poster_agentic_ai/backend/app/services/prompt_studio_renderer.py', 'w', encoding='utf8') as f:
    f.write(renderer_code)

import_stmt = f"from app.services.prompt_studio_renderer import ({', '.join(target_funcs)}, PANGO_AVAILABLE)\n"

final_lines = []
for line in new_lines:
    final_lines.append(line)
    if "from app.providers.user_model_settings import generate_post_text_for_user" in line:
        final_lines.append(import_stmt)

with open('d:/my projects/my research/auto_poster_agentic_ai/backend/app/routers/persona_image_templates.py', 'w', encoding='utf8') as f:
    f.write(''.join(final_lines))

print("Extraction complete. prompt_studio_renderer.py created and persona_image_templates.py updated.")
