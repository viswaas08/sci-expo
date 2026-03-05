import { useState, useEffect } from "react";
import { collection, getDocs, query, where, orderBy, limit } from "firebase/firestore";
import { db } from "../../firebase";
import Sidebar from "../../components/Sidebar";
import { useAuth } from "../../context/AuthContext";
import { FaMoneyBillWave, FaCheckCircle, FaExclamationCircle, FaClock, FaChartLine } from "react-icons/fa";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

const TOOLTIP_STYLE = {
  backgroundColor: "#1e293b",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8,
  color: "#f1f5f9",
};

export default function OfficeDashboard() {
  const { userData } = useAuth();
  const [stats, setStats] = useState({ total: 0, paid: 0, pending: 0, overdue: 0 });
  const [deptSummary, setDeptSummary] = useState([]);
  const [recentPayments, setRecentPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch all payment records
        const paySnap = await getDocs(collection(db, "feePayments"));
        let total = 0, paid = 0, pending = 0, overdue = 0;
        const deptMap = {};
        const allPayments = [];

        paySnap.forEach(d => {
          const data = d.data();
          const amount = data.amount || 0;
          total += amount;
          const dept = data.dept || "Unknown";
          if (!deptMap[dept]) deptMap[dept] = { collected: 0, pending: 0 };

          if (data.status === "paid") {
            paid += amount;
            deptMap[dept].collected += amount;
          } else if (data.status === "overdue") {
            overdue += amount;
            deptMap[dept].pending += amount;
          } else {
            pending += amount;
            deptMap[dept].pending += amount;
          }
          allPayments.push({ id: d.id, ...data });
        });

        setStats({ total, paid, pending, overdue });
        setDeptSummary(Object.entries(deptMap).map(([dept, v]) => ({ dept, ...v })));

        // Recent payments (paid ones, sorted by date)
        const paidList = allPayments
          .filter(p => p.status === "paid" && p.paidOn)
          .sort((a, b) => new Date(b.paidOn) - new Date(a.paidOn))
          .slice(0, 8);
        setRecentPayments(paidList);
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    };
    fetchData();
  }, []);

  const fmt = (n) => `₹${(n || 0).toLocaleString("en-IN")}`;

  const statCards = [
    { label: "Total Expected",  value: fmt(stats.total),   icon: <FaChartLine />,         color: "var(--accent-blue)",   bg: "rgba(79,156,249,0.12)" },
    { label: "Collected",       value: fmt(stats.paid),    icon: <FaCheckCircle />,        color: "var(--accent-green)",  bg: "rgba(52,211,153,0.12)" },
    { label: "Pending",         value: fmt(stats.pending), icon: <FaClock />,              color: "var(--accent-orange)", bg: "rgba(251,146,60,0.12)" },
    { label: "Overdue",         value: fmt(stats.overdue), icon: <FaExclamationCircle />,  color: "var(--accent-red)",    bg: "rgba(248,113,113,0.12)" },
  ];

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content animate-fade-up">
        <div className="page-header">
          <h1>🏢 Office Dashboard</h1>
          <p>Welcome back, <strong>{userData?.name || "Office Staff"}</strong> — Fee management overview</p>
        </div>

        {loading ? (
          <div className="loading-center"><div className="spinner" /></div>
        ) : (
          <>
            {/* Stat Cards */}
            <div className="stat-grid">
              {statCards.map(s => (
                <div className="stat-card" key={s.label}>
                  <div className="stat-card-icon" style={{ background: s.bg, color: s.color }}>{s.icon}</div>
                  <div className="stat-card-value" style={{ color: s.color, fontSize: 22 }}>{s.value}</div>
                  <div className="stat-card-label">{s.label}</div>
                </div>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 28 }}>
              {/* Dept chart */}
              <div className="chart-card">
                <h3>Fee Collection by Department</h3>
                {deptSummary.length > 0 ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={deptSummary}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                      <XAxis dataKey="dept" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                      <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} formatter={v => [`₹${v.toLocaleString("en-IN")}`, ""]} />
                      <Bar dataKey="collected" name="Collected" fill="#34d399" radius={[6,6,0,0]} />
                      <Bar dataKey="pending"   name="Pending"   fill="#f97316" radius={[6,6,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ height: 260, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>
                    No payment data yet
                  </div>
                )}
              </div>

              {/* Recent payments */}
              <div className="glass-card">
                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Recent Payments</h3>
                {recentPayments.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {recentPayments.map(p => (
                      <div key={p.id} style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        padding: "10px 14px", background: "rgba(255,255,255,0.04)", borderRadius: 8,
                        border: "1px solid var(--border)"
                      }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{p.studentName || "Student"}</div>
                          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{p.dept} · Sem {p.semester} · {p.paidOn}</div>
                        </div>
                        <div style={{ fontWeight: 700, color: "var(--accent-green)", fontSize: 14 }}>
                          ₹{(p.amount || 0).toLocaleString("en-IN")}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ color: "var(--text-muted)", fontSize: 13, textAlign: "center", padding: "48px 0" }}>
                    No payments recorded yet
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
