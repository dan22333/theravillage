FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PORT=8000

# System deps for ML libraries and asyncpg builds
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Poetry
RUN pip install --no-cache-dir "poetry==1.8.3"

# Configure Poetry to not create virtual environments
RUN poetry config virtualenvs.create false

# Set working directory
WORKDIR /app

# Copy dependency files first (for better Docker layer caching)
COPY pyproject.toml poetry.lock* ./

# Install dependencies
RUN poetry install --no-interaction --no-ansi


# Copy application code
COPY . .

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Run the application
CMD ["bash", "-lc", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
