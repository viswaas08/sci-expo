import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { FaArrowLeft, FaGoogle, FaUserShield } from "react-icons/fa";

// ── Default Credentials (hardcoded for easy first-time access) ────────────────
const DEFAULT_ADMIN_EMAIL    = "admin@school.edu";
const DEFAULT_ADMIN_PASSWORD = "ADMIN@1234";

export default function AdminLogin() {
  const { login, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail]       = useState(DEFAULT_ADMIN_EMAIL);
  const [password, setPassword] = useState(DEFAULT_ADMIN_PASSWORD);
  const [error, setError]   = useState("");
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
      } else if (snap.exists() && snap.data().role === "office_staff") {
        navigate("/office");
      } else {
        setError("Access denied. This account does not have admin or office staff privileges.");
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
      } else if (snap.exists() && snap.data().role === "office_staff") {
        navigate("/office");
      } else {
        // Sign out so the ghost session doesn't persist
        const { signOut } = await import("firebase/auth");
        const { adminAuth } = await import("../../firebase");
        await signOut(adminAuth);
        setError(
          `The Google account "${cred.user.email}" is not registered as an admin or office staff. ` +
          `Ask an existing admin to add it first.`
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
          <h1>Admin / Office Portal</h1>
          <p>Sign in with your admin or office staff credentials</p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label>Email Address</label>
            <input className="form-control" type="email" placeholder="staff@school.edu" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input className="form-control" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          <button className="btn btn-primary w-full btn-lg" type="submit" disabled={loading}>
            {loading ? <span className="spinner" /> : "Sign In"}
          </button>
        </form>

        <div className="divider">or continue with</div>

        <button className="btn btn-secondary w-full" onClick={handleGoogle} disabled={loading}>
          <FaGoogle /> Sign in with Google
        </button>

        {/* Default Credentials hint */}
        <div style={{
          marginTop: 20, padding: "14px 16px",
          background: "rgba(79,156,249,0.06)",
          border: "1px solid rgba(79,156,249,0.18)",
          borderRadius: 10, fontSize: 13,
        }}>
          <div style={{ fontWeight: 600, color: "var(--accent-blue)", marginBottom: 6 }}>
            <FaUserShield style={{ marginRight: 6 }} />Default Admin Credentials
          </div>
          <div style={{ color: "var(--text-secondary)", marginBottom: 10, lineHeight: 1.6 }}>
            📧 <code style={{ color: "var(--accent-orange)" }}>{DEFAULT_ADMIN_EMAIL}</code><br />
            🔑 <code style={{ color: "var(--accent-orange)" }}>{DEFAULT_ADMIN_PASSWORD}</code>
          </div>
          <button
            type="button"
            className="btn btn-primary w-full"
            style={{ fontSize: 13, padding: "9px 16px" }}
            onClick={() => { setEmail(DEFAULT_ADMIN_EMAIL); setPassword(DEFAULT_ADMIN_PASSWORD); }}
            disabled={loading}
          >
            ⚡ Fill Default Admin Credentials
          </button>
        </div>
      </div>
    </div>
  );
}
