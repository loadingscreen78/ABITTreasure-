import { defineConfig, devices } from "@playwright/test";

try {
  process.loadEnvFile(".env.local");
} catch {
  /* CI without secrets: e2e is skipped there */
}

// E2E runs against a real deployment + the real Supabase project with rehearsal team T00.
// E2E_BASE_URL defaults to the deployed Worker; use http://localhost:3000 with `npm run dev`.
const baseURL = process.env.E2E_BASE_URL ?? "https://abit-hunt.jagannathmishra540.workers.dev";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  use: { baseURL, trace: "retain-on-failure" },
  projects: [
    { name: "pixel7", use: { ...devices["Pixel 7"] } },
    { name: "iphone13", use: { ...devices["iPhone 13"], browserName: "chromium" } },
    // Visual QA sizes (Section 14): team screens only
    { name: "v360", testMatch: /team.spec/, use: { ...devices["Pixel 7"], viewport: { width: 360, height: 780 } } },
    { name: "v414", testMatch: /team.spec/, use: { ...devices["Pixel 7"], viewport: { width: 414, height: 896 } } },
  ],
});
