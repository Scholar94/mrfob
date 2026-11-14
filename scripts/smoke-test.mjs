import assert from "node:assert/strict";
import { chromium } from "playwright";

const base = process.env.SMOKE_BASE_URL || "http://127.0.0.1:4173/mrfob";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const pageErrors = [];
page.on("pageerror", error => pageErrors.push(error.message));

try {
  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.locator(".hero h1").waitFor({ state: "visible", timeout: 15000 });
  assert.ok((await page.locator(".hero h1").innerText()).trim().length > 0, "Homepage hero heading is empty");

  await page.goto(base + "/about", { waitUntil: "domcontentloaded" });
  await page.locator(".standalone-hero h1").waitFor({ state: "visible", timeout: 15000 });
  assert.match(await page.locator(".standalone-hero h1").innerText(), /About/i, "About route did not render its standalone page");

  await page.goto(base + "/collections/men", { waitUntil: "domcontentloaded" });
  await page.locator(".standalone-hero h1").waitFor({ state: "visible", timeout: 15000 });
  assert.match(await page.locator(".standalone-hero h1").innerText(), /menswear/i, "Collection route did not render");

  await page.goto(base + "/login", { waitUntil: "domcontentloaded" });
  const portal = page.locator(".portal-card");
  await portal.waitFor({ state: "visible", timeout: 20000 });
  await portal.getByText("Welcome back", { exact: true }).waitFor({ state: "visible", timeout: 15000 });
  await portal.locator('input[type="email"]').waitFor({ state: "visible" });
  await portal.locator('input[type="password"]').waitFor({ state: "visible" });
  assert.ok((await portal.innerText()).trim().length > 80, "Account portal rendered an empty/blank panel");

  assert.deepEqual(pageErrors, [], "Browser runtime errors were detected during public/account route smoke tests");
  process.stdout.write("Browser smoke tests passed: homepage, standalone public routes and account login portal.\n");
} finally {
  await browser.close();
}
