output "deployment_slot" {
  description = "Stable blue/green deployment slot managed by this state"
  value       = var.deployment_slot
}

output "instance_name" {
  description = "Name of the provisioned GCE instance for the selected deployment slot"
  value       = google_compute_instance.smallweb.name
}

output "instance_ipv4" {
  description = "Public IPv4 address of the instance"
  value       = google_compute_instance.smallweb.network_interface[0].access_config[0].nat_ip
}

output "origin_hostname" {
  description = "Stable DNS-only hostname for the selected slot origin"
  value       = local.slot_origin_hostname
}

output "instance_zone" {
  description = "GCE zone the instance was provisioned in"
  value       = google_compute_instance.smallweb.zone
}

output "instance_self_link" {
  description = "GCE self-link for the instance (used by Terratest assertions)"
  value       = google_compute_instance.smallweb.self_link
}

output "ssh_user" {
  description = "SSH username for post-provision access"
  value       = "smallweb"
}

output "ssh_connection" {
  description = "Convenience string for Dagger bootstrap: user@host"
  value       = "smallweb@${google_compute_instance.smallweb.network_interface[0].access_config[0].nat_ip}"
}

output "manage_direct_dns_records" {
  description = "Whether this state owns apex and wildcard A records directly"
  value       = var.manage_direct_dns_records
}
