import { useState, useEffect, useCallback } from "react";
import {
  collection, getDocs, query, where, doc, setDoc, updateDoc, orderBy, getDoc
} from "firebase/firestore";
import { db } from "../../firebase";
import Sidebar from "../../components/Sidebar";
import {
  FaSearch, FaCheckCircle, FaClock, FaExclamationCircle,
  FaTimes, FaSave, FaMoneyBillWave, FaEdit, FaFilter
} from "react-icons/fa";

const PAYMENT_METHODS = ["Cash", "Cheque/DD", "Online Transfer", "UPI", "Card"];

function StatusBadge({ status }) {
  const map = {
    paid:    { cls: "badge-green",  label: "✓ Paid",   icon: <FaCheckCircle /> },
    pending: { cls: "badge-yellow", label: "Pending",  icon: <FaClock /> },
    overdue: { cls: "badge-red",    label: "Overdue",  icon: <FaExclamationCircle /> },
  };
  const s = map[status] || map.pending;
  return <span className={`badge ${s.cls}`} style={{ display:"inline-flex", alignItems:"center", gap:4 }}>{s.icon} {s.label}</span>;
}

export default function StudentFeeRecords() {
  const [depts, setDepts] = useState([]);
  const [filterDept, setFilterDept]       = useState("");
  const [filterYear, setFilterYear]       = useState("1");
  const [filterSection, setFilterSection] = useState("A");
  const [students, setStudents] = useState([]);
  const [feeStructure, setFeeStructure]   = useState(null);
  const [paymentMap, setPaymentMap]       = useState({}); // uid → { semN: paymentDoc }
  const [loading, setLoading]  = useState(false);
  const [selected, setSelected] = useState(null); // selected student for modal
  const [modalSem, setModalSem] = useState(null);
  const [payForm, setPayForm]   = useState({ amount: "", method: "Cash", receiptNo: "", paidOn: "", notes: "" });
  const [saving, setSaving]     = useState(false);
  const [success, setSuccess]   = useState("");

  useEffect(() => {
    getDocs(collection(db, "departments")).then(snap => {
      setDepts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, []);

  const loadData = useCallback(async () => {
    if (!filterDept) return;
    setLoading(true);
    try {
      // Fetch students
      const q = query(collection(db, "users"),
        where("role", "==", "student"),
        where("dept", "==", filterDept),
        where("year", "==", parseInt(filterYear)),
        where("section", "==", filterSection),
      );
      const studSnap = await getDocs(q);
      const studList = studSnap.docs.map(d => ({ uid: d.id, ...d.data() }));
      setStudents(studList);

      // Fetch fee structure
      const key = `${filterDept}_Y${filterYear}_${filterSection}`;
      const fsRef = doc(db, "feeStructures", key);
      const fsMeta = await getDoc(fsRef);
      let structure = null;
      if (fsMeta.exists()) {
        const semsSnap = await getDocs(collection(db, "feeStructures", key, "semesters"));
        const sems = {};
        semsSnap.forEach(d => { sems[d.id] = d.data(); });
        structure = { ...fsMeta.data(), sems };
      }
      setFeeStructure(structure);

      // Fetch all payment records for these students
      const pMap = {};
      for (const stud of studList) {
        const paySnap = await getDocs(collection(db, "feePayments", stud.uid, "semesters"));
        pMap[stud.uid] = {};
        paySnap.forEach(d => { pMap[stud.uid][d.id] = d.data(); });
      }
      setPaymentMap(pMap);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [filterDept, filterYear, filterSection]);

  useEffect(() => { loadData(); }, [loadData]);

  const openPayModal = (student, sem) => {
    const existingPay = paymentMap[student.uid]?.[`sem${sem.semester}`];
    setSelected(student);
    setModalSem(sem);
    setPayForm({
      amount:    existingPay?.amount    || sem.amount || "",
      method:    existingPay?.method    || "Cash",
      receiptNo: existingPay?.receiptNo || "",
      paidOn:    existingPay?.paidOn    || new Date().toISOString().split("T")[0],
      notes:     existingPay?.notes     || "",
    });
    setSuccess("");
  };

  const handleMarkPaid = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const semKey = `sem${modalSem.semester}`;
      await setDoc(
        doc(db, "feePayments", selected.uid, "semesters", semKey),
        {
          studentUid:  selected.uid,
          studentName: selected.name || "",
          rollNo:      selected.rollNo || "",
          dept:        filterDept,
          year:        parseInt(filterYear),
          section:     filterSection,
          semester:    modalSem.semester,
          amount:      parseFloat(payForm.amount) || 0,
          method:      payForm.method,
          receiptNo:   payForm.receiptNo,
          paidOn:      payForm.paidOn,
          notes:       payForm.notes,
          status:      "paid",
          recordedAt:  new Date().toISOString(),
        },
        { merge: true }
      );
      // Also update global feePayments collection for dashboard aggregation
      await setDoc(
        doc(db, "feePayments", `${selected.uid}_sem${modalSem.semester}`),
        {
          studentUid:  selected.uid,
          studentName: selected.name || "",
          dept:        filterDept,
          year:        parseInt(filterYear),
          semester:    modalSem.semester,
          amount:      parseFloat(payForm.amount) || 0,
          status:      "paid",
          paidOn:      payForm.paidOn,
          method:      payForm.method,
        },
        { merge: true }
      );
      setSuccess(`Payment marked for ${selected.name} – Semester ${modalSem.semester}`);
      await loadData();
      setSelected(null);
    } catch (e) {
      console.error(e);
      setSuccess("Error saving payment.");
    }
    setSaving(false);
  };

  const semList = feeStructure
    ? Object.values(feeStructure.sems).sort((a,b) => a.semester - b.semester)
    : [];

  const getStudentStatus = (uid) => {
    if (!feeStructure) return { paid: 0, total: 0, overdue: 0 };
    let paid = 0, total = 0, overdue = 0;
    semList.forEach(s => {
      total += parseFloat(s.amount) || 0;
      const pay = paymentMap[uid]?.[`sem${s.semester}`];
      if (pay?.status === "paid") paid += parseFloat(s.amount) || 0;
      else if (s.deadline && new Date(s.deadline) < new Date()) overdue += parseFloat(s.amount) || 0;
    });
    return { paid, total, overdue };
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content animate-fade-up">
        <div className="page-header">
          <h1>💰 Student Fee Records</h1>
          <p>View and manage student-wise fee payments, semester by semester</p>
        </div>

        {/* Filters */}
        <div className="glass-card" style={{ marginBottom: 24 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16, alignItems: "end" }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label><FaFilter style={{marginRight:6}} />Department</label>
              <select className="form-control" value={filterDept} onChange={e => setFilterDept(e.target.value)}>
                <option value="">-- Select --</option>
                {depts.map(d => <option key={d.id} value={d.name || d.id}>{d.name || d.id}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Year</label>
              <select className="form-control" value={filterYear} onChange={e => setFilterYear(e.target.value)}>
                {["1","2","3","4"].map(y => <option key={y} value={y}>Year {y}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Section</label>
              <select className="form-control" value={filterSection} onChange={e => setFilterSection(e.target.value)}>
                {["A","B","C","D"].map(s => <option key={s} value={s}>Section {s}</option>)}
              </select>
            </div>
          </div>
        </div>

        {!filterDept ? (
          <div className="glass-card" style={{ textAlign:"center", padding:"56px 24px", color:"var(--text-muted)" }}>
            <FaSearch style={{ fontSize:40, marginBottom:16, opacity:0.3 }} />
            <p style={{ fontSize:15 }}>Select a department to view student fee records.</p>
          </div>
        ) : loading ? (
          <div className="loading-center"><div className="spinner" /></div>
        ) : !feeStructure ? (
          <div className="glass-card" style={{ textAlign:"center", padding:"48px 24px", color:"var(--accent-orange)" }}>
            ⚠️ No fee structure configured for <strong>{filterDept} – Year {filterYear} – Section {filterSection}</strong>.
            Please set it up in <strong>Fee Structure</strong> first.
          </div>
        ) : students.length === 0 ? (
          <div className="glass-card" style={{ textAlign:"center", padding:"48px 24px", color:"var(--text-muted)" }}>
            No students found for this filter.
          </div>
        ) : (
          <div className="glass-card">
            <h3 style={{ fontSize:15, fontWeight:700, marginBottom:20 }}>
              {students.length} Students · {filterDept} · Year {filterYear} · Section {filterSection}
            </h3>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Name</th>
                    <th>Roll No</th>
                    <th>Paid</th>
                    <th>Total</th>
                    <th>Overdue</th>
                    {semList.map(s => <th key={s.semester}>Sem {s.semester}</th>)}
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((stud, i) => {
                    const { paid, total, overdue } = getStudentStatus(stud.uid);
                    return (
                      <tr key={stud.uid}>
                        <td style={{ color:"var(--text-muted)", fontSize:13 }}>{i+1}</td>
                        <td style={{ fontWeight:600 }}>{stud.name || "—"}</td>
                        <td><code style={{ fontSize:12 }}>{stud.rollNo || stud.uid.slice(-6)}</code></td>
                        <td style={{ color:"var(--accent-green)", fontWeight:600 }}>₹{paid.toLocaleString("en-IN")}</td>
                        <td>₹{total.toLocaleString("en-IN")}</td>
                        <td style={{ color: overdue > 0 ? "var(--accent-red)" : "var(--text-muted)" }}>
                          {overdue > 0 ? `₹${overdue.toLocaleString("en-IN")}` : "—"}
                        </td>
                        {semList.map(s => {
                          const pay = paymentMap[stud.uid]?.[`sem${s.semester}`];
                          const isOverdue = !pay && s.deadline && new Date(s.deadline) < new Date();
                          const status = pay?.status === "paid" ? "paid" : isOverdue ? "overdue" : "pending";
                          return (
                            <td key={s.semester} style={{ textAlign:"center" }}>
                              <StatusBadge status={status} />
                            </td>
                          );
                        })}
                        <td>
                          <button
                            className="btn btn-primary"
                            style={{ padding:"6px 12px", fontSize:12 }}
                            onClick={() => { setSelected(stud); setModalSem(null); }}
                          >
                            <FaEdit /> Manage
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Student detail modal */}
        {selected && !modalSem && (
          <div className="modal-overlay" onClick={() => setSelected(null)}>
            <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: 640, width:"100%" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
                <div>
                  <h3 style={{ fontSize:18, fontWeight:700 }}>{selected.name}</h3>
                  <p style={{ fontSize:13, color:"var(--text-muted)", marginTop:4 }}>
                    {filterDept} · Year {filterYear} · Section {filterSection}
                  </p>
                </div>
                <button style={{ background:"none", border:"none", cursor:"pointer", color:"var(--text-secondary)", fontSize:20 }} onClick={() => setSelected(null)}>
                  <FaTimes />
                </button>
              </div>

              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(200px, 1fr))", gap:12 }}>
                {semList.map(s => {
                  const pay = paymentMap[selected.uid]?.[`sem${s.semester}`];
                  const isOverdue = !pay && s.deadline && new Date(s.deadline) < new Date();
                  const status = pay?.status === "paid" ? "paid" : isOverdue ? "overdue" : "pending";
                  return (
                    <div key={s.semester} style={{
                      padding:"14px 16px", background:"rgba(255,255,255,0.04)",
                      border:"1px solid var(--border)", borderRadius:10
                    }}>
                      <div style={{ fontWeight:700, fontSize:14, marginBottom:8 }}>Semester {s.semester}</div>
                      <div style={{ fontSize:13, color:"var(--text-secondary)", marginBottom:4 }}>₹{(s.amount||0).toLocaleString("en-IN")}</div>
                      {s.deadline && <div style={{ fontSize:11, color:"var(--text-muted)", marginBottom:8 }}>Due: {s.deadline}</div>}
                      <StatusBadge status={status} />
                      {pay?.status === "paid" && (
                        <div style={{ fontSize:11, color:"var(--text-muted)", marginTop:6 }}>
                          {pay.paidOn} · {pay.method} · {pay.receiptNo && `#${pay.receiptNo}`}
                        </div>
                      )}
                      <button
                        className={`btn ${status === "paid" ? "btn-secondary" : "btn-primary"}`}
                        style={{ padding:"6px 10px", fontSize:12, marginTop:10, width:"100%" }}
                        onClick={() => openPayModal(selected, s)}
                      >
                        {status === "paid" ? <><FaEdit /> Update</> : <><FaMoneyBillWave /> Mark Paid</>}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Payment form modal */}
        {selected && modalSem && (
          <div className="modal-overlay" onClick={() => setModalSem(null)}>
            <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth:460, width:"100%" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
                <h3 style={{ fontSize:17, fontWeight:700 }}>
                  <FaMoneyBillWave style={{ marginRight:8, color:"var(--accent-green)" }} />
                  Semester {modalSem.semester} · {selected.name}
                </h3>
                <button style={{ background:"none", border:"none", cursor:"pointer", color:"var(--text-secondary)", fontSize:20 }} onClick={() => setModalSem(null)}>
                  <FaTimes />
                </button>
              </div>
              {success && <div className="alert alert-success" style={{ marginBottom:16 }}>{success}</div>}
              <form onSubmit={handleMarkPaid}>
                <div className="form-group">
                  <label>Amount Paid (₹)</label>
                  <input className="form-control" type="number" min="0" value={payForm.amount} onChange={e => setPayForm(f=>({...f,amount:e.target.value}))} required />
                </div>
                <div className="form-group">
                  <label>Payment Date</label>
                  <input className="form-control" type="date" value={payForm.paidOn} onChange={e => setPayForm(f=>({...f,paidOn:e.target.value}))} required />
                </div>
                <div className="form-group">
                  <label>Payment Method</label>
                  <select className="form-control" value={payForm.method} onChange={e => setPayForm(f=>({...f,method:e.target.value}))}>
                    {PAYMENT_METHODS.map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Receipt Number</label>
                  <input className="form-control" placeholder="e.g. RCP-2024-001" value={payForm.receiptNo} onChange={e => setPayForm(f=>({...f,receiptNo:e.target.value}))} />
                </div>
                <div className="form-group">
                  <label>Notes (optional)</label>
                  <input className="form-control" placeholder="Any remarks..." value={payForm.notes} onChange={e => setPayForm(f=>({...f,notes:e.target.value}))} />
                </div>
                <div style={{ display:"flex", gap:10, marginTop:8 }}>
                  <button type="submit" className="btn btn-primary" style={{ flex:1 }} disabled={saving}>
                    {saving ? <span className="spinner" /> : <><FaSave /> Confirm Payment</>}
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => setModalSem(null)}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
