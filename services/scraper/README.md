# TheraVillage Treatment Scraper Service

A FastAPI service for scraping and processing pediatric occupational therapy treatment content using Tavily API and OpenAI LLM processing.

## 🎯 Purpose

This service:
1. **Seeds comprehensive treatment topics** for pediatric OT
2. **Scrapes web content** using Tavily API for each topic
3. **Processes content with LLM** to extract structured treatment information
4. **Stores everything** in PostgreSQL with vector embeddings for RAG search

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Topic Seeder  │    │  Tavily Client  │    │  LLM Processor  │
│                 │    │                 │    │                 │
│ • Generate      │───▶│ • Web Scraping  │───▶│ • Extract       │
│   Topics        │    │ • Source        │    │   Treatments    │
│ • Version       │    │   Analysis      │    │ • Generate      │
│   Control       │    │ • Rate Limiting │    │   Embeddings    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │   PostgreSQL    │
                    │   + pgvector    │
                    │                 │
                    │ • Topics        │
                    │ • Tavily Data   │
                    │ • Treatments    │
                    │ • Vectors       │
                    └─────────────────┘
```

## 🚀 Quick Start

### Local Development

1. **Install dependencies:**
   ```bash
   cd services/scraper
   poetry install
   ```

2. **Set environment variables:**
   ```bash
   export TAVILY_API_KEY="your_tavily_api_key"
   export OPENAI_API_KEY="your_openai_api_key"
   export DATABASE_URL="postgresql+asyncpg://tv_admin:password@localhost:5433/theravillage"
   ```

3. **Run the service:**
   ```bash
   poetry run uvicorn app.main:app --reload --port 8000
   ```

### Docker Development

1. **Build and run:**
   ```bash
   docker build -f Dockerfile.dev -t scraper-dev .
   docker run -p 8000:8000 -e TAVILY_API_KEY="your_key" scraper-dev
   ```

## 📊 Database Schema

The service creates comprehensive tables to track:

- **treatment_topics**: Seeded topics with search keywords
- **scrape_jobs**: Job tracking and metrics
- **tavily_responses**: Complete Tavily API responses
- **tavily_results**: Individual search results
- **llm_processing_attempts**: All LLM processing attempts
- **treatments**: Structured treatment data
- **treatment_vectors**: Vector embeddings for search

## 🔧 API Endpoints

### Topic Management
- `POST /topics/seed` - Seed treatment topics
- `GET /topics` - Get topics by version
- `GET /topics/versions` - Get available versions

### Job Management
- `POST /jobs/start` - Start scraping job
- `GET /jobs/{job_id}/status` - Get job status
- `GET /jobs` - List all jobs

### Health Check
- `GET /health` - Service health status

## 📋 Treatment Topics

The service seeds **30+ comprehensive topics** covering:

### Fine Motor Skills
- Hand Strength and Dexterity
- Pincer Grasp Development
- Bilateral Hand Coordination
- In-Hand Manipulation
- Scissor Skills Development

### Gross Motor Skills
- Core Stability and Strength
- Balance and Postural Control
- Motor Planning and Coordination
- Proprioceptive Awareness

### Sensory Processing
- Tactile Processing and Desensitization
- Vestibular Processing
- Auditory Processing
- Sensory Modulation

### Visual-Perceptual Skills
- Visual Discrimination
- Visual Memory
- Spatial Relationships
- Figure-Ground Perception

### Cognitive Skills
- Attention and Concentration
- Executive Functioning
- Working Memory

### Activities of Daily Living
- Self-Feeding Skills
- Dressing Skills
- Grooming and Hygiene

### School Readiness
- Pre-Writing Skills
- Handwriting Development
- Classroom Behaviors and Attention

### Play and Leisure
- Imaginative Play Skills
- Social Play Skills
- Game Participation

## 🤖 LLM Processing

Each scraped content is processed through OpenAI to extract:

```json
{
  "treatment_name": "Clear treatment name",
  "treatment_description": "Comprehensive description",
  "treatment_objective": "Primary therapeutic goal",
  "age_range_min": 3,
  "age_range_max": 10,
  "difficulty_level": "beginner|intermediate|advanced",
  "duration_minutes": 30,
  "frequency_per_week": 3,
  "step_by_step_instructions": ["Step 1", "Step 2"],
  "required_materials": ["Material 1", "Material 2"],
  "safety_considerations": ["Safety note"],
  "target_skills": ["Skill addressed"],
  "contraindications": ["When not to use"],
  "modifications": ["Adaptations"],
  "progress_indicators": ["Success metrics"],
  "evidence_level": "research_based|clinical_consensus|expert_opinion"
}
```

## 🌐 Web Scraping Strategy

### Preferred Domains
- theottoolbox.com
- napacenter.org
- aota.org (American OT Association)
- pediatricot.com
- sensory-processing-disorder.com
- yourtherapysource.com

### Quality Scoring
Each result gets credibility scoring based on:
- Tavily relevance score (40%)
- Domain authority (30%)
- Content length (10%)
- Source type (academic/clinical) (20%)

## 📈 Monitoring & Logging

The service tracks:
- **Performance metrics**: Response times, processing duration
- **Quality metrics**: Success rates, credibility scores
- **Cost tracking**: API usage and estimated costs
- **Error handling**: Comprehensive error logging

## 🔒 Rate Limiting

- **Tavily API**: 60 requests/minute
- **OpenAI API**: 500 requests/minute
- **Inter-topic delay**: 2 seconds
- **Retry logic**: 3 attempts with exponential backoff

## 🚀 Deployment

### Google Cloud Run

1. **Build and push:**
   ```bash
   docker build -t gcr.io/project/scraper .
   docker push gcr.io/project/scraper
   ```

2. **Deploy:**
   ```bash
   gcloud run deploy scraper \
     --image gcr.io/project/scraper \
     --platform managed \
     --region us-central1 \
     --set-env-vars TAVILY_API_KEY=secret://tavily-key
   ```

### Cloud Run Jobs (Scheduled)

```bash
gcloud run jobs create scraper-job \
  --image gcr.io/project/scraper \
  --region us-central1 \
  --set-env-vars TAVILY_API_KEY=secret://tavily-key \
  --command="python,-c,import asyncio; from app.main import run_scheduled_job; asyncio.run(run_scheduled_job())"
```

## 📊 Example Usage

1. **Seed topics:**
   ```bash
   curl -X POST "http://localhost:8000/topics/seed" \
     -H "Content-Type: application/json" \
     -d '{"version": 1, "overwrite_existing": false}'
   ```

2. **Start scraping:**
   ```bash
   curl -X POST "http://localhost:8000/jobs/start" \
     -H "Content-Type: application/json" \
     -d '{"config": {"topics_version": 1, "job_type": "full_scrape"}}'
   ```

3. **Check status:**
   ```bash
   curl "http://localhost:8000/jobs/{job_id}/status"
   ```

## 🔧 Configuration

Key environment variables:

```bash
# Required
TAVILY_API_KEY=your_tavily_key
OPENAI_API_KEY=your_openai_key
DATABASE_URL=postgresql+asyncpg://user:pass@host:port/db

# Optional
TAVILY_MAX_RESULTS=10
TAVILY_SEARCH_DEPTH=advanced
OPENAI_MODEL=gpt-4o-mini
MAX_CONCURRENT_JOBS=1
LOG_LEVEL=INFO
```

## 🧪 Development

### Run tests:
```bash
poetry run pytest
```

### Code formatting:
```bash
poetry run black .
poetry run isort .
```

### Type checking:
```bash
poetry run mypy .
```

This service provides the foundation for TheraVillage's intelligent treatment recommendation system!
