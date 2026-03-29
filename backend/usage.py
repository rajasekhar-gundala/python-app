from datetime import datetime, timezone
import httpx
import os
import json

PB_URL = os.getenv("PB_URL", "http://pocketbase:8080")

async def check_usage_limit(tenant_id: str, limit: int = 100):
    """
    Checks if a tenant has exceeded their monthly chat limit.
    Returns (True, count) if under limit, (False, count) if over.
    """
    # 1. Get the start of the current MONTH (YYYY-MM-01 00:00:00)
    # This aligns with your 100-message-per-month business model
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).strftime("%Y-%m-%d %H:%M:%SZ")
    
    # 2. PocketBase filter string
    # We use 'tenantId' to match the schema used in your analytics and main.py
    filter_query = f'tenantId = "{tenant_id}" && created >= "{month_start}"'
    
    async with httpx.AsyncClient() as client:
        # Optimization: perPage=1 and fields="id" to keep memory usage low on 2 vCPUs
        url = f"{PB_URL}/api/collections/chat_history/records"
        params = {
            "filter": filter_query,
            "fields": "id", 
            "perPage": 1
        }
        
        try:
            response = await client.get(url, params=params)
            data = response.json()
            # totalItems is a built-in PocketBase field for the filtered count
            total_items = data.get("totalItems", 0)
            
            return (total_items < limit), total_items
        except Exception as e:
            print(f"⚠️ Usage Check Error: {e}")
            # Fail-safe: Allow the chat if the check fails to maintain user experience
            return True, 0

async def log_chat(tenant_id: str, user_query: str, ai_response: str):
    """
    Logs the conversation to PocketBase in the background.
    """
    url = f"{PB_URL}/api/collections/chat_history/records"
    payload = {
        "tenantId": tenant_id,
        "user_message": user_query,
        "ai_response": ai_response,
        "status": "completed"
    }

    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(url, json=payload)
            if response.status_code != 200:
                print(f"❌ Failed to log chat: {response.text}")
        except Exception as e:
            print(f"⚠️ Background Logging Error: {e}")