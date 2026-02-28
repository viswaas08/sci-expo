import { useState, useEffect } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider } from "firebase/auth";
import { db, auth } from "../../firebase";
import { useAuth } from "../../context/AuthContext";
import Sidebar from "../../components/Sidebar";
import { FaSave, FaKey } from "react-icons/fa";

export default function AdminSettings() {
  const { currentUser } = useAuth();
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setError(""); setSuccess("");
    if (newPwd !== confirmPwd) { setError("New passwords do not match."); return; }
    if (newPwd.length < 8) { setError("Password must be at least 8 characters."); return; }
    setLoading(true);
    try {
      const credential = EmailAuthProvider.credential(currentUser.email, currentPwd);
      await reauthenticateWithCredential(currentUser, credential);
      await updatePassword(currentUser, newPwd);
      setSuccess("Password updated successfully!");
      setCurrentPwd(""); setNewPwd(""); setConfirmPwd("");
    } catch (err) {
      setError(err.message || "Failed to update password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content animate-fade-up">
        <div className="page-header">
          <h1>Admin Settings</h1>
          <p>Manage your account and system preferences</p>
        </div>

        <div className="glass-card" style={{ maxWidth: 480 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
            <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(167,139,250,0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent-purple)", fontSize: 18 }}><FaKey /></div>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 600 }}>Change Password</h3>
              <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>Update your admin account password</p>
            </div>
          </div>

          {error && <div className="alert alert-error">{error}</div>}
          {success && <div className="alert alert-success">{success}</div>}

          <form onSubmit={handleChangePassword}>
            <div className="form-group">
              <label>Current Password</label>
              <input className="form-control" type="password" placeholder="Current password" value={currentPwd} onChange={e => setCurrentPwd(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>New Password</label>
              <input className="form-control" type="password" placeholder="Min 8 characters" value={newPwd} onChange={e => setNewPwd(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>Confirm New Password</label>
              <input className="form-control" type="password" placeholder="Repeat new password" value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} required />
            </div>
            <button className="btn btn-primary" type="submit" disabled={loading}>
              {loading ? <span className="spinner" /> : <><FaSave /> Update Password</>}
            </button>
          </form>
        </div>

        <div className="glass-card" style={{ maxWidth: 480, marginTop: 24 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Account Info</h3>
          <div style={{ fontSize: 14, color: "var(--text-secondary)" }}>
            <p><strong style={{ color: "var(--text-primary)" }}>Email:</strong> {currentUser?.email}</p>
            <p style={{ marginTop: 8 }}><strong style={{ color: "var(--text-primary)" }}>Role:</strong> <span className="badge badge-purple">Administrator</span></p>
          </div>
        </div>
      </main>
    </div>
  );
}
