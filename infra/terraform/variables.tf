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
  description = "Cloudflare API token. DNS write is required; zone settings write is only needed when manage_zone_settings is enabled."
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
  sensitive   = true
}

variable "ssh_source_ranges" {
  description = "CIDR ranges allowed to reach port 22. Default is open; tighten to your Dagger runner's egress IP."
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "env" {
  description = "Environment label applied to GCE resources (e.g. prod, test)"
  type        = string
  default     = "prod"
}

variable "manage_zone_settings" {
  description = "Whether Terraform should manage Cloudflare zone-wide TLS/HTTPS settings."
  type        = bool
  default     = false
}
