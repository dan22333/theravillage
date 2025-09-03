import os
import asyncio
import json
from typing import List, Optional, Dict, Any
from openai import OpenAI
from dotenv import load_dotenv
from .models import (
    ExerciseRecommendation, 
    SOAPNote, 
    HomeworkPlan, 
    SessionAnalysis,
    ExerciseSearchResult
)
from .prompts import (
    SOAP_NOTE_PROMPT,
    EXERCISE_RECOMMENDATIONS_PROMPT,
    HOMEWORK_PLAN_PROMPT,
    SESSION_ANALYSIS_PROMPT,
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

EXERCISE_SCHEMA = {
    "type": "array",
    "items": {
        "type": "object",
        "properties": {
            "exercise_id": {"type": "string"},
            "title": {"type": "string"},
            "description": {"type": "string"},
            "instructions": {"type": "string"},
            "difficulty": {"type": "string"},
            "age_appropriateness": {"type": "string"},
            "equipment_needed": {"type": "array", "items": {"type": "string"}},
            "estimated_duration": {"type": "integer"},
            "confidence_score": {"type": "number"},
            "reasoning": {"type": "string"}
        },
        "required": ["exercise_id", "title", "description", "instructions", "difficulty", "age_appropriateness", "equipment_needed", "estimated_duration", "confidence_score", "reasoning"],
        "additionalProperties": False
    }
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
        self.pinecone_api_key = None
        self.model_name = None
        self.max_tokens = None
        self.temperature = None
        self.pinecone_environment = None
        self.pinecone_index_name = None
        self.client = None

    async def initialize_secrets(self):
        """Initialize secrets from Secret Manager"""
        print("🔧 Loading secrets from Secret Manager...")
        
        try:
            # Get secret names from environment variables
            openai_secret_name = os.getenv("OPENAI_API_KEY_SECRET_NAME", "OPENAI_API_KEY")
            pinecone_secret_name = os.getenv("PINECONE_API_KEY_SECRET_NAME", "PINECONE_API_KEY")
            
            self.openai_api_key = await get_secret(openai_secret_name)
            self.pinecone_api_key = await get_secret(pinecone_secret_name)
        except Exception as e:
            print(f"❌ Failed to load secrets from Secret Manager: {e}")
            raise Exception("AI Service requires valid OpenAI API credentials")
        
        # Load configuration from environment variables
        self.model_name = os.getenv("MODEL_NAME", "gpt-4o-mini")
        self.max_tokens = int(os.getenv("MAX_TOKENS", "3000"))
        self.temperature = float(os.getenv("TEMPERATURE", "0.7"))
        self.pinecone_environment = os.getenv("PINECONE_ENVIRONMENT")
        self.pinecone_index_name = os.getenv("PINECONE_INDEX_NAME")
        
        # Validate required secrets
        if not self.openai_api_key:
            raise Exception("OpenAI API key not found in Secret Manager")
        
        # Initialize OpenAI client
        self.client = OpenAI(api_key=self.openai_api_key)
        
        # Print status
        print(f"   OpenAI API Key: ✅ Set")
        print(f"   Pinecone API Key: {'✅ Set' if self.pinecone_api_key else '❌ Not found'}")
        print(f"   Model: {self.model_name}")
        print(f"   Max Tokens: {self.max_tokens}")
        print(f"   Temperature: {self.temperature}")
        print(f"   Pinecone Environment: {self.pinecone_environment}")
        print(f"   Pinecone Index: {self.pinecone_index_name}")
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

    async def _chat(self, messages: List[Dict[str, str]], model: str = None, max_tokens: int = 600, temperature: float = 0.7) -> str:
        """Helper method for chat completions"""
        if not self.client:
            raise Exception("AI Service not initialized - call initialize_secrets() first")
            
        model = model or self.model_name
        
        response = await asyncio.to_thread(
            self.client.chat.completions.create,
            model=model,
            messages=messages,
            max_tokens=max_tokens,
            temperature=temperature,
        )
        return response.choices[0].message.content

    async def recommend_exercises(
        self,
        client_age: int,
        diagnosis: str,
        goals: List[str],
        equipment_available: Optional[List[str]] = None,
        difficulty_level: str = "moderate",
        session_duration: int = 30
    ) -> List[ExerciseRecommendation]:
        """Generate AI-powered exercise recommendations"""
        
        prompt = EXERCISE_RECOMMENDATIONS_PROMPT.format(
            client_age=client_age,
            diagnosis=diagnosis,
            goals=', '.join(goals),
            equipment=', '.join(equipment_available or []),
            difficulty_level=difficulty_level,
            session_duration=session_duration
        )
        
        response = await asyncio.to_thread(
            self.client.chat.completions.create,
            model=self.model_name,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=self.max_tokens,
            temperature=self.temperature
        )
        
        # Parse response and create recommendations
        content = response.choices[0].message.content
        return self._parse_exercise_recommendations(content, client_age, diagnosis)

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

    async def generate_homework_plan(
        self,
        client_age: int,
        diagnosis: str,
        goals: List[str],
        session_activities: List[str],
        equipment_available: Optional[List[str]] = None,
        difficulty_level: str = "moderate"
    ) -> HomeworkPlan:
        """Generate homework plan based on session activities"""
        
        # First get exercise recommendations
        exercises = await self.recommend_exercises(
            client_age=client_age,
            diagnosis=diagnosis,
            goals=goals,
            equipment_available=equipment_available,
            difficulty_level=difficulty_level
        )
        
        prompt = HOMEWORK_PLAN_PROMPT.format(
            client_age=client_age,
            diagnosis=diagnosis,
            goals=', '.join(goals),
            session_activities=', '.join(session_activities),
            equipment=', '.join(equipment_available or [])
        )
        
        response = await asyncio.to_thread(
            self.client.chat.completions.create,
            model=self.model_name,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=self.max_tokens,
            temperature=self.temperature
        )
        
        content = response.choices[0].message.content
        return self._parse_homework_plan(content, exercises)

    async def search_exercises(
        self,
        query: str,
        tags: Optional[str] = None,
        difficulty: Optional[str] = None,
        age_group: Optional[str] = None
    ) -> List[ExerciseSearchResult]:
        """Search exercises using semantic search"""
        # TODO: Implement Pinecone vector search
        raise NotImplementedError("Exercise search requires Pinecone integration")

    async def analyze_session(
        self,
        transcript: str,
        client_age: int,
        diagnosis: str,
        goals: List[str]
    ) -> SessionAnalysis:
        """Analyze session transcript and provide insights"""
        
        prompt = SESSION_ANALYSIS_PROMPT.format(
            client_age=client_age,
            diagnosis=diagnosis,
            goals=', '.join(goals),
            transcript=transcript
        )
        
        response = await asyncio.to_thread(
            self.client.chat.completions.create,
            model=self.model_name,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=self.max_tokens,
            temperature=self.temperature
        )
        
        content = response.choices[0].message.content
        return self._parse_session_analysis(content)

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

    def _parse_exercise_recommendations(self, content: str, client_age: int, diagnosis: str) -> List[ExerciseRecommendation]:
        """Parse exercise recommendations from AI response"""
        try:
            # Try to parse as JSON first
            if content.strip().startswith('['):
                data = json.loads(content)
            else:
                # If not JSON, try to extract from text
                data = self._extract_json_from_text(content)
            
            recommendations = []
            for item in data:
                if isinstance(item, dict):
                    recommendation = ExerciseRecommendation(
                        exercise_id=item.get('exercise_id', f"ex_{len(recommendations)+1:03d}"),
                        title=item.get('title', 'Unnamed Exercise'),
                        description=item.get('description', ''),
                        instructions=item.get('instructions', ''),
                        difficulty=item.get('difficulty', 'moderate'),
                        age_appropriateness=item.get('age_appropriateness', f'Suitable for {client_age}-year-olds'),
                        equipment_needed=item.get('equipment_needed', []),
                        estimated_duration=item.get('estimated_duration', 15),
                        confidence_score=item.get('confidence_score', 0.8),
                        reasoning=item.get('reasoning', '')
                    )
                    recommendations.append(recommendation)
            
            return recommendations
        except Exception as e:
            print(f"Error parsing exercise recommendations: {e}")
            raise Exception(f"Failed to parse AI response: {str(e)}")

    def _parse_homework_plan(self, content: str, exercises: List[ExerciseRecommendation]) -> HomeworkPlan:
        """Parse homework plan from AI response"""
        try:
            # Try to parse as JSON first
            if content.strip().startswith('{'):
                data = json.loads(content)
            else:
                # If not JSON, try to extract from text
                data = self._extract_json_from_text(content)
            
            return HomeworkPlan(
                exercises=exercises,
                frequency=data.get('frequency', '3 times per week'),
                duration=data.get('duration', '15-20 minutes per session'),
                instructions=data.get('instructions', 'Practice the recommended exercises at home'),
                parent_guidance=data.get('parent_guidance', 'Supervise and encourage completion'),
                progress_tracking=data.get('progress_tracking', 'Note improvements in coordination and confidence')
            )
        except Exception as e:
            print(f"Error parsing homework plan: {e}")
            raise Exception(f"Failed to parse AI response: {str(e)}")

    def _parse_session_analysis(self, content: str) -> SessionAnalysis:
        """Parse session analysis from AI response"""
        try:
            # Try to parse as JSON first
            if content.strip().startswith('{'):
                data = json.loads(content)
            else:
                # If not JSON, try to extract from text
                data = self._extract_json_from_text(content)
            
            return SessionAnalysis(
                key_insights=data.get('key_insights', ['Client showed improved focus']),
                goal_progress=data.get('goal_progress', {'coordination': 0.75, 'confidence': 0.80}),
                recommendations=data.get('recommendations', ['Continue current exercise routine']),
                risk_factors=data.get('risk_factors', ['None identified']),
                next_steps=data.get('next_steps', ['Increase difficulty gradually'])
            )
        except Exception as e:
            print(f"Error parsing session analysis: {e}")
            raise Exception(f"Failed to parse AI response: {str(e)}")

    def _extract_json_from_text(self, text: str) -> Dict[str, Any]:
        """Extract JSON from text that might contain other content"""
        try:
            # Look for JSON blocks in the text
            start = text.find('{')
            end = text.rfind('}') + 1
            if start != -1 and end != 0:
                json_str = text[start:end]
                return json.loads(json_str)
            
            # If no JSON object found, look for array
            start = text.find('[')
            end = text.rfind(']') + 1
            if start != -1 and end != 0:
                json_str = text[start:end]
                return json.loads(json_str)
            
            # Fallback to empty dict
            return {}
        except Exception as e:
            print(f"Error extracting JSON from text: {e}")
            return {}