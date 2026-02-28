import { useState, useEffect } from "react";
import { collection, getDocs, query, where, addDoc, updateDoc, doc, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase";
import { useAuth } from "../../context/AuthContext";
import Sidebar from "../../components/Sidebar";
import { FaSave, FaCalendarAlt } from "react-icons/fa";

const today = () => new Date().toISOString().slice(0, 10);

export default function MarkAttendance() {
  const { currentUser, userData } = useAuth();
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState({}); // { studentId: { id, status } }
  const [date, setDate] = useState(today());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!userData) return;
    const fetchStudents = async () => {
      const snap = await getDocs(query(collection(db, "users"), where("role", "==", "student"),
        where("dept", "==", userData.dept), where("year", "==", userData.year), where("section", "==", userData.section)
      ));
      setStudents(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    };
    fetchStudents();
  }, [userData]);

  // Real-time listener for attendance on selected date
  useEffect(() => {
    if (!currentUser || !date) return;
    const q = query(collection(db, "attendance"),
      where("teacherId", "==", currentUser.uid), where("date", "==", date)
    );
    const unsub = onSnapshot(q, (snap) => {
      const map = {};
      snap.forEach(d => { map[d.data().studentId] = { id: d.id, ...d.data() }; });
      setAttendance(map);
    });
    return unsub;
  }, [currentUser, date]);

  const toggleStatus = (studentId) => {
    setAttendance(prev => {
      const existing = prev[studentId];
      return { ...prev, [studentId]: { ...existing, status: existing?.status === "present" ? "absent" : "present" } };
    });
  };

  const handleMarkAll = (status) => {
    const map = {};
    students.forEach(s => { map[s.id] = { ...attendance[s.id], status }; });
    setAttendance(map);
  };

  const handleSave = async () => {
    setSaving(true); setSuccess("");
    try {
      await Promise.all(students.map(async (s) => {
        const status = attendance[s.id]?.status || "absent";
        const existing = attendance[s.id];
        if (existing?.id) {
          await updateDoc(doc(db, "attendance", existing.id), { status });
        } else {
          await addDoc(collection(db, "attendance"), {
            studentId: s.id, date, status, teacherId: currentUser.uid,
            dept: userData.dept, year: userData.year, section: userData.section,
            createdAt: new Date().toISOString(),
          });
        }
      }));
      setSuccess("Attendance saved successfully!");
      setTimeout(() => setSuccess(""), 3000);
    } finally { setSaving(false); }
  };

  const presentCount = students.filter(s => attendance[s.id]?.status === "present").length;
  const absentCount = students.length - presentCount;

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content animate-fade-up">
        <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h1>Mark Attendance</h1>
            <p>{userData?.dept} · Year {userData?.year} · Section {userData?.section}</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <input className="form-control" type="date" value={date} onChange={e => setDate(e.target.value)} style={{ width: 180 }} />
          </div>
        </div>

        {success && <div className="alert alert-success">{success}</div>}

        <div style={{ display: "flex", gap: 16, marginBottom: 20, alignItems: "center" }}>
          <span className="badge badge-green" style={{ fontSize: 14, padding: "6px 14px" }}>Present: {presentCount}</span>
          <span className="badge badge-red" style={{ fontSize: 14, padding: "6px 14px" }}>Absent: {absentCount}</span>
          <button className="btn btn-success btn-sm" onClick={() => handleMarkAll("present")}>Mark All Present</button>
          <button className="btn btn-danger btn-sm" onClick={() => handleMarkAll("absent")}>Mark All Absent</button>
          <button className="btn btn-primary" style={{ marginLeft: "auto" }} onClick={handleSave} disabled={saving}>
            {saving ? <span className="spinner" /> : <><FaSave /> Save Attendance</>}
          </button>
        </div>

        {loading ? <div className="loading-center"><div className="spinner" /></div> : (
          <div className="table-wrapper">
            <table>
              <thead><tr><th>#</th><th>Roll No</th><th>Name</th><th>Status</th><th>Toggle</th></tr></thead>
              <tbody>
                {students.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--text-muted)", padding: "40px 0" }}>No students in this class.</td></tr>
                ) : students.map((s, i) => {
                  const status = attendance[s.id]?.status || "absent";
                  return (
                    <tr key={s.id}>
                      <td style={{ color: "var(--text-muted)" }}>{i + 1}</td>
                      <td><span className="badge badge-blue">{s.rollNo}</span></td>
                      <td style={{ fontWeight: 500 }}>{s.name}</td>
                      <td>
                        <span className={`badge ${status === "present" ? "badge-green" : "badge-red"}`}>
                          {status === "present" ? "✓ Present" : "✗ Absent"}
                        </span>
                      </td>
                      <td>
                        <button
                          className={`btn btn-sm ${status === "present" ? "btn-danger" : "btn-success"}`}
                          onClick={() => toggleStatus(s.id)}
                        >
                          {status === "present" ? "Mark Absent" : "Mark Present"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
