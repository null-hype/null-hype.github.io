variable "gcp_project_id" {
  description = "Google Cloud project ID"
  type        = string
}

variable "gcp_region" {
  description = "Google Cloud region for the compute instance"
  type        = string
  default     = "us-central1"
}

variable "gcp_zone" {
  description = "Google Cloud zone for the compute instance"
  type        = string
  default     = "us-central1-a"
}

variable "instance_name" {
  description = "Name of the compute instance. Override for test runs (e.g. tidelane-test-<hex>)."
  type        = string
  default     = "tidelane-smallweb"
}

variable "machine_type" {
  description = "GCE machine type"
  type        = string
  default     = "e2-small"
}

variable "cloudflare_api_token" {
  description = "Cloudflare API token with DNS and zone settings permissions"
  type        = string
  sensitive   = true
}

variable "cloudflare_zone_id" {
  description = "Cloudflare zone ID for tidelands.dev"
  type        = string
}

variable "domain" {
  description = "Root domain managed by this deployment"
  type        = string
  default     = "tidelands.dev"
}

variable "ssh_public_key" {
  description = "SSH public key to inject into the instance for post-provision access"
  type        = string
}
