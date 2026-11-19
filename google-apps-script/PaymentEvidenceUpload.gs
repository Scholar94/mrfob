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

    // Catalogue image uploads are restricted to the Super Admin; customer receipts remain customer-only.
    var roleResponse = UrlFetchApp.fetch(
      "https://firestore.googleapis.com/v1/projects/" + encodeURIComponent(projectId) +
      "/databases/(default)/documents/roles/" + encodeURIComponent(customer.localId),
      { headers: { Authorization: "Bearer " + payload.idToken }, muteHttpExceptions: true }
    );
    if (roleResponse.getResponseCode() === 200) {
      var roleDocument = JSON.parse(roleResponse.getContentText());
      var role = roleDocument.fields && roleDocument.fields.role && roleDocument.fields.role.stringValue;
      if (payload.purpose === "catalogue_image") { if (role !== "superAdmin") throw new Error("Only the Super Admin can upload catalogue images."); } else if (role && role !== "customer") throw new Error("Only customer accounts can submit transfer evidence.");
    } else if (roleResponse.getResponseCode() === 404) { if (payload.purpose === "catalogue_image") throw new Error("Only the Super Admin can upload catalogue images."); } else {
      throw new Error("Could not verify the account type. Please try again.");
    }
    var isCatalogueImage = payload.purpose === "catalogue_image";
    var allowed = isCatalogueImage ? ["image/jpeg", "image/png", "image/webp"] : ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    var mimeType = String(payload.mimeType || "");
    if (allowed.indexOf(mimeType) < 0) throw new Error(isCatalogueImage ? "Only JPG, PNG or WebP images are accepted." : "Only JPG, PNG, WebP or PDF receipts are accepted.");
    var base64 = String(payload.fileBase64 || "");
    var limit = isCatalogueImage ? 10 * 1024 * 1024 : 15 * 1024 * 1024;
    if (!base64 || base64.length > Math.ceil(limit * 4 / 3) + 1000) throw new Error("The selected file is empty or exceeds the upload limit.");
    var bytes = Utilities.base64Decode(base64);
    if (!bytes.length || bytes.length > limit) throw new Error("The selected file exceeds the upload limit.");

    var safeName = String(payload.fileName || (isCatalogueImage ? "catalogue-image" : "payment-evidence"))
      .replace(/[\\\\/:*?"<>|]/g, "_").slice(0, 150);
    var folder = DriveApp.getFolderById(folderId);
    if (isCatalogueImage) {
      var subfolderName = String(payload.imageFolder || "Fabric Images");
      if (["Fabric Images", "Product Images"].indexOf(subfolderName) < 0) throw new Error("Invalid catalogue image folder.");
      var matches = folder.getFoldersByName(subfolderName);
      folder = matches.hasNext() ? matches.next() : folder.createFolder(subfolderName);
    }
    var blob = Utilities.newBlob(bytes, mimeType, safeName);
    var file = folder.createFile(blob);
    file.setDescription(isCatalogueImage ? "MR FOP FASHIONS catalogue image. Uploaded by Super Admin UID: " + String(customer.localId).slice(0, 128) : "MR FOP FASHIONS payment evidence. Order: " + String(payload.orderId || "").slice(0, 120) + ". Customer UID: " + String(customer.localId).slice(0, 128));
    if (isCatalogueImage) file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return htmlResult(payload.nonce, true, {
      fileId: file.getId(),
      name: file.getName(),
      mimeType: mimeType,
      size: bytes.length,
      webViewLink: "https://drive.google.com/file/d/" + file.getId() + "/view",
      previewUrl: "https://drive.google.com/uc?export=view&id=" + file.getId()
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
    "<!doctype html><html><body><script>window.top.postMessage(" +
    result + ", 'https://scholar94.github.io');</script></body></html>"
  ).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
