# Legacy UI parity tracker

This document is the source-of-truth checklist for migrating every feature from
`CLIProxyAPIHome/internal/managementasset/static` into native Nuxt/Vue pages in
`CLIProxyHomeUI`.

Rules:

- Do not embed, iframe, or execute the legacy bundles.
- Management routes are canonical under `/admin/*`.
- User authentication and workspace routes are canonical under `/app/*`.
- `Done` means the native workflow and backend contract are implemented.
- `Partial` means the route exists but one or more legacy interactions remain.
- `Missing` means the workflow has not yet been implemented natively.
- A successful production build is validation, not proof of feature parity.

## Routing and shell

| Legacy feature | Native route | Status | Notes |
| --- | --- | --- | --- |
| Management shell/sidebar/workbench | `/admin/*` | Partial | Sidebar follows legacy groups and labels; Upstream now has mounted Accounts/Providers tabs. Legacy visual and browser interaction parity remains outstanding. |
| User shell/workspace | `/app/*` | Partial | Removed the invented workspace sidebar: the user shell now uses a top header like legacy. Workspace section hierarchy and browser visual comparison remain outstanding. |
| Legacy upstream provider tab | `/admin/upstream?tab=providers` | Partial | Native provider workbench is mounted on Upstream; `/admin/providers` redirects. Claude cloak guided controls and raw-JSON header preservation added. Provider create still uses replacement PUT and is unsafe under concurrent edits; model test/reference, visual and browser parity remain outstanding. |
| Legacy upstream accounts tab | `/admin/upstream?tab=accounts` | Partial | Native account workbench is mounted on Upstream; `/admin/credentials` redirects. Connectivity test, capability-gated cooldown reset, tri-state cooling metadata editor, filter/selection controls and quota-detail refresh added. Visual/browser parity remains outstanding. |
| Proxy network (native auxiliary route) | `/admin/proxy-network` | Partial | Historical `/admin/upstream?tab=proxy` redirects. Proxy is not a legacy Upstream tab. |
| Legacy quota workspace | `/admin/upstream?tab=accounts` | Partial | Quota status, freshness, collection and up to two primary windows are embedded in Accounts; `/admin/quota` redirects here. Provider-specific displays and full detail drawer still differ. |
| Legacy request-events redirect | `/admin/request-events` | Done | Dedicated native page. |
| No legacy asset dependency | all | Done | No iframe, `management.html`, `user.html`, or legacy JS/CSS references. |

## Dashboard

| Feature | Status |
| --- | --- |
| Cluster/Home/CPA topology summary | Done |
| Release status | Done |
| 24-hour usage summary | Done |
| Provider and credential summaries | Done |
| Client-key summary without exposing key values | Done |
| Issue cards and drill-down navigation | Done |
| Top models and client-key usage previews | Done |
| Full legacy trend/activity presentation | Partial |
| All legacy config-check detail groups | Partial |

## Providers and credentials

| Feature | Status |
| --- | --- |
| Auth-file list/search/status/delete/upload | Partial | Accounts list remains available if in-flight summary fails; browser/API verification outstanding. |
| Upload per-file results and retry failed | Done |
| OAuth start/status/callback flows | Partial | Native start, bounded status polling and callback submission implemented; browser verification pending. |
| Vertex service-account import | Done |
| Credential metadata editor | Done |
| Credential filters and quota-attention filters | Partial | Empty SelectItem values replaced with non-empty “All” sentinel; the card and account filter share legacy's non-healthy/non-fresh/partial/failed predicate. Browser interaction and visual parity still unverified. |
| Bulk enable/disable/delete | Done |
| In-flight summary and paginated request details | Done |
| Total/per-model concurrency policy editor and conflict handling | Done |
| Deep links using `q` and `credential` | Done |
| Provider-category CRUD | Partial | Create/edit/delete available; direct provider test, model discovery and live request verification remain. |
| Guided API key/base URL/proxy/priority/prefix/header/model form | Partial | Required Base URL validated for Codex, xAI, and OpenAI compatibility guided forms; remaining provider-specific options and live verification outstanding. |
| Provider model catalog suggestions | Done |
| Credential connectivity test from account row | Partial | Home-side GET via `/api-call`; non-2xx upstream responses are surfaced, but test URL/header defaults and browser interaction still need legacy comparison. |
| Provider-specific connectivity test | Missing | Account GET probe is not equivalent to the legacy inference test, which may incur upstream charges. |
| Retry/cooling overrides in provider form | Partial | Guided editor sends explicit `null` to inherit on PATCH and retains unknown fields; not yet verified against a running Home. |
| Complete provider-specific Antigravity/Codex/xAI/Claude options | Partial | Claude cloak controls added, but provider-specific options and live verification are incomplete. |
| Complete model discovery/select-all/apply workflow | Partial | Explicit Home-side discovery for selected saved providers and selection/apply added; unsaved entries, pagination, additional provider types, and live verification still differ from legacy. |
| Provider entry enable/disable | Blocked | Current provider PATCH contract preserves disabled state; do not show a fake action. |

## Configuration

| Feature | Status |
| --- | --- |
| Runtime scalar controls | Done |
| OAuth excluded-model editor | Done |
| OAuth alias editor | Done |
| Full payload rule add/edit/duplicate/delete | Done |
| Advanced payload match/header/exist conditions | Done |
| Antigravity sensitive words | Done |
| Full YAML editor | Done |
| YAML dirty state, discard, review, and confirmation | Done |
| Safe server-side config validation | Done | Performed by `PUT /config.yaml`. |
| Guided TLS controls | Missing |
| Guided remote-management controls | Missing |
| Guided plugin runtime/source controls | Missing |
| Guided global cooling control | Missing |

