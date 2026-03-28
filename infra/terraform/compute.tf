data "google_compute_image" "debian" {
  family  = "debian-12"
  project = "debian-cloud"
}

resource "google_compute_instance" "smallweb" {
  name         = var.instance_name
  machine_type = var.machine_type
  zone         = var.gcp_zone

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
      # Ephemeral public IP. Terraform outputs the assigned address.
    }
  }

  metadata = {
    ssh-keys = "smallweb:${var.ssh_public_key}"
  }

  tags = ["smallweb-origin"]
}

resource "google_compute_firewall" "smallweb_ingress" {
  name    = "${var.instance_name}-ingress"
  network = "default"

  allow {
    protocol = "tcp"
    ports    = ["22", "80", "443"]
  }

  source_ranges = ["0.0.0.0/0", "::/0"]
  target_tags   = ["smallweb-origin"]
}
