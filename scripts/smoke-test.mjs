import assert from "node:assert/strict";
import { chromium } from "playwright";

const base = process.env.SMOKE_BASE_URL || "http://127.0.0.1:4173/mrfob";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const pageErrors = [];
page.on("pageerror", error => pageErrors.push(error.message));

try {
  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  const welcomeDialog = page.locator(".welcome-experience");
  if (await welcomeDialog.isVisible().catch(() => false)) {
    await welcomeDialog.getByRole("button", { name: /Explore the experience/i }).click();
    await welcomeDialog.waitFor({ state: "hidden" });
  }
  await page.locator(".hero h1").waitFor({ state: "visible", timeout: 15000 });
  assert.ok((await page.locator(".hero h1").innerText()).trim().length > 0, "Homepage hero heading is empty");
  await page.waitForLoadState("load");
  const manifest = await page.evaluate(async () => {
    const href = document.querySelector('link[rel="manifest"]')?.href;
    if (!href) return null;
    const response = await fetch(href);
    return response.ok ? response.json() : null;
  });
  assert.equal(manifest?.start_url, "/mrfob/", "PWA manifest start URL is incorrect");
  assert.equal(manifest?.scope, "/mrfob/", "PWA manifest scope is incorrect");
  await page.waitForFunction(async () => Boolean(await navigator.serviceWorker?.getRegistration("/mrfob/")), null, { timeout: 15000 });
  const serviceWorkerScope = await page.evaluate(async () => (await navigator.serviceWorker.getRegistration("/mrfob/"))?.scope || "");
  assert.ok(serviceWorkerScope.endsWith("/mrfob/"), "PWA service worker was not registered at the GitHub Pages base path");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller), null, { timeout: 15000 });
  await page.context().setOffline(true);
  await page.goto(base + "/offline-smoke-test", { waitUntil: "domcontentloaded" });
  assert.match(await page.locator("body").innerText(), /You’re currently offline/i, "Offline navigation did not serve the cached offline page");
  await page.context().setOffline(false);



  const publicRoutes = [
    "/about", "/collections", "/collections/men", "/collections/women",
    "/collections/bridal", "/collections/traditional", "/collections/corporate",
    "/fabric-gallery", "/fashion-institute", "/courses", "/admissions",
    "/contact", "/faq"
  ];
  for (const route of publicRoutes) {
    await page.goto(base + route, { waitUntil: "domcontentloaded" });
    await page.locator(".standalone-hero h1").waitFor({ state: "visible", timeout: 15000 });
    assert.ok((await page.locator(".standalone-hero h1").innerText()).trim().length > 0, `Route did not render a heading: ${route}`);
    if (route === "/about") {
      const metadata = await page.evaluate(() => ({
        title: document.title,
        description: document.querySelector('meta[name="description"]')?.content || "",
        canonical: document.querySelector('link[rel="canonical"]')?.href || "",
        robots: document.querySelector('meta[name="robots"]')?.content || ""
      }));
      assert.match(metadata.title, /About/i, "Route-specific document title was not set");
      assert.ok(metadata.description.length > 40, "Route-specific meta description is missing");
      assert.ok(metadata.canonical.endsWith("/mrfob/about"), "Canonical URL does not match the current public route");
      assert.match(metadata.robots, /index,follow/i, "Public route should remain indexable");
    }
  }

  await page.goto(base + "/privacy", { waitUntil: "domcontentloaded" });
  await page.locator(".policy-modal").waitFor({ state: "visible", timeout: 15000 });
  assert.match(await page.locator(".policy-modal h2").innerText(), /Privacy/i, "Privacy route did not render legal content");

  await page.goto(base + "/terms", { waitUntil: "domcontentloaded" });
  await page.locator(".policy-modal").waitFor({ state: "visible", timeout: 15000 });
  assert.match(await page.locator(".policy-modal h2").innerText(), /Terms/i, "Terms route did not render legal content");

  await page.goto(base + "/register", { waitUntil: "domcontentloaded" });
  const registrationPortal = page.locator(".portal-card");
  await registrationPortal.getByText("Create your customer account", { exact: true }).waitFor({ state: "visible", timeout: 20000 });
  await registrationPortal.locator('input[type="email"]').waitFor({ state: "visible" });

  await page.goto(base + "/login", { waitUntil: "domcontentloaded" });
  const portal = page.locator(".portal-card");
  await portal.waitFor({ state: "visible", timeout: 20000 });
  await portal.getByText("Welcome back", { exact: true }).waitFor({ state: "visible", timeout: 15000 });
  assert.equal(await page.locator(".welcome-experience").count(), 0, "Homepage welcome overlay must not block the account login page");
  await portal.locator('input[type="email"]').waitFor({ state: "visible" });
  await portal.locator('input[type="password"]').waitFor({ state: "visible" });
  const accountRobots = await page.locator('meta[name="robots"]').getAttribute("content");
  assert.match(accountRobots || "", /noindex,nofollow/i, "Private account route should not be indexed");
  for (const route of ["/customer/orders", "/student/lessons", "/admin/audit-logs"]) {
    await page.goto(base + route, { waitUntil: "domcontentloaded" });
    const protectedPortal = page.locator(".portal-card");
    await protectedPortal.getByText("Welcome back", { exact: true }).waitFor({ state: "visible", timeout: 20000 });
    assert.ok((await protectedPortal.innerText()).trim().length > 60, `Protected route did not open the account portal: ${route}`);
  }
  assert.ok((await portal.innerText()).trim().length > 80, "Account portal rendered an empty/blank panel");

  assert.deepEqual(pageErrors, [], "Browser runtime errors were detected during public/account route smoke tests");
  process.stdout.write("Browser smoke tests passed: homepage, PWA manifest/service worker, standalone public/legal routes and account registration/login portals.\n");
} finally {
  await browser.close();
}
