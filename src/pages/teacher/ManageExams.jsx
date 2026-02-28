import { useState, useEffect } from "react";
import { collection, getDocs, doc, deleteDoc, updateDoc, query, where, setDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { useAuth } from "../../context/AuthContext";
import Sidebar from "../../components/Sidebar";
import { FaPlus, FaEdit, FaTrash, FaSave, FaTimes, FaBook } from "react-icons/fa";

// Subject list per department — matches seed data
const DEPT_SUBJECTS = {
  ECE:  ["Electronics Circuits", "Digital Electronics", "Signals & Systems", "Microprocessors", "Communication Systems"],
  IT:   ["Web Technologies", "Database Systems", "Operating Systems", "Computer Networks", "Software Engineering"],
  MECH: ["Engineering Mechanics", "Thermodynamics", "Fluid Mechanics", "Manufacturing Technology", "Machine Design"],
  EEE:  ["Circuit Theory", "Power Systems", "Control Systems", "Electrical Machines", "Power Electronics"],
  CSE:  ["Data Structures", "Algorithms", "DBMS", "Operating Systems", "Computer Networks"],
  AIDS: ["Machine Learning", "Data Mining", "Statistical Methods", "Big Data Analytics", "Neural Networks"],
};

export default function ManageExams() {
  const { currentUser, userData } = useAuth();

  // Exam list state
  const [exams, setExams]             = useState([]);
  const [loadingExams, setLoadingExams] = useState(true);
  const [showForm, setShowForm]       = useState(false);
  const [editId, setEditId]           = useState(null);
  const [form, setForm]               = useState({ name: "", subject: "", date: "", maxMarks: 100 });
  const [examError, setExamError]     = useState("");
  const [examSuccess, setExamSuccess] = useState("");

  // Selected exam + students + marks
  const [selectedExam, setSelectedExam]   = useState(null);
  const [selectedSubject, setSelectedSubject] = useState(""); // subject filter in marks panel
  const [students, setStudents]           = useState([]);
  const [marksMap, setMarksMap]           = useState({}); // { studentId: marksObtained }
  const [draftMarks, setDraftMarks]       = useState({}); // local edits before save
  const [saving, setSaving]               = useState(false);
  const [saveMsg, setSaveMsg]             = useState("");

  const deptSubjects = DEPT_SUBJECTS[userData?.dept] || [];

  // ── Fetch exams ──────────────────────────────────────────────────────────────
  const fetchExams = async () => {
    if (!currentUser) return;
    setLoadingExams(true);
    try {
      const snap = await getDocs(
        query(collection(db, "exams"), where("teacherId", "==", currentUser.uid))
      );
      setExams(
        snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(e => e.name) // teacher-created exams have a name; seed mark-docs don't
          .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
      );
    } catch (err) {
      console.error("fetchExams:", err);
    } finally {
      setLoadingExams(false);
    }
  };

  // ── Fetch students in teacher's class ────────────────────────────────────────
  const fetchStudents = async () => {
    if (!userData) return;
    try {
      const snap = await getDocs(
        query(
          collection(db, "users"),
          where("role", "==", "student"),
          where("dept", "==", userData.dept),
          where("year", "==", userData.year),
          where("section", "==", userData.section)
        )
      );
      setStudents(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error("fetchStudents:", err);
    }
  };

  // ── Fetch marks for selected exam + subject ───────────────────────────────────
  const fetchMarks = async (examId, subject) => {
    try {
      const snap = await getDocs(
        query(
          collection(db, "marks"),
          where("examId", "==", examId),
          where("subject", "==", subject)
        )
      );
      const map = {};
      snap.forEach(d => { map[d.data().studentId] = { docId: d.id, value: d.data().marksObtained }; });
      setMarksMap(map);
      // Pre-fill draft with saved values
      const draft = {};
      snap.forEach(d => { draft[d.data().studentId] = d.data().marksObtained; });
      setDraftMarks(draft);
    } catch (err) {
      console.error("fetchMarks:", err);
    }
  };

  useEffect(() => { fetchExams(); fetchStudents(); }, [currentUser, userData]);

  // Re-fetch marks when subject changes
  useEffect(() => {
    if (selectedExam && selectedSubject) {
      fetchMarks(selectedExam.id, selectedSubject);
    }
  }, [selectedSubject, selectedExam]);

  // ── Create / edit exam ───────────────────────────────────────────────────────
  const handleSaveExam = async (e) => {
    e.preventDefault();
    setExamError(""); setExamSuccess("");
    try {
      if (editId) {
        await updateDoc(doc(db, "exams", editId), { ...form, maxMarks: Number(form.maxMarks) });
      } else {
        const newId = `exam_${currentUser.uid}_${Date.now()}`;
        await setDoc(doc(db, "exams", newId), {
          ...form,
          maxMarks: Number(form.maxMarks),
          teacherId: currentUser.uid,
          dept: userData.dept,
          year: userData.year,
          section: userData.section,
          createdAt: new Date().toISOString(),
        });
      }
      setExamSuccess("Exam saved.");
      setShowForm(false); setEditId(null);
      setForm({ name: "", subject: "", date: "", maxMarks: 100 });
      fetchExams();
    } catch (err) {
      setExamError(err.message);
    }
  };

  // ── Select exam ──────────────────────────────────────────────────────────────
  const handleSelectExam = (exam) => {
    setSelectedExam(exam);
    setSelectedSubject(""); // reset subject so teacher picks one
    setMarksMap({});
    setDraftMarks({});
    setSaveMsg("");
  };

  // ── Save all marks for current exam + subject ────────────────────────────────
  const handleSaveAllMarks = async () => {
    if (!selectedExam || !selectedSubject) return;
    setSaving(true); setSaveMsg("");
    try {
      const promises = students.map(async (s) => {
        const val = draftMarks[s.id];
        if (val === undefined || val === "") return;
        const docId = `${selectedExam.id}_${selectedSubject.replace(/[\s&]+/g, "_").toLowerCase()}_${s.id}`;
        await setDoc(doc(db, "marks", docId), {
          studentId: s.id,
          studentName: s.name,
          rollNo: s.rollNo,
          examId: selectedExam.id,
          examName: selectedExam.name,
          subject: selectedSubject,
          dept: userData.dept,
          year: userData.year,
          section: userData.section,
          marksObtained: Number(val),
          maxMarks: Number(selectedExam.maxMarks),
          createdAt: new Date().toISOString(),
        }, { merge: true });
      });
      await Promise.all(promises);
      setSaveMsg("✓ Marks saved!");
      await fetchMarks(selectedExam.id, selectedSubject);
    } catch (err) {
      setSaveMsg("Error: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteExam = async (id) => {
    if (!confirm("Delete this exam?")) return;
    await deleteDoc(doc(db, "exams", id));
    if (selectedExam?.id === id) { setSelectedExam(null); setSelectedSubject(""); }
    fetchExams();
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content animate-fade-up">
        <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h1>Exams & Marks</h1>
            <p>Create exams and enter marks per subject for your class</p>
          </div>
          <button className="btn btn-primary" onClick={() => { setShowForm(true); setEditId(null); setForm({ name: "", subject: "", date: "", maxMarks: 100 }); }}>
            <FaPlus /> Add Exam
          </button>
        </div>

        {examError   && <div className="alert alert-error">{examError}</div>}
        {examSuccess && <div className="alert alert-success">{examSuccess}</div>}

        {/* ── Add/Edit Exam Form ── */}
        {showForm && (
          <div className="glass-card" style={{ marginBottom: 24 }}>
            <h3 style={{ marginBottom: 16, fontSize: 15, fontWeight: 600 }}>{editId ? "Edit Exam" : "Add Exam"}</h3>
            <form onSubmit={handleSaveExam}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 14 }}>
                <div className="form-group">
                  <label>Exam Name</label>
                  <input className="form-control" placeholder="Mid-Sem I" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Date</label>
                  <input className="form-control" type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Max Marks (per subject)</label>
                  <input className="form-control" type="number" min={1} value={form.maxMarks} onChange={e => setForm({ ...form, maxMarks: e.target.value })} required />
                </div>
              </div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12 }}>
                <FaBook style={{ marginRight: 6 }} />
                Subjects for <strong>{userData?.dept}</strong>: {deptSubjects.join(", ")}
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <button className="btn btn-primary" type="submit"><FaSave /> Save Exam</button>
                <button className="btn btn-secondary" type="button" onClick={() => { setShowForm(false); setEditId(null); }}><FaTimes /> Cancel</button>
              </div>
            </form>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: selectedExam ? "1fr 1.6fr" : "1fr", gap: 24 }}>

          {/* ── Exam List ── */}
          <div>
            <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: "var(--text-muted)", letterSpacing: 1 }}>
              SELECT AN EXAM
            </h3>
            {loadingExams ? (
              <div className="loading-center"><div className="spinner" /></div>
            ) : exams.length === 0 ? (
              <div className="glass-card" style={{ textAlign: "center", color: "var(--text-muted)", padding: 40 }}>
                <FaBook style={{ fontSize: 28, marginBottom: 12, opacity: 0.4 }} />
                <p>No exams yet. Click "Add Exam" to create one.</p>
              </div>
            ) : exams.map(exam => (
              <div
                key={exam.id}
                className="glass-card"
                style={{
                  cursor: "pointer", marginBottom: 10, padding: 16,
                  borderColor: selectedExam?.id === exam.id ? "var(--accent-blue)" : "var(--border)",
                  background: selectedExam?.id === exam.id ? "rgba(79,156,249,0.08)" : "var(--bg-card)",
                }}
                onClick={() => handleSelectExam(exam)}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>{exam.name}</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>
                      {exam.date} · Max {exam.maxMarks} per subject
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button className="btn btn-secondary btn-sm" onClick={ev => {
                      ev.stopPropagation();
                      setForm({ name: exam.name, subject: exam.subject || "", date: exam.date, maxMarks: exam.maxMarks });
                      setEditId(exam.id); setShowForm(true);
                    }}><FaEdit /></button>
                    <button className="btn btn-danger btn-sm" onClick={ev => { ev.stopPropagation(); handleDeleteExam(exam.id); }}><FaTrash /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* ── Marks Entry Panel ── */}
          {selectedExam && (
            <div>
              <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: "var(--text-muted)", letterSpacing: 1 }}>
                MARKS — {selectedExam.name.toUpperCase()}
              </h3>

              {/* Subject selector */}
              <div className="glass-card" style={{ marginBottom: 16, padding: 16 }}>
                <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, display: "block" }}>
                  <FaBook style={{ marginRight: 6 }} /> Select Subject to Enter Marks
                </label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {deptSubjects.map(subj => (
                    <button
                      key={subj}
                      className={`btn btn-sm ${selectedSubject === subj ? "btn-primary" : "btn-secondary"}`}
                      onClick={() => setSelectedSubject(subj)}
                    >
                      {subj}
                    </button>
                  ))}
                </div>
              </div>

              {!selectedSubject ? (
                <div style={{ textAlign: "center", color: "var(--text-muted)", padding: 40, fontSize: 14 }}>
                  ☝️ Select a subject above to enter marks
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <span style={{ fontSize: 13, color: "var(--accent-blue)", fontWeight: 600 }}>
                      Subject: {selectedSubject} · Max: {selectedExam.maxMarks}
                    </span>
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      {saveMsg && <span style={{ fontSize: 13, color: saveMsg.startsWith("✓") ? "var(--accent-green)" : "var(--accent-red)" }}>{saveMsg}</span>}
                      <button className="btn btn-primary btn-sm" onClick={handleSaveAllMarks} disabled={saving}>
                        {saving ? <span className="spinner" style={{ width: 12, height: 12 }} /> : <FaSave />} Save All Marks
                      </button>
                    </div>
                  </div>

                  <div className="table-wrapper">
                    <table>
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Roll No</th>
                          <th>Marks (/{selectedExam.maxMarks})</th>
                          <th>Saved</th>
                        </tr>
                      </thead>
                      <tbody>
                        {students.length === 0 ? (
                          <tr><td colSpan={4} style={{ textAlign: "center", color: "var(--text-muted)", padding: "30px 0" }}>No students found in your class.</td></tr>
                        ) : students.map(s => (
                          <tr key={s.id}>
                            <td style={{ fontWeight: 500 }}>{s.name}</td>
                            <td><span className="badge badge-blue">{s.rollNo}</span></td>
                            <td>
                              <input
                                className="form-control"
                                type="number"
                                min={0}
                                max={selectedExam.maxMarks}
                                value={draftMarks[s.id] ?? ""}
                                onChange={e => setDraftMarks(p => ({ ...p, [s.id]: e.target.value }))}
                                style={{ width: 90 }}
                                placeholder="—"
                              />
                            </td>
                            <td>
                              {marksMap[s.id] !== undefined
                                ? <span className="badge badge-green">✓ {marksMap[s.id].value}</span>
                                : <span style={{ color: "var(--text-muted)", fontSize: 12 }}>Not saved</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
