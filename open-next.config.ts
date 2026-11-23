import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

// Every page in this app is prerendered once at build time (all live data comes
// from JSON route handlers), so a read-only static-assets cache is enough and
// needs no R2/KV — works on the Workers free plan.
export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
  enableCacheInterception: true,
});
