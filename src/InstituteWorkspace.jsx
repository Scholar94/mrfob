import React, { useEffect, useMemo, useState } from "react";
import { addDoc, collection, getDocs, getDoc, query, serverTimestamp, Timestamp, updateDoc, doc, where, setDoc, runTransaction, writeBatch } from "firebase/firestore";
import { db } from "./firebase.js";
import { recordAuditEvent } from "./auditLog.js";
import { useAuth } from "./AuthProvider.jsx";
import { uploadFileToGoogleDrive, shareDriveFileWithEmail, revokeDriveFileAccessForEmail } from "./googleDrive.js";

const COURSE_TYPES = ["Basic Fashion Designing","Professional Fashion Designing","Advanced Fashion Designing","Pattern Drafting","Garment Construction","Industrial Tailoring","Bridal Wear Design","Men's Fashion Design","Women's Fashion Design","Fashion Business Management","Fashion Entrepreneurship","Traditional Nigerian Fashion","Fashion Finishing and Decoration"];
const blankCourse = { title: "", category: "Professional Fashion Designing", description: "", mode: "Online and onsite", duration: "", fee: "", active: true };
const blankWindow = { title: "", courseId: "", applicationOpen: "", applicationClose: "", commencement: "", duration: "", modes: ["Onsite"], fee: "", capacity: "", timetable: "", venue: "MR FOP FASHIONS, Ijebu Ode", instructorName: "" };

