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
  description = "Base name of the compute instance. The deployment slot is appended for slot-aware deploys."
  type        = string
  default     = "tidelane-smallweb"
}

variable "deployment_slot" {
  description = "Stable deployment slot name. Use distinct backend prefixes per slot so blue and green can coexist."
  type        = string
  default     = "blue"

  validation {
    condition     = contains(["blue", "green"], var.deployment_slot)
    error_message = "deployment_slot must be either \"blue\" or \"green\"."
  }
}

variable "machine_type" {
  description = "GCE machine type"
  type        = string
  default     = "e2-medium"
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

variable "manage_direct_dns_records" {
  description = "Whether this state should own the apex and wildcard A records directly. Disable when provisioning independent blue/green origins behind a load balancer."
  type        = bool
  default     = true
}

variable "manage_slot_origin_dns_record" {
  description = "Whether this state should own the DNS-only per-slot origin record."
  type        = bool
  default     = true
}
