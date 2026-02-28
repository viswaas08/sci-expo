import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { FaUserShield, FaArrowLeft, FaGoogle } from "react-icons/fa";

export default function AdminLogin() {
  const { login, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const cred = await login(email, password);
      const snap = await getDoc(doc(db, "users", cred.user.uid));
      if (snap.exists() && snap.data().role === "admin") {
        navigate("/admin");
      } else {
        setError("Access denied. This account does not have admin privileges.");
      }
    } catch {
      setError("Invalid credentials. Please check your email and password.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError("");
    setLoading(true);
    try {
      const cred = await loginWithGoogle();
      const snap = await getDoc(doc(db, "users", cred.user.uid));
      if (snap.exists() && snap.data().role === "admin") {
        navigate("/admin");
      } else {
        // Sign out so the ghost session doesn't persist
        const { signOut } = await import("firebase/auth");
        const { adminAuth } = await import("../../firebase");
        await signOut(adminAuth);
        setError(
          `The Google account "${cred.user.email}" is not registered as an admin. ` +
          `Ask an existing admin to add it via Settings → Admin Accounts first.`
        );
      }
    } catch (err) {
      if (err.code === "auth/popup-closed-by-user" || err.code === "auth/cancelled-popup-request") {
        setError("Sign-in was cancelled. Please try again.");
      } else if (err.code === "auth/popup-blocked") {
        setError("Popup was blocked by your browser. Please allow popups for this site.");
      } else if (err.code === "auth/operation-not-allowed") {
        setError("Google sign-in is not enabled. Enable it in Firebase Console → Authentication → Sign-in methods.");
      } else {
        setError(err.message || "Google sign-in failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="login-page">
      <div className="login-bg-blob" style={{ width: 500, height: 500, background: "#667eea", top: -150, left: -150 }} />
      <div className="login-bg-blob" style={{ width: 350, height: 350, background: "#764ba2", bottom: -100, right: -80 }} />

      <div className="login-card">
        <Link to="/" className="back-link"><FaArrowLeft /> Back to Portal</Link>
        <div className="login-card-header">
          <div className="login-card-icon">🛡️</div>
          <h1>Admin Portal</h1>
          <p>Sign in with your admin credentials or Google account</p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label>Email Address</label>
            <input className="form-control" type="email" placeholder="admin@school.edu" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input className="form-control" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          <button className="btn btn-primary w-full btn-lg" type="submit" disabled={loading}>
            {loading ? <span className="spinner" /> : "Sign In as Admin"}
          </button>
        </form>

        <div className="divider">or continue with</div>

        <button className="btn btn-secondary w-full" onClick={handleGoogle} disabled={loading}>
          <FaGoogle /> Sign in with Google
        </button>

        <p style={{ textAlign: "center", marginTop: 20, fontSize: 13, color: "var(--text-muted)" }}>
          First-time admin? Default password is <code style={{ color: "var(--accent-orange)" }}>ADMIN@1234</code>
        </p>
      </div>
    </div>
  );
}
