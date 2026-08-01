import os
import uuid
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app import models
from app.auth import get_current_user
from app.database import get_db

router = APIRouter(tags=["pexels"])

class StockPhotoImportRequest(BaseModel):
    photo_id: int
    photographer: str | None = None
    image_url: str

@router.get("/api/stock-photos")
async def search_stock_photos(query: str, page: int = 1):
    photos = []
    
    # Try Pexels first
    pexels_key = os.getenv("PEXELS_API_KEY")
    if pexels_key:
        url = "https://api.pexels.com/v1/search"
        headers = {"Authorization": pexels_key}
        params = {"query": query, "page": page, "per_page": 24}
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(url, headers=headers, params=params)
                
            if response.status_code == 200:
                data = response.json()
                photos = [
                    {
                        "id": photo["id"],
                        "photographer": photo["photographer"],
                        "thumbnail": photo["src"]["medium"],
                        "large": photo["src"]["large2x"],
                        "source": "pexels"
                    }
                    for photo in data.get("photos", [])
                ]
        except Exception:
            pass

    # Fallback to Unsplash if no photos found
    if not photos:
        unsplash_key = os.getenv("UNSPLASH_API_KEY")
        if unsplash_key:
            url = "https://api.unsplash.com/search/photos"
            headers = {"Authorization": f"Client-ID {unsplash_key}"}
            params = {"query": query, "page": page, "per_page": 24}
            
            try:
                async with httpx.AsyncClient() as client:
                    response = await client.get(url, headers=headers, params=params)
                    
                if response.status_code == 200:
                    data = response.json()
                    photos = [
                        {
                            "id": photo["id"],
                            "photographer": photo["user"]["name"],
                            "thumbnail": photo["urls"]["regular"],
                            "large": photo["urls"]["full"],
                            "source": "unsplash"
                        }
                        for photo in data.get("results", [])
                    ]
            except Exception:
                pass

    if not photos:
        # We don't throw 500 anymore so that the frontend can gracefully handle 0 results
        # However if both keys are missing, we could throw 500 or just return empty
        if not pexels_key and not os.getenv("UNSPLASH_API_KEY"):
            raise HTTPException(status_code=500, detail="No stock photo API keys configured.")
            
    return {"photos": photos}

@router.post("/api/stock-photos/import")
async def import_stock_photo(
    payload: StockPhotoImportRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    label = payload.photographer or f"Pexels photo {payload.photo_id}"
    asset = models.TemplateBackgroundAsset(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        type="image",
        label=label,
        preview_url=payload.image_url,
        config={"url": payload.image_url, "fit": "cover", "source": "pexels", "source_id": payload.photo_id},
        created_at=datetime.now(timezone.utc),
    )

    db.add(asset)
    db.commit()
    db.refresh(asset)

    return {
        "id": asset.id,
        "asset_type": asset.type,
        "type": asset.type,
        "label": asset.label,
        "preview_url": asset.preview_url,
        "config": asset.config or {},
        "value_json": asset.config or {},
    }
