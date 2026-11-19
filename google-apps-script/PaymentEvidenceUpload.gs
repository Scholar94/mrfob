/**
 * MR FOP FASHIONS — Company-owned payment evidence upload endpoint.
 *
 * Deploy as a Web App:
 *   Execute as: Me
 *   Who has access: Anyone
 * Then set Script Properties:
 *   FIREBASE_PROJECT_ID = the Firebase project ID used by the website
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

    var tokenResponse = UrlFetchApp.fetch(
      "https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(payload.idToken),
      { muteHttpExceptions: true }
    );
    if (tokenResponse.getResponseCode() !== 200) throw new Error("Customer session verification failed. Please sign in again.");
    var claims = JSON.parse(tokenResponse.getContentText());
    var now = Math.floor(Date.now() / 1000);
    if (claims.aud !== projectId ||
        claims.iss !== "https://securetoken.google.com/" + projectId ||
        !claims.sub || Number(claims.exp || 0) <= now) {
      throw new Error("Customer session is invalid or expired.");
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
      ". Customer UID: " + String(claims.sub).slice(0, 128));
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
  );
}
