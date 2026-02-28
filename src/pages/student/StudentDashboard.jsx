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
        const [attSnap, marksSnap, examsSnap] = await Promise.all([
          getDocs(query(collection(db, "attendance"), where("studentId", "==", currentUser.uid))),
          getDocs(query(collection(db, "marks"), where("studentId", "==", currentUser.uid))),
          getDocs(collection(db, "exams")),
        ]);

        // Attendance %
        let present = 0;
        attSnap.forEach(d => { if (d.data().status === "present") present++; });
        const attPct = attSnap.size > 0 ? Math.round((present / attSnap.size) * 100) : 0;

        // Exams map
        const examMap = {};
        examsSnap.forEach(d => { examMap[d.id] = d.data(); });

        // Marks
        const marks = marksSnap.docs.map(d => ({ id: d.id, ...d.data(), exam: examMap[d.data().examId] }));
        const pctMarks = marks.map(m => m.exam ? Math.round((m.marksObtained / m.exam.maxMarks) * 100) : 0);
        const avg = pctMarks.length > 0 ? Math.round(pctMarks.reduce((a, b) => a + b, 0) / pctMarks.length) : 0;
        const best = pctMarks.length > 0 ? Math.max(...pctMarks) : 0;

        setStats({ attendancePct: attPct, examsCount: marks.length, avgMarks: avg, bestMark: best });
        setRecentMarks(marks.sort((a, b) => b.exam?.date?.localeCompare(a.exam?.date || "") || 0).slice(0, 5));
      } finally { setLoading(false); }
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
              <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Recent Exam Results</h3>
              {recentMarks.length === 0 ? (
                <p style={{ color: "var(--text-muted)", fontSize: 14 }}>No marks recorded yet.</p>
              ) : recentMarks.map(m => {
                const pct = m.exam ? Math.round((m.marksObtained / m.exam.maxMarks) * 100) : 0;
                return (
                  <div key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                    <div>
                      <div style={{ fontWeight: 500, fontSize: 14 }}>{m.exam?.name || "Exam"}</div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{m.exam?.subject} · {m.exam?.date}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <span className={`badge ${pct >= 75 ? "badge-green" : pct >= 50 ? "badge-orange" : "badge-red"}`}>
                        {m.marksObtained}/{m.exam?.maxMarks}
                      </span>
                      <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{pct}%</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
