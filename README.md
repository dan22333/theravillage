# 🏗️ TheraVillage - Complete MVP

A comprehensive, HIPAA-aligned pediatric therapy management platform built with modern cloud architecture and AI-powered features.

## 🎯 Project Overview

**TheraVillage** is a mobile-first React PWA designed for pediatric therapy agencies that streamlines scheduling, documentation, parent engagement, and compliance. The platform exports EMR-friendly artifacts from day one and provides AI-powered recommendations for therapists.

### 🚀 Key Features (MVP)

- **~40% faster therapist documentation** via AI-powered SOAP note generation
- **Self-serve rescheduling** with drive-time aware logic
- **Lightweight parent portal** for progress tracking and secure messaging
- **EMR-ready exports** (PDF/CSV/JSON) for SimplePractice/Fusion ingestion
- **Automated compliance tracking** with renewal reminders
- **AI-powered exercise recommendations** using LangChain and OpenAI
- **Voice-to-text transcription** capabilities (Whisper integration ready)

## 🏗️ Architecture

### Frontend
- **React.js** with Vite build tool
- **Progressive Web App (PWA)** capabilities
- **Responsive design** for mobile-first experience
- **Role-based routing** (Therapist, Parent, Admin)

### Backend
- **FastAPI** (Python) microservices architecture
- **PostgreSQL** with Cloud SQL for production
- **Firebase Authentication** for secure SSO
- **Async/await** architecture for scalability

### AI Services
- **AI Service** with LangChain integration
- **OpenAI GPT-4** for intelligent recommendations
- **Pinecone** vector database for semantic search
- **Whisper** ready for voice transcription

### Infrastructure
- **Google Cloud Platform** (GCP)
- **Cloud Run** for serverless backend services
- **Cloud SQL** for managed PostgreSQL
- **Secret Manager** for secure credential storage
- **Terraform** for Infrastructure as Code
- **Firebase Hosting** for frontend deployment

## 🗄️ Database Schema

The platform includes a comprehensive database with 20+ tables:

### Core Entities
- **Users & Roles** (therapist, parent, admin)
- **Organizations** with multi-tenant support
- **Clients** with comprehensive profiles
- **Appointments** with scheduling logic
- **Sessions** with time tracking
- **Notes** with SOAP documentation
- **Exercises** with AI recommendations
- **Homework Plans** with progress tracking

### Advanced Features
- **Messaging** with secure threads
- **File Management** with metadata
- **Credentials** with expiration tracking
- **Claim Checks** for billing readiness
- **Audit Logs** for HIPAA compliance
- **Notifications** across multiple channels

## 🎭 User Roles & Permissions

### Therapist
- ✅ View own schedule & clients
- ✅ Create/Edit notes & sign
- ✅ Assign & track homework
- ✅ Messaging (PHI-safe)
- ✅ Manage client profiles
- ✅ Start/end therapy sessions
- ✅ Access AI recommendations

### Parent/Guardian
- ✅ View child progress
- ✅ Complete homework assignments
- ✅ Secure messaging
- ✅ Appointment management
- ✅ Progress summaries

### Admin/Scheduler
- ✅ Organization-wide dashboard
- ✅ Multi-therapist scheduling
- ✅ Roster management
- ✅ Billing readiness & exports
- ✅ Compliance center
- ✅ Template management

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ and pnpm
- Python 3.11+
- Docker and Docker Compose
- Google Cloud CLI
- Firebase project

### Local Development

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd theravillage
   ```

2. **Start the backend services**
   ```bash
   docker-compose up tv-postgres tv-ai
   ```

3. **Start the main API**
   ```bash
   cd services/api
   pip install -r requirements.txt
   uvicorn app.main:app --reload --port 8083
   ```

4. **Start the frontend**
   ```bash
   cd apps/web
   pnpm install
   pnpm dev
   ```

5. **Access the application**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:8083
   - AI Service: http://localhost:8001

### Environment Configuration

The project uses two environment files for different purposes:

#### **`.env` file** (Environment-agnostic variables)
```bash
# AI Service Configuration
OPENAI_API_KEY=your_openai_api_key_here
PINECONE_API_KEY=your_pinecone_api_key_here
PINECONE_ENVIRONMENT=your_pinecone_environment_here
PINECONE_INDEX_NAME=theravillage-exercises
MODEL_NAME=gpt-4o-mini
MAX_TOKENS=1000
TEMPERATURE=0.7

# Database Configuration (defaults)
POSTGRES_DB=theravillage
POSTGRES_USER=tv_admin
POSTGRES_PASSWORD=TheraVillage2024!
POSTGRES_PORT=5433

# API Configuration (defaults)
API_PORT=8083
LOG_LEVEL=DEBUG

# Google Cloud Configuration
GOOGLE_CLOUD_PROJECT=your-project-id
FIREBASE_PROJECT_ID=your-firebase-project
```

#### **`env.local` file** (Local development overrides)
```bash
# Database Configuration (local overrides)
POSTGRES_DB=theravillage
POSTGRES_USER=tv_admin
POSTGRES_PASSWORD=TheraVillage2024!
POSTGRES_PORT=5433

