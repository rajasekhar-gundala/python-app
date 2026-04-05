from datetime import datetime, timezone
import httpx
import os
import json

PB_URL = os.getenv("PB_URL", "http://pocketbase:8080")
PB_ADMIN_EMAIL = os.getenv("PB_ADMIN_EMAIL", "admin@example.com")
PB_ADMIN_PASSWORD = os.getenv("PB_ADMIN_PASSWORD", "your_secure_password")

async def get_admin_headers(client: httpx.AsyncClient):
    try:
        auth_url = f"{PB_URL}/api/collections/_superusers/auth-with-password"
        response = await client.post(auth_url, json={
            "identity": PB_ADMIN_EMAIL,
            "password": PB_ADMIN_PASSWORD
        })
        response.raise_for_status()
        token = response.json().get("token")
        return {"Authorization": f"Bearer {token}"}
    except Exception as e:
        print(f"⚠️ Admin Auth Error: Failed to get token. {e}")
        return {}

async def check_usage_limit(tenant_id: str, limit: int = 100):
    async with httpx.AsyncClient() as client:
        headers = await get_admin_headers(client)
        try:
            tenant_url = f"{PB_URL}/api/collections/tenants/records/{tenant_id}"
            tenant_res = await client.get(tenant_url, headers=headers)
            if tenant_res.status_code == 200:
                tenant_data = tenant_res.json()
                if tenant_data.get("plan_type") == "pro":
                    return True, "unlimited"
        except Exception as e:
            print(f"⚠️ Failed to check tenant plan: {e}")

        now = datetime.now(timezone.utc)
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).strftime("%Y-%m-%d %H:%M:%SZ")
        filter_query = f'tenantId = "{tenant_id}" && created >= "{month_start}"'
        
        url = f"{PB_URL}/api/collections/chat_history/records"
        params = {
            "filter": filter_query,
            "fields": "id", 
            "perPage": 1
        }
        
        try:
            response = await client.get(url, params=params, headers=headers)
            if response.status_code != 200:
                return True, 0
            data = response.json()
            total_items = data.get("totalItems", 0)
            return (total_items < limit), total_items
        except Exception as e:
            print(f"⚠️ Usage Check Error: {e}")
            return True, 0

async def log_chat(tenant_id: str, user_query: str, ai_response: str, message_id: str = None, visitor_id: str = None):
    url = f"{PB_URL}/api/collections/chat_history/records"
    payload = {
        "tenantId": tenant_id,
        "user_message": user_query,
        "ai_response": ai_response,
        "status": "completed"
    }
    
    if message_id:
        payload["id"] = message_id
        
    if visitor_id:
        payload["visitor_id"] = visitor_id

    async with httpx.AsyncClient() as client:
        try:
            headers = await get_admin_headers(client)
            response = await client.post(url, json=payload, headers=headers)
            if response.status_code != 200:
                print(f"❌ Failed to log chat: {response.text}")
        except Exception as e:
            print(f"⚠️ Background Logging Error: {e}")

# 👉 NEW: The function that saves the lead to PocketBase
async def capture_lead(tenant_id: str, email: str, message: str):
    """Saves a detected email address to the tenant_leads collection."""
    url = f"{PB_URL}/api/collections/tenant_leads/records"
    payload = {
        "tenantId": tenant_id,
        "visitor_email": email,
        "visitor_message": message,
        "status": "new"
    }

    async with httpx.AsyncClient() as client:
        try:
            headers = await get_admin_headers(client)
            response = await client.post(url, json=payload, headers=headers)
            if response.status_code == 200:
                print(f"🎣 LEAD CAPTURED for tenant {tenant_id}: {email}")
            else:
                print(f"❌ Failed to capture lead: {response.text}")
        except Exception as e:
            print(f"⚠️ Background Lead Capture Error: {e}")