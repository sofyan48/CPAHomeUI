# CLIProxyHomeUI

The Nuxt UI can run separately during development or be embedded into CLIProxyAPIHome. Open `http://localhost:3000/admin/upstream` for the admin workspace, or `/app/login` for the user workspace.

Configure `NUXT_PUBLIC_API_URL` to reach Home from the browser. Prefer an origin-only value such as `http://127.0.0.1:8327`; a full URL ending in `/v8/management` is normalized to its origin. The Management UI always uses `/v8/management`. The management secret is entered at `/admin/connect`. Home must allow requests from the UI origin. Never put the management secret in a public runtime environment variable.

## Setup

Make sure to install dependencies:

```bash
# npm
npm install

# pnpm
pnpm install

# yarn
yarn install

# bun
bun install
```

## Development Server

Start the development server on `http://localhost:3000`:

```bash
# npm
npm run dev

# pnpm
pnpm dev

# yarn
yarn dev

# bun
bun run dev
```

## Production

Build the application for production:

```bash
# npm
npm run build

# pnpm
pnpm build

# yarn
yarn build

# bun
bun run build
```

Locally preview production build:

```bash
# npm
npm run preview

# pnpm
pnpm preview

# yarn
yarn preview

# bun
bun run preview
```

## Embedded Home build

Generate the static bundle expected by `CLIProxyAPIHome/internal/managementasset`:

```bash
bun run build:embedded
```

This writes `dist/index.html`, `dist/management.html`, `dist/user.html`, and hashed files under `dist/assets/`.

With both repositories next to each other, build and copy the UI into Home with:

```bash
make -C ../CLIProxyAPIHome panel-assets-local PANEL_SOURCE_DIR=../CPAHomeUI
```

The next Home build embeds those files through Go's `embed` package. Home serves the admin SPA under `/management.html` and `/admin/*`, and the user SPA under `/user.html` and `/app/*`.

Check out the [deployment documentation](https://nuxt.com/docs/getting-started/deployment) for more information.
