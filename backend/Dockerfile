# Use Python 3.11 slim image for faster builds
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Set environment variables for faster Python execution
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV ENVIRONMENT=production
ENV PIP_NO_CACHE_DIR=1
ENV PIP_DISABLE_PIP_VERSION_CHECK=1
ENV SKIP_PRE_STARTUP_TESTS=true

# Install minimal system dependencies in one layer
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Copy only requirements first for better Docker layer caching
COPY requirements.txt .

# Install Python dependencies with optimizations
RUN pip install --no-cache-dir -r requirements.txt

# Copy all backend files
COPY . .

# Create non-root user for security
RUN adduser --disabled-password --gecos '' appuser \
    && chown -R appuser:appuser /app
USER appuser

# Expose port
EXPOSE 8000

# Simplified health check
HEALTHCHECK --interval=60s --timeout=10s --start-period=10s --retries=2 \
    CMD curl -f http://localhost:8000/health || exit 1

# Start with simple_server.py for minimal deployment
CMD ["uvicorn", "simple_server:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]