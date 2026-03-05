import { createContext, useContext, useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { adminAuth, teacherAuth, studentAuth, parentAuth, officeAuth, db, googleProvider } from "../firebase";
import { useLocation } from "react-router-dom";

// Pick the correct isolated auth instance based on the portal URL path.
// This allows Admin, Teacher, Student, and Parent to be simultaneously
// logged in inside the same browser without session conflicts.
function getPortalAuth(pathname) {
  if (pathname.startsWith("/teacher")) return teacherAuth;
  if (pathname.startsWith("/student")) return studentAuth;
  if (pathname.startsWith("/parent"))  return parentAuth;
  if (pathname.startsWith("/office"))  return officeAuth;
  return adminAuth; // default: admin portal
}

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  return <PortalAuthProvider>{children}</PortalAuthProvider>;
}

function PortalAuthProvider({ children }) {
  const location = useLocation();
  const portalAuth = getPortalAuth(location.pathname);

  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = onAuthStateChanged(portalAuth, async (user) => {
      if (user) {
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setUserData(data);
          setUserRole(data.role);
        }
        setCurrentUser(user);
      } else {
        setCurrentUser(null);
        setUserRole(null);
        setUserData(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, [portalAuth]);

  const login = (email, password) =>
    signInWithEmailAndPassword(portalAuth, email, password);

  const loginWithGoogle = () => signInWithPopup(portalAuth, googleProvider);

  const logout = () => signOut(portalAuth);

  const registerUser = async (email, password, role, extraData = {}) => {
    const cred = await createUserWithEmailAndPassword(portalAuth, email, password);
    await setDoc(doc(db, "users", cred.user.uid), {
      email, role,
      uid: cred.user.uid,
      createdAt: new Date().toISOString(),
      ...extraData,
    });
    return cred;
  };

  return (
    <AuthContext.Provider value={{ currentUser, userRole, userData, loading, login, loginWithGoogle, logout, registerUser }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
