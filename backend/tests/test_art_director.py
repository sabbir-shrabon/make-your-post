import json
from app.services.art_director import run_art_director
from app.config import MISTRAL_API_KEY

def run_tests():
    # We will use Mistral since it's the default in this codebase
    mistral_key = MISTRAL_API_KEY
    if not mistral_key:
        print("MISTRAL_API_KEY not found in config, skipping Art Director test.")
        return
    
    topics = [
        "A summer discount sale for a local ice cream shop",
        "An inspirational quote about hard work for a fitness brand",
        "A tech conference announcement for AI developers"
    ]
    
    for i, topic in enumerate(topics):
        print(f"\n--- Topic {i+1}: {topic} ---")
        try:
            output = run_art_director(
                topic=topic,
                model="mistral-small-latest",
                provider="mistral",
                api_key=mistral_key
            )
            # Print as formatted JSON
            print(json.dumps(output.model_dump(), indent=2))
        except Exception as e:
            print(f"Error running art director: {e}")

if __name__ == '__main__':
    run_tests()
