import { useState, useEffect } from "react";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "../../firebase";
import Sidebar from "../../components/Sidebar";
import { FaListAlt, FaSearch, FaFileDownload } from "react-icons/fa";

export default function PaymentHistory() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [depts, setDepts]       = useState([]);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [paySnap, deptSnap] = await Promise.all([
          getDocs(collection(db, "feePayments")),
          getDocs(collection(db, "departments")),
        ]);
        const list = paySnap.docs
          .map(d => ({ id: d.id, ...d.data() }))
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
    const matchDept   = !filterDept || p.dept === filterDept;
    const matchSearch = !search ||
      (p.studentName || "").toLowerCase().includes(search.toLowerCase()) ||
      (p.receiptNo   || "").toLowerCase().includes(search.toLowerCase());
    return matchDept && matchSearch;
  });

  const totalCollected = filtered.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);

  const downloadCSV = () => {
    const headers = ["Student","Dept","Year","Semester","Amount","Method","Receipt","Date"];
    const rows = filtered.map(p => [
      p.studentName || "—", p.dept || "—", p.year || "—", p.semester || "—",
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
        <div className="glass-card" style={{ marginBottom:24, display:"flex", gap:16, flexWrap:"wrap", alignItems:"center" }}>
          <div style={{ flex:1, minWidth:200, position:"relative" }}>
            <FaSearch style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", color:"var(--text-muted)", fontSize:14 }} />
            <input
              className="form-control"
              style={{ paddingLeft:36 }}
              placeholder="Search by student name or receipt..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="form-group" style={{ marginBottom:0, minWidth:180 }}>
            <select className="form-control" value={filterDept} onChange={e => setFilterDept(e.target.value)}>
              <option value="">All Departments</option>
              {depts.map(d => <option key={d.id} value={d.name || d.id}>{d.name || d.id}</option>)}
            </select>
          </div>
          <div style={{ fontWeight:700, color:"var(--accent-green)", whiteSpace:"nowrap" }}>
            Total: ₹{totalCollected.toLocaleString("en-IN")}
          </div>
        </div>

        {loading ? (
          <div className="loading-center"><div className="spinner" /></div>
        ) : filtered.length === 0 ? (
          <div className="glass-card" style={{ textAlign:"center", padding:"48px 24px", color:"var(--text-muted)" }}>
            <FaListAlt style={{ fontSize:40, marginBottom:16, opacity:0.3 }} />
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
                    <th>Year</th>
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
                      <td style={{ color:"var(--text-muted)", fontSize:13 }}>{i+1}</td>
                      <td style={{ fontWeight:600 }}>{p.studentName || "—"}</td>
                      <td>{p.dept || "—"}</td>
                      <td>Year {p.year || "—"}</td>
                      <td>Sem {p.semester || "—"}</td>
                      <td style={{ color:"var(--accent-green)", fontWeight:700 }}>
                        ₹{(parseFloat(p.amount)||0).toLocaleString("en-IN")}
                      </td>
                      <td>
                        <span className="badge badge-blue" style={{ fontSize:11 }}>{p.method || "—"}</span>
                      </td>
                      <td style={{ fontSize:12, color:"var(--text-muted)" }}>
                        {p.receiptNo ? `#${p.receiptNo}` : "—"}
                      </td>
                      <td style={{ fontSize:13, color:"var(--text-secondary)" }}>{p.paidOn || "—"}</td>
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
