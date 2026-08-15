"""
compound_primitives.py
----------------------
Smart Compound Design Primitives for Canva-grade Poster Composition.

Transforms bare strings and primitive rectangles into cohesive atomic components:
- PillButton (Container + Padding + Contrast Fill + Text + Optional Icon)
- StarburstBadge (Starburst Vector + Curved/Centered Badge Text)
- ArchedBanner (Curved Banner Vector + Centered Headline)
- FocalHeroBlock (Sun/Spotlight Disc + Stage Brackets + Hero Headline)
- MetricCallout (Oversized Hero Number + Accent Label Pill)
"""

from __future__ import annotations

import logging
from typing import Dict, Any, Optional
from pydantic import BaseModel, Field

from app.services.vector_assets import get_vector_asset_svg

logger = logging.getLogger(__name__)


class PillButtonProps(BaseModel):
    text: str
    icon: Optional[str] = "lucide:arrow-right"
    bg_color: str = "#0D9488"
    text_color: str = "#FFFFFF"
    font_size: int = 28
    font_weight: str = "bold"
    border_radius: int = 9999
    padding_x: int = 36
    padding_y: int = 18
    shadow: bool = True


class StarburstBadgeProps(BaseModel):
    badge_text: str
    shape_id: str = "starburst-badge"
    bg_color: str = "#EF4444"
    text_color: str = "#FFFFFF"
    rotation: int = -5
    font_size: int = 24


class ArchedBannerProps(BaseModel):
    banner_text: str
    bg_color: str = "#0D9488"
    text_color: str = "#FFFFFF"
    font_size: int = 24


class CompoundPrimitivesFactory:
    """Factory to generate structured Satori HTML-like objects and Pillow layer instructions."""

    @staticmethod
    def create_pill_button_satori(props: PillButtonProps, x: int, y: int, max_w: int = 600) -> Dict[str, Any]:
        """Constructs a high-converting pill button component for Satori."""
        return {
            "type": "div",
            "props": {
                "style": {
                    "position": "absolute",
                    "left": f"{x}px",
                    "top": f"{y}px",
                    "display": "flex",
                    "alignItems": "center",
                    "justifyContent": "center",
                    "backgroundColor": props.bg_color,
                    "color": props.text_color,
                    "padding": f"{props.padding_y}px {props.padding_x}px",
                    "borderRadius": f"{props.border_radius}px",
                    "fontSize": f"{props.font_size}px",
                    "fontWeight": 700,
                    "boxShadow": "0 10px 25px -5px rgba(0, 0, 0, 0.35), 0 8px 10px -6px rgba(0, 0, 0, 0.2)" if props.shadow else "none",
                    "letterSpacing": "0.05em",
                    "textTransform": "uppercase",
                },
                "children": [
                    {
                        "type": "span",
                        "props": {
                            "style": {"marginRight": "10px" if props.icon else "0"},
                            "children": props.text,
                        }
                    },
                    # Trailing arrow if requested
                    props.icon and {
                        "type": "span",
                        "props": {
                            "style": {"fontSize": f"{int(props.font_size * 0.9)}px"},
                            "children": "→"
                        }
                    }
                ]
            }
        }

    @staticmethod
    def create_badge_satori(
        badge_text: str,
        shape_id: str = "starburst-badge",
        bg_color: str = "#EF4444",
        text_color: str = "#FFFFFF",
        x: int = 800,
        y: int = 80,
        size: int = 180,
        rotation: int = 0,
    ) -> Optional[Dict[str, Any]]:
        """Constructs an atomic badge component. Drops cleanly if badge_text is empty."""
        clean_text = (badge_text or "").strip()
        if not clean_text:
            return None

        # Fetch underlying SVG with dynamic color
        svg_code = get_vector_asset_svg(shape_id, {
            "accent": bg_color,
            "primary": bg_color,
            "text_on_dark": text_color,
        })

        return {
            "type": "div",
            "props": {
                "style": {
                    "position": "absolute",
                    "left": f"{x}px",
                    "top": f"{y}px",
                    "width": f"{size}px",
                    "height": f"{size}px",
                    "display": "flex",
                    "alignItems": "center",
                    "justifyContent": "center",
                    "transform": f"rotate({rotation}deg)",
                },
                "children": [
                    # SVG Backdrop
                    svg_code and {
                        "type": "div",
                        "props": {
                            "style": {
                                "position": "absolute",
                                "left": "0",
                                "top": "0",
                                "width": "100%",
                                "height": "100%",
                                "display": "flex",
                            },
                            "dangerouslySetInnerHTML": {"__html": svg_code}
                        }
                    },
                    # Centered Text
                    {
                        "type": "div",
                        "props": {
                            "style": {
                                "position": "relative",
                                "zIndex": 2,
                                "color": text_color,
                                "fontSize": f"{int(size * 0.15)}px",
                                "fontWeight": 800,
                                "textAlign": "center",
                                "textTransform": "uppercase",
                                "padding": "10px",
                                "lineHeight": 1.1,
                            },
                            "children": clean_text
                        }
                    }
                ]
            }
        }
