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
    "_image_to_png_bytes",
    "_assemble_from_llm_instructions",
    "_assemble_template_image"
}

to_move = []
for node in tree.body:
    if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
        if node.name in target_funcs:
            to_move.append((node.name, node.lineno, node.end_lineno))

# Sort in descending order to delete from bottom up without messing up line numbers
to_move.sort(key=lambda x: x[1], reverse=True)

extracted_code_blocks = []
for name, start, end in sorted(to_move, key=lambda x: x[1]):
    extracted_code_blocks.append("".join(lines[start-1:end]) + "\n")

# Now delete from the file
new_lines = list(lines)
for name, start, end in to_move:
    del new_lines[start-1:end]
    
# Remove the Pango import block and gvsbuild block from the top and put them in the new file
# The block is lines 16 to 55 approximately. We will do this manually in the next step.

with open('d:/my projects/my research/auto_poster_agentic_ai/backend/scratch/extracted_funcs.py', 'w', encoding='utf8') as f:
    f.write("".join(extracted_code_blocks))

with open('d:/my projects/my research/auto_poster_agentic_ai/backend/scratch/stripped_router.py', 'w', encoding='utf8') as f:
    f.write("".join(new_lines))

print("Extraction complete.")
