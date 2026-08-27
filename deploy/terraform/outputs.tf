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
