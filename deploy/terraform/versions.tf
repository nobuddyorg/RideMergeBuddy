terraform {
  required_version = ">= 1.5"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 3.0"
    }
  }

  # State lives in GCS instead of locally, so both your machine and CI
  # (deploy.yml) operate on the same state. Bucket/prefix are supplied at
  # `terraform init` time (-backend-config=backend.hcl locally; explicit
  # -backend-config flags in CI) - see deploy/README.md.
  backend "gcs" {}
}

provider "google" {
  project = var.project_id
  region  = var.region
  zone    = var.zone
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}
