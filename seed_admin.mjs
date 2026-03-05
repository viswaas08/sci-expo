// ─────────────────────────────────────────────────────────────────────────────
// Seed Script — Create Default Admin Account
// Uses firebase-admin SDK (server-side Node.js)
//
// SETUP (one-time):
//   1. Ensure serviceAccountKey.json is in this folder
//   2. Run: node seed_admin.mjs
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
  console.error("   Download it from Firebase Console → Project Settings → Service Accounts");
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id,
});

const db        = admin.firestore();
const authAdmin = admin.auth();

// ── Default Admin Credentials ─────────────────────────────────────────────────
const ADMIN_EMAIL    = "admin@school.edu";
const ADMIN_PASSWORD = "ADMIN@1234";
const ADMIN_NAME     = "Super Admin";

async function seedAdmin() {
  console.log("\n🛡️  Creating default admin account...\n");

  // 1. Create Firebase Auth user
  let uid;
  try {
    const userRecord = await authAdmin.createUser({
      email:       ADMIN_EMAIL,
      password:    ADMIN_PASSWORD,
      displayName: ADMIN_NAME,
    });
    uid = userRecord.uid;
    console.log(`✅ Firebase Auth user created: ${ADMIN_EMAIL}`);
  } catch (e) {
    if (e.code === "auth/email-already-exists") {
      const existing = await authAdmin.getUserByEmail(ADMIN_EMAIL);
      uid = existing.uid;
      console.log(`ℹ️  Firebase Auth user already exists (uid: ${uid})`);
      // Update password to ensure it matches default
      await authAdmin.updateUser(uid, { password: ADMIN_PASSWORD });
      console.log(`🔑 Password reset to: ${ADMIN_PASSWORD}`);
    } else {
      throw e;
    }
  }

  // 2. Write Firestore document
  await db.collection("users").doc(uid).set({
    uid,
    email:     ADMIN_EMAIL,
    name:      ADMIN_NAME,
    role:      "admin",
    active:    true,
    createdAt: new Date().toISOString(),
    seeded:    true,
  }, { merge: true });

  console.log(`✅ Firestore document written at users/${uid}`);

  console.log("\n═══════════════════════════════════════════");
  console.log("🎉  Admin account ready!");
  console.log("═══════════════════════════════════════════");
  console.log(`  📧 Email    : ${ADMIN_EMAIL}`);
  console.log(`  🔑 Password : ${ADMIN_PASSWORD}`);
  console.log(`  🆔 UID      : ${uid}`);
  console.log("═══════════════════════════════════════════");
  console.log("\nVisit: http://localhost:5173/admin/login to sign in.\n");

  process.exit(0);
}

seedAdmin().catch(err => {
  console.error("\n❌ Failed:", err.message || err);
  process.exit(1);
});
