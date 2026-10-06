# AGENTS.md

CPAHomeUI is the browser-based admin and user interface for CLIProxyAPIHome (Home), the database-backed control plane for CLIProxyAPI (CPA). It can run separately during development or be generated as a static bundle embedded into Home.

## Stack And Repository

- Nuxt 4, Vue 3, TypeScript, and Vue Router.
- Client-side SPA: `ssr: false` in `nuxt.config.ts`.
- Nuxt UI 4, Tailwind CSS 4, and Tabler icons (`i-tabler-*`).
- Pinia 3 with `@pinia/nuxt` for application state.
- `bun.lock` is the checked-in dependency lockfile. Prefer Bun for dependency installation and scripts; do not introduce another lockfile unless explicitly requested.
- `go.mod` exists, but this repository's application and build workflow are JavaScript/TypeScript, not a Go service.
- Related backend: `../CLIProxyAPIHome` when both repositories are checked out next to each other.

## Commands

Run from the repository root:

```bash
bun install                 # Install dependencies; postinstall runs nuxt prepare
bun run dev                 # Development server, normally http://localhost:3000
bun run build               # Production build
bun run generate            # Generate static output into .output/public
bun run preview             # Preview the production build
bun run build:embedded      # Generate and package the embedded SPA into dist/
```

- `package.json` also supports running scripts through npm, but keep dependency changes consistent with `bun.lock`.
- The development script sets `TMPDIR=/tmp`; preserve this unless intentionally changing the development workflow.
- There are currently no `test`, `lint`, or `typecheck` scripts in `package.json`.
- README mentions `node scripts/test-state.mjs`, but that file is not currently present. Do not treat it as an available test command.
- For application changes, use `bun run build` as the normal build verification. For embedded packaging changes, also use `bun run build:embedded`.
- A successful build is not proof of TypeScript type-checking or browser behavior. Report the validation actually performed.
- Documentation-only changes do not require an application build.

## Architecture

- `app.vue`: root `UApp`, toast configuration, and Nuxt layout/page rendering.
- `nuxt.config.ts`: SPA mode, Nuxt modules, runtime configuration, Vite integration, and root redirect.
- `app.config.ts`: shared Nuxt UI colors, component slots, and defaults.
- `assets/main.css`: Tailwind/Nuxt UI imports, theme variables, and shared workbench/user styling.
- `pages/admin/`: management workspace for dashboards, upstream providers/accounts, credentials, routing, users, billing, configuration, diagnostics, logs, and usage.
- `pages/app/`: user workspace and public account flows, including login, registration, password recovery, email verification, model catalog, API keys, balance, profile, and settings.
- `layouts/default.vue`: admin shell, navigation, connection state, capabilities, and synchronization controls.
- `layouts/app.vue`: user shell, public/authenticated route handling, navigation, and session integration.
- `components/App*.vue`: shared application primitives for buttons, cards, tables, panels, modals, and synchronization.
- `components/admin/`: admin-specific components, including configuration and user-management subdirectories.
- `components/app/`: user-specific components.
- `composables/`: API wrappers, capability access, workspace refs, asynchronous data loading, synchronization, and upstream quota helpers.
- `stores/`: Pinia session, capability, configuration cache, and workspace stores.
- `middleware/mail-link.global.ts`: translates backend email-link fragments into frontend verification/reset routes.
- `public/`: static public assets.
- `scripts/build-embedded.mjs`: packages generated output for Home's embedded asset loader.

Keep the root-level source layout used by this repository; do not move it into a Nuxt `app/` directory as an unrelated cleanup.

## API And Backend Contract

- `NUXT_PUBLIC_API_URL` configures the backend address used by the browser. Prefer an origin-only value such as `http://127.0.0.1:8327`.
- An empty API URL uses same-origin requests, as required by the embedded deployment. A separate UI origin requires Home to allow that origin.
- Admin requests go through `useApi()` in `composables/useApi.ts`; the Management API base is `/v8/management`.
- User requests go through `useUserApi()`, which wraps `stores/userSession.ts`; the user API base is `/user`.
- Preserve the existing API URL normalization, including management suffix handling and localhost-to-IPv4 normalization.
- Do not bypass the management URL boundary checks or send management credentials to arbitrary origins/endpoints.
- Preserve query serialization, request body handling, response types, cancellation support, and structured API errors when modifying the wrappers.
- Management configuration reads use a short-lived cache with request deduplication. Provider-group reads can be derived from `/config`; mutations invalidate the cache. Preserve these behaviors.
- Use `useCapabilities()` and user capabilities to gate optional features. Keep existing unsupported-feature and unavailable-endpoint fallbacks; do not assume every Home deployment supports every feature.
- Verify endpoint names, payloads, and response fields against current Home handlers and route registration rather than inventing contracts.
- When a task changes backend API behavior, update Home's `docs/management/api.md` and applicable language-specific documentation in the backend repository. UI-only changes should not modify backend behavior unnecessarily.

