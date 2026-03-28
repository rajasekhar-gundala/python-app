import httpx
import pandas as pd
from vector_store import add_to_kb, embed_model

async def ingest_external_api(tenant_id: str, api_url: str, headers: dict = None):
    """
    Fetches JSON from an external API, converts it to text chunks, 
    and stores it in the tenant's LanceDB table.
    """
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.get(api_url, headers=headers)
            response.raise_for_status()
            data = response.json()

            # 1. Convert JSON to a list of strings
            # If the API returns a list of items, we process each.
            # If it's a single object, we wrap it in a list.
            items = data if isinstance(data, list) else [data]
            
            text_chunks = []
            for item in items:
                # Flatten the JSON object into a string format the LLM can understand
                # Example: "Product: iPhone 15, Price: $999, Description: ..."
                chunk = ". ".join([f"{k}: {v}" for k, v in item.items() if v])
                text_chunks.append(chunk)

            # 2. Add to LanceDB in batches to save RAM
            if text_chunks:
                add_to_kb(tenant_id, text_chunks, source=api_url)
                return {"status": "success", "count": len(text_chunks)}
            
            return {"status": "empty", "count": 0}

        except Exception as e:
            print(f"API Ingestion Error: {e}")
            return {"status": "error", "message": str(e)}
