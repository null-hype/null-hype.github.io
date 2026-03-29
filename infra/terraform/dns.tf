locals {
  ipv4                 = google_compute_instance.smallweb.network_interface[0].access_config[0].nat_ip
  slot_origin_hostname = "${var.deployment_slot}-origin.${var.domain}"
}

# Apex A record: tidelands.dev → instance IPv4
# TTL is set to 1 (automatic) because proxied records require it.
# Disable this in blue/green slot states so the load-balancer layer can own
# live traffic while each slot still provisions its own origin.
resource "cloudflare_record" "apex_a" {
  count   = var.manage_direct_dns_records ? 1 : 0
  zone_id = var.cloudflare_zone_id
  name    = "@"
  type    = "A"
  content = local.ipv4
  proxied = true
  ttl     = 1
}

# Wildcard A record: *.tidelands.dev → instance IPv4
# Covers all smallweb app subdomains without per-app DNS entries.
# Disable this in blue/green slot states so direct records do not fight.
resource "cloudflare_record" "wildcard_a" {
  count   = var.manage_direct_dns_records ? 1 : 0
  zone_id = var.cloudflare_zone_id
  name    = "*"
  type    = "A"
  content = local.ipv4
  proxied = true
  ttl     = 1
}

# Stable per-slot origin hostname for a future shared traffic layer.
# Keep this DNS-only so a Cloudflare load balancer can target the origin
# directly without creating a proxy loop.
resource "cloudflare_record" "slot_origin_a" {
  zone_id = var.cloudflare_zone_id
  name    = "${var.deployment_slot}-origin"
  type    = "A"
  content = local.ipv4
  proxied = false
  ttl     = 60
}

# Note: AAAA records are omitted — GCE instances do not receive IPv6 addresses
# by default. Enable dual-stack on the VPC subnet and add an output for the
# IPv6 address if AAAA records are required later.

# Zone-level TLS and redirect settings.
# Full (Strict): Cloudflare validates the origin certificate on every request.
# Caddy (installed by the bootstrap step) handles origin TLS automatically.
resource "cloudflare_zone_settings_override" "tls" {
  count   = var.manage_zone_settings ? 1 : 0
  zone_id = var.cloudflare_zone_id

  settings {
    ssl              = "strict"
    always_use_https = "on"
    min_tls_version  = "1.2"
  }
}
