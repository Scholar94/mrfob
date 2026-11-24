/**
 * MR FOP FASHIONS — authenticated company-owned Google Drive upload broker.
 * Deploy as Web App: Execute as Me; access Anyone.
 * Script Properties: FIREBASE_PROJECT_ID, FIREBASE_API_KEY, DRIVE_FOLDER_ID.
 */
function doPost(e) {
  var payload = {};
  try {
    payload = JSON.parse((e && e.parameter && e.parameter.payload) || "{}");
    if (payload.action === "trash_drive_files") return handleTrashDriveFiles(payload);
    var props=PropertiesService.getScriptProperties(), projectId=props.getProperty("FIREBASE_PROJECT_ID"), rootId=props.getProperty("DRIVE_FOLDER_ID"), apiKey=props.getProperty("FIREBASE_API_KEY");
    if(!projectId||!rootId||!apiKey)throw new Error("The company upload service has not been fully configured.");
    if(payload.projectId!==projectId||!payload.idToken)throw new Error("Invalid application session. Please sign in again.");
    var check=UrlFetchApp.fetch("https://identitytoolkit.googleapis.com/v1/accounts:lookup?key="+encodeURIComponent(apiKey),{method:"post",contentType:"application/json",payload:JSON.stringify({idToken:payload.idToken}),muteHttpExceptions:true});
    if(check.getResponseCode()!==200)throw new Error("Your MR FOP session is invalid or expired. Please sign in again.");
    var users=JSON.parse(check.getContentText()).users||[], account=users[0]; if(!account||!account.localId)throw new Error("Could not verify your MR FOP account.");
    var uid=account.localId, role="customer";
    var rr=UrlFetchApp.fetch("https://firestore.googleapis.com/v1/projects/"+encodeURIComponent(projectId)+"/databases/(default)/documents/roles/"+encodeURIComponent(uid),{headers:{Authorization:"Bearer "+payload.idToken},muteHttpExceptions:true});
    if(rr.getResponseCode()===200){var rd=JSON.parse(rr.getContentText());role=rd.fields&&rd.fields.role&&rd.fields.role.stringValue||"customer";}else if(rr.getResponseCode()!==404)throw new Error("Could not verify your account permissions.");
    var root=DriveApp.getFolderById(rootId), purpose=String(payload.purpose||"payment_evidence"), mime=String(payload.mimeType||""), allowed=[], limit=20*1024*1024, folder;
    if(purpose==="payment_evidence"){
      if(role!=="customer")throw new Error("Only customer accounts can submit transfer evidence.");
      allowed=["image/jpeg","image/png","image/webp","application/pdf"];limit=15*1024*1024;
      var rec=root.getFoldersByName("Payment Evidence");folder=rec.hasNext()?rec.next():root.createFolder("Payment Evidence");
    }else if(purpose==="customer_reference"){
      if(role!=="customer")throw new Error("Only customer accounts can upload reference designs.");
      allowed=["image/jpeg","image/png","image/webp","application/pdf"];limit=15*1024*1024;
      var oid=String(payload.orderId||"").trim();if(!/^[A-Za-z0-9_-]{1,128}$/.test(oid))throw new Error("A valid order is required.");
      var or=UrlFetchApp.fetch("https://firestore.googleapis.com/v1/projects/"+encodeURIComponent(projectId)+"/databases/(default)/documents/orders/"+encodeURIComponent(oid),{headers:{Authorization:"Bearer "+payload.idToken},muteHttpExceptions:true});
      if(or.getResponseCode()!==200)throw new Error("The selected order could not be verified.");
      var od=JSON.parse(or.getContentText()), owner=od.fields&&od.fields.customerUid&&od.fields.customerUid.stringValue;
      if(owner!==uid)throw new Error("You can only upload reference files to your own order.");
      var refs=root.getFoldersByName("Customer Reference Designs"), refRoot=refs.hasNext()?refs.next():root.createFolder("Customer Reference Designs"), uidFolders=refRoot.getFoldersByName(uid);
      folder=uidFolders.hasNext()?uidFolders.next():refRoot.createFolder(uid);
    }else if(purpose==="catalogue_image"||purpose==="staff_upload"){
      var rootName;
      if(purpose==="catalogue_image"){
        if(role!=="superAdmin")throw new Error("Only the Super Admin can upload catalogue images.");
        allowed=["image/jpeg","image/png","image/webp"];limit=10*1024*1024;rootName=payload.imageFolder==="Product Images"?"Product Images":"Fabric Images";
      }else{
        var parts=String(payload.folder||"Uploads").split("/").filter(Boolean);rootName=parts.shift()||"Uploads";
        var roleRoots={superAdmin:["Production","Institute","Website Media","Company Theme Song","Product Images","Uploads"],manager:["Production"],tailor:["Production"],instructor:["Institute"],institute:["Institute"]};
        if(!roleRoots[role]||roleRoots[role].indexOf(rootName)<0)throw new Error("Your account is not permitted to upload to this area.");
        if(parts.length>4||parts.some(function(part){return !/^[A-Za-z0-9 _-]{1,80}$/.test(part)||part==="."||part==="..";}))throw new Error("Invalid upload folder.");
        allowed=["image/jpeg","image/png","image/webp","application/pdf","video/mp4","video/webm","video/quicktime","audio/mpeg","audio/mp4","audio/wav","audio/ogg"];
        folder=root;[rootName].concat(parts).forEach(function(name){var found=folder.getFoldersByName(name);folder=found.hasNext()?found.next():folder.createFolder(name);});
      }
      if(purpose==="catalogue_image"){var cat=root.getFoldersByName(rootName);folder=cat.hasNext()?cat.next():root.createFolder(rootName);}
      if(payload.visibility==="public"&&role!=="superAdmin")throw new Error("Only the Super Admin can upload public media.");
    }else throw new Error("Unsupported upload type.");
    if(allowed.indexOf(mime)<0)throw new Error("This file type is not accepted for this upload.");
    var b64=String(payload.fileBase64||"");if(!b64||b64.length>Math.ceil(limit*4/3)+1000)throw new Error("The selected file is empty or exceeds the upload limit.");
    var bytes=Utilities.base64Decode(b64);if(!bytes.length||bytes.length>limit)throw new Error("The selected file exceeds the upload limit.");
    var name=String(payload.fileName||"upload").replace(/[\\\\/:*?"<>|]/g,"_").slice(0,150), file=folder.createFile(Utilities.newBlob(bytes,mime,name));
    file.setDescription("MR FOP FASHIONS upload. UID: "+uid+". Order: "+String(payload.orderId||"").slice(0,120));
    if(purpose==="customer_reference")file.addViewer("mrfopvi@gmail.com");
    if(purpose==="catalogue_image")file.setSharing(DriveApp.Access.ANYONE_WITH_LINK,DriveApp.Permission.VIEW);
    if(purpose==="staff_upload"&&rootName==="Production"&&payload.customerEmail){var customerEmail=String(payload.customerEmail).trim().toLowerCase();if(!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(customerEmail)||["superAdmin","manager","tailor"].indexOf(role)<0)throw new Error("The customer sharing request is not authorised.");file.addViewer(customerEmail);}
    var emails=Array.isArray(payload.shareWithEmails)?payload.shareWithEmails:[];
    if(emails.length>50)throw new Error("Too many lesson recipients were supplied.");
    emails.forEach(function(value){var email=String(value||"").trim().toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error("An invalid lesson recipient email was supplied.");if(purpose!=="staff_upload"||rootName!=="Institute"||["superAdmin","instructor","institute"].indexOf(role)<0)throw new Error("This account cannot share lesson files.");file.addViewer(email);});
    if(payload.visibility==="public"&&purpose==="staff_upload")file.setSharing(DriveApp.Access.ANYONE_WITH_LINK,DriveApp.Permission.VIEW);
    var id=file.getId();
    return htmlResult(payload.nonce,true,{fileId:id,name:file.getName(),mimeType:mime,size:bytes.length,webViewLink:"https://drive.google.com/file/d/"+id+"/view",previewUrl:"https://drive.google.com/uc?export=view&id="+id,drivePreviewUrl:"https://drive.google.com/file/d/"+id+"/preview",thumbnailLink:""},"");
  }catch(err){return htmlResult(payload&&payload.nonce,false,null,err&&err.message?err.message:"Company Drive upload failed.");}
}

/**
 * Moves company-owned files to Drive Trash. This is deliberately reversible.
 * The caller must be a Super Admin and every file must be inside the configured
 * MR FOP root folder. A file ID alone never grants permission to trash a file.
 */
function handleTrashDriveFiles(payload) {
  try {
    var props = PropertiesService.getScriptProperties();
    var projectId = props.getProperty("FIREBASE_PROJECT_ID");
    var rootId = props.getProperty("DRIVE_FOLDER_ID");
    var apiKey = props.getProperty("FIREBASE_API_KEY");
    if (!projectId || !rootId || !apiKey) throw new Error("The company Drive service has not been fully configured.");
    if (payload.projectId !== projectId || !payload.idToken) throw new Error("Invalid application session. Please sign in again.");
    var check = UrlFetchApp.fetch("https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=" + encodeURIComponent(apiKey), {
      method: "post", contentType: "application/json", payload: JSON.stringify({idToken: payload.idToken}), muteHttpExceptions: true
    });
    if (check.getResponseCode() !== 200) throw new Error("Your MR FOP session is invalid or expired. Please sign in again.");
    var accounts = JSON.parse(check.getContentText()).users || [];
    var account = accounts[0];
    if (!account || !account.localId) throw new Error("Could not verify your MR FOP account.");
    var roleResponse = UrlFetchApp.fetch("https://firestore.googleapis.com/v1/projects/" + encodeURIComponent(projectId) + "/databases/(default)/documents/roles/" + encodeURIComponent(account.localId), {
      headers: {Authorization: "Bearer " + payload.idToken}, muteHttpExceptions: true
    });
    if (roleResponse.getResponseCode() !== 200) throw new Error("Could not verify your administrator permissions.");
    var roleDoc = JSON.parse(roleResponse.getContentText());
    var role = roleDoc.fields && roleDoc.fields.role && roleDoc.fields.role.stringValue;
    if (role !== "superAdmin") throw new Error("Only the MR FOP Super Admin can move company Drive files to Trash.");
    var ids = Array.isArray(payload.fileIds) ? payload.fileIds : [];
    if (!ids.length || ids.length > 50) throw new Error("Select between 1 and 50 company files.");
    var root = DriveApp.getFolderById(rootId);
    var moved = [], skipped = [];
    ids.forEach(function(rawId) {
      var id = String(rawId || "").trim();
      if (!/^[A-Za-z0-9_-]{10,200}$/.test(id)) throw new Error("An invalid Google Drive file ID was supplied.");
      var file = DriveApp.getFileById(id);
      if (file.isTrashed()) { skipped.push({fileId:id, reason:"already_trashed"}); return; }
      if (!isCompanyDriveFile_(file, root.getId(), 0)) throw new Error("A selected file is outside the configured MR FOP company folder. No external file was changed.");
      file.setTrashed(true);
      moved.push({fileId:id, name:file.getName()});
    });
    return actionHtmlResult(payload.nonce, true, {moved:moved, skipped:skipped}, "");
  } catch (err) {
    return actionHtmlResult(payload && payload.nonce, false, null, err && err.message ? err.message : "Company Drive file action failed.");
  }
}

function isCompanyDriveFile_(file, rootId, depth) {
  if (depth > 12) return false;
  var parents = file.getParents();
  while (parents.hasNext()) {
    var parent = parents.next();
    if (parent.getId() === rootId) return true;
    if (isCompanyDriveFolderWithinRoot_(parent, rootId, depth + 1)) return true;
  }
  return false;
}

function isCompanyDriveFolderWithinRoot_(folder, rootId, depth) {
  if (depth > 12) return false;
  if (folder.getId() === rootId) return true;
  var parents = folder.getParents();
  while (parents.hasNext()) {
    if (isCompanyDriveFolderWithinRoot_(parents.next(), rootId, depth + 1)) return true;
  }
  return false;
}

function actionHtmlResult(nonce, ok, data, error) {
  var result = JSON.stringify({type:"MRFOP_DRIVE_ACTION", nonce:String(nonce || ""), ok:Boolean(ok), data:data || null, error:String(error || "")}).replace(/</g, "\\u003c");
  return HtmlService.createHtmlOutput("<!doctype html><html><body><script>window.top.postMessage(" + result + ", 'https://scholar94.github.io');</script></body></html>").setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function htmlResult(nonce,ok,file,error){
  var result=JSON.stringify({type:"MRFOP_DRIVE_UPLOAD",nonce:String(nonce||""),ok:Boolean(ok),file:file||null,error:String(error||"")}).replace(/</g,"\\u003c");
  return HtmlService.createHtmlOutput("<!doctype html><html><body><script>window.top.postMessage("+result+", 'https://scholar94.github.io');</script></body></html>").setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
