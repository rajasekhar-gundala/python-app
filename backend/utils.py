import os
from pocketbase import PocketBase

# Initialize PB variables from environment (or use defaults)
PB_URL = os.getenv("PB_URL", "http://pocketbase:8080")
PB_ADMIN_EMAIL = os.getenv("PB_ADMIN_EMAIL", "admin@example.com") # Replace if needed
PB_ADMIN_PASSWORD = os.getenv("PB_ADMIN_PASSWORD", "your_secure_password") # Replace if needed

def update_tenant_status(tenant_id: str, status: str):
    """
    Helper function to update PocketBase training status from Python.
    Available statuses: 'idle', 'processing', 'completed', 'error'
    """
    try:
        pb = PocketBase(PB_URL)
        pb.admins.auth_with_password(PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD)
        pb.collection('tenants').update(tenant_id, {"training_status": status})
        print(f"✅ Status updated to '{status}' for tenant: {tenant_id}")
    except Exception as e:
        print(f"❌ Failed to update status in PB for tenant {tenant_id}: {e}")