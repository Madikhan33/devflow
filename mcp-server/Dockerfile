FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy server files
COPY server.py .
COPY task_manager.py .

# Run the server
ENTRYPOINT ["python", "server.py"]
CMD ["--dir", "."]
