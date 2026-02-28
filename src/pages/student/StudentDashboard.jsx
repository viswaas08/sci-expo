import { useState, useEffect } from "react";
import { collection, getDocs, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase";
import { useAuth } from "../../context/AuthContext";
import Sidebar from "../../components/Sidebar";
import { FaCalendarCheck, FaClipboardList, FaChartLine, FaTrophy } from "react-icons/fa";

export default function StudentDashboard() {
  const { currentUser, userData } = useAuth();
  const [stats, setStats] = useState({ attendancePct: 0, examsCount: 0, avgMarks: 0, bestMark: 0 });
  const [recentMarks, setRecentMarks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) return;
    const fetchData = async () => {
      try {
        const [attSnap, marksSnap] = await Promise.all([
          getDocs(query(collection(db, "attendance"), where("studentId", "==", currentUser.uid))),
          // Seed stored marks inside the "exams" collection (with studentId field)
          getDocs(query(collection(db, "exams"), where("studentId", "==", currentUser.uid))),
        ]);

        // Attendance %
        let present = 0;
        attSnap.forEach(d => { if (d.data().status === "present") present++; });
        const attPct = attSnap.size > 0 ? Math.round((present / attSnap.size) * 100) : 0;

        // Marks — each doc has: subject, total, grade, internal1, internal2, external, assignment
        const marks = marksSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const totals = marks.map(m => m.total || 0).filter(t => t > 0);
        const avg  = totals.length > 0 ? Math.round(totals.reduce((a, b) => a + b, 0) / totals.length) : 0;
        const best = totals.length > 0 ? Math.max(...totals) : 0;

        setStats({ attendancePct: attPct, examsCount: marks.length, avgMarks: avg, bestMark: best });
        setRecentMarks(marks.slice(0, 5));
      } catch (err) {
        console.error("StudentDashboard fetch error:", err);
        // Don't crash — show page with zero stats
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [currentUser]);


  const statItems = [
    { label: "Attendance", value: `${stats.attendancePct}%`, icon: <FaCalendarCheck />, color: "var(--accent-green)", bg: "rgba(52,211,153,0.15)" },
    { label: "Exams Taken", value: stats.examsCount, icon: <FaClipboardList />, color: "var(--accent-blue)", bg: "rgba(79,156,249,0.15)" },
    { label: "Avg Score", value: `${stats.avgMarks}%`, icon: <FaChartLine />, color: "var(--accent-purple)", bg: "rgba(167,139,250,0.15)" },
    { label: "Best Score", value: `${stats.bestMark}%`, icon: <FaTrophy />, color: "var(--accent-orange)", bg: "rgba(251,146,60,0.15)" },
  ];

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content animate-fade-up">
        <div className="page-header">
          <h1>Welcome, {userData?.name || "Student"} 👋</h1>
          <p>{userData?.dept} · Year {userData?.year} · Section {userData?.section} · Roll: {userData?.rollNo}</p>
        </div>

        {loading ? <div className="loading-center"><div className="spinner" /></div> : (
          <>
            <div className="stat-grid">
              {statItems.map(s => (
                <div className="stat-card" key={s.label}>
                  <div className="stat-card-icon" style={{ background: s.bg, color: s.color }}>{s.icon}</div>
                  <div className="stat-card-value" style={{ color: s.color }}>{s.value}</div>
                  <div className="stat-card-label">{s.label}</div>
                </div>
              ))}
            </div>

            <div className="glass-card" style={{ maxWidth: 600 }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Recent Subjects & Scores</h3>
              {recentMarks.length === 0 ? (
                <p style={{ color: "var(--text-muted)", fontSize: 14 }}>No marks recorded yet.</p>
              ) : recentMarks.map(m => (
                <div key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                  <div>
                    <div style={{ fontWeight: 500, fontSize: 14 }}>{m.subject || "Subject"}</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      Internal: {m.internal1 ?? "—"} + {m.internal2 ?? "—"} · External: {m.external ?? "—"}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span className={`badge ${m.grade === "O" || m.grade === "A+" ? "badge-green" : m.grade === "A" || m.grade === "B+" ? "badge-blue" : m.grade === "B" || m.grade === "C" ? "badge-orange" : "badge-red"}`}>
                      {m.grade || "—"}
                    </span>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>Total: {m.total ?? "—"}/145</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
