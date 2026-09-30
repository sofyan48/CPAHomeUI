import twVite from "@tailwindcss/vite";

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  ssr: false,

  app: {
    head: {
      title: "CPAHome",
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
      apiUrl: "",
      secretKey: "",
    },
  },

  routeRules: {
    "/": { redirect: "/app/login" },
  },

  vite: {
    plugins: [twVite()],
    optimizeDeps: {
      include: ["@vue/devtools-core", "@vue/devtools-kit"],
    },
  },

  // Nuxt 4.4.4 ssr:false requires the Vite environment API so the
  // vite-node IPC socket is configured before Nitro starts rendering.
  experimental: {
    viteEnvironmentApi: true,
    viewTransition: false,
  },

  compatibilityDate: "2026-05-05",
});
