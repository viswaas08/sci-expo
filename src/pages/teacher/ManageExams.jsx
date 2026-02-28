import { useState, useEffect } from "react";
import { collection, getDocs, doc, deleteDoc, updateDoc, query, where, addDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { useAuth } from "../../context/AuthContext";
import Sidebar from "../../components/Sidebar";
import { FaPlus, FaEdit, FaTrash, FaSave, FaTimes } from "react-icons/fa";

export default function ManageExams() {
  const { currentUser, userData } = useAuth();
  const [exams, setExams] = useState([]);
  const [students, setStudents] = useState([]);
  const [marksMap, setMarksMap] = useState({});
  const [selectedExam, setSelectedExam] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", subject: "", date: "", maxMarks: 100 });
  const [editId, setEditId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(""); const [success, setSuccess] = useState("");

  const fetchExams = async () => {
    if (!currentUser) return;
    const snap = await getDocs(query(collection(db, "exams"), where("teacherId", "==", currentUser.uid)));
    setExams(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => b.date?.localeCompare(a.date)));
    setLoading(false);
  };

  const fetchStudents = async () => {
    if (!userData) return;
    const snap = await getDocs(query(collection(db, "users"), where("role", "==", "student"),
      where("dept", "==", userData.dept), where("year", "==", userData.year), where("section", "==", userData.section)
    ));
    setStudents(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  const fetchMarks = async (examId) => {
    const snap = await getDocs(query(collection(db, "marks"), where("examId", "==", examId)));
    const map = {};
    snap.forEach(d => { map[d.data().studentId] = { id: d.id, ...d.data() }; });
    setMarksMap(map);
  };

  useEffect(() => { fetchExams(); fetchStudents(); }, [currentUser, userData]);

  const handleSaveExam = async (e) => {
    e.preventDefault(); setError(""); setSuccess("");
    try {
      if (editId) {
        await updateDoc(doc(db, "exams", editId), { ...form, maxMarks: Number(form.maxMarks) });
      } else {
        await addDoc(collection(db, "exams"), {
          ...form, maxMarks: Number(form.maxMarks), teacherId: currentUser.uid,
          dept: userData.dept, year: userData.year, section: userData.section,
          createdAt: new Date().toISOString(),
        });
      }
      setSuccess("Exam saved."); setShowForm(false); setEditId(null);
      setForm({ name: "", subject: "", date: "", maxMarks: 100 });
      fetchExams();
    } catch (err) { setError(err.message); }
  };

  const handleSelectExam = async (exam) => {
    setSelectedExam(exam);
    await fetchMarks(exam.id);
  };

  const handleSaveMark = async (studentId, obtainedMarks) => {
    if (obtainedMarks === "" || isNaN(obtainedMarks)) return;
    setSaving(true);
    try {
      if (marksMap[studentId]) {
        await updateDoc(doc(db, "marks", marksMap[studentId].id), { marksObtained: Number(obtainedMarks) });
      } else {
        await addDoc(collection(db, "marks"), {
          studentId, examId: selectedExam.id, marksObtained: Number(obtainedMarks),
          dept: userData.dept, year: userData.year, section: userData.section,
          createdAt: new Date().toISOString(),
        });
      }
      await fetchMarks(selectedExam.id);
    } finally { setSaving(false); }
  };

  const handleDeleteExam = async (id) => {
    if (!confirm("Delete this exam?")) return;
    await deleteDoc(doc(db, "exams", id));
    if (selectedExam?.id === id) setSelectedExam(null);
    fetchExams();
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content animate-fade-up">
        <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div><h1>Exams & Marks</h1><p>Create exams and enter student marks</p></div>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}><FaPlus /> Add Exam</button>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        {showForm && (
          <div className="glass-card" style={{ marginBottom: 24 }}>
            <h3 style={{ marginBottom: 16, fontSize: 15, fontWeight: 600 }}>{editId ? "Edit Exam" : "Add Exam"}</h3>
            <form onSubmit={handleSaveExam}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 14 }}>
                <div className="form-group"><label>Exam Name</label><input className="form-control" placeholder="Mid-Sem I" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required /></div>
                <div className="form-group"><label>Subject</label><input className="form-control" placeholder="Mathematics" value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} required /></div>
                <div className="form-group"><label>Date</label><input className="form-control" type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} required /></div>
                <div className="form-group"><label>Max Marks</label><input className="form-control" type="number" min={1} value={form.maxMarks} onChange={e => setForm({ ...form, maxMarks: e.target.value })} required /></div>
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <button className="btn btn-primary" type="submit"><FaSave /> Save Exam</button>
                <button className="btn btn-secondary" type="button" onClick={() => { setShowForm(false); setEditId(null); }}><FaTimes /> Cancel</button>
              </div>
            </form>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: selectedExam ? "1fr 1.5fr" : "1fr", gap: 24 }}>
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: "var(--text-secondary)" }}>SELECT AN EXAM TO ENTER MARKS</h3>
            {loading ? <div className="loading-center"><div className="spinner" /></div> : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {exams.length === 0 ? <p style={{ color: "var(--text-muted)", fontSize: 14 }}>No exams yet.</p> :
                  exams.map(e => (
                    <div key={e.id} className="glass-card" style={{ cursor: "pointer", borderColor: selectedExam?.id === e.id ? "var(--accent-blue)" : "var(--border)", background: selectedExam?.id === e.id ? "rgba(79,156,249,0.08)" : "var(--bg-card)", padding: 16 }} onClick={() => handleSelectExam(e)}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 15 }}>{e.name}</div>
                          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{e.subject} · {e.date} · Max: {e.maxMarks}</div>
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button className="btn btn-secondary btn-sm" onClick={ev => { ev.stopPropagation(); setForm({ name: e.name, subject: e.subject, date: e.date, maxMarks: e.maxMarks }); setEditId(e.id); setShowForm(true); }}><FaEdit /></button>
                          <button className="btn btn-danger btn-sm" onClick={ev => { ev.stopPropagation(); handleDeleteExam(e.id); }}><FaTrash /></button>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {selectedExam && (
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: "var(--text-secondary)" }}>MARKS — {selectedExam.name.toUpperCase()} (Max: {selectedExam.maxMarks})</h3>
              <div className="table-wrapper">
                <table>
                  <thead><tr><th>Name</th><th>Roll No</th><th>Marks Obtained</th><th>Action</th></tr></thead>
                  <tbody>
                    {students.map(s => {
                      const existing = marksMap[s.id];
                      let markVal = existing ? existing.marksObtained : "";
                      return (
                        <tr key={s.id}>
                          <td style={{ fontWeight: 500 }}>{s.name}</td>
                          <td><span className="badge badge-blue">{s.rollNo}</span></td>
                          <td>
                            <input
                              id={`mark-${s.id}`}
                              className="form-control"
                              type="number" min={0} max={selectedExam.maxMarks}
                              defaultValue={markVal}
                              style={{ width: 90 }}
                            />
                          </td>
                          <td>
                            <button className="btn btn-success btn-sm" disabled={saving} onClick={() => {
                              const val = document.getElementById(`mark-${s.id}`)?.value;
                              handleSaveMark(s.id, val);
                            }}>
                              {saving ? "..." : <FaSave />}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
