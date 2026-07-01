// ─────────────────────────────────────────────────────────────────────────────
// Seed: Academic Year-wise Marks + Fee Payments
//
// Adds:
//   • `exams` documents tagged with `academicYear` (e.g., "2024-25")
//     one record per student × subject × academic year
//   • `feePayments/{uid}/semesters/sem{n}` documents so the Office Dashboard
//     can display real payment data
//   • Flat `feePayments/{uid}_sem{n}` docs for backward-compat aggregation
//
// SETUP:
//   Ensure serviceAccountKey.json is in the project root, then run:
//     node seed_academic_marks.mjs
// ─────────────────────────────────────────────────────────────────────────────

import admin from "firebase-admin";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let serviceAccount;
try {
  serviceAccount = JSON.parse(readFileSync(path.join(__dirname, "serviceAccountKey.json"), "utf8"));
} catch {
  console.error("❌ serviceAccountKey.json not found!");
  console.error("   Go to Firebase Console → Project Settings → Service Accounts → Generate new private key");
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id,
});

const db = admin.firestore();

// ─── CONSTANTS ───────────────────────────────────────────────────────────────
const DEPT_SUBJECTS = {
  ECE:  ["Electronics Circuits", "Digital Electronics", "Signals & Systems", "Microprocessors", "Communication Systems"],
  IT:   ["Web Technologies", "Database Systems", "Operating Systems", "Computer Networks", "Software Engineering"],
  MECH: ["Engineering Mechanics", "Thermodynamics", "Fluid Mechanics", "Manufacturing Technology", "Machine Design"],
  EEE:  ["Circuit Theory", "Power Systems", "Control Systems", "Electrical Machines", "Power Electronics"],
  CSE:  ["Data Structures", "Algorithms", "DBMS", "Operating Systems", "Computer Networks"],
  AIDS: ["Machine Learning", "Data Mining", "Statistical Methods", "Big Data Analytics", "Neural Networks"],
};

// Academic years to seed marks for
const ACADEMIC_YEARS = ["2023-24", "2024-25", "2025-26"];

// Fee structure: 2 semesters per year, amounts vary by year
const FEE_BY_YEAR = {
  1: { sem1: 45000, sem2: 45000 },
  2: { sem3: 50000, sem4: 50000 },
  3: { sem5: 55000, sem6: 55000 },
  4: { sem7: 60000, sem8: 60000 },
};

// Payment methods
const PAYMENT_METHODS = ["Cash", "Online Transfer", "UPI", "Cheque/DD", "Card"];

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const rInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const rBool = (p = 0.75) => Math.random() < p;

function computeGrade(total) {
  if (total >= 90) return "O";
  if (total >= 80) return "A+";
  if (total >= 70) return "A";
  if (total >= 60) return "B+";
  if (total >= 50) return "B";
  if (total >= 45) return "C";
  return "F";
}

function slugify(str) {
  return str.replace(/[\s&]+/g, "_").toLowerCase();
}

function randomPastDate(daysAgoMin = 10, daysAgoMax = 180) {
  const d = new Date();
  d.setDate(d.getDate() - rInt(daysAgoMin, daysAgoMax));
  return d.toISOString().split("T")[0];
}

