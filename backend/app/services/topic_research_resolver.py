import logging
import os
import httpx
from sqlalchemy.orm import Session
from app.providers.llm_providers import generate_text_for_user

logger = logging.getLogger(__name__)

def _fetch_serpapi_google_news(query: str, api_key: str) -> tuple[str | None, str | None]:
    endpoint = "https://serpapi.com/search"
    params = {
        "engine": "google_news",
        "q": query,
        "api_key": api_key,
        "gl": "us",
        "hl": "en"
    }
    try:
        response = httpx.get(endpoint, params=params, timeout=10.0)
        response.raise_for_status()
        data = response.json()
        news_results = data.get("news_results", [])
        if not news_results:
            return None, None
            
        top_result = news_results[0]
        title = top_result.get("title", "")
        snippet = top_result.get("snippet", "")
        link = top_result.get("link", "")
        
        angle_hint = f"Title: {title}"
        if snippet:
            angle_hint += f"\nSummary: {snippet}"
            
        source_log = f"Source: {link} - '{title}' (Distilled Query: '{query}') via SerpApi Google News"
        return angle_hint, source_log
    except Exception as e:
        logger.warning(f"SerpApi Google News failed: {e}")
        return None, None

def _fetch_bing_news(query: str, api_key: str) -> tuple[str | None, str | None]:
    endpoint = "https://api.bing.microsoft.com/v7.0/news/search"
    headers = {"Ocp-Apim-Subscription-Key": api_key}
    params = {"q": query, "count": 1, "sortBy": "Date"}
    try:
        response = httpx.get(endpoint, headers=headers, params=params, timeout=10.0)
        response.raise_for_status()
        data = response.json()
        results = data.get("value", [])
        if not results:
            return None, None
        top_result = results[0]
        angle_hint = f"Title: {top_result.get('name')}\nSummary: {top_result.get('description')}"
        source_log = f"Source: {top_result.get('url')} - '{top_result.get('name')}' (Distilled Query: '{query}') via Bing"
        return angle_hint, source_log
    except Exception as e:
        logger.warning(f"Bing News Search failed: {e}")
        return None, None

def research_topic_angle(
    niche: str,
    user_id: int | None = None,
    db: Session | None = None
) -> tuple[str | None, str | None]:
    """
    Distills a long persona niche into a short search query and fetches current news.
    Tries SerpApi Google News first, then falls back to Bing News API.
    Returns (angle_hint, source_snippet_log) on success, or (None, None) on failure.
    """
    try:
        distillation_prompt = (
            "Extract the core subject matter from the following persona description into a "
            "short, punchy 1 to 3 word search query suitable for a news API. "
            "Return ONLY the search query text, nothing else.\n\n"
            f"Persona Description: {niche}"
        )
        search_query = generate_text_for_user(
            user_id=user_id,
            task_category="topic_research",
            prompt=distillation_prompt,
            db=db,
            temperature=0.3,
            max_tokens=20
        )
        if not search_query:
            return None, None
            
        search_query = search_query.strip(' \n\r\'"')
        if not search_query:
            return None, None
            
        serpapi_key = os.getenv("SERPAPI_API_KEY")
        if serpapi_key:
            angle_hint, source_log = _fetch_serpapi_google_news(search_query, serpapi_key)
            if angle_hint:
                return angle_hint, source_log
                
        bing_api_key = os.getenv("BING_SEARCH_API_KEY")
        if bing_api_key:
            angle_hint, source_log = _fetch_bing_news(search_query, bing_api_key)
            if angle_hint:
                return angle_hint, source_log
                
        return None, None
        
    except Exception as exc:
        logger.warning(f"Topic research failed for niche: {exc}")
        return None, None
