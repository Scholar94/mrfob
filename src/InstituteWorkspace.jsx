import React, { useEffect, useMemo, useState } from "react";
import { addDoc, collection, getDocs, query, serverTimestamp, updateDoc, doc, where, setDoc } from "firebase/firestore";
import { db } from "./firebase.js";
import { useAuth } from "./AuthProvider.jsx";

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
  const [assessmentForm, setAssessmentForm] = useState({ courseId: "", title: "", instructions: "", dueDate: "", questions: "" });
  const [assessmentDrafts, setAssessmentDrafts] = useState({});
  const [allEnrollments, setAllEnrollments] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [lessonProgress, setLessonProgress] = useState([]);
  const [allLessonProgress, setAllLessonProgress] = useState([]);
  const [certificates, setCertificates] = useState([]);
  const [allCertificates, setAllCertificates] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [instructorAssignments, setInstructorAssignments] = useState([]);
  const [instructorForm, setInstructorForm] = useState({ instructorUid: "", courseId: "" });
  const isInstructor = claims.staffRole === "instructor";
  const [announcementForm, setAnnouncementForm] = useState({ courseId: "all", title: "", message: "", expiresOn: "" });
  const [certificateEnrollmentId, setCertificateEnrollmentId] = useState("");
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().slice(0,10));
  const [assignmentForm, setAssignmentForm] = useState({ courseId: "", title: "", instructions: "", dueDate: "", points: "100" });
  const [submissionDrafts, setSubmissionDrafts] = useState({});
  const [lessonForm, setLessonForm] = useState({ courseId: "", title: "", module: "", type: "Text lesson", content: "", videoUrl: "", resourceUrl: "", sequence: "1" });
  const [courseForm, setCourseForm] = useState(blankCourse);
  const [windowForm, setWindowForm] = useState(blankWindow);
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
        const active = enrollmentSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        setEnrollments(active);
        const sets = await Promise.all(active.map(en => getDocs(query(collection(db, "instituteLessons"), where("courseId", "==", en.courseId), where("published", "==", true)))));
        setLessons(sets.flatMap(s => s.docs.map(d => ({ id: d.id, ...d.data() }))).sort((a,b) => Number(a.sequence||0)-Number(b.sequence||0)));
        const assignmentSets = await Promise.all(active.map(en => getDocs(query(collection(db, "instituteAssignments"), where("courseId", "==", en.courseId), where("published", "==", true)))));
        const assessmentSets = await Promise.all(active.map(en => getDocs(query(collection(db, "instituteAssessments"), where("courseId", "==", en.courseId), where("published", "==", true)))));
        const assessmentSubmissionSnap = await getDocs(query(collection(db, "instituteAssessmentSubmissions"), where("studentUid", "==", user.uid)));
        setAssessments(assessmentSets.flatMap(s => s.docs.map(d => ({ id:d.id, ...d.data() }))));
        setAssessmentSubmissions(assessmentSubmissionSnap.docs.map(d => ({ id:d.id, ...d.data() })));
        setAssignments(assignmentSets.flatMap(s => s.docs.map(d => ({ id: d.id, ...d.data() }))));
        const [submissionSnap, attendanceSnap, progressSnap, certificateSnap] = await Promise.all([getDocs(query(collection(db, "instituteSubmissions"), where("studentUid", "==", user.uid))), getDocs(query(collection(db, "instituteAttendance"), where("studentUid", "==", user.uid))), getDocs(query(collection(db, "instituteLessonProgress"), where("studentUid", "==", user.uid))), getDocs(query(collection(db, "instituteCertificates"), where("studentUid", "==", user.uid)))]);
        setSubmissions(submissionSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setAttendance(attendanceSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b)=>(b.date||"").localeCompare(a.date||"")));
        setLessonProgress(progressSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setCertificates(certificateSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b)=>(b.issuedAt?.seconds||0)-(a.issuedAt?.seconds||0)));
        const announcementSets = await Promise.all([
          getDocs(query(collection(db, "instituteAnnouncements"), where("courseId", "==", "all"))),
          ...active.map(en => getDocs(query(collection(db, "instituteAnnouncements"), where("courseId", "==", en.courseId))))
        ]);
        const announcementMap = new Map();
        announcementSets.forEach(s => s.docs.forEach(d => announcementMap.set(d.id, { id: d.id, ...d.data() })));
        setAnnouncements([...announcementMap.values()].filter(a => !a.expiresOn || a.expiresOn >= new Date().toISOString().slice(0,10)).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0)));
      }
      if (isInstructor) {
        const assignedSnap = await getDocs(query(collection(db, "instituteInstructorAssignments"), where("instructorUid", "==", user.uid)));
        const assigned = assignedSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(a => a.active === true);
        setInstructorAssignments(assigned);
        const courseIds = [...new Set(assigned.map(a => a.courseId))];
        const [lessonSets, assignmentSets, enrollmentSets, submissionSets, attendanceSets, assessmentSets, assessmentSubmissionSets] = await Promise.all([
          Promise.all(courseIds.map(courseId => getDocs(query(collection(db, "instituteLessons"), where("courseId", "==", courseId))))),
          Promise.all(courseIds.map(courseId => getDocs(query(collection(db, "instituteAssignments"), where("courseId", "==", courseId))))),
          Promise.all(courseIds.map(courseId => getDocs(query(collection(db, "instituteEnrollments"), where("courseId", "==", courseId))))),
          Promise.all(courseIds.map(courseId => getDocs(query(collection(db, "instituteSubmissions"), where("courseId", "==", courseId))))),
          Promise.all(courseIds.map(courseId => getDocs(query(collection(db, "instituteAttendance"), where("courseId", "==", courseId))))),
          Promise.all(courseIds.map(courseId => getDocs(query(collection(db, "instituteAssessments"), where("courseId", "==", courseId))))),
          Promise.all(courseIds.map(courseId => getDocs(query(collection(db, "instituteAssessmentSubmissions"), where("courseId", "==", courseId))))
        ]);
        setLessons(lessonSets.flatMap(s => s.docs.map(d => ({ id:d.id, ...d.data() }))).sort((a,b)=>Number(a.sequence||0)-Number(b.sequence||0)));
        setAssignments(assignmentSets.flatMap(s => s.docs.map(d => ({ id:d.id, ...d.data() }))));
        setAllEnrollments(enrollmentSets.flatMap(s => s.docs.map(d => ({ id:d.id, ...d.data() })).filter(en => en.paymentStatus === "paid")));
        setSubmissions(submissionSets.flatMap(s => s.docs.map(d => ({ id:d.id, ...d.data() }))));
        setAttendance(attendanceSets.flatMap(s => s.docs.map(d => ({ id:d.id, ...d.data() }))));
        setAssessments(assessmentSets.flatMap(s => s.docs.map(d => ({ id:d.id, ...d.data() }))));
        setAssessmentSubmissions(assessmentSubmissionSets.flatMap(s => s.docs.map(d => ({ id:d.id, ...d.data() }))));
      }
      if (isAdmin) {
        const all = await getDocs(collection(db, "instituteApplications"));
        setApplications(all.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
        const [assignmentSnap, submissionSnap, enrollmentAllSnap, attendanceSnap, progressSnap, certificateSnap, assessmentSnap, assessmentSubmissionSnap] = await Promise.all([getDocs(collection(db, "instituteAssignments")), getDocs(collection(db, "instituteSubmissions")), getDocs(collection(db, "instituteEnrollments")), getDocs(collection(db, "instituteAttendance")), getDocs(collection(db, "instituteLessonProgress")), getDocs(collection(db, "instituteCertificates")), getDocs(collection(db, "instituteAssessments")), getDocs(collection(db, "instituteAssessmentSubmissions"))]);
        setAssignments(assignmentSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setSubmissions(submissionSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setAllEnrollments(enrollmentAllSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setAttendance(attendanceSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setAllLessonProgress(progressSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setAllCertificates(certificateSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setAssessments(assessmentSnap.docs.map(d => ({ id:d.id, ...d.data() })));
        setAssessmentSubmissions(assessmentSubmissionSnap.docs.map(d => ({ id:d.id, ...d.data() })));
        const announcementSnap = await getDocs(collection(db, "instituteAnnouncements"));
        setAnnouncements(announcementSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0)));
      }
    } catch (e) { setError(e.message || "Could not load Fashion Institute records."); }
  }

  useEffect(() => { load(); }, [user?.uid, isAdmin]);

  const availableWindows = useMemo(() => windows.filter(w => w.status !== "closed" && (!w.applicationClose || w.applicationClose >= new Date().toISOString().slice(0,10))), [windows]);

  async function saveCourse(e) {
    e.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      if (!courseForm.title.trim()) throw new Error("Enter a course title.");
      const fee = Number(courseForm.fee || 0);
      if (!Number.isFinite(fee) || fee < 0) throw new Error("Enter a valid course fee.");
      await addDoc(collection(db, "instituteCourses"), { ...courseForm, title: courseForm.title.trim(), fee, active: true, createdBy: user.uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      setCourseForm(blankCourse); setNotice("Course created successfully."); await load();
    } catch(e) { setError(e.message || "Could not save course."); } finally { setBusy(false); }
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
      await addDoc(collection(db, "trainingWindows"), { ...windowForm, title: windowForm.title.trim(), capacity, fee, status: "open", enrolledCount: 0, createdBy: user.uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      setWindowForm(blankWindow); setNotice("Training window created successfully."); await load();
    } catch(e) { setError(e.message || "Could not create training window."); } finally { setBusy(false); }
  }

  async function apply(e) {
    e.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      const course = courses.find(c => c.id === applicationForm.courseId);
      const win = windows.find(w => w.id === applicationForm.windowId);
      if (!course || !win) throw new Error("Select an available course and training window.");
      if (win.status !== "open" || (win.applicationClose && win.applicationClose < new Date().toISOString().slice(0,10))) throw new Error("This training window is closed.");
      if (Number(win.enrolledCount || 0) >= Number(win.capacity || 0)) throw new Error("This training window has reached its stated capacity. Please select another window.");
      if (!applicationForm.fullName.trim() || !applicationForm.phone.trim() || !applicationForm.address.trim()) throw new Error("Enter your full name, telephone number and residential address.");
      const ref = "MFO-INS-" + Date.now().toString(36).toUpperCase();
      await addDoc(collection(db, "instituteApplications"), {
        applicationRef: ref, customerUid: user.uid, fullName: applicationForm.fullName.trim(), email: user.email || "",
        phone: applicationForm.phone.trim(), address: applicationForm.address.trim(), courseId: course.id, courseTitle: course.title,
        windowId: win.id, windowTitle: win.title, mode: applicationForm.mode, experience: applicationForm.experience.trim(),
        note: applicationForm.note.trim(), status: "pending", paymentStatus: "not_due", createdAt: serverTimestamp(), updatedAt: serverTimestamp()
      });
      setNotice("Application submitted. Your reference is " + ref + ". Admission is not confirmed until reviewed by the Institute.");
      setApplicationForm(v => ({ ...v, experience: "", note: "" })); await load();
    } catch(e) { setError(e.message || "Could not submit application."); } finally { setBusy(false); }
  }

  async function reviewApplication(item, status) {
    setBusy(true); setError(""); setNotice("");
    try {
      const update = { status, updatedAt: serverTimestamp(), reviewedBy: user.uid, reviewedAt: serverTimestamp() };
      if (status === "admitted" && !item.studentId) update.studentId = "MFO-STU-" + Date.now().toString(36).toUpperCase();
      await updateDoc(doc(db, "instituteApplications", item.id), update);
      setNotice("Application " + status + "."); await load();
    } catch(e) { setError(e.message || "Could not update application."); } finally { setBusy(false); }
  }


  async function verifyTrainingPayment(item) {
    setBusy(true); setError(""); setNotice("");
    try {
      if (item.status !== "admitted") throw new Error("Only admitted applicants can have training payment verified.");
      const enrollmentId = item.customerUid + "_" + item.courseId;
      await setDoc(doc(db, "instituteEnrollments", enrollmentId), { studentUid:item.customerUid, applicationId:item.id, applicationRef:item.applicationRef, studentId:item.studentId||"", studentName:item.fullName||"", studentEmail:item.email||"", courseId:item.courseId, courseTitle:item.courseTitle, windowId:item.windowId, windowTitle:item.windowTitle, paymentStatus:"paid", verifiedBy:user.uid, verifiedAt:serverTimestamp(), createdAt:serverTimestamp() });
      await updateDoc(doc(db, "instituteApplications", item.id), { paymentStatus:"paid", paymentVerifiedBy:user.uid, paymentVerifiedAt:serverTimestamp(), updatedAt:serverTimestamp() });
      setNotice("Payment marked verified and course access activated. Confirm funds have actually arrived before using this action."); await load();
    } catch(e) { setError(e.message || "Could not verify training payment."); } finally { setBusy(false); }
  }
  async function createLesson(e) {
    e.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      if (!lessonForm.courseId || !lessonForm.title.trim()) throw new Error("Select a course and enter a lesson title.");
      if ((lessonForm.videoUrl.trim() && !lessonForm.videoUrl.startsWith("https://")) || (lessonForm.resourceUrl.trim() && !lessonForm.resourceUrl.startsWith("https://"))) throw new Error("Learning links must use HTTPS.");
      await addDoc(collection(db, "instituteLessons"), { courseId:lessonForm.courseId, title:lessonForm.title.trim(), module:lessonForm.module.trim(), type:lessonForm.type, content:lessonForm.content.trim(), videoUrl:lessonForm.videoUrl.trim(), resourceUrl:lessonForm.resourceUrl.trim(), sequence:Number(lessonForm.sequence||1), published:true, createdBy:user.uid, createdAt:serverTimestamp(), updatedAt:serverTimestamp() });
      setLessonForm(v=>({...v,title:"",module:"",content:"",videoUrl:"",resourceUrl:""})); setNotice("Lesson published to eligible enrolled students."); await load();
    } catch(e) { setError(e.message || "Could not publish lesson."); } finally { setBusy(false); }
  }

  async function createAssignment(e) {
    e.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      if (!assignmentForm.courseId || !assignmentForm.title.trim() || !assignmentForm.instructions.trim()) throw new Error("Choose a course and provide an assignment title and instructions.");
      const points = Number(assignmentForm.points || 100);
      if (!Number.isFinite(points) || points < 1) throw new Error("Enter a valid maximum score.");
      await addDoc(collection(db, "instituteAssignments"), { courseId: assignmentForm.courseId, courseTitle: courses.find(c=>c.id===assignmentForm.courseId)?.title || "", title: assignmentForm.title.trim(), instructions: assignmentForm.instructions.trim(), dueDate: assignmentForm.dueDate || "", points, published: true, createdBy: user.uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      setAssignmentForm(v=>({...v,title:"",instructions:"",dueDate:""})); setNotice("Assignment published to paid students in the selected course."); await load();
    } catch(e) { setError(e.message || "Could not publish assignment."); } finally { setBusy(false); }
  }

  async function submitAssignment(item) {
    setBusy(true); setError(""); setNotice("");
    try {
      const answer = (submissionDrafts[item.id] || "").trim();
      if (!answer) throw new Error("Enter your assignment response before submitting.");
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
      const questions = assessmentForm.questions.split(/\r?\n/).map(q => q.trim()).filter(Boolean);
      if (!assessmentForm.courseId || !assessmentForm.title.trim() || !questions.length) throw new Error("Choose a course, enter an assessment title and add at least one question (one per line).");
      if (questions.length > 30) throw new Error("An assessment can contain up to 30 questions.");
      const course = courses.find(c => c.id === assessmentForm.courseId);
      await addDoc(collection(db, "instituteAssessments"), { courseId:course.id, courseTitle:course.title, title:assessmentForm.title.trim(), instructions:assessmentForm.instructions.trim(), dueDate:assessmentForm.dueDate || "", questions, published:true, createdBy:user.uid, createdAt:serverTimestamp(), updatedAt:serverTimestamp() });
      setAssessmentForm({ courseId:"", title:"", instructions:"", dueDate:"", questions:"" }); setNotice("Assessment published. Responses will be manually graded by authorized teaching staff."); await load();
    } catch(e) { setError(e.message || "Could not publish assessment."); } finally { setBusy(false); }
  }

  async function submitAssessment(item) {
    setBusy(true); setError(""); setNotice("");
    try {
      const answers = item.questions.map((q,i) => (assessmentDrafts[item.id + "_" + i] || "").trim());
      if (answers.some(a => !a)) throw new Error("Answer every question before submitting.");
      if (assessmentSubmissions.some(s => s.assessmentId === item.id && s.studentUid === user.uid)) throw new Error("You have already submitted this assessment.");
      const submissionId = user.uid + "_" + item.id;
      await setDoc(doc(db, "instituteAssessmentSubmissions", submissionId), { assessmentId:item.id, courseId:item.courseId, assessmentTitle:item.title, studentUid:user.uid, studentName:user.displayName || user.email || "Student", answers, status:"submitted", submittedAt:serverTimestamp(), createdAt:serverTimestamp(), updatedAt:serverTimestamp() });
      setNotice("Assessment submitted successfully."); await load();
    } catch(e) { setError(e.message || "Could not submit assessment."); } finally { setBusy(false); }
  }

  async function gradeAssessment(item) {
    const scoreText = window.prompt("Enter assessment score (0 to " + (item.answers.length * 10) + "). Each question is provisionally worth 10 points.");
    if (scoreText === null) return;
    const score = Number(scoreText); const maxScore = item.answers.length * 10;
    if (!Number.isFinite(score) || score < 0 || score > maxScore) { setError("Enter a valid score within the assessment maximum."); return; }
    const feedback = window.prompt("Optional assessment feedback") || "";
    setBusy(true); setError(""); setNotice("");
    try { await updateDoc(doc(db, "instituteAssessmentSubmissions", item.id), { status:"graded", score, maxScore, feedback, gradedBy:user.uid, gradedAt:serverTimestamp(), updatedAt:serverTimestamp() }); setNotice("Assessment graded."); await load(); }
    catch(e) { setError(e.message || "Could not grade assessment."); } finally { setBusy(false); }
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

  async function issueCertificate() {
    setBusy(true); setError(""); setNotice("");
    try {
      const enrollment = allEnrollments.find(item => item.id === certificateEnrollmentId);
      if (!enrollment || enrollment.paymentStatus !== "paid") throw new Error("Select a student with verified paid-course access.");
      const certificateId = enrollment.studentUid + "_" + enrollment.courseId;
      if (allCertificates.some(item => item.id === certificateId)) throw new Error("A certificate has already been issued for this student and course.");
      const certificateRef = "MFO-CERT-" + Date.now().toString(36).toUpperCase();
      await setDoc(doc(db, "instituteCertificates", certificateId), {
        certificateRef, studentUid: enrollment.studentUid, studentId: enrollment.studentId || "",
        studentName: enrollment.studentName || enrollment.studentEmail || "Student",
        courseId: enrollment.courseId, courseTitle: enrollment.courseTitle || "Fashion training",
        windowId: enrollment.windowId || "", windowTitle: enrollment.windowTitle || "",
        status: "issued", issuedAt: serverTimestamp(), issuedBy: user.uid, createdAt: serverTimestamp()
      });
      setCertificateEnrollmentId("");
      setNotice("Certificate issued: " + certificateRef + ". Confirm course completion before issuing.");
      await load();
    } catch(e) { setError(e.message || "Could not issue certificate."); } finally { setBusy(false); }
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
    <div className="customer-management-heading"><div><h3>MR FOP Fashion Institute</h3><p>Courses, training intakes and admission applications</p></div><button type="button" onClick={load}>Refresh institute</button></div>
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
        <label>Course<select required value={instructorForm.courseId} onChange={e=>setInstructorForm({...instructorForm,courseId:e.target.value})}><option value="">Choose course</option>{courses.map(c=><option key={c.id} value={c.id}>{c.title}</option>)}</select></label>
        <button className="portal-submit" disabled={busy||!courses.length}>Assign instructor</button>
      </form>
      <form className="portal-form" onSubmit={publishAnnouncement}>
        <h4>Publish an Institute announcement</h4>
        <label>Audience<select value={announcementForm.courseId} onChange={e=>setAnnouncementForm({...announcementForm,courseId:e.target.value})}><option value="all">All paid students</option>{courses.map(c=><option key={c.id} value={c.id}>{c.title} students</option>)}</select></label>
        <label>Announcement title<input required maxLength="120" value={announcementForm.title} onChange={e=>setAnnouncementForm({...announcementForm,title:e.target.value})}/></label>
        <label>Message<textarea required rows="4" maxLength="3000" value={announcementForm.message} onChange={e=>setAnnouncementForm({...announcementForm,message:e.target.value})}/></label>
        <label>Expiry date (optional)<input type="date" value={announcementForm.expiresOn} onChange={e=>setAnnouncementForm({...announcementForm,expiresOn:e.target.value})}/></label>
        <button className="portal-submit" disabled={busy}>Publish announcement</button>
      </form>
      <div className="institute-admin-grid">
        <form className="portal-form" onSubmit={saveCourse}><h4>Create a course</h4>
          <label>Course title<input required value={courseForm.title} onChange={e=>setCourseForm({...courseForm,title:e.target.value})} placeholder="e.g. Advanced Pattern Drafting"/></label>
          <label>Suggested course category<select value={courseForm.category} onChange={e=>setCourseForm({...courseForm,category:e.target.value})}>{COURSE_TYPES.map(x=><option key={x}>{x}</option>)}</select></label>
          <label>Description<textarea value={courseForm.description} onChange={e=>setCourseForm({...courseForm,description:e.target.value})}/></label>
          <label>Learning modes<input value={courseForm.mode} onChange={e=>setCourseForm({...courseForm,mode:e.target.value})}/></label>
          <label>Duration<input value={courseForm.duration} onChange={e=>setCourseForm({...courseForm,duration:e.target.value})}/></label>
          <label>Indicative fee (₦)<input type="number" min="0" step="0.01" value={courseForm.fee} onChange={e=>setCourseForm({...courseForm,fee:e.target.value})}/></label>
          <button className="portal-submit" disabled={busy}>Create course</button>
        </form>
        <form className="portal-form" onSubmit={saveWindow}><h4>Create a training window</h4>
          <label>Intake name<input required value={windowForm.title} onChange={e=>setWindowForm({...windowForm,title:e.target.value})} placeholder="e.g. January–March intake"/></label>
          <label>Course<select required value={windowForm.courseId} onChange={e=>setWindowForm({...windowForm,courseId:e.target.value})}><option value="">Choose course</option>{courses.map(c=><option key={c.id} value={c.id}>{c.title}</option>)}</select></label>
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
          <button className="portal-submit" disabled={busy || !courses.length}>Create training window</button>
        </form>
      </div>
      <div className="institute-window-list"><h4>Manage training windows</h4>{windows.map(w=><article className="appointment-card" key={w.id}><strong>{w.title}</strong><span>{w.courseTitle || courses.find(c=>c.id===w.courseId)?.title}</span><p>{w.applicationOpen} – {w.applicationClose} · Starts {w.commencement} · Capacity {w.enrolledCount||0}/{w.capacity}</p><label>Window status<select value={w.status||"open"} onChange={e=>changeWindowStatus(w,e.target.value)} disabled={busy}><option value="open">Open</option><option value="closed">Closed</option><option value="completed">Completed</option></select></label></article>)}</div>
      <div className="institute-window-list"><h4>Admission applications</h4>{applications.length?applications.map(a=><article className="appointment-card" key={a.id}><strong>{a.applicationRef} · {a.fullName}</strong><span>{a.email} · {a.phone}</span><p>{a.courseTitle} · {a.windowTitle} · {a.mode}</p><p>{a.address}</p>{a.experience&&<p>Experience: {a.experience}</p>}{a.note&&<p>{a.note}</p>}<p>Status: {a.status} · Payment: {a.paymentStatus}</p><div className="finance-form-actions"><button type="button" disabled={busy} onClick={()=>reviewApplication(a,"admitted")}>Admit</button><button type="button" disabled={busy} onClick={()=>reviewApplication(a,"rejected")}>Reject</button><button type="button" disabled={busy} onClick={()=>reviewApplication(a,"more_information")}>Request information</button></div>{a.studentId&&<p>Student ID: {a.studentId}</p>}{claims.superAdmin&&a.status==="admitted"&&a.paymentStatus!=="paid"&&<button type="button" disabled={busy} onClick={()=>verifyTrainingPayment(a)}>Verify received training payment & activate access</button>}{a.paymentStatus==="paid"&&<p>Course access activated.</p>}</article>):<p className="staff-empty">No applications received.</p>}</div>
    </>}

    {isInstructor && <section className="institute-window-list">
      <h4>My instructor assignments</h4>
      {instructorAssignments.length ? instructorAssignments.map(a => <article className="appointment-card" key={a.id}><strong>{a.courseTitle || courses.find(c=>c.id===a.courseId)?.title || "Assigned course"}</strong><span>Course ID: {a.courseId}</span><p>Assignment status: {a.active ? "Active" : "Inactive"}</p></article>) : <p className="staff-empty">No courses have been assigned to this instructor account yet.</p>}
    </section>}
    {isAdmin && <section className="institute-window-list">
      <h4>Student learning progress</h4>
      {allEnrollments.map(en=>{const courseLessons=lessons.filter(l=>l.courseId===en.courseId);const done=allLessonProgress.filter(p=>p.studentUid===en.studentUid&&p.courseId===en.courseId&&p.completed).length;return <article className="appointment-card" key={en.id}><strong>{en.studentName || en.studentEmail || en.studentUid}</strong><span>{en.courseTitle} · {done}/{courseLessons.length} lessons completed</span><p>{courseLessons.length ? Math.round(Math.min(done,courseLessons.length)/courseLessons.length*100)+"% lesson completion" : "No lessons published yet."}</p></article>})}
      {!allEnrollments.length&&<p className="staff-empty">Student progress will appear after course enrolments are activated.</p>}
    </section>}
    {(isAdmin || isInstructor) && <section className="institute-window-list">
      <h4>Student attendance register</h4>
      <label>Attendance date<input type="date" value={attendanceDate} onChange={e=>setAttendanceDate(e.target.value)}/></label>
      {allEnrollments.filter(en=>!isInstructor || instructorAssignments.some(a=>a.courseId===en.courseId&&a.active)).map(en=>{const record=attendance.find(a=>a.studentUid===en.studentUid&&a.courseId===en.courseId&&a.date===attendanceDate);return <article className="appointment-card" key={en.id}><strong>{en.studentName || en.studentEmail || en.studentUid}</strong><span>{en.studentId} · {en.courseTitle} · {en.windowTitle}</span><p>Attendance: {record?.status || "Not marked"}</p><div className="finance-form-actions">{["present","absent","late","excused"].map(status=><button type="button" key={status} disabled={busy} onClick={()=>markAttendance(en,status)}>{status[0].toUpperCase()+status.slice(1)}</button>)}</div></article>})}
      {!allEnrollments.length&&<p className="staff-empty">No enrolled students are available for attendance marking.</p>}
    </section>}
    {isAdmin && <section className="institute-window-list">
      <h4>Certificates and completion status</h4>
      <label>Paid student and course<select value={certificateEnrollmentId} onChange={e=>setCertificateEnrollmentId(e.target.value)}>
        <option value="">Select a paid enrolment</option>
        {allEnrollments.filter(en=>en.paymentStatus==="paid"&&!allCertificates.some(c=>c.id===en.id)).map(en=><option key={en.id} value={en.id}>{en.studentName||en.studentEmail||en.studentUid} · {en.courseTitle}</option>)}
      </select></label>
      <button type="button" disabled={busy||!certificateEnrollmentId} onClick={issueCertificate}>Issue course completion certificate</button>
      {allCertificates.length?allCertificates.map(c=><article className="appointment-card" key={c.id}><strong>{c.certificateRef}</strong><span>{c.studentName} · {c.courseTitle}</span><p>Status: {c.status} · {c.windowTitle}</p></article>):<p className="staff-empty">No certificates have been issued yet.</p>}
      <small>Issue a certificate only after independently confirming that the student has completed the required training and assessments.</small>
    </section>}
    {!isAdmin && !isInstructor && <section className="institute-window-list"><h4>My certificates</h4>{certificates.length?certificates.map(c=><article className="appointment-card" key={c.id}><strong>{c.certificateRef}</strong><span>{c.courseTitle} · {c.windowTitle}</span><p>Status: {c.status} · Issued {c.issuedAt?.toDate ? c.issuedAt.toDate().toLocaleDateString() : "date pending"}</p></article>):<p className="staff-empty">Certificates will appear here after the Institute confirms course completion and issues them.</p>}</section>}
    {!isAdmin && !isInstructor && <section className="institute-window-list"><h4>My attendance record</h4>{attendance.length?attendance.map(a=><article className="appointment-card" key={a.id}><strong>{a.courseTitle}</strong><span>{a.date} · {a.status}</span></article>):<p className="staff-empty">Your attendance records will appear here when the Institute marks attendance.</p>}</section>}
    {(isAdmin || isInstructor) && <form className="portal-form" onSubmit={createAssessment}>
      <h4>Publish a student assessment</h4>
      <label>Course<select required value={assessmentForm.courseId} onChange={e=>setAssessmentForm({...assessmentForm,courseId:e.target.value})}><option value="">Choose course</option>{(isInstructor ? courses.filter(c=>instructorAssignments.some(a=>a.courseId===c.id&&a.active)) : courses).map(c=><option key={c.id} value={c.id}>{c.title}</option>)}</select></label>
      <label>Assessment title<input required value={assessmentForm.title} onChange={e=>setAssessmentForm({...assessmentForm,title:e.target.value})}/></label>
      <label>Instructions<textarea rows="3" value={assessmentForm.instructions} onChange={e=>setAssessmentForm({...assessmentForm,instructions:e.target.value})}/></label>
      <label>Due date (optional)<input type="date" value={assessmentForm.dueDate} onChange={e=>setAssessmentForm({...assessmentForm,dueDate:e.target.value})}/></label>
      <label>Questions (one question per line)<textarea required rows="7" value={assessmentForm.questions} onChange={e=>setAssessmentForm({...assessmentForm,questions:e.target.value})} placeholder="Explain the basic tools used in garment construction.&#10;Describe the steps in taking body measurements."/></label>
      <button className="portal-submit" disabled={busy||!courses.length}>Publish assessment</button>
    </form>}
    {!isAdmin && !isInstructor && <section className="institute-window-list"><h4>My assessments</h4>{assessments.map(a=>{const prior=assessmentSubmissions.find(s=>s.assessmentId===a.id);return <article className="appointment-card" key={a.id}><strong>{a.title}</strong><span>{a.courseTitle}{a.dueDate?" · Due "+a.dueDate:""}</span>{a.instructions&&<p>{a.instructions}</p>}{prior?<div><p>Submission: {prior.status}</p>{prior.status==="graded"&&<p>Score: {prior.score}/{prior.maxScore} · {prior.feedback}</p>}{prior.answers?.map((answer,i)=><p key={i}>Q{i+1}: {answer}</p>)}</div>:<div>{a.questions.map((q,i)=><label key={i}>Q{i+1}. {q}<textarea rows="3" value={assessmentDrafts[a.id+"_"+i]||""} onChange={e=>setAssessmentDrafts(v=>({...v,[a.id+"_"+i]:e.target.value}))}/></label>)}<button type="button" disabled={busy} onClick={()=>submitAssessment(a)}>Submit assessment</button></div>}</article>})}{!assessments.length&&<p className="staff-empty">No assessments are available for your paid courses.</p>}</section>}
    {(isAdmin || isInstructor) && <section className="institute-window-list"><h4>Assessment submissions & grading</h4>{assessmentSubmissions.length?assessmentSubmissions.map(sub=><article className="appointment-card" key={sub.id}><strong>{sub.assessmentTitle}</strong><span>{sub.studentName} · {sub.status}</span>{sub.answers?.map((answer,i)=><p key={i}>Q{i+1}: {answer}</p>)}{sub.status==="graded"?<p>Score: {sub.score}/{sub.maxScore} · {sub.feedback}</p>:<button type="button" disabled={busy} onClick={()=>gradeAssessment(sub)}>Grade assessment</button>}</article>):<p className="staff-empty">No assessment submissions yet.</p>}</section>}
    {(isAdmin || isInstructor) && <form className="portal-form" onSubmit={createAssignment}>
      <h4>Publish a course assignment</h4>
      <label>Course<select required value={assignmentForm.courseId} onChange={e=>setAssignmentForm({...assignmentForm,courseId:e.target.value})}><option value="">Choose course</option>{(isInstructor ? courses.filter(c=>instructorAssignments.some(a=>a.courseId===c.id&&a.active)) : courses).map(c=><option key={c.id} value={c.id}>{c.title}</option>)}</select></label>
      <label>Assignment title<input required value={assignmentForm.title} onChange={e=>setAssignmentForm({...assignmentForm,title:e.target.value})}/></label>
      <label>Instructions<textarea required rows="5" value={assignmentForm.instructions} onChange={e=>setAssignmentForm({...assignmentForm,instructions:e.target.value})}/></label>
      <label>Due date (optional)<input type="date" value={assignmentForm.dueDate} onChange={e=>setAssignmentForm({...assignmentForm,dueDate:e.target.value})}/></label>
      <label>Maximum score<input type="number" min="1" step="1" value={assignmentForm.points} onChange={e=>setAssignmentForm({...assignmentForm,points:e.target.value})}/></label>
      <button className="portal-submit" disabled={busy||!courses.length}>Publish assignment</button>
    </form>}
    {(isAdmin || isInstructor) && <div className="institute-window-list"><h4>Student submissions & grading</h4>{submissions.length?submissions.map(sub=><article className="appointment-card" key={sub.id}><strong>{sub.assignmentTitle}</strong><span>{sub.studentName} · {sub.status}</span><p>{sub.answer}</p>{sub.status==="graded"?<p>Score: {sub.score}/{sub.maxScore} · {sub.feedback}</p>:<button type="button" disabled={busy} onClick={()=>gradeSubmission(sub,"graded")}>Grade submission</button>}</article>):<p className="staff-empty">No student submissions yet.</p>}</div>}
    {!isAdmin && !isInstructor && <div className="institute-window-list"><h4>My course assignments</h4>{assignments.map(a=>{const prior=submissions.find(s=>s.assignmentId===a.id);return <article className="appointment-card" key={a.id}><strong>{a.title}</strong><span>{a.courseTitle} · Maximum score: {a.points}</span>{a.dueDate&&<p>Due: {a.dueDate}</p>}<p>{a.instructions}</p>{prior?<div><p>Submission status: {prior.status}</p>{prior.status==="graded"&&<p>Score: {prior.score}/{prior.maxScore} · {prior.feedback}</p>}<p>{prior.answer}</p></div>:<><label>Your response<textarea rows="5" value={submissionDrafts[a.id]||""} onChange={e=>setSubmissionDrafts(v=>({...v,[a.id]:e.target.value}))}/></label><button type="button" disabled={busy} onClick={()=>submitAssignment(a)}>Submit assignment</button></>}</article>})}{!assignments.length&&<p className="staff-empty">No assignments have been published for your enrolled courses.</p>}</div>}
    {(isAdmin || isInstructor) && <form className="portal-form" onSubmit={createLesson}><h4>Publish a course lesson</h4>
      <label>Course<select required value={lessonForm.courseId} onChange={e=>setLessonForm({...lessonForm,courseId:e.target.value})}><option value="">Choose course</option>{(isInstructor ? courses.filter(c=>instructorAssignments.some(a=>a.courseId===c.id&&a.active)) : courses).map(x=><option key={x.id} value={x.id}>{x.title}</option>)}</select></label>
      <label>Lesson title<input required value={lessonForm.title} onChange={e=>setLessonForm({...lessonForm,title:e.target.value})}/></label>
      <label>Module / topic<input value={lessonForm.module} onChange={e=>setLessonForm({...lessonForm,module:e.target.value})}/></label>
      <label>Lesson type<select value={lessonForm.type} onChange={e=>setLessonForm({...lessonForm,type:e.target.value})}><option>Text lesson</option><option>Video lesson</option><option>Reading resource</option></select></label>
      <label>Lesson content<textarea rows="5" value={lessonForm.content} onChange={e=>setLessonForm({...lessonForm,content:e.target.value})}/></label>
      <label>Video URL (HTTPS)<input type="url" value={lessonForm.videoUrl} onChange={e=>setLessonForm({...lessonForm,videoUrl:e.target.value})}/></label>
      <label>Resource URL (HTTPS)<input type="url" value={lessonForm.resourceUrl} onChange={e=>setLessonForm({...lessonForm,resourceUrl:e.target.value})}/></label>
      <label>Sequence number<input type="number" min="1" step="1" value={lessonForm.sequence} onChange={e=>setLessonForm({...lessonForm,sequence:e.target.value})}/></label>
      <button className="portal-submit" disabled={busy||!courses.length}>Publish lesson</button>
    </form>}
    {!isAdmin && !isInstructor && <div className="institute-window-list"><h4>My enrolled courses & lessons</h4>{enrollments.map(en=><article className="appointment-card" key={en.id}><strong>{en.courseTitle}</strong><span>{en.studentId} · {en.windowTitle}</span>{lessons.filter(l=>l.courseId===en.courseId).map(l=>{const done=lessonProgress.some(p=>p.lessonId===l.id&&p.completed);return <div className="institute-lesson" key={l.id}><b>{l.sequence}. {l.title}</b>{l.module&&<small>{l.module}</small>}{l.content&&<p>{l.content}</p>}{l.videoUrl&&<p><a href={l.videoUrl} target="_blank" rel="noreferrer">Open video lesson</a></p>}{l.resourceUrl&&<p><a href={l.resourceUrl} target="_blank" rel="noreferrer">Open learning resource</a></p>}<p>{done?"Completed":"Not completed"}</p><button type="button" disabled={busy||done} onClick={()=>markLessonComplete(l)}>{done?"Lesson completed":"Mark lesson as completed"}</button></div>})}</article>)}{!enrollments.length&&<p className="staff-empty">Course lessons become available after admission and payment verification by the Institute.</p>}</div>}
  </section>;
}