## State And Lifecycle

- `stores/userSession.ts`: user authentication, account, capabilities, server metadata, persistence, and passkey helpers.
- `stores/managementSession.ts`: management token and remember preference.
- `stores/managementCapabilities.ts`: admin capabilities and server metadata.
- `stores/managementConfig.ts`: management configuration cache and in-flight request deduplication.
- `stores/workspace.ts`: namespaced data, generation ownership, and registered synchronization loaders.
- Use `useWorkspaceState()` for writable store-backed workspace refs and `useStoreData()` for asynchronous page data, following nearby usage.
- Namespace admin workspace keys with `admin:` and user workspace keys with `user:`. Token changes clear the corresponding domain.
- Each workspace owner starts with fresh state. Preserve generation/version guards so obsolete owners or stale requests cannot overwrite newer state.
- Workspace data is not persisted. Keep transient forms, modal visibility, filters, and pagination component-local unless the task explicitly requires shared state.
- Register shared refresh behavior through `useDataSync()` when appropriate. Dispose registrations, timers, listeners, and in-flight work with the component scope.
- Use `storeToRefs()` when exposing reactive store state; avoid losing reactivity through plain destructuring.

## Authentication And Security

- Admin connection is configured at `/admin/connect`; user login is at `/app/login`.
- Keep admin and user sessions separate. Preserve cookie names, storage keys, remember-session semantics, expiry handling, and logout behavior unless explicitly changing the session contract.
- Never put real management secrets in public runtime configuration or `NUXT_PUBLIC_*` environment variables. `runtimeConfig.public.secretKey` currently exists as a fallback, but public runtime configuration is visible to the browser and is not secure secret storage.
- Do not log secrets, passwords, bearer tokens, API keys, passkey material, or one-time email tokens.
- Email verification and password-reset links keep one-time tokens in URL fragments. Preserve fragment-based routing and token removal; do not move tokens into URL query strings or server-visible paths.
- Client-side navigation/capability checks are UI behavior, not a replacement for backend authorization.

## UI And Code Conventions

- Follow existing Vue single-file component patterns with `<script setup lang="ts">`, Composition API, and Nuxt auto-imports.
- Use `~/` imports for project source and `#imports` where the existing store/composable pattern requires Nuxt helpers.
- Match the formatting of the file being edited; avoid unrelated quote, semicolon, indentation, or component-order rewrites.
- Prefer existing `App*` primitives and feature components over adding parallel abstractions or dependencies.
- Use Nuxt UI 4 APIs, Tailwind 4 utilities, shared theme tokens such as `--ui-*`, and existing component slot configuration. Do not introduce a second UI framework.
- Preserve responsive layouts, light/dark themes, compact workspace density, and mobile navigation behavior.
- Provide loading, empty, unsupported, error, and mutation feedback states where applicable. Prevent duplicate submissions for pending actions.
- Keep icon-only controls accessible with labels, and preserve keyboard/focus and modal behavior.
- Existing user-visible text is predominantly English. Follow the feature's existing language; write new code comments and non-language-specific documentation in English.
- Keep changes focused, preserve uncommitted user work, and do not commit or create branches unless requested.

## Embedded Deployment

- `bun run build:embedded` clears `NUXT_PUBLIC_API_URL`, runs static generation, then invokes `scripts/build-embedded.mjs`.
- The packaging script recreates `dist/`, copies hashed Nuxt assets and fonts, and rewrites `/_nuxt/`, `/_fonts/`, and favicon URLs to `/assets/` paths.
- The output includes `dist/index.html`, `dist/management.html`, `dist/user.html`, and `dist/assets/`.
- Home embeds these files through `internal/managementasset`. Admin entry points are `/management.html` and `/admin/*`; user entry points are `/user.html` and `/app/*`.
- With sibling repositories, the integration command is:

```bash
make -C ../CLIProxyAPIHome panel-assets-local PANEL_SOURCE_DIR=../CPAHomeUI
```

- This command copies build artifacts into the backend repository; run it only when the task requires updating embedded Home assets.
- Preserve SPA deep-link support and same-origin API behavior. Do not replace embedded entry points with development-only URLs.
- Do not hand-edit or commit generated `dist/`, `.nuxt/`, `.output/`, or dependency files under `node_modules/`; change the source or packaging script instead.
