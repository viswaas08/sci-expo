// ─────────────────────────────────────────────────────────────────────────────
// Seed Script Phase 2: Attendance + Marks ONLY
// Run AFTER seed.mjs succeeds with teachers and students.
// This script only seeds attendance and marks for existing students.
// Run: node seed_phase2.mjs
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
  console.error("❌ serviceAccountKey.json not found!"); process.exit(1);
}

admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId: "class-de301" });
const db = admin.firestore();

const DEPT_SUBJECTS = {
  ECE:  ["Electronics Circuits", "Digital Electronics", "Signals & Systems", "Microprocessors", "Communication Systems"],
  IT:   ["Web Technologies", "Database Systems", "Operating Systems", "Computer Networks", "Software Engineering"],
  MECH: ["Engineering Mechanics", "Thermodynamics", "Fluid Mechanics", "Manufacturing Technology", "Machine Design"],
  EEE:  ["Circuit Theory", "Power Systems", "Control Systems", "Electrical Machines", "Power Electronics"],
  CSE:  ["Data Structures", "Algorithms", "DBMS", "Operating Systems", "Computer Networks"],
  AIDS: ["Machine Learning", "Data Mining", "Statistical Methods", "Big Data Analytics", "Neural Networks"],
};

const rInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const rBool = (p = 0.82) => Math.random() < p;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function getDateStr(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const day = d.getDay();
  if (day === 0) d.setDate(d.getDate() - 1);
  if (day === 6) d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0];
}

async function writeBatchWithRetry(writes, label) {
  // writes is an array of {ref, data}
  const CHUNK = 400; // stay well under Firestore 500 limit
  const DELAY = 500; // ms between batches

  for (let i = 0; i < writes.length; i += CHUNK) {
    const chunk = writes.slice(i, i + CHUNK);
    let retries = 3;
    while (retries > 0) {
      try {
        const batch = db.batch();
        for (const { ref, data } of chunk) batch.set(ref, data);
        await batch.commit();
        process.stdout.write(`  ✓ ${label}: ${Math.min(i + CHUNK, writes.length)}/${writes.length} written\r`);
        await sleep(DELAY);
        break;
      } catch (err) {
        retries--;
        if (retries === 0) throw err;
        console.log(`\n  ⚠ Batch failed, retrying (${retries} left)...`);
        await sleep(2000);
      }
    }
  }
}

async function main() {
  console.log("\n🌱 Phase 2: Seeding Attendance + Marks for all existing students...\n");

  // Load all students from Firestore
  console.log("📥 Loading students from Firestore...");
  const snap = await db.collection("users").where("role", "==", "student").get();
  const students = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  console.log(`✅ Found ${students.length} students.\n`);

  if (students.length === 0) {
    console.error("❌ No students found! Run seed.mjs first."); process.exit(1);
  }

  // ── ATTENDANCE ─────────────────────────────────────────────────────────────
  console.log(`📋 Seeding attendance (${students.length} students × 60 days)...`);
  const attWrites = [];

  for (const student of students) {
    for (let day = 1; day <= 60; day++) {
      const dateStr = getDateStr(day);
      attWrites.push({
        ref: db.collection("attendance").doc(`${student.id}_${dateStr}`),
        data: {
          studentId: student.id,
          studentName: student.name,
          rollNo: student.rollNo,
          dept: student.dept,
          year: student.year,
          section: student.section,
          date: dateStr,
          status: rBool(0.82) ? "present" : "absent",
          createdAt: new Date().toISOString(),
        }
      });
    }
  }

  await writeBatchWithRetry(attWrites, "attendance");
  console.log(`\n✅ ${attWrites.length} attendance records seeded.\n`);

  // ── MARKS ──────────────────────────────────────────────────────────────────
  console.log(`📊 Seeding marks (${students.length} students × 5 subjects)...`);
  const markWrites = [];

  for (const student of students) {
    const subjects = DEPT_SUBJECTS[student.dept] || DEPT_SUBJECTS["ECE"];
    for (const subject of subjects) {
      const int1 = rInt(13, 30);
      const int2 = rInt(13, 30);
      const assignment = rInt(5, 10);
      const external = rInt(35, 75);
      const total = int1 + int2 + assignment + external;

      let grade = "F";
      if (total >= 90) grade = "O";
      else if (total >= 80) grade = "A+";
      else if (total >= 70) grade = "A";
      else if (total >= 60) grade = "B+";
      else if (total >= 50) grade = "B";
      else if (total >= 45) grade = "C";

      markWrites.push({
        ref: db.collection("exams").doc(`${student.id}_${subject.replace(/[\s&]+/g, "_").toLowerCase()}`),
        data: {
          studentId: student.id,
          studentName: student.name,
          rollNo: student.rollNo,
          dept: student.dept,
          year: student.year,
          section: student.section,
          subject, int1, int2, assignment, external, total, grade,
          createdAt: new Date().toISOString(),
        }
      });
    }
  }

  await writeBatchWithRetry(markWrites, "marks");
  console.log(`\n✅ ${markWrites.length} mark records seeded.\n`);

  console.log("═════════════════════════════════════════");
  console.log("🎉  PHASE 2 COMPLETE!");
  console.log("═════════════════════════════════════════");
  console.log(`  📋 Attendance: ${attWrites.length} records`);
  console.log(`  📊 Marks:      ${markWrites.length} records`);
  process.exit(0);
}

main().catch(err => {
  console.error("\n❌ Phase 2 failed:", err.message || err);
  process.exit(1);
});
