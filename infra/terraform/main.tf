# Terraform: TheraVillage Cloud Run + Cloud SQL (Option B: Cloud SQL Connector)
# - Uses Artifact Registry for images
# - Cloud Run connects to Cloud SQL via connector (annotation)
# - Secrets pulled from Secret Manager at runtime

####################################
# 1) Artifact Registry (Docker)
####################################
resource "google_artifact_registry_repository" "docker" {
  location      = var.region
  repository_id = var.artifact_repo
  description   = "TheraVillage containers"
  format        = "DOCKER"
}

####################################
# 2) Service Account for Cloud Run API
####################################
resource "google_service_account" "api_sa" {
  account_id   = "tv-api-sa"
  display_name = "TheraVillage API SA"
}

# Allow the runtime SA to pull from Artifact Registry
resource "google_project_iam_member" "sa_artifact_reader" {
  project = var.project
  role    = "roles/artifactregistry.reader"
  member  = "serviceAccount:${google_service_account.api_sa.email}"
}

####################################
# 3) Cloud SQL Postgres (public IP kept for simplicity)
####################################
resource "google_sql_database_instance" "pg" {
  name             = "tv-pg"
  database_version = "POSTGRES_16"
  region           = var.region

  settings {
    tier = var.db_instance_tier

    ip_configuration {
      ipv4_enabled = true
      # With the Cloud SQL connector, you don't need authorized networks.
      # Leaving public IP on avoids needing a VPC connector for MVP simplicity.
    }

    backup_configuration {
      enabled = true
    }
  }
}

resource "google_sql_database" "appdb" {
  name     = var.db_name
  instance = google_sql_database_instance.pg.name
}

resource "google_sql_user" "appuser" {
  name     = var.db_user
  instance = google_sql_database_instance.pg.name
  # Password is provisioned outside Terraform (and referenced via Secret Manager)
}

####################################
# 4) Secret Manager (empty secrets; add versions out-of-band)
####################################
resource "google_secret_manager_secret" "db_url" {
  secret_id = "DATABASE_URL"
  replication {
    user_managed {
      replicas { location = var.region }
    }
  }
}

resource "google_secret_manager_secret" "firebase_admin_json" {
  secret_id = "FIREBASE_ADMIN_JSON"
  replication {
    user_managed {
      replicas { location = var.region }
    }
  }
}

# Email credentials for Cloud Functions
resource "google_secret_manager_secret" "email_user" {
  secret_id = "EMAIL_USER"
  replication {
    auto {}
  }
}

resource "google_secret_manager_secret" "email_password" {
  secret_id = "EMAIL_PASSWORD"
  replication {
    auto {}
  }
}

# AI Service secrets
resource "google_secret_manager_secret" "openai_api_key" {
  secret_id = "OPENAI_API_KEY"
  replication {
    user_managed {
      replicas { location = var.region }
    }
  }
}

resource "google_secret_manager_secret" "pinecone_api_key" {
  secret_id = "PINECONE_API_KEY"
  replication {
    user_managed {
      replicas { location = var.region }
    }
  }
}

resource "google_secret_manager_secret" "tavily_api_key" {
  secret_id = "TAVILY_API_KEY"
  replication {
    user_managed {
      replicas { location = var.region }
    }
  }
}



####################################
# 5) IAM bindings for runtime SA
####################################
# Read secret values
resource "google_project_iam_member" "sa_secret_access" {
  project = var.project
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.api_sa.email}"
}

# Use Cloud SQL connector
resource "google_project_iam_member" "sa_sql_client" {
  project = var.project
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.api_sa.email}"
}

# Firebase admin operations
resource "google_project_iam_member" "sa_firebase_admin" {
  project = var.project
  role    = "roles/firebase.admin"
  member  = "serviceAccount:${google_service_account.api_sa.email}"
}

####################################
# 5.5) Service Account for Cloud Functions
####################################
resource "google_service_account" "functions_sa" {
  account_id   = "tv-functions-sa"
  display_name = "TheraVillage Cloud Functions SA"
}

# Allow Cloud Functions to access secrets
resource "google_project_iam_member" "functions_secret_access" {
  project = var.project
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.functions_sa.email}"
}

# Note: Gmail sending is done via SMTP, not Gmail API, so no special IAM needed

