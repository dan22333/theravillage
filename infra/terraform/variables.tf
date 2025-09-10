variable "project" {
  type = string
}

variable "region" {
  type    = string
  default = "us-central1"
}

variable "artifact_repo" {
  type    = string
  default = "tv"
}

# Cloud SQL
variable "db_instance_tier" {
  type    = string
  default = "db-custom-1-3840"
}

variable "db_name" {
  type    = string
  default = "theravillage"
}

variable "db_user" {
  type    = string
  default = "tv_admin"
}

# CORS Configuration
variable "cors_allowed_origins" {
  type        = string
  description = "Comma-separated list of allowed CORS origins for the API"
  default     = "https://theravillage-edb89.web.app,https://theravillage-edb89.firebaseapp.com"
}

# Frontend URL for invite links
variable "frontend_url" {
  type        = string
  description = "Production frontend URL for generating invite links"
  default     = "https://theravillage-edb89.web.app"
}

# API URL for frontend configuration
variable "api_url" {
  type        = string
  description = "Production API URL for frontend"
  default     = "https://tv-api-326430627435.us-central1.run.app"
}

# Database password will be set manually after infrastructure creation
# This prevents storing passwords in Terraform state or variables
