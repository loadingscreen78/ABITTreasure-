import { expect, test, type Page } from "@playwright/test";
import jsQR from "jsqr";
import { PNG } from "pngjs";
import { db, hasSecrets, organiser, secretWord, shot, tokens } from "./helpers";

const admin = organiser("admin");
const judge = organiser("judge");
test.skip(!hasSecrets || !admin, "needs .env.local + organisers-*.txt");
test.use({ viewport: { width: 1280, height: 900 }, isMobile: false, hasTouch: false });

async function signIn(page: Page, who: { email: string; password: string }, path: string) {
  await page.goto(path);
  await page.getByLabel("Email").fill(who.email);
  await page.getByLabel("Password").fill(who.password);
  await page.getByRole("button", { name: /sign in/i }).click();
}

async function decodeQr(page: Page, label: string): Promise<string | null> {
  const el = page.getByRole("img", { name: label }).first();
  const png = PNG.sync.read(await el.screenshot());
  return jsQR(new Uint8ClampedArray(png.data), png.width, png.height)?.data ?? null;
}

test("admin signs in via Supabase Auth (getClaims) and sees live ops", async ({ page }, info) => {
  await signIn(page, admin!, "/admin");
  await expect(page.getByRole("heading", { name: /Status:/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Live ops" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Station health" })).toBeVisible();
  await shot(page, "admin", info.project.name);
});

test("print QA: every checkpoint card QR decodes to its /s/<token> URL; secret-word QR is plain text", async ({ page }, info) => {
  const tok = await tokens();
  await signIn(page, admin!, "/print/checkpoints");
  await expect(page.getByRole("img", { name: "QR code for CP-08" })).toBeVisible();
  for (const [code, token] of Object.entries(tok)) {
    const text = await decodeQr(page, `QR code for ${code}`);
    expect(text, code).toMatch(new RegExp(`/s/${token}$`));
  }
  await page.emulateMedia({ media: "print" });
  await page.pdf({ path: "qa/pdf-checkpoints.pdf", format: "A4", landscape: true, printBackground: true }).catch(() => undefined);
  await page.emulateMedia({ media: "screen" });
  await shot(page, "print-checkpoints", info.project.name);
  // never print the location name on the cards
  await expect(page.getByText("Library")).toHaveCount(0);

  await page.goto("/print/secret-word");
  await expect(page.getByRole("img", { name: "Secret word QR" })).toBeVisible();
  expect(await decodeQr(page, "Secret word QR")).toBe(`Your secret word is ${await secretWord()}.`);
});

test("judge can open the finish desk and answer key; admin pages refuse the judge", async ({ page }) => {
  test.skip(!judge, "no judge account");
  await signIn(page, judge!, "/judge");
  await expect(page.getByRole("heading", { name: /Finished — verify/ })).toBeVisible();
  await page.goto("/print/answer-key");
  await expect(page.getByText("Confidential — organisers only")).toBeVisible();
  await page.goto("/admin");
  await expect(page.getByText(/This page needs admin/)).toBeVisible();
});

test("admin adds a team with a typed ID + password (letter O tolerated) and it can log in", async ({ page, request }) => {
  await db().from("teams").delete().eq("id", "T98");
  await signIn(page, admin!, "/admin/teams");
  await page.getByLabel("Team name").first().fill("QA Custom");
  await page.getByLabel("Team ID (optional)").fill("TO98");
  await page.getByLabel("Password (optional)").fill("RYAN@1908");
  await page.getByLabel("Member 1").first().fill("Tester");
  await page.getByRole("button", { name: "Create team" }).click();
  await expect(page.getByText("New credentials — shown once")).toBeVisible();
  await expect(page.getByRole("cell", { name: "T98", exact: true }).first()).toBeVisible();
  for (const pw of ["RYAN@1908", "ryan1908"]) {
    const r = await request.post("/api/team/login", { data: { teamId: "to98", password: pw } });
    expect((await r.json()).ok, pw).toBe(true);
  }
  await page.getByLabel("Team ID (optional)").fill("T98");
  await page.getByLabel("Team name").first().fill("Dup");
  await page.getByRole("button", { name: "Create team" }).click();
  await expect(page.getByText(/already exists/)).toBeVisible();
  await db().from("teams").delete().eq("id", "T98");
});

test("board renders publicly without scores", async ({ page }, info) => {
  await page.goto("/board");
  await expect(page.getByRole("heading", { name: "Tech Treasure Hunt" })).toBeVisible();
  await shot(page, "board", info.project.name);
  await page.goto("/board?theme=dark");
  await shot(page, "board-dark", info.project.name);
});
