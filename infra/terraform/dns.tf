locals {
  ipv4 = google_compute_instance.smallweb.network_interface[0].access_config[0].nat_ip
}

# Apex A record: tidelands.dev → VPS IPv4
resource "cloudflare_record" "apex_a" {
  zone_id = var.cloudflare_zone_id
  name    = "@"
  type    = "A"
  value   = local.ipv4
  proxied = true
}

# Wildcard A record: *.tidelands.dev → VPS IPv4
resource "cloudflare_record" "wildcard_a" {
  zone_id = var.cloudflare_zone_id
  name    = "*"
  type    = "A"
  value   = local.ipv4
  proxied = true
}

# Zone SSL/TLS mode: Full (Strict) — origin must present a valid cert (Caddy handles this)
resource "cloudflare_zone_settings_override" "tls" {
  zone_id = var.cloudflare_zone_id

  settings {
    ssl = "strict"
  }
}
