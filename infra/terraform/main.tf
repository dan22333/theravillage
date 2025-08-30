# 1) Artifact Registry (Docker)
resource "google_artifact_registry_repository" "docker" {
  location      = var.region
  repository_id = var.artifact_repo
  description   = "TheraVillage containers"
  format        = "DOCKER"
}

# 2) Service Account for Cloud Run API
resource "google_service_account" "api_sa" {
  account_id   = "tv-api-sa"
  display_name = "TheraVillage API SA"
}

# 3) Cloud SQL Postgres (public IP for MVP simplicity)
resource "google_sql_database_instance" "pg" {
  name             = "tv-pg"
  database_version = "POSTGRES_16"
  region           = var.region

  settings {
    tier = var.db_instance_tier

    ip_configuration {
      ipv4_enabled = true
      # Authorized networks optional; for Cloud Run we'll use the SQL connector IAM flow.
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
  # Password will be set manually or via separate process for security
  # This prevents storing passwords in Terraform state
}

# 4) Secret Manager (to store DB URL and Firebase admin key JSON)
resource "google_secret_manager_secret" "db_url" {
  secret_id = "DATABASE_URL"
  replication {
    user_managed {
      replicas {
        location = var.region
      }
    }
  }
}

# Secret created but version will be added manually for security
# You'll need to manually create the secret version with the actual password
# Example format: postgres://tv_admin:YOUR_ACTUAL_PASSWORD@IP_ADDRESS/theravillage

resource "google_secret_manager_secret" "firebase_admin_json" {
  secret_id = "FIREBASE_ADMIN_JSON"
  replication {
    user_managed {
      replicas {
        location = var.region
      }
    }
  }
}

# 5) IAM bindings so Cloud Run SA can read secrets and connect to SQL
resource "google_project_iam_member" "sa_secret_access" {
  project = var.project
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.api_sa.email}"
}

resource "google_project_iam_member" "sa_sql_client" {
  project = var.project
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.api_sa.email}"
}

# Firebase Admin role to revoke users
resource "google_project_iam_member" "sa_firebase_admin" {
  project = var.project
  role    = "roles/firebase.admin"
  member  = "serviceAccount:${google_service_account.api_sa.email}"
}

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
