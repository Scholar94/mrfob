import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase.js";

const DRIVE_API = "https://www.googleapis.com/drive/v3";
let tokenClient;
let accessToken = "";
let tokenExpiresAt = 0;
let accessTokenScope = "";
let cachedDriveConfig = null;
let cachedDriveConfigAt = 0;

export function clearGoogleDriveConfigCache() {
  cachedDriveConfig = null;
  cachedDriveConfigAt = 0;
}


async function getDriveConfig() {
  const environmentClientId = String(import.meta.env.VITE_GOOGLE_DRIVE_CLIENT_ID || "").trim();
  const environmentFolderId = String(import.meta.env.VITE_GOOGLE_DRIVE_FOLDER_ID || "").trim();
  if (environmentClientId && environmentFolderId) {
    return { clientId: environmentClientId, folderId: environmentFolderId };
  }
  if (cachedDriveConfig && Date.now() - cachedDriveConfigAt < 60000) {
    return {
      clientId: environmentClientId || cachedDriveConfig.clientId,
      folderId: environmentFolderId || cachedDriveConfig.folderId
    };
  }
  let stored = {};
  if (db) {
    try {
      const snapshot = await getDoc(doc(db, "publicSettings", "driveIntegration"));
      if (snapshot.exists()) stored = snapshot.data();
    } catch (error) {
      if (!environmentClientId) throw new Error("Google Drive settings could not be loaded. Ask the Super Admin to check the integration settings.");
    }
  }
  cachedDriveConfig = {
    clientId: environmentClientId || String(stored.clientId || "").trim(),
    folderId: environmentFolderId || String(stored.folderId || "").trim()
  };
  cachedDriveConfigAt = Date.now();
  return cachedDriveConfig;
}

function loadGoogleIdentity() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) return resolve();
    const existing = document.querySelector('script[data-google-identity="true"]');
    if (existing) {
      existing.addEventListener("load", resolve, { once: true });
      existing.addEventListener("error", reject, { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.dataset.googleIdentity = "true";
    script.onload = resolve;
    script.onerror = () => reject(new Error("Google sign-in could not be loaded."));
    document.head.appendChild(script);
  });
}

async function getDriveToken(scope = "https://www.googleapis.com/auth/drive") {
  const { clientId } = await getDriveConfig();
  if (!clientId) throw new Error("Google Drive is not configured. A Super Admin must save the Google OAuth Web Client ID in Integration Settings.");
  if (accessToken && accessTokenScope === scope && Date.now() < tokenExpiresAt - 60000) return accessToken;
  await loadGoogleIdentity();
  return new Promise((resolve, reject) => {
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope,
      callback: response => {
        if (response.error || !response.access_token) {
          reject(new Error(response.error_description || response.error || "Google Drive authorization was not completed."));
          return;
        }
        accessToken = response.access_token;
        accessTokenScope = scope;
        tokenExpiresAt = Date.now() + Number(response.expires_in || 3600) * 1000;
        resolve(accessToken);
      },
      error_callback: error => reject(new Error(error?.message || "Google Drive sign-in failed."))
    });
    tokenClient.requestAccessToken({ prompt: "consent" });
  });
}

async function driveRequest(path, options = {}, scope = "https://www.googleapis.com/auth/drive") {
  const token = await getDriveToken(scope);
  const response = await fetch(DRIVE_API + path, {
    ...options,
    headers: { Authorization: "Bearer " + token, ...(options.headers || {}) }
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error?.message || "Google Drive request failed (" + response.status + ").");
  }
  return response.status === 204 ? null : response.json();
}

async function ensureDriveFolder(name, parentId) {
  const q = encodeURIComponent("name='" + name.replace(/'/g, "\\'") + "' and mimeType='application/vnd.google-apps.folder' and trashed=false" + (parentId ? " and '" + parentId + "' in parents" : ""));
  const found = await driveRequest("/files?q=" + q + "&fields=files(id,name)&pageSize=10");
  if (found.files?.length) return found.files[0].id;
  const created = await driveRequest("/files?fields=id,name", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, mimeType: "application/vnd.google-apps.folder", ...(parentId ? { parents: [parentId] } : {}) })
  });
  return created.id;
}

