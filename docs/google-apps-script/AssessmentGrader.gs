/**
 * MR FOP FASHIONS — Objective Assessment Grader
 * Deploy as a Google Apps Script Web App that executes as the project owner.
 * The browser submits a Firebase ID token; this service verifies it with Firebase Auth,
 * checks paid enrolment/deadline/assessment state, reads the staff-only answer key,
 * and creates the final grade using the Firestore REST API.
 */
const CONFIG = () => {
  const p = PropertiesService.getScriptProperties();
  return {
    projectId: p.getProperty("FIREBASE_PROJECT_ID"),
    apiKey: p.getProperty("FIREBASE_API_KEY")
  };
};

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    if (body.action !== "submitObjectiveAssessment") throw new Error("Unsupported action.");
    const config = CONFIG();
    if (!config.projectId || !config.apiKey) throw new Error("Grading service is not configured.");
    const identity = verifyFirebaseToken_(body.idToken, config.apiKey);
    const uid = identity.localId;
    const assessmentId = String(body.assessmentId || "");
    if (!/^[A-Za-z0-9_-]{1,150}$/.test(assessmentId)) throw new Error("Invalid assessment reference.");
    if (!Array.isArray(body.answers) || body.answers.length < 1 || body.answers.length > 30) throw new Error("Invalid answer list.");
    const assessment = getDocument_(config.projectId, "instituteAssessments", assessmentId);
    if (!assessment || assessment.published !== true || assessment.assessmentType !== "objective") throw new Error("Assessment is unavailable.");
    if (assessment.dueAt && Date.parse(assessment.dueAt) < Date.now()) throw new Error("The assessment deadline has passed.");
    const enrollment = getDocument_(config.projectId, "instituteEnrollments", uid + "_" + assessment.courseId);
    if (!enrollment || enrollment.studentUid !== uid || enrollment.courseId !== assessment.courseId || enrollment.paymentStatus !== "paid") throw new Error("A paid course enrolment is required.");
    const key = getDocument_(config.projectId, "instituteAssessmentAnswerKeys", assessmentId);
    if (!key || key.courseId !== assessment.courseId || !Array.isArray(key.correctOptions)) throw new Error("The answer key is unavailable.");
    if (!Array.isArray(assessment.questions) || assessment.questions.some(q => !q || typeof q.text !== "string" || !Array.isArray(q.options) || q.options.length !== 4)) throw new Error("The published objective questions are invalid.");
    if (body.answers.length !== assessment.questions.length || key.correctOptions.length !== assessment.questions.length) throw new Error("The submitted answer count is invalid.");
    if (Number(key.pointsPerQuestion) !== 10) throw new Error("The assessment scoring configuration is invalid.");
    const answers = body.answers.map(a => String(a || "").trim().toUpperCase());
    if (answers.some(a => !["A","B","C","D"].includes(a))) throw new Error("Select an option for every question.");
    const correct = key.correctOptions.map(a => String(a).toUpperCase());
    if (correct.some(a => !["A","B","C","D"].includes(a))) throw new Error("The answer key is invalid.");
    const submissionId = uid + "_" + assessmentId;
    const existing = getDocument_(config.projectId, "instituteAssessmentSubmissions", submissionId);
    if (existing) throw new Error("This assessment has already been submitted.");
    const points = 10;
    const maxScore = correct.length * points;
    const score = answers.reduce((total, answer, index) => total + (answer === correct[index] ? points : 0), 0);
    const now = new Date();
    const document = {
      assessmentId, courseId:assessment.courseId, assessmentTitle:assessment.title,
      studentUid:uid, studentName:String(identity.displayName || identity.email || "Student"),
      answers, status:"graded", score, maxScore, feedback:"Automatically marked.",
      gradingMode:"automatic", submittedAt:now, gradedAt:now, createdAt:now, updatedAt:now
    };
    createDocument_(config.projectId, "instituteAssessmentSubmissions", submissionId, document);
    return json_({ ok:true, score, maxScore, status:"graded" });
  } catch (err) {
    console.error(err && err.stack ? err.stack : err);
    return json_({ ok:false, error:String(err && err.message ? err.message : err) });
  }
}