####################################
# 6) Cloud Run Service for Backend API
####################################
resource "google_cloud_run_service" "api" {
  name     = "tv-api"
  location = var.region

  template {
    metadata {
      annotations = {
        # Option B: Attach Cloud SQL connector to this revision
        "run.googleapis.com/cloudsql-instances" = google_sql_database_instance.pg.connection_name
      }
    }

    spec {
      service_account_name = google_service_account.api_sa.email

      containers {
        # Use Artifact Registry image URL (not gcr.io)
        image = "${var.region}-docker.pkg.dev/${var.project}/${var.artifact_repo}/api:latest"

        # Optional: nudge a new revision when needed
        env {
          name  = "DEPLOYMENT_TIMESTAMP"
          value = "2025-01-03-calendar-update"
        }

        # Set environment to production
        env {
          name  = "ENVIRONMENT"
          value = "production"
        }

        # Set CORS allowed origins for production
        env {
          name  = "CORS_ALLOWED_ORIGINS"
          value = var.cors_allowed_origins
        }

        # Set frontend URL for invite links
        env {
          name  = "FRONTEND_URL"
          value = var.frontend_url
        }

        # Set AI service URL for internal communication
        env {
          name  = "AI_SERVICE_URL"
          value = "https://tv-ai-326430627435.us-central1.run.app"
        }

        ports { container_port = 8080 }

        # Secrets → env vars (Cloud Run v1 schema: value_from.name/key)
        env {
          name = "DATABASE_URL"
          value_from {
            secret_key_ref {
              name = google_secret_manager_secret.db_url.secret_id   # "DATABASE_URL"
              key  = "latest"
            }
          }
        }

        env {
          name = "FIREBASE_ADMIN_JSON"
          value_from {
            secret_key_ref {
              name = google_secret_manager_secret.firebase_admin_json.secret_id
              key  = "latest"
            }
          }
        }



      }
    }
  }

  traffic {
    percent         = 100
    latest_revision = true
  }

  depends_on = [
    google_project_iam_member.sa_artifact_reader,
    google_project_iam_member.sa_secret_access,
    google_project_iam_member.sa_sql_client,
    google_project_iam_member.sa_firebase_admin,
    google_secret_manager_secret.db_url,
    google_secret_manager_secret.firebase_admin_json,
    google_secret_manager_secret.email_user,
    google_secret_manager_secret.email_password
  ]
}

####################################
# 7) Cloud Run Service for AI Service
####################################
resource "google_cloud_run_service" "ai" {
  name     = "tv-ai"
  location = var.region

  template {
    spec {
      service_account_name = google_service_account.api_sa.email

      containers {
        # Use Artifact Registry image URL
        image = "${var.region}-docker.pkg.dev/${var.project}/${var.artifact_repo}/ai:latest"

        # Set environment to production
        env {
          name  = "ENVIRONMENT"
          value = "production"
        }

        # Set CORS allowed origins for production
        env {
          name  = "CORS_ALLOWED_ORIGINS"
          value = var.cors_allowed_origins
        }

        # AI Service configuration
        env {
          name  = "MODEL_NAME"
          value = "gpt-4o-mini"
        }

        env {
          name  = "MAX_TOKENS"
          value = "3000"
        }

        env {
          name  = "TEMPERATURE"
          value = "0.7"
        }

        env {
          name  = "PINECONE_ENVIRONMENT"
          value = "us-central1-gcp"
        }

        env {
          name  = "PINECONE_INDEX_NAME"
          value = "theravillage-exercises"
        }

        ports { container_port = 8000 }

        # AI Service secrets from Secret Manager
        env {
          name = "OPENAI_API_KEY"
          value_from {
            secret_key_ref {
              name = google_secret_manager_secret.openai_api_key.secret_id
              key  = "latest"
            }
          }
        }

        env {
          name = "PINECONE_API_KEY"
          value_from {
            secret_key_ref {
              name = google_secret_manager_secret.pinecone_api_key.secret_id
              key  = "latest"
            }
          }
        }

      }
    }
  }

  traffic {
    percent         = 100
    latest_revision = true
  }

  depends_on = [
    google_project_iam_member.sa_artifact_reader,
    google_project_iam_member.sa_secret_access,
    google_project_iam_member.api_ai_invoker,
    google_secret_manager_secret.openai_api_key,
    google_secret_manager_secret.pinecone_api_key
  ]
}

