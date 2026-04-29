# Hardening Checklist (Azure App Service on Linux + GitHub Actions CI/CD)

This checklist is intended for **public documentation**. It avoids environment-specific identifiers and focuses on common best practices to harden:

- **Azure App Service (Linux)** (deployment surface, publishing endpoints, configuration, logging/monitoring)
- **GitHub Actions** (credential strategy, secret hygiene, deployment controls)

It is written for two related use cases:
- **Preventive hardening** to reduce the likelihood and impact of compromise
- **Post-incident recovery hardening** after suspicious activity or a confirmed attack

Because of that, some items focus on controls that should already be in place **before** an incident, while others focus on cleanup, verification, and monitoring **after** remediation.

## App Service (Linux): Publishing Endpoints & Access Controls

- [ ] Disable **basic-auth-based publishing methods** (SCM/Kudu and FTP/FTPS) where supported and not required.
- [ ] Prefer **CI/CD-driven package-based deployments** over ad-hoc changes (for example, ZIP deploy or Run-From-Package where supported).
- [ ] Restrict **SCM/Kudu network access** using access restrictions, IP allowlists, or private connectivity where feasible.
- [ ] Align runner strategy with network controls:
  - GitHub-hosted runners are often difficult to combine with strict static-IP allowlisting requirements.
  - Self-hosted runners are typically more compatible with restrictive SCM/Kudu access policies.

## App Service (Linux): Runtime & Configuration Hardening

- [ ] For custom containers, ensure the app runs as a **non-root** user where feasible.
- [ ] If using a custom container:
  - [ ] Use a minimal base image and pin image digests/tags.
  - [ ] Drop unnecessary Linux capabilities and avoid privileged containers.
  - [ ] Minimize writable paths and use a read-only filesystem only where compatible with the application/runtime.
- [ ] Enforce **HTTPS-only** and require modern TLS versions supported by the platform.
- [ ] Set required security headers at the application layer or an upstream gateway/proxy (example set):
  - `Strict-Transport-Security`
  - `X-Content-Type-Options`
  - `X-Frame-Options` (or `frame-ancestors` via CSP)
  - `Content-Security-Policy` (where feasible)
  - `Referrer-Policy`
- [ ] Review app settings for safety:
  - Prefer platform configuration over committing secrets to the repo.
  - Avoid enabling features that allow remote debugging or interactive access unless required.

## GitHub Actions: Authentication & Deployment Hardening

- [ ] Use **GitHub Actions OIDC** for Azure authentication and avoid publish profiles except for documented exceptions.
- [ ] Verify Azure RBAC role assignments follow **least privilege**:
  - Scope roles narrowly (resource group / app scope; avoid subscription-wide scope).
- [ ] Add **Dependabot** updates for:
  - npm (or relevant package ecosystem)
  - GitHub Actions (`github-actions` ecosystem)
- [ ] Review workflows to ensure:
  - Publish-profile credentials are not used unless there is a documented exception.
  - No long-lived cloud credentials are stored unnecessarily.
- [ ] Review repository **secrets and variables**:
  - Remove unused credentials.
  - Prefer OIDC + short-lived tokens over long-lived secrets.
- [ ] Pin third-party GitHub Actions to a **commit SHA** (not just a tag) for supply-chain hardening.

## Logging, Detection, and Alerting

- [ ] Send **App Service logs** to **Log Analytics** (or your centralized logging platform).
- [ ] Enable **App Service diagnostic logs** appropriate for Linux workloads:
  - Application logs (stdout/stderr)
  - Web server logs (HTTP access logs)
  - Container logs (if using a custom container)
- [ ] Create alert queries for **compromise / abuse indicators** such as unusual authentication activity, anomalous request patterns, unexpected deployment events, or suspicious access to sensitive paths.
- [ ] Attach alert notifications (email, Teams/Slack, pager) and verify delivery.
- [ ] Validate HTTP logging captures **real client IPs** where expected.
  - If the app is behind a proxy/CDN, ensure the application or logging pipeline only trusts forwarded client-IP headers from known upstream infrastructure.
- [ ] Tune noisy or low-signal detections to reduce alert fatigue.
- [ ] Confirm logging and alerting are configured **before** an incident so suspicious behavior can be detected early.

## Dependency & Patch Management

- [ ] Patch critical dependencies (framework/runtime/app deps) and redeploy.
- [ ] Confirm the patched deployment completed successfully via CI/CD.
- [ ] Post-deploy: review alerts/logs to confirm suspicious activity indicators are quiet.
- [ ] Establish a routine for emergency patching and redeploying.

## GitHub Environment Protections (Recommended)

- [ ] Add a **production** GitHub Environment to the deployment workflow.
- [ ] Scope Azure OIDC federated credentials to the **GitHub Environment** (instead of broad branch/ref scopes).
- [ ] Remove legacy federated credentials that are no longer needed (for example, branch-scoped credentials).
- [ ] Configure **required reviewers** for the production environment if it fits your release process.

## Longer-Term Hardening Options (Not “Quick”)

- [ ] Add a WAF/CDN layer (for example, Azure Front Door / WAF) with managed rules.
- [ ] Decide on runner strategy (GitHub-hosted vs self-hosted) to enable stricter network controls for SCM/Kudu.
- [ ] Consider private connectivity patterns (Private Endpoint / VNet integration) where appropriate for your architecture.
- [ ] Continue monitoring for recurrence indicators over the next **24–72 hours** after hardening and patching.

## Notes / Constraints

- Some orgs or plans may limit your preferred repository protection configuration. If branch protection or rulesets are unavailable, a strong substitute is:
  - GitHub **Environment approvals** for production deployments, plus
  - Azure **OIDC credentials scoped to the Environment**, plus
  - least-privilege Azure RBAC scoping