import { readFileSync } from "node:fs";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc, deleteDoc, Timestamp, writeBatch } from "firebase/firestore";

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
const sales = env.authenticatedContext("sales-a", { email: "sales@example.com" }).firestore();
const institute = env.authenticatedContext("institute-a", { email: "institute@example.com" }).firestore();
const tailorA = env.authenticatedContext("tailor-a", { email: "tailor-a@example.com" }).firestore();
const tailorB = env.authenticatedContext("tailor-b", { email: "tailor-b@example.com" }).firestore();
const superAdmin = env.authenticatedContext("admin-a", { email: "admin@example.com" }).firestore();
const anonymous = env.unauthenticatedContext().firestore();

try {
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    for (const [uid, role] of [
      ["customer-a", "customer"], ["customer-b", "customer"],
      ["finance-a", "finance"], ["manager-a", "manager"], ["sales-a", "sales"],
      ["institute-a", "institute"], ["tailor-a", "tailor"], ["tailor-b", "tailor"], ["admin-a", "superAdmin"]
    ]) await setDoc(doc(db, "roles", uid), { role });
    await setDoc(doc(db, "users", "customer-a"), {
      uid: "customer-a", displayName: "Test Customer A", email: "customer-a@example.com", accountType: "customer"
    });
    await setDoc(doc(db, "users", "customer-b"), {
      uid: "customer-b", displayName: "Test Customer B", email: "customer-b@example.com", accountType: "customer"
    });
    await setDoc(doc(db, "notifications", "admin-delete-test"), { customerUid: "customer-a", title: "Admin deletion test", createdAt: now });
    await setDoc(doc(db, "orders", "order-a"), {
      customerUid: "customer-a", customerName: "Test Customer A", customerEmail: "customer-a@example.com",
      orderNumber: "MFF-SEC-001", item: "Test garment", quantity: 1, status: "received",
      paymentStatus: "unquoted", assignedDesignerUid: "tailor-a", createdAt: now, updatedAt: now
    });
    await setDoc(doc(db, "products", "stock-product"), {
      name: "Test stock item", sku: "TST-001", category: "Test", description: "",
      price: 100, costPrice: 50, currency: "NGN", stock: 2, imageUrl: "",
      galleryImages: [], availableColors: [], fabricOptions: [], customizationOptions: [],
      active: true, createdAt: now, updatedAt: now, createdBy: "admin-a"
    });
    // Product creation and positive opening stock must be recorded atomically in the immutable ledger.
    const openingStockBatch = writeBatch(superAdmin);
    openingStockBatch.set(doc(superAdmin, "products", "opening-stock-product"), {
      name: "Opening stock test item", sku: "OPEN-001", category: "Test", description: "",
      price: 100, costPrice: 50, currency: "NGN", stock: 5, imageUrl: "",
      galleryImages: [], availableColors: [], fabricOptions: [], customizationOptions: [],
      active: true, createdAt: now, updatedAt: now, createdBy: "admin-a"
    });
    openingStockBatch.set(doc(superAdmin, "inventoryMovements", "opening-stock-movement"), {
      productId: "opening-stock-product", productName: "Opening stock test item", sku: "OPEN-001",
      type: "in", quantity: 5, previousStock: 0, newStock: 5,
      createdAt: now, createdBy: "admin-a", reason: "opening_stock"
    });
    await assertSucceeds(openingStockBatch.commit());

    const invalidOpeningMovementBatch = writeBatch(superAdmin);
    invalidOpeningMovementBatch.set(doc(superAdmin, "inventoryMovements", "opening-stock-mismatch"), {
      productId: "opening-stock-product", productName: "Opening stock test item", sku: "OPEN-001",
      type: "in", quantity: 4, previousStock: 0, newStock: 4,
      createdAt: now, createdBy: "admin-a", reason: "opening_stock"
    });
    await assertFails(invalidOpeningMovementBatch.commit());

    await setDoc(doc(db, "products", "sale-product"), {
      name: "Test POS item", sku: "POS-001", category: "Test", description: "",
      price: 100, costPrice: 50, currency: "NGN", stock: 1, imageUrl: "",
      galleryImages: [], availableColors: [], fabricOptions: [], customizationOptions: [],
      active: true, createdAt: now, updatedAt: now, createdBy: "admin-a"
    });
    await setDoc(doc(db, "payments", "payment-a"), {
      customerUid: "customer-a", amount: 10000, orderId: "order-a",
      orderNumber: "MFF-001", currency: "NGN", createdAt: now
    });
    await setDoc(doc(db, "instituteCourses", "course-a"), { title: "Test course", active: true });
    await setDoc(doc(db, "trainingWindows", "window-a"), {
      courseId: "course-a", status: "open", capacity: 5, enrolledCount: 1
    });
    // A customer may reserve one institute place only through the atomic window-counter + application batch.
    await setDoc(doc(superAdmin, "trainingWindows", "capacity-window"), {
      courseId: "course-a", status: "open", capacity: 2, enrolledCount: 1
    });
    const applicationBatch = writeBatch(customerB);
    applicationBatch.update(doc(customerB, "trainingWindows", "capacity-window"), {
      enrolledCount: 2, lastApplicationId: "capacity-application-b", updatedAt: now
    });
    applicationBatch.set(doc(customerB, "instituteApplications", "capacity-application-b"), {
      applicationRef: "MFF-CAP-002", customerUid: "customer-b", fullName: "Capacity Test",
      email: "customer-b@example.com", phone: "08000000000", address: "Test address",
      courseId: "course-a", courseTitle: "Test course", windowId: "capacity-window",
      windowTitle: "Capacity test", mode: "Onsite", experience: "", note: "",
      status: "pending", paymentStatus: "not_due", createdAt: now, updatedAt: now
    });
    await assertSucceeds(applicationBatch.commit());

    const overCapacityBatch = writeBatch(customerA);
    overCapacityBatch.update(doc(customerA, "trainingWindows", "capacity-window"), {
      enrolledCount: 3, lastApplicationId: "capacity-application-a", updatedAt: now
    });
    overCapacityBatch.set(doc(customerA, "instituteApplications", "capacity-application-a"), {
      applicationRef: "MFF-CAP-003", customerUid: "customer-a", fullName: "Over Capacity",
      email: "customer-a@example.com", phone: "08000000001", address: "Test address",
      courseId: "course-a", courseTitle: "Test course", windowId: "capacity-window",
      windowTitle: "Capacity test", mode: "Onsite", experience: "", note: "",
      status: "pending", paymentStatus: "not_due", createdAt: now, updatedAt: now
    });
    await assertFails(overCapacityBatch.commit());

    const applicationWithoutReservation = writeBatch(customerA);
    applicationWithoutReservation.set(doc(customerA, "instituteApplications", "application-without-place"), {
      applicationRef: "MFF-CAP-004", customerUid: "customer-a", fullName: "Unreserved",
      email: "customer-a@example.com", phone: "08000000002", address: "Test address",
      courseId: "course-a", courseTitle: "Test course", windowId: "capacity-window",
      windowTitle: "Capacity test", mode: "Onsite", experience: "", note: "",
      status: "pending", paymentStatus: "not_due", createdAt: now, updatedAt: now
    });
    await assertFails(applicationWithoutReservation.commit());

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
    await setDoc(doc(db, "appointments", "appointment-duplicate-slot"), {
      customerUid: "customer-a", customerName: "Test Customer",
      customerEmail: "customer-a@example.com", service: "Measurement",
      appointmentDate: "2026-11-18", appointmentTime: "08:00",
      proposedDate: "2026-11-22", proposedTime: "14:00",
      purpose: "Duplicate slot test", status: "alternative_proposed",
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

  // Customer ownership, staff assignment and role documents must be enforced by Firestore.
  // Super Admin may manage business records but cannot remove identity controls or immutable ledgers.
  await assertSucceeds(getDoc(doc(superAdmin, "notifications", "admin-delete-test")));
  await assertFails(deleteDoc(doc(customerA, "notifications", "admin-delete-test")));
  await assertSucceeds(deleteDoc(doc(superAdmin, "notifications", "admin-delete-test")));
  await assertFails(deleteDoc(doc(superAdmin, "roles", "admin-a")));
  await assertFails(deleteDoc(doc(superAdmin, "users", "admin-a")));
  await assertFails(deleteDoc(doc(superAdmin, "auditLogs", "admin-audit-protected")));
  await assertFails(deleteDoc(doc(superAdmin, "publicSettings", "driveIntegration")));

  await assertSucceeds(getDoc(doc(customerA, "users", "customer-a")));
  await assertFails(getDoc(doc(customerB, "users", "customer-a")));
  await assertFails(getDoc(doc(customerA, "roles", "customer-b")));
  await assertFails(updateDoc(doc(customerA, "roles", "customer-a"), { role: "superAdmin" }));
  await assertFails(setDoc(doc(customerA, "roles", "customer-a"), { role: "superAdmin" }));
  await assertSucceeds(getDoc(doc(customerA, "orders", "order-a")));
  await assertFails(getDoc(doc(customerB, "orders", "order-a")));
  await assertSucceeds(getDoc(doc(finance, "orders", "order-a")));
  await assertSucceeds(getDoc(doc(tailorA, "orders", "order-a")));
  await assertFails(getDoc(doc(tailorB, "orders", "order-a")));
  await assertSucceeds(getDoc(doc(customerA, "payments", "payment-a")));
  await assertFails(getDoc(doc(customerB, "payments", "payment-a")));
  await assertSucceeds(getDoc(doc(finance, "payments", "payment-a")));

  // Inventory stock floors, movement integrity, POS sales and expense permissions.
  await assertSucceeds(updateDoc(doc(superAdmin, "products", "stock-product"), { stock: 1, updatedAt: now }));
  await assertFails(updateDoc(doc(superAdmin, "products", "stock-product"), { stock: -1, updatedAt: now }));
  await assertFails(updateDoc(doc(customerA, "products", "stock-product"), { stock: 1, updatedAt: now }));

  const validMovementBatch = writeBatch(superAdmin);
  validMovementBatch.update(doc(superAdmin, "products", "stock-product"), { stock: 0, updatedAt: now });
  validMovementBatch.set(doc(superAdmin, "inventoryMovements", "movement-valid"), {
    productId: "stock-product", productName: "Test stock item", sku: "TST-001",
    type: "out", quantity: 1, previousStock: 1, newStock: 0,
    createdAt: now, createdBy: "admin-a", reason: "test"
  });
  await assertSucceeds(validMovementBatch.commit());

  const negativeMovementBatch = writeBatch(superAdmin);
  negativeMovementBatch.update(doc(superAdmin, "products", "stock-product"), { stock: -1, updatedAt: now });
  negativeMovementBatch.set(doc(superAdmin, "inventoryMovements", "movement-negative"), {
    productId: "stock-product", productName: "Test stock item", sku: "TST-001",
    type: "out", quantity: 1, previousStock: 0, newStock: -1,
    createdAt: now, createdBy: "admin-a"
  });
  await assertFails(negativeMovementBatch.commit());

  const mismatchedMovementBatch = writeBatch(superAdmin);
  mismatchedMovementBatch.set(doc(superAdmin, "inventoryMovements", "movement-mismatch"), {
    productId: "stock-product", productName: "Test stock item", sku: "TST-001",
    type: "in", quantity: 1, previousStock: 1, newStock: 2,
    createdAt: now, createdBy: "admin-a"
  });
  await assertFails(mismatchedMovementBatch.commit());

  const customerMovementBatch = writeBatch(customerA);
  customerMovementBatch.update(doc(customerA, "products", "stock-product"), { stock: 1, updatedAt: now });
  customerMovementBatch.set(doc(customerA, "inventoryMovements", "movement-customer"), {
    productId: "stock-product", productName: "Test stock item", sku: "TST-001",
    type: "in", quantity: 1, previousStock: 0, newStock: 1,
    createdAt: now, createdBy: "customer-a"
  });
  await assertFails(customerMovementBatch.commit());

  await assertSucceeds(getDoc(doc(manager, "inventoryMovements", "movement-valid")));
  await assertFails(getDoc(doc(customerA, "inventoryMovements", "movement-valid")));
  await assertFails(updateDoc(doc(superAdmin, "inventoryMovements", "movement-valid"), { reason: "attempted ledger edit" }));
  await assertFails(deleteDoc(doc(superAdmin, "inventoryMovements", "movement-valid")));

  const posBatch = writeBatch(superAdmin);
  posBatch.update(doc(superAdmin, "products", "sale-product"), { stock: 0, updatedAt: now });
  posBatch.set(doc(superAdmin, "inventoryMovements", "pos-movement"), {
    productId: "sale-product", productName: "Test POS item", sku: "POS-001",
    type: "out", quantity: 1, previousStock: 1, newStock: 0,
    createdAt: now, createdBy: "admin-a", reason: "sale", receiptNumber: "MFS-TEST-001"
  });
  posBatch.set(doc(superAdmin, "sales", "sale-valid"), {
    receiptNumber: "MFS-TEST-001", customerName: "Walk-in customer",
    items: [{ productId: "sale-product", quantity: 1, unitPrice: 100 }],
    subtotal: 100, total: 100, totalCost: 50, grossProfit: 50,
    amountPaid: 100, balance: 0, paymentStatus: "paid",
    paymentMethod: "Cash", currency: "NGN", createdAt: now, createdBy: "admin-a"
  });
  await assertSucceeds(posBatch.commit());
  await assertFails(setDoc(doc(finance, "sales", "sale-finance"), {
    receiptNumber: "MFS-FINANCE-001", customerName: "Walk-in customer", items: [],
    subtotal: 100, total: 100, totalCost: 50, grossProfit: 50,
    amountPaid: 100, balance: 0, paymentStatus: "paid",
    paymentMethod: "Cash", currency: "NGN", createdAt: now, createdBy: "finance-a"
  }));
  await assertSucceeds(getDoc(doc(finance, "sales", "sale-valid")));
  await assertFails(getDoc(doc(customerA, "sales", "sale-valid")));
  await assertSucceeds(setDoc(doc(finance, "expenses", "expense-valid"), {
    title: "Test studio expense", category: "Supplies", amount: 250,
    currency: "NGN", expenseDate: "2026-11-15", method: "Cash",
    note: "Emulator test", createdAt: now, createdBy: "finance-a"
  }));
  await assertFails(setDoc(doc(customerA, "expenses", "expense-customer"), {
    title: "Unauthorised expense", category: "Supplies", amount: 250,
    currency: "NGN", expenseDate: "2026-11-15", method: "Cash",
    note: "", createdAt: now, createdBy: "customer-a"
  }));
  await assertSucceeds(getDoc(doc(manager, "expenses", "expense-valid")));
  await assertFails(getDoc(doc(customerA, "expenses", "expense-valid")));

  // Company bank transfer instructions are private to signed-in customers
  // and cannot publish an account number without a verified registered name.
  await assertSucceeds(setDoc(doc(superAdmin, "publicSettings", "paymentInstructions"), {
    accounts: [
      { bankName: "Loma Bank", accountName: "MR FOP FASHIONS COMPANY NIGERIA LIMITED", accountNumber: "0061030714" },
      { bankName: "FCMB", accountName: "MR FOP FASHIONS COMPANY NIGERIA LIMITED", accountNumber: "2209515029" }
    ],
    instructions: "Use your order number as the transfer reference.",
    updatedAt: now, updatedBy: "admin-a"
  }));
  await assertSucceeds(getDoc(doc(customerA, "publicSettings", "paymentInstructions")));
  await assertFails(setDoc(doc(superAdmin, "publicSettings", "paymentInstructions"), {
    accounts: [{ bankName: "Loma Bank", accountName: "", accountNumber: "0061030714" }],
    instructions: "", updatedAt: now, updatedBy: "admin-a"
  }));
  await assertFails(getDoc(doc(anonymous, "publicSettings", "paymentInstructions")));
  await assertFails(setDoc(doc(customerA, "publicSettings", "paymentInstructions"), {
    accounts: [{ bankName: "Loma Bank", accountName: "MR FOP FASHIONS", accountNumber: "0061030714" }],
    instructions: "", updatedAt: now, updatedBy: "customer-a"
  }));
  await assertFails(setDoc(doc(superAdmin, "publicSettings", "paymentInstructions"), {
    accounts: [{ bankName: "Loma Bank", accountName: "MR FOP FASHIONS", accountNumber: "12345" }],
    instructions: "", updatedAt: now, updatedBy: "admin-a"
  }));
  await assertFails(setDoc(doc(superAdmin, "publicSettings", "paymentInstructions"), {
    accounts: [{ bankName: "", accountName: "MR FOP FASHIONS", accountNumber: "0061030714" }],
    instructions: "", updatedAt: now, updatedBy: "admin-a"
  }));

  // Google Drive identifiers are readable to authenticated users for runtime
  // OAuth initialisation, but only Super Admin may configure them.
  await assertSucceeds(setDoc(doc(superAdmin, "publicSettings", "driveIntegration"), {
    clientId: "123456789012-test.apps.googleusercontent.com",
    folderId: "AbCdEfGhIjKlMnOpQrStUv", updatedAt: now, updatedBy: "admin-a"
  }));
  await assertSucceeds(getDoc(doc(customerA, "publicSettings", "driveIntegration")));
  await assertFails(getDoc(doc(anonymous, "publicSettings", "driveIntegration")));
  await assertFails(setDoc(doc(customerA, "publicSettings", "driveIntegration"), {
    clientId: "123456789012-test.apps.googleusercontent.com",
    folderId: "AbCdEfGhIjKlMnOpQrStUv", updatedAt: now, updatedBy: "customer-a"
  }));

  // Newsletter: public users may submit consent-backed sign-ups, but subscriber
  // records are private and only Super Admin can read them.
  await assertSucceeds(setDoc(doc(anonymous, "newsletterSubscribers", "newsletter-valid"), {
    email: "reader@example.com", consent: true, status: "subscribed",
    source: "public_website", createdAt: now
  }));
  await assertFails(setDoc(doc(anonymous, "newsletterSubscribers", "newsletter-valid"), {
    email: "reader@example.com", consent: true, status: "subscribed",
    source: "public_website", createdAt: now
  }));
  await assertFails(setDoc(doc(anonymous, "newsletterSubscribers", "newsletter-no-consent"), {
    email: "reader2@example.com", consent: false, status: "subscribed",
    source: "public_website", createdAt: now
  }));
  await assertFails(setDoc(doc(anonymous, "newsletterSubscribers", "newsletter-invalid-email"), {
    email: "not-an-email", consent: true, status: "subscribed",
    source: "public_website", createdAt: now
  }));
  await assertFails(getDoc(doc(customerA, "newsletterSubscribers", "newsletter-valid")));
  await assertFails(getDoc(doc(anonymous, "newsletterSubscribers", "newsletter-valid")));
  await assertSucceeds(getDoc(doc(superAdmin, "newsletterSubscribers", "newsletter-valid")));
  await assertSucceeds(updateDoc(doc(superAdmin, "newsletterSubscribers", "newsletter-valid"), {
    status: "unsubscribed", updatedAt: now
  }));
  await assertFails(updateDoc(doc(customerA, "newsletterSubscribers", "newsletter-valid"), {
    status: "subscribed", updatedAt: now
  }));

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
  await assertFails(setDoc(doc(customerA, "appointments", "appointment-invalid-time"), {
    customerUid: "customer-a", customerName: "Test Customer",
    customerEmail: "customer-a@example.com", service: "Measurement",
    appointmentDate: "2026-11-21", appointmentTime: "25:99",
    purpose: "Invalid time format", status: "pending",
    createdAt: now, updatedAt: now
  }));
  await assertFails(setDoc(doc(customerA, "appointments", "appointment-invalid-service"), {
    customerUid: "customer-a", customerName: "Test Customer",
    customerEmail: "customer-a@example.com", service: "Unlisted service",
    appointmentDate: "2026-11-21", appointmentTime: "11:00",
    purpose: "Invalid service", status: "pending",
    createdAt: now, updatedAt: now
  }));
  await assertFails(setDoc(doc(customerA, "appointments", "appointment-spoofed-email"), {
    customerUid: "customer-a", customerName: "Test Customer",
    customerEmail: "someone-else@example.com", service: "Measurement",
    appointmentDate: "2026-11-21", appointmentTime: "11:00",
    purpose: "Spoofed email", status: "pending",
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
  const duplicateSlotAttempt = writeBatch(customerA);
  duplicateSlotAttempt.update(doc(customerA, "appointments", "appointment-duplicate-slot"), {
    status: "confirmed", appointmentDate: "2026-11-22",
    appointmentTime: "14:00", updatedAt: now
  });
  duplicateSlotAttempt.set(doc(customerA, "appointmentSlots", "2026-11-22_14:00"), {
    appointmentId: "appointment-duplicate-slot", customerUid: "customer-a",
    appointmentDate: "2026-11-22", appointmentTime: "14:00", updatedAt: now
  });
  await assertFails(duplicateSlotAttempt.commit());

  // Public fabric visibility: active records are public; archived records remain private.
  await assertSucceeds(getDoc(doc(anonymous, "fabrics", "active-fabric")));
  await assertFails(getDoc(doc(anonymous, "fabrics", "archived-fabric")));
  await assertSucceeds(getDoc(doc(superAdmin, "fabrics", "archived-fabric")));
  await assertFails(setDoc(doc(customerA, "fabrics", "customer-fabric"), {
    name: "Invalid", color: "Red", texture: "Soft", priceRange: "",
    availability: "available", suitableCategories: [], imageUrl: "",
    active: true, createdAt: now, createdBy: "customer-a", updatedAt: now
  }));

  // Institute scheduling locks are readable and writable only by authorised Institute staff.
  await assertSucceeds(setDoc(doc(manager, "instituteSessionSlots", "instructor_test_123"), {
    sessionId: "session-test", resourceToken: "instructor_test", bucket: 123,
    createdAt: now
  }));
  await assertFails(getDoc(doc(customerA, "instituteSessionSlots", "instructor_test_123")));
  await assertFails(setDoc(doc(customerA, "instituteSessionSlots", "instructor_customer_123"), {
    sessionId: "session-customer", resourceToken: "instructor_customer", bucket: 123,
    createdAt: now
  }));
  await assertFails(deleteDoc(doc(customerA, "instituteSessionSlots", "instructor_test_123")));
  await assertSucceeds(deleteDoc(doc(manager, "instituteSessionSlots", "instructor_test_123")));

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

  // Support conversation messages are private to the ticket owner and authorised staff, and append-only.
  await assertSucceeds(setDoc(doc(customerA, "supportTickets", "support-thread-a"), {
    customerUid: "customer-a", customerName: "Test Customer A", customerEmail: "customer-a@example.com",
    category: "Order enquiry", subject: "Test support conversation",
    message: "Please help me with my order.", status: "open", staffReply: "",
    createdAt: now, updatedAt: now
  }));
  await assertSucceeds(setDoc(doc(customerA, "supportTickets", "support-thread-a", "messages", "customer-message"), {
    senderUid: "customer-a", senderRole: "customer", senderName: "Test Customer A",
    body: "I would like an update, please.", createdAt: now
  }));
  await assertSucceeds(getDoc(doc(customerA, "supportTickets", "support-thread-a", "messages", "customer-message")));
  await assertFails(getDoc(doc(customerB, "supportTickets", "support-thread-a", "messages", "customer-message")));
  await assertSucceeds(setDoc(doc(manager, "supportTickets", "support-thread-a", "messages", "staff-message"), {
    senderUid: "manager-a", senderRole: "staff", senderName: "MR FOP team",
    body: "Thank you. We are reviewing your request.", createdAt: now
  }));

  // Every designated staff role may support customers; Finance and anonymous sessions are excluded.
  for (const [staffDb, uid, label] of [
    [sales, "sales-a", "Sales team"],
    [tailorA, "tailor-a", "Tailor team"],
    [institute, "institute-a", "Institute team"]
  ]) {
    await assertSucceeds(getDoc(doc(staffDb, "supportTickets", "support-thread-a", "messages", "customer-message")));
    await assertSucceeds(setDoc(doc(staffDb, "supportTickets", "support-thread-a", "messages", `staff-${uid}`), {
      senderUid: uid, senderRole: "staff", senderName: label,
      body: "This authorised staff role can respond to a support ticket.", createdAt: now
    }));
  }
  await assertFails(getDoc(doc(finance, "supportTickets", "support-thread-a", "messages", "customer-message")));
  await assertFails(getDoc(doc(anonymous, "supportTickets", "support-thread-a", "messages", "customer-message")));
  await assertFails(setDoc(doc(finance, "supportTickets", "support-thread-a", "messages", "finance-message"), {
    senderUid: "finance-a", senderRole: "staff", senderName: "Finance",
    body: "Finance is not included in the support staff role set.", createdAt: now
  }));

  await assertSucceeds(getDoc(doc(manager, "supportTickets", "support-thread-a", "messages", "customer-message")));
  await assertFails(setDoc(doc(customerA, "supportTickets", "support-thread-a", "messages", "spoofed-sender"), {
    senderUid: "customer-b", senderRole: "customer", senderName: "Spoofed sender",
    body: "Sender identity must match the signed-in user.", createdAt: now
  }));
  await assertFails(setDoc(doc(customerA, "supportTickets", "support-thread-a", "messages", "customer-claims-staff"), {
    senderUid: "customer-a", senderRole: "staff", senderName: "Pretending to be staff",
    body: "Customers cannot send staff-labelled messages.", createdAt: now
  }));
  await assertFails(setDoc(doc(manager, "supportTickets", "support-thread-a", "messages", "staff-claims-customer"), {
    senderUid: "manager-a", senderRole: "customer", senderName: "Pretending to be customer",
    body: "Staff cannot send customer-labelled messages.", createdAt: now
  }));
  await assertFails(setDoc(doc(customerA, "supportTickets", "support-thread-a", "messages", "oversized-message"), {
    senderUid: "customer-a", senderRole: "customer", senderName: "Test Customer A",
    body: "x".repeat(2001), createdAt: now
  }));
  await assertFails(setDoc(doc(manager, "supportTickets", "support-thread-a", "messages", "extra-field"), {
    senderUid: "manager-a", senderRole: "staff", senderName: "MR FOP team",
    body: "Unexpected fields must be rejected.", createdAt: now, isAdmin: true
  }));
  await assertFails(setDoc(doc(customerB, "supportTickets", "support-thread-a", "messages", "intruder-message"), {
    senderUid: "customer-b", senderRole: "customer", senderName: "Other customer",
    body: "This must not be allowed.", createdAt: now
  }));
  await assertFails(updateDoc(doc(customerA, "supportTickets", "support-thread-a", "messages", "customer-message"), { body: "Changed history" }));
  await assertFails(deleteDoc(doc(manager, "supportTickets", "support-thread-a", "messages", "customer-message")));

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
  console.log("Firestore Emulator rules checks passed: cross-customer profile/order/payment privacy, self-role escalation denial, assigned-tailor isolation, non-negative inventory stock, movement-to-stock consistency, immutable inventory ledger and atomic POS sale/stock/movement writes, POS/expense role permissions, refund lifecycle, appointment ownership and slot reservation, Institute schedule lock privacy and withdrawal, newsletter consent and subscriber privacy, private append-only support conversations, Drive configuration, referral ownership, fabric visibility, product gallery writes and deny-by-default.");
} finally {
  await env.cleanup();
}
