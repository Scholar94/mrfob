import { readFileSync } from "node:fs";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc, Timestamp, writeBatch } from "firebase/firestore";

const rules = readFileSync(new URL("../firestore.rules", import.meta.url), "utf8");
const env = await initializeTestEnvironment({
  projectId: "demo-mrfop-rules",
  firestore: { rules }
});
const now = Timestamp.now();
const customerA = env.authenticatedContext("customer-a", { email: "customer-a@example.com" }).firestore();
const customerB = env.authenticatedContext("customer-b", { email: "customer-b@example.com" }).firestore();
const finance = env.authenticatedContext("finance-a", { email: "finance@example.com" }).firestore();
const manager = env.authenticatedContext("manager-a", { email: "manager@example.com" }).firestore();
const superAdmin = env.authenticatedContext("admin-a", { email: "admin@example.com" }).firestore();
const anonymous = env.unauthenticatedContext().firestore();

try {
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    for (const [uid, role] of [
      ["customer-a", "customer"], ["customer-b", "customer"],
      ["finance-a", "finance"], ["manager-a", "manager"], ["admin-a", "superAdmin"]
    ]) await setDoc(doc(db, "roles", uid), { role });
    await setDoc(doc(db, "payments", "payment-a"), {
      customerUid: "customer-a", amount: 10000, orderId: "order-a",
      orderNumber: "MFF-001", currency: "NGN", createdAt: now
    });
    await setDoc(doc(db, "instituteCourses", "course-a"), { title: "Test course", active: true });
    await setDoc(doc(db, "trainingWindows", "window-a"), {
      courseId: "course-a", status: "open", capacity: 5, enrolledCount: 1
    });
    await setDoc(doc(db, "instituteApplications", "application-a"), {
      customerUid: "customer-a", fullName: "Test Learner", email: "customer-a@example.com",
      courseId: "course-a", courseTitle: "Test course", windowId: "window-a",
      windowTitle: "Test intake", status: "admitted", paymentStatus: "paid",
      applicationRef: "MFF-APP-001", createdAt: now, updatedAt: now
    });
    await setDoc(doc(db, "instituteEnrollments", "customer-a_course-a"), {
      studentUid: "customer-a", applicationId: "application-a", applicationRef: "MFF-APP-001",
      studentId: "MFF-STU-001", studentName: "Test Learner", studentEmail: "customer-a@example.com",
      courseId: "course-a", courseTitle: "Test course", windowId: "window-a",
      windowTitle: "Test intake", paymentStatus: "paid", verifiedBy: "admin-a",
      verifiedAt: now, createdAt: now
    });
    await setDoc(doc(db, "instituteLessons", "lesson-a"), {
      courseId: "course-a", title: "Test lesson", published: true
    });
    await setDoc(doc(db, "instituteAttendance", "attendance-a"), {
      studentUid: "customer-a", studentId: "MFF-STU-001", studentName: "Test Learner",
      courseId: "course-a", courseTitle: "Test course", windowId: "window-a",
      date: "2026-11-13", status: "present", markedBy: "admin-a", markedAt: now, updatedAt: now
    });
    await setDoc(doc(db, "appointments", "appointment-a"), {
      customerUid: "customer-a", customerName: "Test Customer",
      customerEmail: "customer-a@example.com", service: "Measurement",
      appointmentDate: "2026-11-20", appointmentTime: "10:00",
      purpose: "Test appointment", status: "pending",
      createdAt: now, updatedAt: now
    });
    await setDoc(doc(db, "appointments", "appointment-alternative"), {
      customerUid: "customer-a", customerName: "Test Customer",
      customerEmail: "customer-a@example.com", service: "Measurement",
      appointmentDate: "2026-11-19", appointmentTime: "09:00",
      proposedDate: "2026-11-22", proposedTime: "14:00",
      purpose: "Alternative confirmation test", status: "alternative_proposed",
      createdAt: now, updatedAt: now
    });

    await setDoc(doc(db, "fabrics", "active-fabric"), {
      name: "Test cotton", color: "Navy", texture: "Soft",
      priceRange: "Price on request", availability: "available",
      suitableCategories: ["Shirts"], imageUrl: "", active: true,
      createdAt: now, createdBy: "admin-a", updatedAt: now
    });
    await setDoc(doc(db, "fabrics", "archived-fabric"), {
      name: "Archived cotton", color: "Grey", texture: "Soft",
      priceRange: "", availability: "out_of_stock",
      suitableCategories: [], imageUrl: "", active: false,
      createdAt: now, createdBy: "admin-a", updatedAt: now
    });
  });

  // Customer privacy: only the owner can create and read their own privacy request.
  const privacyRef = doc(customerA, "privacyRequests", "privacy-a");
  await assertSucceeds(setDoc(privacyRef, {
    customerUid: "customer-a", customerEmail: "customer-a@example.com",
    requestType: "access", details: "Please provide a copy of my account records.",
    status: "received", staffNote: "", createdAt: now, updatedAt: now
  }));
  await assertSucceeds(getDoc(privacyRef));
  await assertFails(getDoc(doc(customerB, "privacyRequests", "privacy-a")));
  await assertFails(updateDoc(privacyRef, { status: "completed", updatedAt: now }));

  // Refund: one request is bound to the customer's verified payment and cannot be duplicated.
  const refundRef = doc(customerA, "refunds", "payment-a");
  await assertSucceeds(setDoc(refundRef, {
    paymentId: "payment-a", orderId: "order-a", orderNumber: "MFF-001",
    customerUid: "customer-a", customerEmail: "customer-a@example.com",
    amount: 5000, currency: "NGN", reason: "The agreed service was cancelled.",
    status: "requested", reviewNote: "", refundReference: "",
    createdAt: now, updatedAt: now
  }));
  await assertSucceeds(getDoc(refundRef));
  await assertFails(getDoc(doc(customerB, "refunds", "payment-a")));
  await assertFails(setDoc(refundRef, {
    paymentId: "payment-a", orderId: "order-a", orderNumber: "MFF-001",
    customerUid: "customer-a", customerEmail: "customer-a@example.com",
    amount: 5000, currency: "NGN", reason: "Duplicate refund request.",
    status: "requested", reviewNote: "", refundReference: "",
    createdAt: now, updatedAt: now
  }));
  await assertSucceeds(updateDoc(doc(finance, "refunds", "payment-a"), {
    status: "reviewing", reviewNote: "Reviewing the request.", refundReference: "",
    reviewedBy: "finance-a", updatedAt: now
  }));
  await assertSucceeds(updateDoc(doc(finance, "refunds", "payment-a"), {
    status: "approved", reviewNote: "Approved after review.", refundReference: "",
    reviewedBy: "finance-a", updatedAt: now
  }));
  await assertFails(updateDoc(doc(finance, "refunds", "payment-a"), {
    status: "paid", reviewNote: "Transfer sent.", refundReference: "",
    reviewedBy: "finance-a", updatedAt: now, processedAt: now
  }));
  await assertSucceeds(updateDoc(doc(finance, "refunds", "payment-a"), {
    status: "paid", reviewNote: "Transfer sent.", refundReference: "BANK-TRANSFER-001",
    reviewedBy: "finance-a", updatedAt: now, processedAt: now
  }));
  await assertFails(updateDoc(doc(finance, "refunds", "payment-a"), {
    status: "approved", reviewNote: "Attempt to change a completed refund.",
    refundReference: "BANK-TRANSFER-001", reviewedBy: "finance-a", updatedAt: now
  }));

  // Appointment lifecycle: customers may request only their own pending bookings.
  await assertSucceeds(setDoc(doc(customerA, "appointments", "appointment-customer-request"), {
    customerUid: "customer-a", customerName: "Test Customer",
    customerEmail: "customer-a@example.com", service: "Measurement",
    appointmentDate: "2026-11-21", appointmentTime: "11:00",
    purpose: "Customer-created request", status: "pending",
    createdAt: now, updatedAt: now
  }));
  await assertFails(setDoc(doc(customerA, "appointments", "appointment-forged-owner"), {
    customerUid: "customer-b", customerName: "Other Customer",
    customerEmail: "customer-b@example.com", service: "Measurement",
    appointmentDate: "2026-11-21", appointmentTime: "11:00",
    purpose: "Forged owner", status: "pending",
    createdAt: now, updatedAt: now
  }));
  await assertFails(setDoc(doc(customerA, "appointments", "appointment-forged-confirmed"), {
    customerUid: "customer-a", customerName: "Test Customer",
    customerEmail: "customer-a@example.com", service: "Measurement",
    appointmentDate: "2026-11-21", appointmentTime: "11:00",
    purpose: "Customer cannot self-confirm", status: "confirmed",
    createdAt: now, updatedAt: now
  }));
  await assertFails(updateDoc(doc(customerB, "appointments", "appointment-a"), {
    status: "cancelled", updatedAt: now
  }));
  const confirmedBooking = writeBatch(superAdmin);
  confirmedBooking.update(doc(superAdmin, "appointments", "appointment-a"), {
    status: "confirmed", updatedAt: now
  });
  confirmedBooking.set(doc(superAdmin, "appointmentSlots", "2026-11-20_10:00"), {
    appointmentId: "appointment-a", customerUid: "customer-a",
    appointmentDate: "2026-11-20", appointmentTime: "10:00", updatedAt: now
  });
  await assertSucceeds(confirmedBooking.commit());
  await assertSucceeds(getDoc(doc(customerA, "appointments", "appointment-a")));
  await assertFails(getDoc(doc(customerB, "appointments", "appointment-a")));
  await assertFails(setDoc(doc(customerB, "appointmentSlots", "2026-11-20_10:00"), {
    appointmentId: "appointment-a", customerUid: "customer-a",
    appointmentDate: "2026-11-20", appointmentTime: "10:00", updatedAt: now
  }));
  // Accepting an alternative must atomically reserve its exact slot; a direct
  // appointment-document update without the matching slot is rejected.
  await assertFails(updateDoc(doc(customerA, "appointments", "appointment-alternative"), {
    status: "confirmed", appointmentDate: "2026-11-22",
    appointmentTime: "14:00", updatedAt: now
  }));
  const acceptedAlternative = writeBatch(customerA);
  acceptedAlternative.update(doc(customerA, "appointments", "appointment-alternative"), {
    status: "confirmed", appointmentDate: "2026-11-22",
    appointmentTime: "14:00", updatedAt: now
  });
  acceptedAlternative.set(doc(customerA, "appointmentSlots", "2026-11-22_14:00"), {
    appointmentId: "appointment-alternative", customerUid: "customer-a",
    appointmentDate: "2026-11-22", appointmentTime: "14:00", updatedAt: now
  });
  await assertSucceeds(acceptedAlternative.commit());

  // Public fabric visibility: active records are public; archived records remain private.
  await assertSucceeds(getDoc(doc(anonymous, "fabrics", "active-fabric")));
  await assertFails(getDoc(doc(anonymous, "fabrics", "archived-fabric")));
  await assertSucceeds(getDoc(doc(superAdmin, "fabrics", "archived-fabric")));
  await assertFails(setDoc(doc(customerA, "fabrics", "customer-fabric"), {
    name: "Invalid", color: "Red", texture: "Soft", priceRange: "",
    availability: "available", suitableCategories: [], imageUrl: "",
    active: true, createdAt: now, createdBy: "customer-a", updatedAt: now
  }));

  // Institute withdrawal must decrement the intake and remove paid lesson access atomically.
  await assertSucceeds(getDoc(doc(customerA, "instituteLessons", "lesson-a")));
  const applicationOnlyWithdrawal = writeBatch(superAdmin);
  applicationOnlyWithdrawal.update(doc(superAdmin, "instituteApplications", "application-a"), {
    status: "withdrawn", withdrawalReason: "Learner requested withdrawal.",
    withdrawnBy: "admin-a", withdrawnAt: now, updatedAt: now
  });
  applicationOnlyWithdrawal.update(doc(superAdmin, "trainingWindows", "window-a"), {
    enrolledCount: 0, updatedAt: now
  });
  await assertFails(applicationOnlyWithdrawal.commit());
  const withdrawalBatch = writeBatch(superAdmin);
  withdrawalBatch.update(doc(superAdmin, "instituteApplications", "application-a"), {
    status: "withdrawn", withdrawalReason: "Learner requested withdrawal.",
    withdrawnBy: "admin-a", withdrawnAt: now, updatedAt: now
  });
  withdrawalBatch.update(doc(superAdmin, "trainingWindows", "window-a"), {
    enrolledCount: 0, updatedAt: now
  });
  withdrawalBatch.update(doc(superAdmin, "instituteEnrollments", "customer-a_course-a"), {
    enrollmentStatus: "withdrawn", withdrawalReason: "Learner requested withdrawal.",
    withdrawnBy: "admin-a", withdrawnAt: now, updatedAt: now
  });
  await assertSucceeds(withdrawalBatch.commit());
  await assertFails(getDoc(doc(customerA, "instituteLessons", "lesson-a")));
  await assertFails(setDoc(doc(customerA, "instituteLessonProgress", "customer-a_course-a_lesson-a"), {
    studentUid: "customer-a", courseId: "course-a", lessonId: "lesson-a",
    lessonTitle: "Test lesson", completed: true, completedAt: now, updatedAt: now
  }));
  await assertFails(setDoc(doc(manager, "instituteAttendance", "attendance-after-withdrawal"), {
    studentUid: "customer-a", studentId: "MFF-STU-001", studentName: "Test Learner",
    courseId: "course-a", courseTitle: "Test course", windowId: "window-a",
    date: "2026-11-14", status: "present", markedBy: "manager-a", markedAt: now, updatedAt: now
  }));
  await assertFails(updateDoc(doc(manager, "instituteAttendance", "attendance-a"), {
    status: "absent", markedBy: "manager-a", updatedAt: now
  }));
  await assertFails(setDoc(doc(manager, "instituteCompletionApprovals", "customer-a_course-a"), {
    studentUid: "customer-a", courseId: "course-a", certificateRef: "MFF-CERT-001",
    status: "approved", checks: Array.from({ length: 4 }, () => ({ complete: true })),
    approvedBy: "manager-a", approvedAt: now, createdAt: now
  }));
  await env.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), "instituteCompletionApprovals", "customer-a_course-a"), {
      studentUid: "customer-a", courseId: "course-a", certificateRef: "MFF-CERT-001",
      status: "approved", checks: Array.from({ length: 4 }, () => ({ complete: true })),
      approvedBy: "manager-a", approvedAt: now, createdAt: now
    });
  });
  await assertFails(setDoc(doc(manager, "instituteCertificates", "customer-a_course-a"), {
    certificateRef: "MFF-CERT-001", studentUid: "customer-a", studentId: "MFF-STU-001",
    studentName: "Test Learner", courseId: "course-a", courseTitle: "Test course",
    windowId: "window-a", windowTitle: "Test intake", status: "issued",
    issuedAt: now, issuedBy: "manager-a", createdAt: now
  }));
  const withdrawnApplication = await getDoc(doc(superAdmin, "instituteApplications", "application-a"));
  const withdrawnWindow = await getDoc(doc(superAdmin, "trainingWindows", "window-a"));
  if (withdrawnApplication.data().status !== "withdrawn" || withdrawnWindow.data().enrolledCount !== 0) {
    throw new Error("Institute withdrawal did not update application status and intake capacity.");
  }

  // Referral rules compile and preserve owner-only visibility.
  await assertSucceeds(setDoc(doc(customerA, "referralClaims", "referral-a"), {
    customerUid: "customer-a", referrerEmail: "customer-a@example.com",
    referralCode: "MFF-CUSTOMER-A", referredName: "Friend Customer",
    referredEmail: "friend@example.com", referredPhone: "",
    note: "", status: "pending", reviewNote: "",
    createdAt: now, updatedAt: now
  }));
  await assertSucceeds(getDoc(doc(customerA, "referralClaims", "referral-a")));
  await assertFails(getDoc(doc(customerB, "referralClaims", "referral-a")));

  // Product gallery fields are accepted for Super Admin and remain protected from customers.
  await assertSucceeds(setDoc(doc(superAdmin, "products", "gallery-product"), {
    name: "Test bespoke jacket", sku: "TEST-001", category: "Custom clothing",
    description: "Test product for rules verification.", price: 50000, costPrice: 20000,
    currency: "NGN", stock: 2, imageUrl: "https://example.com/front.webp",
    galleryImages: ["https://example.com/back.webp"],
    availableColors: ["Navy", "Black"], fabricOptions: ["Wool"],
    customizationOptions: ["Monogram"], active: true,
    createdAt: now, updatedAt: now, createdBy: "admin-a"
  }));
  await assertSucceeds(getDoc(doc(customerA, "products", "gallery-product")));
  await assertFails(setDoc(doc(customerA, "products", "customer-product"), {
    name: "Customer product", sku: "C-001", category: "Other", description: "",
    price: 1, costPrice: 1, currency: "NGN", stock: 1, imageUrl: "",
    galleryImages: [], availableColors: [], fabricOptions: [],
    customizationOptions: [], active: true, createdAt: now, updatedAt: now,
    createdBy: "customer-a"
  }));

  // Finance may review refunds but cannot create them; unrelated collections remain denied.
  await assertFails(setDoc(doc(finance, "refunds", "finance-created"), {
    paymentId: "payment-a", orderId: "order-a", orderNumber: "MFF-001",
    customerUid: "customer-a", customerEmail: "customer-a@example.com",
    amount: 1000, currency: "NGN", reason: "Finance created a request.",
    status: "requested", reviewNote: "", refundReference: "",
    createdAt: now, updatedAt: now
  }));
  await assertFails(getDoc(doc(customerA, "unlistedPrivateCollection", "record")));
  console.log("Firestore Emulator rules checks passed: owner privacy, refund lifecycle, appointment ownership and slot reservation, referral ownership, fabric visibility, product gallery writes and deny-by-default.");
} finally {
  await env.cleanup();
}
