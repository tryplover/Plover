# Plover Server GCP & GitHub Setup Details

This document contains the configuration details and resource locations for the `plover-server` backend extraction.

## Google Cloud Platform (GCP) Configuration
* **Project Name:** `plover-server-liyuxiao`
* **Project ID:** `plover-server-liyuxiao`
* **Project Number:** `562340206018`
* **Billing Account:** `My Billing Account 1` (`01906A-99EA90-BE4138`)
* **Region:** `us-central1`

### Resources Created
* **Cloud Run Service:** [plover-server](https://console.cloud.google.com/run/detail/us-central1/plover-server/revisions?project=plover-server-liyuxiao)
  * **Service URL:** `https://plover-server-562340206018.us-central1.run.app`
  * **OAuth Callback URL:** `https://plover-server-562340206018.us-central1.run.app/oauth/callback`
* **Firestore Database (Native Mode):** [Firestore (default)](https://console.cloud.google.com/firestore/databases/-default-/data/panel?project=plover-server-liyuxiao)
* **Secret Manager:** [Secret Manager Console](https://console.cloud.google.com/security/secret-manager?project=plover-server-liyuxiao)
  * Secret `gemini-api-key` (copied from local `.env`)
  * Secret `oauth-secret` (stored the OAuth Web Client Client Secret)
* **OAuth 2.0 Client:** Web application client `plover-server` in [Credentials Console](https://console.cloud.google.com/apis/credentials?project=plover-server-liyuxiao)
  * **Client ID:** `562340206018-d8m6t93hhbk6fkojbg1jvb5qah8bq5g9.apps.googleusercontent.com`
* **Workload Identity Federation (WIF):**
  * **Pool ID:** `github-pool`
  * **Provider ID:** `github-provider`
  * **WIF Resource Name:** `projects/562340206018/locations/global/workloadIdentityPools/github-pool/providers/github-provider`
  * **OIDC Issuer:** `https://token.actions.githubusercontent.com`
  * **Attribute Mapping:**
    * `google.subject=assertion.subject`
    * `attribute.actor=assertion.actor`
    * `attribute.repository=assertion.repository`
  * **Attribute Condition:** `assertion.repository_owner == 'tryplover'`

### IAM Service Accounts & Roles
1. **Runtime Service Account:** `plover-server-runtime@plover-server-liyuxiao.iam.gserviceaccount.com`
   * Roles: `roles/datastore.user`, `roles/secretmanager.secretAccessor`
2. **Deploy Service Account:** `plover-server-deploy@plover-server-liyuxiao.iam.gserviceaccount.com`
   * Roles: `roles/run.admin`, `roles/artifactregistry.writer`, `roles/iam.serviceAccountUser`
   * Impersonation permission granted to repository `tryplover/plover-server` via WIF.

---

## GitHub Configuration
* **Repository:** [tryplover/plover-server](https://github.com/tryplover/plover-server)
* **Local Clone Path:** `/Users/liyu.xiao/Documents/GitHub/plover-server`

### Repository Secrets Configured
* `GCP_PROJECT_ID` = `plover-server-liyuxiao`
* `GCP_WIF_PROVIDER` = `projects/562340206018/locations/global/workloadIdentityPools/github-pool/providers/github-provider`
* `GCP_DEPLOY_SA` = `plover-server-deploy@plover-server-liyuxiao.iam.gserviceaccount.com`
* `GCP_REGION` = `us-central1`
