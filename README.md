# CLIProxyHomeUI

The native Nuxt management UI runs separately from CLIProxyAPIHome. Open `http://localhost:3000/admin/upstream` for the new Upstream screen (Accounts and Providers tabs), or `/app/login` for the user workspace. Opening Home's `http://127.0.0.1:8327/management.html` still displays the legacy embedded UI; building this repository does **not** replace Home's embedded panel.

Configure `NUXT_PUBLIC_API_URL` to reach Home from the browser (for example `http://127.0.0.1:8327`); `NUXT_PUBLIC_API_BASE` defaults to `/v0/management`. The management secret is entered at `/admin/connect`. Home must allow requests from the UI origin. Never put the management secret in a public runtime environment variable.

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

Check out the [deployment documentation](https://nuxt.com/docs/getting-started/deployment) for more information.
