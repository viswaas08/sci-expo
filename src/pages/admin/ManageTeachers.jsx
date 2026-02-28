import { useState, useEffect } from "react";
import { collection, getDocs, query, where, doc, setDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { db, adminAuth, firebaseConfig } from "../../firebase";
import { createUserWithEmailAndPassword, sendPasswordResetEmail, getAuth } from "firebase/auth";
import { initializeApp } from "firebase/app";
import Sidebar from "../../components/Sidebar";
import { FaPlus, FaEdit, FaTrash, FaSave, FaTimes, FaKey, FaEye, FaEyeSlash } from "react-icons/fa";

const DEPTS = ["ECE", "IT", "MECH", "EEE", "CSE", "AIDS"];
const YEARS = [1, 2, 3, 4];
const SECTIONS = ["A", "B", "C"];
const ROLES = ["Class Advisor", "HOD", "Subject Teacher", "Lab Assistant", "Mentor"];

export default function ManageTeachers() {
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  
  // New state arrays for adding multiple handled classes
  const [classDep, setClassDep] = useState("ECE");
  const [classYear, setClassYear] = useState(1);
  const [classSec, setClassSec] = useState("A");
  
  const [form, setForm] = useState({ name: "", email: "", password: "", dept: "ECE", year: 1, section: "A", assignedClasses: [], responsibilities: "" });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [resetStatus, setResetStatus] = useState({});
  const [revealedPwd, setRevealedPwd] = useState({});

  const fetchTeachers = async () => {
    const snap = await getDocs(query(collection(db, "users"), where("role", "==", "teacher")));
    setTeachers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    setLoading(false);
  };

  useEffect(() => {
    let isMounted = true;
    const loadTeachers = async () => {
      const snap = await getDocs(query(collection(db, "users"), where("role", "==", "teacher")));
      if (isMounted) {
        setTeachers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
      }
    };
    loadTeachers();
    return () => { isMounted = false; };
  }, []);

  const resetForm = () => { setForm({ name: "", email: "", password: "", dept: "ECE", year: 1, section: "A", assignedClasses: [], responsibilities: ROLES[0] }); setEditId(null); setShowForm(false); setError(""); };

  const handleSave = async (e) => {
    e.preventDefault();
    setError(""); setSuccess("");
    try {
      if (editId) {
        await updateDoc(doc(db, "users", editId), { name: form.name, dept: form.dept, year: form.year, section: form.section, assignedClasses: form.assignedClasses, responsibilities: form.responsibilities });
        setSuccess("Teacher updated successfully.");
      } else {
        const appName = `TeacherCreate_${Date.now()}`;
        const secondaryApp = initializeApp(firebaseConfig, appName);
        const secondaryAuth = getAuth(secondaryApp);
        try {
          const cred = await createUserWithEmailAndPassword(secondaryAuth, form.email, form.password);
          await setDoc(doc(db, "users", cred.user.uid), {
            name: form.name, email: form.email, role: "teacher",
            dept: form.dept, year: form.year, section: form.section,
            assignedClasses: form.assignedClasses, responsibilities: form.responsibilities,
            uid: cred.user.uid, initialPassword: form.password,
            createdAt: new Date().toISOString(),
          });
          setSuccess("Teacher account created successfully.");
        } finally {
          await secondaryAuth.signOut();
        }
      }
      resetForm();
      fetchTeachers();
    } catch (err) {
      setError(err.message || "Failed to save teacher.");
    }
  };

  const handleResetPassword = async (teacher) => {
    setResetStatus(p => ({ ...p, [teacher.id]: "sending" }));
    try {
      await sendPasswordResetEmail(adminAuth, teacher.email);
      setResetStatus(p => ({ ...p, [teacher.id]: "sent" }));
      setTimeout(() => setResetStatus(p => ({ ...p, [teacher.id]: null })), 4000);
    } catch {
      setResetStatus(p => ({ ...p, [teacher.id]: "error" }));
    }
  };

  const toggleReveal = (id) => setRevealedPwd(p => ({ ...p, [id]: !p[id] }));

  const handleEdit = (t) => {
    // Ensure assignedClasses is always an array when editing
    const classesArray = Array.isArray(t.assignedClasses) ? t.assignedClasses : 
                         (typeof t.assignedClasses === 'string' && t.assignedClasses.length > 0) ? t.assignedClasses.split(',').map(c => c.trim()) : [];
    
    setForm({ name: t.name, email: t.email, password: "", dept: t.dept || "ECE", year: t.year || 1, section: t.section || "A", assignedClasses: classesArray, responsibilities: t.responsibilities || ROLES[0] });
    setEditId(t.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this teacher?")) return;
    await deleteDoc(doc(db, "users", id));
    fetchTeachers();
  };

  const handleAddClass = () => {
      const clsString = `${classDep} year ${classYear} sec ${classSec}`.toLowerCase();
      if (!form.assignedClasses.includes(clsString)) {
          setForm(prev => ({ ...prev, assignedClasses: [...prev.assignedClasses, clsString] }));
      }
  };

  const handleRemoveClass = (clsString) => {
      setForm(prev => ({ ...prev, assignedClasses: prev.assignedClasses.filter(c => c !== clsString) }));
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content animate-fade-up">
        <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h1>Manage Teachers</h1>
            <p>Add, edit or remove teacher accounts and class assignments</p>
          </div>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}><FaPlus /> Add Teacher</button>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        {showForm && (
          <div className="glass-card" style={{ marginBottom: 24 }}>
            <h3 style={{ marginBottom: 20, fontSize: 16, fontWeight: 600 }}>{editId ? "Edit Teacher" : "Add New Teacher"}</h3>
            <form onSubmit={handleSave}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div className="form-group">
                  <label>Full Name</label>
                  <input className="form-control" placeholder="Teacher Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input className="form-control" type="email" placeholder="teacher@school.edu" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required={!editId} disabled={!!editId} />
                </div>
                {!editId && (
                  <div className="form-group">
                    <label>Password</label>
                    <input className="form-control" type="password" placeholder="Temporary password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required />
                  </div>
                )}
                <div className="form-group">
                  <label>Department</label>
                  <select className="form-control" value={form.dept} onChange={e => setForm({ ...form, dept: e.target.value })}>
                    {DEPTS.map(d => <option key={d}>{d}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Year</label>
                  <select className="form-control" value={form.year} onChange={e => setForm({ ...form, year: Number(e.target.value) })}>
                    {YEARS.map(y => <option key={y} value={y}>Year {y}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Section</label>
                  <select className="form-control" value={form.section} onChange={e => setForm({ ...form, section: e.target.value })}>
                    {SECTIONS.map(s => <option key={s}>Section {s}</option>)}
                  </select>
                </div>
              </div>
              
              {/* New Role & Classes fields spanning full width */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16, marginTop: 16, marginBottom: 16 }}>
                <div className="form-group" style={{ background: "rgba(255,255,255,0.03)", padding: 16, borderRadius: 8, border: "1px solid rgba(255,255,255,0.05)" }}>
                    <label>Viewable Classes (Assigned Students)</label>
                    <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 12 }}>Build the list of classes this teacher is allowed to view in 'Manage Students'.</p>
                    
                    <div style={{ display: "flex", gap: 12, alignItems: "flex-end", marginBottom: 16 }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ fontSize: 12 }}>Department</label>
                            <select className="form-control" value={classDep} onChange={e => setClassDep(e.target.value)}>
                                {DEPTS.map(d => <option key={d}>{d}</option>)}
                            </select>
                        </div>
                        <div style={{ flex: 1 }}>
                            <label style={{ fontSize: 12 }}>Year</label>
                            <select className="form-control" value={classYear} onChange={e => setClassYear(Number(e.target.value))}>
                                {YEARS.map(y => <option key={y} value={y}>Year {y}</option>)}
                            </select>
                        </div>
                        <div style={{ flex: 1 }}>
                            <label style={{ fontSize: 12 }}>Section</label>
                            <select className="form-control" value={classSec} onChange={e => setClassSec(e.target.value)}>
                                {SECTIONS.map(s => <option key={s}>Sec {s}</option>)}
                            </select>
                        </div>
                        <button type="button" className="btn btn-secondary" onClick={handleAddClass} style={{ padding: "10px 16px" }}><FaPlus /> Add</button>
                    </div>

                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {form.assignedClasses.length === 0 ? (
                            <span style={{ fontSize: 13, color: "var(--text-muted)", fontStyle: "italic" }}>No specific classes assigned. Teacher will view overall database.</span>
                        ) : (
                            form.assignedClasses.map(cls => (
                                <div key={cls} className="badge badge-blue" style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px" }}>
                                    <span style={{ textTransform: "capitalize" }}>{cls}</span>
                                    <FaTimes style={{ cursor: "pointer", opacity: 0.7 }} onClick={() => handleRemoveClass(cls)} />
                                </div>
                            ))
                        )}
                    </div>
                </div>
                <div className="form-group">
                    <label>Responsibilities / Role</label>
                    <select className="form-control" value={form.responsibilities || ROLES[0]} onChange={e => setForm({ ...form, responsibilities: e.target.value })}>
                      {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                </div>
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <button className="btn btn-primary" type="submit"><FaSave /> Save</button>
                <button className="btn btn-secondary" type="button" onClick={resetForm}><FaTimes /> Cancel</button>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <div className="loading-center"><div className="spinner" /></div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Name</th><th>Email</th><th>Details</th><th>Classes & Role</th><th>Password</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {teachers.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--text-muted)", padding: "40px 0" }}>No teachers yet. Add one above.</td></tr>
                ) : teachers.map(t => (
                  <tr key={t.id}>
                    <td style={{ fontWeight: 500 }}>{t.name || "—"}</td>
                    <td style={{ color: "var(--text-secondary)" }}>{t.email}</td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span className="badge badge-purple" style={{ width: 'fit-content' }}>{t.dept || "—"}</span>
                        <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>Yr {t.year || "—"} • Sec {t.section || "—"}</span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={{ fontSize: 13 }}><strong style={{ color: "var(--text-color)" }}>Role:</strong> <span style={{ color: "var(--text-secondary)" }}>{t.responsibilities || "—"}</span></div>
                        <div style={{ fontSize: 13 }}>
                          <strong style={{ color: "var(--text-color)" }}>Classes:</strong> 
                          <span style={{ color: "var(--text-secondary)" }}>
                            {Array.isArray(t.assignedClasses) && t.assignedClasses.length > 0 
                                ? t.assignedClasses.map(c => c.replace(/\b\w/g, l => l.toUpperCase())).join(', ') 
                                : (typeof t.assignedClasses === 'string' && t.assignedClasses ? t.assignedClasses : "—")}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td>
                      {t.initialPassword ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontFamily: "monospace", fontSize: 12 }}>
                            {revealedPwd[t.id] ? t.initialPassword : "••••••••"}
                          </span>
                          <button className="btn btn-secondary btn-sm" onClick={() => toggleReveal(t.id)}>
                            {revealedPwd[t.id] ? <FaEyeSlash /> : <FaEye />}
                          </button>
                        </div>
                      ) : <span style={{ color: "var(--text-muted)", fontSize: 12 }}>Not stored</span>}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => handleEdit(t)} title="Edit"><FaEdit /></button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(t.id)} title="Delete"><FaTrash /></button>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleResetPassword(t)}
                          disabled={resetStatus[t.id] === "sending"}
                          title="Send password reset email"
                        >
                          {resetStatus[t.id] === "sending" ? <span className="spinner" style={{ width: 12, height: 12 }} /> : <FaKey />}
                          {resetStatus[t.id] === "sent" ? " Sent!" : resetStatus[t.id] === "error" ? " Failed" : " Reset"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