# API Configuration (local overrides)
API_PORT=8083
ENVIRONMENT=development
LOG_LEVEL=DEBUG

# Google Cloud Configuration (local overrides)
GOOGLE_CLOUD_PROJECT=theravillage-edb89
FIREBASE_PROJECT_ID=theravillage-edb89
```

**Note**: 
- **`.env`** contains variables that are the same across all environments (like API keys)
- **`env.local`** contains local development overrides
- **Docker Compose** reads from both files, with `.env` taking precedence
- Both files are in `.gitignore` to keep sensitive information secure

## 🔧 API Endpoints

### Authentication
- `POST /users/register` - User registration
- `GET /users/me` - Current user info

### Therapist Endpoints
- `GET /therapist/clients` - Get assigned clients
- `POST /therapist/clients` - Create new client
- `GET /therapist/appointments` - Get appointments
- `POST /therapist/appointments` - Create appointment
- `POST /therapist/sessions/{id}/start` - Start session
- `POST /therapist/sessions/{id}/end` - End session
- `GET /therapist/exercises` - Get exercise library
- `GET /therapist/homework/{client_id}` - Get homework plans

### Admin Endpoints
- `GET /admin/users` - Get all users
- `GET /admin/clients` - Get all clients

### AI Service Endpoints
- `POST /recommend/exercises` - AI exercise recommendations
- `POST /generate/soap` - AI SOAP note generation
- `POST /generate/homework` - AI homework planning
- `GET /exercises/search` - Semantic exercise search
- `POST /analyze/session` - Session analysis

## 🎨 Frontend Components

### Core Components
- **TherapistDashboard** - Main therapist interface
- **ClientManagement** - Client CRUD operations
- **AdminPanel** - Administrative functions
- **UserActions** - User management
- **UserList** - User listing and management

### Features
- **Responsive Design** - Mobile-first approach
- **Real-time Updates** - Live data synchronization
- **Modal Interfaces** - Clean form interactions
- **Search & Filtering** - Advanced data discovery
- **Status Indicators** - Visual feedback systems

## 🚀 Deployment

### Production Deployment

1. **Deploy Infrastructure**
   ```bash
   cd infra/terraform
   terraform init
   terraform plan
   terraform apply
   ```

2. **Deploy Backend**
   ```bash
   gcloud run deploy tv-api \
     --image gcr.io/your-project/api:latest \
     --region us-central1 \
     --platform managed
   ```

3. **Deploy Frontend**
   ```bash
   cd apps/web
   pnpm build
   firebase deploy
   ```

### Environment Variables

Set these in your Cloud Run service:
- `DATABASE_URL` - Cloud SQL connection string
- `FIREBASE_ADMIN_JSON` - Firebase service account
- `ENVIRONMENT` - Set to "production"

## 🔒 Security Features

- **HIPAA Compliance** - PHI protection and audit trails
- **Role-Based Access Control** - Granular permissions
- **Secure Authentication** - Firebase Auth with JWT tokens
- **Data Encryption** - At rest and in transit
- **Audit Logging** - Complete action tracking
- **CORS Protection** - Cross-origin request security

## 📊 Monitoring & Analytics

- **Health Checks** - Service monitoring
- **Request Logging** - Security and debugging
- **Error Tracking** - Comprehensive error handling
- **Performance Metrics** - Response time monitoring
- **User Analytics** - Usage patterns and insights

## 🔮 Future Enhancements

### Phase 2 Features
- [ ] **Whisper Integration** - Voice-to-text transcription
- [ ] **Advanced AI Models** - Custom fine-tuned models
- [ ] **Mobile App** - Native iOS/Android applications
- [ ] **Advanced Analytics** - Business intelligence dashboard
- [ ] **EMR Integration** - Direct API connections
- [ ] **Payment Processing** - Billing and invoicing
- [ ] **Multi-language Support** - Internationalization
- [ ] **Advanced Scheduling** - AI-powered optimization

### Technical Improvements
- [ ] **Microservices** - Service mesh architecture
- [ ] **Event Streaming** - Real-time data pipelines
- [ ] **Advanced Caching** - Redis and CDN integration
- [ ] **Load Balancing** - Global distribution
- [ ] **Auto-scaling** - Dynamic resource management

## 🧪 Testing

### Backend Testing
```bash
cd services/api
pytest tests/
```

### Frontend Testing
```bash
cd apps/web
pnpm test
```

### Integration Testing
```bash
docker-compose -f docker-compose.test.yml up
```

## 📚 Documentation

- **API Documentation** - Available at `/docs` when running
- **Component Library** - Storybook integration
- **Database Schema** - ERD and relationship diagrams
- **Deployment Guide** - Step-by-step instructions
- **User Manuals** - Role-specific guides

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

This project is proprietary software. All rights reserved.

## 🆘 Support

For technical support or questions:
- Create an issue in the repository
- Contact the development team
- Check the documentation

## 🏆 Acknowledgments

- **OpenAI** for AI capabilities
- **LangChain** for AI framework
- **Google Cloud** for infrastructure
- **Firebase** for authentication and hosting
- **FastAPI** for high-performance API framework

---

**TheraVillage** - Transforming pediatric therapy through intelligent technology and compassionate care. 🏥✨
