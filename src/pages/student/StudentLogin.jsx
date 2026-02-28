import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { FaArrowLeft } from "react-icons/fa";

export default function StudentLogin() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState(""); const [password, setPassword] = useState("");
  const [error, setError] = useState(""); const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault(); setError(""); setLoading(true);
    try {
      // Allow them to type full email, or assume it's a roll number and append the domain
      const loginEmail = username.includes("@") ? username.trim() : `${username.trim().toLowerCase()}@student.portal`;
      const cred = await login(loginEmail, password);
      const snap = await getDoc(doc(db, "users", cred.user.uid));
      if (snap.exists() && snap.data().role === "student") { navigate("/student"); }
      else { setError("Access denied. Not a student account."); }
    } catch { setError("Invalid username or password."); }
    finally { setLoading(false); }
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
          <div className="form-group"><label>Roll Number / Username</label><input className="form-control" type="text" placeholder="e.g. 24ECE1" value={username} onChange={e => setUsername(e.target.value)} required /></div>
          <div className="form-group"><label>Password</label><input className="form-control" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required /></div>
          <button className="btn btn-primary w-full btn-lg" type="submit" disabled={loading}>{loading ? <span className="spinner" /> : "Sign In as Student"}</button>
        </form>
      </div>
    </div>
  );
}
