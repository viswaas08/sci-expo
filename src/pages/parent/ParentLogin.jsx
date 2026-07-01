import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { FaArrowLeft, FaEye, FaEyeSlash } from "react-icons/fa";

export default function ParentLogin() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [rollNo, setRollNo] = useState(""); 
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(""); 
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault(); setError(""); setLoading(true);
    try {
      const loginEmail = rollNo.includes("@") ? rollNo.trim() : `parent.${rollNo.trim().toLowerCase()}@portal.edu`;
      const cred = await login(loginEmail, password);
      const snap = await getDoc(doc(db, "users", cred.user.uid));
      if (snap.exists() && snap.data().role === "parent") { navigate("/parent"); }
      else { setError("Access denied. Not a parent account."); }
    } catch { setError("Invalid username or password. Use the credentials provided by your child's teacher."); }
    finally { setLoading(false); }
  };

  return (
    <div className="login-page">
      <div className="login-bg-blob" style={{ width: 500, height: 500, background: "#43e97b", top: -150, left: -100 }} />
      <div className="login-bg-blob" style={{ width: 350, height: 350, background: "#38f9d7", bottom: -100, right: -80 }} />
      <div className="login-card">
        <Link to="/" className="back-link"><FaArrowLeft /> Back to Portal</Link>
        <div className="login-card-header">
          <div className="login-card-icon">👨‍👩‍👧</div>
          <h1>Parent Portal</h1>
          <p>Use the credentials provided by your child's teacher</p>
        </div>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={handleLogin}>
          <div className="form-group"><label>Student Roll Number</label><input className="form-control" type="text" placeholder="e.g. 24ECE1" value={rollNo} onChange={e => setRollNo(e.target.value)} required /></div>
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
          <button className="btn btn-primary w-full btn-lg" type="submit" disabled={loading}>{loading ? <span className="spinner" /> : "Sign In as Parent"}</button>
        </form>
        <p style={{ textAlign: "center", marginTop: 16, fontSize: 13, color: "var(--text-muted)" }}>Credentials are auto-generated when your child is registered by the teacher.</p>
      </div>
    </div>
  );
}
