import os
import json
import httpx
import asyncio
from typing import Optional
from fastapi import FastAPI, Request, UploadFile, File, BackgroundTasks
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pocketbase import PocketBase

# Internal Module Imports
from vector_store import search_kb
from usage import check_usage_limit, log_chat
from crawler import crawl_website
from ingest_docs import process_document
from ingest_api import ingest_external_api

app = FastAPI(title="AI Automation Multi-tenant Backend")

# 1. CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Constants
LLM_SERVER_URL = os.getenv("LLM_API_URL", "http://llama-server:8080/v1/chat/completions")
PB_URL = os.getenv("PB_URL", "http://pocketbase:8080")
PB_ADMIN_EMAIL = os.getenv("PB_ADMIN_EMAIL", "admin@example.com")
PB_ADMIN_PASSWORD = os.getenv("PB_ADMIN_PASSWORD", "your_secure_password")
MONTHLY_CHAT_LIMIT = 100

# Global PocketBase Client
pb = PocketBase(PB_URL)

@app.on_event("startup")
async def startup_event():
    """Authenticate as Superuser on startup to bypass security rules."""
    try:
        # 👇 CHANGED: Authenticate using _superusers collection instead of admins
        pb.collection('_superusers').auth_with_password(PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD)
        print("✅ Backend authenticated as PocketBase Superuser")
    except Exception as e:
        print(f"❌ Failed to authenticate with PocketBase: {e}")

# --- CHAT ENDPOINT ---

@app.post("/chat/{tenant_id}")
async def chat(tenant_id: str, request: Request, background_tasks: BackgroundTasks):
    data = await request.json()
    user_query = data.get("message")
    
    if not user_query:
        return {"error": "Message is required"}

    # 1. Usage Guardrail
    is_allowed, current_count = await check_usage_limit(tenant_id, limit=MONTHLY_CHAT_LIMIT)
    
    if not is_allowed:
        return {
            "error": "Limit Reached",
            "current_usage": current_count,
            "message": "Monthly chat limit reached for this tenant."
        }

    # 2. RAG: Search Knowledge Base
    context = search_kb(tenant_id, user_query)
    
    # 3. Construct Prompt
    system_content = "You are a helpful AI assistant. Use the context to answer. If unknown, say so."
    full_prompt = f"Context:\n{context}\n\nQuestion: {user_query}"
    
    payload = {
        "model": "llama-3.2-3b",
        "messages": [
            {"role": "system", "content": system_content},
            {"role": "user", "content": full_prompt}
        ],
        "stream": True,
        "temperature": 0.7
    }

    async def stream_generator():
        full_ai_response = ""
        # Yield usage meta data first
        yield f"data: {json.dumps({'type': 'usage', 'current': current_count + 1})}\n\n"

        async with httpx.AsyncClient(timeout=None) as client:
            try:
                async with client.stream("POST", LLM_SERVER_URL, json=payload) as response:
                    async for line in response.aiter_lines():
                        if line.startswith("data: "):
                            if "[DONE]" in line: break
                            yield f"{line}\n\n"
                            try:
                                json_data = json.loads(line.replace("data: ", ""))
                                content = json_data["choices"][0]["delta"].get("content", "")
                                full_ai_response += content
                            except: pass
            except Exception as e:
                yield f"data: {json.dumps({'error': 'Inference Error'})}\n\n"
        
        # 4. Background Logging (Authenticated via startup_event)
        background_tasks.add_task(log_chat, tenant_id, user_query, full_ai_response)

    return StreamingResponse(stream_generator(), media_type="text/event-stream")

# --- INGESTION ENDPOINTS ---

@app.post("/ingest/url/{tenant_id}")
async def ingest_url(tenant_id: str, data: dict, background_tasks: BackgroundTasks):
    url = data.get("url")
    if not url: return {"error": "URL required"}
    
    # Send the heavy lifting to the background so the API responds instantly
    background_tasks.add_task(crawl_website, tenant_id, url)
    return {"status": "processing"}

@app.post("/ingest/api/{tenant_id}")
async def ingest_api_route(tenant_id: str, data: dict, background_tasks: BackgroundTasks):
    url = data.get("url")
    if not url: return {"error": "API URL required"}
    
    background_tasks.add_task(ingest_external_api, tenant_id, url)
    return {"status": "processing"}

@app.post("/ingest/upload/{tenant_id}")
async def upload_doc(tenant_id: str, file: UploadFile = File(...), background_tasks: BackgroundTasks = None):
    content = await file.read()
    
    # Note: File uploads are a bit tricky with background tasks because the file 
    # closes after the request ends. We pass the raw bytes (content) to avoid this.
    if background_tasks:
        background_tasks.add_task(process_document, tenant_id, file.filename, content)
    else:
        process_document(tenant_id, file.filename, content)
        
    return {"status": "processing"}

@app.get("/health")
async def health():
    return {"status": "online", "admin_auth": pb.auth_store.is_valid}