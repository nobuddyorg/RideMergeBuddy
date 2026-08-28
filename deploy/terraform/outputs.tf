output "external_ip" {
  description = "Static IP to point your domain's A record at"
  value       = google_compute_address.static_ip.address
}

output "instance_name" {
  value = google_compute_instance.app.name
}

output "ssh_command" {
  value = "ssh ${var.ssh_user}@${google_compute_address.static_ip.address}"
}

output "backend_domain" {
  description = "DNS name Cloudflare now points at the VM - feed this to Ansible as domain_name"
  value       = local.backend_domain
}

output "maps_static_api_key" {
  description = "Value to put in .secrets as google_api_key"
  value       = google_apikeys_key.maps_static.key_string
  sensitive   = true
}
