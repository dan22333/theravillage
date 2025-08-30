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
  default = "db-perf-optimized-N-2"
}

variable "db_name" {
  type    = string
  default = "theravillage"
}

variable "db_user" {
  type    = string
  default = "tv_admin"
}

# Database password will be set manually after infrastructure creation
# This prevents storing passwords in Terraform state or variables
