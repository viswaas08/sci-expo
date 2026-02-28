import { useState, useEffect } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase";
import { useAuth } from "../../context/AuthContext";
import Sidebar from "../../components/Sidebar";

export default function StudentAttendance() {
  const { currentUser } = useAuth();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, "attendance"), where("studentId", "==", currentUser.uid));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => b.date?.localeCompare(a.date));
      setRecords(data);
      setLoading(false);
    });
    return unsub;
  }, [currentUser]);

  const present = records.filter(r => r.status === "present").length;
  const total = records.length;
  const pct = total > 0 ? Math.round((present / total) * 100) : 0;
  const pctColor = pct >= 75 ? "var(--accent-green)" : pct >= 60 ? "var(--accent-orange)" : "var(--accent-red)";

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content animate-fade-up">
        <div className="page-header">
          <h1>My Attendance</h1>
          <p>Real-time attendance records</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 28 }}>
          {[
            { label: "Total Days", value: total, color: "var(--accent-blue)" },
            { label: "Present", value: present, color: "var(--accent-green)" },
            { label: "Absent", value: total - present, color: "var(--accent-red)" },
            { label: "Percentage", value: `${pct}%`, color: pctColor },
          ].map(s => (
            <div className="stat-card" key={s.label}>
              <div className="stat-card-value" style={{ color: s.color, fontSize: 28 }}>{s.value}</div>
              <div className="stat-card-label">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Attendance progress bar */}
        <div className="glass-card" style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, fontSize: 14 }}>
            <span>Overall Attendance</span><span style={{ color: pctColor, fontWeight: 700 }}>{pct}%</span>
          </div>
          <div style={{ height: 10, background: "rgba(255,255,255,0.08)", borderRadius: 100, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${pct}%`, background: pctColor, borderRadius: 100, transition: "width 1s ease" }} />
          </div>
          {pct < 75 && <p style={{ color: "var(--accent-orange)", fontSize: 13, marginTop: 10 }}>⚠ Attendance below 75%. Please attend more classes.</p>}
        </div>

        {loading ? <div className="loading-center"><div className="spinner" /></div> : (
          <div className="table-wrapper">
            <table>
              <thead><tr><th>Date</th><th>Status</th><th>Department</th><th>Year</th><th>Section</th></tr></thead>
              <tbody>
                {records.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--text-muted)", padding: "40px 0" }}>No attendance records yet.</td></tr>
                ) : records.map(r => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 500 }}>{r.date}</td>
                    <td><span className={`badge ${r.status === "present" ? "badge-green" : "badge-red"}`}>{r.status === "present" ? "✓ Present" : "✗ Absent"}</span></td>
                    <td>{r.dept || "—"}</td>
                    <td>Year {r.year || "—"}</td>
                    <td>Sec {r.section || "—"}</td>
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
