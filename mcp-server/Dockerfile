FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY mcp-server/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy server files
COPY mcp-server/server.py .
COPY mcp-server/server_http.py .
COPY mcp-server/task_manager.py .
COPY mcp-server/__init__.py .

# Create default workspace directory
RUN mkdir -p /workspace

# Railway injects PORT env var automatically
ENV PORT=3000
ENV WORK_DIR=/workspace

EXPOSE ${PORT}

CMD ["python", "server_http.py"]
