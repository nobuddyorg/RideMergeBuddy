variable "project_id" {
  description = "GCP project ID to deploy into"
  type        = string
}

variable "region" {
  description = "Always-Free eligible region: us-west1, us-central1, or us-east1"
  type        = string
  default     = "us-central1"

  validation {
    condition     = contains(["us-west1", "us-central1", "us-east1"], var.region)
    error_message = "Compute Engine's Always Free e2-micro tier only applies in us-west1, us-central1, or us-east1."
  }
}

variable "zone" {
  description = "Zone within the region"
  type        = string
  default     = "us-central1-a"
}

variable "name" {
  description = "Base name used for all created resources"
  type        = string
  default     = "activitymerger"
}

variable "ssh_user" {
  description = "Username to create for SSH access (also used by Ansible)"
  type        = string
}

variable "ssh_public_key_path" {
  description = "Path to your local SSH public key file (e.g. ~/.ssh/id_ed25519.pub)"
  type        = string
}

variable "ssh_source_ranges" {
  description = "CIDR ranges allowed to reach port 22. Narrow this to your own IP/32 if possible."
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "cloudflare_api_token" {
  description = "Cloudflare API token, scoped to Zone:DNS:Edit on dns_zone_name"
  type        = string
  sensitive   = true
}

variable "dns_zone_name" {
  description = "Cloudflare zone (root domain) the backend record is created in"
  type        = string
  default     = "nobuddy.org"
}

variable "backend_subdomain" {
  description = "Subdomain the backend API is served on, e.g. \"api\" -> api.nobuddy.org"
  type        = string
  default     = "api"
}

variable "frontend_domain" {
  description = "Domain the frontend is served from - the Maps Static API key is restricted to it"
  type        = string
  default     = "nobuddy.org"
}
