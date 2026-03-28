from datetime import datetime, timezone
import httpx
import os

PB_URL = os.getenv("PB_URL", "http://pocketbase:8080")

async def check_usage_limit(tenant_id: str, limit: int = 100):
    """
    Checks if a tenant has exceeded their daily chat limit.
    Returns (True, count) if under limit, (False, count) if over.
    """
    # Get the start of the current day in ISO format (YYYY-MM-DD 00:00:00)
    today_start = datetime.now(timezone.utc).strftime("%Y-%m-%d 00:00:00")
    
    # PocketBase filter string
    filter_query = f'tenant="{tenant_id}" && created >= "{today_start}"'
    
    async with httpx.AsyncClient() as client:
        # We only need the total count, so we set perPage=1
        url = f"{PB_URL}/api/collections/chat_logs/records"
        params = {
            "filter": filter_query,
            "fields": "id",
            "perPage": 1
        }
        
        try:
            response = await client.get(url, params=params)
            data = response.json()
            total_items = data.get("totalItems", 0)
            
            return (total_items < limit), total_items
        except Exception as e:
            print(f"Usage Check Error: {e}")
            return True, 0 # Default to allow if DB is down to avoid blocking users
