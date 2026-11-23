import { expect, test } from "@playwright/test";
import { answerFor, hasSecrets, hunt, resetT00, secretWord, shot, T00_PASSWORD, tokens } from "./helpers";

test.skip(!hasSecrets, "needs .env.local + content/hunt.json");
test.use({ reducedMotion: "reduce" });

async function login(page: import("@playwright/test").Page) {
  await page.getByLabel("Team ID").fill("T00");
  await page.getByLabel("Password", { exact: true }).fill(T00_PASSWORD);
  await page.getByRole("button", { name: /unlock checkpoint|log in/i }).click();
}

async function answer(page: import("@playwright/test").Page, text: string) {
  await page.getByLabel("Your answer").fill(text);
  await page.getByRole("button", { name: /submit answer|claim the treasure/i }).click();
}

test("full T00 run CP-01 → CP-08: every reveal is the exact Section 3 riddle", async ({ page, browser }, info) => {
  const H = hunt();
  const tok = await tokens();
  const secret = await secretWord();
  await resetT00();

  await page.goto(`/s/${tok["CP-01"]}`);
  await expect(page.getByText(/Checkpoint detected · CP—01/i)).toBeVisible();
  await shot(page, "01-login", info.project.name);
  await login(page);

  for (const cp of H.checkpoints) {
    if (cp.order > 1) await page.goto(`/s/${tok[cp.code]}`);
    await expect(page.getByLabel(`Checkpoint ${cp.order}`)).toBeVisible();
    for (const [qi, q] of cp.questions.entries()) {
      await expect(page.getByText(q.prompt, { exact: false })).toBeVisible();
      if (cp.order === 1) {
        // near-miss does not use an attempt
        await answer(page, "processor");
        await expect(page.getByText("(no attempt used)")).toBeVisible();
        await expect(page.getByText("Attempt 1 of 3 for full marks")).toBeVisible();
        await shot(page, "02-question-nearmiss", info.project.name);
      }
      if (cp.order === 2) {
        // 4 wrong answers → 0 marks for this clue + cooldown
        for (let k = 1; k <= 4; k++) {
          await answer(page, `wrong${k}`);
          await expect(page.getByText(/INCORRECT/)).toBeVisible();
        }
        await expect(page.getByText(/Try again in/)).toBeVisible();
        await shot(page, "03-cooldown", info.project.name);
        await expect(page.getByRole("button", { name: /Locked/ })).toBeVisible({ timeout: 5000 });
        await expect(page.getByRole("button", { name: /submit answer/i })).toBeVisible({ timeout: 25_000 });
      }
      if (cp.order === 3) {
        // wrong-order scan reveals nothing new
        await page.goto(`/s/${tok["CP-06"]}`);
        await expect(page.getByText("Wrong turn")).toBeVisible();
        await expect(page.getByText(q.prompt)).toBeVisible();
        await shot(page, "04-wrong-turn", info.project.name);
        // phone B logs in mid-run and sees the same state
        const ctxB = await browser.newContext({ ...info.project.use, reducedMotion: "reduce" });
        const b = await ctxB.newPage();
        await b.goto("/play");
        await login(b);
        await expect(b.getByText(q.prompt)).toBeVisible();
        await ctxB.close();
        await page.goto(`/s/${tok[cp.code]}`);
      }
      await answer(page, answerFor(q, secret));
      if (q.clue === 15) {
        await expect(page.getByText("Claimed")).toBeVisible();
        await expect(page.getByLabel(/Judge code \d{4}/)).toBeVisible();
        await shot(page, "09-finish", info.project.name);
      } else if (qi < cp.questions.length - 1) {
        await expect(page.getByText(cp.questions[qi + 1]!.prompt)).toBeVisible();
        await expect(page.getByText("2 of 2 at this checkpoint")).toBeVisible();
      } else {
        await expect(page.getByText(cp.reveal!.riddle)).toBeVisible();
        await expect(page.getByText(new RegExp(`Find the QR for CP—0${cp.order + 1}`))).toBeVisible();
        if (cp.order === 1) await shot(page, "05-reveal", info.project.name);
        if (cp.reveal!.nudge) {
          await page.getByRole("button", { name: "Need a nudge?" }).click();
          await expect(page.getByText(cp.reveal!.nudge)).toBeVisible();
        }
        if (cp.order === 2) {
          await page.goto(`/s/${tok["CP-01"]}`);
          await expect(page.getByText("Already cleared")).toBeVisible();
          await expect(page.getByText(cp.reveal!.riddle)).toBeVisible();
          await shot(page, "06-already-cleared", info.project.name);
        }
      }
    }
  }
  await resetT00();
});

test("tap targets ≥ 48px and inputs ≥ 16px on the login screen", async ({ page }) => {
  const tok = await tokens();
  await page.goto(`/s/${tok["CP-02"]}`);
  await expect(page.getByLabel("Team ID")).toBeVisible();
  for (const el of await page.locator("button, input").all()) {
    const box = await el.boundingBox();
    if (!box) continue;
    expect(box.height, await el.evaluate((e) => e.outerHTML.slice(0, 60))).toBeGreaterThanOrEqual(48);
  }
  for (const input of await page.locator("input").all()) {
    const fs = await input.evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
    expect(fs).toBeGreaterThanOrEqual(16);
  }
});

test("rules, home and unknown QR render branded pages", async ({ page }, info) => {
  await page.goto("/");
  await expect(page.getByText("Ajay Binay Institute of Technology (Autonomous), Cuttack").first()).toBeVisible();
  await shot(page, "00-home", info.project.name);
  await page.goto("/rules");
  await expect(page.getByText("Organisers' decisions regarding scoring and disqualification will be final.")).toBeVisible();
  await page.goto("/s/ZZZZZZZZ");
  await expect(page.getByText("Unknown QR")).toBeVisible();
  await page.goto("/nowhere-at-all");
  await expect(page.getByText("Off the map")).toBeVisible();
});
