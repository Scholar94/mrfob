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
  for (const width of [390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth
    }));
    assert.ok(dimensions.content <= dimensions.viewport + 1, `Homepage horizontal overflow at ${width}px: content ${dimensions.content}px, viewport ${dimensions.viewport}px`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
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

  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  const styleForm = page.locator(".style-preference-form");
  await styleForm.locator("select").nth(0).selectOption("Wedding");
  await styleForm.locator("select").nth(1).selectOption("bridal");
  await styleForm.locator("select").nth(2).selectOption("Reception dress");
  await styleForm.locator("select").nth(3).selectOption("Wine / burgundy");
  await styleForm.locator("select").nth(4).selectOption("Luxury and formal");
  await styleForm.locator("select").nth(5).selectOption("Above ₦500,000");
  await styleForm.locator("textarea").fill("Embroidered lace with pearl details");
  const styleSummary = await page.locator(".style-suggestion-summary").innerText();
  for (const expected of ["Wedding", "Reception dress", "Wine / burgundy", "Above ₦500,000"]) {
    assert.ok(styleSummary.includes(expected), `Style summary did not include selected preference: ${expected}`);
  }
  assert.equal(await page.locator(".style-suggestion-card").count(), 3, "Style recommender must show three starting ideas");
  const consultationHref = await page.locator(".style-consult-link").getAttribute("href");
  assert.ok(consultationHref, "Style recommender consultation link is missing");
  const consultationBrief = new URL(consultationHref).searchParams.get("text") || "";
  for (const expected of ["Occasion: Wedding", "Category: bridal", "Garment: Reception dress", "Preferred colour: Wine / burgundy", "Style: Luxury and formal", "Budget: Above ₦500,000", "Embroidered lace with pearl details"]) {
    assert.ok(consultationBrief.includes(expected), `WhatsApp consultation brief omitted selected preference: ${expected}`);
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
  const protectedRoutes = [
    "/customer/dashboard", "/customer/profile", "/customer/orders", "/customer/new-order",
    "/customer/measurements", "/customer/ai-measurement", "/customer/appointments",
    "/customer/payments", "/customer/notifications", "/customer/support",
    "/student/dashboard", "/student/profile", "/student/courses", "/student/lessons",
    "/student/assignments", "/student/attendance", "/student/results",
    "/admin/dashboard", "/admin/customers", "/admin/orders", "/admin/measurements",
    "/admin/appointments", "/admin/production", "/admin/quotations", "/admin/payments",
    "/admin/invoices", "/admin/designers", "/admin/fashion-gallery", "/admin/fabrics",
    "/admin/courses", "/admin/training-windows", "/admin/applications", "/admin/students",
    "/admin/instructors", "/admin/media", "/admin/reports", "/admin/settings",
    "/admin/users", "/admin/audit-logs"
  ];
  for (const route of protectedRoutes) {
    await page.goto(base + route, { waitUntil: "domcontentloaded" });
    const protectedPortal = page.locator(".portal-card");
    await protectedPortal.getByText("Welcome back", { exact: true }).waitFor({ state: "visible", timeout: 20000 });
    assert.ok((await protectedPortal.innerText()).trim().length > 60, `Protected route did not open the account portal: ${route}`);
  }
  assert.ok((await portal.innerText()).trim().length > 80, "Account portal rendered an empty/blank panel");

  assert.deepEqual(pageErrors, [], "Browser runtime errors were detected during public/account route smoke tests");
  process.stdout.write("Browser smoke tests passed: responsive homepage widths, style recommender and WhatsApp brief, PWA manifest/service worker/offline fallback, standalone public/legal routes and all customer/student/admin account entry routes.\n");
} finally {
  await browser.close();
}
