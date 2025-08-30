terraform {
  backend "gcs" {
    bucket = "tv-tfstate-theravillage-edb89"
    prefix = "terraform/state"
  }
}
