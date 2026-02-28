import { useState, useEffect } from "react";
import { collection, addDoc, getDocs, query, where, doc, updateDoc, deleteDoc, setDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { useAuth } from "../../context/AuthContext";
import Sidebar from "../../components/Sidebar";
import { FaPlus, FaTrash, FaCheck, FaTimes, FaClipboardList } from "react-icons/fa";

export default function Assignments() {
  const { currentUser, userData, userRole } = useAuth();
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", subject: "", dueDate: "", description: "" });
  const isTeacher = userRole === "teacher";
  const isStudent = userRole === "student";

  const fetchAssignments = async () => {
    setLoading(true);
    try {
      const q = isTeacher
        ? query(collection(db, "assignments"), where("teacherId", "==", currentUser.uid))
        : query(collection(db, "assignments"), where("dept", "==", userData.dept), where("year", "==", userData.year), where("section", "==", userData.section));
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || ""));
      setAssignments(list);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (userData) fetchAssignments(); }, [userData]);

  const handleCreate = async (e) => {
    e.preventDefault();
    await addDoc(collection(db, "assignments"), {
      ...form,
      teacherId: currentUser.uid,
      teacherName: userData.name,
      dept: userData.dept, year: userData.year, section: userData.section,
      createdAt: new Date().toISOString(),
    });
    setForm({ title: "", subject: "", dueDate: "", description: "" });
    setShowForm(false);
    fetchAssignments();
  };

  const toggleSubmit = async (assignment) => {
    const subKey = `assignments_status_${assignment.id}_${currentUser.uid}`;
    const existing = assignment.submissions?.[currentUser.uid];
    await updateDoc(doc(db, "assignments", assignment.id), {
      [`submissions.${currentUser.uid}`]: existing ? null : { submittedAt: new Date().toISOString(), name: userData.name },
    });
    fetchAssignments();
  };

  const isPast = (d) => d && new Date(d) < new Date();

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content animate-fade-up">
        <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div><h1>📋 Assignments</h1><p>{isTeacher ? "Manage assignments for your class" : "Your pending and completed assignments"}</p></div>
          {isTeacher && (
            <button className="btn btn-primary" onClick={() => setShowForm(s => !s)}><FaPlus /> Create Assignment</button>
          )}
        </div>

        {showForm && (
          <div className="glass-card" style={{ marginBottom: 24 }}>
            <form onSubmit={handleCreate}>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 14, marginBottom: 14 }}>
                <div className="form-group"><label>Title</label><input className="form-control" placeholder="Assignment title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required /></div>
                <div className="form-group"><label>Subject</label><input className="form-control" placeholder="Subject" value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} required /></div>
                <div className="form-group"><label>Due Date</label><input className="form-control" type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} required /></div>
              </div>
              <div className="form-group"><label>Description</label><textarea className="form-control" rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} style={{ resize: "vertical" }} /></div>
              <button className="btn btn-primary" type="submit"><FaPlus /> Create</button>
            </form>
          </div>
        )}

        {loading ? <div className="loading-center"><div className="spinner" /></div> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {assignments.length === 0 ? (
              <div className="glass-card" style={{ textAlign: "center", padding: 60, color: "var(--text-muted)" }}><FaClipboardList style={{ fontSize: 36, opacity: 0.3, marginBottom: 12 }} /><p>No assignments yet.</p></div>
            ) : assignments.map(a => {
              const submitted = isStudent && a.submissions?.[currentUser.uid];
              const submittedCount = Object.values(a.submissions || {}).filter(Boolean).length;
              return (
                <div key={a.id} className="glass-card" style={{ borderLeft: `4px solid ${isPast(a.dueDate) && !submitted ? "var(--accent-red)" : "var(--accent-blue)"}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 6 }}>
                        <h3 style={{ fontSize: 15, fontWeight: 700 }}>{a.title}</h3>
                        <span className="badge badge-blue" style={{ fontSize: 11 }}>{a.subject}</span>
                        {isPast(a.dueDate) ? <span className="badge badge-red" style={{ fontSize: 11 }}>Overdue</span> : <span className="badge badge-green" style={{ fontSize: 11 }}>Open</span>}
                        {submitted && <span className="badge badge-green" style={{ fontSize: 11 }}>✓ Submitted</span>}
                      </div>
                      {a.description && <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 6 }}>{a.description}</p>}
                      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                        Due: {a.dueDate} · By {a.teacherName}
                        {isTeacher && <span style={{ marginLeft: 12, color: "var(--accent-green)" }}>{submittedCount} submitted</span>}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8, marginLeft: 16 }}>
                      {isStudent && (
                        <button className={`btn btn-sm ${submitted ? "btn-danger" : "btn-success"}`} onClick={() => toggleSubmit(a)}>
                          {submitted ? <><FaTimes /> Unmark</> : <><FaCheck /> Mark Done</>}
                        </button>
                      )}
                      {isTeacher && (
                        <button className="btn btn-danger btn-sm" onClick={async () => { if(confirm("Delete?")) { await deleteDoc(doc(db,"assignments",a.id)); fetchAssignments(); } }}><FaTrash /></button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
