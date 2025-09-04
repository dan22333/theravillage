from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import firebase_admin
from firebase_admin import credentials
import os
import json
import uuid
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

from .db import init_db
from .routers import health, auth, client, therapist, admin, ai

app = FastAPI(title="TheraVillage API", version="1.0.0")

# Initialize Firebase Admin SDK
try:
    # Get Firebase credentials from environment or Secret Manager
    firebase_creds_json = os.getenv("FIREBASE_ADMIN_JSON")
    
    if not firebase_creds_json:
        # Try to get from Secret Manager (for production or local development)
        try:
            import google.cloud.secretmanager as secretmanager
            secret_client = secretmanager.SecretManagerServiceClient()
            secret_name = f"projects/theravillage-edb89/secrets/FIREBASE_ADMIN_JSON/versions/latest"
            response = secret_client.access_secret_version(request={"name": secret_name})
            firebase_creds_json = response.payload.data.decode("UTF-8")
            print("✅ Firebase credentials loaded from Secret Manager")
        except Exception as secret_error:
            print(f"⚠️  Could not load from Secret Manager: {secret_error}")
            print("⚠️  Firebase Admin SDK will not work - authentication will fail")
    
    if firebase_creds_json:
        creds = credentials.Certificate(json.loads(firebase_creds_json))
        firebase_admin.initialize_app(creds)
        print("✅ Firebase Admin SDK initialized successfully")
    else:
        print("⚠️  No Firebase credentials found - authentication will fail")
        firebase_admin.initialize_app()
except Exception as e:
    print(f"Firebase initialization error: {e}")

# CORS middleware - must be added before other middleware
# Get environment to determine CORS settings
environment = os.getenv("ENVIRONMENT", "development")

# Get CORS origins from environment variable
cors_origins = os.getenv("CORS_ALLOWED_ORIGINS", "")

if cors_origins:
    # Use environment variable if provided
    allowed_origins = [origin.strip() for origin in cors_origins.split(",")]
elif environment == "development":
    # Development fallback: Allow all origins
    allowed_origins = ["*"]
else:
    # Production fallback: No origins allowed (secure by default)
    print("⚠️  WARNING: CORS_ALLOWED_ORIGINS not set in production!")
    allowed_origins = []

print(f"🔧 CORS Configuration:")
print(f"   Environment: {environment}")
print(f"   CORS_ALLOWED_ORIGINS: {cors_origins}")
print(f"   Allowed origins: {allowed_origins}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True if environment == "production" else False,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    """Initialize database on startup"""
    print("🚀 Starting TheraVillage API...")
    print(f"🌍 Environment: {os.getenv('ENVIRONMENT', 'development')}")
    print(f"🔗 Database URL configured: {'Yes' if os.getenv('DATABASE_URL') else 'No'}")
    
    try:
        print("🔧 Initializing database...")
        await init_db()
        print("✅ Database initialized successfully")
    except Exception as e:
        print(f"❌ Database initialization failed: {e}")
        print(f"❌ Error type: {type(e).__name__}")
        import traceback
        print(f"❌ Full traceback: {traceback.format_exc()}")
        print("⚠️  API will start but database features will not work")



# Security middleware to log all requests
@app.middleware("http")
async def security_middleware(request, call_next):
    """Log all requests for security monitoring"""
    request_id = str(uuid.uuid4())
    
    # Log CORS preflight requests
    if request.method == "OPTIONS":
        origin = request.headers.get("origin", "No origin")
        print(f"🌐 CORS PREFLIGHT: {request_id} - Origin: {origin} - Path: {request.url.path}")
    
    # Log client route access attempts
    if request.url.path.startswith("/client/"):
        print(f"🔒 CLIENT ROUTE ACCESS: {request_id} - {request.method} {request.url} - {request.client.host}")
    
    print(f"🔒 SECURITY LOG: {request_id} - {request.method} {request.url} - {request.client.host}")
    
    start_time = datetime.now()
    response = await call_next(request)
    process_time = datetime.now() - start_time
    
    # Log CORS headers in response
    if "origin" in request.headers:
        cors_origin = response.headers.get("access-control-allow-origin", "No CORS header")
        print(f"🌐 CORS RESPONSE: {request_id} - Origin: {request.headers['origin']} - CORS Header: {cors_origin}")
    
    # Log unauthorized access to client routes
    if request.url.path.startswith("/client/") and response.status_code in [401, 403]:
        print(f"🚨 UNAUTHORIZED CLIENT ACCESS: {request_id} - Status: {response.status_code}")
    
    print(f"🔒 SECURITY LOG: {request_id} - Completed in {process_time.total_seconds():.3f}s - Status: {response.status_code}")
    
    return response

# Include routers
app.include_router(health.router, tags=["health"])
app.include_router(auth.router, tags=["auth"])
app.include_router(client.router, tags=["client"])
app.include_router(therapist.router, tags=["therapist"])
app.include_router(admin.router, tags=["admin"])
app.include_router(ai.router, tags=["ai"])


