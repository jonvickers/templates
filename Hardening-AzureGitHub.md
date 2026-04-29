# Hardening Checklist (Azure App Service on Linux + GitHub Actions CI/CD)

This checklist is intended for **public documentation**. It avoids environment-specific identifiers and focuses on common best practices to harden:

- **Azure App Service (Linux)** (deployment surface, publishing endpoints, configuration, logging/monitoring)
- **GitHub Actions** (credential strategy, secret hygiene, deployment controls)

## App Service (Linux): Publishing Endpoints & Access Controls

- [ ] Disable **SCM/Kudu basic publishing** (where applicable).
- [ ] Disable **FTP basic publishing**.
- [ ] Disable **FTPS** entirely if it is not required.
- [ ] Prefer **ZIP deploy / Run-From-Package** style deployments via CI (immutable-ish artifact deployment) rather than ad-hoc changes.
- [ ] Restrict **SCM/Kudu network access** (IP allowlist / private access), based on runner strategy:
  - GitHub-hosted runners (public egress IPs are not stable)
  - Self-hosted runners (more compatible with strict network controls)

## App Service (Linux): Runtime & Configuration Hardening

- [ ] Ensure the app runs as a **non-root** user where possible (depends on stack/container choice).
- [ ] If using a custom container:
  - [ ] Use a minimal base image and pin image digests/tags.
  - [ ] Drop Linux capabilities and avoid privileged containers.
  - [ ] Run as non-root and set a read-only filesystem where feasible.
- [ ] Enforce **HTTPS-only** and disable older TLS versions where possible.
- [ ] Set required security headers at the app or gateway layer (example set):
  - `Strict-Transport-Security`
  - `X-Content-Type-Options`
  - `X-Frame-Options` (or `frame-ancestors` via CSP)
  - `Content-Security-Policy` (where feasible)
  - `Referrer-Policy`
- [ ] Review app settings for safety:
  - Prefer platform configuration over committing secrets to the repo.
  - Avoid enabling features that allow remote debugging or interactive access unless required.

## GitHub Actions: Authentication & Deployment Hardening

- [ ] Use **GitHub Actions OIDC** for Azure authentication (avoid publish profiles where possible).
- [ ] Verify Azure RBAC role assignments follow **least privilege**:
  - Scope roles narrowly (resource group / app scope; avoid subscription-wide scope).
- [ ] Add **Dependabot** updates for:
  - npm (or relevant package ecosystem)
  - GitHub Actions (`github-actions` ecosystem)
- [ ] Review workflows to ensure:
  - No publish-profile credentials are used
  - No long-lived cloud credentials are stored unnecessarily
- [ ] Review repository **secrets and variables**:
  - Remove unused credentials
  - Prefer OIDC + short-lived tokens over long-lived secrets
- [ ] Pin third-party GitHub Actions to a **commit SHA** (not just a tag) for supply-chain hardening.

## Logging, Detection, and Alerting

- [ ] Send **App Service logs** to **Log Analytics** (or your centralized logging platform).
- [ ] Enable **App Service diagnostic logs** appropriate for Linux workloads:
  - Application logs (stdout/stderr)
  - Web server logs (HTTP access logs)
  - Container logs (if using a custom container)
- [ ] Create alert queries for **compromise / abuse indicators** (examples: unusual auth activity, anomalous requests, unexpected deployment events).
- [ ] Attach alert notifications (email, Teams/Slack, pager) and verify delivery.
- [ ] Validate HTTP logging captures **real client IPs** where expected (consider proxy/CDN headers and platform configuration).
- [ ] Tune noisy/low-signal detections to prevent alert fatigue.

## Dependency & Patch Management

- [ ] Patch critical dependencies (framework/runtime/app deps) and redeploy.
- [ ] Confirm the patched deployment completed successfully via CI/CD.
- [ ] Post-deploy: review alerts/logs to confirm compromise indicators are quiet.
- [ ] Establish a routine for emergency patching and redeploying.

## GitHub Environment Protections (Recommended)

- [ ] Add a **production** GitHub Environment to the deployment workflow.
- [ ] Scope Azure OIDC federated credentials to the **GitHub Environment** (instead of broad branch/ref scopes).
- [ ] Remove legacy federated credentials that are no longer needed (e.g., branch-scoped credentials).
- [ ] Configure **required reviewers** for the production environment (if it fits your release process).

## Longer-Term Hardening Options (Not “Quick”)

- [ ] Add a WAF/CDN layer (e.g., Azure Front Door / WAF) with managed rules.
- [ ] Decide on runner strategy (GitHub-hosted vs self-hosted) to enable stricter network controls for SCM/Kudu.
- [ ] Consider private connectivity patterns (Private Endpoint / VNet integration) where appropriate for your architecture.
- [ ] Continue monitoring for reinfection / recurrence indicators over the next **24–72 hours** after hardening and patching.

## Notes / Constraints

- Some orgs/plans may limit certain repository protection features (e.g., branch protection). If branch protection is unavailable, a strong substitute is:
  - GitHub **Environment approvals** for production deployments, plus
  - Azure **OIDC credentials scoped to the Environment**, plus
  - least-privilege Azure RBAC scoping
