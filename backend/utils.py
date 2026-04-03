import os
import sys
from pocketbase import PocketBase

PB_URL = os.getenv("PB_URL", "http://pocketbase:8080")
PB_ADMIN_EMAIL = os.getenv("PB_ADMIN_EMAIL", "admin@example.com") 
PB_ADMIN_PASSWORD = os.getenv("PB_ADMIN_PASSWORD", "your_secure_password") 

def update_tenant_status(tenant_id: str, status: str):
    try:
        # Force print to Docker logs immediately
        print(f"Attempting to update PB status to '{status}' for {tenant_id}...", flush=True)
        
        pb = PocketBase(PB_URL)
        pb.admins.auth_with_password(PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD)
        pb.collection('tenants').update(tenant_id, {"training_status": status})
        
        print(f"✅ SUCCESS: Status updated to '{status}'", flush=True)
    except Exception as e:
        print(f"❌ PB UPDATE ERROR: {e}", flush=True)
        sys.stdout.flush() # Double force flush