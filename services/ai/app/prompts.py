"""
AI Service Prompts

This module contains all the prompts used by the AI service for different LLM calls.
Separating prompts from logic makes them easier to maintain and iterate on.
"""

# SOAP Note Generation Prompt
SOAP_NOTE_PROMPT = """
You are an expert pediatric occupational therapist. Generate a comprehensive SOAP note based on the session information and return it as JSON:

CLIENT INFORMATION:
- Age: {client_age} years
- Diagnosis: {diagnosis}
- Short-term Goals: {short_term_goals}
- Long-term Goals: {long_term_goals}
- Session Activities: {session_activities}
- Therapist Observations: {observations}
- Session Notes: {transcript}

Generate a professional SOAP note with these sections and return as JSON:

SUBJECTIVE: Client's reported symptoms, concerns, and relevant information shared by client or caregiver.

OBJECTIVE: Measurable observations of client's performance, behaviors, and functional abilities during the session.

ASSESSMENT: Professional evaluation of client's progress toward occupational goals and current functional status.

PLAN: Specific treatment recommendations, modifications, and focus areas for upcoming sessions.

SYNTHESIZED SUMMARY: Concise summary of key session outcomes and progress made.

GOALS ADDRESSED: Specific short-term and long-term occupational goals addressed during this session.

NEXT SESSION RECOMMENDATIONS: Targeted activities and interventions for the next session.
"""



# Structured Output Instructions
STRUCTURED_OUTPUT_INSTRUCTIONS = """
IMPORTANT: You must respond with a valid JSON object that exactly matches this schema:
{schema}

Ensure all required fields are present and properly formatted.
"""
