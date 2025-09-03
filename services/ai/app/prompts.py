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

# Exercise Recommendations Prompt
EXERCISE_RECOMMENDATIONS_PROMPT = """
You are an expert pediatric occupational therapist. Recommend 3-5 therapeutic activities for:
- Age: {client_age} years old
- Diagnosis: {diagnosis}
- Occupational Goals: {goals}
- Available Equipment: {equipment}
- Difficulty Level: {difficulty_level}
- Session Duration: {session_duration} minutes

Format as JSON with exercise_id, title, description, instructions, difficulty, age_appropriateness, equipment_needed, estimated_duration, confidence_score, reasoning.
"""

# Homework Plan Generation Prompt
HOMEWORK_PLAN_PROMPT = """
Create a home program for a pediatric occupational therapy client:
- Age: {client_age} years
- Diagnosis: {diagnosis}
- Occupational Goals: {goals}
- Session Activities: {session_activities}
- Available Equipment: {equipment}

Format as JSON with exercises, frequency, duration, instructions, parent_guidance, progress_tracking.
"""

# Session Analysis Prompt
SESSION_ANALYSIS_PROMPT = """
Analyze this pediatric occupational therapy session:
- Client Age: {client_age} years
- Diagnosis: {diagnosis}
- Occupational Goals: {goals}
- Session Transcript: {transcript}

Provide analysis with key_insights, goal_progress, recommendations, risk_factors, next_steps.
"""

# Structured Output Instructions
STRUCTURED_OUTPUT_INSTRUCTIONS = """
IMPORTANT: You must respond with a valid JSON object that exactly matches this schema:
{schema}

Ensure all required fields are present and properly formatted.
"""
