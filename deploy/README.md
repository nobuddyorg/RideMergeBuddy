# Hosting: GitHub Pages (frontend) + GCP free tier (backend)

Two independently-deployed pieces on two origins, both driven by GitHub
Actions once set up:

- **Frontend** (Angular) → GitHub Pages, built and published by
  `.github/workflows/pages.yml`. Lives at `https://nobuddy.org/RideMergeBuddy`
  — `nobuddy.org` is already the org's Pages custom domain, so this repo
  just needs to publish as a normal project page (no CNAME of its own) to
  show up at that path.
- **Backend** (Spring Boot API) → a single `e2-micro` Compute Engine VM
  (GCP Always Free tier, no time limit), provisioned by Terraform and
  configured by Ansible, both run from `.github/workflows/deploy.yml`.
  Fronted by Caddy for automatic HTTPS. No Docker, no load balancer, no
  billed extras beyond the VM itself. Terraform also creates the DNS
  record (Cloudflare, since that's where `nobuddy.org`'s zone lives) and
  the Maps Static API key itself, restricted to the frontend's domain.

They talk to each other cross-origin: the backend already sends permissive
CORS headers for all paths (`DevCorsConfiguration.groovy`), and the frontend
points at the backend's domain via `environment.apiUrl`. Nothing about
either deploy needs a manual DNS or Console step once the secrets below are
in place - `deploy.yml` provisions everything from an empty project on its
own.

## One-time GCP setup (before the first CI run)

CI provisions and updates the VM itself, but a few things only make sense
as a deliberate one-time step you do by hand:

1. **A GCS bucket for Terraform state** (so your machine and CI share the
   same state instead of each starting from scratch):
   ```
   gsutil mb -l us-central1 gs://YOUR_PROJECT_ID-tfstate
   gsutil versioning set on gs://YOUR_PROJECT_ID-tfstate
   ```
2. **A service account for CI**, scoped to what Terraform needs to manage.
   On a brand-new GCP project, Compute Engine API and the Maps Static API
   aren't enabled yet, and Terraform itself needs to enable them - so this
   also needs Service Usage Admin (to enable APIs) and API Keys Admin (to
   create/restrict the Maps key), not just Compute/Storage Admin:
   ```
   gcloud iam service-accounts create activitymerger-ci \
     --display-name "activitymerger CI"
   for role in roles/compute.admin roles/storage.admin \
               roles/serviceusage.serviceUsageAdmin roles/serviceusage.apiKeysAdmin; do
     gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
       --member "serviceAccount:activitymerger-ci@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
       --role "$role"
   done
   gcloud iam service-accounts keys create ci-key.json \
     --iam-account activitymerger-ci@YOUR_PROJECT_ID.iam.gserviceaccount.com
   ```
   The contents of `ci-key.json` become the `GCP_SA_KEY` secret below —
   delete the local file after adding it. (`roles/storage.admin` is scoped
   to your whole project here for simplicity; narrow it to just the tfstate
   bucket if you want to tighten it later.)
3. **An SSH keypair** for CI to both provision the VM with and connect to
   it afterward:
   ```
   ssh-keygen -t ed25519 -f ./ci_deploy_key -N ""
   ```
   The private key becomes `GCP_SSH_PRIVATE_KEY` below; CI derives the
   matching public key itself at runtime. Delete both local files after.
4. Write down your Strava client id/secret as JSON:
   `{"client_id": "...", "client_secret": "..."}` — that becomes the
   `APP_SECRETS_JSON` secret below. (No `google_api_key` field needed here:
   `deploy.yml` merges in the Maps Static API key Terraform just created,
   automatically, on every run.)
5. **A Cloudflare API token**, scoped to `Zone:DNS:Edit` + `Zone:Zone:Read`
   on just the `nobuddy.org` zone (dash.cloudflare.com → My Profile → API
   Tokens → Create Token → "Edit zone DNS" template, then restrict Zone
   Resources to that one zone).