async function uploadToCompanyDrive(file, metadata = {}) {
  const endpoint = String(import.meta.env.VITE_GOOGLE_DRIVE_UPLOAD_URL || "").trim();
  if (!endpoint || !/^https:\/\/script\.google\.com\/macros\/s\//.test(endpoint)) throw new Error("Company Google Drive upload is not configured. Contact the MR FOP Super Admin.");
  if (!metadata.idToken) throw new Error("Your MR FOP session could not be verified. Please sign in again.");
  if (!file || !file.size) throw new Error("Choose a file before uploading.");
  const limit = metadata.purpose === "payment_evidence" || metadata.purpose === "customer_reference" ? 15 : metadata.purpose === "catalogue_image" ? 10 : 20;
  if (file.size > limit * 1024 * 1024) throw new Error("This upload must be " + limit + " MB or smaller.");
  const nonce = crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(36).slice(2);
  const fileBase64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || "").split(",")[1] || "");
    reader.onerror = () => reject(new Error("Could not read the selected file."));
    reader.readAsDataURL(file);
  });
  const payload = {
    nonce, idToken: metadata.idToken, projectId: String(import.meta.env.VITE_FIREBASE_PROJECT_ID || ""),
    purpose: metadata.purpose || "staff_upload", fileName: String(file.name || "upload").slice(0, 180),
    mimeType: file.type || "application/octet-stream", fileBase64, folder: String(metadata.folder || ""),
    orderId: String(metadata.orderId || ""), customerEmail: String(metadata.customerEmail || ""), visibility: metadata.visibility === "public" ? "public" : "private",
    shareWithEmails: [...(Array.isArray(metadata.shareWithEmails) ? metadata.shareWithEmails : []), metadata.shareWithEmail].filter(Boolean),
    imageFolder: metadata.imageFolder === "Product Images" ? "Product Images" : "Fabric Images"
  };
  return new Promise((resolve, reject) => {
    const iframe = document.createElement("iframe"), form = document.createElement("form"), field = document.createElement("input");
    let settled = false;
    const timer = window.setTimeout(() => finish(new Error("Company Drive upload timed out. Please try again.")), 180000);
    function finish(error, result) {
      if (settled) return;
      settled = true; window.clearTimeout(timer); window.removeEventListener("message", onMessage); form.remove(); iframe.remove();
      if (error) reject(error); else resolve(result);
    }
    function onMessage(event) {
      if (event.data?.type !== "MRFOP_DRIVE_UPLOAD" || event.data?.nonce !== nonce) return;
      if (!event.data.ok) finish(new Error(event.data.error || "Company Drive upload failed."));
      else finish(null, event.data.file);
    }
    iframe.name = "mrfop-drive-upload-" + nonce; iframe.style.display = "none";
    form.method = "POST"; form.action = endpoint; form.target = iframe.name; form.enctype = "application/x-www-form-urlencoded";
    field.type = "hidden"; field.name = "payload"; field.value = JSON.stringify(payload);
    form.appendChild(field); window.addEventListener("message", onMessage); document.body.append(iframe, form); form.submit();
  });
}

export async function uploadFileToGoogleDrive(file, metadata = {}) {
  return uploadToCompanyDrive(file, { ...metadata, purpose: metadata.storageOwner === "customer" ? "customer_reference" : "staff_upload" });
}

export async function setDriveFilePublic(fileId, isPublic) {
  if (!fileId) throw new Error("A Google Drive file ID is required.");
  const permissions = await driveRequest("/files/" + encodeURIComponent(fileId) + "/permissions?fields=permissions(id,type,role)");
  const anyone = (permissions.permissions || []).find(permission => permission.type === "anyone");
  if (isPublic && !anyone) {
    await driveRequest("/files/" + encodeURIComponent(fileId) + "/permissions?sendNotificationEmail=false", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "anyone", role: "reader" })
    });
  } else if (!isPublic && anyone) {
    await driveRequest("/files/" + encodeURIComponent(fileId) + "/permissions/" + encodeURIComponent(anyone.id), { method: "DELETE" });
  }
}


export async function shareDriveFileWithEmail(fileId, emailAddress, scope = "https://www.googleapis.com/auth/drive") {
  const id = String(fileId || "").trim();
  const email = String(emailAddress || "").trim().toLowerCase();
  if (!id || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("A valid Drive file ID and student email are required.");
  }
  const existing = await driveRequest(
    "/files/" + encodeURIComponent(id) + "/permissions?fields=permissions(id,type,role,emailAddress)",
    {},
    scope
  );
  if ((existing.permissions || []).some(permission =>
    permission.type === "user" && String(permission.emailAddress || "").toLowerCase() === email && permission.role === "reader"
  )) return;
  await driveRequest("/files/" + encodeURIComponent(id) + "/permissions?sendNotificationEmail=false", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "user", role: "reader", emailAddress: email })
  }, scope);
}


/**
 * Removes direct user permissions for one email from a list of lesson files.
 * Inherited permissions are intentionally left untouched because Drive does
 * not allow an inherited permission to be removed at the child file.
 */
export async function revokeDriveFileAccessForEmail(fileIds, emailAddress) {
  const email = String(emailAddress || "").trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("A valid student email is required to revoke Drive access.");
  }
  const ids = [...new Set((Array.isArray(fileIds) ? fileIds : [fileIds]).map(value => String(value || "").trim()).filter(Boolean))];
  let revoked = 0;
  let skippedInherited = 0;
  for (const id of ids) {
    let pageToken = "";
    do {
      const params = new URLSearchParams({ fields: "nextPageToken,permissions(id,type,role,emailAddress,permissionDetails(inherited))", pageSize: "100" });
      if (pageToken) params.set("pageToken", pageToken);
      const result = await driveRequest("/files/" + encodeURIComponent(id) + "/permissions?" + params.toString());
      const matches = (result.permissions || []).filter(permission =>
        permission.type === "user" &&
        String(permission.emailAddress || "").trim().toLowerCase() === email
      );
      for (const permission of matches) {
        if (permission.permissionDetails?.some(detail => detail.inherited)) {
          skippedInherited += 1;
          continue;
        }
        await driveRequest("/files/" + encodeURIComponent(id) + "/permissions/" + encodeURIComponent(permission.id), { method: "DELETE" });
        revoked += 1;
      }
      pageToken = result.nextPageToken || "";
    } while (pageToken);
  }
  return { revoked, skippedInherited, filesChecked: ids.length };
}

/**
 * Upload customer payment evidence to the company's Drive via an owner-deployed
 * Google Apps Script web app. Customers authenticate only with their MR FOP account.
 * The Firebase ID token is verified by the Apps Script endpoint before Drive access.
 */
export async function uploadPaymentEvidenceToCompanyDrive(file, metadata = {}) {
  return uploadToCompanyDrive(file, { ...metadata, purpose: "payment_evidence" });
}

export async function uploadCatalogueImageToCompanyDrive(file, metadata = {}) {
  return uploadToCompanyDrive(file, { ...metadata, purpose: "catalogue_image" });
}
