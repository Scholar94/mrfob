import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const read = file => fs.readFileSync(file, "utf8");
const requiredFiles = [
  "src/App.jsx", "src/Portal.jsx", "src/InstituteWorkspace.jsx",
  "src/googleDrive.js", "src/FabricCatalogue.jsx", "src/CustomerBenefits.jsx",
  "src/ReferralProgramme.jsx", "src/CorporateOrderRequests.jsx",
  "src/PortalErrorBoundary.jsx", "src/PrivacyRequestCenter.jsx", "src/NewsletterSignup.jsx", "src/PublicRoutePage.jsx", "src/WelcomeExperience.jsx", "src/FAQManager.jsx", "src/StyleRecommendations.jsx", "src/RefundManagement.jsx", "src/auditLog.js", "src/AuditLogViewer.jsx", "firestore.rules", "public/404.html",
  "public/sw.js", "public/manifest.webmanifest", "public/offline.html",
  "docs/MASTER-PROMPT-TRACEABILITY.md", "docs/QA-TEST-PLAN.md", "scripts/verify-firestore-rules.mjs", "scripts/smoke-test.mjs"
];
for (const file of requiredFiles) assert.ok(fs.existsSync(file), `Missing required platform file: ${file}`);

const app = read("src/App.jsx");
const portal = read("src/Portal.jsx");
const rules = read("firestore.rules");
const drive = read("src/googleDrive.js");
const institute = read("src/InstituteWorkspace.jsx");
const fallback = read("public/404.html");
const traceability = read("docs/MASTER-PROMPT-TRACEABILITY.md");
const manifest = JSON.parse(read("public/manifest.webmanifest"));
const sitemap = read("public/sitemap.xml");
const pkg = JSON.parse(read("package.json"));

const ruleStructure = (() => {
  const stack = [];
  let quote = null, escaped = false;
  const pairs = { "(": ")", "{": "}", "[": "]" };
  for (let i = 0; i < rules.length; i++) {
    const ch = rules[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch.charCodeAt(0) === 92) escaped = true;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"') { quote = ch; continue; }
    if (ch in pairs) stack.push({ ch, index: i });
    else if (Object.values(pairs).includes(ch)) {
      const previous = stack.pop();
      assert.ok(previous, `Unexpected closing delimiter ${ch} in firestore.rules at ${i}`);
      assert.equal(pairs[previous.ch], ch, `Mismatched delimiter in firestore.rules at ${i}`);
    }
  }
  assert.equal(quote, null, "Unclosed string literal in firestore.rules");
  assert.equal(stack.length, 0, "Unclosed bracket or block in firestore.rules");
  return true;
})();
for (const collectionName of ["referralClaims", "fabrics", "privacyRequests", "refunds", "auditLogs", "products"]) {
  assert.equal(rules.split(`match /${collectionName}/`).length - 1, 1, `Firestore collection rule must appear exactly once: ${collectionName}`);
}
assert.equal(rules.split("match /{document=**}").length - 1, 1, "Firestore catch-all deny rule must appear exactly once");
assert.ok(ruleStructure, "Firestore rule structure check failed");
assert.ok(read("firebase.json").includes('"firestore": {'), "Firestore Emulator configuration is missing");


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
for (const slug of ["men", "women", "bridal", "traditional", "corporate"]) {
  assert.ok(app.includes(`"/collections/${slug}": ["collection-${slug}"`), `Collection route does not target its category panel: ${slug}`);
}
assert.ok(app.includes('id={"collection-" + group.slug}'), "Collection category panels are missing their deep-link IDs");
assert.ok(app.includes('"/courses": ["courses"') && app.includes('"/admissions": ["admissions"') && app.includes('id="courses"') && app.includes('id="admissions"'), "Course and admissions routes do not target their own sections");

