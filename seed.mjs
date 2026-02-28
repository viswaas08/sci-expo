// ─────────────────────────────────────────────────────────────────────────────
// Seed Script for Student Performance Portal
// Uses firebase-admin SDK (server-side Node.js)
//
// SETUP (one-time):
//   1. Go to: https://console.firebase.google.com/project/class-de301/settings/serviceaccounts/adminsdk
//   2. Click "Generate new private key" → save as serviceAccountKey.json in this folder
//   3. Run: node seed.mjs
// ─────────────────────────────────────────────────────────────────────────────

import admin from "firebase-admin";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load service account
let serviceAccount;
try {
  serviceAccount = JSON.parse(readFileSync(path.join(__dirname, "serviceAccountKey.json"), "utf8"));
} catch {
  console.error("❌ serviceAccountKey.json not found!");
  console.error("   1. Go to: https://console.firebase.google.com/project/class-de301/settings/serviceaccounts/adminsdk");
  console.error("   2. Click 'Generate new private key'");
  console.error("   3. Save the downloaded file as serviceAccountKey.json in the project root");
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: "class-de301",
});

const db = admin.firestore();
const authAdmin = admin.auth();

// ─── CONSTANTS ───────────────────────────────────────────────────────────────
const DEPTS = ["ECE", "IT", "MECH", "EEE", "CSE", "AIDS"];
const YEARS = [1, 2, 3, 4];
const SECTIONS = ["A", "B", "C"];
const ADMISSION_YEAR = 24;

const DEPT_SUBJECTS = {
  ECE:  ["Electronics Circuits", "Digital Electronics", "Signals & Systems", "Microprocessors", "Communication Systems"],
  IT:   ["Web Technologies", "Database Systems", "Operating Systems", "Computer Networks", "Software Engineering"],
  MECH: ["Engineering Mechanics", "Thermodynamics", "Fluid Mechanics", "Manufacturing Technology", "Machine Design"],
  EEE:  ["Circuit Theory", "Power Systems", "Control Systems", "Electrical Machines", "Power Electronics"],
  CSE:  ["Data Structures", "Algorithms", "DBMS", "Operating Systems", "Computer Networks"],
  AIDS: ["Machine Learning", "Data Mining", "Statistical Methods", "Big Data Analytics", "Neural Networks"],
};

const TEACHER_ROLES = ["Class Advisor", "HOD", "Subject Teacher", "Lab Assistant", "Mentor"];

const STUDENT_NAMES = [
  "Aarav Sharma", "Anjali Patel", "Arjun Nair", "Bhavna Reddy", "Chetan Kumar",
  "Deepa Menon", "Eshan Singh", "Falguni Joshi", "Gautam Rao", "Harini Suresh",
];

const TEACHER_NAMES = [
  "Dr. Anantharaman V", "Prof. Padmavathi K", "Dr. Suresh Babu R", "Prof. Girija S",
  "Dr. Venkataraman N", "Prof. Kavitha M", "Dr. Ramachandran P", "Prof. Usha L",
  "Dr. Krishnamurthy J", "Prof. Saranya D", "Dr. Muthukumar S", "Prof. Vidya B",
  "Dr. Narasimhan R", "Prof. Gomathi T", "Dr. Prakash K", "Prof. Deepa R",
  "Dr. Srinivasan M", "Prof. Priya N", "Dr. Balasubramaniam C", "Prof. Meena G",
  "Dr. Jayalakshmi V", "Prof. Karthik S", "Dr. Murugesan T", "Prof. Rekha J",
  "Dr. Vijayakumar A", "Prof. Sudha P", "Dr. Raghunathan B", "Prof. Chithra M",
  "Dr. Anbazhagan K", "Prof. Lakshmi N", "Dr. Thiruvenkatesan R", "Prof. Vijaya S",
  "Dr. Gopalakrishnan M", "Prof. Bhuvana A", "Dr. Swaminathan J", "Prof. Nirmala C",
  "Dr. Palaniswami K", "Prof. Revathi D", "Dr. Arumugam T", "Prof. Sheela B",
  "Dr. Venkatesan M", "Prof. Jaya P", "Dr. Sethuraman N", "Prof. Malini G",
  "Dr. Ramasamy C", "Prof. Indira K", "Dr. Chidambaram S", "Prof. Geetha R",
  "Dr. Loganathan P", "Prof. Kamakshi V", "Dr. Duraisamy M", "Prof. Ambika T",
  "Dr. Mohan R", "Prof. Suja N", "Dr. Balakrishnan S", "Prof. Vasantha K",
];

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const rInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const rBool = (p = 0.82) => Math.random() < p;

