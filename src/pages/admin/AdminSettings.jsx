import { useState, useEffect } from "react";
import { collection, getDocs, query, where, doc, setDoc, deleteDoc } from "firebase/firestore";
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider, getAuth } from "firebase/auth";
import { initializeApp } from "firebase/app";
import { db, adminAuth, firebaseConfig } from "../../firebase";
import { useAuth } from "../../context/AuthContext";
import Sidebar from "../../components/Sidebar";
import { FaSave, FaKey, FaPlus, FaTrash, FaUserShield, FaTimes, FaEye, FaEyeSlash } from "react-icons/fa";

export default function AdminSettings() {
  const { currentUser } = useAuth();

  // ── Own password change ──────────────────────────────────────
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd]         = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [showNew, setShowNew]       = useState(false);
  const [pwdError, setPwdError]     = useState("");
  const [pwdSuccess, setPwdSuccess] = useState("");
  const [pwdLoading, setPwdLoading] = useState(false);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPwdError(""); setPwdSuccess("");
    if (newPwd !== confirmPwd) { setPwdError("New passwords do not match."); return; }
    if (newPwd.length < 8) { setPwdError("Password must be at least 8 characters."); return; }
    setPwdLoading(true);
    try {
      const credential = EmailAuthProvider.credential(currentUser.email, currentPwd);
      await reauthenticateWithCredential(currentUser, credential);
      await updatePassword(currentUser, newPwd);
      setPwdSuccess("Password updated successfully!");
      setCurrentPwd(""); setNewPwd(""); setConfirmPwd("");
    } catch (err) {
      setPwdError(err.message || "Failed to update password.");
    } finally {
      setPwdLoading(false);
    }
  };

  // ── Admin accounts management ────────────────────────────────
  const [admins, setAdmins]             = useState([]);
  const [adminsLoading, setAdminsLoading] = useState(true);
  const [showAddAdmin, setShowAddAdmin] = useState(false);
  const [adminForm, setAdminForm]       = useState({ name: "", email: "", password: "" });
  const [showAdminPwd, setShowAdminPwd] = useState(false);
  const [adminError, setAdminError]     = useState("");
  const [adminSuccess, setAdminSuccess] = useState("");
  const [adminSaving, setAdminSaving]   = useState(false);
  const [revealedAdmins, setRevealedAdmins] = useState({});

  const fetchAdmins = async () => {
    setAdminsLoading(true);
    const snap = await getDocs(query(collection(db, "users"), where("role", "==", "admin")));
    setAdmins(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    setAdminsLoading(false);
  };

  useEffect(() => { fetchAdmins(); }, []);

  const handleAddAdmin = async (e) => {
    e.preventDefault();
    setAdminError(""); setAdminSuccess("");
    if (adminForm.password.length < 8) { setAdminError("Password must be at least 8 characters."); return; }
    setAdminSaving(true);
    try {
      // Use a uniquely-named secondary app so we don't disturb the current admin session
      const appName = `AdminCreate_${Date.now()}`;
      const secondaryApp  = initializeApp(firebaseConfig, appName);
      const secondaryAuth = getAuth(secondaryApp);
      const { createUserWithEmailAndPassword } = await import("firebase/auth");
      const cred = await createUserWithEmailAndPassword(secondaryAuth, adminForm.email, adminForm.password);
      await setDoc(doc(db, "users", cred.user.uid), {
        name: adminForm.name,
        email: adminForm.email,
        role: "admin",
        uid: cred.user.uid,
        initialPassword: adminForm.password,
        createdAt: new Date().toISOString(),
      });
      await secondaryAuth.signOut();
      setAdminSuccess(`Admin account for ${adminForm.name} created.`);
      setAdminForm({ name: "", email: "", password: "" });
      setShowAddAdmin(false);
      fetchAdmins();
    } catch (err) {
      setAdminError(err.message || "Failed to create admin.");
    } finally {
      setAdminSaving(false);
    }
  };

  const handleDeleteAdmin = async (admin) => {
    if (admin.id === currentUser?.uid) {
      alert("You cannot remove your own admin account.");
      return;
    }
    if (!confirm(`Remove admin access for ${admin.name || admin.email}?`)) return;
    await deleteDoc(doc(db, "users", admin.id));
    fetchAdmins();
  };

  const toggleReveal = (id) => setRevealedAdmins(prev => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content animate-fade-up">
        <div className="page-header">
          <h1>Admin Settings</h1>
          <p>Manage your account and system administrators</p>
        </div>

        {/* ── Own Password Change ── */}
        <div className="glass-card" style={{ maxWidth: 480, marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
            <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(167,139,250,0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent-purple)", fontSize: 18 }}><FaKey /></div>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 600 }}>Change Your Password</h3>
              <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>Update your admin account password</p>
            </div>
          </div>

          {pwdError   && <div className="alert alert-error">{pwdError}</div>}
          {pwdSuccess && <div className="alert alert-success">{pwdSuccess}</div>}

          <form onSubmit={handleChangePassword}>
            <div className="form-group">
              <label>Current Password</label>
              <input className="form-control" type="password" placeholder="Current password" value={currentPwd} onChange={e => setCurrentPwd(e.target.value)} required />
            </div>
            <div className="form-group" style={{ position: "relative" }}>
              <label>New Password</label>
              <input className="form-control" type={showNew ? "text" : "password"} placeholder="Min 8 characters" value={newPwd} onChange={e => setNewPwd(e.target.value)} required style={{ paddingRight: 40 }} />
              <span onClick={() => setShowNew(p => !p)} style={{ position: "absolute", right: 12, top: 38, cursor: "pointer", color: "var(--text-muted)" }}>{showNew ? <FaEyeSlash /> : <FaEye />}</span>
            </div>
            <div className="form-group">
              <label>Confirm New Password</label>
              <input className="form-control" type="password" placeholder="Repeat new password" value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} required />
            </div>
            <button className="btn btn-primary" type="submit" disabled={pwdLoading}>
              {pwdLoading ? <span className="spinner" /> : <><FaSave /> Update Password</>}
            </button>
          </form>
        </div>

        {/* ── Admin Account Info ── */}
        <div className="glass-card" style={{ maxWidth: 480, marginBottom: 24 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Account Info</h3>
          <div style={{ fontSize: 14, color: "var(--text-secondary)" }}>
            <p><strong style={{ color: "var(--text-primary)" }}>Email:</strong> {currentUser?.email}</p>
            <p style={{ marginTop: 8 }}><strong style={{ color: "var(--text-primary)" }}>Role:</strong> <span className="badge badge-purple">Administrator</span></p>
          </div>
        </div>

        {/* ── Manage Admin Accounts ── */}
        <div className="glass-card" style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(251,146,60,0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent-orange)", fontSize: 18 }}><FaUserShield /></div>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 600 }}>Admin Accounts</h3>
                <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>Add or remove system administrators</p>
              </div>
            </div>
            <button className="btn btn-primary" onClick={() => { setShowAddAdmin(true); setAdminError(""); setAdminSuccess(""); }}>
              <FaPlus /> Add Admin
            </button>
          </div>

          {adminError   && <div className="alert alert-error">{adminError}</div>}
          {adminSuccess && <div className="alert alert-success">{adminSuccess}</div>}

          {showAddAdmin && (
            <form onSubmit={handleAddAdmin} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: 20, marginBottom: 20, border: "1px solid rgba(255,255,255,0.07)" }}>
              <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: "var(--accent-orange)" }}>New Administrator</h4>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div className="form-group">
                  <label>Full Name</label>
                  <input className="form-control" placeholder="Admin Name" value={adminForm.name} onChange={e => setAdminForm({ ...adminForm, name: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input className="form-control" type="email" placeholder="admin@school.edu" value={adminForm.email} onChange={e => setAdminForm({ ...adminForm, email: e.target.value })} required />
                </div>
                <div className="form-group" style={{ position: "relative" }}>
                  <label>Password</label>
                  <input className="form-control" type={showAdminPwd ? "text" : "password"} placeholder="Min 8 characters" value={adminForm.password} onChange={e => setAdminForm({ ...adminForm, password: e.target.value })} required style={{ paddingRight: 40 }} />
                  <span onClick={() => setShowAdminPwd(p => !p)} style={{ position: "absolute", right: 12, top: 38, cursor: "pointer", color: "var(--text-muted)" }}>{showAdminPwd ? <FaEyeSlash /> : <FaEye />}</span>
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                <button className="btn btn-primary" type="submit" disabled={adminSaving}>{adminSaving ? <span className="spinner" /> : <><FaSave /> Create Admin</>}</button>
                <button className="btn btn-secondary" type="button" onClick={() => setShowAddAdmin(false)}><FaTimes /> Cancel</button>
              </div>
            </form>
          )}

          {adminsLoading ? <div className="loading-center"><div className="spinner" /></div> : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr><th>Name</th><th>Email</th><th>Password</th><th>Created</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {admins.length === 0 ? (
                    <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--text-muted)", padding: "30px 0" }}>No admins found.</td></tr>
                  ) : admins.map(a => (
                    <tr key={a.id}>
                      <td style={{ fontWeight: 500 }}>{a.name || "—"} {a.id === currentUser?.uid && <span className="badge badge-purple" style={{ fontSize: 10, marginLeft: 6 }}>You</span>}</td>
                      <td style={{ color: "var(--text-secondary)", fontSize: 13 }}>{a.email}</td>
                      <td>
                        {a.initialPassword ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontFamily: "monospace", fontSize: 13 }}>{revealedAdmins[a.id] ? a.initialPassword : "••••••••"}</span>
                            <button className="btn btn-secondary btn-sm" onClick={() => toggleReveal(a.id)} title={revealedAdmins[a.id] ? "Hide" : "Show"}>
                              {revealedAdmins[a.id] ? <FaEyeSlash /> : <FaEye />}
                            </button>
                          </div>
                        ) : <span style={{ color: "var(--text-muted)", fontSize: 12 }}>Not stored</span>}
                      </td>
                      <td style={{ color: "var(--text-muted)", fontSize: 12 }}>{a.createdAt ? new Date(a.createdAt).toLocaleDateString() : "—"}</td>
                      <td>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDeleteAdmin(a)} disabled={a.id === currentUser?.uid} title="Remove admin">
                          <FaTrash />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
