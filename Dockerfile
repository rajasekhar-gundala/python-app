# 1. Use Python 3.12 slim
FROM python:3.12-slim

# 2. Set performance and stability variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    MALLOC_ARENA_MAX=2

WORKDIR /app

# 3. Install system dependencies
# libmagic1 for file type detection, build-essential for any C++ extensions
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libmagic1 \
    && rm -rf /var/lib/apt/lists/*

# 4. Install Python dependencies using BuildKit Cache
# This 'mount' caches the pip folder across GitHub Action runs
COPY requirements.txt .
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --prefer-binary -r requirements.txt

# 5. Pre-download the Embedding Model into the Image
# This ensures your 2 vCPU VPS doesn't have to download it at runtime
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2')"

# 6. Copy application code
COPY . .

# 7. Create storage for LanceDB
RUN mkdir -p /app/storage/lancedb

# 8. Start Uvicorn with 1 worker to save RAM on your 8GB VPS
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