Guided TLS/remote-management/plugin controls must preserve unknown YAML fields and secrets. There are no dedicated leaf endpoints for all of these fields, so do not implement destructive client-side YAML mutation without a safe parser and redaction design.

## Usage, diagnostics, logs, and request events

| Feature | Status |
| --- | --- |
| Legacy time presets and custom range | Done |
| Provider/model/status/identity/node/latency/amount record filters | Partial |
| Configurable record page size and sort | Done |
| Filter-preserving CSV/JSONL export | Done |
| Usage detail with token accounting, sessions, credential/runtime/billing data | Done |
| Related request-log download | Done |
| Canonical token-bucket overview | Done |
| Cost breakdown without fabricated data | Done |
| Model efficiency | Done |
| Activity-health matrix | Done |
| Aggregates, realtime, provider/credential health | Done |
| Session-tree lookup | Done |
| Diagnostics observability console with auto-refresh | Done |
| API-call sender | Done |
| Request event filters/detail/export/live refresh | Done |
| Request log list/download | Done |
| Request-error-log list/search/download | Done |
| Application logs/detail/clear/page size/live refresh | Done |
| Application log free-text/search-by-field | Blocked | Backend `/logs` currently filters time, level, Home IP, client IP, and request ID only. |
| Configurable table columns across all observability tables | Missing |

## Billing

| Feature | Status |
| --- | --- |
| Overview/charges/balance date presets | Done |
| Charge and balance pagination/page size | Done |
| Charge and balance details | Done |
| Balance adjustments | Done |
| Model-price CRUD and tier/source filters | Done |
| Service-tier diagnostics and confirmation | Done |
| Models.dev preview/apply import | Partial | Contracts wired; live preview/apply against Home not verified. |
| Multi-target import and default multiplier | Done |
| Zero-cost import option and overwrite confirmation | Done |
| Immutable import operation result | Done |
| Alias, multiplier-rule, row-multiplier, and match-override import editors | Partial | Native models.dev preview policy editor is wired to the documented fields; live preview/apply still needs browser and connected-Home verification. |
| Multi-model batch creation outside import | Partial | Creates rules individually; partial success is possible and failed models remain retryable. Not verified against a running Home. |
| Full legacy charge price-snapshot tier/band detail | Partial | Known snapshot fields and returned token counts appear as labeled detail rows with raw JSON secondary; token buckets absent from the API must not be fabricated. Visual/API verification outstanding. |

## Plugins

| Feature | Status |
| --- | --- |
| Installed/store/auth tabs | Done |
| Store source/status/install filters | Done |
| Plugin metadata/details | Done |
| Install/update/uninstall confirmation and response status | Done |
| Plugin-store authentication rules | Done |
| Complete rollout/node-report detail and polling | Partial |
| Secret reveal/hide UX | Missing |
| Guided global plugin enable/dir/source config | Missing |

## System nodes and connection

| Feature | Status |
| --- | --- |
| Home/CPA topology and health | Done |
| Node search/rename | Done |
| mTLS enrollment JWT | Done |
| Node/API network diagnostics | Done |
| Management connection validation | Done |
| Session/persistent management cookie choice | Done |
| Endpoint/runtime status and disconnect | Done |
| Editable runtime Management base URL | Not planned | API base is deployment runtime configuration; do not pretend it changes dynamically. |
| Full per-node plugin/config/diagnostic field groups | Partial |

## User authentication and workspace

| Feature | Status |
| --- | --- |
| Login/password/TOTP/passkey | Done |
| Explicit passkey-required mode | Done |
| Remember-browser-session choice | Done |
| Registration/email verification/password recovery/reset | Done |
| API-key CRUD and searchable/free-entry scopes | Partial | Scope IDs are displayed in the key list; browser verification outstanding. |
| Password/TOTP/email/passkey management | Done |
| Session expiry and passkey timestamps | Done |
| Billing today/7d/30d/custom ranges | Done |
| Billing metrics, top models/providers and daily trend | Done |
| Paginated charge records/page size | Done |
| Full user charge detail modal | Partial | Native charge-row detail shows fields returned by the User API; visual comparison and browser verification against legacy pending. |

## User model catalog

| Feature | Status |
| --- | --- |
| Public and accessible catalogs | Done |
| Provider/input-modality/capability/availability filters | Done |
| Name/context/availability/price sorting | Done |
| Access restriction context | Done |
| Modalities/capabilities/reasoning/parameters detail | Done |
| Provider/tier/context-band pricing ladder | Done |
| Availability samples/failures/latency/TTFT/throughput/window | Done |
| Explicit included/excluded model-group listing | Partial | API returns access summary but not a full group-name catalog to user routes. |

## Remaining priority order

1. Browser-test legacy vs native workbench workflows end-to-end (especially provider creation, OAuth, quota collection, Billing import), then align visual hierarchy and controls with the legacy screen. A successful build alone does not establish 1:1 parity.
2. Complete provider-specific guided options, direct provider tests, and discovery/apply workflows.
3. Add safe guided TLS, remote-management, plugin runtime, and global cooling config controls.
4. Finish charge price-snapshot details and verify advanced Billing import policy against live Home.
5. Add configurable columns and remaining table/detail workflows.
6. Browser-test every route and update this tracker using observed behavior, not build success alone.
