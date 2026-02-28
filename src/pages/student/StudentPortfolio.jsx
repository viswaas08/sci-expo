import { useState, useEffect } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../firebase";
import { useAuth } from "../../context/AuthContext";
import Sidebar from "../../components/Sidebar";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, RadialBarChart, RadialBar, PieChart, Pie, Cell
} from "recharts";

const TOOLTIP_STYLE = { backgroundColor: "#1e293b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#f1f5f9" };
const COLORS = ["#4f9cf9", "#34d399", "#a78bfa", "#fb923c", "#f87171", "#22d3ee"];

export default function StudentPortfolio() {
  const { currentUser, userData } = useAuth();
  const [attendanceData, setAttendanceData] = useState([]);
  const [marksData, setMarksData] = useState([]);
  const [subjectAvg, setSubjectAvg] = useState([]);
  const [overallStats, setOverallStats] = useState({ attPct: 0, avgScore: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) return;
    const fetchAll = async () => {
      const [attSnap, marksSnap, examsSnap] = await Promise.all([
        getDocs(query(collection(db, "attendance"), where("studentId", "==", currentUser.uid))),
        getDocs(query(collection(db, "marks"), where("studentId", "==", currentUser.uid))),
        getDocs(collection(db, "exams")),
      ]);

      // Attendance by month
      const monthMap = {};
      let present = 0;
      attSnap.forEach(d => {
        const { date, status } = d.data();
        if (!date) return;
        const month = date.slice(0, 7);
        if (!monthMap[month]) monthMap[month] = { present: 0, absent: 0 };
        if (status === "present") { monthMap[month].present++; present++; } else monthMap[month].absent++;
      });
      const attPct = attSnap.size > 0 ? Math.round((present / attSnap.size) * 100) : 0;
      setAttendanceData(Object.entries(monthMap).sort().slice(-8).map(([month, v]) => ({
        month: month.slice(5), present: v.present, absent: v.absent,
        percentage: v.present + v.absent > 0 ? Math.round((v.present / (v.present + v.absent)) * 100) : 0
      })));

      // Marks per exam
      const examMap = {};
      examsSnap.forEach(d => { examMap[d.id] = d.data(); });
      const marks = marksSnap.docs.map(d => ({ ...d.data(), exam: examMap[d.data().examId] }));
      const sortedMarks = marks.sort((a, b) => (a.exam?.date || "").localeCompare(b.exam?.date || ""));

      setMarksData(sortedMarks.map(m => ({
        name: m.exam ? `${m.exam.name} (${m.exam.subject})` : "—",
        marks: m.marksObtained,
        maxMarks: m.exam?.maxMarks || 100,
        percentage: m.exam ? Math.round((m.marksObtained / m.exam.maxMarks) * 100) : 0,
      })));

      // Subject averages for pie
      const subjMap = {};
      marks.forEach(m => {
        const s = m.exam?.subject || "Unknown";
        if (!subjMap[s]) subjMap[s] = [];
        subjMap[s].push(m.exam ? Math.round((m.marksObtained / m.exam.maxMarks) * 100) : 0);
      });
      const subAvg = Object.entries(subjMap).map(([name, vals]) => ({
        name, value: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
      }));
      setSubjectAvg(subAvg);

      const avgScore = marks.length > 0 ? Math.round(sortedMarks.reduce((s, m) => s + (m.exam ? (m.marksObtained / m.exam.maxMarks) * 100 : 0), 0) / marks.length) : 0;
      setOverallStats({ attPct, avgScore });
      setLoading(false);
    };
    fetchAll();
  }, [currentUser]);

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content animate-fade-up">
        <div className="page-header">
          <h1>My Portfolio 📊</h1>
          <p>Visual overview of your academic performance</p>
        </div>

        {loading ? <div className="loading-center"><div className="spinner" /></div> : (
          <>
            {/* Overall radial indicators */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 28 }}>
              <div className="chart-card" style={{ display: "flex", gap: 24, alignItems: "center" }}>
                <ResponsiveContainer width={140} height={140}>
                  <RadialBarChart innerRadius="60%" outerRadius="100%" data={[{ value: overallStats.attPct, fill: "#34d399" }]} startAngle={90} endAngle={-270}>
                    <RadialBar dataKey="value" cornerRadius={8} background={{ fill: "rgba(255,255,255,0.05)" }} />
                  </RadialBarChart>
                </ResponsiveContainer>
                <div>
                  <div style={{ fontSize: 40, fontWeight: 800, fontFamily: "Outfit", color: "var(--accent-green)" }}>{overallStats.attPct}%</div>
                  <div style={{ color: "var(--text-secondary)", fontSize: 14 }}>Overall Attendance</div>
                  {overallStats.attPct < 75 && <div style={{ color: "var(--accent-orange)", fontSize: 12, marginTop: 4 }}>⚠ Below 75% threshold</div>}
                </div>
              </div>
              <div className="chart-card" style={{ display: "flex", gap: 24, alignItems: "center" }}>
                <ResponsiveContainer width={140} height={140}>
                  <RadialBarChart innerRadius="60%" outerRadius="100%" data={[{ value: overallStats.avgScore, fill: "#4f9cf9" }]} startAngle={90} endAngle={-270}>
                    <RadialBar dataKey="value" cornerRadius={8} background={{ fill: "rgba(255,255,255,0.05)" }} />
                  </RadialBarChart>
                </ResponsiveContainer>
                <div>
                  <div style={{ fontSize: 40, fontWeight: 800, fontFamily: "Outfit", color: "var(--accent-blue)" }}>{overallStats.avgScore}%</div>
                  <div style={{ color: "var(--text-secondary)", fontSize: 14 }}>Average Score</div>
                </div>
              </div>
            </div>

            {/* Attendance trend */}
            <div className="chart-card" style={{ marginBottom: 24 }}>
              <h3>Attendance Trend (Monthly)</h3>
              {attendanceData.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={attendanceData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="month" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                    <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Legend wrapperStyle={{ color: "#94a3b8", fontSize: 12 }} />
                    <Bar dataKey="present" name="Present" fill="#34d399" radius={[4, 4, 0, 0]} stackId="a" />
                    <Bar dataKey="absent" name="Absent" fill="#f87171" radius={[4, 4, 0, 0]} stackId="a" />
                  </BarChart>
                </ResponsiveContainer>
              ) : <div style={{ height: 240, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>No attendance data yet</div>}
            </div>

            {/* Marks trend */}
            <div className="chart-card" style={{ marginBottom: 24 }}>
              <h3>Exam Marks (%)</h3>
              {marksData.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={marksData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} interval={0} angle={-30} textAnchor="end" height={60} />
                    <YAxis domain={[0, 100]} tick={{ fill: "#94a3b8", fontSize: 12 }} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={v => [`${v}%`, "Score"]} />
                    <Line type="monotone" dataKey="percentage" stroke="#4f9cf9" strokeWidth={2.5} dot={{ fill: "#4f9cf9", r: 5 }} activeDot={{ r: 7 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : <div style={{ height: 240, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>No marks data yet</div>}
            </div>

            {/* Subject average pie */}
            {subjectAvg.length > 0 && (
              <div className="chart-card">
                <h3>Average Score by Subject</h3>
                <div style={{ display: "flex", gap: 32, alignItems: "center" }}>
                  <ResponsiveContainer width={220} height={220}>
                    <PieChart>
                      <Pie data={subjectAvg} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value" paddingAngle={4}>
                        {subjectAvg.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={TOOLTIP_STYLE} formatter={v => [`${v}%`, "Avg"]} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {subjectAvg.map((s, i) => (
                      <div key={s.name} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 12, height: 12, borderRadius: 3, background: COLORS[i % COLORS.length] }} />
                        <span style={{ fontSize: 14 }}>{s.name}</span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: COLORS[i % COLORS.length], marginLeft: "auto" }}>{s.value}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
