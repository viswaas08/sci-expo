import { useState, useEffect } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../firebase";
import { useAuth } from "../../context/AuthContext";
import Sidebar from "../../components/Sidebar";

// Generate calendar days for current month
function buildCalendar() {
  const now   = new Date();
  const year  = now.getFullYear();
  const month = now.getMonth();
  const days  = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(year, month, i + 1);
    return {
      date: d.toISOString().slice(0, 10),
      label: i + 1,
      weekday: d.getDay(),
    };
  });
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const WEEKDAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

export default function AttendanceHeatmap() {
  const { currentUser, userData } = useAuth();
  const [attMap, setAttMap] = useState({}); // date → status
  const [loading, setLoading] = useState(true);
  const days = buildCalendar();
  const now  = new Date();

  useEffect(() => {
    if (!currentUser) return;
    const fetch = async () => {
      try {
        const snap = await getDocs(query(collection(db,"attendance"), where("studentId","==",currentUser.uid)));
        const map = {};
        snap.forEach(d => { const { date, status } = d.data(); if(date) map[date] = status; });
        setAttMap(map);
      } catch(e) { console.error(e); }
      finally { setLoading(false); }
    };
    fetch();
  }, [currentUser]);

  const totalDays    = days.filter(d => d.weekday > 0 && d.weekday < 7).length;
  // Only count days that are in THIS month's calendar
  const presentDays  = days.filter(d => attMap[d.date] === "present").length;
  const absentDays   = days.filter(d => attMap[d.date] === "absent").length;
  const recordedDays = presentDays + absentDays;
  const pct          = recordedDays > 0 ? Math.round((presentDays / recordedDays) * 100) : 0;


  const cellColor = (date) => {
    const s = attMap[date];
    if (!s) return "var(--bg-card)";
    if (s === "present") return "rgba(52,211,153,0.35)";
    if (s === "absent")  return "rgba(248,113,113,0.35)";
    return "var(--bg-card)";
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content animate-fade-up">
        <div className="page-header">
          <h1>📅 Attendance Calendar</h1>
          <p>{MONTHS[now.getMonth()]} {now.getFullYear()} — {pct}% attendance</p>
        </div>

        {/* Summary */}
        <div className="stat-grid" style={{ marginBottom: 32 }}>
          {[
            { label:"Present Days",  value: presentDays, color:"var(--accent-green)"  },
            { label:"Absent Days",   value: absentDays,  color:"var(--accent-red)"    },
            { label:"Attendance %",  value: `${pct}%`,   color: pct >= 75 ? "var(--accent-green)" : "var(--accent-orange)" },
          ].map(s => (
            <div key={s.label} className="stat-card">
              <div className="stat-card-value" style={{ color:s.color }}>{s.value}</div>
              <div className="stat-card-label">{s.label}</div>
            </div>
          ))}
        </div>

        {loading ? <div className="loading-center"><div className="spinner" /></div> : (
          <div className="glass-card">
            {/* Weekday headers */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(7, 1fr)", gap:8, marginBottom:8 }}>
              {WEEKDAYS.map(w => <div key={w} style={{ textAlign:"center", fontSize:12, fontWeight:600, color:"var(--text-muted)" }}>{w}</div>)}
            </div>

            {/* Calendar grid */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(7, 1fr)", gap:8 }}>
              {/* Offset for first day of month */}
              {Array.from({ length: days[0].weekday }, (_, i) => <div key={`empty-${i}`} />)}
              {days.map(d => (
                <div key={d.date} style={{
                  aspectRatio:"1", borderRadius: 8, display:"flex", alignItems:"center", justifyContent:"center",
                  fontSize:13, fontWeight:600,
                  background: cellColor(d.date),
                  border: `1px solid ${attMap[d.date] ? "transparent" : "var(--border)"}`,
                  color: attMap[d.date] ? "var(--text-primary)" : "var(--text-muted)",
                }}>
                  {d.label}
                </div>
              ))}
            </div>

            {/* Legend */}
            <div style={{ display:"flex", gap:20, marginTop:20, fontSize:13 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <div style={{ width:16, height:16, borderRadius:4, background:"rgba(52,211,153,0.35)", border:"1px solid rgba(52,211,153,0.5)" }} />
                Present
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <div style={{ width:16, height:16, borderRadius:4, background:"rgba(248,113,113,0.35)", border:"1px solid rgba(248,113,113,0.5)" }} />
                Absent
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <div style={{ width:16, height:16, borderRadius:4, background:"var(--bg-card)", border:"1px solid var(--border)" }} />
                Not recorded
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
