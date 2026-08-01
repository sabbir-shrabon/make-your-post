import os
import random
from urllib.parse import quote, urlparse

import httpx
from fastapi import APIRouter, HTTPException, Query, Response

router = APIRouter(tags=["cats"])

_ALLOWED_CAT_IMAGE_HOSTS = {"cdn.thecatapi.com", "cdn2.thecatapi.com"}


def _cat_api_headers() -> dict[str, str]:
    cat_api_key = os.getenv("CAT_API_KEY")
    return {"x-api-key": cat_api_key} if cat_api_key else {}


def _validate_cat_image_url(url: str) -> str:
    parsed = urlparse(url)
    if parsed.scheme != "https" or parsed.netloc.lower() not in _ALLOWED_CAT_IMAGE_HOSTS:
        raise HTTPException(status_code=400, detail="Invalid cat image URL.")
    return url


@router.get("/api/cat-photos")
async def get_cat_photos(
    limit: int = Query(default=24, ge=1, le=48),
    page: int = Query(default=1, ge=1, le=10),
    mime_types: str = Query(default="jpg,png"),
    size: str = Query(default="med"),
):
    params = {
        "limit": limit,
        "mime_types": mime_types,
        "size": size,
        "page": page,
        "sub_id": str(random.randint(1, 10000)),
    }

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.get(
                "https://api.thecatapi.com/v1/images/search",
                headers=_cat_api_headers(),
                params=params,
            )
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail="Failed to fetch cat images from The Cat API.") from exc

    if response.status_code != 200:
        raise HTTPException(status_code=response.status_code, detail="Failed to fetch cat images.")

    try:
        payload = response.json()
    except ValueError as exc:
        raise HTTPException(status_code=500, detail="Invalid response from The Cat API") from exc

    if not isinstance(payload, list):
        raise HTTPException(status_code=500, detail="Unexpected response shape from The Cat API")

    photos = []
    for item in payload:
        if not isinstance(item, dict):
            continue
        original_url = str(item.get("url") or "")
        if not original_url:
            continue
        _validate_cat_image_url(original_url)
        photos.append(
            {
                "id": str(item.get("id") or original_url),
                "url": f"/api/cat-photos/proxy?url={quote(original_url, safe='')}",
                "original_url": original_url,
                "width": item.get("width") or 400,
                "height": item.get("height") or 400,
            }
        )

    return photos


@router.get("/api/cat-photos/proxy")
async def proxy_cat_photo(url: str = Query(...)):
    image_url = _validate_cat_image_url(url)

    try:
        async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
            response = await client.get(image_url)
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail="Failed to load cat image.") from exc

    if response.status_code != 200:
        raise HTTPException(status_code=response.status_code, detail="Failed to load cat image.")

    content_type = response.headers.get("content-type", "")
    if not content_type.startswith("image/"):
        raise HTTPException(status_code=502, detail="Cat image response was not an image.")

    return Response(
        content=response.content,
        media_type=content_type,
        headers={"Cache-Control": "public, max-age=86400"},
    )