####################################
# 8) Cloud Run Service for Scraper Service
####################################
resource "google_cloud_run_service" "scraper" {
  name     = "tv-scraper"
  location = var.region

  template {
    metadata {
      annotations = {
        # Attach Cloud SQL connector for database access
        "run.googleapis.com/cloudsql-instances" = google_sql_database_instance.pg.connection_name
      }
    }

    spec {
      service_account_name = google_service_account.api_sa.email

      containers {
        # Use Artifact Registry image URL
        image = "${var.region}-docker.pkg.dev/${var.project}/${var.artifact_repo}/scraper:latest"

        # Set environment to production
        env {
          name  = "ENVIRONMENT"
          value = "production"
        }

        # Set CORS allowed origins for production
        env {
          name  = "CORS_ALLOWED_ORIGINS"
          value = var.cors_allowed_origins
        }

        # Scraper configuration
        env {
          name  = "TAVILY_MAX_RESULTS"
          value = "20"
        }

        env {
          name  = "TAVILY_SEARCH_DEPTH"
          value = "advanced"
        }

        env {
          name  = "OPENAI_MODEL"
          value = "gpt-4o-mini"
        }

        env {
          name  = "MAX_CONCURRENT_JOBS"
          value = "1"
        }

        env {
          name  = "PINECONE_ENVIRONMENT"
          value = "us-central1-gcp"
        }

        env {
          name  = "PINECONE_INDEX_NAME"
          value = "theravillage-exercises"
        }

        # Note: SCRAPER_SERVICE_URL not needed for Cloud Tasks in same container
        # Local development uses localhost, production auto-discovers

        ports { container_port = 8000 }

        # Database connection from Secret Manager
        env {
          name = "DATABASE_URL"
          value_from {
            secret_key_ref {
              name = google_secret_manager_secret.db_url.secret_id
              key  = "latest"
            }
          }
        }

        # API Keys from Secret Manager
        env {
          name = "TAVILY_API_KEY"
          value_from {
            secret_key_ref {
              name = google_secret_manager_secret.tavily_api_key.secret_id
              key  = "latest"
            }
          }
        }

        env {
          name = "OPENAI_API_KEY"
          value_from {
            secret_key_ref {
              name = google_secret_manager_secret.openai_api_key.secret_id
              key  = "latest"
            }
          }
        }

        env {
          name = "PINECONE_API_KEY"
          value_from {
            secret_key_ref {
              name = google_secret_manager_secret.pinecone_api_key.secret_id
              key  = "latest"
            }
          }
        }
      }
    }
  }

  traffic {
    percent         = 100
    latest_revision = true
  }

  depends_on = [
    google_project_iam_member.sa_artifact_reader,
    google_project_iam_member.sa_secret_access,
    google_project_iam_member.sa_sql_client,
    google_secret_manager_secret.db_url,
    google_secret_manager_secret.tavily_api_key,
    google_secret_manager_secret.openai_api_key,
    google_secret_manager_secret.pinecone_api_key
  ]
}

####################################
# 8.5) Cloud Run Job for Cleanup (Proper Separation)
####################################
# Enable Cloud Scheduler API
resource "google_project_service" "cloudscheduler" {
  project = var.project
  service = "cloudscheduler.googleapis.com"
}

# Cloud Scheduler to trigger cleanup via HTTP endpoint (every 12 hours)
resource "google_cloud_scheduler_job" "scraper_cleanup" {
  name        = "scraper-cleanup-schedule"
  region      = var.region
  schedule    = "0 */12 * * *"  # Every 12 hours (at 00:00 and 12:00 UTC)
  time_zone   = "UTC"
  
  http_target {
    uri = "https://tv-scraper-326430627435.us-central1.run.app/jobs/cleanup"
    http_method = "POST"
    
    # Note: OAuth token only works with .googleapis.com URLs
    # Using public endpoint since scraper service allows public access
  }
  
  depends_on = [
    google_project_service.cloudscheduler,
    google_cloud_run_service.scraper
  ]
}

####################################
# 9) Cloud Run IAM - Security Configuration
####################################
resource "google_cloud_run_service_iam_member" "public_access" {
  location = google_cloud_run_service.api.location
  service  = google_cloud_run_service.api.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# AI Service - Private access (only API service can invoke)
resource "google_cloud_run_service_iam_member" "ai_private_access" {
  location = google_cloud_run_service.ai.location
  service  = google_cloud_run_service.ai.name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.api_sa.email}"
}

# Allow API service to invoke AI service
resource "google_project_iam_member" "api_ai_invoker" {
  project = var.project
  role    = "roles/run.invoker"
  member  = "serviceAccount:${google_service_account.api_sa.email}"
}

