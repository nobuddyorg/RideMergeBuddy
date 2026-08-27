# Always-Free footprint:
#   - 1x e2-micro instance in us-west1 / us-central1 / us-east1
#   - <=30GB pd-standard boot disk
#   - 1x static external IP (free while attached to a running instance)
# Nothing here provisions a load balancer, Cloud NAT, or any billed extras.

resource "google_compute_address" "static_ip" {
  name   = "${var.name}-ip"
  region = var.region
}

resource "google_compute_firewall" "allow_web" {
  name    = "${var.name}-allow-web"
  network = "default"

  allow {
    protocol = "tcp"
    ports    = ["80", "8080"]
  }

  source_ranges = ["0.0.0.0/0"]
  target_tags   = [var.name]
}

resource "google_compute_firewall" "allow_ssh" {
  name    = "${var.name}-allow-ssh"
  network = "default"

  allow {
    protocol = "tcp"
    ports    = ["22"]
  }

  source_ranges = var.ssh_source_ranges
  target_tags   = [var.name]
}

resource "google_compute_instance" "app" {
  name         = var.name
  machine_type = "e2-micro"
  zone         = var.zone
  tags         = [var.name]

  boot_disk {
    initialize_params {
      image = "debian-cloud/debian-12"
      size  = 30
      type  = "pd-standard"
    }
  }

  network_interface {
    network = "default"
    access_config {
      nat_ip = google_compute_address.static_ip.address
    }
  }

  metadata = {
    ssh-keys = "${var.ssh_user}:${file(var.ssh_public_key_path)}"
  }

  labels = {
    app = var.name
  }
}
