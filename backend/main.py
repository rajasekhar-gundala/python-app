import os
import json
import httpx
from typing import Optional
from fastapi import FastAPI, Request, UploadFile, File, BackgroundTasks
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware

# Internal Module Imports
from vector_store import search_kb
from usage import check_usage_limit, log_chat
from crawler import crawl_website
from ingest_docs import process_document
from ingest_api import ingest_external_api

app = FastAPI(title="AI Automation Multi-tenant Backend")

# 1. CORS Configuration for Multi-tenancy
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific tenant domains
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Environment Constants
LLM_SERVER_URL = os.getenv("LLM_API_URL", "http://llama-server:8080/v1/chat/completions")
# Updated to match your per-tenant business logic
MONTHLY_CHAT_LIMIT = 100 

# --- CHAT ENDPOINT ---

@app.post("/chat/{tenant_id}")
async def chat(tenant_id: str, request: Request, background_tasks: BackgroundTasks):
    data = await request.json()
    user_query = data.get("message")
    
    if not user_query:
        return {"error": "Message is required"}

    # 1. Usage Guardrail (2 vCPU Optimized: Fast SQLite count check)
    # This checks how many messages this tenant has sent this month
    is_allowed, current_count = await check_usage_limit(tenant_id, limit=MONTHLY_CHAT_LIMIT)
    
    if not is_allowed:
        return {
            "error": "Limit Reached",
            "current_usage": current_count,
            "limit": MONTHLY_CHAT_LIMIT,
            "message": f"Usage limit of {MONTHLY_CHAT_LIMIT} chats reached. Please contact admin."
        }

    # 2. RAG: Retrieve context from LanceDB
    context = search_kb(tenant_id, user_query)
    
    # 3. Construct Prompt for Llama-3.2-3B
    system_content = (
        "You are a helpful assistant. Use the provided context to answer accurately. "
        "If unsure, say you don't know."
    )
    full_prompt = f"Context:\n{context}\n\nUser Question: {user_query}"
    
    payload = {
        "model": "llama-3.2-3b",
        "messages": [
            {"role": "system", "content": system_content},
            {"role": "user", "content": full_prompt}
        ],
        "stream": True,
        "temperature": 0.7,
        "max_tokens": 512
    }

    async def stream_generator():
        full_ai_response = ""
        
        # We yield the current usage as the first 'meta' packet so the UI can update
        yield f"data: {json.dumps({'type': 'usage', 'current': current_count + 1, 'limit': MONTHLY_CHAT_LIMIT})}\n\n"

        async with httpx.AsyncClient(timeout=None) as client:
            try:
                async with client.stream("POST", LLM_SERVER_URL, json=payload) as response:
                    async for line in response.aiter_lines():
                        if line.startswith("data: "):
                            yield f"{line}\n\n"
                            
                            # Collect full response for background logging
                            try:
                                # Skip processing the [DONE] signal
                                if "[DONE]" in line: continue
                                
                                json_data = json.loads(line.replace("data: ", ""))
                                delta = json_data["choices"][0]["delta"]
                                if "content" in delta:
                                    full_ai_response += delta["content"]
                            except:
                                pass
            except Exception as e:
                yield f"data: {json.dumps({'error': 'LLM_SERVER_UNREACHABLE'})}\n\n"
        
        # 4. Background Task: Log chat to PocketBase without delaying the stream
        # This increments the count in the DB for the next request
        background_tasks.add_task(log_chat, tenant_id, user_query, full_ai_response)

    return StreamingResponse(stream_generator(), media_type="text/event-stream")

# --- INGESTION ENDPOINTS ---

@app.post("/ingest/url/{tenant_id}")
async def ingest_url(tenant_id: str, data: dict):
    url = data.get("url")
    if not url: return {"error": "URL required"}
    crawl_website(tenant_id, url)
    return {"status": "processing", "source": url}

@app.post("/ingest/upload/{tenant_id}")
async def upload_doc(tenant_id: str, file: UploadFile = File(...)):
    content = await file.read()
    num_chunks = process_document(tenant_id, file.filename, content)
    return {"status": "success", "filename": file.filename, "chunks": num_chunks}

@app.post("/ingest/api/{tenant_id}")
async def ingest_api(tenant_id: str, data: dict):
    url = data.get("url")
    headers = data.get("headers", {})
    result = await ingest_external_api(tenant_id, url, headers)
    return result

# --- HEALTH CHECK ---

@app.get("/health")
async def health():
    return {"status": "online", "memory_optimized": True}