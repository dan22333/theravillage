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
          value = "2025-08-30-12"
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
    google_secret_manager_secret.firebase_admin_json
  ]
}

####################################
# 7) Cloud Run IAM - Allow unauthenticated access (for now)
####################################
resource "google_cloud_run_service_iam_member" "public_access" {
  location = google_cloud_run_service.api.location
  service  = google_cloud_run_service.api.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

####################################
# 8) Outputs
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

output "cloud_run_url" {
  value = google_cloud_run_service.api.status[0].url
}

####################################
# NOTES
# - After apply, add secret *versions*:
#     gcloud secrets versions add DATABASE_URL --data-file=- <<< \
#       "postgres://<USER>:<PASSWORD>@/<DBNAME>?host=/cloudsql/${google_sql_database_instance.pg.connection_name}"
#     gcloud secrets versions add FIREBASE_ADMIN_JSON --data-file=./firebase-admin.json
# - Ensure your CI/CD pushes the image to Artifact Registry at the URL above.
# - Consider pinning image digests for reproducibility instead of :latest.
