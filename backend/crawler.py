import trafilatura
from pypdf import PdfReader
from vector_store import add_to_kb
from utils import update_tenant_status  # 👉 IMPORT THE HELPER

def crawl_website(tenant_id: str, url: str):
    try:
        downloaded = trafilatura.fetch_url(url)
        content = trafilatura.extract(downloaded)
        if content:
            # Simple chunking by paragraph/length
            chunks = [content[i:i+1000] for i in range(0, len(content), 800)]
            add_to_kb(tenant_id, chunks, url)
        
        # 👉 Mark as completed
        update_tenant_status(tenant_id, "completed")
        print(f"Successfully trained bot for tenant {tenant_id}")
        
    except Exception as e:
        print(f"Crawling failed: {e}")
        # 👉 Mark as error
        update_tenant_status(tenant_id, "error")

def crawl_website(tenant_id: str, url: str):
    downloaded = trafilatura.fetch_url(url)
    content = trafilatura.extract(downloaded)
    if content:
        # Simple chunking by paragraph/length
        chunks = [content[i:i+1000] for i in range(0, len(content), 800)]
        add_to_kb(tenant_id, chunks, url)

def process_pdf(tenant_id: str, file_path: str):
    reader = PdfReader(file_path)
    text = ""
    for page in reader.pages:
        text += page.extract_text()
    chunks = [text[i:i+1000] for i in range(0, len(text), 800)]
    add_to_kb(tenant_id, chunks, file_path)
