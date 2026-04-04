import io
from pypdf import PdfReader
from docx import Document
from vector_store import add_to_kb
from utils import update_tenant_status  # 👉 IMPORT THE HELPER

def extract_text_from_pdf(file_content):
    reader = PdfReader(io.BytesIO(file_content))
    text = ""
    for page in reader.pages:
        content = page.extract_text()
        if content:
            text += content + "\n"
    return text

def extract_text_from_docx(file_content):
    doc = Document(io.BytesIO(file_content))
    return "\n".join([para.text for para in doc.paragraphs])

def process_document(tenant_id: str, file_name: str, file_content: bytes):
    print(f"Starting document processing for {file_name}...", flush=True)
    try:
        text = ""
        if file_name.endswith('.pdf'):
            text = extract_text_from_pdf(file_content)
        elif file_name.endswith('.docx'):
            text = extract_text_from_docx(file_content)
        else:
            text = file_content.decode('utf-8', errors='ignore')

        if text.strip():
            chunks = [text[i:i+800] for i in range(0, len(text), 700)]
            add_to_kb(tenant_id, chunks, source=file_name)
            
        # 👉 Mark as completed
        update_tenant_status(tenant_id, "completed")
        print(f"✅ Document {file_name} processed successfully", flush=True)
        return True
        
    except Exception as e:
        print(f"❌ Doc ingest failed: {e}", flush=True)
        # 👉 Mark as error
        update_tenant_status(tenant_id, "error")
        return False