export default function InstituteWorkspace() {
  const { user, claims } = useAuth();
  const isAdmin = !!(claims.superAdmin || claims.staffRole === "institute" || claims.staffRole === "manager");
  const [courses, setCourses] = useState([]);
  const [windows, setWindows] = useState([]);
  const [applications, setApplications] = useState([]);
  const [myApplications, setMyApplications] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [assessmentSubmissions, setAssessmentSubmissions] = useState([]);
  const [assessmentForm, setAssessmentForm] = useState({ courseId: "", title: "", instructions: "", dueDate: "", assessmentType: "written", questions: "" });
  const [assessmentDrafts, setAssessmentDrafts] = useState({});
  const [assessmentGradeDrafts, setAssessmentGradeDrafts] = useState({});
  const [allEnrollments, setAllEnrollments] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [lessonProgress, setLessonProgress] = useState([]);
  const [allLessonProgress, setAllLessonProgress] = useState([]);
  const [certificates, setCertificates] = useState([]);
  const [allCertificates, setAllCertificates] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [instructorAssignments, setInstructorAssignments] = useState([]);
  const [allInstructorAssignments, setAllInstructorAssignments] = useState([]);
  const [instructorProfiles, setInstructorProfiles] = useState([]);
  const [myInstructorProfile, setMyInstructorProfile] = useState({ fullName: "", phone: "", qualifications: "", specialization: "", bio: "", availability: "" });
  const [sessions, setSessions] = useState([]);
  const [sessionForm, setSessionForm] = useState({ courseId: "", instructorUid: "", title: "", startsAt: "", endsAt: "", mode: "Onsite", venue: "MR FOP FASHIONS, Ijebu Ode", meetingUrl: "", notes: "" });
  const [instructorForm, setInstructorForm] = useState({ instructorUid: "", courseId: "" });
  const isInstructor = claims.staffRole === "instructor";
  const [announcementForm, setAnnouncementForm] = useState({ courseId: "all", title: "", message: "", expiresOn: "" });
  const [certificateEnrollmentId, setCertificateEnrollmentId] = useState("");
  const [certificateRevocationDrafts, setCertificateRevocationDrafts] = useState({});
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().slice(0,10));
  const [assignmentForm, setAssignmentForm] = useState({ courseId: "", title: "", instructions: "", dueDate: "", points: "100" });
  const [submissionDrafts, setSubmissionDrafts] = useState({});
  const [lessonForm, setLessonForm] = useState({ courseId: "", title: "", module: "", type: "Text lesson", content: "", videoUrl: "", resourceUrl: "", sequence: "1" });
  const [lessonUploadFile, setLessonUploadFile] = useState(null);
  const [mediaAccessAction, setMediaAccessAction] = useState("");
  const [courseForm, setCourseForm] = useState(blankCourse);
  const [editingCourseId, setEditingCourseId] = useState("");
  const [windowForm, setWindowForm] = useState(blankWindow);
  const [editingWindowId, setEditingWindowId] = useState("");
  const [applicationForm, setApplicationForm] = useState({ fullName: user?.displayName || "", phone: "", address: "", courseId: "", windowId: "", mode: "Onsite", experience: "", note: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    if (!user) return;
    setError("");
    try {
      const [courseSnap, windowSnap, ownSnap] = await Promise.all([
        getDocs(collection(db, "instituteCourses")),
        getDocs(collection(db, "trainingWindows")),
        getDocs(query(collection(db, "instituteApplications"), where("customerUid", "==", user.uid)))
      ]);
      setCourses(courseSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => (a.title || "").localeCompare(b.title || "")));
      setWindows(windowSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => (a.commencement || "").localeCompare(b.commencement || "")));
      setMyApplications(ownSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
      if (!isAdmin && !isInstructor) {
        const enrollmentSnap = await getDocs(query(collection(db, "instituteEnrollments"), where("studentUid", "==", user.uid), where("paymentStatus", "==", "paid")));
        const active = enrollmentSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(en => en.enrollmentStatus !== "withdrawn");
        setEnrollments(active);
        const sets = await Promise.all(active.map(en => getDocs(query(collection(db, "instituteLessons"), where("courseId", "==", en.courseId), where("published", "==", true)))));
        setLessons(sets.flatMap(s => s.docs.map(d => ({ id: d.id, ...d.data() }))).sort((a,b) => Number(a.sequence||0)-Number(b.sequence||0)));
        const assignmentSets = await Promise.all(active.map(en => getDocs(query(collection(db, "instituteAssignments"), where("courseId", "==", en.courseId), where("published", "==", true)))));
        const assessmentSets = await Promise.all(active.map(en => getDocs(query(collection(db, "instituteAssessments"), where("courseId", "==", en.courseId), where("published", "==", true)))));
        const assessmentSubmissionSnap = await getDocs(query(collection(db, "instituteAssessmentSubmissions"), where("studentUid", "==", user.uid)));
        setAssessments(assessmentSets.flatMap(s => s.docs.map(d => ({ id:d.id, ...d.data() }))));
        setAssessmentSubmissions(assessmentSubmissionSnap.docs.map(d => ({ id:d.id, ...d.data() })));
        setAssignments(assignmentSets.flatMap(s => s.docs.map(d => ({ id: d.id, ...d.data() }))));
        const [submissionSnap, attendanceSnap, progressSnap, certificateSnap, sessionSets] = await Promise.all([getDocs(query(collection(db, "instituteSubmissions"), where("studentUid", "==", user.uid))), getDocs(query(collection(db, "instituteAttendance"), where("studentUid", "==", user.uid))), getDocs(query(collection(db, "instituteLessonProgress"), where("studentUid", "==", user.uid))), getDocs(query(collection(db, "instituteCertificates"), where("studentUid", "==", user.uid))), Promise.all(active.map(en => getDocs(query(collection(db, "instituteSessions"), where("courseId", "==", en.courseId), where("published", "==", true)))))]);
        setSubmissions(submissionSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setAttendance(attendanceSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b)=>(b.date||"").localeCompare(a.date||"")));
        setLessonProgress(progressSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setCertificates(certificateSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b)=>(b.issuedAt?.seconds||0)-(a.issuedAt?.seconds||0)));
        setSessions(sessionSets.flatMap(s => s.docs.map(d => ({ id:d.id, ...d.data() }))).sort((a,b)=>(a.startsAt||"").localeCompare(b.startsAt||"")));
        const announcementSets = await Promise.all([
          getDocs(query(collection(db, "instituteAnnouncements"), where("courseId", "==", "all"))),
          ...active.map(en => getDocs(query(collection(db, "instituteAnnouncements"), where("courseId", "==", en.courseId))))
        ]);
        const announcementMap = new Map();
        announcementSets.forEach(s => s.docs.forEach(d => announcementMap.set(d.id, { id: d.id, ...d.data() })));
        setAnnouncements([...announcementMap.values()].filter(a => !a.expiresOn || a.expiresOn >= new Date().toISOString().slice(0,10)).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0)));
      }
      if (isInstructor) {
        const profileSnap = await getDoc(doc(db, "instituteInstructorProfiles", user.uid));
        if (profileSnap.exists()) setMyInstructorProfile({ fullName: "", phone: "", qualifications: "", specialization: "", bio: "", availability: "", ...profileSnap.data() });
        const assignedSnap = await getDocs(query(collection(db, "instituteInstructorAssignments"), where("instructorUid", "==", user.uid)));
        const assigned = assignedSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(a => a.active === true);
        setInstructorAssignments(assigned);
        const courseIds = [...new Set(assigned.map(a => a.courseId))];
        const [lessonSets, assignmentSets, enrollmentSets, submissionSets, attendanceSets, assessmentSets, assessmentSubmissionSets, sessionSets] = await Promise.all([
          Promise.all(courseIds.map(courseId => getDocs(query(collection(db, "instituteLessons"), where("courseId", "==", courseId))))),
          Promise.all(courseIds.map(courseId => getDocs(query(collection(db, "instituteAssignments"), where("courseId", "==", courseId))))),
          Promise.all(courseIds.map(courseId => getDocs(query(collection(db, "instituteEnrollments"), where("courseId", "==", courseId))))),
          Promise.all(courseIds.map(courseId => getDocs(query(collection(db, "instituteSubmissions"), where("courseId", "==", courseId))))),
          Promise.all(courseIds.map(courseId => getDocs(query(collection(db, "instituteAttendance"), where("courseId", "==", courseId))))),
          Promise.all(courseIds.map(courseId => getDocs(query(collection(db, "instituteAssessments"), where("courseId", "==", courseId))))),
          Promise.all(courseIds.map(courseId => getDocs(query(collection(db, "instituteAssessmentSubmissions"), where("courseId", "==", courseId))))),
          Promise.all(courseIds.map(courseId => getDocs(query(collection(db, "instituteSessions"), where("courseId", "==", courseId)))) )
        ]);
        setLessons(lessonSets.flatMap(s => s.docs.map(d => ({ id:d.id, ...d.data() }))).sort((a,b)=>Number(a.sequence||0)-Number(b.sequence||0)));
        setAssignments(assignmentSets.flatMap(s => s.docs.map(d => ({ id:d.id, ...d.data() }))));
        setAllEnrollments(enrollmentSets.flatMap(s => s.docs.map(d => ({ id:d.id, ...d.data() })).filter(en => en.paymentStatus === "paid" && en.enrollmentStatus !== "withdrawn")));
        setSubmissions(submissionSets.flatMap(s => s.docs.map(d => ({ id:d.id, ...d.data() }))));
        setAttendance(attendanceSets.flatMap(s => s.docs.map(d => ({ id:d.id, ...d.data() }))));
        setAssessments(assessmentSets.flatMap(s => s.docs.map(d => ({ id:d.id, ...d.data() }))));
        setAssessmentSubmissions(assessmentSubmissionSets.flatMap(s => s.docs.map(d => ({ id:d.id, ...d.data() }))));
        setSessions(sessionSets.flatMap(s => s.docs.map(d => ({ id:d.id, ...d.data() }))).sort((a,b)=>(a.startsAt||"").localeCompare(b.startsAt||"")));
      }
      if (isAdmin) {
        const all = await getDocs(collection(db, "instituteApplications"));
        setApplications(all.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
        const [lessonSnap, assignmentSnap, submissionSnap, enrollmentAllSnap, attendanceSnap, progressSnap, certificateSnap, assessmentSnap, assessmentSubmissionSnap, sessionSnap, instructorAssignmentSnap, instructorProfileSnap] = await Promise.all([getDocs(collection(db, "instituteLessons")), getDocs(collection(db, "instituteAssignments")), getDocs(collection(db, "instituteSubmissions")), getDocs(collection(db, "instituteEnrollments")), getDocs(collection(db, "instituteAttendance")), getDocs(collection(db, "instituteLessonProgress")), getDocs(collection(db, "instituteCertificates")), getDocs(collection(db, "instituteAssessments")), getDocs(collection(db, "instituteAssessmentSubmissions")), getDocs(collection(db, "instituteSessions")), getDocs(collection(db, "instituteInstructorAssignments")), getDocs(collection(db, "instituteInstructorProfiles"))]);
        setLessons(lessonSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b)=>Number(a.sequence||0)-Number(b.sequence||0)));
        setAssignments(assignmentSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setSubmissions(submissionSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setAllEnrollments(enrollmentAllSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setAttendance(attendanceSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setAllLessonProgress(progressSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setAllCertificates(certificateSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setAssessments(assessmentSnap.docs.map(d => ({ id:d.id, ...d.data() })));
        setAssessmentSubmissions(assessmentSubmissionSnap.docs.map(d => ({ id:d.id, ...d.data() })));
        setSessions(sessionSnap.docs.map(d => ({ id:d.id, ...d.data() })).sort((a,b)=>(a.startsAt||"").localeCompare(b.startsAt||"")));
        setAllInstructorAssignments(instructorAssignmentSnap.docs.map(d => ({ id:d.id, ...d.data() })).filter(a=>a.active));
        setInstructorProfiles(instructorProfileSnap.docs.map(d => ({ id:d.id, ...d.data() })));
        const announcementSnap = await getDocs(collection(db, "instituteAnnouncements"));
        setAnnouncements(announcementSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0)));
      }
    } catch (e) { setError(e.message || "Could not load Fashion Institute records."); }
  }

  useEffect(() => { load(); }, [user?.uid, isAdmin]);

  const availableWindows = useMemo(() => windows.filter(w => w.status !== "closed" && (!w.applicationClose || w.applicationClose >= new Date().toISOString().slice(0,10))), [windows]);

  const activeCourses = useMemo(() => courses.filter(c => c.active !== false), [courses]);

  function getCourseCompletionStatus(enrollment) {
    if (!enrollment) return { eligible: false, checks: [], blockers: ["Select a paid enrolment."] };
    const courseId = enrollment.courseId;
    const courseLessons = lessons.filter(item => item.courseId === courseId && item.published === true);
    const completedLessonIds = new Set(allLessonProgress
      .filter(item => item.studentUid === enrollment.studentUid && item.courseId === courseId && item.completed === true)
      .map(item => item.lessonId));
    const incompleteLessons = courseLessons.filter(item => !completedLessonIds.has(item.id));

    const courseAssignments = assignments.filter(item => item.courseId === courseId && item.published === true);
    const assignmentRecords = submissions.filter(item => item.studentUid === enrollment.studentUid && item.courseId === courseId);
    const incompleteAssignments = courseAssignments.filter(item => {
      const submission = assignmentRecords.find(record => record.assignmentId === item.id);
      return !submission || submission.status !== "graded";
    });

    const courseAssessments = assessments.filter(item => item.courseId === courseId && item.published === true);
    const assessmentRecords = assessmentSubmissions.filter(item => item.studentUid === enrollment.studentUid && item.courseId === courseId);
    const incompleteAssessments = courseAssessments.filter(item => {
      const submission = assessmentRecords.find(record => record.assessmentId === item.id);
      return !submission || submission.status !== "graded";
    });

    const completedSessions = sessions.filter(item => item.courseId === courseId && item.status === "completed");
    const attendanceRecords = attendance.filter(item => item.studentUid === enrollment.studentUid && item.courseId === courseId);
    const missingAttendance = completedSessions.filter(session => {
      const sessionDate = String(session.startsAt || "").slice(0, 10);
      const record = attendanceRecords.find(item => item.date === sessionDate);
      return !record || !["present", "late", "excused"].includes(record.status);
    });

    const blockers = [];
    if (!courseLessons.length) blockers.push("No published lessons are available to verify learning completion.");
    if (incompleteLessons.length) blockers.push(`${incompleteLessons.length} published lesson(s) remain incomplete.`);
    if (incompleteAssignments.length) blockers.push(`${incompleteAssignments.length} published assignment(s) are not yet submitted and graded.`);
    if (incompleteAssessments.length) blockers.push(`${incompleteAssessments.length} published assessment(s) are not yet submitted and graded.`);
    if (missingAttendance.length) blockers.push(`${missingAttendance.length} completed session(s) have missing, absent, or unconfirmed attendance.`);

    return {
      eligible: blockers.length === 0,
      blockers,
      checks: [
        { label: "Published lessons", complete: courseLessons.length > 0 && incompleteLessons.length === 0, detail: `${courseLessons.length - incompleteLessons.length} of ${courseLessons.length} completed` },
        { label: "Assignments", complete: incompleteAssignments.length === 0, detail: `${courseAssignments.length - incompleteAssignments.length} of ${courseAssignments.length} graded` },
        { label: "Assessments", complete: incompleteAssessments.length === 0, detail: `${courseAssessments.length - incompleteAssessments.length} of ${courseAssessments.length} graded` },
        { label: "Completed-session attendance", complete: missingAttendance.length === 0, detail: `${completedSessions.length - missingAttendance.length} of ${completedSessions.length} confirmed` }
      ]
    };
  }

  function editCourse(course) {
    setEditingCourseId(course.id);
    setCourseForm({ title: course.title || "", category: course.category || COURSE_TYPES[0], description: course.description || "", mode: course.mode || "Online and onsite", duration: course.duration || "", fee: String(course.fee ?? ""), active: course.active !== false });
    setError(""); setNotice("Editing " + (course.title || "course") + ". Save changes when finished.");
  }

  function cancelCourseEdit() {
    setEditingCourseId("");
    setCourseForm(blankCourse);
    setNotice("");
    setError("");
  }

  async function saveCourse(e) {
    e.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      if (!courseForm.title.trim()) throw new Error("Enter a course title.");
      const fee = Number(courseForm.fee || 0);
      if (!Number.isFinite(fee) || fee < 0) throw new Error("Enter a valid course fee.");
      const courseData = { title: courseForm.title.trim(), category: courseForm.category, description: courseForm.description.trim(), mode: courseForm.mode.trim(), duration: courseForm.duration.trim(), fee, active: courseForm.active !== false, updatedAt: serverTimestamp() };
      if (editingCourseId) {
        await updateDoc(doc(db, "instituteCourses", editingCourseId), courseData);
        setNotice("Course details updated successfully.");
      } else {
        await addDoc(collection(db, "instituteCourses"), { ...courseData, active: true, createdBy: user.uid, createdAt: serverTimestamp() });
        setNotice("Course created successfully.");
      }
      setEditingCourseId(""); setCourseForm(blankCourse); await load();
    } catch(e) { setError(e.message || "Could not save course."); } finally { setBusy(false); }
  }

  async function toggleCourseArchive(course) {
    setBusy(true); setError(""); setNotice("");
    try {
      const nextActive = course.active === false;
      await updateDoc(doc(db, "instituteCourses", course.id), { active: nextActive, updatedAt: serverTimestamp() });
      if (editingCourseId === course.id && !nextActive) cancelCourseEdit();
      setNotice(nextActive ? "Course restored to the active catalogue." : "Course archived. Existing enrolment and learning records have been retained.");
      await load();
    } catch(e) { setError(e.message || "Could not update course status."); } finally { setBusy(false); }
  }

  function editWindow(item) {
    setEditingWindowId(item.id);
    setWindowForm({ title:item.title || "", courseId:item.courseId || "", applicationOpen:item.applicationOpen || "", applicationClose:item.applicationClose || "", commencement:item.commencement || "", duration:item.duration || "", modes:item.modes || ["Onsite"], fee:String(item.fee ?? ""), capacity:String(item.capacity ?? ""), timetable:item.timetable || "", venue:item.venue || "", instructorName:item.instructorName || "" });
    setError(""); setNotice("Editing " + item.title + ". Reserved applications will be retained.");
  }

  function cancelWindowEdit() {
    setEditingWindowId(""); setWindowForm(blankWindow); setError(""); setNotice("");
  }

  async function saveWindow(e) {
    e.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      if (!windowForm.title.trim() || !windowForm.courseId || !windowForm.applicationOpen || !windowForm.applicationClose || !windowForm.commencement) throw new Error("Complete the intake name, course and all application/commencement dates.");
      if (windowForm.applicationClose < windowForm.applicationOpen) throw new Error("Application closing date cannot be before opening date.");
      const capacity = Number(windowForm.capacity);
      const fee = Number(windowForm.fee);
      if (!Number.isInteger(capacity) || capacity < 1) throw new Error("Enter a whole-number student capacity.");
      if (!Number.isFinite(fee) || fee < 0) throw new Error("Enter a valid training fee.");
      const windowData = { ...windowForm, title:windowForm.title.trim(), capacity, fee, updatedAt:serverTimestamp() };
      if (editingWindowId) {
        const current = windows.find(w=>w.id===editingWindowId);
        if (!current) throw new Error("The training window could not be found. Refresh and try again.");
        if (capacity < Number(current.enrolledCount || 0)) throw new Error("Capacity cannot be reduced below the number of reserved applications (" + Number(current.enrolledCount || 0) + ").");
        await updateDoc(doc(db,"trainingWindows",editingWindowId),windowData);
        setNotice("Training window updated. Existing application reservations were preserved.");
      } else {
        await addDoc(collection(db, "trainingWindows"), { ...windowData, status: "open", enrolledCount: 0, createdBy: user.uid, createdAt: serverTimestamp() });
        setNotice("Training window created successfully.");
      }
      setEditingWindowId(""); setWindowForm(blankWindow); await load();
    } catch(e) { setError(e.message || "Could not save training window."); } finally { setBusy(false); }
  }

  async function reconcileTrainingCapacity() {
    if (!isAdmin) return;
    setBusy(true); setError(""); setNotice("");
    try {
      for (const windowItem of windows) {
        const windowRef = doc(db, "trainingWindows", windowItem.id);
        const initialWindow = await getDoc(windowRef);
        if (!initialWindow.exists()) continue;
        const initialData = initialWindow.data();
        const applicationQuery = query(collection(db, "instituteApplications"), where("windowId", "==", windowItem.id));
        const applicationSnap = await getDocs(applicationQuery);
        const reservedPlaces = applicationSnap.docs.filter(application => application.data().status !== "rejected").length;
        await runTransaction(db, async transaction => {
          const latestWindow = await transaction.get(windowRef);
          if (!latestWindow.exists()) return;
          const latestData = latestWindow.data();
          const initialUpdatedAt = initialData.updatedAt;
          const latestUpdatedAt = latestData.updatedAt;
          const sameUpdatedAt = (!initialUpdatedAt && !latestUpdatedAt) || (initialUpdatedAt?.seconds === latestUpdatedAt?.seconds && initialUpdatedAt?.nanoseconds === latestUpdatedAt?.nanoseconds);
          if (!sameUpdatedAt || Number(initialData.enrolledCount || 0) !== Number(latestData.enrolledCount || 0) || (initialData.lastApplicationId || "") !== (latestData.lastApplicationId || "")) {
            throw new Error("A training-window record changed during reconciliation. Run the reconciliation again to use a fresh application count.");
          }
          const currentCount = Number(latestData.enrolledCount || 0);
          if (currentCount !== reservedPlaces) {
            transaction.update(windowRef, { enrolledCount: reservedPlaces, updatedAt: serverTimestamp() });
          }
        });
      }
      setNotice("Training-window capacity counters reconciled against all non-rejected applications. Review each window's available places before reopening applications.");
      await load();
    } catch(e) { setError(e.message || "Could not reconcile training-window capacity."); } finally { setBusy(false); }
  }

  async function apply(e) {
    e.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      const course = courses.find(c => c.id === applicationForm.courseId);
      const win = windows.find(w => w.id === applicationForm.windowId);
      if (!course || !win || course.active === false) throw new Error("Select an active course and available training window.");
      if (!applicationForm.fullName.trim() || !applicationForm.phone.trim() || !applicationForm.address.trim()) throw new Error("Enter your full name, telephone number and residential address.");
      const ref = "MFO-INS-" + Date.now().toString(36).toUpperCase();
      const applicationRef = doc(collection(db, "instituteApplications"));
      const windowRef = doc(db, "trainingWindows", win.id);
      const applicationData = {
        applicationRef: ref, customerUid: user.uid, fullName: applicationForm.fullName.trim(), email: user.email || "",
        phone: applicationForm.phone.trim(), address: applicationForm.address.trim(), courseId: course.id, courseTitle: course.title,
        windowId: win.id, windowTitle: win.title, mode: applicationForm.mode, experience: applicationForm.experience.trim(),
        note: applicationForm.note.trim(), status: "pending", paymentStatus: "not_due", createdAt: serverTimestamp(), updatedAt: serverTimestamp()
      };
      await runTransaction(db, async transaction => {
        const latestWindowSnap = await transaction.get(windowRef);
        if (!latestWindowSnap.exists()) throw new Error("This training window no longer exists.");
        const latestWindow = latestWindowSnap.data();
        const today = new Date().toISOString().slice(0,10);
        if (latestWindow.status !== "open" || (latestWindow.applicationOpen && latestWindow.applicationOpen > today) || (latestWindow.applicationClose && latestWindow.applicationClose < today)) {
          throw new Error("This training window is not currently accepting applications.");
        }
        if (latestWindow.courseId !== course.id) throw new Error("The selected course does not match this training window.");
        const count = Number(latestWindow.enrolledCount || 0);
        const capacity = Number(latestWindow.capacity || 0);
        if (!Number.isInteger(count) || !Number.isInteger(capacity) || capacity < 1 || count >= capacity) {
          throw new Error("This training window has reached its stated capacity. Please select another window.");
        }
        transaction.update(windowRef, { enrolledCount: count + 1, lastApplicationId: applicationRef.id, updatedAt: serverTimestamp() });
        transaction.set(applicationRef, applicationData);
      });
      setNotice("Application submitted and a place has been reserved. Your reference is " + ref + ". Admission is not confirmed until reviewed by the Institute.");
      setApplicationForm(v => ({ ...v, experience: "", note: "" })); await load();
    } catch(e) { setError(e.message || "Could not submit application."); } finally { setBusy(false); }
  }

  async function reviewApplication(item, status) {
    setBusy(true); setError(""); setNotice("");
    try {
      if (item.status === "rejected" && status !== "rejected") throw new Error("A rejected application cannot be reopened against a released intake place. The applicant must submit a new application.");
      const applicationRef = doc(db, "instituteApplications", item.id);
      if (status === "rejected" && item.status !== "rejected") {
        const windowRef = doc(db, "trainingWindows", item.windowId);
        await runTransaction(db, async transaction => {
          const [applicationSnap, windowSnap] = await Promise.all([transaction.get(applicationRef), transaction.get(windowRef)]);
          if (!applicationSnap.exists() || !windowSnap.exists()) throw new Error("The application or its training window could not be found.");
          if (applicationSnap.data().status === "rejected") throw new Error("This application has already been rejected and its place released.");
          const count = Number(windowSnap.data().enrolledCount || 0);
          if (!Number.isInteger(count) || count < 1) throw new Error("The intake reservation count needs administrator reconciliation before this application can be rejected.");
          transaction.update(applicationRef, { status, updatedAt: serverTimestamp(), reviewedBy: user.uid, reviewedAt: serverTimestamp() });
          transaction.update(windowRef, { enrolledCount: count - 1, updatedAt: serverTimestamp() });
        });
      } else {
        const update = { status, updatedAt: serverTimestamp(), reviewedBy: user.uid, reviewedAt: serverTimestamp() };
        if (status === "admitted" && !item.studentId) update.studentId = "MFO-STU-" + Date.now().toString(36).toUpperCase();
        await updateDoc(applicationRef, update);
      }
      setNotice(status === "rejected" ? "Application rejected and its intake place released." : "Application " + status + "."); await load();
    } catch(e) { setError(e.message || "Could not update application."); } finally { setBusy(false); }
  }


  async function verifyTrainingPayment(item) {
    setBusy(true); setError(""); setNotice("");
    try {
      if (item.status !== "admitted") throw new Error("Only admitted applicants can have training payment verified.");
      if (!item.id || !item.customerUid || !item.courseId) throw new Error("The application is missing its student or course reference.");
      const applicationRef = doc(db, "instituteApplications", item.id);
      const enrollmentRef = doc(db, "instituteEnrollments", item.customerUid + "_" + item.courseId);
      await runTransaction(db, async transaction => {
        const [applicationSnap, enrollmentSnap] = await Promise.all([
          transaction.get(applicationRef),
          transaction.get(enrollmentRef)
        ]);
        if (!applicationSnap.exists()) throw new Error("The admission application no longer exists.");
        const application = applicationSnap.data();
        if (application.status !== "admitted") throw new Error("Only admitted applicants can have training payment verified.");
        if (application.customerUid !== item.customerUid || application.courseId !== item.courseId) throw new Error("The application identity or course changed. Refresh and try again.");
        const enrollmentData = {
          studentUid: application.customerUid,
          applicationId: item.id,
          applicationRef: application.applicationRef || "",
          studentId: application.studentId || "",
          studentName: application.fullName || "",
          studentEmail: application.email || "",
          courseId: application.courseId,
          courseTitle: application.courseTitle || "",
          windowId: application.windowId || "",
          windowTitle: application.windowTitle || "",
          paymentStatus: "paid",
          verifiedBy: user.uid,
          verifiedAt: serverTimestamp(),
          createdAt: enrollmentSnap.exists() && enrollmentSnap.data().createdAt
            ? enrollmentSnap.data().createdAt
            : serverTimestamp()
        };
        transaction.set(enrollmentRef, enrollmentData);
        transaction.update(applicationRef, {
          paymentStatus: "paid",
          paymentVerifiedBy: user.uid,
          paymentVerifiedAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      });
      await recordAuditEvent({ user, claims, action: "training_payment_verified", entityType: "instituteEnrollment", entityId: item.customerUid + "_" + item.courseId, summary: "Verified paid access for " + (item.fullName || item.email || item.customerUid) + " in " + (item.courseTitle || item.courseId) + "." });
      let mediaNotice = "";
      if (item.email) {
        try {
          const lessonSnap = await getDocs(query(collection(db, "instituteLessons"), where("courseId", "==", item.courseId), where("published", "==", true)));
          for (const lesson of lessonSnap.docs) {
            const fileId = lesson.data().driveFileId;
            if (fileId) await shareDriveFileWithEmail(fileId, item.email);
          }
        } catch (shareError) {
          mediaNotice = " Course access is active, but Drive could not share every existing lesson file. Ask the Institute administrator to retry media access.";
        }
      }
      setNotice("Payment marked verified and course access activated. Confirm funds have actually arrived before using this action." + mediaNotice);
      await load();
    } catch(e) { setError(e.message || "Could not verify training payment."); } finally { setBusy(false); }
  }
  async function manageCourseMediaAccess(enrollment, action) {
    if (!isAdmin) {
      setError("Only Institute administrators, Managers or the Super Admin can manage Google Drive lesson permissions.");
      return;
    }
    if (!enrollment?.studentEmail || !enrollment?.courseId) {
      setError("This enrolment has no student email or course reference for Drive access management.");
      return;
    }
    if (action === "grant" && enrollment.paymentStatus !== "paid") {
      setError("Drive lesson access can only be granted to a learner with verified paid status.");
      return;
    }
    if (action === "revoke" && !window.confirm("Remove this student's direct Google Drive access to all lesson files in this course? This does not change the enrolment or payment status.")) return;
    const actionKey = enrollment.id + ":" + action;
    setMediaAccessAction(actionKey); setError(""); setNotice("");
    try {
      const lessonSnap = await getDocs(query(collection(db, "instituteLessons"), where("courseId", "==", enrollment.courseId), where("published", "==", true)));
      const fileIds = lessonSnap.docs.map(item => item.data().driveFileId).filter(Boolean);
      if (!fileIds.length) throw new Error("No published Google Drive lesson files were found for this course.");
      if (action === "grant") {
        for (const fileId of fileIds) await shareDriveFileWithEmail(fileId, enrollment.studentEmail);
        setNotice("Drive lesson access was granted or confirmed for " + enrollment.studentEmail + " across " + fileIds.length + " lesson file(s).");
      } else {
        const result = await revokeDriveFileAccessForEmail(fileIds, enrollment.studentEmail);
        setNotice("Drive access removal processed for " + enrollment.studentEmail + ": " + result.revoked + " direct permission(s) removed across " + result.filesChecked + " file(s)." + (result.skippedInherited ? " " + result.skippedInherited + " inherited permission(s) could not be removed here." : ""));
      }
    } catch (e) {
      setError(e.message || "Could not update Google Drive lesson access.");
    } finally {
      setMediaAccessAction("");
    }
  }

  async function withdrawEnrollment(enrollment) {
    if (!isAdmin || !enrollment?.id) return;
    if (enrollment.enrollmentStatus === "withdrawn") {
      setError("This learner is already withdrawn. Use the Drive revoke control to retry any remaining direct file permissions.");
      return;
    }
    const reason = window.prompt("Reason for withdrawing this learner and disabling course access (at least 5 characters):");
    if (reason === null) return;
    const cleanReason = reason.trim();
    if (cleanReason.length < 5 || cleanReason.length > 500) {
      setError("Enter a withdrawal reason between 5 and 500 characters.");
      return;
    }
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await runTransaction(db, async transaction => {
        const enrollmentRef = doc(db, "instituteEnrollments", enrollment.id);
        const applicationRef = doc(db, "instituteApplications", enrollment.applicationId);
        const windowRef = doc(db, "trainingWindows", enrollment.windowId);
        const enrollmentSnap = await transaction.get(enrollmentRef);
        const applicationSnap = await transaction.get(applicationRef);
        const windowSnap = await transaction.get(windowRef);
        if (!enrollmentSnap.exists() || !applicationSnap.exists() || !windowSnap.exists()) {
          throw new Error("The enrolment, application or training intake could not be found. Refresh and try again.");
        }
        const currentEnrollment = enrollmentSnap.data();
        const currentApplication = applicationSnap.data();
        const currentWindow = windowSnap.data();
        if (currentEnrollment.enrollmentStatus === "withdrawn" || currentApplication.status === "withdrawn") return false;
        if (currentEnrollment.paymentStatus !== "paid" || currentApplication.status !== "admitted") {
          throw new Error("Only an admitted learner with verified paid enrolment can be withdrawn here.");
        }
        const enrolledCount = Number(currentWindow.enrolledCount || 0);
        if (!Number.isInteger(enrolledCount) || enrolledCount < 1) {
          throw new Error("The intake enrolment count is inconsistent. Review the intake before withdrawing this learner.");
        }
        transaction.update(enrollmentRef, {
          enrollmentStatus: "withdrawn", withdrawalReason: cleanReason,
          withdrawnBy: user.uid, withdrawnAt: serverTimestamp(), updatedAt: serverTimestamp()
        });
        transaction.update(applicationRef, {
          status: "withdrawn", withdrawalReason: cleanReason,
          withdrawnBy: user.uid, withdrawnAt: serverTimestamp(), updatedAt: serverTimestamp()
        });
        transaction.update(windowRef, {
          enrolledCount: enrolledCount - 1, updatedAt: serverTimestamp()
        });
        return true;
      });
      if (!result) {
        setNotice("This learner was already withdrawn. Check Drive access and retry revocation if needed.");
        await load();
        return;
      }
      setAllEnrollments(rows => rows.map(row => row.id === enrollment.id
        ? { ...row, enrollmentStatus: "withdrawn", withdrawalReason: cleanReason }
        : row));
      setApplications(rows => rows.map(row => row.id === enrollment.applicationId
        ? { ...row, status: "withdrawn", withdrawalReason: cleanReason }
        : row));
      try {
        await recordAuditEvent({
          user, claims, action: "institute_enrollment_withdrawn",
          entityType: "instituteEnrollment", entityId: enrollment.id,
          summary: "Withdrew " + (enrollment.studentName || enrollment.studentEmail || enrollment.studentUid) + " from " + (enrollment.courseTitle || enrollment.courseId) + " and disabled Firestore course access."
        });
      } catch (auditError) {
        console.warn("Institute withdrawal audit event could not be recorded:", auditError);
      }
      let driveSummary = "";
      if (enrollment.studentEmail) {
        try {
          const lessonSnap = await getDocs(query(
            collection(db, "instituteLessons"),
            where("courseId", "==", enrollment.courseId),
            where("published", "==", true)
          ));
          const fileIds = lessonSnap.docs.map(item => item.data().driveFileId).filter(Boolean);
          if (fileIds.length) {
            const revoked = await revokeDriveFileAccessForEmail(fileIds, enrollment.studentEmail);
            driveSummary = " Google Drive revocation processed: " + revoked.revoked + " direct permission(s) removed across " + revoked.filesChecked + " file(s)." + (revoked.skippedInherited ? " " + revoked.skippedInherited + " inherited permission(s) require owner review." : "");
          } else {
            driveSummary = " No published Drive lesson files were found for this course.";
          }
        } catch (driveError) {
          driveSummary = " Firestore course access is disabled, but Google Drive permission removal failed. Use the Drive revoke control below to retry. " + (driveError.message || "");
        }
      } else {
        driveSummary = " Firestore course access is disabled, but no student email is recorded for Drive permission removal.";
      }
      setNotice("Learner withdrawn. Course access is disabled in Firestore. This action does not refund the course fee." + driveSummary);
      await load();
    } catch (err) {
      setError(err.message || "Could not withdraw this learner.");
    } finally {
      setBusy(false);
    }
  }

  async function createLesson(e) {
    e.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      if (!lessonForm.courseId || !lessonForm.title.trim()) throw new Error("Select a course and enter a lesson title.");
      if ((lessonForm.videoUrl.trim() && !lessonForm.videoUrl.startsWith("https://")) || (lessonForm.resourceUrl.trim() && !lessonForm.resourceUrl.startsWith("https://"))) throw new Error("Learning links must use HTTPS.");
      let videoUrl = lessonForm.videoUrl.trim();
      let resourceUrl = lessonForm.resourceUrl.trim();
      let driveFileId = "";
      let driveFileName = "";
      let driveFileType = "";
      if (lessonUploadFile) {
        const allowed = ["application/pdf", "image/jpeg", "image/png", "image/webp", "video/mp4", "video/webm", "video/quicktime"];
        if (!allowed.includes(lessonUploadFile.type)) throw new Error("Upload a PDF, JPG, PNG, WebP, MP4, WebM or MOV lesson file.");
        if (lessonUploadFile.size > 100 * 1024 * 1024) throw new Error("Each Institute lesson file must be 100 MB or smaller.");
        const studentEmails = [...new Set(allEnrollments
          .filter(en => en.courseId === lessonForm.courseId && en.paymentStatus === "paid")
          .map(en => String(en.studentEmail || "").trim().toLowerCase())
          .filter(email => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))];
        const uploaded = await uploadFileToGoogleDrive(lessonUploadFile, {
          folder: "Institute/Courses/" + lessonForm.courseId + "/Lessons",
          uploadedBy: user.uid,
          shareWithEmails: studentEmails
        });
        driveFileId = uploaded.fileId;
        driveFileName = uploaded.name;
        driveFileType = uploaded.mimeType;
        if (lessonUploadFile.type.startsWith("video/")) videoUrl = uploaded.drivePreviewUrl;
        else resourceUrl = uploaded.webViewLink;
      }
      await addDoc(collection(db, "instituteLessons"), {
        courseId:lessonForm.courseId,
        title:lessonForm.title.trim(),
        module:lessonForm.module.trim(),
        type:lessonUploadFile?.type.startsWith("video/") ? "Video lesson" : lessonForm.type,
        content:lessonForm.content.trim(),
        videoUrl,
        resourceUrl,
        driveFileId,
        driveFileName,
        driveFileType,
        fileAccess: driveFileId ? "paid_enrolment" : "external_link",
        sequence:Number(lessonForm.sequence||1),
        published:true,
        createdBy:user.uid,
        createdAt:serverTimestamp(),
        updatedAt:serverTimestamp()
      });
      setLessonForm(v=>({...v,title:"",module:"",content:"",videoUrl:"",resourceUrl:""}));
      setLessonUploadFile(null);
      setNotice("Lesson published. Uploaded Drive files are shared with current paid students and will be shared with new students when their payment is verified.");
      await load();
    } catch(e) { setError(e.message || "Could not publish lesson."); } finally { setBusy(false); }
  }

  async function createAssignment(e) {
    e.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      if (!assignmentForm.courseId || !assignmentForm.title.trim() || !assignmentForm.instructions.trim()) throw new Error("Choose a course and provide an assignment title and instructions.");
      const points = Number(assignmentForm.points || 100);
      if (!Number.isFinite(points) || points < 1) throw new Error("Enter a valid maximum score.");
      const dueAt = assignmentForm.dueDate ? Timestamp.fromDate(new Date(assignmentForm.dueDate + "T23:59:59")) : null;
      if (dueAt && dueAt.toDate() < new Date()) throw new Error("The assignment due date cannot be in the past.");
      await addDoc(collection(db, "instituteAssignments"), { courseId: assignmentForm.courseId, courseTitle: courses.find(c=>c.id===assignmentForm.courseId)?.title || "", title: assignmentForm.title.trim(), instructions: assignmentForm.instructions.trim(), dueDate: assignmentForm.dueDate || "", dueAt, points, published: true, createdBy: user.uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      setAssignmentForm(v=>({...v,title:"",instructions:"",dueDate:""})); setNotice("Assignment published to paid students in the selected course."); await load();
    } catch(e) { setError(e.message || "Could not publish assignment."); } finally { setBusy(false); }
  }

  async function submitAssignment(item) {
    setBusy(true); setError(""); setNotice("");
    try {
      const answer = (submissionDrafts[item.id] || "").trim();
      if (!answer) throw new Error("Enter your assignment response before submitting.");
      if (item.dueAt?.toDate && item.dueAt.toDate().getTime() < Date.now()) throw new Error("The assignment submission deadline has passed.");
      if (submissions.some(s=>s.assignmentId===item.id)) throw new Error("You have already submitted this assignment. Contact your instructor if a correction is required.");
      await addDoc(collection(db, "instituteSubmissions"), { assignmentId:item.id, courseId:item.courseId, assignmentTitle:item.title, studentUid:user.uid, studentName:user.displayName || user.email || "Student", answer, status:"submitted", submittedAt:serverTimestamp(), createdAt:serverTimestamp(), updatedAt:serverTimestamp() });
      setNotice("Your assignment has been submitted."); setSubmissionDrafts(v=>({...v,[item.id]:""})); await load();
    } catch(e) { setError(e.message || "Could not submit assignment."); } finally { setBusy(false); }
  }

  async function gradeSubmission(item, status) {
    const scoreText = window.prompt("Enter score (0 to " + (assignments.find(a=>a.id===item.assignmentId)?.points || 100) + ")");
    if (scoreText === null) return;
    const score = Number(scoreText);
    const max = Number(assignments.find(a=>a.id===item.assignmentId)?.points || 100);
    if (!Number.isFinite(score) || score < 0 || score > max) { setError("Enter a valid score within the assignment maximum."); return; }
    const feedback = window.prompt("Optional instructor feedback") || "";
    setBusy(true); setError(""); setNotice("");
    try {
      await updateDoc(doc(db,"instituteSubmissions",item.id), { status, score, maxScore:max, feedback, gradedBy:user.uid, gradedAt:serverTimestamp(), updatedAt:serverTimestamp() });
      setNotice("Submission graded."); await load();
    } catch(e) { setError(e.message || "Could not grade submission."); } finally { setBusy(false); }
  }

  async function createAssessment(e) {
    e.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      if (!assessmentForm.courseId || !assessmentForm.title.trim()) throw new Error("Choose a course and enter an assessment title.");
      let questions = [];
      let correctOptions = [];
      if (assessmentForm.assessmentType === "objective") {
        const rows = assessmentForm.questions.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
        if (!rows.length) throw new Error("Add at least one objective question.");
        if (rows.length > 30) throw new Error("An assessment can contain up to 30 questions.");
        rows.forEach((line, index) => {
          const parts = line.split("|").map(part => part.trim());
          if (parts.length !== 6) throw new Error("Objective question " + (index + 1) + " must contain a question, four options and the correct letter, separated by |.");
          const [text, ...tail] = parts;
          const correct = tail.pop().toUpperCase();
          const options = tail;
          if (!text || options.some(option => !option) || new Set(options.map(option => option.toLowerCase())).size !== 4 || !["A","B","C","D"].includes(correct)) {
            throw new Error("Check objective question " + (index + 1) + ": provide four different options and a correct letter A, B, C or D.");
          }
          questions.push({ text, options });
          correctOptions.push(correct);
        });
      } else {
        questions = assessmentForm.questions.split(/\r?\n/).map(q => q.trim()).filter(Boolean);
        if (!questions.length) throw new Error("Add at least one written question (one per line).");
        if (questions.length > 30) throw new Error("An assessment can contain up to 30 questions.");
      }
      const course = courses.find(c => c.id === assessmentForm.courseId);
      if (!course) throw new Error("Select a valid course.");
      const dueAt = assessmentForm.dueDate ? Timestamp.fromDate(new Date(assessmentForm.dueDate + "T23:59:59")) : null;
      if (dueAt && dueAt.toDate() < new Date()) throw new Error("The assessment due date cannot be in the past.");
      const assessmentRef = doc(collection(db, "instituteAssessments"));
      const batch = writeBatch(db);
      const assessmentData = { courseId:course.id, courseTitle:course.title, title:assessmentForm.title.trim(), instructions:assessmentForm.instructions.trim(), dueDate:assessmentForm.dueDate || "", dueAt, questions, assessmentType:assessmentForm.assessmentType, published:true, createdBy:user.uid, createdAt:serverTimestamp(), updatedAt:serverTimestamp() };
      batch.set(assessmentRef, assessmentData);
      if (assessmentForm.assessmentType === "objective") {
        batch.set(doc(db, "instituteAssessmentAnswerKeys", assessmentRef.id), { assessmentId:assessmentRef.id, courseId:course.id, correctOptions, pointsPerQuestion:10, createdBy:user.uid, createdAt:serverTimestamp() });
      }
      await batch.commit();
      setAssessmentForm({ courseId:"", title:"", instructions:"", dueDate:"", assessmentType:"written", questions:"" });
      setNotice(assessmentForm.assessmentType === "objective" ? "Objective assessment published. Correct answers are stored separately and will be marked by the secure grading service." : "Written assessment published. Responses will be manually graded by authorized teaching staff.");
      await load();
    } catch(e) { setError(e.message || "Could not publish assessment."); } finally { setBusy(false); }
  }

  async function submitAssessment(item) {
    setBusy(true); setError(""); setNotice("");
    try {
      const answers = item.questions.map((q,i) => (assessmentDrafts[item.id + "_" + i] || "").trim());
      if (item.dueAt?.toDate && item.dueAt.toDate().getTime() < Date.now()) throw new Error("The submission deadline has passed.");
      if (answers.some(a => !a)) throw new Error("Answer every question before submitting.");
      if (assessmentSubmissions.some(s => s.assessmentId === item.id && s.studentUid === user.uid)) throw new Error("You have already submitted this assessment.");
      const submissionId = user.uid + "_" + item.id;
      if (item.assessmentType === "objective") {
        const endpoint = import.meta.env.VITE_ASSESSMENT_GRADING_URL;
        if (!endpoint) throw new Error("The secure assessment grading service has not been configured yet. Please contact the Institute.");
        const idToken = await user.getIdToken();
        await fetch(endpoint, { method:"POST", mode:"no-cors", headers:{ "Content-Type":"text/plain;charset=utf-8" }, body:JSON.stringify({ action:"submitObjectiveAssessment", idToken, assessmentId:item.id, answers }) });
        let saved = false;
        for (let attempt=0; attempt<10; attempt++) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          const result = await getDoc(doc(db, "instituteAssessmentSubmissions", submissionId));
          if (result.exists()) { saved = true; break; }
        }
        if (!saved) throw new Error("Your submission request was sent, but the grading result has not appeared yet. Refresh your account shortly; if it remains missing, contact the Institute.");
        setNotice("Objective assessment submitted and automatically marked. Your score is now available.");
      } else {
        await setDoc(doc(db, "instituteAssessmentSubmissions", submissionId), { assessmentId:item.id, courseId:item.courseId, assessmentTitle:item.title, studentUid:user.uid, studentName:user.displayName || user.email || "Student", answers, status:"submitted", submittedAt:serverTimestamp(), createdAt:serverTimestamp(), updatedAt:serverTimestamp() });
        setNotice("Written assessment submitted successfully. It will be graded by authorized teaching staff.");
      }
      await load();
    } catch(e) { setError(e.message || "Could not submit assessment."); } finally { setBusy(false); }
  }

  async function gradeAssessment(item) {
    const draft = assessmentGradeDrafts[item.id] || {};
    const score = Number(draft.score);
    const maxScore = item.answers.length * 10;
    if (draft.score === undefined || String(draft.score).trim() === "" || !Number.isFinite(score) || score < 0 || score > maxScore) {
      setError("Enter a valid score between 0 and " + maxScore + ".");
      return;
    }
    const feedback = String(draft.feedback || "").trim();
    setBusy(true); setError(""); setNotice("");
    try {
      await updateDoc(doc(db, "instituteAssessmentSubmissions", item.id), { status:"graded", score, maxScore, feedback, gradedBy:user.uid, gradedAt:serverTimestamp(), updatedAt:serverTimestamp() });
      setAssessmentGradeDrafts(current => { const next = { ...current }; delete next[item.id]; return next; });
      setNotice("Assessment graded and feedback saved."); await load();
    } catch(e) { setError(e.message || "Could not grade assessment."); } finally { setBusy(false); }
  }

  async function assignInstructor(e) {
    e.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      const instructorUid = instructorForm.instructorUid.trim();
      const courseId = instructorForm.courseId;
      if (!instructorUid || !courseId) throw new Error("Enter the instructor Firebase user UID and select a course.");
      const assignmentId = instructorUid + "_" + courseId;
      await setDoc(doc(db, "instituteInstructorAssignments", assignmentId), { instructorUid, courseId, courseTitle: courses.find(c => c.id === courseId)?.title || "", active: true, assignedBy: user.uid, assignedAt: serverTimestamp(), updatedAt: serverTimestamp() });
      setInstructorForm({ instructorUid: "", courseId: "" }); setNotice("Instructor assigned to the selected course."); await load();
    } catch(e) { setError(e.message || "Could not assign instructor."); } finally { setBusy(false); }
  }

  async function saveInstructorProfile(e) {
    e.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      const fullName = myInstructorProfile.fullName.trim();
      if (!fullName) throw new Error("Enter your professional name.");
      if (myInstructorProfile.phone && !/^[+0-9()\s-]{7,25}$/.test(myInstructorProfile.phone)) throw new Error("Enter a valid contact telephone number.");
      const profile = {
        instructorUid: user.uid, fullName, phone: myInstructorProfile.phone.trim(),
        qualifications: myInstructorProfile.qualifications.trim().slice(0,500),
        specialization: myInstructorProfile.specialization.trim().slice(0,300),
        bio: myInstructorProfile.bio.trim().slice(0,1500),
        availability: myInstructorProfile.availability.trim().slice(0,500),
        updatedAt: serverTimestamp()
      };
      await setDoc(doc(db, "instituteInstructorProfiles", user.uid), { ...profile, createdAt: myInstructorProfile.createdAt || serverTimestamp() }, { merge: true });
      setMyInstructorProfile(profile); setNotice("Instructor profile saved.");
    } catch(e) { setError(e.message || "Could not save instructor profile."); } finally { setBusy(false); }
  }

  async function scheduleSession(e) {
    e.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      const course = courses.find(c => c.id === sessionForm.courseId);
      const assignment = allInstructorAssignments.find(a => a.courseId === sessionForm.courseId && a.instructorUid === sessionForm.instructorUid && a.active);
      if (!course || !assignment) throw new Error("Choose a course and an instructor actively assigned to it.");
      if (!sessionForm.title.trim() || !sessionForm.startsAt || !sessionForm.endsAt) throw new Error("Enter a session title, start time and end time.");
      if (new Date(sessionForm.endsAt) <= new Date(sessionForm.startsAt)) throw new Error("The session end time must be later than its start time.");
      if (sessionForm.mode === "Online" && sessionForm.meetingUrl && !/^https:\/\//i.test(sessionForm.meetingUrl)) throw new Error("Online meeting links must use HTTPS.");
      await addDoc(collection(db, "instituteSessions"), {
        courseId: course.id, courseTitle: course.title, instructorUid: assignment.instructorUid,
        title: sessionForm.title.trim(), startsAt: sessionForm.startsAt, endsAt: sessionForm.endsAt,
        mode: sessionForm.mode, venue: sessionForm.venue.trim(), meetingUrl: sessionForm.meetingUrl.trim(),
        notes: sessionForm.notes.trim(), status: "scheduled", published: true,
        createdBy: user.uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp()
      });
      setSessionForm({ courseId: "", instructorUid: "", title: "", startsAt: "", endsAt: "", mode: "Onsite", venue: "MR FOP FASHIONS, Ijebu Ode", meetingUrl: "", notes: "" });
      setNotice("Training session scheduled and published to enrolled students."); await load();
    } catch(e) { setError(e.message || "Could not schedule training session."); } finally { setBusy(false); }
  }

  async function updateSessionStatus(session, status) {
    setBusy(true); setError(""); setNotice("");
    try { await updateDoc(doc(db, "instituteSessions", session.id), { status, updatedAt: serverTimestamp() }); setNotice("Session status updated."); await load(); }
    catch(e) { setError(e.message || "Could not update session status."); } finally { setBusy(false); }
  }

  async function publishAnnouncement(e) {
    e.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      const title = announcementForm.title.trim();
      const message = announcementForm.message.trim();
      if (!title || !message) throw new Error("Enter an announcement title and message.");
      if (announcementForm.expiresOn && announcementForm.expiresOn < new Date().toISOString().slice(0,10)) throw new Error("The expiry date cannot be in the past.");
      await addDoc(collection(db, "instituteAnnouncements"), {
        courseId: announcementForm.courseId || "all", title, message,
        expiresOn: announcementForm.expiresOn || "", audience: announcementForm.courseId === "all" ? "all_students" : "paid_course_students",
        createdBy: user.uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp()
      });
      setAnnouncementForm({ courseId: "all", title: "", message: "", expiresOn: "" });
      setNotice("Institute announcement published."); await load();
    } catch(e) { setError(e.message || "Could not publish announcement."); } finally { setBusy(false); }
  }

  function printCertificate(certificate) {
    const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
    const issuedDate = certificate.issuedAt?.toDate ? certificate.issuedAt.toDate().toLocaleDateString() : new Date().toLocaleDateString();
    const printWindow = window.open("", "_blank", "width=1100,height=800");
    if (!printWindow) { setError("Your browser blocked the certificate window. Allow pop-ups for this site and try again."); return; }
    printWindow.document.open();
    printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Certificate - ${escapeHtml(certificate.certificateRef)}</title><style>
      @page { size: landscape; margin: 12mm; }
      * { box-sizing: border-box; } body { margin: 0; padding: 24px; color: #20252b; font-family: Georgia, 'Times New Roman', serif; }
      .certificate { min-height: 175mm; border: 9px double #8a6b36; padding: 24px 42px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; position: relative; }
      .brand { font: bold 18px Arial,sans-serif; letter-spacing: 5px; color: #6d253b; } .eyebrow { margin-top: 26px; font: 12px Arial,sans-serif; letter-spacing: 4px; }
      h1 { margin: 12px 0; font-size: 42px; color: #6d253b; } .intro { font-size: 18px; } .student { margin: 18px 0 10px; font-size: 34px; border-bottom: 1px solid #a58a58; padding: 0 30px 8px; }
      .course { max-width: 850px; font-size: 25px; font-weight: bold; } .details { margin-top: 28px; display: flex; justify-content: space-between; width: 100%; font: 12px Arial,sans-serif; }
      .ref { position: absolute; bottom: 12px; right: 18px; font: 10px Arial,sans-serif; color: #555; } .status { margin-top: 18px; font: 11px Arial,sans-serif; letter-spacing: 2px; }
      @media print { body { padding: 0; } .certificate { min-height: 180mm; } }
    </style></head><body><main class="certificate"><div class="brand">MR FOP FASHIONS</div><div class="eyebrow">FASHION INSTITUTE</div><h1>Certificate of Completion</h1><p class="intro">This is to certify that</p><div class="student">${escapeHtml(certificate.studentName || "Student")}</div><p class="intro">has successfully completed the training programme in</p><div class="course">${escapeHtml(certificate.courseTitle || "Fashion Training")}</div><div class="details"><span>Student ID: ${escapeHtml(certificate.studentId || "—")}</span><span>Issued: ${escapeHtml(issuedDate)}</span><span>Intake: ${escapeHtml(certificate.windowTitle || "—")}</span></div><div class="status">CERTIFICATE STATUS: ${escapeHtml(String(certificate.status || "issued").toUpperCase())}</div><div class="ref">Verification reference: ${escapeHtml(certificate.certificateRef)}</div></main><script>window.addEventListener("load",()=>window.print());</script></body></html>`);
    printWindow.document.close();
  }

  async function issueCertificate() {
    setBusy(true); setError(""); setNotice("");
    try {
      const enrollment = allEnrollments.find(item => item.id === certificateEnrollmentId);
      if (!enrollment || enrollment.paymentStatus !== "paid") throw new Error("Select a student with verified paid-course access.");
      const completion = getCourseCompletionStatus(enrollment);
      if (!completion.eligible) throw new Error("Certificate issuance is blocked until all completion checks are satisfied: " + completion.blockers.join(" "));
      const certificateId = enrollment.studentUid + "_" + enrollment.courseId;
      if (allCertificates.some(item => item.id === certificateId)) throw new Error("A certificate has already been issued for this student and course.");
      const certificateRef = "MFO-CERT-" + Date.now().toString(36).toUpperCase();
      const issuedAt = serverTimestamp();
      const certificateData = {
        certificateRef, studentUid: enrollment.studentUid, studentId: enrollment.studentId || "",
        studentName: enrollment.studentName || enrollment.studentEmail || "Student",
        courseId: enrollment.courseId, courseTitle: enrollment.courseTitle || "Fashion training",
        windowId: enrollment.windowId || "", windowTitle: enrollment.windowTitle || "",
        status: "issued", issuedAt, issuedBy: user.uid, createdAt: issuedAt
      };
      const publicCertificateData = {
        certificateRef, studentName: certificateData.studentName, courseTitle: certificateData.courseTitle,
        windowTitle: certificateData.windowTitle, status: "issued", issuedAt,
        updatedAt: issuedAt
      };
      const completionApproval = {
        studentUid: enrollment.studentUid,
        courseId: enrollment.courseId,
        certificateRef,
        status: "approved",
        checks: completion.checks,
        approvedBy: user.uid,
        approvedAt: issuedAt,
        createdAt: issuedAt
      };
      const batch = writeBatch(db);
      batch.set(doc(db, "instituteCompletionApprovals", certificateId), completionApproval);
      batch.set(doc(db, "instituteCertificates", certificateId), certificateData);
      batch.set(doc(db, "publicCertificateVerifications", certificateRef), publicCertificateData);
      await batch.commit();
      setCertificateEnrollmentId("");
      setNotice("Certificate issued: " + certificateRef + ". All recorded course completion checks were satisfied.");
      await load();
    } catch(e) { setError(e.message || "Could not issue certificate."); } finally { setBusy(false); }
  }

  async function publishCertificateVerification(certificate) {
    setBusy(true); setError(""); setNotice("");
    try {
      const publicRecord = {
        certificateRef: certificate.certificateRef,
        studentName: certificate.studentName || "Student",
        courseTitle: certificate.courseTitle || "Fashion training",
        windowTitle: certificate.windowTitle || "",
        status: certificate.status === "revoked" ? "revoked" : "issued",
        issuedAt: certificate.issuedAt,
        updatedAt: serverTimestamp(),
        ...(certificate.status === "revoked" ? {
          revokedAt: certificate.revokedAt || certificate.updatedAt || certificate.issuedAt,
          revocationReason: certificate.revocationReason || "Revoked by the Institute. Contact the Institute for confirmation."
        } : {})
      };
      await setDoc(doc(db, "publicCertificateVerifications", certificate.certificateRef), publicRecord, { merge: true });
      setNotice("Public verification record refreshed for " + certificate.certificateRef + ".");
    } catch(e) { setError(e.message || "Could not publish the verification record. Confirm the latest Firestore rules are published."); }
    finally { setBusy(false); }
  }

  async function revokeCertificate(certificate) {
    const reason = String(certificateRevocationDrafts[certificate.id] || "").trim();
    if (reason.length < 8) { setError("Enter a clear revocation reason of at least 8 characters."); return; }
    if (certificate.status !== "issued") { setError("Only an issued certificate can be revoked."); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      const revokedAt = serverTimestamp();
      const batch = writeBatch(db);
      batch.update(doc(db, "instituteCertificates", certificate.id), {
        status: "revoked", revocationReason: reason, revokedBy: user.uid,
        revokedAt, updatedAt: revokedAt
      });
      batch.set(doc(db, "publicCertificateVerifications", certificate.certificateRef), {
        certificateRef: certificate.certificateRef, studentName: certificate.studentName || "Student",
        courseTitle: certificate.courseTitle || "Fashion training", windowTitle: certificate.windowTitle || "",
        status: "revoked", issuedAt: certificate.issuedAt || null, revokedAt,
        revocationReason: reason, updatedAt: revokedAt
      }, { merge: true });
      await batch.commit();
      setCertificateRevocationDrafts(current => { const next = { ...current }; delete next[certificate.id]; return next; });
      setNotice("Certificate " + certificate.certificateRef + " has been marked revoked. Its record has been retained.");
      await load();
    } catch(e) { setError(e.message || "Could not revoke certificate."); } finally { setBusy(false); }
  }

  async function markAttendance(enrollment, status) {
    setBusy(true); setError(""); setNotice("");
    try {
      if (!attendanceDate) throw new Error("Choose the attendance date.");
      const recordId = enrollment.studentUid + "_" + enrollment.courseId + "_" + attendanceDate;
      await setDoc(doc(db, "instituteAttendance", recordId), { studentUid: enrollment.studentUid, studentId: enrollment.studentId || "", studentName: enrollment.studentName || enrollment.studentEmail || "Student", courseId: enrollment.courseId, courseTitle: enrollment.courseTitle || "", windowId: enrollment.windowId || "", date: attendanceDate, status, markedBy: user.uid, markedAt: serverTimestamp(), updatedAt: serverTimestamp() });
      setNotice("Attendance saved for " + (enrollment.studentName || enrollment.studentEmail || "student") + "."); await load();
    } catch(e) { setError(e.message || "Could not save attendance."); } finally { setBusy(false); }
  }

  async function markLessonComplete(lesson) {
    setBusy(true); setError(""); setNotice("");
    try {
      const progressId = user.uid + "_" + lesson.id;
      await setDoc(doc(db, "instituteLessonProgress", progressId), { studentUid:user.uid, courseId:lesson.courseId, lessonId:lesson.id, lessonTitle:lesson.title, completed:true, completedAt:serverTimestamp(), updatedAt:serverTimestamp() });
      setNotice("Lesson marked as completed."); await load();
    } catch(e) { setError(e.message || "Could not update lesson progress."); } finally { setBusy(false); }
  }

  async function changeWindowStatus(item, status) {
    setBusy(true); setError(""); setNotice("");
    try { await updateDoc(doc(db, "trainingWindows", item.id), { status, updatedAt: serverTimestamp() }); setNotice("Training window updated."); await load(); }
    catch(e) { setError(e.message || "Could not update training window."); } finally { setBusy(false); }
  }

  if (!user) return null;
  return <section className="institute-workspace">
    <div className="customer-management-heading institute-workspace-heading"><div><img className="institute-workspace-logo" src="/mrfob/mr-fop-fashion-institute-logo.webp" alt="MR FOP Fashion Institute" /><h3>MR FOP Fashion Institute</h3><p>Courses, training intakes and admission applications</p></div><button type="button" onClick={load}>Refresh institute</button></div>
    {isAdmin && <div className="dashboard-grid institute-dashboard-summary" aria-label="Institute administration overview">
      <article className="dashboard-tile"><strong>{courses.length}</strong><span>Course records</span><small>Course catalogue</small></article>
      <article className="dashboard-tile"><strong>{windows.filter(w=>w.status==="open").length}</strong><span>Open training windows</span><small>Admissions</small></article>
      <article className="dashboard-tile"><strong>{applications.filter(a=>["pending","submitted","more_information"].includes(a.status)).length}</strong><span>Applications needing review</span><small>Admissions queue</small></article>
      <article className="dashboard-tile"><strong>{allEnrollments.filter(e=>e.paymentStatus==="paid").length}</strong><span>Recorded enrolments</span><small>Paid course access</small></article>
      <article className="dashboard-tile"><strong>{sessions.filter(s=>s.status==="scheduled").length}</strong><span>Scheduled teaching sessions</span><small>Timetable</small></article>
      <article className="dashboard-tile"><strong>{allInstructorAssignments.filter(a=>a.active).length}</strong><span>Active instructor assignments</span><small>Teaching team</small></article>
    </div>}
    {isInstructor && <div className="dashboard-grid institute-dashboard-summary" aria-label="Instructor overview">
      <article className="dashboard-tile"><strong>{instructorAssignments.length}</strong><span>Assigned courses</span><small>Teaching portfolio</small></article>
      <article className="dashboard-tile"><strong>{allEnrollments.length}</strong><span>Paid learner enrolments</span><small>Assigned courses</small></article>
      <article className="dashboard-tile"><strong>{assignments.length}</strong><span>Course assignments</span><small>Learning activities</small></article>
      <article className="dashboard-tile"><strong>{sessions.filter(s=>s.instructorUid===user.uid && s.status==="scheduled").length}</strong><span>Scheduled teaching sessions</span><small>Teaching timetable</small></article>
    </div>}
    {!isAdmin && !isInstructor && <div className="dashboard-grid institute-dashboard-summary" aria-label="Student learning overview">
      <article className="dashboard-tile"><strong>{enrollments.length}</strong><span>Paid course enrolments</span><small>My courses</small></article>
      <article className="dashboard-tile"><strong>{lessons.length}</strong><span>Published lessons available</span><small>Learning materials</small></article>
      <article className="dashboard-tile"><strong>{submissions.length}</strong><span>Assignments submitted</span><small>My assignments</small></article>
      <article className="dashboard-tile"><strong>{attendance.length}</strong><span>Attendance records</span><small>My attendance</small></article>
    </div>}

    {error && <p className="portal-error">{error}</p>}{notice && <p className="portal-success">{notice}</p>}
    <section className="institute-window-list">
      <h4>Institute announcements</h4>
      {announcements.length ? announcements.map(a=><article className="appointment-card" key={a.id}><strong>{a.title}</strong><span>{a.courseId==="all"?"All students":courses.find(c=>c.id===a.courseId)?.title || "Course announcement"} · {a.createdAt?.toDate ? a.createdAt.toDate().toLocaleDateString() : "Recently published"}</span><p>{a.message}</p>{a.expiresOn&&<small>Available until {a.expiresOn}</small>}</article>) : <p className="staff-empty">There are no current announcements.</p>}
    </section>
    <div className="institute-course-grid">
      {courses.filter(c => c.active !== false).map(c => <article className="institute-course-card" key={c.id}><span>COURSE</span><h4>{c.title}</h4><p>{c.description || c.category || "Professional fashion training"}</p><small>{c.mode || "Mode to be confirmed"} · {c.duration || "Duration to be confirmed"}</small><strong>{Number(c.fee || 0) ? "₦" + Number(c.fee).toLocaleString("en-NG") : "Fee to be confirmed"}</strong></article>)}
      {!courses.length && <p className="staff-empty">Course information will appear here when the Institute publishes its first course.</p>}
    </div>
    <div className="institute-window-list"><h4>Available training windows</h4>
      {availableWindows.map(w => <article className="appointment-card" key={w.id}><strong>{w.title}</strong><span>{courses.find(c => c.id === w.courseId)?.title || "Course"} · {w.modes?.join(", ") || "Mode not specified"}</span><p>Applications: {w.applicationOpen} to {w.applicationClose} · Commencement: {w.commencement}</p><p>Duration: {w.duration || "To be confirmed"} · Capacity: {w.enrolledCount || 0}/{w.capacity} · Fee: ₦{Number(w.fee || 0).toLocaleString("en-NG")}</p><p>{w.venue || "Venue to be confirmed"} {w.timetable ? "· " + w.timetable : ""}</p></article>)}
      {!availableWindows.length && <p className="staff-empty">There are no open training windows at the moment.</p>}
    </div>
    {!isAdmin && !isInstructor && <form className="portal-form institute-application-form" onSubmit={apply}>
      <h4>Apply for fashion training</h4>
      <label>Full name<input required value={applicationForm.fullName} onChange={e=>setApplicationForm({...applicationForm,fullName:e.target.value})}/></label>
      <label>Telephone number<input required value={applicationForm.phone} onChange={e=>setApplicationForm({...applicationForm,phone:e.target.value})}/></label>
      <label>Residential address<textarea required value={applicationForm.address} onChange={e=>setApplicationForm({...applicationForm,address:e.target.value})}/></label>
      <label>Course<select required value={applicationForm.courseId} onChange={e=>setApplicationForm({...applicationForm,courseId:e.target.value,windowId:""})}><option value="">Choose a course</option>{courses.filter(c=>c.active!==false).map(c=><option key={c.id} value={c.id}>{c.title}</option>)}</select></label>
      <label>Training window<select required value={applicationForm.windowId} onChange={e=>{const w=windows.find(x=>x.id===e.target.value);setApplicationForm({...applicationForm,windowId:e.target.value,mode:w?.modes?.[0] || "Onsite"});}}><option value="">Choose an open intake</option>{availableWindows.filter(w=>!applicationForm.courseId||w.courseId===applicationForm.courseId).map(w=><option key={w.id} value={w.id}>{w.title}</option>)}</select></label>
      <label>Learning mode<select value={applicationForm.mode} onChange={e=>setApplicationForm({...applicationForm,mode:e.target.value})}><option>Onsite</option><option>Online</option></select></label>
      <label>Previous experience<textarea value={applicationForm.experience} onChange={e=>setApplicationForm({...applicationForm,experience:e.target.value})}/></label>
      <label>Additional information<textarea value={applicationForm.note} onChange={e=>setApplicationForm({...applicationForm,note:e.target.value})}/></label>
      <button className="portal-submit" disabled={busy || !courses.length || !availableWindows.length}>{busy?"Submitting…":"Submit training application"}</button>
    </form>}
    {!isAdmin && !isInstructor && <div className="institute-window-list"><h4>My applications</h4>{myApplications.length?myApplications.map(a=><article className="appointment-card" key={a.id}><strong>{a.applicationRef}</strong><span>{a.courseTitle} · {a.windowTitle}</span><p>Admission: {a.status} · Payment: {a.paymentStatus}</p>{a.studentId&&<p>Student ID: {a.studentId}</p>}</article>):<p className="staff-empty">You have not submitted an application yet.</p>}</div>}
    {isAdmin && <>
      <form className="portal-form" onSubmit={assignInstructor}>
        <h4>Assign an instructor to a course</h4>
        <p>Enter the instructor Firebase Authentication UID. Firestore rules verify the Instructor role.</p>
        <label>Instructor user UID<input required value={instructorForm.instructorUid} onChange={e=>setInstructorForm({...instructorForm,instructorUid:e.target.value})}/></label>
        <label>Course<select required value={instructorForm.courseId} onChange={e=>setInstructorForm({...instructorForm,courseId:e.target.value})}><option value="">Choose course</option>{activeCourses.map(c=><option key={c.id} value={c.id}>{c.title}</option>)}</select></label>
        <button className="portal-submit" disabled={busy||!activeCourses.length}>Assign instructor</button>
      </form>
      <div className="institute-window-list"><h4>Instructor directory</h4>{instructorProfiles.length?instructorProfiles.map(p=><article className="appointment-card" key={p.id}><strong>{p.fullName || p.id}</strong><span>{p.specialization || "Specialisation not provided"} · {p.phone || "No contact provided"}</span>{p.qualifications&&<p>Qualifications: {p.qualifications}</p>}{p.bio&&<p>{p.bio}</p>}{p.availability&&<p>Availability: {p.availability}</p>}</article>):<p className="staff-empty">Instructor profiles will appear here when instructors complete their profiles.</p>}</div>
      <form className="portal-form" onSubmit={scheduleSession}>
        <h4>Schedule an instructor-led training session</h4>
        <label>Course<select required value={sessionForm.courseId} onChange={e=>setSessionForm({...sessionForm,courseId:e.target.value,instructorUid:""})}><option value="">Choose course</option>{activeCourses.map(c=><option key={c.id} value={c.id}>{c.title}</option>)}</select></label>
        <label>Assigned instructor<select required value={sessionForm.instructorUid} onChange={e=>setSessionForm({...sessionForm,instructorUid:e.target.value})}><option value="">Choose instructor</option>{allInstructorAssignments.filter(a=>a.courseId===sessionForm.courseId&&a.active).map(a=><option key={a.id} value={a.instructorUid}>{a.instructorName || a.instructorUid}</option>)}</select></label>
        <label>Session title<input required maxLength="120" value={sessionForm.title} onChange={e=>setSessionForm({...sessionForm,title:e.target.value})} placeholder="e.g. Practical pattern drafting"/></label>
        <label>Start date and time<input required type="datetime-local" value={sessionForm.startsAt} onChange={e=>setSessionForm({...sessionForm,startsAt:e.target.value})}/></label>
        <label>End date and time<input required type="datetime-local" value={sessionForm.endsAt} onChange={e=>setSessionForm({...sessionForm,endsAt:e.target.value})}/></label>
        <label>Delivery mode<select value={sessionForm.mode} onChange={e=>setSessionForm({...sessionForm,mode:e.target.value})}><option>Onsite</option><option>Online</option></select></label>
        {sessionForm.mode==="Onsite"?<label>Venue<input value={sessionForm.venue} onChange={e=>setSessionForm({...sessionForm,venue:e.target.value})}/></label>:<label>Secure meeting link (HTTPS)<input type="url" value={sessionForm.meetingUrl} onChange={e=>setSessionForm({...sessionForm,meetingUrl:e.target.value})}/></label>}
        <label>Session notes<textarea rows="3" maxLength="1500" value={sessionForm.notes} onChange={e=>setSessionForm({...sessionForm,notes:e.target.value})}/></label>
        <button className="portal-submit" disabled={busy||!allInstructorAssignments.some(a=>a.courseId===sessionForm.courseId&&a.active)}>Schedule and publish session</button>
      </form>
      <div className="institute-window-list"><h4>Manage scheduled sessions</h4>{sessions.length?sessions.map(s=><article className="appointment-card" key={s.id}><strong>{s.title}</strong><span>{s.courseTitle} · {s.instructorName || s.instructorUid}</span><p>{s.startsAt} – {s.endsAt} · {s.mode==="Online"?"Online":s.venue}</p>{s.meetingUrl&&<p><a href={s.meetingUrl} target="_blank" rel="noreferrer">Open meeting link</a></p>}{s.notes&&<p>{s.notes}</p>}<label>Session status<select value={s.status||"scheduled"} onChange={e=>updateSessionStatus(s,e.target.value)} disabled={busy}><option value="scheduled">Scheduled</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></label></article>):<p className="staff-empty">No sessions scheduled yet.</p>}</div>
      <form className="portal-form" onSubmit={publishAnnouncement}>
        <h4>Publish an Institute announcement</h4>
        <label>Audience<select value={announcementForm.courseId} onChange={e=>setAnnouncementForm({...announcementForm,courseId:e.target.value})}><option value="all">All paid students</option>{activeCourses.map(c=><option key={c.id} value={c.id}>{c.title} students</option>)}</select></label>
        <label>Announcement title<input required maxLength="120" value={announcementForm.title} onChange={e=>setAnnouncementForm({...announcementForm,title:e.target.value})}/></label>
        <label>Message<textarea required rows="4" maxLength="3000" value={announcementForm.message} onChange={e=>setAnnouncementForm({...announcementForm,message:e.target.value})}/></label>
        <label>Expiry date (optional)<input type="date" value={announcementForm.expiresOn} onChange={e=>setAnnouncementForm({...announcementForm,expiresOn:e.target.value})}/></label>
        <button className="portal-submit" disabled={busy}>Publish announcement</button>
      </form>
      <div className="institute-admin-grid">
        <form className="portal-form" onSubmit={saveCourse}><h4>{editingCourseId ? "Edit course" : "Create a course"}</h4>
          <label>Course title<input required value={courseForm.title} onChange={e=>setCourseForm({...courseForm,title:e.target.value})} placeholder="e.g. Advanced Pattern Drafting"/></label>
          <label>Suggested course category<select value={courseForm.category} onChange={e=>setCourseForm({...courseForm,category:e.target.value})}>{COURSE_TYPES.map(x=><option key={x}>{x}</option>)}</select></label>
          <label>Description<textarea value={courseForm.description} onChange={e=>setCourseForm({...courseForm,description:e.target.value})}/></label>
          <label>Learning modes<input value={courseForm.mode} onChange={e=>setCourseForm({...courseForm,mode:e.target.value})}/></label>
          <label>Duration<input value={courseForm.duration} onChange={e=>setCourseForm({...courseForm,duration:e.target.value})}/></label>
          <label>Indicative fee (₦)<input type="number" min="0" step="0.01" value={courseForm.fee} onChange={e=>setCourseForm({...courseForm,fee:e.target.value})}/></label>
          <button className="portal-submit" disabled={busy}>{editingCourseId ? "Save course changes" : "Create course"}</button>
          {editingCourseId && <button type="button" className="portal-secondary" disabled={busy} onClick={cancelCourseEdit}>Cancel editing</button>}
        </form>
        <div className="institute-window-list"><h4>Manage course catalogue</h4>{courses.length ? courses.map(course=><article className="appointment-card" key={course.id}><strong>{course.title}</strong><span>{course.category || "Course"} · {course.active === false ? "Archived" : "Active"} · ₦{Number(course.fee || 0).toLocaleString("en-NG")}</span>{course.description && <p>{course.description}</p>}<div className="portal-actions"><button type="button" className="portal-secondary" disabled={busy} onClick={()=>editCourse(course)}>Edit course</button><button type="button" className="portal-secondary" disabled={busy} onClick={()=>toggleCourseArchive(course)}>{course.active === false ? "Restore course" : "Archive course"}</button></div></article>) : <p className="staff-empty">No courses have been created yet.</p>}</div>
        <form className="portal-form" onSubmit={saveWindow}><h4>{editingWindowId ? "Edit training window" : "Create a training window"}</h4>
          <label>Intake name<input required value={windowForm.title} onChange={e=>setWindowForm({...windowForm,title:e.target.value})} placeholder="e.g. January–March intake"/></label>
          <label>Course<select required value={windowForm.courseId} onChange={e=>setWindowForm({...windowForm,courseId:e.target.value})}><option value="">Choose course</option>{courses.filter(c=>c.active!==false || c.id===windowForm.courseId).map(c=><option key={c.id} value={c.id}>{c.title}{c.active===false?" (Archived — existing intake)":""}</option>)}</select></label>
          <label>Applications open<input type="date" required value={windowForm.applicationOpen} onChange={e=>setWindowForm({...windowForm,applicationOpen:e.target.value})}/></label>
          <label>Applications close<input type="date" required value={windowForm.applicationClose} onChange={e=>setWindowForm({...windowForm,applicationClose:e.target.value})}/></label>
          <label>Commencement date<input type="date" required value={windowForm.commencement} onChange={e=>setWindowForm({...windowForm,commencement:e.target.value})}/></label>
          <label>Duration<input value={windowForm.duration} onChange={e=>setWindowForm({...windowForm,duration:e.target.value})}/></label>
          <label>Learning modes<select value={windowForm.modes[0]} onChange={e=>setWindowForm({...windowForm,modes:[e.target.value]})}><option>Onsite</option><option>Online</option><option>Online and onsite</option></select></label>
          <label>Training fee (₦)<input type="number" min="0" step="0.01" required value={windowForm.fee} onChange={e=>setWindowForm({...windowForm,fee:e.target.value})}/></label>
          <label>Maximum student capacity<input type="number" min="1" step="1" required value={windowForm.capacity} onChange={e=>setWindowForm({...windowForm,capacity:e.target.value})}/></label>
          <label>Venue<input value={windowForm.venue} onChange={e=>setWindowForm({...windowForm,venue:e.target.value})}/></label>
          <label>Timetable<input value={windowForm.timetable} onChange={e=>setWindowForm({...windowForm,timetable:e.target.value})}/></label>
          <label>Instructor name<input value={windowForm.instructorName} onChange={e=>setWindowForm({...windowForm,instructorName:e.target.value})}/></label>
          <button className="portal-submit" disabled={busy || !courses.length}>{editingWindowId ? "Save training window changes" : "Create training window"}</button>{editingWindowId && <button type="button" className="portal-secondary" disabled={busy} onClick={cancelWindowEdit}>Cancel editing</button>}
        </form>
      </div>
      <div className="institute-window-list"><h4>Manage training windows</h4><button type="button" className="portal-secondary" disabled={busy||!windows.length} onClick={reconcileTrainingCapacity}>Reconcile capacity counters from application records</button>{windows.map(w=><article className="appointment-card" key={w.id}><strong>{w.title}</strong><span>{w.courseTitle || courses.find(c=>c.id===w.courseId)?.title}</span><p>{w.applicationOpen} – {w.applicationClose} · Starts {w.commencement} · Capacity {w.enrolledCount||0}/{w.capacity}</p><div className="finance-form-actions"><button type="button" disabled={busy} onClick={()=>editWindow(w)}>Edit intake</button></div><label>Window status<select value={w.status||"open"} onChange={e=>changeWindowStatus(w,e.target.value)} disabled={busy}><option value="open">Open</option><option value="closed">Closed</option><option value="completed">Completed</option></select></label></article>)}</div>
      <div className="institute-window-list"><h4>Admission applications</h4>{applications.length?applications.map(a=><article className="appointment-card" key={a.id}><strong>{a.applicationRef} · {a.fullName}</strong><span>{a.email} · {a.phone}</span><p>{a.courseTitle} · {a.windowTitle} · {a.mode}</p><p>{a.address}</p>{a.experience&&<p>Experience: {a.experience}</p>}{a.note&&<p>{a.note}</p>}<p>Status: {a.status} · Payment: {a.paymentStatus}</p><div className="finance-form-actions"><button type="button" disabled={busy} onClick={()=>reviewApplication(a,"admitted")}>Admit</button><button type="button" disabled={busy} onClick={()=>reviewApplication(a,"rejected")}>Reject</button><button type="button" disabled={busy} onClick={()=>reviewApplication(a,"more_information")}>Request information</button></div>{a.studentId&&<p>Student ID: {a.studentId}</p>}{claims.superAdmin&&a.status==="admitted"&&a.paymentStatus!=="paid"&&<button type="button" disabled={busy} onClick={()=>verifyTrainingPayment(a)}>Verify received training payment & activate access</button>}{a.paymentStatus==="paid"&&<p>Course access activated.</p>}</article>):<p className="staff-empty">No applications received.</p>}</div>
    </>}

    {isInstructor && <form className="portal-form" onSubmit={saveInstructorProfile}>
      <h4>My professional instructor profile</h4>
      <label>Professional name<input required maxLength="120" value={myInstructorProfile.fullName} onChange={e=>setMyInstructorProfile({...myInstructorProfile,fullName:e.target.value})} placeholder={user.displayName || "Your name"}/></label>
      <label>Contact telephone<input type="tel" maxLength="25" value={myInstructorProfile.phone} onChange={e=>setMyInstructorProfile({...myInstructorProfile,phone:e.target.value})}/></label>
      <label>Qualifications and certifications<textarea rows="2" maxLength="500" value={myInstructorProfile.qualifications} onChange={e=>setMyInstructorProfile({...myInstructorProfile,qualifications:e.target.value})}/></label>
      <label>Teaching specialisation<input maxLength="300" value={myInstructorProfile.specialization} onChange={e=>setMyInstructorProfile({...myInstructorProfile,specialization:e.target.value})} placeholder="e.g. Pattern drafting, garment construction"/></label>
      <label>Professional biography<textarea rows="4" maxLength="1500" value={myInstructorProfile.bio} onChange={e=>setMyInstructorProfile({...myInstructorProfile,bio:e.target.value})}/></label>
      <label>Availability<textarea rows="2" maxLength="500" value={myInstructorProfile.availability} onChange={e=>setMyInstructorProfile({...myInstructorProfile,availability:e.target.value})} placeholder="e.g. Weekdays, 10:00 AM–4:00 PM"/></label>
      <button className="portal-submit" disabled={busy}>Save instructor profile</button>
    </form>}
    {isInstructor && <section className="institute-window-list"><h4>My teaching timetable</h4>{sessions.filter(s=>s.instructorUid===user.uid).length?sessions.filter(s=>s.instructorUid===user.uid).map(s=><article className="appointment-card" key={s.id}><strong>{s.title}</strong><span>{s.courseTitle} · {s.startsAt} – {s.endsAt}</span><p>{s.mode==="Online"?"Online session":s.venue} · {s.status}</p>{s.meetingUrl&&<p><a href={s.meetingUrl} target="_blank" rel="noreferrer">Open meeting link</a></p>}{s.notes&&<p>{s.notes}</p>}</article>):<p className="staff-empty">No teaching sessions have been scheduled for your assigned courses.</p>}</section>}
    {!isAdmin && !isInstructor && <section className="institute-window-list">
      <h4>My learning progress</h4>
      {enrollments.length ? enrollments.map(en=>{
        const courseLessons=lessons.filter(l=>l.courseId===en.courseId);
        const completedLessons=lessonProgress.filter(p=>p.courseId===en.courseId&&p.completed).length;
        const courseAssignments=assignments.filter(a=>a.courseId===en.courseId);
        const submittedAssignments=courseAssignments.filter(a=>submissions.some(s=>s.assignmentId===a.id)).length;
        const courseAssessments=assessments.filter(a=>a.courseId===en.courseId);
        const submittedAssessments=courseAssessments.filter(a=>assessmentSubmissions.some(s=>s.assessmentId===a.id)).length;
        const gradedAssessments=courseAssessments.filter(a=>assessmentSubmissions.some(s=>s.assessmentId===a.id&&s.status==="graded")).length;
        const courseAttendance=attendance.filter(a=>a.courseId===en.courseId);
        const attended=courseAttendance.filter(a=>a.status==="present"||a.status==="late").length;
        const lessonPercent=courseLessons.length?Math.round(Math.min(completedLessons,courseLessons.length)/courseLessons.length*100):0;
        return <article className="appointment-card" key={en.id}>
          <strong>{en.courseTitle || "Enrolled course"}</strong>
          <span>{en.windowTitle || "Active enrolment"} · Payment: {en.paymentStatus || "pending"}</span>
          <p><strong>{lessonPercent}%</strong> lesson completion · {Math.min(completedLessons,courseLessons.length)} of {courseLessons.length} lessons completed</p>
          <div className="portal-progress-track" role="progressbar" aria-label={(en.courseTitle||"Course")+" lesson completion"} aria-valuemin="0" aria-valuemax="100" aria-valuenow={lessonPercent}><span style={{width:lessonPercent+"%"}}/></div>
          <p>Assignments: {submittedAssignments}/{courseAssignments.length} submitted · Assessments: {submittedAssessments}/{courseAssessments.length} submitted · {gradedAssessments} graded</p>
          <p>Attendance: {attended} of {courseAttendance.length} marked sessions attended{courseAttendance.length?" ("+Math.round(attended/courseAttendance.length*100)+"%)":" (not yet recorded)"}</p>
        </article>;
      }) : <p className="staff-empty">Your learning progress will appear here after your training payment is verified and course access is activated.</p>}
    </section>}
    {!isAdmin && !isInstructor && <section className="institute-window-list"><h4>My course timetable</h4>{sessions.filter(s=>s.status!=="cancelled").length?sessions.filter(s=>s.status!=="cancelled").map(s=><article className="appointment-card" key={s.id}><strong>{s.title}</strong><span>{s.courseTitle} · {s.startsAt} – {s.endsAt}</span><p>{s.mode==="Online"?"Online session":s.venue} · {s.status}</p>{s.meetingUrl&&<p><a href={s.meetingUrl} target="_blank" rel="noreferrer">Join session</a></p>}{s.notes&&<p>{s.notes}</p>}</article>):<p className="staff-empty">Your course timetable will appear here when the Institute schedules sessions.</p>}</section>}
    {isInstructor && <section className="institute-window-list">
      <h4>My instructor assignments</h4>
      {instructorAssignments.length ? instructorAssignments.map(a => <article className="appointment-card" key={a.id}><strong>{a.courseTitle || courses.find(c=>c.id===a.courseId)?.title || "Assigned course"}</strong><span>Course ID: {a.courseId}</span><p>Assignment status: {a.active ? "Active" : "Inactive"}</p></article>) : <p className="staff-empty">No courses have been assigned to this instructor account yet.</p>}
    </section>}
    {isAdmin && <section className="institute-window-list">
      <h4>Student learning progress</h4>
      {allEnrollments.map(en=>{
        const courseLessons=lessons.filter(l=>l.courseId===en.courseId);
        const done=allLessonProgress.filter(p=>p.studentUid===en.studentUid&&p.courseId===en.courseId&&p.completed).length;
        const lessonPercent=courseLessons.length?Math.round(Math.min(done,courseLessons.length)/courseLessons.length*100):0;
        const courseAssignments=assignments.filter(a=>a.courseId===en.courseId);
        const assignmentSubs=submissions.filter(s=>s.studentUid===en.studentUid&&s.courseId===en.courseId);
        const courseAssessments=assessments.filter(a=>a.courseId===en.courseId);
        const assessmentSubs=assessmentSubmissions.filter(s=>s.studentUid===en.studentUid&&s.courseId===en.courseId);
        const graded=assessmentSubs.filter(s=>s.status==="graded");
        const courseAttendance=attendance.filter(a=>a.studentUid===en.studentUid&&a.courseId===en.courseId);
        const attended=courseAttendance.filter(a=>a.status==="present"||a.status==="late").length;
        return <article className="appointment-card" key={en.id}>
          <strong>{en.studentName || en.studentEmail || en.studentUid}</strong>
          <span>{en.courseTitle} · {en.windowTitle || "Enrolment"} · {en.studentId || en.studentUid} · {en.enrollmentStatus === "withdrawn" ? "Withdrawn" : "Active"}</span>
          {en.enrollmentStatus === "withdrawn" && <p><strong>Withdrawal reason:</strong> {en.withdrawalReason || "Not recorded"}</p>}
          <p><strong>{lessonPercent}%</strong> lesson completion · {Math.min(done,courseLessons.length)}/{courseLessons.length} lessons</p>
          <div className="portal-progress-track" role="progressbar" aria-label={(en.studentName||"Student")+" lesson completion"} aria-valuemin="0" aria-valuemax="100" aria-valuenow={lessonPercent}><span style={{width:lessonPercent+"%"}}/></div>
          <p>Assignments: {assignmentSubs.length}/{courseAssignments.length} submitted · Assessments: {assessmentSubs.length}/{courseAssessments.length} submitted · {graded.length} graded</p>
          {graded.length>0&&<p>Recorded assessment scores: {graded.map(g=>Number(g.score||0)+"/"+Number(g.maxScore||0)).join(", ")}</p>}
          <p>Attendance: {attended}/{courseAttendance.length} marked sessions attended{courseAttendance.length?" ("+Math.round(attended/courseAttendance.length*100)+"%)":" (not yet recorded)"}</p>
          {isAdmin && <div className="finance-form-actions">
            <button type="button" disabled={!!mediaAccessAction || en.paymentStatus !== "paid" || en.enrollmentStatus === "withdrawn"} onClick={() => manageCourseMediaAccess(en, "grant")}>{mediaAccessAction===en.id+":grant" ? "Granting access…" : "Retry / grant Drive lesson access"}</button>
            <button type="button" disabled={!!mediaAccessAction || !en.studentEmail} onClick={() => manageCourseMediaAccess(en, "revoke")}>{mediaAccessAction===en.id+":revoke" ? "Revoking access…" : "Revoke / retry direct Drive access removal"}</button>
            {en.enrollmentStatus !== "withdrawn" && <button type="button" disabled={busy || !!mediaAccessAction} onClick={() => withdrawEnrollment(en)}>Withdraw learner and disable course access</button>}
          </div>}
        </article>;
      })}
      {!allEnrollments.length&&<p className="staff-empty">Student progress will appear after course enrolments are activated.</p>}
    </section>}
    {(isAdmin || isInstructor) && <section className="institute-window-list">
      <h4>Student attendance register</h4>
      <label>Attendance date<input type="date" value={attendanceDate} onChange={e=>setAttendanceDate(e.target.value)}/></label>
      {allEnrollments.filter(en=>!isInstructor || instructorAssignments.some(a=>a.courseId===en.courseId&&a.active)).map(en=>{const record=attendance.find(a=>a.studentUid===en.studentUid&&a.courseId===en.courseId&&a.date===attendanceDate);return <article className="appointment-card" key={en.id}><strong>{en.studentName || en.studentEmail || en.studentUid}</strong><span>{en.studentId} · {en.courseTitle} · {en.windowTitle}</span><p>Attendance: {record?.status || "Not marked"}</p><p>{(()=>{const history=attendance.filter(a=>a.studentUid===en.studentUid&&a.courseId===en.courseId);const attended=history.filter(a=>a.status==="present"||a.status==="late").length;return history.length?`${attended} of ${history.length} marked sessions attended (${Math.round(attended/history.length*100)}%).`:"No historical attendance has been recorded.";})()}</p><div className="finance-form-actions">{["present","absent","late","excused"].map(status=><button type="button" key={status} disabled={busy} onClick={()=>markAttendance(en,status)}>{status[0].toUpperCase()+status.slice(1)}</button>)}</div></article>})}
      {!allEnrollments.length&&<p className="staff-empty">No enrolled students are available for attendance marking.</p>}
    </section>}
    {isAdmin && <section className="institute-window-list">
      <h4>Certificates and completion status</h4>
      <label>Paid student and course<select value={certificateEnrollmentId} onChange={e=>setCertificateEnrollmentId(e.target.value)}>
        <option value="">Select a paid enrolment</option>
        {allEnrollments.filter(en=>en.paymentStatus==="paid"&&!allCertificates.some(c=>c.id===en.id)).map(en=><option key={en.id} value={en.id}>{en.studentName||en.studentEmail||en.studentUid} · {en.courseTitle}</option>)}
      </select></label>
      {certificateEnrollmentId && (() => {
        const selectedEnrollment = allEnrollments.find(item => item.id === certificateEnrollmentId);
        const completion = getCourseCompletionStatus(selectedEnrollment);
        return <div className="certificate-completion-checklist" aria-live="polite">
          <strong>{completion.eligible ? "Completion checks satisfied" : "Certificate not yet eligible"}</strong>
          {completion.checks.map(check => <p key={check.label}>{check.complete ? "✓" : "•"} {check.label}: {check.detail}</p>)}
          {completion.blockers.map((blocker, index) => <p className="certificate-revoked-note" key={index}>{blocker}</p>)}
          <small>All published lessons must be completed, all published assignments and assessments must be graded, and attendance must be confirmed for sessions marked completed. The Institute must still apply any course-specific pass mark or graduation policy that has not been configured in the system.</small>
        </div>;
      })()}
      <button type="button" disabled={busy||!certificateEnrollmentId||!getCourseCompletionStatus(allEnrollments.find(item => item.id === certificateEnrollmentId)).eligible} onClick={issueCertificate}>Issue course completion certificate</button>
      {allCertificates.length?allCertificates.map(c=><article className="appointment-card" key={c.id}><strong>{c.certificateRef}</strong><span>{c.studentName} · {c.courseTitle}</span><p>Status: {c.status} · {c.windowTitle}</p><p className="certificate-public-reference">Public verification reference: <strong>{c.certificateRef}</strong></p><button type="button" className="certificate-sync-button" disabled={busy} onClick={()=>publishCertificateVerification(c)}>Publish / refresh public verification record</button>{c.status==="issued"?<><button type="button" disabled={busy} onClick={()=>printCertificate(c)}>Print certificate</button><div className="certificate-revoke-form"><label>Reason for revocation<input value={certificateRevocationDrafts[c.id]||""} maxLength="500" placeholder="Explain why this certificate must be withdrawn" onChange={e=>setCertificateRevocationDrafts(current=>({...current,[c.id]:e.target.value}))}/></label><button type="button" disabled={busy} onClick={()=>revokeCertificate(c)}>Revoke certificate</button></div></>:<p className="certificate-revoked-note"><strong>Revoked.</strong> {c.revocationReason || "No reason recorded."}</p>}</article>):<p className="staff-empty">No certificates have been issued yet.</p>}
      <small>Issue a certificate only after independently confirming that the student has completed the required training and assessments.</small>
    </section>}
    {!isAdmin && !isInstructor && <section className="institute-window-list"><h4>My certificates</h4>{certificates.length?certificates.map(c=><article className="appointment-card" key={c.id}><strong>{c.certificateRef}</strong><span>{c.courseTitle} · {c.windowTitle}</span><p>Status: {c.status} · Issued {c.issuedAt?.toDate ? c.issuedAt.toDate().toLocaleDateString() : "date pending"}</p>{c.status==="issued"&&<button type="button" onClick={()=>printCertificate(c)}>Print certificate</button>}</article>):<p className="staff-empty">Certificates will appear here after the Institute confirms course completion and issues them.</p>}</section>}
    {!isAdmin && !isInstructor && <section className="institute-window-list"><h4>My attendance record</h4>{attendance.length?<><p>{(()=>{const attended=attendance.filter(a=>a.status==="present"||a.status==="late").length;return `${attended} of ${attendance.length} marked sessions attended (${Math.round(attended/attendance.length*100)}%).`;})()}</p>{attendance.map(a=><article className="appointment-card" key={a.id}><strong>{a.courseTitle}</strong><span>{a.date} · {a.status}</span></article>)}</>:<p className="staff-empty">Your attendance records will appear here when the Institute marks attendance.</p>}</section>}
    {(isAdmin || isInstructor) && <form className="portal-form" onSubmit={createAssessment}>
      <h4>Publish a student assessment</h4>
      <label>Course<select required value={assessmentForm.courseId} onChange={e=>setAssessmentForm({...assessmentForm,courseId:e.target.value})}><option value="">Choose course</option>{(isInstructor ? activeCourses.filter(c=>instructorAssignments.some(a=>a.courseId===c.id&&a.active)) : activeCourses).map(c=><option key={c.id} value={c.id}>{c.title}</option>)}</select></label>
      <label>Assessment title<input required value={assessmentForm.title} onChange={e=>setAssessmentForm({...assessmentForm,title:e.target.value})}/></label>
      <label>Assessment type<select value={assessmentForm.assessmentType} onChange={e=>setAssessmentForm({...assessmentForm,assessmentType:e.target.value,questions:""})}><option value="written">Written / descriptive (manual grading)</option><option value="objective">Objective / multiple choice (automatic grading)</option></select></label>
      <label>Instructions<textarea rows="3" value={assessmentForm.instructions} onChange={e=>setAssessmentForm({...assessmentForm,instructions:e.target.value})}/></label>
      <label>Due date (optional)<input type="date" value={assessmentForm.dueDate} onChange={e=>setAssessmentForm({...assessmentForm,dueDate:e.target.value})}/></label>
      <label>{assessmentForm.assessmentType === "objective" ? "Objective questions (one per line)" : "Written questions (one per line)"}<textarea required rows="7" value={assessmentForm.questions} onChange={e=>setAssessmentForm({...assessmentForm,questions:e.target.value})} placeholder={assessmentForm.assessmentType === "objective" ? "What is a basic hand-sewing tool? | Needle | Ruler | Chalk | Tape | A&#10;Which tool measures body dimensions? | Scissors | Tape measure | Thimble | Iron | B" : "Explain the basic tools used in garment construction.&#10;Describe the steps in taking body measurements."}/></label>
      {assessmentForm.assessmentType === "objective" && <p className="staff-help">Format each line exactly as: Question | Option A | Option B | Option C | Option D | Correct letter (A-D). Correct answers are stored separately and never included in the student-facing assessment.</p>}
      <button className="portal-submit" disabled={busy||!courses.length}>Publish assessment</button>
    </form>}
    {!isAdmin && !isInstructor && <section className="institute-window-list"><h4>My assessments</h4>{assessments.map(a=>{const prior=assessmentSubmissions.find(s=>s.assessmentId===a.id);return <article className="appointment-card" key={a.id}><strong>{a.title}</strong><span>{a.courseTitle}{a.dueDate?" · Due "+a.dueDate:""}</span>{a.instructions&&<p>{a.instructions}</p>}{prior?<div><p>Submission: {prior.status}</p>{prior.status==="graded"&&<p>Score: {prior.score}/{prior.maxScore} · {prior.feedback}</p>}{prior.answers?.map((answer,i)=><p key={i}>Q{i+1}: {answer}</p>)}</div>:<div>{a.questions.map((q,i)=><div className="institute-assessment-question" key={i}><strong>Q{i+1}. {typeof q === "string" ? q : q.text}</strong>{typeof q === "string" ? <textarea rows="3" aria-label={"Answer question "+(i+1)} value={assessmentDrafts[a.id+"_"+i]||""} onChange={e=>setAssessmentDrafts(v=>({...v,[a.id+"_"+i]:e.target.value}))}/> : <div className="institute-objective-options">{q.options.map((option,optionIndex)=>{const letter=["A","B","C","D"][optionIndex];return <label key={letter}><input type="radio" name={a.id+"_question_"+i} value={letter} checked={(assessmentDrafts[a.id+"_"+i]||"")===letter} onChange={e=>setAssessmentDrafts(v=>({...v,[a.id+"_"+i]:e.target.value}))}/><span><b>{letter}.</b> {option}</span></label>;})}</div>}</div>)}<button type="button" disabled={busy} onClick={()=>submitAssessment(a)}>Submit assessment</button></div>}</article>})}{!assessments.length&&<p className="staff-empty">No assessments are available for your paid courses.</p>}</section>}
    {(isAdmin || isInstructor) && <section className="institute-window-list"><h4>Assessment submissions & grading</h4>{assessmentSubmissions.length?assessmentSubmissions.map(sub=><article className="appointment-card" key={sub.id}><strong>{sub.assessmentTitle}</strong><span>{sub.studentName} · {sub.status}</span>{sub.answers?.map((answer,i)=><p key={i}>Q{i+1}: {answer}</p>)}{sub.status==="graded"?<div className="institute-assessment-result"><p><strong>Score:</strong> {sub.score}/{sub.maxScore}</p>{sub.gradingMode==="automatic"&&<p><strong>Grading:</strong> Automatically marked objective assessment</p>}{sub.feedback&&<p><strong>Feedback:</strong> {sub.feedback}</p>}</div>:<form className="institute-grade-form" onSubmit={e=>{e.preventDefault();gradeAssessment(sub);}}><label>Score (maximum {sub.answers.length*10})<input type="number" min="0" max={sub.answers.length*10} step="0.5" required value={assessmentGradeDrafts[sub.id]?.score ?? ""} onChange={e=>setAssessmentGradeDrafts(current=>({...current,[sub.id]:{...(current[sub.id]||{}),score:e.target.value}}))}/></label><label>Instructor feedback (optional)<textarea rows="2" maxLength="1200" value={assessmentGradeDrafts[sub.id]?.feedback ?? ""} onChange={e=>setAssessmentGradeDrafts(current=>({...current,[sub.id]:{...(current[sub.id]||{}),feedback:e.target.value}}))}/></label><button type="submit" disabled={busy}>Save grade and feedback</button></form>}</article>):<p className="staff-empty">No assessment submissions yet.</p>}</section>}
    {(isAdmin || isInstructor) && <form className="portal-form" onSubmit={createAssignment}>
      <h4>Publish a course assignment</h4>
      <label>Course<select required value={assignmentForm.courseId} onChange={e=>setAssignmentForm({...assignmentForm,courseId:e.target.value})}><option value="">Choose course</option>{(isInstructor ? activeCourses.filter(c=>instructorAssignments.some(a=>a.courseId===c.id&&a.active)) : activeCourses).map(c=><option key={c.id} value={c.id}>{c.title}</option>)}</select></label>
      <label>Assignment title<input required value={assignmentForm.title} onChange={e=>setAssignmentForm({...assignmentForm,title:e.target.value})}/></label>
      <label>Instructions<textarea required rows="5" value={assignmentForm.instructions} onChange={e=>setAssignmentForm({...assignmentForm,instructions:e.target.value})}/></label>
      <label>Due date (optional)<input type="date" value={assignmentForm.dueDate} onChange={e=>setAssignmentForm({...assignmentForm,dueDate:e.target.value})}/></label>
      <label>Maximum score<input type="number" min="1" step="1" value={assignmentForm.points} onChange={e=>setAssignmentForm({...assignmentForm,points:e.target.value})}/></label>
      <button className="portal-submit" disabled={busy||!courses.length}>Publish assignment</button>
    </form>}
    {(isAdmin || isInstructor) && <div className="institute-window-list"><h4>Student submissions & grading</h4>{submissions.length?submissions.map(sub=><article className="appointment-card" key={sub.id}><strong>{sub.assignmentTitle}</strong><span>{sub.studentName} · {sub.status}</span><p>{sub.answer}</p>{sub.status==="graded"?<p>Score: {sub.score}/{sub.maxScore} · {sub.feedback}</p>:<button type="button" disabled={busy} onClick={()=>gradeSubmission(sub,"graded")}>Grade submission</button>}</article>):<p className="staff-empty">No student submissions yet.</p>}</div>}
    {!isAdmin && !isInstructor && <div className="institute-window-list"><h4>My course assignments</h4>{assignments.map(a=>{const prior=submissions.find(s=>s.assignmentId===a.id);return <article className="appointment-card" key={a.id}><strong>{a.title}</strong><span>{a.courseTitle} · Maximum score: {a.points}</span>{a.dueDate&&<p>Due: {a.dueDate}</p>}<p>{a.instructions}</p>{prior?<div><p>Submission status: {prior.status}</p>{prior.status==="graded"&&<p>Score: {prior.score}/{prior.maxScore} · {prior.feedback}</p>}<p>{prior.answer}</p></div>:<><label>Your response<textarea rows="5" value={submissionDrafts[a.id]||""} onChange={e=>setSubmissionDrafts(v=>({...v,[a.id]:e.target.value}))}/></label><button type="button" disabled={busy} onClick={()=>submitAssignment(a)}>Submit assignment</button></>}</article>})}{!assignments.length&&<p className="staff-empty">No assignments have been published for your enrolled courses.</p>}</div>}
    {(isAdmin || isInstructor) && <form className="portal-form" onSubmit={createLesson}><h4>Publish a course lesson</h4>
      <label>Course<select required value={lessonForm.courseId} onChange={e=>setLessonForm({...lessonForm,courseId:e.target.value})}><option value="">Choose course</option>{(isInstructor ? activeCourses.filter(c=>instructorAssignments.some(a=>a.courseId===c.id&&a.active)) : activeCourses).map(x=><option key={x.id} value={x.id}>{x.title}</option>)}</select></label>
      <label>Lesson title<input required value={lessonForm.title} onChange={e=>setLessonForm({...lessonForm,title:e.target.value})}/></label>
      <label>Module / topic<input value={lessonForm.module} onChange={e=>setLessonForm({...lessonForm,module:e.target.value})}/></label>
      <label>Lesson type<select value={lessonForm.type} onChange={e=>setLessonForm({...lessonForm,type:e.target.value})}><option>Text lesson</option><option>Video lesson</option><option>Reading resource</option></select></label>
      <label>Lesson content<textarea rows="5" value={lessonForm.content} onChange={e=>setLessonForm({...lessonForm,content:e.target.value})}/></label>
      <label>Video URL (HTTPS)<input type="url" value={lessonForm.videoUrl} onChange={e=>setLessonForm({...lessonForm,videoUrl:e.target.value})}/></label>
      <label>Resource URL (HTTPS)<input type="url" value={lessonForm.resourceUrl} onChange={e=>setLessonForm({...lessonForm,resourceUrl:e.target.value})}/></label>
      <label>Upload lesson file (PDF, image or video; maximum 100 MB)<input type="file" accept="application/pdf,image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime" disabled={busy} onChange={e=>setLessonUploadFile(e.target.files?.[0] || null)}/></label>
      {lessonUploadFile && <p className="staff-help">Selected: {lessonUploadFile.name} · {(lessonUploadFile.size/1024/1024).toFixed(1)} MB</p>}
      <label>Sequence number<input type="number" min="1" step="1" value={lessonForm.sequence} onChange={e=>setLessonForm({...lessonForm,sequence:e.target.value})}/></label>
      <button className="portal-submit" disabled={busy||!courses.length}>Publish lesson</button>
    </form>}
    {!isAdmin && !isInstructor && <div className="institute-window-list"><h4>My enrolled courses & lessons</h4>{enrollments.map(en=>{const courseLessons=lessons.filter(l=>l.courseId===en.courseId);const completed=courseLessons.filter(l=>lessonProgress.some(p=>p.lessonId===l.id&&p.completed)).length;const percent=courseLessons.length?Math.round(completed/courseLessons.length*100):0;return <article className="appointment-card" key={en.id}><strong>{en.courseTitle}</strong><span>{en.studentId} · {en.windowTitle}</span><p>{completed} of {courseLessons.length} lessons completed · {courseLessons.length?percent+"% progress":"No lessons published yet"}</p><div className="institute-progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={percent}><span style={{display:"block",width:percent+"%",height:"8px",background:"currentColor",borderRadius:"8px"}}/></div>{courseLessons.map(l=>{const done=lessonProgress.some(p=>p.lessonId===l.id&&p.completed);return <div className="institute-lesson" key={l.id}><b>{l.sequence}. {l.title}</b>{l.module&&<small>{l.module}</small>}{l.content&&<p>{l.content}</p>}{l.videoUrl&&<p><a href={l.videoUrl} target="_blank" rel="noreferrer">Open video lesson</a></p>}{l.resourceUrl&&<p><a href={l.resourceUrl} target="_blank" rel="noreferrer">Open learning resource</a></p>}<p>{done?"Completed":"Not completed"}</p><button type="button" disabled={busy||done} onClick={()=>markLessonComplete(l)}>{done?"Lesson completed":"Mark lesson as completed"}</button></div>})}</article>})}{!enrollments.length&&<p className="staff-empty">Course lessons become available after admission and payment verification by the Institute.</p>}</div>}
  </section>;
}
