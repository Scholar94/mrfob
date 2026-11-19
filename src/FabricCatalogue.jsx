import React, { useEffect, useState } from "react";
import { addDoc, collection, doc, getDocs, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { db } from "./firebase.js";
import { recordAuditEvent } from "./auditLog.js";
import { uploadCatalogueImageToCompanyDrive } from "./googleDrive.js";

const emptyForm = { name: "", color: "", texture: "", priceRange: "", availability: "available", suitableCategories: "", imageUrl: "", active: true };

function getFabricImageUrl(value) {
  const url = String(value || "").trim();
  if (!url) return "";
  const driveId = url.match(/(?:[?&]id=|\\/d\\/)([a-zA-Z0-9_-]{10,})/);
  return driveId ? "https://drive.google.com/thumbnail?id=" + encodeURIComponent(driveId[1]) + "&sz=w1200" : url;
}

export default function FabricCatalogue({ admin = false, user = null, claims = {} }) {
  const [fabrics, setFabrics] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [imageUploading, setImageUploading] = useState(false);

  async function refresh() {
    if (!db) { setFabrics([]); setLoading(false); return; }
    setLoading(true); setError("");
    try {
      const source = admin ? collection(db, "fabrics") : query(collection(db, "fabrics"), where("active", "==", true));
      const snapshot = await getDocs(source);
      setFabrics(snapshot.docs.map(row => ({ id: row.id, ...row.data() })).sort((a,b) => (a.name || "").localeCompare(b.name || "")));
    } catch (err) { setError(err.message || "Could not load the fabric catalogue."); }
    finally { setLoading(false); }
  }
  useEffect(() => { refresh(); }, [admin]);

  async function uploadFabricImage() {
    if (!admin || !user || !imageFile) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(imageFile.type)) { setError("Choose a JPG, PNG or WebP image."); return; }
    if (imageFile.size > 10 * 1024 * 1024) { setError("Fabric image must be 10 MB or smaller."); return; }
    setImageUploading(true); setError(""); setNotice("");
    try {
      const idToken = await user.getIdToken();
      const uploaded = await uploadCatalogueImageToCompanyDrive(imageFile, { idToken, imageFolder: "Fabric Images" });
      setForm(current => ({ ...current, imageUrl: uploaded.previewUrl || uploaded.webViewLink }));
      setImageFile(null);
      const picker = document.getElementById("mrfop-fabric-image-picker");
      if (picker) picker.value = "";
      setNotice("Fabric image uploaded to the company Google Drive. Save the fabric record to publish it.");
    } catch (err) { setError(err.message || "Could not upload the fabric image to Google Drive."); }
    finally { setImageUploading(false); }
  }

  async function save(event) {
    event.preventDefault();
    if (!admin || !user) return;
    const name = form.name.trim(), color = form.color.trim(), texture = form.texture.trim();
    const priceRange = form.priceRange.trim();
    const suitableCategories = form.suitableCategories.split(",").map(x => x.trim()).filter(Boolean).slice(0, 12);
    const imageUrl = form.imageUrl.trim();
    if (!name || !color || !texture) { setError("Enter a fabric name, colour and texture."); return; }
    if (priceRange.length > 100 || suitableCategories.some(x => x.length > 60)) { setError("Check the price range and suitable-category lengths."); return; }
    if (imageUrl && (!/^https:\/\//i.test(imageUrl) || imageUrl.length > 1500)) { setError("Use a valid HTTPS image URL, or leave it blank."); return; }
    setBusy(true); setError(""); setNotice("");
    const payload = { name, color, texture, priceRange, availability: form.availability, suitableCategories, imageUrl, active: !!form.active, updatedAt: serverTimestamp() };
    try {
      if (editingId) await updateDoc(doc(db, "fabrics", editingId), payload);
      else await addDoc(collection(db, "fabrics"), { ...payload, createdAt: serverTimestamp(), createdBy: user.uid });
      await recordAuditEvent({ user, claims, action: editingId ? "fabric_updated" : "fabric_created", entityType: "fabric", entityId: editingId || "new", summary: (editingId ? "Updated fabric " : "Created fabric ") + name + "." });
      setForm(emptyForm); setEditingId(""); setImageFile(null); setNotice(editingId ? "Fabric record updated." : "Fabric added to the catalogue.");
      await refresh();
    } catch (err) { setError(err.message || "Could not save this fabric."); }
    finally { setBusy(false); }
  }

  function edit(item) {
    setEditingId(item.id);
    setForm({ name: item.name || "", color: item.color || "", texture: item.texture || "", priceRange: item.priceRange || "", availability: item.availability || "available", suitableCategories: (item.suitableCategories || []).join(", "), imageUrl: item.imageUrl || "", active: item.active !== false });
    setImageFile(null);
  }

  async function archive(item) {
    if (!admin || !window.confirm("Remove this fabric from the public catalogue? The record will be archived, not deleted.")) return;
    setBusy(true); setError(""); setNotice("");
    try { await updateDoc(doc(db, "fabrics", item.id), { active: false, updatedAt: serverTimestamp() }); await recordAuditEvent({ user, claims, action: "fabric_archived", entityType: "fabric", entityId: item.id, summary: "Archived fabric " + item.name + "." }); setNotice("Fabric archived from the public catalogue."); await refresh(); }
    catch (err) { setError(err.message || "Could not archive this fabric."); }
    finally { setBusy(false); }
  }

  return <section className={admin ? "fabric-catalogue fabric-catalogue-admin" : "fabric-catalogue"} id={admin ? undefined : "fabric-gallery"}>
    <div className="customer-management-heading">
      <div><h3>{admin ? "Fabric catalogue management" : "Explore our fabric collection"}</h3>
        <p>{admin ? "Maintain fabric names, colours, textures, indicative price ranges and availability." : "Browse available colours, textures and fabric options. Final price and stock are confirmed by the team."}</p>
      </div>
      <button type="button" onClick={refresh} disabled={loading || busy}>{loading ? "Loading…" : "Refresh fabrics"}</button>
    </div>
    {admin && <form className="portal-form fabric-admin-form" onSubmit={save}>
      <h4>{editingId ? "Edit fabric" : "Add a fabric"}</h4>
      <label>Fabric name<input required maxLength={100} value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="e.g. Premium Italian wool"/></label>
      <label>Colour<input required maxLength={80} value={form.color} onChange={e=>setForm({...form,color:e.target.value})} placeholder="e.g. Midnight navy"/></label>
      <label>Texture / finish<input required maxLength={100} value={form.texture} onChange={e=>setForm({...form,texture:e.target.value})} placeholder="e.g. Smooth, matte, lightweight"/></label>
      <label>Indicative price range<input maxLength={100} value={form.priceRange} onChange={e=>setForm({...form,priceRange:e.target.value})} placeholder="e.g. Price on request"/></label>
      <label>Suitable garment categories<input maxLength={720} value={form.suitableCategories} onChange={e=>setForm({...form,suitableCategories:e.target.value})} placeholder="Suits, trousers, waistcoats"/></label>
      <label>Availability<select value={form.availability} onChange={e=>setForm({...form,availability:e.target.value})}><option value="available">Available</option><option value="limited">Limited availability</option><option value="out_of_stock">Currently unavailable</option></select></label>
      <div className="portal-field">
        <label htmlFor="mrfop-fabric-image-picker">Upload fabric image from your device gallery</label>
        <input id="mrfop-fabric-image-picker" type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>setImageFile(e.target.files?.[0] || null)}/>
        <p className="portal-hint">JPG, PNG or WebP; maximum 10 MB. The image will be stored in the company Google Drive.</p>
        {imageFile && <p className="portal-hint">Selected: {imageFile.name}</p>}
        <button type="button" className="portal-submit secondary" disabled={busy || imageUploading || !imageFile} onClick={uploadFabricImage}>{imageUploading ? "Uploading image…" : "Upload fabric image"}</button>
      </div>
      <label>Fabric image URL (optional)<input type="url" value={form.imageUrl} onChange={e=>setForm({...form,imageUrl:e.target.value})} placeholder="https://…"/></label>
      {form.imageUrl && <img className="fabric-upload-preview" src={getFabricImageUrl(form.imageUrl)} alt="Fabric image preview"/>}
      <label className="fabric-active-toggle"><input type="checkbox" checked={form.active} onChange={e=>setForm({...form,active:e.target.checked})}/> Show in public fabric gallery</label>
      <div className="fabric-form-actions"><button className="portal-submit" disabled={busy}>{busy ? "Saving…" : editingId ? "Save fabric changes" : "Add fabric"}</button>{editingId && <button type="button" onClick={()=>{setEditingId("");setForm(emptyForm);}}>Cancel</button>}</div>
    </form>}
    {error && <p className="portal-error" role="alert">{error}</p>}{notice && <p className="portal-success" role="status">{notice}</p>}
    {loading ? <p className="staff-empty">Loading fabric options…</p> : fabrics.length ? <div className="fabric-grid">{fabrics.map(item=><article className="fabric-card" key={item.id}>
      {item.imageUrl ? <img src={getFabricImageUrl(item.imageUrl)} alt={item.name + " fabric in " + item.color} loading="lazy"/> : <div className="fabric-placeholder" aria-hidden="true">MR FOP</div>}
      <div className="fabric-card-copy"><h4>{item.name}</h4><p><strong>Colour:</strong> {item.color}</p><p><strong>Texture:</strong> {item.texture}</p>{item.priceRange && <p><strong>Price:</strong> {item.priceRange}</p>}<p><strong>Availability:</strong> {String(item.availability || "available").replaceAll("_", " ")}</p>{item.suitableCategories?.length > 0 && <p><strong>Suitable for:</strong> {item.suitableCategories.join(", ")}</p>}</div>
      {admin && <div className="fabric-card-actions"><button type="button" disabled={busy} onClick={()=>edit(item)}>Edit</button>{item.active !== false && <button type="button" disabled={busy} onClick={()=>archive(item)}>Archive</button>}</div>}
    </article>)}</div> : <p className="staff-empty">{admin ? "No fabrics have been added yet." : "Our fabric gallery is being updated. Contact the team to discuss available materials."}</p>}
  </section>;
}
