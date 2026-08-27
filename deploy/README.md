# Hosting on GCP (free tier)

Provisions one `e2-micro` Compute Engine VM (Always Free tier, no time limit)
in `us-central1`, with a static external IP, and configures it with Caddy
(automatic HTTPS, no manual certs) reverse-proxying to the Spring Boot app.
No Docker, no load balancer, no billed extras.

The Angular frontend hardcodes its backend URL as `<hostname>:8080`
(`web-app/src/app/services/backend/backend.service.ts`), so rather than
changing app code, the whole app (frontend static files + API) is bundled
into one jar and Caddy terminates HTTPS on the public `:8080` the frontend
already expects, proxying internally to Spring Boot on `:8081`.

## One-time setup

1. Install `terraform`, `ansible`, and the `gcloud` CLI locally; run
   `gcloud auth application-default login` against your GCP project.
2. `cp deploy/terraform/terraform.tfvars.example deploy/terraform/terraform.tfvars`
   and fill in your `project_id`, `ssh_user`, and `ssh_public_key_path`.
   Consider narrowing `ssh_source_ranges` to your own IP.
3. Create `src/main/resources/.secrets` per the main README (Strava client
   id/secret + Google static-maps API key). This file is git-ignored and
   gets baked into the jar at build time — it's never handled by Ansible.

## Provision the VM

```
cd deploy/terraform
terraform init
terraform apply
```

Note the `external_ip` output.

## Point your domain at it

Create an A record for your domain pointing at `external_ip`. Wait for it
to propagate before the next step (Caddy needs it to issue a cert).

## Build the deployable jar

```
./deploy/build.sh
```

Produces `build/libs/activitymerger-0.1.jar` with the Angular production
build and your secrets baked in.

## Configure and deploy with Ansible

```
cd deploy/ansible
cp inventory.ini.example inventory.ini
# edit inventory.ini: ansible_host = the external_ip from terraform,
#                      ansible_user = the ssh_user from terraform.tfvars
```

Edit `domain_name` in `playbook.yml` to your real domain, then:

```
ansible-playbook -i inventory.ini playbook.yml
```

This installs Java, installs Caddy, ships the jar, and starts both as
systemd services (`activitymerger`, `caddy`), enabled on boot.

## After deploying

- Visit `https://yourdomain.com:8080` — Caddy issues the cert automatically
  on first request (needs port 80 reachable for the ACME challenge, which
  Terraform already opened).
- In your Strava API app settings, set the Authorized Callback Domain to
  your real domain.
- In Google Cloud Console, restrict the static-maps API key to your domain.

## Redeploying after a code change

```
./deploy/build.sh
cd deploy/ansible && ansible-playbook -i inventory.ini playbook.yml
```

The playbook is idempotent — it just re-copies the jar and restarts the
service if it changed.
