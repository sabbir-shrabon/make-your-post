"""
icon_renderer.py — Rasterize Iconify SVG icons to PIL Images.

Resolution order:
  1. Local bundled SVG   (assets/icons/{prefix}/{name}.svg)
  2. Live Iconify fetch  (api.iconify.design/{prefix}/{name}.svg)
     → cached on disk for next time
  3. Bundled default.svg (assets/icons/default.svg)

Uses CairoSVG for SVG → PNG conversion.
"""

import io
import logging
import os
import urllib.request

from PIL import Image

logger = logging.getLogger(__name__)

ASSETS_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "assets", "icons",
)

ICONIFY_SVG_URL = "https://api.iconify.design/{prefix}/{name}.svg"
FETCH_TIMEOUT = 3  # seconds


def _local_svg_path(prefix: str, name: str) -> str:
    """Return the expected local path for a given icon."""
    return os.path.join(ASSETS_DIR, prefix, f"{name}.svg")


def _read_local_svg(prefix: str, name: str) -> bytes | None:
    """Read a locally-cached SVG file, or return None."""
    path = _local_svg_path(prefix, name)
    if os.path.isfile(path):
        try:
            with open(path, "rb") as f:
                return f.read()
        except Exception:
            pass
    return None


def _fetch_and_cache_svg(prefix: str, name: str, run_id: str = "") -> bytes | None:
    """Fetch an SVG from the Iconify API and cache it locally. Returns None on failure."""
    url = ICONIFY_SVG_URL.format(prefix=prefix, name=name)
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=FETCH_TIMEOUT) as resp:
            svg_bytes = resp.read()

        if not svg_bytes or b"<svg" not in svg_bytes.lower():
            logger.warning("[run=%s] Iconify returned non-SVG for %s:%s", run_id, prefix, name)
            return None

        # Cache for next time
        target_dir = os.path.join(ASSETS_DIR, prefix)
        os.makedirs(target_dir, exist_ok=True)
        target_path = _local_svg_path(prefix, name)
        try:
            with open(target_path, "wb") as f:
                f.write(svg_bytes)
            logger.info("[run=%s] Fetched & cached icon: %s:%s → %s", run_id, prefix, name, target_path)
        except Exception as exc:
            logger.warning("[run=%s] Icon fetched but cache write failed: %s", run_id, exc)

        return svg_bytes

    except Exception as exc:
        logger.warning("[run=%s] Live Iconify fetch failed for %s:%s: %s", run_id, prefix, name, exc)
        return None


def _read_default_svg() -> bytes | None:
    """Read the bundled default fallback SVG."""
    path = os.path.join(ASSETS_DIR, "default.svg")
    if os.path.isfile(path):
        try:
            with open(path, "rb") as f:
                return f.read()
        except Exception:
            pass
    return None


def _inject_color(svg_bytes: bytes, color: str) -> bytes:
    """Replace 'currentColor' in SVG with a specific hex color."""
    svg_str = svg_bytes.decode("utf-8", errors="replace")
    svg_str = svg_str.replace("currentColor", color)
    return svg_str.encode("utf-8")


def _svg_to_pil(svg_bytes: bytes, w: int, h: int) -> Image.Image | None:
    """Convert SVG bytes to a PIL RGBA Image using CairoSVG."""
    try:
        import cairosvg
        png_bytes = cairosvg.svg2png(
            bytestring=svg_bytes,
            output_width=w,
            output_height=h,
        )
        return Image.open(io.BytesIO(png_bytes)).convert("RGBA")
    except ImportError:
        logger.error("cairosvg is not installed — cannot rasterize SVG icons. "
                     "Install with: pip install cairosvg")
        return None
    except Exception as exc:
        logger.warning("SVG rasterization failed: %s", exc)
        return None


def rasterize_icon(
    icon_id: str,
    w: int,
    h: int,
    color: str = "#FFFFFF",
    run_id: str = "",
) -> Image.Image | None:
    """
    Rasterize an Iconify icon ID (e.g. 'lucide:pizza') to a PIL Image.

    Resolution order:
      1. Local bundled SVG
      2. Live Iconify fetch (cached on success)
      3. Bundled default.svg
      4. None (should never reach this)

    Returns an RGBA PIL Image of size (w, h), or None on total failure.
    """
    # Parse icon ID
    if ":" in icon_id:
        prefix, name = icon_id.split(":", 1)
    else:
        prefix, name = "lucide", icon_id

    # 1. Try local bundled SVG
    svg_bytes = _read_local_svg(prefix, name)
    source = "local"

    # 2. Try live Iconify fetch
    if svg_bytes is None:
        svg_bytes = _fetch_and_cache_svg(prefix, name, run_id=run_id)
        source = "fetched"

    # 3. Fallback to default.svg
    if svg_bytes is None:
        svg_bytes = _read_default_svg()
        source = "default"
        if svg_bytes:
            logger.info("[run=%s] Using default fallback icon for %s:%s", run_id, prefix, name)

    if svg_bytes is None:
        logger.error("[run=%s] No SVG available at all for %s:%s (even default.svg missing)", run_id, prefix, name)
        return None

    # Inject color and rasterize
    colored_svg = _inject_color(svg_bytes, color)
    result = _svg_to_pil(colored_svg, w, h)

    if result:
        logger.debug("[run=%s] Icon rasterized: %s:%s (%s) → %dx%d", run_id, prefix, name, source, w, h)

    return result
