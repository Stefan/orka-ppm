# Use Python 3.11 slim image
FROM python:3.11-slim

# Build argument to bust cache when needed
ARG CACHE_BUST=1

# Set working directory
WORKDIR /app

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV ENVIRONMENT=production

# Install system dependencies
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential \
        curl \
        timeout \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies with no cache to avoid conflicts
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir --force-reinstall -r requirements.txt

# Copy application code
COPY . .

# Make startup scripts executable
RUN chmod +x docker-start.sh start.sh start_with_testing.sh

# Create non-root user for security
RUN adduser --disabled-password --gecos '' appuser \
    && chown -R appuser:appuser /app
USER appuser

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Start command using the Docker-optimized startup script
CMD ["./docker-start.sh"]