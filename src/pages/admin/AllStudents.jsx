import { useState, useEffect } from "react";
import { collection, getDocs, query, where, doc, updateDoc, setDoc, getDoc } from "firebase/firestore";
import { sendPasswordResetEmail, getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { initializeApp } from "firebase/app";
import { db, adminAuth, firebaseConfig } from "../../firebase";
import Sidebar from "../../components/Sidebar";
import { FaKey, FaTimes, FaLink, FaUnlink, FaSearch, FaPlus, FaEye, FaEyeSlash } from "react-icons/fa";

export default function AllStudents() {
  const [students, setStudents]       = useState([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState("");
  const [deptFilter, setDeptFilter]   = useState("");
  const [yearFilter, setYearFilter]   = useState("");
  const [sectionFilter, setSectionFilter] = useState("");
  const [admissionYearFilter, setAdmissionYearFilter] = useState("");
  const ADMISSION_YEARS = [22, 23, 24, 25, 26, 27];

  // Per-row state helpers
  const [resetStatus, setResetStatus]   = useState({}); // { [uid]: "sending"|"sent"|"error" }
  const [revealedPwd, setRevealedPwd]   = useState({});
  const [linkPanel, setLinkPanel]       = useState(null); // student id with open link panel
  const [parentSearch, setParentSearch] = useState("");
  const [foundParents, setFoundParents] = useState([]);
  const [searching, setSearching]       = useState(false);
  const [linkMsg, setLinkMsg]           = useState({});

  // create-parent-inline form
  const [showCreateParent, setShowCreateParent] = useState(false);
  const [newParentForm, setNewParentForm] = useState({ name: "", email: "", password: "" });
  const [createMsg, setCreateMsg]         = useState("");
  const [creating, setCreating]           = useState(false);

  const fetchStudents = async () => {
    setLoading(true);
    const snap = await getDocs(query(collection(db, "users"), where("role", "==", "student")));
    setStudents(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    setLoading(false);
  };

  useEffect(() => { fetchStudents(); }, []);

  const depts    = [...new Set(students.map(s => s.dept).filter(Boolean))];
  const years    = [1, 2, 3, 4];
  const sections = ["A", "B", "C"];

  const filtered = students.filter(s =>
    (!search       || s.name?.toLowerCase().includes(search.toLowerCase()) || s.rollNo?.includes(search)) &&
    (!deptFilter   || s.dept === deptFilter) &&
    (!yearFilter   || s.year === Number(yearFilter)) &&
    (!sectionFilter || s.section === sectionFilter) &&
    (!admissionYearFilter || s.admissionYear === Number(admissionYearFilter))
  );

  // ── Password reset ──────────────────────────────────────────────
  const handleResetPassword = async (student) => {
    setResetStatus(p => ({ ...p, [student.id]: "sending" }));
    try {
      await sendPasswordResetEmail(adminAuth, student.email);
      setResetStatus(p => ({ ...p, [student.id]: "sent" }));
      setTimeout(() => setResetStatus(p => ({ ...p, [student.id]: null })), 4000);
    } catch {
      setResetStatus(p => ({ ...p, [student.id]: "error" }));
    }
  };

  const toggleReveal = (id) => setRevealedPwd(p => ({ ...p, [id]: !p[id] }));

  // ── Link parent ─────────────────────────────────────────────────
  const openLinkPanel = (student) => {
    setLinkPanel(student.id);
    setParentSearch(""); setFoundParents([]);
    setShowCreateParent(false); setCreateMsg(""); setNewParentForm({ name: "", email: "", password: "" });
    setLinkMsg(p => ({ ...p, [student.id]: "" }));
  };

  const searchParents = async () => {
    if (!parentSearch.trim()) return;
    setSearching(true); setFoundParents([]);
    const snap = await getDocs(query(collection(db, "users"), where("role", "==", "parent")));
    const results = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(p => p.email?.toLowerCase().includes(parentSearch.toLowerCase()) || p.name?.toLowerCase().includes(parentSearch.toLowerCase()));
    setFoundParents(results);
    setSearching(false);
  };

  const doLink = async (student, parent) => {
    try {
      await updateDoc(doc(db, "users", student.id), { parentUid: parent.id });
      await updateDoc(doc(db, "users", parent.id), { linkedStudentId: student.id });
      setLinkMsg(p => ({ ...p, [student.id]: `✓ Linked to ${parent.name || parent.email}` }));
      setLinkPanel(null);
      fetchStudents();
    } catch (err) {
      setLinkMsg(p => ({ ...p, [student.id]: "Error: " + err.message }));
    }
  };

  const doCreateAndLink = async (student) => {
    if (!newParentForm.email || !newParentForm.password) return;
    setCreating(true); setCreateMsg("");
    try {
      const appName      = `ParentCreate_${Date.now()}`;
      const secondaryApp  = initializeApp(firebaseConfig, appName);
      const secondaryAuth = getAuth(secondaryApp);
      const cred = await createUserWithEmailAndPassword(secondaryAuth, newParentForm.email, newParentForm.password);
      await setDoc(doc(db, "users", cred.user.uid), {
        name: newParentForm.name || `Parent of ${student.name}`,
        email: newParentForm.email,
        role: "parent",
        uid: cred.user.uid,
        linkedStudentId: student.id,
        initialPassword: newParentForm.password,
        createdAt: new Date().toISOString(),
      });
      await updateDoc(doc(db, "users", student.id), { parentUid: cred.user.uid });
      await secondaryAuth.signOut();
      setCreateMsg("✓ Parent account created and linked!");
      setLinkPanel(null);
      fetchStudents();
    } catch (err) {
      setCreateMsg("Error: " + err.message);
    } finally {
      setCreating(false);
    }
  };

  const doUnlink = async (student) => {
    if (!confirm(`Unlink parent from ${student.name}?`)) return;
    try {
      // Clear parentUid on student
      await updateDoc(doc(db, "users", student.id), { parentUid: null });
      // Clear linkedStudentId on parent
      if (student.parentUid) {
        const pSnap = await getDoc(doc(db, "users", student.parentUid));
        if (pSnap.exists()) await updateDoc(doc(db, "users", student.parentUid), { linkedStudentId: null });
      }
      fetchStudents();
    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content animate-fade-up">
        <div className="page-header">
          <h1>All Students</h1>
          <p>View, manage, and link parents to students across all departments</p>
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: 12, marginBottom: 8, flexWrap: "wrap" }}>
          <input className="form-control" style={{ maxWidth: 280 }} placeholder="Search by name or roll no..." value={search} onChange={e => setSearch(e.target.value)} />
          <select className="form-control" style={{ maxWidth: 180 }} value={deptFilter} onChange={e => setDeptFilter(e.target.value)}>
            <option value="">All Departments</option>
            {depts.map(d => <option key={d}>{d}</option>)}
          </select>
          <select className="form-control" style={{ maxWidth: 130 }} value={yearFilter} onChange={e => setYearFilter(e.target.value)}>
            <option value="">All Years</option>
            {years.map(y => <option key={y} value={y}>Year {y}</option>)}
          </select>
          <select className="form-control" style={{ maxWidth: 130 }} value={sectionFilter} onChange={e => setSectionFilter(e.target.value)}>
            <option value="">All Sections</option>
            {sections.map(s => <option key={s} value={s}>Section {s}</option>)}
          </select>
          <select className="form-control" style={{ maxWidth: 170 }} value={admissionYearFilter} onChange={e => setAdmissionYearFilter(e.target.value)}>
            <option value="">All Admission Years</option>
            {ADMISSION_YEARS.map(y => <option key={y} value={y}>Joined 20{y} (Batch {y})</option>)}
          </select>
        </div>
        {admissionYearFilter && (
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>
            📅 Showing students who joined in <strong>20{admissionYearFilter}</strong> · {filtered.length} result{filtered.length !== 1 ? "s" : ""}
          </div>
        )}

        {loading ? (
          <div className="loading-center"><div className="spinner" /></div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Name</th><th>Roll No</th><th>Class</th><th>Email</th>
                  <th>Password</th><th>Parent</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: "center", color: "var(--text-muted)", padding: "40px 0" }}>No students found.</td></tr>
                ) : filtered.map(s => (
                  <>
                    <tr key={s.id}>
                      <td style={{ fontWeight: 500 }}>{s.name || "—"}</td>
                      <td><span className="badge badge-blue">{s.rollNo || "—"}</span></td>
                      <td style={{ color: "var(--text-secondary)", fontSize: 13 }}>
                        <span className="badge badge-purple" style={{ marginRight: 4 }}>{s.dept}</span>
                        Yr {s.year} · Sec {s.section}
                      </td>
                      <td style={{ color: "var(--text-secondary)", fontSize: 13 }}>{s.email || "—"}</td>

                      {/* Password column */}
                      <td>
                        {s.initialPassword ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontFamily: "monospace", fontSize: 12 }}>
                              {revealedPwd[s.id] ? s.initialPassword : "••••••••"}
                            </span>
                            <button className="btn btn-secondary btn-sm" onClick={() => toggleReveal(s.id)}>
                              {revealedPwd[s.id] ? <FaEyeSlash /> : <FaEye />}
                            </button>
                          </div>
                        ) : (
                          <span style={{ color: "var(--text-muted)", fontSize: 12 }}>Not stored</span>
                        )}
                      </td>

                      {/* Parent column */}
                      <td>
                        {s.parentUid
                          ? <span className="badge badge-green">Linked ✓</span>
                          : <span className="badge badge-orange">Not Linked</span>}
                      </td>

                      {/* Actions */}
                      <td>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {/* Reset password */}
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleResetPassword(s)}
                            disabled={resetStatus[s.id] === "sending"}
                            title="Send password reset email"
                          >
                            {resetStatus[s.id] === "sending" ? <span className="spinner" style={{ width: 12, height: 12 }} /> : <FaKey />}
                            {resetStatus[s.id] === "sent" ? " Sent!" : resetStatus[s.id] === "error" ? " Failed" : " Reset"}
                          </button>

                          {/* Link/Unlink parent */}
                          {s.parentUid ? (
                            <button className="btn btn-danger btn-sm" onClick={() => doUnlink(s)} title="Unlink parent">
                              <FaUnlink /> Unlink
                            </button>
                          ) : (
                            <button className="btn btn-secondary btn-sm" onClick={() => openLinkPanel(s.id === linkPanel ? null : s)} title="Link a parent">
                              <FaLink /> Link Parent
                            </button>
                          )}
                        </div>
                        {linkMsg[s.id] && <div style={{ fontSize: 12, marginTop: 4, color: linkMsg[s.id].startsWith("✓") ? "var(--accent-green)" : "var(--accent-red)" }}>{linkMsg[s.id]}</div>}
                      </td>
                    </tr>

                    {/* Expandable link-parent panel */}
                    {linkPanel === s.id && (
                      <tr key={`${s.id}-link`}>
                        <td colSpan={7} style={{ padding: 0 }}>
                          <div style={{ background: "rgba(79,156,249,0.06)", border: "1px solid rgba(79,156,249,0.2)", borderRadius: 10, margin: "4px 8px 8px", padding: 20 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                              <h4 style={{ fontSize: 14, fontWeight: 600, color: "var(--accent-blue)" }}>
                                <FaLink style={{ marginRight: 8 }} />Link parent to <em>{s.name}</em>
                              </h4>
                              <button className="btn btn-secondary btn-sm" onClick={() => setLinkPanel(null)}><FaTimes /></button>
                            </div>

                            {/* Search existing parents */}
                            <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
                              <input className="form-control" placeholder="Search existing parent by name or email..." value={parentSearch} onChange={e => setParentSearch(e.target.value)} onKeyDown={e => e.key === "Enter" && searchParents()} />
                              <button className="btn btn-secondary" onClick={searchParents} disabled={searching}>
                                {searching ? <span className="spinner" style={{ width: 14, height: 14 }} /> : <FaSearch />} Search
                              </button>
                            </div>

                            {foundParents.length > 0 && (
                              <div style={{ marginBottom: 12 }}>
                                {foundParents.map(p => (
                                  <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "rgba(255,255,255,0.04)", borderRadius: 8, marginBottom: 6 }}>
                                    <div>
                                      <div style={{ fontWeight: 500, fontSize: 14 }}>{p.name || "—"}</div>
                                      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{p.email}</div>
                                    </div>
                                    <button className="btn btn-primary btn-sm" onClick={() => doLink(s, p)}>Link</button>
                                  </div>
                                ))}
                              </div>
                            )}
                            {foundParents.length === 0 && parentSearch && !searching && (
                              <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 12 }}>No existing parents found. Create a new account below.</p>
                            )}

                            {/* Create new parent */}
                            <button className="btn btn-secondary btn-sm" style={{ marginBottom: 12 }} onClick={() => setShowCreateParent(p => !p)}>
                              <FaPlus /> {showCreateParent ? "Hide" : "Create New Parent Account"}
                            </button>
                            {showCreateParent && (
                              <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: 16, border: "1px solid rgba(255,255,255,0.05)" }}>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
                                  <div className="form-group">
                                    <label style={{ fontSize: 12 }}>Parent Name</label>
                                    <input className="form-control" placeholder={`Parent of ${s.name}`} value={newParentForm.name} onChange={e => setNewParentForm(f => ({ ...f, name: e.target.value }))} />
                                  </div>
                                  <div className="form-group">
                                    <label style={{ fontSize: 12 }}>Email</label>
                                    <input className="form-control" type="email" placeholder="parent@email.com" value={newParentForm.email} onChange={e => setNewParentForm(f => ({ ...f, email: e.target.value }))} />
                                  </div>
                                  <div className="form-group">
                                    <label style={{ fontSize: 12 }}>Password</label>
                                    <input className="form-control" type="password" placeholder="Min 8 chars" value={newParentForm.password} onChange={e => setNewParentForm(f => ({ ...f, password: e.target.value }))} />
                                  </div>
                                </div>
                                {createMsg && <div style={{ fontSize: 13, marginBottom: 10, color: createMsg.startsWith("✓") ? "var(--accent-green)" : "var(--accent-red)" }}>{createMsg}</div>}
                                <button className="btn btn-primary btn-sm" onClick={() => doCreateAndLink(s)} disabled={creating}>
                                  {creating ? <span className="spinner" style={{ width: 12, height: 12 }} /> : <><FaPlus /> Create &amp; Link</>}
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
