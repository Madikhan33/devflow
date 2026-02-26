FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy server files
COPY server.py .
COPY server_http.py .
COPY task_manager.py .
COPY __init__.py .

# Create default workspace directory
RUN mkdir -p /workspace

# Railway injects PORT env var automatically
ENV PORT=3000
ENV WORK_DIR=/workspace

# Expose port (Railway overrides this)
EXPOSE ${PORT}

# Run HTTP server
CMD ["python", "server_http.py"]
