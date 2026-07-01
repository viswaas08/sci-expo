import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { FaArrowLeft, FaGoogle, FaUserTie, FaEye, FaEyeSlash } from "react-icons/fa";

// Default credentials for easy first-time access
const DEFAULT_OFFICE_EMAIL = "ds3500140@gmail.com";

export default function OfficeLogin() {
  const { login, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState(DEFAULT_OFFICE_EMAIL);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const cred = await login(email, password);
      const snap = await getDoc(doc(db, "users", cred.user.uid));
      if (snap.exists() && snap.data().role === "office_staff") {
        navigate("/office");
      } else {
        // Sign out if they log into the wrong portal
        const { signOut } = await import("firebase/auth");
        const { officeAuth } = await import("../../firebase");
        await signOut(officeAuth);
        setError("Access denied. This account does not have office staff privileges.");
      }
    } catch (err) {
      if (err.code === "auth/invalid-credential" || err.code === "auth/wrong-password" || err.code === "auth/user-not-found") {
        setError("Invalid email or password. Check the format shown below.");
      } else {
        setError(err.message || "Login failed. Please try again.");
      }
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
      if (snap.exists() && snap.data().role === "office_staff") {
        navigate("/office");
      } else {
        const { signOut } = await import("firebase/auth");
        const { officeAuth } = await import("../../firebase");
        await signOut(officeAuth);
        setError(
          `The Google account "${cred.user.email}" is not registered as office staff.`
        );
      }
    } catch (err) {
      if (err.code === "auth/popup-closed-by-user" || err.code === "auth/cancelled-popup-request") {
        setError("Sign-in was cancelled. Please try again.");
      } else {
        setError(err.message || "Google sign-in failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-bg-blob" style={{ width: 500, height: 500, background: "#f59e0b", top: -150, left: -150 }} />
      <div className="login-bg-blob" style={{ width: 350, height: 350, background: "#d97706", bottom: -100, right: -80 }} />

      <div className="login-card">
        <Link to="/" className="back-link"><FaArrowLeft /> Back to Portal</Link>
        <div className="login-card-header">
          <div className="login-card-icon">🏢</div>
          <h1>Office Staff Portal</h1>
          <p>Sign in with your office staff credentials</p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label>Email Address</label>
            <input
              className="form-control"
              type="email"
              placeholder="staff@school.edu"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <div style={{ position: "relative" }}>
              <input
                className="form-control"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                style={{ paddingRight: "44px" }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: "absolute",
                  right: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  color: "var(--text-secondary)",
                  cursor: "pointer",
                  fontSize: "16px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "4px"
                }}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
          </div>
          <button className="btn btn-primary w-full btn-lg" type="submit" disabled={loading} style={{ background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)", boxShadow: "0 4px 20px rgba(245, 158, 11, 0.3)" }}>
            {loading ? <span className="spinner" /> : "Sign In"}
          </button>
        </form>

        <div className="divider">or continue with</div>

        <button className="btn btn-secondary w-full" onClick={handleGoogle} disabled={loading}>
          <FaGoogle /> Sign in with Google
        </button>

        {/* Credentials fill helper */}
        <div style={{
          marginTop: 20, padding: "14px 16px",
          background: "rgba(245, 158, 11, 0.06)",
          border: "1px solid rgba(245, 158, 11, 0.18)",
          borderRadius: 10, fontSize: 13,
        }}>
          <div style={{ fontWeight: 600, color: "#f59e0b", marginBottom: 6 }}>
            <FaUserTie style={{ marginRight: 6 }} />Office Staff (Kishore) Credentials
          </div>
          <div style={{ color: "var(--text-secondary)", marginBottom: 10, lineHeight: 1.6 }}>
            📧 <code style={{ color: "var(--accent-orange)" }}>{DEFAULT_OFFICE_EMAIL}</code><br />
            🔑 <code style={{ color: "var(--accent-orange)" }}>OfficePass123</code>
          </div>
          <button
            type="button"
            className="btn btn-primary w-full"
            style={{ fontSize: 13, padding: "9px 16px", background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)" }}
            onClick={() => { setEmail(DEFAULT_OFFICE_EMAIL); setPassword("OfficePass123"); }}
            disabled={loading}
          >
            ⚡ Fill Kishore's Credentials
          </button>
        </div>
      </div>
    </div>
  );
}
