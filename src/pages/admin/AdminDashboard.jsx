import { useState, useEffect } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../firebase";
import Sidebar from "../../components/Sidebar";
import { FaUserGraduate, FaChalkboardTeacher, FaBuilding, FaChartBar } from "react-icons/fa";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line
} from "recharts";

const TOOLTIP_STYLE = {
  backgroundColor: "#1e293b",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8,
  color: "#f1f5f9",
};

export default function AdminDashboard() {
  const [stats, setStats] = useState({ students: 0, teachers: 0, departments: 0, exams: 0 });
  const [deptData, setDeptData] = useState([]);
  const [attendanceData, setAttendanceData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [studSnap, teachSnap, deptSnap, examSnap] = await Promise.all([
          getDocs(query(collection(db, "users"), where("role", "==", "student"))),
          getDocs(query(collection(db, "users"), where("role", "==", "teacher"))),
          getDocs(collection(db, "departments")),
          getDocs(collection(db, "exams")),
        ]);
        setStats({
          students: studSnap.size,
          teachers: teachSnap.size,
          departments: deptSnap.size,
          exams: examSnap.size,
        });

        // Group students by department for bar chart
        const deptMap = {};
        studSnap.forEach(d => {
          const dept = d.data().dept || "Unknown";
          deptMap[dept] = (deptMap[dept] || 0) + 1;
        });
        setDeptData(Object.entries(deptMap).map(([dept, count]) => ({ dept, students: count })));

        // Attendance % per department
        const attSnap = await getDocs(collection(db, "attendance"));
        const attMap = {};
        attSnap.forEach(d => {
          const { dept, status } = d.data();
          if (!dept) return;
          if (!attMap[dept]) attMap[dept] = { present: 0, total: 0 };
          attMap[dept].total++;
          if (status === "present") attMap[dept].present++;
        });
        setAttendanceData(
          Object.entries(attMap).map(([dept, v]) => ({
            dept,
            percentage: v.total ? Math.round((v.present / v.total) * 100) : 0,
          }))
        );
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const statCards = [
    { label: "Total Students", value: stats.students, icon: <FaUserGraduate />, color: "var(--accent-blue)", bg: "rgba(79,156,249,0.15)" },
    { label: "Total Teachers", value: stats.teachers, icon: <FaChalkboardTeacher />, color: "var(--accent-purple)", bg: "rgba(167,139,250,0.15)" },
    { label: "Departments", value: stats.departments, icon: <FaBuilding />, color: "var(--accent-orange)", bg: "rgba(251,146,60,0.15)" },
    { label: "Total Exams", value: stats.exams, icon: <FaChartBar />, color: "var(--accent-green)", bg: "rgba(52,211,153,0.15)" },
  ];

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content animate-fade-up">
        <div className="page-header">
          <h1>Admin Dashboard</h1>
          <p>Overview of institution performance and activity</p>
        </div>

        {loading ? (
          <div className="loading-center"><div className="spinner" /></div>
        ) : (
          <>
            <div className="stat-grid">
              {statCards.map((s) => (
                <div className="stat-card" key={s.label}>
                  <div className="stat-card-icon" style={{ background: s.bg, color: s.color }}>{s.icon}</div>
                  <div className="stat-card-value" style={{ color: s.color }}>{s.value}</div>
                  <div className="stat-card-label">{s.label}</div>
                </div>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 32 }}>
              <div className="chart-card">
                <h3>Students per Department</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={deptData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="dept" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                    <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Bar dataKey="students" fill="#4f9cf9" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="chart-card">
                <h3>Attendance % by Department</h3>
                {attendanceData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={attendanceData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                      <XAxis dataKey="dept" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                      <YAxis domain={[0, 100]} tick={{ fill: "#94a3b8", fontSize: 12 }} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [`${v}%`, "Attendance"]} />
                      <Bar dataKey="percentage" fill="#34d399" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ height: 260, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>
                    No attendance data yet
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
