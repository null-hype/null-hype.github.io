data "google_compute_image" "debian" {
  family  = "debian-12"
  project = "debian-cloud"
}

data "google_compute_default_service_account" "default" {
  project = var.gcp_project_id
}

locals {
  slot_instance_name = "${var.instance_name}-${var.deployment_slot}"
  slot_network_tag   = "smallweb-origin-${var.deployment_slot}"
}

resource "google_compute_instance" "smallweb" {
  name         = local.slot_instance_name
  machine_type = var.machine_type
  zone         = var.gcp_zone

  # Required for machine type changes without recreating the instance.
  allow_stopping_for_update = true

  boot_disk {
    initialize_params {
      image = data.google_compute_image.debian.self_link
      size  = 20
      type  = "pd-ssd"
    }
  }

  network_interface {
    network = "default"
    access_config {
      # Ephemeral public IP. Assigned address is exposed via outputs.
      # DNS records in dns.tf reference this directly, so re-apply after
      # instance recreation updates DNS automatically.
    }
  }

  metadata = {
    # Only the key provisioned here can SSH as the smallweb user.
    ssh-keys               = "smallweb:${var.ssh_public_key}"
    block-project-ssh-keys = "true"
  }

  # Minimal scope — this instance serves HTTP only, no GCP API calls needed.
  service_account {
    email  = data.google_compute_default_service_account.default.email
    scopes = ["https://www.googleapis.com/auth/logging.write"]
  }

  tags = [local.slot_network_tag]

  labels = {
    managed-by = "terraform"
    env        = var.env
    slot       = var.deployment_slot
  }
}

# Web traffic: 80 and 443 open to all.
# Cloudflare proxies inbound requests, so the origin sees Cloudflare IPs.
# Full (Strict) TLS (dns.tf) ensures the Cloudflare→origin leg is authenticated.
resource "google_compute_firewall" "smallweb_web" {
  name    = "${local.slot_instance_name}-web"
  network = "default"

  allow {
    protocol = "tcp"
    ports    = ["80", "443"]
  }

  source_ranges = ["0.0.0.0/0"]
  target_tags   = [local.slot_network_tag]
}

# SSH: restricted to the caller-supplied source range.
# Default is open (0.0.0.0/0) for initial bootstrap.
# Tighten var.ssh_source_ranges to the Dagger runner's egress IP for production.
resource "google_compute_firewall" "smallweb_ssh" {
  name    = "${local.slot_instance_name}-ssh"
  network = "default"

  allow {
    protocol = "tcp"
    ports    = ["22"]
  }

  source_ranges = var.ssh_source_ranges
  target_tags   = [local.slot_network_tag]
}
