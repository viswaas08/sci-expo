import { useState, useEffect } from "react";
import { collection, getDocs, doc, setDoc, updateDoc, query, where } from "firebase/firestore";
import { db, officeAuth } from "../../firebase";
import { createUserWithEmailAndPassword, updatePassword } from "firebase/auth";
import Sidebar from "../../components/Sidebar";
import { FaUserTie, FaPlus, FaEdit, FaToggleOn, FaToggleOff, FaTimes, FaSave, FaKey } from "react-icons/fa";

const EMPTY_FORM = { name: "", email: "", employeeId: "", phone: "", password: "" };

export default function ManageOfficeStaff() {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState(null); // null = new, else uid
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const fetchStaff = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "users"), where("role", "==", "office_staff"));
      const snap = await getDocs(q);
      setStaff(snap.docs.map(d => ({ uid: d.id, ...d.data() })));
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { fetchStaff(); }, []);

  const openNew = () => {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setError("");
    setSuccess("");
    setShowModal(true);
  };

  const openEdit = (s) => {
    setEditTarget(s.uid);
    setForm({ name: s.name || "", email: s.email || "", employeeId: s.employeeId || "", phone: s.phone || "", password: "" });
    setError("");
    setSuccess("");
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (editTarget) {
        // Update Firestore document
        await updateDoc(doc(db, "users", editTarget), {
          name: form.name,
          employeeId: form.employeeId,
          phone: form.phone,
          updatedAt: new Date().toISOString(),
        });
        setSuccess("Staff account updated successfully.");
      } else {
        // Create Firebase Auth user under office auth instance then write to Firestore
        const cred = await createUserWithEmailAndPassword(officeAuth, form.email, form.password);
        await setDoc(doc(db, "users", cred.user.uid), {
          uid: cred.user.uid,
          email: form.email,
          name: form.name,
          employeeId: form.employeeId,
          phone: form.phone,
          role: "office_staff",
          active: true,
          createdAt: new Date().toISOString(),
        });
        setSuccess(`Office staff account created! Email: ${form.email}`);
      }
      await fetchStaff();
      if (!editTarget) { setShowModal(false); }
    } catch (err) {
      setError(err.message || "Failed to save. Please try again.");
    }
    setSaving(false);
  };

  const toggleActive = async (s) => {
    try {
      await updateDoc(doc(db, "users", s.uid), { active: !s.active });
      setStaff(prev => prev.map(x => x.uid === s.uid ? { ...x, active: !s.active } : x));
    } catch (e) { console.error(e); }
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content animate-fade-up">
        <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1>🏢 Office Staff</h1>
            <p>Create and manage office staff accounts who handle fee management</p>
          </div>
          <button className="btn btn-primary" onClick={openNew}>
            <FaPlus /> Add Office Staff
          </button>
        </div>

        {loading ? (
          <div className="loading-center"><div className="spinner" /></div>
        ) : (
          <div className="glass-card">
            {staff.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 24px", color: "var(--text-muted)" }}>
                <FaUserTie style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }} />
                <p style={{ fontSize: 16 }}>No office staff accounts yet.</p>
                <p style={{ fontSize: 13 }}>Click <strong>"Add Office Staff"</strong> to create the first account.</p>
              </div>
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Employee ID</th>
                      <th>Email</th>
                      <th>Phone</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staff.map(s => (
                      <tr key={s.uid}>
                        <td style={{ fontWeight: 600 }}>{s.name || "—"}</td>
                        <td><code style={{ fontSize: 12 }}>{s.employeeId || "—"}</code></td>
                        <td style={{ color: "var(--text-secondary)", fontSize: 13 }}>{s.email}</td>
                        <td style={{ color: "var(--text-secondary)", fontSize: 13 }}>{s.phone || "—"}</td>
                        <td>
                          <span className={`badge ${s.active !== false ? "badge-green" : "badge-red"}`}>
                            {s.active !== false ? "Active" : "Disabled"}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: 8 }}>
                            <button className="btn btn-secondary" style={{ padding: "6px 10px", fontSize: 12 }} onClick={() => openEdit(s)}>
                              <FaEdit /> Edit
                            </button>
                            <button
                              className={`btn ${s.active !== false ? "btn-danger" : "btn-primary"}`}
                              style={{ padding: "6px 10px", fontSize: 12 }}
                              onClick={() => toggleActive(s)}
                            >
                              {s.active !== false ? <><FaToggleOff /> Disable</> : <><FaToggleOn /> Enable</>}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Modal */}
        {showModal && (
          <div className="modal-overlay" onClick={() => setShowModal(false)}>
            <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: 500, width: "100%" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <h3 style={{ fontSize: 18, fontWeight: 700 }}>
                  {editTarget ? "Edit Office Staff" : "Add Office Staff"}
                </h3>
                <button style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-secondary)", fontSize: 20 }} onClick={() => setShowModal(false)}>
                  <FaTimes />
                </button>
              </div>

              {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}
              {success && <div className="alert alert-success" style={{ marginBottom: 16 }}>{success}</div>}

              <form onSubmit={handleSave}>
                <div className="form-group">
                  <label>Full Name</label>
                  <input className="form-control" placeholder="e.g. Priya Kumari" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
                </div>
                <div className="form-group">
                  <label>Employee ID</label>
                  <input className="form-control" placeholder="e.g. EMP-001" value={form.employeeId} onChange={e => setForm(f => ({ ...f, employeeId: e.target.value }))} />
                </div>
                {!editTarget && (
                  <div className="form-group">
                    <label>Email Address</label>
                    <input className="form-control" type="email" placeholder="office@school.edu" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
                  </div>
                )}
                <div className="form-group">
                  <label>Phone Number</label>
                  <input className="form-control" placeholder="e.g. 9876543210" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                </div>
                {!editTarget && (
                  <div className="form-group">
                    <label><FaKey style={{ marginRight: 6 }} />Initial Password</label>
                    <input className="form-control" type="password" placeholder="Min 6 characters" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required minLength={6} />
                    <small style={{ color: "var(--text-muted)", fontSize: 12 }}>Staff can change this after first login.</small>
                  </div>
                )}
                <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                  <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={saving}>
                    {saving ? <span className="spinner" /> : <><FaSave /> {editTarget ? "Save Changes" : "Create Account"}</>}
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
