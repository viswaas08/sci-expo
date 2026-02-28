// ─────────────────────────────────────────────────────────────────────────────
// Seed Phase 3: Attendance + Marks - One department at a time
// Usage: node seed_dept.mjs ECE
//        node seed_dept.mjs IT
//        node seed_dept.mjs MECH  ... etc
// ─────────────────────────────────────────────────────────────────────────────

import admin from "firebase-admin";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TARGET_DEPT = process.argv[2]?.toUpperCase();

if (!TARGET_DEPT) {
  console.error("❌ Usage: node seed_dept.mjs <DEPT>  (e.g. ECE, IT, MECH, EEE, CSE, AIDS)");
  process.exit(1);
}

const serviceAccount = JSON.parse(readFileSync(path.join(__dirname, "serviceAccountKey.json"), "utf8"));
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

async function writeInChunks(writes, label) {
  const CHUNK = 200; // small chunks 
  const DELAY = 1500; // 1.5s between batches

  for (let i = 0; i < writes.length; i += CHUNK) {
    const chunk = writes.slice(i, i + CHUNK);
    let retries = 5;
    while (retries > 0) {
      try {
        const batch = db.batch();
        for (const { ref, data } of chunk) batch.set(ref, data);
        await batch.commit();
        break;
      } catch (err) {
        retries--;
        console.log(`\n  ⚠ Retry (${retries} left)... ${err.message?.slice(0, 60)}`);
        await sleep(3000);
        if (retries === 0) throw err;
      }
    }
    process.stdout.write(`  ✓ ${label}: ${Math.min(i + CHUNK, writes.length)}/${writes.length} written\r`);
    await sleep(DELAY);
  }
  process.stdout.write("\n");
}

async function main() {
  const subjects = DEPT_SUBJECTS[TARGET_DEPT];
  if (!subjects) {
    console.error(`❌ Unknown dept: ${TARGET_DEPT}. Valid: ECE, IT, MECH, EEE, CSE, AIDS`);
    process.exit(1);
  }

  console.log(`\n🌱 Seeding attendance + marks for ${TARGET_DEPT} students...\n`);

  // Load students for this dept only
  const snap = await db.collection("users").where("role", "==", "student").where("dept", "==", TARGET_DEPT).get();
  const students = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  console.log(`✅ Found ${students.length} students in ${TARGET_DEPT}\n`);

  if (students.length === 0) { console.error("❌ No students found for this dept."); process.exit(1); }

  // ── ATTENDANCE ─────────────────────────────────────────────────────────────
  console.log(`📋 Attendance: ${students.length} students × 60 days = ${students.length * 60} records`);
  const attWrites = [];
  for (const s of students) {
    for (let day = 1; day <= 60; day++) {
      const dateStr = getDateStr(day);
      attWrites.push({
        ref: db.collection("attendance").doc(`${s.id}_${dateStr}`),
        data: {
          studentId: s.id, studentName: s.name, rollNo: s.rollNo,
          dept: s.dept, year: s.year, section: s.section,
          date: dateStr, status: rBool(0.82) ? "present" : "absent",
          createdAt: new Date().toISOString(),
        }
      });
    }
  }
  await writeInChunks(attWrites, "attendance");
  console.log(`✅ ${attWrites.length} attendance records done.\n`);

  // ── MARKS ──────────────────────────────────────────────────────────────────
  console.log(`📊 Marks: ${students.length} students × 5 subjects = ${students.length * 5} records`);
  const markWrites = [];
  for (const s of students) {
    for (const subject of subjects) {
      const int1 = rInt(13, 30), int2 = rInt(13, 30);
      const assignment = rInt(5, 10), external = rInt(35, 75);
      const total = int1 + int2 + assignment + external;
      const grade = total >= 90 ? "O" : total >= 80 ? "A+" : total >= 70 ? "A" : total >= 60 ? "B+" : total >= 50 ? "B" : total >= 45 ? "C" : "F";

      markWrites.push({
        ref: db.collection("exams").doc(`${s.id}_${subject.replace(/[\s&]+/g, "_").toLowerCase()}`),
        data: {
          studentId: s.id, studentName: s.name, rollNo: s.rollNo,
          dept: s.dept, year: s.year, section: s.section,
          subject, int1, int2, assignment, external, total, grade,
          createdAt: new Date().toISOString(),
        }
      });
    }
  }
  await writeInChunks(markWrites, "marks");
  console.log(`✅ ${markWrites.length} marks done.\n`);

  console.log(`🎉 ${TARGET_DEPT} complete! Attendance: ${attWrites.length}, Marks: ${markWrites.length}`);
  process.exit(0);
}

main().catch(err => { console.error("\n❌ Failed:", err.message || err); process.exit(1); });
