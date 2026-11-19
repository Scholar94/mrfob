/**
 * MR FOP FASHIONS — Company-owned payment evidence upload endpoint.
 *
 * Deploy as a Web App:
 *   Execute as: Me
 *   Who has access: Anyone
 * Then set Script Properties:
 *   FIREBASE_PROJECT_ID = the Firebase project ID used by the website
 *   FIREBASE_API_KEY = the Firebase Web API key (same project as the website)
 *   DRIVE_FOLDER_ID = the private company Drive folder ID for payment receipts
 *
 * Customers do NOT need Google accounts. Their Firebase ID token is verified
 * against Firebase Secure Token before a file is written to the owner's Drive.
 */
function doPost(e) {
  var payload;
  try {
    payload = JSON.parse((e && e.parameter && e.parameter.payload) || "{}");
    var props = PropertiesService.getScriptProperties();
    var projectId = props.getProperty("FIREBASE_PROJECT_ID");
    var folderId = props.getProperty("DRIVE_FOLDER_ID");
    if (!projectId || !folderId) throw new Error("The company upload service has not been configured.");
    if (payload.projectId !== projectId) throw new Error("Invalid application project.");
    if (!payload.idToken) throw new Error("Customer sign-in is required.");

    var apiKey = props.getProperty("FIREBASE_API_KEY");
    if (!apiKey) throw new Error("The company upload service has not been fully configured.");
    var tokenCheck = UrlFetchApp.fetch(
      "https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=" + encodeURIComponent(apiKey),
      {
        method: "post",
        contentType: "application/json",
        payload: JSON.stringify({ idToken: payload.idToken }),
        muteHttpExceptions: true
      }
    );
    if (tokenCheck.getResponseCode() !== 200) throw new Error("Customer session verification failed. Please sign in again.");
    var tokenData = JSON.parse(tokenCheck.getContentText());
    var customer = tokenData.users && tokenData.users[0];
    if (!customer || !customer.localId) throw new Error("Customer session is invalid or expired.");

    // Confirm the Firebase account has no staff role. Missing role document means customer.
    var roleResponse = UrlFetchApp.fetch(
      "https://firestore.googleapis.com/v1/projects/" + encodeURIComponent(projectId) +
      "/databases/(default)/documents/roles/" + encodeURIComponent(customer.localId),
      { headers: { Authorization: "Bearer " + payload.idToken }, muteHttpExceptions: true }
    );
    if (roleResponse.getResponseCode() === 200) {
      var roleDocument = JSON.parse(roleResponse.getContentText());
      var role = roleDocument.fields && roleDocument.fields.role && roleDocument.fields.role.stringValue;
      if (role && role !== "customer") throw new Error("Only customer accounts can submit transfer evidence.");
    } else if (roleResponse.getResponseCode() !== 404) {
      throw new Error("Could not verify the account type. Please try again.");
    }

    var allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    var mimeType = String(payload.mimeType || "");
    if (allowed.indexOf(mimeType) < 0) throw new Error("Only JPG, PNG, WebP or PDF receipts are accepted.");
    var base64 = String(payload.fileBase64 || "");
    if (!base64 || base64.length > 21 * 1024 * 1024) throw new Error("Receipt is empty or exceeds the 15 MB limit.");
    var bytes = Utilities.base64Decode(base64);
    if (!bytes.length || bytes.length > 15 * 1024 * 1024) throw new Error("Receipt exceeds the 15 MB limit.");

    var safeName = String(payload.fileName || "payment-evidence")
      .replace(/[\\\\/:*?"<>|]/g, "_").slice(0, 150);
    var folder = DriveApp.getFolderById(folderId);
    var blob = Utilities.newBlob(bytes, mimeType, safeName);
    var file = folder.createFile(blob);
    file.setDescription("MR FOP FASHIONS payment evidence. Order: " +
      String(payload.orderId || "").slice(0, 120) +
      ". Customer UID: " + String(customer.localId).slice(0, 128));
    return htmlResult(payload.nonce, true, {
      fileId: file.getId(),
      name: file.getName(),
      mimeType: mimeType,
      size: bytes.length,
      webViewLink: "https://drive.google.com/file/d/" + file.getId() + "/view"
    }, "");
  } catch (err) {
    return htmlResult(payload && payload.nonce, false, null,
      err && err.message ? err.message : "Receipt upload failed.");
  }
}

function htmlResult(nonce, ok, file, error) {
  var result = JSON.stringify({
    type: "MRFOP_DRIVE_UPLOAD",
    nonce: String(nonce || ""),
    ok: Boolean(ok),
    file: file || null,
    error: String(error || "")
  }).replace(/</g, "\\u003c");
  return HtmlService.createHtmlOutput(
    "<!doctype html><html><body><script>parent.postMessage(" +
    result + ", '*');</script></body></html>"
  ).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
