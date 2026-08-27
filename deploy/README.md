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
  billed extras beyond the VM itself.

They talk to each other cross-origin: the backend already sends permissive
CORS headers for all paths (`DevCorsConfiguration.groovy`), and the frontend
points at the backend's domain via `environment.apiUrl`.

## One-time GCP setup (before the first CI run)

CI provisions and updates the VM itself, but a few things only make sense
as a deliberate one-time step you do by hand:

1. **A GCS bucket for Terraform state** (so your machine and CI share the
   same state instead of each starting from scratch):
   ```
   gsutil mb -l us-central1 gs://YOUR_PROJECT_ID-tfstate
   gsutil versioning set on gs://YOUR_PROJECT_ID-tfstate
   ```
2. **A service account for CI**, scoped to what Terraform needs to manage:
   ```
   gcloud iam service-accounts create activitymerger-ci \
     --display-name "activitymerger CI"
   gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
     --member "serviceAccount:activitymerger-ci@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
     --role roles/compute.admin
   gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
     --member "serviceAccount:activitymerger-ci@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
     --role roles/storage.admin
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
4. Create `src/main/resources/.secrets` locally per the main README (Strava
   client id/secret + Google static-maps API key) — you'll paste its
   contents into a secret below, then it never needs to exist as a file
   outside CI/your machine again.
5. In the repo's Settings → Pages, set Source to "GitHub Actions"
   (one-time, can't be scripted here).

## GitHub configuration

Under Settings → Secrets and variables → Actions:

**Secrets** (sensitive):

| Secret                | Value                                                    |
|------------------------|-----------------------------------------------------------|
| `GCP_SA_KEY`           | Contents of `ci-key.json` from step 2 above              |
| `GCP_SSH_PRIVATE_KEY`  | Contents of `ci_deploy_key` from step 3 above            |
| `APP_SECRETS_JSON`     | Contents of `src/main/resources/.secrets` from step 4    |

**Variables** (not sensitive):

| Variable          | Value                                                        |
|-------------------|-----------------------------------------------------------------|
| `TF_STATE_BUCKET`  | The GCS bucket name from step 1, e.g. `your-project-id-tfstate` |
| `GCP_PROJECT_ID`   | Your GCP project ID                                          |
| `GCP_SSH_USER`     | Username to create on the VM, e.g. `deploy`                  |
| `APP_DOMAIN`       | Your backend's domain, e.g. `api.example.com`                |
| `API_BASE_URL`     | Same bare domain as `APP_DOMAIN` — this is what the frontend build points at |
| `PAGES_CUSTOM_DOMAIN` | Leave unset for this repo — Pages already publishes to `nobuddy.org/RideMergeBuddy` via the org's existing custom domain |

Point `APP_DOMAIN`'s DNS (an A record) at the VM's IP once Terraform has
created it — the first `deploy.yml` run creates the VM and prints its IP in
the "Read VM IP" step's output; after that, the IP is stable (Terraform
reserves a static address) and Caddy issues its own cert automatically once
the domain resolves to it.

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
./deploy/build.sh   # needs src/main/resources/.secrets present first
cd deploy/ansible
cp inventory.ini.example inventory.ini   # fill in ansible_host (terraform's external_ip output), ansible_user
# edit domain_name in playbook.yml
ansible-playbook -i inventory.ini playbook.yml
```

Local and CI runs share the same Terraform state (same GCS bucket), so
either can safely be used interchangeably.

## After both are deployed

- In your Strava API app settings, set the Authorized Callback Domain to
  `nobuddy.org` (where the frontend is served from).
- In Google Cloud Console, restrict the static-maps API key to that same
  domain.
