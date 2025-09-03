# TheraVillage Deployment Guide

## 🚀 Cloud Deployment Process

### **Prerequisites:**
1. Docker images must be built and pushed to Artifact Registry
2. Secrets must be configured in Secret Manager
3. Terraform must be applied

### **Step 1: Build and Push Docker Images**

```bash
# Build AI service
make build-ai

# Build API service  
make build-api

# Tag and push to Artifact Registry (should be done in CI/CD)
docker tag theravillage-tv-ai:latest us-central1-docker.pkg.dev/theravillage-edb89/tv/ai:latest
docker tag theravillage-tv-api:latest us-central1-docker.pkg.dev/theravillage-edb89/tv/api:latest

docker push us-central1-docker.pkg.dev/theravillage-edb89/tv/ai:latest
docker push us-central1-docker.pkg.dev/theravillage-edb89/tv/api:latest
```

### **Step 2: Configure Secrets**

```bash
# Add OpenAI API key
echo "your-openai-api-key" | gcloud secrets versions add OPENAI_API_KEY --data-file=-

# Add Pinecone API key  
echo "your-pinecone-api-key" | gcloud secrets versions add PINECONE_API_KEY --data-file=-
```

### **Step 3: Apply Terraform**

```bash
cd infra/terraform
terraform plan
terraform apply
```

## 🔧 Local Development

### **Start all services:**
```bash
make up
```

### **Build specific services:**
```bash
make build-ai    # Build AI service only
make build-api   # Build API service only
make build       # Build all services
```

### **View logs:**
```bash
make logs        # All services
make api-logs    # API service only
```

## 🏗️ Architecture

- **Frontend**: Firebase Hosting (public)
- **API Service**: Cloud Run (public, authenticated)
- **AI Service**: Cloud Run (private, internal only)
- **Database**: Cloud SQL (private)
- **Secrets**: Secret Manager
- **Images**: Artifact Registry

## 🔒 Security Model

- **AI Service**: Only accessible by API service (no public access)
- **API Service**: Public access with Firebase authentication
- **Database**: Private, accessible only by API service
- **Secrets**: Managed by Secret Manager with IAM controls
