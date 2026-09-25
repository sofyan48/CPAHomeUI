import twVite from "@tailwindcss/vite";

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  ssr: false,

  app: {
    head: {
      title: "CLIProxyAPI Home",
      meta: [
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        { name: "theme-color", content: "#0f172a" },
      ],
      link: [
        { rel: "icon", type: "image/png", href: "/favicon.png" }
      ]
    }
  },

  css: ["@/assets/main.css"],

  devtools: { enabled: true },

  modules: ["@pinia/nuxt", "@nuxt/ui"],

  runtimeConfig: {
    public: {
      apiUrl: process.env.NUXT_PUBLIC_API_URL || "",
      apiBase: process.env.NUXT_PUBLIC_API_BASE || "/v0/management",
      secretKey: process.env.NUXT_PUBLIC_API_SECRET || "",
    },
  },

  vite: {
    plugins: [twVite()],
    optimizeDeps: {
      include: ["@vue/devtools-core", "@vue/devtools-kit"],
    },
  },

  // Workaround for Nuxt 4.4.4 ssr:false regression where vite-node IPC
  // socketPath is captured before the parent process sets it.
  experimental: {
    viteEnvironmentApi: true,
    viewTransition: false,
  },

  compatibilityDate: "2026-05-05",
});
