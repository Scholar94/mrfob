const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");

initializeApp();
const bootstrapSecret = defineSecret("MRFOP_SUPER_ADMIN_BOOTSTRAP_SECRET");

exports.bootstrapSuperAdmin = onCall({ secrets: [bootstrapSecret] }, async request => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in before bootstrapping the Super Admin account.");
  if (request.auth.token.superAdmin === true) return { success: true, message: "This account is already a Super Admin." };
  const provided = String(request.data?.bootstrapSecret || "");
  if (!provided || provided !== bootstrapSecret.value()) throw new HttpsError("permission-denied", "Invalid one-time bootstrap secret.");
  const user = await getAuth().getUser(request.auth.uid);
  await getAuth().setCustomUserClaims(user.uid, { ...user.customClaims, superAdmin: true });
  return { success: true, message: "Super Admin access assigned. Sign out and sign in again to refresh your permissions." };
});

exports.setStaffRole = onCall(async request => {
  if (!request.auth || request.auth.token.superAdmin !== true) throw new HttpsError("permission-denied", "Only the Super Admin can manage staff permissions.");
  const email = String(request.data?.email || "").trim().toLowerCase();
  const staffRole = String(request.data?.staffRole || "");
  const allowed = ["manager", "sales", "tailor", "institute"];
  if (!email || !allowed.includes(staffRole)) throw new HttpsError("invalid-argument", "Provide a valid staff email and permission level.");
  let user;
  try { user = await getAuth().getUserByEmail(email); }
  catch { throw new HttpsError("not-found", "No registered Firebase user was found for that email. Ask the staff member to register first."); }
  await getAuth().setCustomUserClaims(user.uid, { ...user.customClaims, staffRole, superAdmin: false });
  return { success: true, uid: user.uid, staffRole };
});