# Scraper Service - Public access for job management
resource "google_cloud_run_service_iam_member" "scraper_public_access" {
  location = google_cloud_run_service.scraper.location
  service  = google_cloud_run_service.scraper.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

####################################
# 8) Cloud Functions
####################################
# Enable Cloud Functions API
resource "google_project_service" "cloudfunctions" {
  project = var.project
  service = "cloudfunctions.googleapis.com"
}

# Cloud Function for sending client invitations
resource "google_cloudfunctions2_function" "send_client_invitation" {
  name        = "sendClientInvitation"
  location    = var.region
  description = "Sends email invitations to clients"

  build_config {
    runtime     = "nodejs18"
    entry_point = "sendClientInvitation"
    source {
      storage_source {
        bucket = google_storage_bucket.functions_source.name
        object = google_storage_bucket_object.functions_zip.name
      }
    }
  }

  service_config {
    max_instance_count = 1
    available_memory   = "256M"
    timeout_seconds    = 60
    service_account_email = google_service_account.functions_sa.email
    
    environment_variables = {
      ENVIRONMENT = "production"
    }

    secret_environment_variables {
      key        = "EMAIL_USER"
      project_id = var.project
      secret     = google_secret_manager_secret.email_user.secret_id
      version    = "latest"
    }

    secret_environment_variables {
      key        = "EMAIL_PASSWORD"
      project_id = var.project
      secret     = google_secret_manager_secret.email_password.secret_id
      version    = "3"
    }
  }

  depends_on = [
    google_project_service.cloudfunctions,
    google_service_account.functions_sa,
    google_project_iam_member.functions_secret_access
  ]
}

# Storage bucket for Cloud Functions source code
resource "google_storage_bucket" "functions_source" {
  name     = "${var.project}-functions-source"
  location = var.region
  uniform_bucket_level_access = true
}

# Zip the Cloud Functions source code
data "archive_file" "functions_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../../services/cloud_functions"
  output_path = "${path.module}/functions.zip"
}

# Upload the zip to storage
resource "google_storage_bucket_object" "functions_zip" {
  name   = "functions-${data.archive_file.functions_zip.output_md5}.zip"
  bucket = google_storage_bucket.functions_source.name
  source = data.archive_file.functions_zip.output_path
}

####################################
# 9) Outputs
####################################
output "artifact_registry_repo" {
  value = google_artifact_registry_repository.docker.repository_id
}

output "sql_connection_name" {
  value = google_sql_database_instance.pg.connection_name
}

output "sql_public_ip" {
  value = google_sql_database_instance.pg.public_ip_address
}

output "api_service_account" {
  value = google_service_account.api_sa.email
}

output "functions_service_account" {
  value = google_service_account.functions_sa.email
}

output "cloud_run_url" {
  value = google_cloud_run_service.api.status[0].url
}

output "ai_service_url" {
  value = google_cloud_run_service.ai.status[0].url
}

output "scraper_service_url" {
  value = google_cloud_run_service.scraper.status[0].url
}

output "cloud_function_url" {
  value = google_cloudfunctions2_function.send_client_invitation.url
}

####################################
# NOTES
# - After apply, add secret *versions*:
#     gcloud secrets versions add DATABASE_URL --data-file=- <<< \
#       "postgres://<USER>:<PASSWORD>@/<DBNAME>?host=/cloudsql/${google_sql_database_instance.pg.connection_name}"
#     gcloud secrets versions add FIREBASE_ADMIN_JSON --data-file=./firebase-admin.json
#     gcloud secrets versions add OPENAI_API_KEY --data-file=- <<< "your-openai-api-key"
#     gcloud secrets versions add PINECONE_API_KEY --data-file=- <<< "your-pinecone-api-key"
#     gcloud secrets versions add TAVILY_API_KEY --data-file=- <<< "your-tavily-api-key"
# - Ensure your CI/CD pushes the image to Artifact Registry at the URL above.
# - Consider pinning image digests for reproducibility instead of :latest.

####################################
# Frontend Environment Configuration
####################################

# Generate environment configuration file for production builds
resource "local_file" "frontend_env_production" {
  content = <<-EOT
VITE_API_URL=${var.api_url}
EOT

  filename = "${path.module}/../../apps/web/.env.production"
}

# Output the URLs for reference
output "frontend_env_config" {
  description = "Frontend environment configuration"
  value = {
    api_url      = var.api_url
    frontend_url = var.frontend_url
  }
}
