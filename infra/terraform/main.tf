terraform {
  required_version = ">= 1.7"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
  }

  backend "gcs" {
    # bucket and prefix are passed via -backend-config at init time.
    # Example:
    #   terraform init \
    #     -backend-config="bucket=my-tf-state-bucket" \
    #     -backend-config="prefix=tidelands-dev/terraform.tfstate"
    #
    # The bucket must exist before first init (not managed by Terraform).
  }
}

provider "google" {
  project = var.gcp_project_id
  region  = var.gcp_region
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}
