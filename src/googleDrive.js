const DRIVE_API = "https://www.googleapis.com/drive/v3";
let tokenClient;
let accessToken = "";
let tokenExpiresAt = 0;

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

async function getDriveToken() {
  const clientId = import.meta.env.VITE_GOOGLE_DRIVE_CLIENT_ID;
  if (!clientId) throw new Error("Google Drive is not configured. Add VITE_GOOGLE_DRIVE_CLIENT_ID.");
  if (accessToken && Date.now() < tokenExpiresAt - 60000) return accessToken;
  await loadGoogleIdentity();
  return new Promise((resolve, reject) => {
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: "https://www.googleapis.com/auth/drive",
      callback: response => {
        if (response.error || !response.access_token) {
          reject(new Error(response.error_description || response.error || "Google Drive authorization was not completed."));
          return;
        }
        accessToken = response.access_token;
        tokenExpiresAt = Date.now() + Number(response.expires_in || 3600) * 1000;
        resolve(accessToken);
      },
      error_callback: error => reject(new Error(error?.message || "Google Drive sign-in failed."))
    });
    tokenClient.requestAccessToken({ prompt: "consent" });
  });
}

async function driveRequest(path, options = {}) {
  const token = await getDriveToken();
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

export async function uploadFileToGoogleDrive(file, metadata = {}) {
  const configuredFolder = import.meta.env.VITE_GOOGLE_DRIVE_FOLDER_ID;
  if (!configuredFolder) throw new Error("Set VITE_GOOGLE_DRIVE_FOLDER_ID to the shared MR FOP FASHIONS Google Drive folder.");
  const pathParts = String(metadata.folder || "Uploads").split("/").filter(Boolean);
  let parentId = configuredFolder;
  for (const part of pathParts) parentId = await ensureDriveFolder(part, parentId);
  const safeName = String(file.name || "upload").replace(/[\\/\\?%*:|"<>]/g, "_").slice(-180);
  const fileMetadata = {
    name: safeName,
    mimeType: file.type || "application/octet-stream",
    parents: [parentId],
    description: JSON.stringify({ app: "MR FOP FASHIONS", orderId: metadata.orderId || "", uploadedBy: metadata.uploadedBy || "" })
  };
  const token = await getDriveToken();
  const session = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,mimeType,size,webViewLink,thumbnailLink", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": file.type || "application/octet-stream",
      "X-Upload-Content-Length": String(file.size)
    },
    body: JSON.stringify(fileMetadata)
  });
  if (!session.ok) {
    const detail = await session.json().catch(() => ({}));
    throw new Error(detail.error?.message || "Google Drive could not start the file upload.");
  }
  const uploadUrl = session.headers.get("Location");
  if (!uploadUrl) throw new Error("Google Drive did not return a resumable upload URL.");
  const uploadResponse = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: file
  });
  if (!uploadResponse.ok) {
    const detail = await uploadResponse.json().catch(() => ({}));
    throw new Error(detail.error?.message || "Google Drive could not finish the file upload.");
  }
  const uploaded = await uploadResponse.json();
  if (metadata.customerEmail) {
    await driveRequest("/files/" + uploaded.id + "/permissions?sendNotificationEmail=false", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "user", role: "reader", emailAddress: metadata.customerEmail })
    });
  }
  return {
    fileId: uploaded.id,
    name: uploaded.name,
    mimeType: uploaded.mimeType,
    size: Number(uploaded.size || file.size),
    webViewLink: uploaded.webViewLink || "https://drive.google.com/file/d/" + uploaded.id + "/view",
    previewUrl: "https://drive.google.com/uc?export=view&id=" + uploaded.id,
    drivePreviewUrl: "https://drive.google.com/file/d/" + uploaded.id + "/preview",
    thumbnailLink: uploaded.thumbnailLink || ""
  };
}
