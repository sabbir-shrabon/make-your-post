import json
import logging
import base64
from pydantic import BaseModel
from typing import Optional, Literal
from app.providers.llm_providers import generate_text

logger = logging.getLogger(__name__)

class VisionCriticResponse(BaseModel):
    status: Literal["pass", "needs_fix"]
    issue: Optional[str] = None
    target_slot: Optional[str] = None
    suggested_change: Optional[str] = None

def run_vision_critic(
    image_bytes: bytes,
    model: str = "gemini-1.5-pro", # Must be vision capable
    provider: str = "gemini",
    api_key: str = ""
) -> VisionCriticResponse:
    
    b64_image = base64.b64encode(image_bytes).decode('utf-8')
    mime_type = "image/png"
    data_uri = f"data:{mime_type};base64,{b64_image}"

    system_prompt = """You are an expert poster design critic.
Review the provided poster image for visual hierarchy, spacing/breathing room, contrast, clear focal point, and whether anything looks cropped or awkward.
You MUST output ONLY valid JSON matching this schema:
{
  "status": "pass|needs_fix",
  "issue": "description of the problem (if needs_fix)",
  "target_slot": "the slot ID like 'headline', 'background', etc (if needs_fix)",
  "suggested_change": "actionable patch like 'increase overlay opacity on background' or 'shrink headline font 10%' (if needs_fix)"
}
"""

    user_prompt = "Review this poster design and provide your critique in JSON format."

    response_text = generate_text(
        prompt=user_prompt,
        system_prompt=system_prompt,
        model_name=model,
        provider_name=provider,
        api_key=api_key,
        temperature=0.2,
        max_tokens=300,
        images=[data_uri]
    )

    if not response_text:
        return VisionCriticResponse(status="pass")

    cleaned = response_text.strip()
    if "```" in cleaned:
        start = cleaned.find("```json")
        if start != -1:
            start += 7
        else:
            start = cleaned.find("```") + 3
        end = cleaned.rfind("```")
        cleaned = cleaned[start:end].strip()

    try:
        data = json.loads(cleaned)
        return VisionCriticResponse(**data)
    except Exception as e:
        logger.error(f"Vision critic JSON parse failed: {e}. Defaulting to pass.")
        return VisionCriticResponse(status="pass")
