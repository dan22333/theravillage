from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional
import os
import json
from dotenv import load_dotenv
from .ai_service import AIService

# Load environment variables from .env file
load_dotenv()

app = FastAPI(title="TheraVillage AI Service", version="1.0.0")

# CORS middleware - Environment aware
environment = os.getenv("ENVIRONMENT", "development")
cors_origins = os.getenv("CORS_ALLOWED_ORIGINS", "")

if cors_origins:
    # Use environment variable if provided
    allowed_origins = [origin.strip() for origin in cors_origins.split(",")]
elif environment == "development":
    # Development: Allow all origins
    allowed_origins = ["*"]
else:
    # Production fallback: Allow common origins
    allowed_origins = [
        "https://theravillage-edb89.web.app",
        "https://theravillage-edb89.firebaseapp.com"
    ]

print(f"🔧 AI Service CORS Configuration:")
print(f"   Environment: {environment}")
print(f"   CORS_ALLOWED_ORIGINS: {cors_origins}")
print(f"   Allowed origins: {allowed_origins}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize AI service
ai_service = AIService()

@app.on_event("startup")
async def startup_event():
    """Initialize AI service on startup"""
    await ai_service.initialize_secrets()

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "theravillage-ai"}

@app.post("/transcribe-audio")
async def transcribe_audio(audio_file: UploadFile = File(...)):
    """Transcribe audio using OpenAI Whisper"""
    try:
        audio_data = await audio_file.read()
        transcript = await ai_service.transcribe_audio(audio_data)
        
        return {
            "transcript": transcript,
            "filename": audio_file.filename,
            "file_size": len(audio_data)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to transcribe audio: {str(e)}")


@app.post("/generate-soap-note")
async def generate_soap_note(
    audio_file: Optional[UploadFile] = File(None),
    transcript: Optional[str] = Form(None),
    client_age: Optional[int] = Form(None),
    diagnosis: Optional[str] = Form(None),
    short_term_goals: Optional[str] = Form(None),
    long_term_goals: Optional[str] = Form(None),
    session_activities: Optional[str] = Form(None),
    observations: Optional[str] = Form(""),
    time_in: Optional[str] = Form(""),
    time_out: Optional[str] = Form(""),
    units: Optional[int] = Form(0),
    treatment_codes: Optional[str] = Form(None)
):
    """Generate SOAP note from audio file OR transcript - flexible endpoint"""
    try:
        final_transcript = transcript
        
        # If audio file provided, transcribe it first
        if audio_file:
            audio_data = await audio_file.read()
            final_transcript = await ai_service.transcribe_audio(audio_data)
        
        # Must have either audio file or transcript
        if not final_transcript:
            raise HTTPException(status_code=400, detail="Either audio_file or transcript must be provided")
        
        # Parse JSON strings to lists
        def parse_json_list(json_str: Optional[str]) -> List[str]:
            if not json_str:
                return []
            try:
                parsed = json.loads(json_str)
                print(f"Parsed JSON: {json_str} -> {parsed}")
                return parsed
            except json.JSONDecodeError as e:
                print(f"Failed to parse JSON: {json_str}, error: {e}")
                return []
        
        # Generate SOAP note from transcript
        soap_note = await ai_service.generate_soap_note(
            transcript=final_transcript,
            client_age=client_age or 0,
            diagnosis=diagnosis or "",
            short_term_goals=parse_json_list(short_term_goals),
            long_term_goals=parse_json_list(long_term_goals),
            session_activities=parse_json_list(session_activities),
            observations=observations or "",
            time_in=time_in or "",
            time_out=time_out or "",
            units=units or 0,
            treatment_codes=parse_json_list(treatment_codes)
        )
        
        # Return response with optional transcript
        response = {"soap_note": soap_note}
        if audio_file:
            response["transcript"] = final_transcript
            
        return response
        
    except Exception as e:
        import traceback
        error_details = f"Failed to generate SOAP note: {str(e)}\nTraceback: {traceback.format_exc()}"
        print(f"SOAP Note Generation Error: {error_details}")
        raise HTTPException(status_code=500, detail=f"Failed to generate SOAP note: {str(e)}")