assert.ok(app.includes('get("__route")'), "GitHub Pages fallback query is not consumed");
assert.ok(app.includes("PublicRoutePage") && app.includes("setStandalonePage") && app.includes("standalonePage"), "Standalone public route layouts are not mounted");
assert.ok(read("src/PublicRoutePage.jsx").includes("standalone-whatsapp-float"), "Floating WhatsApp contact is missing from standalone public pages");
assert.ok(app.includes("<WelcomeExperience/>") && read("src/WelcomeExperience.jsx").includes("Explore the experience"), "First-visit homepage welcome experience is missing");



assert.ok(portal.includes("initialSection"), "Account portal does not accept deep-link section selection");
assert.ok(portal.includes("initialRouteHandledRef"), "Account deep-link scroll guard is missing");
for (const routeTarget of ["customer-dashboard","customer-profile","customer-orders","customer-new-order","customer-measurements","customer-ai-measurement","customer-appointments","customer-payments","customer-notifications","customer-support","student-dashboard","student-profile","student-courses","student-lessons","student-assignments","student-attendance","student-results","admin-dashboard","admin-customers","admin-orders","admin-measurements","admin-appointments","admin-production","admin-quotations","admin-payments","admin-invoices","admin-designers","admin-fashion-gallery","admin-fabrics","admin-courses","admin-training-windows","admin-applications","admin-students","admin-instructors","admin-media","admin-reports","admin-settings","admin-users","admin-audit-logs"]) {
  assert.ok(portal.includes(`"${routeTarget}":`), `Account route target is missing: ${routeTarget}`);
}

assert.ok(fallback.includes("__route="), "GitHub Pages 404 fallback does not preserve the requested route");
assert.ok(manifest.start_url === "/mrfob/" && manifest.scope === "/mrfob/", "PWA manifest base path is incorrect");
assert.ok(read("index.html").includes("application/ld+json"), "Structured business metadata is missing");
for (const route of ["/about", "/collections", "/collections/men", "/collections/women", "/collections/bridal", "/collections/traditional", "/collections/corporate", "/fabric-gallery", "/fashion-institute", "/courses", "/admissions", "/contact", "/faq"]) {
  assert.ok(sitemap.includes("https://scholar94.github.io/mrfob" + route), `Public route is missing from sitemap: ${route}`);
}
assert.ok(!sitemap.includes("/customer/") && !sitemap.includes("/admin/") && !sitemap.includes("/student/"), "Private account routes must not be indexed in sitemap");
assert.ok(read("public/robots.txt").includes("sitemap.xml"), "Robots file does not reference the sitemap");
assert.ok(traceability.includes("24-section master-prompt traceability register"), "24-section traceability register is missing");
assert.ok(read("docs/QA-TEST-PLAN.md").includes("T22"), "Final acceptance test plan is missing.");
assert.ok(drive.includes("uploadFileToGoogleDrive"), "Google Drive upload integration is missing");
assert.ok(rules.includes("match /{document=**} { allow read, write: if false; }"), "Firestore catch-all deny rule is missing");
assert.ok(rules.includes("match /auditLogs/{auditId}"), "Append-only audit log rules are missing");
assert.ok(rules.includes("match /publicFAQs/{faqId}") && portal.includes("FAQManager"), "Public FAQ management is missing");
assert.ok(portal.includes("AuditLogViewer"), "Super Admin audit viewer is not mounted");
assert.ok(institute.includes("withdrawEnrollment") && institute.includes("revokeDriveFileAccessForEmail"), "Institute withdrawal and Drive revocation workflow is missing");
assert.ok(rules.includes("enrollmentStatus") && rules.includes("institute_enrollment_withdrawn"), "Withdrawn enrolments are not blocked by Firestore access rules");
assert.ok(rules.includes("hasPaidEnrollmentForStudent(request.resource.data.courseId, request.resource.data.studentUid)") && rules.includes("hasPaidEnrollmentForStudent(resource.data.courseId, resource.data.studentUid)"), "Withdrawn learners can still receive attendance, completion approval or certificates.");
assert.ok(read("scripts/verify-firestore-rules.mjs").includes("Institute withdrawal"), "Institute withdrawal security test is missing");
assert.ok(portal.includes("RefundManagement"), "Refund management workflow is not mounted");
assert.ok(portal.includes("verifiedOrderPaymentsTotal") && portal.includes("outstandingQuotedBalanceTotal") && portal.includes("newCustomerCount30Days"), "Super Admin dashboard KPI summaries are missing");
assert.ok(rules.includes("match /refunds/{refundId}") && rules.includes("refund_status_updated"), "Refund rules and audit event are missing");
assert.ok(rules.includes("refundId == request.resource.data.paymentId") && read("src/RefundManagement.jsx").includes('setDoc(doc(db, "refunds", selectedPayment.id)'), "Refund requests must be unique per verified payment.");
assert.ok(portal.includes("galleryImages") && portal.includes("availableColors") && portal.includes("fabricOptions") && portal.includes("customizationOptions"), "Product gallery and customisation fields are missing");
assert.ok(rules.includes("galleryImages") && rules.includes("availableColors") && rules.includes("fabricOptions") && rules.includes("customizationOptions"), "Product gallery fields are not protected by Firestore rules");
assert.ok(app.includes("StyleRecommendations") && app.includes("createWhatsAppLink={whatsappLink}"), "Public style recommendation tool is not mounted");
assert.ok(app.includes("FabricCatalogue") && app.includes("<FabricCatalogue />"), "Public fabric gallery is not mounted");
assert.ok(portal.includes("FabricCatalogue admin"), "Super Admin fabric management is not mounted");
assert.ok(portal.includes("PrivacyRequestCenter"), "Customer privacy request centre is not mounted");
assert.ok(rules.includes("match /fabrics/{fabricId}") && rules.includes("match /privacyRequests/{requestId}"), "Fabric/privacy Firestore rules are missing");
assert.ok(portal.includes("transaction.delete(oldSlotRefs[index])") && portal.includes("reserveAppointmentSlot(transaction, current, current.proposedDate, current.proposedTime)") && portal.includes("legacyAppointmentSlotId"), "Appointment alternative slot release/reservation and legacy migration are not transactional");
assert.ok(read("src/styles.css").includes(".style-recommendation-layout") && read("src/styles.css").includes(".fabric-grid"), "Responsive style/fabric UI styles are missing");

