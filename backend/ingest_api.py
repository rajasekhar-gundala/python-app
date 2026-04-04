import httpx
from vector_store import add_to_kb, embed_model
from utils import update_tenant_status  # 👉 IMPORT THE HELPER

async def ingest_external_api(tenant_id: str, api_url: str, headers: dict = None):
    print(f"Starting API sync from {api_url} for {tenant_id}...", flush=True)
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.get(api_url, headers=headers)
            response.raise_for_status()
            data = response.json()

            items = data if isinstance(data, list) else [data]
            
            text_chunks = []
            for item in items:
                chunk = ". ".join([f"{k}: {v}" for k, v in item.items() if v])
                text_chunks.append(chunk)

            if text_chunks:
                add_to_kb(tenant_id, text_chunks, source=api_url)
                
            # 👉 Mark as completed
            update_tenant_status(tenant_id, "completed")
            print(f"✅ API sync completed for {tenant_id}", flush=True)
            return {"status": "success", "count": len(text_chunks)}

        except Exception as e:
            print(f"❌ API Ingestion Error: {e}", flush=True)
            # 👉 Mark as error
            update_tenant_status(tenant_id, "error")
            return {"status": "error", "message": str(e)}