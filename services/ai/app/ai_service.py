import os
import asyncio
import json
from typing import List, Optional, Dict, Any
from openai import OpenAI
from dotenv import load_dotenv
from .models import SOAPNote
from .prompts import (
    SOAP_NOTE_PROMPT,
    STRUCTURED_OUTPUT_INSTRUCTIONS
)

# Load environment variables from .env file (for local development)
load_dotenv()

# Structured output schemas
SOAP_SCHEMA = {
    "type": "object",
    "properties": {
        "subjective": {"type": "string"},
        "objective": {"type": "string"},
        "assessment": {"type": "string"},
        "plan": {"type": "string"},
        "synthesized_summary": {"type": "string"},
        "goals_addressed": {"type": "array", "items": {"type": "string"}},
        "next_session_recommendations": {"type": "array", "items": {"type": "string"}},
        "confidence_score": {"type": "number"}
    },
    "required": ["subjective", "objective", "assessment", "plan", "synthesized_summary", "goals_addressed", "next_session_recommendations", "confidence_score"],
    "additionalProperties": False
}


async def get_secret(secret_name: str) -> str:
    """Get secret from Google Cloud Secret Manager"""
    try:
        import google.cloud.secretmanager as secretmanager
        client = secretmanager.SecretManagerServiceClient()
        secret_path = f"projects/theravillage-edb89/secrets/{secret_name}/versions/latest"
        response = client.access_secret_version(request={"name": secret_path})
        return response.payload.data.decode("UTF-8").strip()
    except Exception as e:
        print(f"Error fetching secret {secret_name}: {e}")
        return ""

class AIService:
    def __init__(self):
        """Initialize the AI service with OpenAI"""
        self.openai_api_key = None
        self.model_name = None
        self.max_tokens = None
        self.temperature = None
        self.client = None

    async def initialize_secrets(self):
        """Initialize secrets from Secret Manager"""
        print("🔧 Loading secrets from Secret Manager...")
        
        try:
            # Get secret names from environment variables
            openai_secret_name = os.getenv("OPENAI_API_KEY_SECRET_NAME", "OPENAI_API_KEY")
            
            self.openai_api_key = await get_secret(openai_secret_name)
        except Exception as e:
            print(f"❌ Failed to load secrets from Secret Manager: {e}")
            raise Exception("AI Service requires valid OpenAI API credentials")
        
        # Load configuration from environment variables
        self.model_name = os.getenv("MODEL_NAME", "gpt-4o-mini")
        self.max_tokens = int(os.getenv("MAX_TOKENS", "3000"))
        self.temperature = float(os.getenv("TEMPERATURE", "0.7"))
        
        # Validate required secrets
        if not self.openai_api_key:
            raise Exception("OpenAI API key not found in Secret Manager")
        
        # Initialize OpenAI client
        self.client = OpenAI(api_key=self.openai_api_key)
        
        # Print status
        print(f"   OpenAI API Key: ✅ Set")
        print(f"   Model: {self.model_name}")
        print(f"   Max Tokens: {self.max_tokens}")
        print(f"   Temperature: {self.temperature}")
        print("✅ AI Service initialized successfully")

    async def _respond_json(self, instructions: str, schema: Dict[str, Any], model: str = None) -> Dict[str, Any]:
        """Helper method for structured JSON responses using Chat Completions"""
        if not self.client:
            raise Exception("AI Service not initialized - call initialize_secrets() first")
            
        model = model or self.model_name
        
        # Add schema information to the prompt
        schema_instructions = f"""
        {instructions}

        {STRUCTURED_OUTPUT_INSTRUCTIONS.format(schema=json.dumps(schema, indent=2))}
        """
        
        response = await asyncio.to_thread(
            self.client.chat.completions.create,
            model=model,
            messages=[{"role": "user", "content": schema_instructions}],
            response_format={"type": "json_object"},
            max_tokens=self.max_tokens,
            temperature=self.temperature
        )
        return json.loads(response.choices[0].message.content)



    async def generate_soap_note(
        self,
        transcript: str,
        client_age: int,
        diagnosis: str,
        short_term_goals: List[str],
        long_term_goals: List[str],
        session_activities: List[str],
        observations: str = "",
        time_in: str = "",
        time_out: str = "",
        units: int = 0,
        treatment_codes: List[str] = []
    ) -> SOAPNote:
        """Generate SOAP note using AI with enhanced synthesis"""
        
        instructions = SOAP_NOTE_PROMPT.format(
            client_age=client_age,
            diagnosis=diagnosis,
            short_term_goals=', '.join(short_term_goals or []),
            long_term_goals=', '.join(long_term_goals or []),
            session_activities=', '.join(session_activities or []),
            observations=observations,
            transcript=transcript
        )
        
        # Use structured output with JSON schema
        content = await self._respond_json(instructions, SOAP_SCHEMA, self.model_name)
        
        # Create SOAP note from structured response
        return SOAPNote(
            subjective=content["subjective"],
            objective=content["objective"],
            assessment=content["assessment"],
            plan=content["plan"],
            synthesized_summary=content["synthesized_summary"],
            short_term_goals=short_term_goals or [],
            long_term_goals=long_term_goals or [],
            goals_addressed=content["goals_addressed"],
            next_session_recommendations=content["next_session_recommendations"],
            confidence_score=content["confidence_score"],
            time_in=time_in,
            time_out=time_out,
            units=units,
            treatment_codes=treatment_codes or []
        )


    async def transcribe_audio(self, audio_data: bytes) -> str:
        """Transcribe audio using OpenAI Whisper"""
        
        # Create a temporary file for the audio
        import tempfile
        
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as temp_file:
            temp_file.write(audio_data)
            temp_file_path = temp_file.name
        
        try:
            # Transcribe using OpenAI Whisper
            with open(temp_file_path, "rb") as audio_file:
                transcript = await asyncio.to_thread(
                    self.client.audio.transcriptions.create,
                    model="whisper-1",
                    file=audio_file,
                    response_format="text"
                )
            
            return transcript
            
        finally:
            # Clean up temporary file
            import os
            if os.path.exists(temp_file_path):
                os.unlink(temp_file_path)