assert.ok(read("src/StyleRecommendations.jsx").includes("YOUR STARTING IDEAS"), "Style recommendation experience is missing");
assert.ok(read("src/RefundManagement.jsx").includes("paidRefundTotal") && read("src/RefundManagement.jsx").includes("openRefundTotal"), "Finance refund exposure summary is missing");
assert.ok(app.includes("<NewsletterSignup />"), "Public newsletter sign-up is not mounted");
assert.ok(read("src/NewsletterSignup.jsx").includes("crypto.subtle.digest") && read("src/NewsletterSignup.jsx").includes("setDoc") && read("src/NewsletterSignup.jsx").includes("changeSubscriptionStatus") && read("src/NewsletterSignup.jsx").includes("updateDoc"), "Newsletter duplicate protection or preference management is missing");
assert.ok(rules.includes("match /newsletterSubscribers/{subscriberId}") && rules.includes("allow read: if isSuperAdmin();"), "Newsletter subscriber privacy rules are missing");
assert.ok(read("src/googleDrive.js").includes('doc(db, "publicSettings", "driveIntegration")') && read("src/googleDrive.js").includes("getDriveConfig"), "Runtime Google Drive configuration fallback is missing");
assert.ok(portal.includes("driveIntegrationDraft") && portal.includes("saveDriveIntegration"), "Super Admin Drive integration settings panel is missing");
assert.ok(rules.includes("settingId == 'driveIntegration'") && rules.includes("request.resource.data.updatedBy == request.auth.uid"), "Google Drive integration write rules are missing");

assert.ok(read(".github/workflows/deploy.yml").includes("playwright install --with-deps chromium") && read(".github/workflows/deploy.yml").includes("node scripts/smoke-test.mjs"), "Browser smoke tests are not wired into deployment CI");


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