async function commitBatch(batch) {
  await batch.commit();
  return db.batch();
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function seedAcademicData() {
  console.log("\n🌱 Starting Academic Year-wise Marks + Fee Payment seeding...\n");

  // ── 1. Fetch all students ──────────────────────────────────────────────────
  console.log("👩‍🎓 Fetching all students from Firestore...");
  const studSnap = await db.collection("users").where("role", "==", "student").get();
  const students = studSnap.docs.map(d => ({ uid: d.id, ...d.data() }));
  console.log(`   Found ${students.length} students.\n`);

  if (students.length === 0) {
    console.warn("⚠ No students found. Run seed.mjs first to create students.");
    process.exit(0);
  }

  // ── 2. Seed Academic Year-wise Marks ──────────────────────────────────────
  console.log(`📊 Seeding academic year-wise marks (${students.length} students × ${ACADEMIC_YEARS.length} years × ~5 subjects)...`);
  let markBatch = db.batch();
  let batchOps = 0;
  let markTotal = 0;

  for (const student of students) {
    const subjects = DEPT_SUBJECTS[student.dept] || DEPT_SUBJECTS["CSE"];

    for (const academicYear of ACADEMIC_YEARS) {
      for (const subject of subjects) {
        const int1       = rInt(13, 30);
        const int2       = rInt(13, 30);
        const assignment = rInt(5, 10);
        const external   = rInt(35, 75);
        const total      = int1 + int2 + assignment + external;
        const grade      = computeGrade(total);

        // ID includes academicYear to allow parallel years
        const markId = `${student.uid}_${slugify(subject)}_${academicYear.replace("-", "_")}`;

        markBatch.set(db.collection("exams").doc(markId), {
          studentId:    student.uid,
          studentName:  student.name || "",
          rollNo:       student.rollNo || "",
          dept:         student.dept || "",
          year:         student.year || 1,
          section:      student.section || "A",
          admissionYear: student.admissionYear || 24,
          subject,
          academicYear,     // ← NEW: "2024-25" style
          internal1:    int1,
          internal2:    int2,
          assignment,
          external,
          total,
          grade,
          createdAt:    new Date().toISOString(),
          seeded:       true,
        });

        batchOps++;
        markTotal++;

        if (batchOps >= 490) {
          markBatch = await commitBatch(markBatch);
          batchOps = 0;
          process.stdout.write(`  ✓ ${markTotal} marks written\r`);
        }
      }
    }
  }
  if (batchOps > 0) await markBatch.commit();
  console.log(`\n✅ ${markTotal} academic year-wise mark records done.\n`);

  // ── 3. Seed Fee Payments ───────────────────────────────────────────────────
  console.log("💳 Seeding fee payment records per student...");
  let payBatch = db.batch();
  batchOps = 0;
  let payTotal = 0;

  for (const student of students) {
    const year = student.year || 1;
    const feeMap = FEE_BY_YEAR[year] || FEE_BY_YEAR[1];
    const semEntries = Object.entries(feeMap); // e.g. [["sem1", 45000], ["sem2", 45000]]

    for (const [semKey, feeAmount] of semEntries) {
      const semNum = parseInt(semKey.replace("sem", ""));
      const isPaid = rBool(0.72); // 72% of students have paid

      const paymentData = {
        studentUid:  student.uid,
        studentName: student.name || "",
        rollNo:      student.rollNo || "",
        dept:        student.dept || "",
        year:        parseInt(year),
        section:     student.section || "A",
        admissionYear: student.admissionYear || 24,
        semester:    semNum,
        amount:      feeAmount,
        status:      isPaid ? "paid" : "pending",
        paidOn:      isPaid ? randomPastDate(5, 150) : null,
        method:      isPaid ? pick(PAYMENT_METHODS) : null,
        receiptNo:   isPaid ? `RCP-${new Date().getFullYear()}-${rInt(1000, 9999)}` : null,
        academicYear: "2024-25",
        recordedAt:  new Date().toISOString(),
        seeded:      true,
      };

      // Sub-collection: feePayments/{uid}/semesters/sem{n}
      payBatch.set(
        db.collection("feePayments").doc(student.uid).collection("semesters").doc(semKey),
        paymentData
      );
      batchOps++;

      // Flat doc: feePayments/{uid}_sem{n} (for dashboard aggregation backward compat)
      payBatch.set(
        db.collection("feePayments").doc(`${student.uid}_${semKey}`),
        paymentData
      );
      batchOps++;
      payTotal++;

      if (batchOps >= 490) {
        payBatch = await commitBatch(payBatch);
        batchOps = 0;
        process.stdout.write(`  ✓ ${payTotal} fee payment records written\r`);
      }
    }
  }
  if (batchOps > 0) await payBatch.commit();
  console.log(`\n✅ ${payTotal} fee payment records done.\n`);

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log("═══════════════════════════════════════════════════");
  console.log("🎉  ACADEMIC SEEDING COMPLETE!");
  console.log("═══════════════════════════════════════════════════");
  console.log(`  📊 Marks (all years): ${markTotal} records`);
  console.log(`     Academic Years:    ${ACADEMIC_YEARS.join(", ")}`);
  console.log(`  💳 Fee Payments:      ${payTotal} records`);
  console.log(`     (sub-collection + flat docs, ~72% paid)`);
  console.log("═══════════════════════════════════════════════════");
  console.log("\nℹ️  You can now:");
  console.log("   • Filter marks by academicYear in Gradebook/Exams pages");
  console.log("   • View payment data in Office Dashboard immediately");
  process.exit(0);
}

seedAcademicData().catch(err => {
  console.error("\n❌ Seeding failed:", err.message || err);
  process.exit(1);
});
