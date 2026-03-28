import lancedb
import pandas as pd
from sentence_transformers import SentenceTransformer

# Global Embedding Model (approx 80MB RAM)
embed_model = SentenceTransformer('all-MiniLM-L6-v2')

db = lancedb.connect("./storage/lancedb")

def get_or_create_table(tenant_id: str):
    table_name = f"tenant_{tenant_id}"
    if table_name not in db.table_names():
        return db.create_table(table_name, data=[{
            "vector": embed_model.encode("init").tolist(),
            "text": "init",
            "source": "system"
        }])
    return db.open_table(table_name)

def add_to_kb(tenant_id: str, text_chunks: list, source: str):
    table = get_or_create_table(tenant_id)
    vectors = embed_model.encode(text_chunks).tolist()
    data = [{"vector": v, "text": t, "source": source} for v, t in zip(vectors, text_chunks)]
    table.add(data)

def search_kb(tenant_id: str, query: str, top_k=3):
    table = get_or_create_table(tenant_id)
    query_vec = embed_model.encode(query).tolist()
    results = table.search(query_vec).limit(top_k).to_list()
    return "\n".join([r['text'] for r in results])
