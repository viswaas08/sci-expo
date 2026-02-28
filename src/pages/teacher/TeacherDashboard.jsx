import { useState, useEffect } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../firebase";
import { useAuth } from "../../context/AuthContext";
import Sidebar from "../../components/Sidebar";
import { FaUserGraduate, FaClipboardList, FaCalendarCheck, FaChartBar } from "react-icons/fa";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const TOOLTIP_STYLE = { backgroundColor: "#1e293b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#f1f5f9" };

export default function TeacherDashboard() {
  const { userData, currentUser } = useAuth();
  const [stats, setStats] = useState({ students: 0, exams: 0, attendanceDays: 0 });
  const [recentExams, setRecentExams] = useState([]);
  const [attendanceStats, setAttendanceStats] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) return;
    const fetch = async () => {
      try {
        const [studSnap, examSnap, attSnap] = await Promise.all([
          getDocs(query(collection(db, "users"), where("role", "==", "student"),
            where("dept", "==", userData?.dept || ""),
            where("year", "==", userData?.year || 1),
            where("section", "==", userData?.section || "A")
          )),
          getDocs(query(collection(db, "exams"), where("teacherId", "==", currentUser.uid))),
          getDocs(query(collection(db, "attendance"), where("teacherId", "==", currentUser.uid))),
        ]);
        setStats({ students: studSnap.size, exams: examSnap.size, attendanceDays: attSnap.size });
        const exams = examSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => b.date?.localeCompare(a.date)).slice(0, 5);
        setRecentExams(exams);

        // Attendance summary by month
        const monthMap = {};
        attSnap.forEach(d => {
          const { date, status } = d.data();
          if (!date) return;
          const month = date.slice(0, 7);
          if (!monthMap[month]) monthMap[month] = { present: 0, total: 0 };
          monthMap[month].total++;
          if (status === "present") monthMap[month].present++;
        });
        setAttendanceStats(Object.entries(monthMap).sort().slice(-6).map(([month, v]) => ({
          month: month.slice(5),
          percentage: v.total ? Math.round((v.present / v.total) * 100) : 0,
        })));
      } finally { setLoading(false); }
    };
    fetch();
  }, [currentUser, userData]);

  const statItems = [
    { label: "My Students", value: stats.students, icon: <FaUserGraduate />, color: "var(--accent-blue)", bg: "rgba(79,156,249,0.15)" },
    { label: "Exams Created", value: stats.exams, icon: <FaClipboardList />, color: "var(--accent-purple)", bg: "rgba(167,139,250,0.15)" },
    { label: "Attendance Records", value: stats.attendanceDays, icon: <FaCalendarCheck />, color: "var(--accent-green)", bg: "rgba(52,211,153,0.15)" },
  ];

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content animate-fade-up">
        <div className="page-header">
          <h1>Welcome, {userData?.name || "Teacher"} 👋</h1>
          <p>
            {userData?.dept} · Year {userData?.year} · Section {userData?.section}
          </p>
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

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
              <div className="chart-card">
                <h3>Monthly Attendance %</h3>
                {attendanceStats.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={attendanceStats}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                      <XAxis dataKey="month" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                      <YAxis domain={[0, 100]} tick={{ fill: "#94a3b8", fontSize: 12 }} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} formatter={v => [`${v}%`, "Attendance"]} />
                      <Bar dataKey="percentage" fill="#34d399" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <div style={{ height: 220, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>No attendance data yet</div>}
              </div>

              <div className="glass-card">
                <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Recent Exams</h3>
                {recentExams.length === 0 ? (
                  <p style={{ color: "var(--text-muted)", fontSize: 14 }}>No exams created yet.</p>
                ) : recentExams.map(e => (
                  <div key={e.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                    <div>
                      <div style={{ fontWeight: 500, fontSize: 14 }}>{e.name}</div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{e.subject} · {e.date}</div>
                    </div>
                    <span className="badge badge-blue">Max: {e.maxMarks}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
