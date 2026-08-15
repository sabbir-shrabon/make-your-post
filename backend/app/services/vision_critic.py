import json
import logging
import base64
from pydantic import BaseModel
from typing import Optional, Literal
from app.providers.llm_providers import generate_text
from app.config import MISTRAL_API_KEY

logger = logging.getLogger(__name__)

class VisionCriticResponse(BaseModel):
    status: Literal["pass", "needs_fix"]
    issue: Optional[str] = None
    target_slot: Optional[str] = None
    suggested_change: Optional[str] = None

def run_vision_critic(
    image_bytes: bytes,
    model: str = "pixtral-12b-2409" if MISTRAL_API_KEY else "gemini-2.0-flash",
    provider: str = "mistral" if MISTRAL_API_KEY else "gemini",
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

    try:
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
    except Exception as exc:
        logger.info(f"Vision critic multimodal call skipped ({exc}), defaulting to pass.")
        return VisionCriticResponse(status="pass")

    if not response_text or not response_text.strip():
        return VisionCriticResponse(status="pass")

    cleaned = response_text.strip()
    if "```" in cleaned:
        start = cleaned.find("```json")
        if start != -1:
            start += 7
        else:
            start = cleaned.find("```") + 3
        end = cleaned.rfind("```")
        if end != -1 and end > start:
            cleaned = cleaned[start:end].strip()

    # Match first '{' to last '}' to strip any conversational preamble/postamble
    brace_start = cleaned.find("{")
    brace_end = cleaned.rfind("}")
    if brace_start != -1 and brace_end != -1 and brace_end > brace_start:
        cleaned = cleaned[brace_start:brace_end + 1]

    if not cleaned:
        return VisionCriticResponse(status="pass")

    try:
        data = json.loads(cleaned)
        return VisionCriticResponse(**data)
    except Exception as e:
        logger.info(f"Vision critic raw response non-JSON ({e}), defaulting to pass.")
        return VisionCriticResponse(status="pass")