function verifyFirebaseToken_(idToken, apiKey) {
  if (!idToken || typeof idToken !== "string") throw new Error("Sign in again before submitting.");
  const response = UrlFetchApp.fetch("https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=" + encodeURIComponent(apiKey), {
    method:"post", contentType:"application/json", payload:JSON.stringify({ idToken }),
    muteHttpExceptions:true
  });
  const data = JSON.parse(response.getContentText() || "{}");
  if (response.getResponseCode() !== 200 || !data.users || !data.users.length || data.users[0].localId == null) throw new Error("Your sign-in session could not be verified.");
  return data.users[0];
}

function firestoreRequest_(projectId, path, method, payload) {
  const url = "https://firestore.googleapis.com/v1/projects/" + encodeURIComponent(projectId) + "/databases/(default)/documents/" + path;
  const options = {
    method:method, contentType:"application/json",
    headers:{ Authorization:"Bearer " + ScriptApp.getOAuthToken() },
    muteHttpExceptions:true
  };
  if (payload) options.payload = JSON.stringify(payload);
  const response = UrlFetchApp.fetch(url, options);
  const code = response.getResponseCode();
  if (code === 404) return null;
  if (code < 200 || code >= 300) throw new Error("Firestore request failed (" + code + "): " + response.getContentText().slice(0,400));
  return response.getContentText() ? JSON.parse(response.getContentText()) : {};
}

function getDocument_(projectId, collectionName, documentId) {
  const raw = firestoreRequest_(projectId, collectionName + "/" + encodeURIComponent(documentId), "get");
  return raw ? decodeFields_(raw.fields || {}) : null;
}

function createDocument_(projectId, collectionName, documentId, data) {
  const fields = encodeFields_(data);
  const path = "projects/" + encodeURIComponent(projectId) + "/databases/(default)/documents/" + collectionName + "/" + encodeURIComponent(documentId);
  const url = "https://firestore.googleapis.com/v1/projects/" + encodeURIComponent(projectId) + "/databases/(default)/documents:commit";
  const response = UrlFetchApp.fetch(url, {
    method:"post", contentType:"application/json",
    headers:{ Authorization:"Bearer " + ScriptApp.getOAuthToken() },
    payload:JSON.stringify({ writes:[{ update:{ name:"projects/" + projectId + "/databases/(default)/documents/" + collectionName + "/" + documentId, fields }, currentDocument:{ exists:false } }] }),
    muteHttpExceptions:true
  });
  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) {
    if (response.getContentText().includes("ALREADY_EXISTS")) throw new Error("This assessment has already been submitted.");
    throw new Error("Could not save the grade (" + response.getResponseCode() + ").");
  }
}

function encodeFields_(data) {
  const out = {};
  Object.keys(data).forEach(key => {
    const value = data[key];
    if (value === null) out[key] = { nullValue:null };
    else if (typeof value === "string") out[key] = { stringValue:value };
    else if (typeof value === "boolean") out[key] = { booleanValue:value };
    else if (typeof value === "number") out[key] = Number.isInteger(value) ? { integerValue:String(value) } : { doubleValue:value };
    else if (Array.isArray(value)) out[key] = { arrayValue:{ values:value.map(encodeValue_) } };
    else if (value instanceof Date) out[key] = { timestampValue:value.toISOString() };
  });
  return out;
}

function encodeValue_(value) {
  if (typeof value === "string") return { stringValue:value };
  if (typeof value === "number") return Number.isInteger(value) ? { integerValue:String(value) } : { doubleValue:value };
  if (typeof value === "boolean") return { booleanValue:value };
  return { nullValue:null };
}

function decodeFields_(fields) {
  const out = {};
  Object.keys(fields).forEach(key => {
    const value = fields[key];
    if ("stringValue" in value) out[key] = value.stringValue;
    else if ("integerValue" in value) out[key] = Number(value.integerValue);
    else if ("doubleValue" in value) out[key] = value.doubleValue;
    else if ("booleanValue" in value) out[key] = value.booleanValue;
    else if ("timestampValue" in value) out[key] = value.timestampValue;
    else if ("arrayValue" in value) out[key] = (value.arrayValue.values || []).map(decodeValue_);
    else if ("mapValue" in value) out[key] = decodeFields_(value.mapValue.fields || {});
    else if ("nullValue" in value) out[key] = null;
  });
  return out;
}

function decodeValue_(value) {
  if ("stringValue" in value) return value.stringValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return value.doubleValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("timestampValue" in value) return value.timestampValue;
  if ("nullValue" in value) return null;
  if ("mapValue" in value) return decodeFields_(value.mapValue.fields || {});
  if ("arrayValue" in value) return (value.arrayValue.values || []).map(decodeValue_);
  return null;
}

function json_(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
