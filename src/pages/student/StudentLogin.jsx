import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { FaArrowLeft, FaInfoCircle, FaEye, FaEyeSlash } from "react-icons/fa";

export default function StudentLogin() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault(); setError(""); setLoading(true);
    try {
      // Allow full email OR just the roll number (auto-appends domain)
      const loginEmail = username.includes("@")
        ? username.trim()
        : `${username.trim().toLowerCase()}@student.portal`;
      const cred = await login(loginEmail, password);
      const snap = await getDoc(doc(db, "users", cred.user.uid));
      if (snap.exists() && snap.data().role === "student") {
        navigate("/student");
      } else {
        setError("Access denied. Not a student account.");
      }
    } catch (err) {
      if (err.code === "auth/invalid-credential" || err.code === "auth/wrong-password" || err.code === "auth/user-not-found") {
        setError("Invalid roll number or password. Check the format shown below.");
      } else {
        setError(err.message || "Login failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-bg-blob" style={{ width: 500, height: 500, background: "#4facfe", top: -150, right: -100 }} />
      <div className="login-bg-blob" style={{ width: 350, height: 350, background: "#00f2fe", bottom: -100, left: -80 }} />
      <div className="login-card">
        <Link to="/" className="back-link"><FaArrowLeft /> Back to Portal</Link>
        <div className="login-card-header">
          <div className="login-card-icon">🎓</div>
          <h1>Student Portal</h1>
          <p>Sign in to track your academic performance</p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label>Roll Number</label>
            <input
              className="form-control"
              type="text"
              placeholder="e.g. 24_ECE_A_01"
              value={username}
              onChange={e => setUsername(e.target.value)}
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
          <button className="btn btn-primary w-full btn-lg" type="submit" disabled={loading}>
            {loading ? <span className="spinner" /> : "Sign In as Student"}
          </button>
        </form>

        {/* Credential hint */}
        <div style={{ marginTop: 20, padding: "12px 16px", background: "rgba(79,172,254,0.08)", borderRadius: 10, border: "1px solid rgba(79,172,254,0.2)", fontSize: 13 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--accent-blue)", fontWeight: 600, marginBottom: 8 }}>
            <FaInfoCircle /> Default Credentials Format
          </div>
          <div style={{ color: "var(--text-secondary)", lineHeight: 1.8 }}>
            <div><strong style={{ color: "var(--text-primary)" }}>Roll No:</strong> <code>24_ECE_A_01</code> <span style={{ opacity: 0.6 }}>(YEAR_DEPT_SECTION_NUMBER)</span></div>
            <div><strong style={{ color: "var(--text-primary)" }}>Password:</strong> <code>Student@24_ECE_A_01</code> <span style={{ opacity: 0.6 }}>(Student@ + roll no)</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}

