// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Self-hosting (PHP host, see backend/): SELF_HOST=1 builds a static SPA shell instead of
// the Cloudflare worker. API_PROXY=<url> forwards /api to a local PHP server in dev.
// Neither is set inside Lovable, so its preview and publish stay unchanged.
const selfHost = !!process.env.SELF_HOST;
const apiProxy = process.env.API_PROXY;

export default defineConfig({
  ...(selfHost && {
    tanstackStart: { spa: { enabled: true } },
    nitro: false,
  }),
  ...(apiProxy && {
    vite: { server: { proxy: { "/api": { target: apiProxy, changeOrigin: true } } } },
  }),
});