function getDateStr(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  // Skip Sundays (0) and Saturdays (6)
  const day = d.getDay();
  if (day === 0) d.setDate(d.getDate() - 1);
  if (day === 6) d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0];
}

async function commitBatch(batch) {
  await batch.commit();
  return db.batch();
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function seed() {
  console.log("\n🌱 Starting database seeding...\n");

  // ── 1. TEACHERS ────────────────────────────────────────────────────────────
  console.log("👨‍🏫 Seeding 56 teachers (Firestore docs + Firebase Auth)...");
  const teacherMap = {}; // "dept_year_section" → teacher uid
  let nameIdx = 0;
  let teacherBatch = db.batch();
  let batchOps = 0;

  for (const dept of DEPTS) {
    const counts = { ECE: 10, IT: 9, MECH: 9, EEE: 9, CSE: 9, AIDS: 10 };
    const count = counts[dept] || 9;

    for (let t = 0; t < count; t++) {
      const name = TEACHER_NAMES[nameIdx % TEACHER_NAMES.length];
      nameIdx++;

      const year = YEARS[t % YEARS.length];
      const sectionIdx = Math.floor(t / YEARS.length) % SECTIONS.length;
      const section = SECTIONS[sectionIdx];
      const email = `teacher.${dept.toLowerCase()}${t + 1}@school.edu`;
      const password = `Teacher@${dept}${t + 1}`;
      const key = `${dept}_${year}_${section}`;

      // Create Firebase Auth account
      let uid;
      try {
        const userRecord = await authAdmin.createUser({ email, password, displayName: name });
        uid = userRecord.uid;
      } catch (e) {
        if (e.code === "auth/email-already-exists") {
          const existing = await authAdmin.getUserByEmail(email);
          uid = existing.uid;
        } else throw e;
      }

      const assignedClasses = [`${dept} year ${year} sec ${section}`.toLowerCase()];

      teacherBatch.set(db.collection("users").doc(uid), {
        uid, name, email, role: "teacher",
        dept, year, section,
        assignedClasses,
        responsibilities: TEACHER_ROLES[t % TEACHER_ROLES.length],
        createdAt: new Date().toISOString(),
        seeded: true,
      });
      teacherMap[key] = uid;
      batchOps++;

      if (batchOps >= 490) {
        teacherBatch = await commitBatch(teacherBatch);
        batchOps = 0;
      }
      process.stdout.write(`  ✓ ${name} → ${dept} Y${year} Sec${section}    \r`);
    }
  }
  if (batchOps > 0) await teacherBatch.commit();
  console.log("\n✅ Teachers done.\n");

  // ── 2. STUDENTS ────────────────────────────────────────────────────────────
  console.log("👩‍🎓 Seeding 720 students (10 per dept/year/section)...");
  const allStudents = [];
  let studentBatch = db.batch();
  batchOps = 0;

  for (const dept of DEPTS) {
    for (const year of YEARS) {
      for (const section of SECTIONS) {
        const key = `${dept}_${year}_${section}`;
        const teacherId = teacherMap[key] || Object.values(teacherMap)[0];

        for (let i = 1; i <= 10; i++) {
          const studentName = `${STUDENT_NAMES[(i - 1) % STUDENT_NAMES.length]} ${String.fromCharCode(64 + i)}`;
          const rollNo = `${ADMISSION_YEAR}_${dept}_${section}_${String(i).padStart(2, "0")}`;
          const email = `${rollNo.toLowerCase()}@student.portal`;
          const password = `Student@${rollNo}`;

          let uid;
          try {
            const rec = await authAdmin.createUser({ email, password, displayName: studentName });
            uid = rec.uid;
          } catch (e) {
            if (e.code === "auth/email-already-exists") {
              const ex = await authAdmin.getUserByEmail(email);
              uid = ex.uid;
            } else throw e;
          }

          studentBatch.set(db.collection("users").doc(uid), {
            uid, name: studentName, email, rollNo,
            role: "student",
            admissionYear: ADMISSION_YEAR,
            dept, year, section,
            teacherId,
            createdAt: new Date().toISOString(),
            seeded: true,
          });

          allStudents.push({ uid, name: studentName, dept, year, section, rollNo });
          batchOps++;

          if (batchOps >= 490) {
            studentBatch = await commitBatch(studentBatch);
            batchOps = 0;
          }
          process.stdout.write(`  ✓ ${rollNo}    \r`);
        }
      }
    }
  }
  if (batchOps > 0) await studentBatch.commit();
  console.log(`\n✅ ${allStudents.length} students done.\n`);

  // ── 3. ATTENDANCE (60 days) ────────────────────────────────────────────────
  console.log("📋 Seeding attendance (60 days × 720 students = 43,200 records)...");
  let attBatch = db.batch();
  batchOps = 0;
  let attTotal = 0;

  for (const student of allStudents) {
    for (let day = 1; day <= 60; day++) {
      const dateStr = getDateStr(day);
      const status = rBool(0.82) ? "present" : "absent";
      const attId = `${student.uid}_${dateStr}`;

      attBatch.set(db.collection("attendance").doc(attId), {
        studentId: student.uid,
        studentName: student.name,
        rollNo: student.rollNo,
        dept: student.dept,
        year: student.year,
        section: student.section,
        date: dateStr,
        status,
        createdAt: new Date().toISOString(),
      });
      batchOps++;
      attTotal++;

      if (batchOps >= 490) {
        await attBatch.commit();
        attBatch = db.batch();
        batchOps = 0;
        process.stdout.write(`  ✓ ${attTotal} attendance records written\r`);
      }
    }
  }
  if (batchOps > 0) await attBatch.commit();
  console.log(`\n✅ ${attTotal} attendance records done.\n`);

  // ── 4. MARKS ──────────────────────────────────────────────────────────────
  console.log("📊 Seeding marks (720 students × 5 subjects = 3,600 records)...");
  let markBatch = db.batch();
  batchOps = 0;
  let markTotal = 0;

  for (const student of allStudents) {
    const subjects = DEPT_SUBJECTS[student.dept];

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

      const markId = `${student.uid}_${subject.replace(/[\s&]+/g, "_").toLowerCase()}`;

      markBatch.set(db.collection("exams").doc(markId), {
        studentId: student.uid,
        studentName: student.name,
        rollNo: student.rollNo,
        dept: student.dept,
        year: student.year,
        section: student.section,
        subject,
        internal1: int1,
        internal2: int2,
        assignment,
        external,
        total,
        grade,
        createdAt: new Date().toISOString(),
      });
      batchOps++;
      markTotal++;

      if (batchOps >= 490) {
        await markBatch.commit();
        markBatch = db.batch();
        batchOps = 0;
        process.stdout.write(`  ✓ ${markTotal} marks written\r`);
      }
    }
  }
  if (batchOps > 0) await markBatch.commit();
  console.log(`\n✅ ${markTotal} marks done.\n`);

  console.log("═══════════════════════════════════════");
  console.log("🎉  SEEDING COMPLETE!");
  console.log("═══════════════════════════════════════");
  console.log(`  👨‍🏫 Teachers  : 56`);
  console.log(`  👩‍🎓 Students  : ${allStudents.length}`);
  console.log(`  📋 Attendance: ${attTotal} records`);
  console.log(`  📊 Marks     : ${markTotal} records`);
  process.exit(0);
}

seed().catch(err => {
  console.error("\n❌ Seeding failed:", err.message || err);
  process.exit(1);
});
