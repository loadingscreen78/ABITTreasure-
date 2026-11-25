import { expect, test, type Page } from "@playwright/test";
import jsQR from "jsqr";
import { PNG } from "pngjs";
import { readXlsx } from "../../lib/xlsx";
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

test("student registers on the animated home page → admin downloads Excel → creates the team → it can log in", async ({ page, browser }, info) => {
  const name = `QA Reg ${Date.now().toString(36).slice(-5)}`;
  // student side (phone)
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const p = await phone.newPage();
  await p.goto("/");
  await expect(p.getByRole("heading", { name: "Tech Treasure Hunt" })).toBeVisible();
  await p.waitForTimeout(3500); // let the welcome sequence finish
  await shot(p, "home-welcome", info.project.name);
  await p.getByLabel("Team name").fill(name);
  await p.getByLabel("Member 1", { exact: true }).fill("Asha");
  await p.getByLabel("Member 2", { exact: true }).fill("Ravi");
  await p.getByRole("button", { name: /Register team/ }).click();
  await expect(p.getByText("Teams need 3–4 members")).toBeVisible();
  await p.getByLabel("Member 3", { exact: true }).fill("Sneha");
  await p.getByRole("checkbox").check();
  await p.getByRole("button", { name: /Register team/ }).click();
  await expect(p.getByText("Your reference")).toBeVisible();
  await expect(p.getByText(/^R-[A-Z0-9]{5}$/)).toBeVisible();
  await shot(p, "home-registered", info.project.name);
  // duplicate name is refused
  await p.getByRole("button", { name: /Register another team/ }).click();
  await p.getByLabel("Team name").fill(name.toUpperCase());
  for (const [i, m] of ["A", "B", "C"].entries()) await p.getByLabel(`Member ${i + 1}`, { exact: true }).fill(m);
  await p.getByRole("checkbox").check();
  await p.getByRole("button", { name: /Register team/ }).click();
  await expect(p.getByText(/already registered/)).toBeVisible();
  await phone.close();

  // admin side
  await signIn(page, admin!, "/admin/teams");
  await expect(page.getByRole("heading", { name: "Student registrations" })).toBeVisible();
  await expect(page.getByRole("cell", { name }).first()).toBeVisible();
  const xl = await page.request.get("/api/admin/registrations?format=xlsx&status=pending");
  expect(xl.headers()["content-type"]).toContain("spreadsheetml");
  const rows = await readXlsx(await xl.body());
  expect(rows[0]!.slice(0, 5)).toEqual(["name", "member1", "member2", "member3", "member4"]);
  expect(rows.find((r) => r[0] === name)?.slice(1, 4)).toEqual(["Asha", "Ravi", "Sneha"]);

  const row = page.getByRole("row", { name: new RegExp(name) });
  await row.getByRole("button", { name: "Create team" }).click();
  await expect(page.getByText(new RegExp(`"${name}" is now team T\\d+`))).toBeVisible();
  const { data: reg } = await db().from("registrations").select("team_id, status").eq("team_name", name).single();
  expect(reg?.status).toBe("IMPORTED");
  const pwCell = page.getByRole("row", { name: new RegExp(`${reg!.team_id}.*${name}`) }).getByRole("cell").nth(2);
  const pw = (await pwCell.textContent())!.trim();
  const login = await page.request.post("/api/team/login", { data: { teamId: reg!.team_id, password: pw } });
  expect((await login.json()).ok).toBe(true);

  await db().from("registrations").delete().eq("team_name", name);
  await db().from("teams").delete().eq("id", reg!.team_id!);
});

test("board renders publicly without scores", async ({ page }, info) => {
  await page.goto("/board");
  await expect(page.getByRole("heading", { name: "Tech Treasure Hunt" })).toBeVisible();
  await shot(page, "board", info.project.name);
  await page.goto("/board?theme=dark");
  await shot(page, "board-dark", info.project.name);
});
