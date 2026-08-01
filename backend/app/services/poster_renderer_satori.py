import os
import json
import base64
import subprocess
import logging
import time
from typing import Dict, List, Any

from app.services.art_director import TEMPLATES, PALETTES, FONT_PAIRS

logger = logging.getLogger(__name__)

# Absolute path to Satori Node.js rendering script
SATORI_SCRIPT_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "tools", "satori_renderer", "render.js"
)

def render_via_satori(props: dict) -> tuple[str, str]:
    """
    Interface to render layout props via Satori (Node.js subprocess).
    Returns tuple: (base64_img_string, output_path_file).
    """
    backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    dry_run_dir = os.path.join(backend_dir, "dry_run_output")
    os.makedirs(dry_run_dir, exist_ok=True)

    output_path = props.get("output_path")
    if not output_path:
        filename = f"poster_satori_{int(time.time())}.png"
        output_path = os.path.join(dry_run_dir, filename)
        props["output_path"] = output_path

    json_str = json.dumps(props)

    try:
        proc = subprocess.run(
            ["node", SATORI_SCRIPT_PATH],
            input=json_str,
            text=True,
            capture_output=True,
            check=True
        )
        base64_img = proc.stdout.strip()
        return base64_img, output_path
    except subprocess.CalledProcessError as exc:
        logger.error(f"Satori rendering subprocess failed: {exc.stderr}")
        raise RuntimeError(f"Satori render failed: {exc.stderr}") from exc


def render_poster_to_base64_satori(
    elements: List[Dict],
    template_id: str,
    palette_id: str,
    font_pair_id: str,
    canvas_w: int,
    canvas_h: int,
    overlay_opacity: float,
    background_choice: Dict | None = None,
) -> tuple[str, str]:
    """
    Signature adapter matching Pillow's render_poster_to_base64.
    """
    palette = next((p for p in PALETTES if p["id"] == palette_id), PALETTES[0])
    font_pair = next((fp for fp in FONT_PAIRS if fp["id"] == font_pair_id), FONT_PAIRS[0])

    props = {
        "elements": elements,
        "template_id": template_id,
        "palette_id": palette_id,
        "font_pair_id": font_pair_id,
        "palette": palette,
        "font_pair": font_pair,
        "canvas_w": canvas_w,
        "canvas_h": canvas_h,
        "overlay_opacity": overlay_opacity,
        "background_choice": background_choice,
    }

    return render_via_satori(props)
