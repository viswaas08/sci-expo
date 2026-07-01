import { useState, useEffect } from "react";
import { collection, getDocs, orderBy, query, where, doc, getDoc } from "firebase/firestore";
import { db } from "../../firebase";
import Sidebar from "../../components/Sidebar";
import { FaListAlt, FaSearch, FaFileDownload } from "react-icons/fa";

const DEFAULT_BATCHES = [
  { id: "2022-2026", name: "Batch 2022-2026", joiningYear: 22 },
  { id: "2023-2027", name: "Batch 2023-2027", joiningYear: 23 },
  { id: "2024-2028", name: "Batch 2024-2028", joiningYear: 24 },
  { id: "2025-2029", name: "Batch 2025-2029", joiningYear: 25 },
  { id: "2026-2030", name: "Batch 2026-2030", joiningYear: 26 }
];

export default function PaymentHistory() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [filterYear, setFilterYear] = useState("");
  const [filterSection, setFilterSection] = useState("");
  const [filterBatch, setFilterBatch] = useState("");
  const [depts, setDepts]       = useState([]);
  const [batches, setBatches]   = useState([]);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [paySnap, deptSnap, userSnap, batchSnap] = await Promise.all([
          getDocs(collection(db, "feePayments")),
          getDocs(collection(db, "departments")),
          getDocs(query(collection(db, "users"), where("role", "==", "student"))),
          getDoc(doc(db, "config", "batches")),
        ]);

        let batchList = [];
        if (batchSnap.exists() && Array.isArray(batchSnap.data().list)) {
          batchList = batchSnap.data().list;
        } else {
          batchList = DEFAULT_BATCHES;
        }
        setBatches(batchList);

        const userMap = {};
        userSnap.forEach(d => { userMap[d.id] = d.data(); });

        const list = paySnap.docs
          .map(d => {
            const data = d.data();
            const student = userMap[data.studentUid] || {};
            // Resolve batch ID
            let batchId = data.batchId;
            if (!batchId && student.admissionYear) {
              const sBatch = batchList.find(b => b.joiningYear === parseInt(student.admissionYear));
              batchId = sBatch ? sBatch.id : `20${student.admissionYear}-20${parseInt(student.admissionYear) + 4}`;
            }
            return {
              id: d.id,
              ...data,
              batchId: batchId || "—",
              admissionYear: data.admissionYear || student.admissionYear || "—",
            };
          })
          .filter(p => p.status === "paid")
          .sort((a, b) => new Date(b.paidOn || b.recordedAt || 0) - new Date(a.paidOn || a.recordedAt || 0));
        
        setPayments(list);
        setDepts(deptSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) { console.error(e); }
      setLoading(false);
    };
    fetchAll();
  }, []);

  const filtered = payments.filter(p => {
    const matchDept    = !filterDept || p.dept === filterDept;
    const matchYear    = !filterYear || String(p.year) === String(filterYear);
    const matchSection = !filterSection || p.section === filterSection;
    const matchBatch   = !filterBatch || p.batchId === filterBatch;
    const matchSearch  = !search ||
      (p.studentName || "").toLowerCase().includes(search.toLowerCase()) ||
      (p.receiptNo   || "").toLowerCase().includes(search.toLowerCase());
    return matchDept && matchYear && matchSection && matchBatch && matchSearch;
  });

  const totalCollected = filtered.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);

  const downloadCSV = () => {
    const headers = ["Student","Dept","Batch","Year","Section","Semester","Amount","Method","Receipt","Date"];
    const rows = filtered.map(p => [
      p.studentName || "—", p.dept || "—", p.batchId || "—", p.year || "—", p.section || "—", p.semester || "—",
      p.amount || 0, p.method || "—", p.receiptNo || "—", p.paidOn || "—"
    ]);
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
    const a = document.createElement("a");
    a.href = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
    a.download = `payment_history_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content animate-fade-up">
        <div className="page-header" style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:12 }}>
          <div>
            <h1>📁 Payment History</h1>
            <p>Complete record of all received fee payments</p>
          </div>
          <button className="btn btn-secondary" onClick={downloadCSV}>
            <FaFileDownload /> Export CSV
          </button>
        </div>

        {/* Filters */}
        <div className="glass-card" style={{ marginBottom: 24, display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ flex: 1.5, minWidth: 200, position: "relative" }}>
            <label style={{ fontSize: 13, marginBottom: 6, display: "block" }}>Search Student / Receipt</label>
            <div style={{ position: "relative" }}>
              <FaSearch style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", fontSize: 14 }} />
              <input
                className="form-control"
                style={{ paddingLeft: 36 }}
                placeholder="Search name or receipt..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: 150 }}>
            <label style={{ fontSize: 13, marginBottom: 6, display: "block" }}>Department</label>
            <select className="form-control" value={filterDept} onChange={e => setFilterDept(e.target.value)}>
              <option value="">All Departments</option>
              {depts.map(d => <option key={d.id} value={d.name || d.id}>{d.name || d.id}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: 150 }}>
            <label style={{ fontSize: 13, marginBottom: 6, display: "block" }}>Batch</label>
            <select className="form-control" value={filterBatch} onChange={e => setFilterBatch(e.target.value)}>
              <option value="">All Batches</option>
              {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: 120 }}>
            <label style={{ fontSize: 13, marginBottom: 6, display: "block" }}>Year</label>
            <select className="form-control" value={filterYear} onChange={e => setFilterYear(e.target.value)}>
              <option value="">All Years</option>
              {["1", "2", "3", "4"].map(y => <option key={y} value={y}>Year {y}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: 120 }}>
            <label style={{ fontSize: 13, marginBottom: 6, display: "block" }}>Section</label>
            <select className="form-control" value={filterSection} onChange={e => setFilterSection(e.target.value)}>
              <option value="">All Sections</option>
              {["A", "B", "C", "D"].map(s => <option key={s} value={s}>Section {s}</option>)}
            </select>
          </div>
          <div style={{ fontWeight: 700, color: "var(--accent-green)", whiteSpace: "nowrap", paddingBottom: 10 }}>
            Total: ₹{totalCollected.toLocaleString("en-IN")}
          </div>
        </div>

        {loading ? (
          <div className="loading-center"><div className="spinner" /></div>
        ) : filtered.length === 0 ? (
          <div className="glass-card" style={{ textAlign: "center", padding: "48px 24px", color: "var(--text-muted)" }}>
            <FaListAlt style={{ fontSize: 40, marginBottom: 16, opacity: 0.3 }} />
            <p>No payment records found.</p>
          </div>
        ) : (
          <div className="glass-card">
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Student</th>
                    <th>Department</th>
                    <th>Batch</th>
                    <th>Year</th>
                    <th>Section</th>
                    <th>Semester</th>
                    <th>Amount</th>
                    <th>Method</th>
                    <th>Receipt No</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p, i) => (
                    <tr key={p.id}>
                      <td style={{ color: "var(--text-muted)", fontSize: 13 }}>{i+1}</td>
                      <td style={{ fontWeight: 600 }}>{p.studentName || "—"}</td>
                      <td>{p.dept || "—"}</td>
                      <td>{p.batchId || "—"}</td>
                      <td>Year {p.year || "—"}</td>
                      <td>Section {p.section || "—"}</td>
                      <td>Sem {p.semester || "—"}</td>
                      <td style={{ color: "var(--accent-green)", fontWeight: 700 }}>
                        ₹{(parseFloat(p.amount)||0).toLocaleString("en-IN")}
                      </td>
                      <td>
                        <span className="badge badge-blue" style={{ fontSize: 11 }}>{p.method || "—"}</span>
                      </td>
                      <td style={{ fontSize: 12, color: "var(--text-muted)" }}>
                        {p.receiptNo ? `#${p.receiptNo}` : "—"}
                      </td>
                      <td style={{ fontSize: 13, color: "var(--text-secondary)" }}>{p.paidOn || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
