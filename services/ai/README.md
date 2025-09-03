# TheraVillage AI Service

The AI Service provides intelligent recommendations and analysis for pediatric therapy sessions using advanced language models and vector search capabilities.

AI-powered recommendation and note generation service for pediatric therapy using LangChain, OpenAI, and Pinecone.

## Features

### 🧠 AI-Powered Exercise Recommendations
- Generate personalized exercise recommendations based on client age, diagnosis, and goals
- Consider available equipment and difficulty levels
- Provide reasoning for each recommendation

### 📝 SOAP Note Generation
- Generate professional SOAP notes from session transcripts
- Include client context, goals, and observations
- Structured output with Subjective, Objective, Assessment, and Plan sections

### 📚 Homework Plan Creation
- Create comprehensive homework plans based on session activities
- Include frequency, duration, and parent guidance
- Progress tracking recommendations

### 🔍 Semantic Exercise Search
- Vector-based search using Pinecone
- Filter by tags, difficulty, and age groups
- Relevance scoring for search results

### 📊 Session Analysis
- Analyze session transcripts for insights
- Assess progress toward goals
- Identify risk factors and next steps

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   FastAPI App   │    │   OpenAI API    │    │   Pinecone DB   │
│                 │    │                 │    │                 │
│ • Endpoints     │◄──►│ • GPT-4 Models  │    │ • Vector Store  │
│ • Request/Resp  │    │ • Embeddings    │    │ • Exercise Data │
│ • Validation    │    │ • LLM Chains    │    │ • Metadata      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Setup

### 1. Environment Variables

All environment variables are configured in the main project `env.local` file:

```bash
# AI Service Configuration
OPENAI_API_KEY=your_openai_api_key_here
PINECONE_API_KEY=your_pinecone_api_key_here
PINECONE_ENVIRONMENT=your_pinecone_environment_here
PINECONE_INDEX_NAME=theravillage-exercises
MODEL_NAME=gpt-4o-mini
MAX_TOKENS=1000
TEMPERATURE=0.7
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Run the Service

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

## API Endpoints

### Exercise Recommendations
- `POST /recommend/exercises` - Get AI-powered exercise recommendations

### SOAP Note Generation
- `POST /generate/soap` - Generate SOAP notes from session data

### Homework Planning
- `POST /generate/homework` - Create homework plans

### Exercise Search
- `GET /exercises/search` - Semantic search for exercises

### Session Analysis
- `POST /analyze/session` - Analyze session transcripts

### System Info
- `GET /health` - Health check
- `GET /models/available` - List available AI models

## Usage Examples

### Exercise Recommendations

```python
import requests

response = requests.post("http://localhost:8000/recommend/exercises", json={
    "client_age": 8,
    "diagnosis": "Developmental Coordination Disorder",
    "goals": ["Improve balance", "Enhance coordination"],
    "equipment_available": ["balance beam", "therapy ball"],
    "difficulty_level": "moderate",
    "session_duration": 30
})

recommendations = response.json()["recommendations"]
```

### SOAP Note Generation

```python
response = requests.post("http://localhost:8000/generate/soap", json={
    "transcript": "Client worked on balance exercises...",
    "client_age": 8,
    "diagnosis": "Developmental Coordination Disorder",
    "goals": ["Improve balance", "Enhance coordination"],
    "session_activities": ["Balance beam walking", "Ball tossing"],
    "observations": "Client showed improved confidence"
})

soap_note = response.json()["soap_note"]
```

## Data Models

### ExerciseRecommendation
- `exercise_id`: Unique identifier
- `title`: Exercise name
- `description`: Detailed description
- `instructions`: Step-by-step instructions
- `difficulty`: Difficulty level
- `age_appropriateness`: Age suitability
- `equipment_needed`: Required equipment
- `estimated_duration`: Time to complete
- `confidence_score`: AI confidence (0-1)
- `reasoning`: Explanation for recommendation

### SOAPNote
- `subjective`: Client's reported status
- `objective`: Measurable observations
- `assessment`: Clinical interpretation
- `plan`: Next steps and recommendations
- `goals_addressed`: Goals worked on
- `next_session_recommendations`: Future session plans
- `confidence_score`: AI confidence (0-1)

## Configuration

### AI Model Settings
- `MODEL_NAME`: OpenAI model to use (default: gpt-4o-mini)
- `MAX_TOKENS`: Maximum tokens per response (default: 1000)
- `TEMPERATURE`: Response creativity (0-1, default: 0.7)

### Pinecone Settings
- `PINECONE_INDEX_NAME`: Vector database index name
- Vector dimensions: 1536 (OpenAI embeddings)

## Development

### Local Development
```bash
# Install dependencies
pip install -r requirements.txt

# Run with auto-reload
uvicorn app.main:app --reload

# Run tests (when implemented)
pytest
```

### Docker Development
```bash
# Build and run
docker-compose up tv-ai

# View logs
docker-compose logs -f tv-ai
```

## Error Handling

The service includes comprehensive error handling:
- API key validation
- Fallback to mock data when AI services fail
- Detailed error messages for debugging
- Graceful degradation for missing services

## Security

- API key management via environment variables
- Input validation with Pydantic models
- CORS configuration for cross-origin requests
- No sensitive data logging

## Monitoring

- Health check endpoint
- Request/response logging
- Error tracking and reporting
- Performance metrics (when implemented)

## Future Enhancements

- [ ] Whisper integration for voice transcription
- [ ] Advanced exercise library management
- [ ] Custom model fine-tuning
- [ ] Batch processing capabilities
- [ ] Advanced analytics and reporting
- [ ] Multi-language support
- [ ] Integration with EMR systems
