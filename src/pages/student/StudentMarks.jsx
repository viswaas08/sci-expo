import { useState, useEffect } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../firebase";
import { useAuth } from "../../context/AuthContext";
import Sidebar from "../../components/Sidebar";

export default function StudentMarks() {
  const { currentUser } = useAuth();
  const [marks, setMarks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) return;
    const fetch = async () => {
      const [marksSnap, examsSnap] = await Promise.all([
        getDocs(query(collection(db, "marks"), where("studentId", "==", currentUser.uid))),
        getDocs(collection(db, "exams")),
      ]);
      const examMap = {};
      examsSnap.forEach(d => { examMap[d.id] = d.data(); });
      const data = marksSnap.docs.map(d => ({ id: d.id, ...d.data(), exam: examMap[d.data().examId] }))
        .sort((a, b) => (b.exam?.date || "").localeCompare(a.exam?.date || ""));
      setMarks(data);
      setLoading(false);
    };
    fetch();
  }, [currentUser]);

  const subjectMap = {};
  marks.forEach(m => {
    const subj = m.exam?.subject || "Unknown";
    if (!subjectMap[subj]) subjectMap[subj] = [];
    subjectMap[subj].push(m);
  });

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content animate-fade-up">
        <div className="page-header">
          <h1>My Marks</h1>
          <p>Exam-wise performance across all subjects</p>
        </div>

        {loading ? <div className="loading-center"><div className="spinner" /></div> : (
          <>
            {Object.keys(subjectMap).length === 0 ? (
              <div className="glass-card" style={{ textAlign: "center", padding: "60px 0", color: "var(--text-muted)" }}>No exam marks recorded yet.</div>
            ) : Object.entries(subjectMap).map(([subject, subMarks]) => {
              const avg = Math.round(subMarks.reduce((s, m) => s + (m.exam ? (m.marksObtained / m.exam.maxMarks) * 100 : 0), 0) / subMarks.length);
              return (
                <div key={subject} style={{ marginBottom: 28 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 600 }}>{subject}</h3>
                    <span className={`badge ${avg >= 75 ? "badge-green" : avg >= 50 ? "badge-orange" : "badge-red"}`}>Avg: {avg}%</span>
                  </div>
                  <div className="table-wrapper">
                    <table>
                      <thead><tr><th>Exam</th><th>Date</th><th>Marks Obtained</th><th>Max Marks</th><th>Percentage</th><th>Grade</th></tr></thead>
                      <tbody>
                        {subMarks.map(m => {
                          const pct = m.exam ? Math.round((m.marksObtained / m.exam.maxMarks) * 100) : 0;
                          const grade = pct >= 90 ? "O" : pct >= 80 ? "A+" : pct >= 70 ? "A" : pct >= 60 ? "B" : pct >= 50 ? "C" : "F";
                          const gradeColor = pct >= 70 ? "badge-green" : pct >= 50 ? "badge-orange" : "badge-red";
                          return (
                            <tr key={m.id}>
                              <td style={{ fontWeight: 500 }}>{m.exam?.name || "—"}</td>
                              <td style={{ color: "var(--text-secondary)" }}>{m.exam?.date || "—"}</td>
                              <td style={{ fontWeight: 600, fontSize: 16 }}>{m.marksObtained}</td>
                              <td style={{ color: "var(--text-secondary)" }}>{m.exam?.maxMarks}</td>
                              <td>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                  <div style={{ flex: 1, height: 6, background: "rgba(255,255,255,0.08)", borderRadius: 100, overflow: "hidden", minWidth: 60 }}>
                                    <div style={{ height: "100%", width: `${pct}%`, background: pct >= 75 ? "var(--accent-green)" : pct >= 50 ? "var(--accent-orange)" : "var(--accent-red)", borderRadius: 100 }} />
                                  </div>
                                  <span style={{ fontSize: 13, fontWeight: 600 }}>{pct}%</span>
                                </div>
                              </td>
                              <td><span className={`badge ${gradeColor}`}>{grade}</span></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </main>
    </div>
  );
}
