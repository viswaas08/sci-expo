// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Firebase configuration (values loaded from .env — never commit secrets to git)
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Each portal gets its OWN named Firebase app instance.
// This gives each an isolated auth session in localStorage, allowing
// admin, teacher, student, and parent to be logged in simultaneously
// in the same browser with no cross-interference.
const adminApp   = initializeApp(firebaseConfig, "adminApp");
const teacherApp = initializeApp(firebaseConfig, "teacherApp");
const studentApp = initializeApp(firebaseConfig, "studentApp");
const parentApp  = initializeApp(firebaseConfig, "parentApp");
const officeApp  = initializeApp(firebaseConfig, "officeApp");

// Shared Firestore (only one DB needed; auth is per-portal)
const _defaultApp = adminApp;
export const db = getFirestore(_defaultApp);

// Per-portal auth instances
export const adminAuth   = getAuth(adminApp);
export const teacherAuth = getAuth(teacherApp);
export const studentAuth = getAuth(studentApp);
export const parentAuth  = getAuth(parentApp);
export const officeAuth  = getAuth(officeApp);

// Legacy: keeps old imports working for files not yet migrated
export const auth = adminAuth;
export const googleProvider = new GoogleAuthProvider();