# Hosting: GitHub Pages (frontend) + GCP free tier (backend)

Two independently-deployed pieces on two origins:

- **Frontend** (Angular) → GitHub Pages, built and published by
  `.github/workflows/pages.yml`.
- **Backend** (Spring Boot API) → a single `e2-micro` Compute Engine VM
  (GCP Always Free tier, no time limit), with a static external IP, fronted
  by Caddy for automatic HTTPS. No Docker, no load balancer, no billed
  extras.

They talk to each other cross-origin: the backend already sends permissive
CORS headers for all paths (`DevCorsConfiguration.groovy`), and the frontend
points at the backend's domain via `environment.apiUrl` — no same-origin
bundling trick needed.

## One-time setup

1. Install `terraform`, `ansible`, and the `gcloud` CLI locally; run
   `gcloud auth application-default login` against your GCP project.
2. `cp deploy/terraform/terraform.tfvars.example deploy/terraform/terraform.tfvars`
   and fill in your `project_id`, `ssh_user`, and `ssh_public_key_path`.
   Consider narrowing `ssh_source_ranges` to your own IP.
3. Create `src/main/resources/.secrets` per the main README (Strava client
   id/secret + Google static-maps API key). This file is git-ignored and
   gets baked into the jar at build time — it's never handled by Ansible.
4. In the repo's Settings → Pages, set Source to "GitHub Actions" (one-time,
   can't be scripted here).

## Provision the backend VM

```
cd deploy/terraform
terraform init
terraform apply
```

Note the `external_ip` output.

## Point your backend domain at it

Create an A record for your backend's domain (e.g. `api.example.com`)
pointing at `external_ip`. Wait for it to propagate before deploying
(Caddy needs it reachable to issue a cert).

## Deploy the backend

```
./deploy/build.sh
cd deploy/ansible
cp inventory.ini.example inventory.ini
# edit inventory.ini: ansible_host = the external_ip from terraform,
#                      ansible_user = the ssh_user from terraform.tfvars
```

Edit `domain_name` in `playbook.yml` to your real backend domain, then:

```
ansible-playbook -i inventory.ini playbook.yml
```

This installs Java, installs Caddy, ships the jar, and starts both as
systemd services (`activitymerger`, `caddy`), enabled on boot. Re-running
after a code change (`./deploy/build.sh` + this command again) is safe —
idempotent, just re-copies the jar and restarts the service if it changed.

## Deploy the frontend

Push to `master` (or run `.github/workflows/pages.yml` manually) — see
below for the repo variables it needs. It publishes to
`https://<owner>.github.io/<repo>/` by default, or your own domain if you
set `PAGES_CUSTOM_DOMAIN`.

## After both are deployed

- In your Strava API app settings, set the Authorized Callback Domain to
  wherever the frontend is served from (GitHub Pages domain, or your
  custom domain).
- In Google Cloud Console, restrict the static-maps API key to that same
  domain.

## Redeploying automatically (GitHub Actions)

Two independent workflows, each path-filtered so a frontend-only or
backend-only change doesn't trigger the other:

**`.github/workflows/deploy.yml`** (backend) — builds the jar and runs the
Ansible playbook on every push to `master` touching backend paths, or
manually via "Run workflow". It does **not** run `terraform apply` — infra
changes stay a manual step you run locally, so the VM/firewall/IP never
change without you deliberately doing it. Targets the GitHub Environment
named `production` (auto-created on first run; add required reviewers there
later for a manual gate). Repository secrets it needs:

| Secret               | Value                                                        |
|----------------------|---------------------------------------------------------------|
| `APP_SECRETS_JSON`   | Contents of `src/main/resources/.secrets` (the Strava/Google JSON) |
| `GCP_SSH_PRIVATE_KEY`| Private key matching `ssh_public_key_path` in `terraform.tfvars` |
| `GCP_HOST`           | The `external_ip` from `terraform apply`                    |
| `GCP_SSH_USER`       | The `ssh_user` from `terraform.tfvars`                       |
| `APP_DOMAIN`         | Your real backend domain (same as `domain_name` in `playbook.yml`) |

**`.github/workflows/pages.yml`** (frontend) — builds the Angular app and
publishes it to GitHub Pages on every push to `master` touching `web-app/`,
or manually. Repository *variables* (not secrets — these aren't sensitive)
it needs, under Settings → Secrets and variables → Actions → Variables:

| Variable              | Value                                                                 |
|-----------------------|------------------------------------------------------------------------|
| `API_BASE_URL`        | Bare backend domain, e.g. `api.example.com` (same as `APP_DOMAIN` above) |
| `PAGES_CUSTOM_DOMAIN` | Optional — only if serving Pages from your own domain instead of `<owner>.github.io/<repo>/` |

After provisioning the VM once via Terraform, enabling Pages once in repo
settings, and adding the secrets/variables above, pushes to `master` deploy
both halves automatically (whichever half actually changed).
