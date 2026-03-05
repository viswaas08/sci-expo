import { useState, useEffect } from "react";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import { db } from "../../firebase";
import Sidebar from "../../components/Sidebar";
import { FaCalendarAlt, FaEdit, FaSave, FaTimes, FaBell } from "react-icons/fa";

function daysDiff(dateStr) {
  if (!dateStr) return null;
  const diff = Math.ceil((new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24));
  return diff;
}

function DeadlineChip({ deadline }) {
  const diff = daysDiff(deadline);
  if (diff === null) return <span style={{ color: "var(--text-muted)" }}>—</span>;
  if (diff < 0)    return <span className="badge badge-red">Overdue by {Math.abs(diff)}d</span>;
  if (diff <= 7)   return <span className="badge badge-yellow">⚠️ In {diff}d</span>;
  return <span className="badge badge-green">In {diff}d</span>;
}

export default function FeesDeadlines() {
  const [deadlines, setDeadlines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editItem, setEditItem] = useState(null);
  const [editDate, setEditDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState("all"); // all | upcoming | overdue

  const fetchDeadlines = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "feeStructures"));
      const all = [];
      for (const d of snap.docs) {
        const meta = d.data();
        const semsSnap = await getDocs(collection(db, "feeStructures", d.id, "semesters"));
        semsSnap.forEach(s => {
          const sem = s.data();
          if (sem.deadline) {
            all.push({
              id: `${d.id}_sem${sem.semester}`,
              structureId: d.id,
              semDocId: s.id,
              dept: meta.dept || d.id,
              year: meta.year,
              section: meta.section || "—",
              semester: sem.semester,
              amount: sem.amount,
              deadline: sem.deadline,
            });
          }
        });
      }
      all.sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
      setDeadlines(all);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { fetchDeadlines(); }, []);

  const handleEdit = (item) => {
    setEditItem(item);
    setEditDate(item.deadline);
  };

  const handleSaveDeadline = async () => {
    setSaving(true);
    try {
      await updateDoc(
        doc(db, "feeStructures", editItem.structureId, "semesters", editItem.semDocId),
        { deadline: editDate, updatedAt: new Date().toISOString() }
      );
      setDeadlines(prev => prev.map(d =>
        d.id === editItem.id ? { ...d, deadline: editDate } : d
      ).sort((a,b) => new Date(a.deadline) - new Date(b.deadline)));
      setEditItem(null);
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  const filtered = deadlines.filter(d => {
    const diff = daysDiff(d.deadline);
    if (filter === "overdue")  return diff !== null && diff < 0;
    if (filter === "upcoming") return diff !== null && diff >= 0;
    return true;
  });

  const overdueCnt  = deadlines.filter(d => (daysDiff(d.deadline) ?? 1) < 0).length;
  const upcomingCnt = deadlines.filter(d => { const x = daysDiff(d.deadline); return x !== null && x >= 0 && x <= 30; }).length;

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content animate-fade-up">
        <div className="page-header">
          <h1>📅 Fee Deadlines</h1>
          <p>Manage and track payment deadlines across all departments and semesters</p>
        </div>

        {/* Summary */}
        <div className="stat-grid" style={{ marginBottom: 24 }}>
          {[
            { label: "Total Deadlines",    value: deadlines.length,  color: "var(--accent-blue)"   },
            { label: "Overdue",            value: overdueCnt,        color: "var(--accent-red)"    },
            { label: "Due in 30 Days",     value: upcomingCnt,       color: "var(--accent-orange)" },
          ].map(s => (
            <div key={s.label} className="stat-card">
              <div className="stat-card-value" style={{ color: s.color, fontSize: 28 }}>{s.value}</div>
              <div className="stat-card-label">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filter tabs */}
        <div style={{ display:"flex", gap:8, marginBottom:20, flexWrap:"wrap" }}>
          {[
            { key:"all",      label:"All" },
            { key:"upcoming", label:"Upcoming" },
            { key:"overdue",  label:"Overdue" },
          ].map(t => (
            <button
              key={t.key}
              className={`btn ${filter === t.key ? "btn-primary" : "btn-secondary"}`}
              style={{ padding:"8px 18px", fontSize:13 }}
              onClick={() => setFilter(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="loading-center"><div className="spinner" /></div>
        ) : filtered.length === 0 ? (
          <div className="glass-card" style={{ textAlign:"center", padding:"48px 24px", color:"var(--text-muted)" }}>
            <FaCalendarAlt style={{ fontSize:40, marginBottom:16, opacity:0.3 }} />
            <p>No deadlines found. Set up fee structures with deadlines first.</p>
          </div>
        ) : (
          <div className="glass-card">
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Department</th>
                    <th>Year</th>
                    <th>Section</th>
                    <th>Semester</th>
                    <th>Fee Amount</th>
                    <th>Deadline</th>
                    <th>Status</th>
                    <th>Edit</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(item => (
                    <tr key={item.id} style={{ background: daysDiff(item.deadline) < 0 ? "rgba(248,113,113,0.04)" : undefined }}>
                      <td style={{ fontWeight:600 }}>{item.dept}</td>
                      <td>Year {item.year}</td>
                      <td>{item.section}</td>
                      <td>Sem {item.semester}</td>
                      <td>₹{(item.amount||0).toLocaleString("en-IN")}</td>
                      <td style={{ fontWeight:500 }}>{item.deadline}</td>
                      <td><DeadlineChip deadline={item.deadline} /></td>
                      <td>
                        <button className="btn btn-secondary" style={{ padding:"5px 10px", fontSize:12 }} onClick={() => handleEdit(item)}>
                          <FaEdit />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Edit Deadline Modal */}
        {editItem && (
          <div className="modal-overlay" onClick={() => setEditItem(null)}>
            <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth:400, width:"100%" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
                <h3 style={{ fontSize:17, fontWeight:700 }}>Edit Deadline</h3>
                <button style={{ background:"none", border:"none", cursor:"pointer", fontSize:18, color:"var(--text-secondary)" }} onClick={() => setEditItem(null)}>
                  <FaTimes />
                </button>
              </div>
              <p style={{ fontSize:13, color:"var(--text-muted)", marginBottom:16 }}>
                {editItem.dept} · Year {editItem.year} · Section {editItem.section} · Semester {editItem.semester}
              </p>
              <div className="form-group">
                <label>New Deadline Date</label>
                <input className="form-control" type="date" value={editDate} onChange={e => setEditDate(e.target.value)} />
              </div>
              <div style={{ display:"flex", gap:10, marginTop:8 }}>
                <button className="btn btn-primary" style={{ flex:1 }} onClick={handleSaveDeadline} disabled={saving}>
                  {saving ? <span className="spinner" /> : <><FaSave /> Save</>}
                </button>
                <button className="btn btn-secondary" onClick={() => setEditItem(null)}>Cancel</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
