import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const read = file => fs.readFileSync(file, "utf8");
const requiredFiles = [
  "src/App.jsx", "src/Portal.jsx", "src/InstituteWorkspace.jsx",
  "src/googleDrive.js", "src/FabricCatalogue.jsx", "src/CustomerBenefits.jsx",
  "src/ReferralProgramme.jsx", "src/CorporateOrderRequests.jsx",
  "src/PrivacyRequestCenter.jsx", "src/FAQManager.jsx", "src/StyleRecommendations.jsx", "src/auditLog.js", "src/AuditLogViewer.jsx", "firestore.rules", "public/404.html",
  "public/sw.js", "public/manifest.webmanifest", "public/offline.html",
  "docs/MASTER-PROMPT-TRACEABILITY.md", "docs/QA-TEST-PLAN.md"
];
for (const file of requiredFiles) assert.ok(fs.existsSync(file), `Missing required platform file: ${file}`);

const app = read("src/App.jsx");
const portal = read("src/Portal.jsx");
const rules = read("firestore.rules");
const drive = read("src/googleDrive.js");
const fallback = read("public/404.html");
const traceability = read("docs/MASTER-PROMPT-TRACEABILITY.md");
const manifest = JSON.parse(read("public/manifest.webmanifest"));
const pkg = JSON.parse(read("package.json"));

for (const route of [
  "/about", "/collections", "/collections/men", "/collections/women",
  "/collections/bridal", "/collections/traditional", "/collections/corporate",
  "/fabric-gallery", "/fashion-institute", "/courses", "/admissions",
  "/contact", "/faq", "/privacy", "/terms", "/register", "/login"
]) {
  assert.ok(app.includes(route), `Route resolver is missing ${route}`);
}
assert.ok(app.includes('path.startsWith("/customer/")'), "Customer route entry is missing");
assert.ok(app.includes('path.startsWith("/student/")'), "Student route entry is missing");
assert.ok(app.includes('path.startsWith("/admin/")'), "Admin route entry is missing");
assert.ok(app.includes('get("__route")'), "GitHub Pages fallback query is not consumed");
assert.ok(portal.includes("initialSection"), "Account portal does not accept deep-link section selection");
assert.ok(portal.includes("initialRouteHandledRef"), "Account deep-link scroll guard is missing");
assert.ok(fallback.includes("__route="), "GitHub Pages 404 fallback does not preserve the requested route");
assert.ok(manifest.start_url === "/mrfob/" && manifest.scope === "/mrfob/", "PWA manifest base path is incorrect");
assert.ok(read("index.html").includes("application/ld+json"), "Structured business metadata is missing");
assert.ok(read("public/robots.txt").includes("sitemap.xml"), "Robots file does not reference the sitemap");
assert.ok(traceability.includes("24-section master-prompt traceability register"), "24-section traceability register is missing");
assert.ok(read("docs/QA-TEST-PLAN.md").includes("T22"), "Final acceptance test plan is missing.");
assert.ok(drive.includes("uploadFileToGoogleDrive"), "Google Drive upload integration is missing");
assert.ok(rules.includes("match /{document=**} { allow read, write: if false; }"), "Firestore catch-all deny rule is missing");
assert.ok(rules.includes("match /auditLogs/{auditId}"), "Append-only audit log rules are missing");
assert.ok(rules.includes("match /publicFAQs/{faqId}") && portal.includes("FAQManager"), "Public FAQ management is missing");
assert.ok(portal.includes("AuditLogViewer"), "Super Admin audit viewer is not mounted");
assert.ok(app.includes("StyleRecommendations") && app.includes("createWhatsAppLink={whatsappLink}"), "Public style recommendation tool is not mounted");
assert.ok(app.includes("FabricCatalogue") && app.includes("<FabricCatalogue />"), "Public fabric gallery is not mounted");
assert.ok(portal.includes("FabricCatalogue admin"), "Super Admin fabric management is not mounted");
assert.ok(portal.includes("PrivacyRequestCenter"), "Customer privacy request centre is not mounted");
assert.ok(rules.includes("match /fabrics/{fabricId}") && rules.includes("match /privacyRequests/{requestId}"), "Fabric/privacy Firestore rules are missing");
assert.ok(portal.includes("transaction.delete(oldSlotRef)") && portal.includes("reserveAppointmentSlot(transaction, current, current.proposedDate, current.proposedTime)"), "Appointment alternative slot release/reservation is not transactional");
assert.ok(read("src/styles.css").includes(".style-recommendation-layout") && read("src/styles.css").includes(".fabric-grid"), "Responsive style/fabric UI styles are missing");

assert.ok(read("src/StyleRecommendations.jsx").includes("YOUR STARTING IDEAS"), "Style recommendation experience is missing");
assert.ok(read("src/InstituteWorkspace.jsx").includes("institute-dashboard-summary"), "Institute role dashboards are missing");
assert.ok(rules.includes("training_payment_verified") && rules.includes("drive_lesson_access_revoked"), "Institute payment/Drive audit rules are missing");
assert.ok(rules.includes("order_production_updated") && portal.includes("order_assigned"), "Order audit instrumentation is missing");

const sourceFiles = fs.readdirSync("src").filter(file => /\.(jsx?|mjs)$/.test(file));
for (const file of sourceFiles) {
  const text = read(path.join("src", file));
  assert.ok(!/from\s+["']firebase\/(storage|functions)["']/.test(text), `Paid/ineligible Firebase service import detected in ${file}`);
  assert.ok(!/\b(getStorage|uploadBytes|getFunctions|httpsCallable)\s*\(/.test(text), `Firebase Storage/Functions API usage detected in ${file}`);
}
assert.ok(!("deploy:functions" in pkg.scripts), "Cloud Functions deployment script must not be present");
assert.ok(!("firebase-storage" in pkg.dependencies), "Firebase Storage dependency must not be present");
console.log(`Platform source checks passed: ${requiredFiles.length} required files, public/account route entry, PWA shell, Drive integration, Firestore deny-by-default and zero-cost guardrails.`);
