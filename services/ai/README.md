# TheraVillage AI Service

Clean and focused AI service for pediatric therapy providing audio transcription and SOAP note generation using OpenAI's advanced language models.

## Features

### 🎤 Audio Transcription
- Transcribe therapy session audio using OpenAI Whisper
- Support for multiple audio formats
- High accuracy speech-to-text conversion

### 📝 SOAP Note Generation
- Generate professional SOAP notes from session transcripts
- Include client context, goals, and observations
- Structured JSON output with Subjective, Objective, Assessment, and Plan sections
- AI-powered synthesis and recommendations

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   FastAPI App   │    │   OpenAI API    │    │ Google Cloud    │
│                 │    │                 │    │                 │
│ • 2 Endpoints   │◄──►│ • GPT-4 Models  │    │ • Secret Mgmt   │
│ • Audio Upload  │    │ • Whisper STT   │    │ • Secure Keys   │
│ • SOAP Gen      │    │ • Structured    │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Setup

### 1. Environment Variables

Configure these in Google Cloud Secret Manager:

```bash
# Required Secrets
OPENAI_API_KEY=your_openai_api_key_here

# Optional Configuration
MODEL_NAME=gpt-4o-mini
MAX_TOKENS=3000
TEMPERATURE=0.7
```

### 2. Install Dependencies

```bash
poetry install
```

### 3. Run the Service

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

## API Endpoints

### Audio Transcription
- `POST /transcribe-audio` - Transcribe audio files using OpenAI Whisper

### SOAP Note Generation
- `POST /generate-soap-note` - Generate SOAP notes from transcripts and session data

### System
- `GET /health` - Health check endpoint

## Usage Examples

### Audio Transcription

```python
import requests

# Upload audio file for transcription
with open("session_audio.wav", "rb") as audio_file:
    files = {"audio_file": audio_file}
    response = requests.post("http://localhost:8000/transcribe-audio", files=files)
    
transcript = response.json()["transcript"]
```

### SOAP Note Generation

```python
# From transcript
data = {
    "transcript": "Client worked on balance exercises...",
    "client_age": 8,
    "diagnosis": "Developmental Coordination Disorder",
    "short_term_goals": '["Improve balance", "Enhance coordination"]',
    "long_term_goals": '["Independent mobility"]',
    "session_activities": '["Balance beam walking", "Ball tossing"]',
    "observations": "Client showed improved confidence"
}

response = requests.post("http://localhost:8000/generate-soap-note", data=data)
soap_note = response.json()["soap_note"]
```

### Combined Audio + SOAP Generation

```python
# Upload audio and generate SOAP note in one call
with open("session_audio.wav", "rb") as audio_file:
    files = {"audio_file": audio_file}
    data = {
        "client_age": 8,
        "diagnosis": "Developmental Coordination Disorder",
        "short_term_goals": '["Improve balance"]',
        "long_term_goals": '["Independent mobility"]'
    }
    
    response = requests.post(
        "http://localhost:8000/generate-soap-note", 
        files=files, 
        data=data
    )
    
result = response.json()
transcript = result["transcript"]  # Transcribed audio
soap_note = result["soap_note"]    # Generated SOAP note
```

## Data Models

### SOAPNote
- `subjective`: Client's reported status and concerns
- `objective`: Measurable observations and performance
- `assessment`: Clinical interpretation and progress evaluation  
- `plan`: Next steps and treatment recommendations
- `synthesized_summary`: Concise summary of session outcomes
- `goals_addressed`: Specific goals worked on during session
- `next_session_recommendations`: Targeted activities for next session
- `confidence_score`: AI confidence in the analysis (0-1)
- `short_term_goals`: Client's short-term therapy goals
- `long_term_goals`: Client's long-term therapy goals
- `time_in`: Session start time (optional)
- `time_out`: Session end time (optional)
- `units`: Therapy units (optional)
- `treatment_codes`: CPT codes (optional)

## Configuration

### AI Model Settings
- `MODEL_NAME`: OpenAI model to use (default: gpt-4o-mini)
- `MAX_TOKENS`: Maximum tokens per response (default: 3000)
- `TEMPERATURE`: Response creativity (0-1, default: 0.7)

### Security
- API keys managed via Google Cloud Secret Manager
- Environment-aware CORS configuration
- Input validation with Pydantic models
- Secure file handling for audio uploads

## Development

### Local Development
```bash
# Install dependencies
poetry install

# Run with auto-reload
uvicorn app.main:app --reload --port 8000

# Check health
curl http://localhost:8000/health
```

### Docker Development
```bash
# Build and run
docker-compose up tv-ai

# View logs
docker-compose logs -f tv-ai

# Health check
curl http://localhost:8001/health
```

## Error Handling

Comprehensive error handling includes:
- OpenAI API key validation via Secret Manager
- Audio file format validation
- JSON schema validation for structured output
- Detailed error messages for debugging
- Graceful fallbacks for service failures

## Monitoring

- Health check endpoint for container orchestration
- Request/response logging
- Error tracking with detailed stack traces
- Performance monitoring for AI API calls

## Production Deployment

The service is designed for Google Cloud Run deployment with:
- Automatic scaling based on demand
- Secret Manager integration for secure API key management
- Health checks for container management
- CORS configuration for web client access
- Optimized Docker image with Poetry dependency management