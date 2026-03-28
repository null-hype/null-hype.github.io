output "instance_name" {
  description = "Name of the provisioned GCE instance"
  value       = google_compute_instance.smallweb.name
}

output "instance_ipv4" {
  description = "Public IPv4 address of the instance"
  value       = google_compute_instance.smallweb.network_interface[0].access_config[0].nat_ip
}

output "instance_zone" {
  description = "GCE zone the instance was provisioned in"
  value       = google_compute_instance.smallweb.zone
}

output "ssh_user" {
  description = "SSH username for post-provision access"
  value       = "smallweb"
}
