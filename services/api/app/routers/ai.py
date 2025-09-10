from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends
from typing import List, Optional
import httpx
import os
import json
from google.auth.transport.requests import Request
from google.oauth2 import service_account
import google.auth
from ..security import require_therapist

router = APIRouter(prefix="/ai")

# Get AI service URL from environment
AI_SERVICE_URL = os.getenv("AI_SERVICE_URL", "http://tv-ai:8000")

async def get_ai_service_headers():
    """Get authenticated headers for calling AI service"""
    try:
        # Use Google Cloud metadata server to get identity token
        import httpx
        
        # Get identity token from metadata server (Cloud Run specific)
        metadata_url = "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity"
        params = {"audience": AI_SERVICE_URL}
        headers = {"Metadata-Flavor": "Google"}
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(metadata_url, params=params, headers=headers)
            
        if response.status_code == 200:
            identity_token = response.text
            return {"Authorization": f"Bearer {identity_token}"}
        else:
            print(f"Failed to get identity token: {response.status_code}")
            return {}
            
    except Exception as e:
        print(f"Warning: Could not get identity token: {e}")
        # In development, return empty headers (AI service allows all origins)
        return {}

@router.post("/transcribe-audio")
async def transcribe_audio(
    audio_file: UploadFile = File(...),
    ctx = Depends(require_therapist)
):
    """Proxy audio transcription to AI service"""
    try:
        # Forward the audio file to AI service
        files = {"audio_file": (audio_file.filename, await audio_file.read(), audio_file.content_type)}
        headers = await get_ai_service_headers()
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{AI_SERVICE_URL}/transcribe-audio",
                files=files,
                headers=headers
            )
        
        if response.status_code == 200:
            return response.json()
        else:
            raise HTTPException(status_code=response.status_code, detail=f"AI service error: {response.text}")
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to transcribe audio: {str(e)}")

@router.post("/generate-soap-note")
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
    treatment_codes: Optional[str] = Form(None),
    ctx = Depends(require_therapist)
):
    """Proxy SOAP note generation to AI service"""
    try:
        print(f"🔧 AI Proxy: Received SOAP request - transcript: {transcript[:50] if transcript else 'None'}...")
        print(f"🔧 AI Proxy: client_age: {client_age}, diagnosis: {diagnosis}")
        print(f"🔧 AI Proxy: audio_file: {audio_file.filename if audio_file else 'None'}")
        # Prepare form data for AI service (exactly as frontend sends it)
        data = {}
        if transcript:
            data["transcript"] = transcript
        if client_age is not None:
            data["client_age"] = str(client_age)
        if diagnosis:
            data["diagnosis"] = diagnosis
        if short_term_goals:
            data["short_term_goals"] = short_term_goals
        if long_term_goals:
            data["long_term_goals"] = long_term_goals
        if session_activities:
            data["session_activities"] = session_activities
        if observations:
            data["observations"] = observations
        if time_in:
            data["time_in"] = time_in
        if time_out:
            data["time_out"] = time_out
        if units is not None:
            data["units"] = str(units)
        if treatment_codes:
            data["treatment_codes"] = treatment_codes
        
        files = {}
        if audio_file:
            files["audio_file"] = (audio_file.filename, await audio_file.read(), audio_file.content_type)
        
        headers = await get_ai_service_headers()
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{AI_SERVICE_URL}/generate-soap-note",
                data=data,
                files=files if files else None,
                headers=headers
            )
        
        if response.status_code == 200:
            return response.json()
        else:
            raise HTTPException(status_code=response.status_code, detail=f"AI service error: {response.text}")
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate SOAP note: {str(e)}")


