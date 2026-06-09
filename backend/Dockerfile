FROM python:3.10-slim

WORKDIR /app

# Install system dependencies needed for OpenCV and Prophet
RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install Python requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY . .

# Hugging Face Spaces uses port 7860 by default
EXPOSE 7860

# Run FastAPI
CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "7860"]
