import { useState, useEffect } from "react";
import { collection, getDocs, doc, updateDoc, getDoc } from "firebase/firestore";
import { db } from "../../firebase";
import Sidebar from "../../components/Sidebar";
import { FaCalendarAlt, FaEdit, FaSave, FaTimes, FaBell, FaSearch, FaThList, FaThLarge, FaHistory, FaFilter } from "react-icons/fa";

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

const DEFAULT_BATCHES = [
  { id: "2022-2026", name: "Batch 2022-2026", joiningYear: 22 },
  { id: "2023-2027", name: "Batch 2023-2027", joiningYear: 23 },
  { id: "2024-2028", name: "Batch 2024-2028", joiningYear: 24 },
  { id: "2025-2029", name: "Batch 2025-2029", joiningYear: 25 },
  { id: "2026-2030", name: "Batch 2026-2030", joiningYear: 26 }
];

export default function FeesDeadlines() {
  const [deadlines, setDeadlines] = useState([]);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editItem, setEditItem] = useState(null);
  const [editDate, setEditDate] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [saving, setSaving] = useState(false);
  
  // Filtering & Sorting Options
  const [filter, setFilter] = useState("all"); // all | upcoming | overdue
  const [search, setSearch] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [filterBatch, setFilterBatch] = useState("");
  const [filterSection, setFilterSection] = useState("");
  const [sortBy, setSortBy] = useState("deadlineAsc"); // deadlineAsc | deadlineDesc | amountDesc | amountAsc | semesterAsc
  const [viewMode, setViewMode] = useState("table"); // table | grid
  const [depts, setDepts] = useState([]);

  const fetchDeadlines = async () => {
    setLoading(true);
    try {
      const [snap, batchSnap, deptSnap] = await Promise.all([
        getDocs(collection(db, "feeStructures")),
        getDoc(doc(db, "config", "batches")),
        getDocs(collection(db, "departments"))
      ]);

      const loadedBatches = (batchSnap.exists() && Array.isArray(batchSnap.data().list))
        ? batchSnap.data().list
        : DEFAULT_BATCHES;
      setBatches(loadedBatches);
      setDepts(deptSnap.docs.map(d => ({ id: d.id, ...d.data() })));

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
              year: meta.year || null,
              batchId: meta.batchId || null,
              section: meta.section || "—",
              semester: sem.semester,
              amount: sem.amount,
              deadline: sem.deadline,
            });
          }
        });
      }
      setDeadlines(all);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { fetchDeadlines(); }, []);

  const handleEdit = (item) => {
    setEditItem(item);
    setEditDate(item.deadline);
    setEditAmount(item.amount || "");
  };

  const handleSaveDeadline = async () => {
    setSaving(true);
    try {
      await updateDoc(
        doc(db, "feeStructures", editItem.structureId, "semesters", editItem.semDocId),
        { 
          deadline: editDate, 
          amount: parseFloat(editAmount) || 0,
          updatedAt: new Date().toISOString() 
        }
      );
      setDeadlines(prev => prev.map(d =>
        d.id === editItem.id ? { ...d, deadline: editDate, amount: parseFloat(editAmount) || 0 } : d
      ));
      setEditItem(null);
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  const handleQuickSnooze = async (item, days) => {
    try {
      const currentDate = new Date(item.deadline);
      currentDate.setDate(currentDate.getDate() + days);
      const newDateStr = currentDate.toISOString().split("T")[0];

      await updateDoc(
        doc(db, "feeStructures", item.structureId, "semesters", item.semDocId),
        { deadline: newDateStr, updatedAt: new Date().toISOString() }
      );

      setDeadlines(prev => prev.map(d =>
        d.id === item.id ? { ...d, deadline: newDateStr } : d
      ));
    } catch (e) {
      console.error(e);
      alert("Failed to extend deadline: " + e.message);
    }
  };

  const filtered = deadlines.filter(d => {
    const diff = daysDiff(d.deadline);
    const matchStatus =
      filter === "all" ||
      (filter === "overdue" && diff !== null && diff < 0) ||
      (filter === "upcoming" && diff !== null && diff >= 0);

    const matchSearch =
      !search ||
      (d.dept || "").toLowerCase().includes(search.toLowerCase()) ||
      (d.batchId || "").toLowerCase().includes(search.toLowerCase()) ||
      `sem ${d.semester}`.toLowerCase().includes(search.toLowerCase());

    const matchDept = !filterDept || d.dept === filterDept;
    const matchBatch = !filterBatch || d.batchId === filterBatch || (filterBatch === "legacy" && d.year);
    const matchSection = !filterSection || d.section === filterSection;

    return matchStatus && matchSearch && matchDept && matchBatch && matchSection;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "deadlineAsc")  return new Date(a.deadline) - new Date(b.deadline);
    if (sortBy === "deadlineDesc") return new Date(b.deadline) - new Date(a.deadline);
    if (sortBy === "amountDesc")   return (b.amount || 0) - (a.amount || 0);
    if (sortBy === "amountAsc")    return (a.amount || 0) - (b.amount || 0);
    if (sortBy === "semesterAsc")  return a.semester - b.semester;
    return 0;
  });

  const overdueCnt  = deadlines.filter(d => (daysDiff(d.deadline) ?? 1) < 0).length;
  const upcomingCnt = deadlines.filter(d => { const x = daysDiff(d.deadline); return x !== null && x >= 0 && x <= 30; }).length;

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content animate-fade-up">
        <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1>📅 Fee Deadlines</h1>
            <p>Manage and track payment deadlines across all departments and semesters</p>
          </div>
          <div style={{ display: "flex", gap: 8, background: "rgba(255,255,255,0.04)", padding: 4, borderRadius: 8, border: "1px solid var(--border)" }}>
            <button
              className="btn"
              style={{
                padding: 6, fontSize: 13, background: viewMode === "table" ? "var(--accent-blue)" : "transparent",
                color: viewMode === "table" ? "#fff" : "var(--text-secondary)", border: "none"
              }}
              onClick={() => setViewMode("table")}
              title="Table View"
            >
              <FaThList />
            </button>
            <button
              className="btn"
              style={{
                padding: 6, fontSize: 13, background: viewMode === "grid" ? "var(--accent-blue)" : "transparent",
                color: viewMode === "grid" ? "#fff" : "var(--text-secondary)", border: "none"
              }}
              onClick={() => setViewMode("grid")}
              title="Grid View"
            >
              <FaThLarge />
            </button>
          </div>
        </div>

        {/* Summary Stats */}
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

        {/* Filters and Search Bar Container */}
        <div className="glass-card" style={{ marginBottom: 24 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, alignItems: "end" }}>
            <div style={{ position: "relative" }}>
              <label style={{ fontSize: 12, marginBottom: 6, display: "block" }}>Search</label>
              <div style={{ position: "relative" }}>
                <FaSearch style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", fontSize: 13 }} />
                <input
                  className="form-control"
                  style={{ paddingLeft: 32, fontSize: 13 }}
                  placeholder="Dept, batch or semester..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ fontSize: 12, marginBottom: 6, display: "block" }}>Department</label>
              <select className="form-control" style={{ fontSize: 13 }} value={filterDept} onChange={e => setFilterDept(e.target.value)}>
                <option value="">All Departments</option>
                {depts.map(d => <option key={d.id} value={d.name || d.id}>{d.name || d.id}</option>)}
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ fontSize: 12, marginBottom: 6, display: "block" }}>Batch</label>
              <select className="form-control" style={{ fontSize: 13 }} value={filterBatch} onChange={e => setFilterBatch(e.target.value)}>
                <option value="">All Batches</option>
                <option value="legacy">Legacy (Year-wise)</option>
                {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ fontSize: 12, marginBottom: 6, display: "block" }}>Section</label>
              <select className="form-control" style={{ fontSize: 13 }} value={filterSection} onChange={e => setFilterSection(e.target.value)}>
                <option value="">All Sections</option>
                {["A", "B", "C", "D", "ALL"].map(s => <option key={s} value={s}>Section {s}</option>)}
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ fontSize: 12, marginBottom: 6, display: "block" }}>Sort By</label>
              <select className="form-control" style={{ fontSize: 13 }} value={sortBy} onChange={e => setSortBy(e.target.value)}>
                <option value="deadlineAsc">Date (Earliest First)</option>
                <option value="deadlineDesc">Date (Latest First)</option>
                <option value="amountDesc">Amount (High to Low)</option>
                <option value="amountAsc">Amount (Low to High)</option>
                <option value="semesterAsc">Semester (Ascending)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Filter status tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
          {[
            { key: "all",      label: "All Deadlines" },
            { key: "upcoming", label: "Upcoming Only" },
            { key: "overdue",  label: "Overdue Only" },
          ].map(t => (
            <button
              key={t.key}
              className={`btn ${filter === t.key ? "btn-primary" : "btn-secondary"}`}
              style={{ padding: "8px 18px", fontSize: 13 }}
              onClick={() => setFilter(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="loading-center"><div className="spinner" /></div>
        ) : sorted.length === 0 ? (
          <div className="glass-card" style={{ textAlign: "center", padding: "48px 24px", color: "var(--text-muted)" }}>
            <FaCalendarAlt style={{ fontSize: 40, marginBottom: 16, opacity: 0.3 }} />
            <p>No matching deadlines found.</p>
          </div>
        ) : viewMode === "table" ? (
          /* Table View Mode */
          <div className="glass-card animate-fade-up">
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Department</th>
                    <th>Batch / Class</th>
                    <th>Section</th>
                    <th>Semester</th>
                    <th>Fee Amount</th>
                    <th>Deadline</th>
                    <th>Status</th>
                    <th>Quick Snooze</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map(item => (
                    <tr key={item.id} style={{ background: daysDiff(item.deadline) < 0 ? "rgba(248,113,113,0.02)" : undefined }}>
                      <td style={{ fontWeight: 600 }}>{item.dept}</td>
                      <td>
                        {item.batchId ? (
                          <span className="badge badge-purple">{batches.find(b => b.id === item.batchId)?.name || item.batchId}</span>
                        ) : (
                          <span style={{ color: "var(--text-secondary)" }}>Year {item.year}</span>
                        )}
                      </td>
                      <td>{item.section}</td>
                      <td>Sem {item.semester}</td>
                      <td style={{ fontWeight: 600, color: "var(--accent-purple)" }}>₹{(item.amount || 0).toLocaleString("en-IN")}</td>
                      <td style={{ fontWeight: 500 }}>{item.deadline}</td>
                      <td><DeadlineChip deadline={item.deadline} /></td>
                      <td>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ padding: "4px 8px", fontSize: 11 }}
                            onClick={() => handleQuickSnooze(item, 7)}
                          >
                            +7d
                          </button>
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ padding: "4px 8px", fontSize: 11 }}
                            onClick={() => handleQuickSnooze(item, 30)}
                          >
                            +30d
                          </button>
                        </div>
                      </td>
                      <td>
                        <button className="btn btn-secondary" style={{ padding: "6px 12px", fontSize: 12 }} onClick={() => handleEdit(item)}>
                          <FaEdit /> Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* Grid View Mode */
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }} className="animate-fade-up">
            {sorted.map(item => {
              const diff = daysDiff(item.deadline);
              const isOverdue = diff !== null && diff < 0;
              return (
                <div
                  key={item.id}
                  style={{
                    padding: 20,
                    borderRadius: 14,
                    background: "rgba(255,255,255,0.04)",
                    border: isOverdue ? "1px solid rgba(248,113,113,0.25)" : "1px solid var(--border)",
                    boxShadow: "0 8px 32px 0 rgba(0, 0, 0, 0.12)",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between"
                  }}
                >
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 15, color: "var(--accent-purple)" }}>{item.dept}</div>
                        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                          {item.batchId ? (
                            <span>{batches.find(b => b.id === item.batchId)?.name || item.batchId}</span>
                          ) : (
                            <span>Year {item.year}</span>
                          )}
                          {" · "} Section {item.section}
                        </div>
                      </div>
                      <DeadlineChip deadline={item.deadline} />
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", margin: "14px 0", background: "rgba(255,255,255,0.02)", padding: "10px 12px", borderRadius: 8 }}>
                      <div>
                        <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase" }}>Semester</div>
                        <div style={{ fontWeight: 700, fontSize: 14, marginTop: 2 }}>Sem {item.semester}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase" }}>Fee Amount</div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: "var(--accent-green)", marginTop: 2 }}>
                          ₹{(item.amount || 0).toLocaleString("en-IN")}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                      <FaCalendarAlt /> Due: <strong>{item.deadline}</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", borderTop: "1px solid var(--border)", paddingTop: 12, marginTop: 12 }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ padding: "4px 8px", fontSize: 11 }}
                          onClick={() => handleQuickSnooze(item, 7)}
                          title="Snooze 7 days"
                        >
                          +7d
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ padding: "4px 8px", fontSize: 11 }}
                          onClick={() => handleQuickSnooze(item, 30)}
                          title="Snooze 30 days"
                        >
                          +30d
                        </button>
                      </div>
                      <button className="btn btn-secondary btn-sm" style={{ padding: "6px 12px", fontSize: 12 }} onClick={() => handleEdit(item)}>
                        <FaEdit style={{ marginRight: 4 }} /> Edit
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Edit Deadline & Fee Modal */}
        {editItem && (
          <div className="modal-overlay" onClick={() => setEditItem(null)}>
            <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: 400, width: "100%" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <h3 style={{ fontSize: 17, fontWeight: 700 }}>⚙️ Customize Structure Item</h3>
                <button style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "var(--text-secondary)" }} onClick={() => setEditItem(null)}>
                  <FaTimes />
                </button>
              </div>
              <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
                {editItem.dept} · {editItem.batchId ? `Batch ${editItem.batchId}` : `Year ${editItem.year}`} · Section {editItem.section} · Semester {editItem.semester}
              </p>
              
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label>Deadline Date</label>
                <input className="form-control" type="date" value={editDate} onChange={e => setEditDate(e.target.value)} />
              </div>

              <div className="form-group" style={{ marginBottom: 18 }}>
                <label>Semester Fee Amount (₹)</label>
                <input className="form-control" type="number" value={editAmount} onChange={e => setEditAmount(e.target.value)} placeholder="0" />
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSaveDeadline} disabled={saving}>
                  {saving ? <span className="spinner" /> : <><FaSave style={{ marginRight: 6 }} /> Save</>}
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