6. In the repo's Settings → Pages, set Source to "GitHub Actions"
   (one-time, can't be scripted here).

## GitHub configuration

Under Settings → Secrets and variables → Actions:

**Secrets** (sensitive):

| Secret                 | Value                                                              |
|------------------------|---------------------------------------------------------------------|
| `GCP_SA_KEY`           | Contents of `ci-key.json` from step 2 above                        |
| `GCP_SSH_PRIVATE_KEY`  | Contents of `ci_deploy_key` from step 3 above                      |
| `APP_SECRETS_JSON`     | `{"client_id": "...", "client_secret": "..."}` from step 4 above   |
| `CLOUDFLARE_API_TOKEN` | The token from step 5 above                                        |

**Variables** (not sensitive):

| Variable          | Value                                                        |
|-------------------|-----------------------------------------------------------------|
| `TF_STATE_BUCKET`  | The GCS bucket name from step 1, e.g. `your-project-id-tfstate` |
| `GCP_PROJECT_ID`   | Your GCP project ID                                          |
| `GCP_SSH_USER`     | Username to create on the VM, e.g. `deploy`                  |
| `API_BASE_URL`     | `activitymerger-api.nobuddy.org` — must match `backend_subdomain` + `dns_zone_name` in `deploy/terraform/variables.tf` (that's where the domain is actually decided; change both together if you want a different one) |
| `PAGES_CUSTOM_DOMAIN` | Leave unset for this repo — Pages already publishes to `nobuddy.org/RideMergeBuddy` via the org's existing custom domain |

No DNS step needed — Terraform creates the A record (Cloudflare) itself as
part of `terraform apply`, pointed at the static IP it just reserved, and
Caddy issues its own cert automatically once that resolves.

## Deploying

Once the above is in place:

- Push to `master` touching `src/**`, `build.gradle`, or `deploy/**` →
  `deploy.yml` runs `terraform apply` (updates the VM/firewall if you
  changed them, no-ops otherwise), builds the jar, and runs the Ansible
  playbook.
- Push to `master` touching `web-app/**` → `pages.yml` builds and publishes
  the frontend.
- Either can also be run manually from the Actions tab ("Run workflow").

`deploy.yml` targets the GitHub Environment named `production`
(auto-created on first run) — add required reviewers there if you want a
manual approval gate before Terraform/Ansible actually run, since this
workflow applies infrastructure changes unattended otherwise.

## Running it locally instead

If you'd rather provision/deploy from your own machine:

```
cd deploy/terraform
cp backend.hcl.example backend.hcl        # fill in your bucket name
cp terraform.tfvars.example terraform.tfvars  # fill in project_id, ssh_user, ssh_public_key_path
terraform init -backend-config=backend.hcl
terraform apply
```

```
# .secrets needs client_id/client_secret plus the Maps key Terraform just
# made - CI merges these automatically (see deploy.yml); doing it by hand:
jq -n --argjson strava "$(cat your-strava-creds.json)" \
      --arg maps "$(cd deploy/terraform && terraform output -raw maps_static_api_key)" \
      '$strava + {google_api_key: $maps}' > src/main/resources/.secrets

./deploy/build.sh
cd deploy/ansible
cp inventory.ini.example inventory.ini   # fill in ansible_host (terraform's external_ip output), ansible_user
ansible-playbook -i inventory.ini playbook.yml -e "domain_name=$(cd ../terraform && terraform output -raw backend_domain)"
```

Local and CI runs share the same Terraform state (same GCS bucket), so
either can safely be used interchangeably.

## After both are deployed

In your Strava API app settings, set the Authorized Callback Domain to
`nobuddy.org` (where the frontend is served from). The Maps Static API key
is already restricted correctly - Terraform creates it scoped to the Maps
Static API and to HTTP referrers on `frontend_domain`, no manual Console
step needed.
