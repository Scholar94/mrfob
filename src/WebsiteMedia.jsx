import React, { useEffect, useState } from "react";
import { addDoc, collection, deleteDoc, doc, getDocs, query, serverTimestamp, where } from "firebase/firestore";
import { db } from "./firebase.js";
import { setDriveFilePublic, uploadFileToGoogleDrive } from "./googleDrive.js";

const MAX_IMAGE = 20 * 1024 * 1024;
const MAX_VIDEO = 100 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp", "video/mp4", "video/webm", "video/quicktime"];

function MediaCard({ item }) {
  const video = item.mediaType === "video";
  return <article className="site-media-card">
    {video ? <iframe src={item.drivePreviewUrl} title={item.title} allow="autoplay; encrypted-media" allowFullScreen loading="lazy"/> : <img src={item.previewUrl} alt={item.title} loading="lazy"/>}
    <div><h3>{item.title}</h3>{item.description && <p>{item.description}</p>}<small>{item.category}</small></div>
  </article>;
}

export function PublicWebsiteMedia() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    getDocs(query(collection(db, "siteMedia"), where("published", "==", true), where("visibility", "==", "public")))
      .then(snapshot => { if (active) setItems(snapshot.docs.map(item => ({ id: item.id, ...item.data() })).sort((a,b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0))); })
      .catch(() => { if (active) setItems([]); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  if (loading || !items.length) return null;
  return <section className="site-media-section section-pad" id="latest-from-mrfop">
    <div className="section-heading"><div><p className="eyebrow">THE LATEST FROM MR FOP</p><h2>Made to be <em>seen.</em></h2></div><p>Explore our latest designs, fashion stories and company highlights.</p></div>
    <div className="site-media-grid">{items.map(item => <MediaCard key={item.id} item={item}/>)}</div>
  </section>;
}

export default function WebsiteMediaManager({ user }) {
  const [items, setItems] = useState([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Collections");
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  async function refresh() {
    const snapshot = await getDocs(collection(db, "siteMedia"));
    setItems(snapshot.docs.map(item => ({ id: item.id, ...item.data() })).sort((a,b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0)));
  }
  useEffect(() => { refresh().catch(err => setError(err.message)); }, []);
  async function upload(event) {
    event.preventDefault();
    if (!file) { setError("Choose an image or video first."); return; }
    const video = file.type.startsWith("video/");
    if (!TYPES.includes(file.type)) { setError("Use JPG, PNG, WebP, MP4, WebM or MOV."); return; }
    if (file.size > (video ? MAX_VIDEO : MAX_IMAGE)) { setError(video ? "Videos must be 100 MB or smaller." : "Images must be 20 MB or smaller."); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      const uploaded = await uploadFileToGoogleDrive(file, { folder: "Website Media", uploadedBy: user.uid, visibility: "public" });
      const id = await addDoc(collection(db, "siteMedia"), {
        title: title.trim(), description: description.trim(), category, mediaType: video ? "video" : "image",
        fileName: uploaded.name, contentType: uploaded.mimeType, size: uploaded.size, driveFileId: uploaded.fileId,
        driveUrl: uploaded.webViewLink, previewUrl: uploaded.previewUrl, drivePreviewUrl: uploaded.drivePreviewUrl,
        visibility: "public", published: false, uploadedByUid: user.uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp()
      });
      setTitle(""); setDescription(""); setFile(null); event.currentTarget.reset();
      setNotice("Upload saved as a draft. Publish it when you are ready for public viewing.");
      await refresh();
    } catch (err) { setError(err.message || "The media could not be uploaded."); }
    finally { setBusy(false); }
  }
  async function publish(item) {
    setBusy(true); setError(""); setNotice("");
    try {
      await setDriveFilePublic(item.driveFileId, !item.published);
      const { updateDoc } = await import("firebase/firestore");
      await updateDoc(doc(db, "siteMedia", item.id), { published: !item.published, updatedAt: serverTimestamp() });
      await refresh();
      setNotice(item.published ? "Media unpublished. Public Drive access has been revoked." : "Media published and available to all website visitors.");
    } catch (err) { setError(err.message || "Could not change publishing status."); }
    finally { setBusy(false); }
  }
  async function remove(item) {
    if (!window.confirm("Remove this website media item? This also revokes public Drive access.")) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await setDriveFilePublic(item.driveFileId, false);
      await deleteDoc(doc(db, "siteMedia", item.id));
      await refresh(); setNotice("Media removed from the website and public access revoked. The Drive file remains in the admin folder.");
    } catch (err) { setError(err.message || "Could not remove media."); }
    finally { setBusy(false); }
  }
  return <section className="website-media-manager">
    <div className="customer-management-heading"><div><h3>Public Website Media</h3><p>Admin-only uploads to Google Drive. Visitors can view published items without an account or email.</p></div><button type="button" onClick={() => refresh().catch(err => setError(err.message))}>Refresh</button></div>
    <form className="portal-form" onSubmit={upload}>
      <h4>Upload website image or video</h4>
      <label>Title<input required maxLength="100" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. New bespoke collection"/></label>
      <label>Description<textarea maxLength="500" value={description} onChange={e => setDescription(e.target.value)} placeholder="A short public description"/></label>
      <label>Category<select value={category} onChange={e => setCategory(e.target.value)}><option>Collections</option><option>Fashion shows</option><option>Promotional videos</option><option>Training</option><option>Company news</option><option>Gallery</option></select></label>
      <label>Image or video<input required type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime" onChange={e => setFile(e.target.files?.[0] || null)}/></label>
      <small>Images: up to 20 MB. Videos: up to 100 MB. New uploads are private drafts until published.</small>
      <button className="portal-submit" disabled={busy}>{busy ? "Uploading…" : "Upload draft to Google Drive"}</button>
    </form>
    {error && <p role="alert" className="portal-error">{error}</p>}{notice && <p role="status" className="portal-success">{notice}</p>}
    <div className="website-media-admin-list">{items.map(item => <article key={item.id}>
      <div><strong>{item.title}</strong><p>{item.category} · {item.mediaType} · {item.published ? "Published publicly" : "Private draft"}</p><small>{item.fileName}</small></div>
      <div className="finance-record-actions"><button type="button" disabled={busy} onClick={() => publish(item)}>{item.published ? "Unpublish" : "Publish"}</button><button type="button" disabled={busy} onClick={() => remove(item)}>Remove</button></div>
    </article>)}</div>
  </section>;
}
