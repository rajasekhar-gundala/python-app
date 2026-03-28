import io
from pypdf import PdfReader
from docx import Document
from vector_store import add_to_kb

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
    text = ""
    if file_name.endswith('.pdf'):
        text = extract_text_from_pdf(file_content)
    elif file_name.endswith('.docx'):
        text = extract_text_from_docx(file_content)
    else:
        # Fallback for plain text files
        text = file_content.decode('utf-8', errors='ignore')

    if text.strip():
        # Chunking strategy: 800 characters with 100 char overlap
        chunks = [text[i:i+800] for i in range(0, len(text), 700)]
        add_to_kb(tenant_id, chunks, source=file_name)
        return len(chunks)
    return 0
