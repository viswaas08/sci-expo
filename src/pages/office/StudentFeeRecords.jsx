import { useState, useEffect, useCallback } from "react";
import {
  collection, getDocs, query, where, doc, setDoc, getDoc,
} from "firebase/firestore";
import { db } from "../../firebase";
import Sidebar from "../../components/Sidebar";
import {
  FaSearch, FaCheckCircle, FaClock, FaExclamationCircle,
  FaTimes, FaSave, FaMoneyBillWave, FaEdit, FaFilter, FaUser,
  FaInfoCircle,
} from "react-icons/fa";

const PAYMENT_METHODS = ["Cash", "Cheque/DD", "Online Transfer", "UPI", "Card"];

function StatusBadge({ status }) {
  const map = {
    paid:    { cls: "badge-green",  label: "✓ Paid",  icon: <FaCheckCircle /> },
    pending: { cls: "badge-yellow", label: "Pending", icon: <FaClock /> },
    overdue: { cls: "badge-red",    label: "Overdue", icon: <FaExclamationCircle /> },
  };
  const s = map[status] || map.pending;
  return (
    <span className={`badge ${s.cls}`} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      {s.icon} {s.label}
    </span>
  );
}

export default function StudentFeeRecords() {
  const [depts, setDepts]                 = useState([]);
  const [filterDept, setFilterDept]       = useState("");
  const [filterYear, setFilterYear]       = useState("1");
  const [filterSection, setFilterSection] = useState("A");
  const [searchText, setSearchText]       = useState("");

  const [students, setStudents]           = useState([]);
  const [feeStructure, setFeeStructure]   = useState(null); // may be null
  const [paymentMap, setPaymentMap]       = useState({});   // uid → { semKey: payDoc }
  const [loading, setLoading]             = useState(false);

  // Detail modal (click student name)
  const [detailStudent, setDetailStudent] = useState(null);

  // Payment form modal (mark paid / edit)
  const [selected, setSelected]           = useState(null);
  const [modalSem, setModalSem]           = useState(null);
  const [payForm, setPayForm]             = useState({ amount: "", method: "Cash", receiptNo: "", paidOn: "", notes: "", semester: "" });
  const [saving, setSaving]               = useState(false);
  const [success, setSuccess]             = useState("");

  useEffect(() => {
    getDocs(collection(db, "departments")).then(snap =>
      setDepts(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
  }, []);

  // ── Load students + fee structure + payments ──────────────────────────────
  const loadData = useCallback(async () => {
    if (!filterDept) return;
    setLoading(true);
    try {
      // Students (no fee structure required)
      const q = query(
        collection(db, "users"),
        where("role", "==", "student"),
        where("dept", "==", filterDept),
        where("year", "==", parseInt(filterYear)),
        where("section", "==", filterSection),
      );
      const studSnap = await getDocs(q);
      const studList = studSnap.docs.map(d => ({ uid: d.id, ...d.data() }));
      setStudents(studList);

      // Fee structure (optional – may not exist)
      const key = `${filterDept}_Y${filterYear}_${filterSection}`;
      const fsMeta = await getDoc(doc(db, "feeStructures", key));
      let structure = null;
      if (fsMeta.exists()) {
        const semsSnap = await getDocs(collection(db, "feeStructures", key, "semesters"));
        const sems = {};
        semsSnap.forEach(d => { sems[d.id] = d.data(); });
        structure = { ...fsMeta.data(), sems };
      }
      setFeeStructure(structure);

      // Payment records for every student (works without fee structure)
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

  // ── Helpers ───────────────────────────────────────────────────────────────
  const getSemList = () =>
    feeStructure
      ? Object.values(feeStructure.sems).sort((a, b) => a.semester - b.semester)
      : [];

  // Compute student summary from payment records
  const getStudentSummary = (uid) => {
    const payments = paymentMap[uid] || {};
    const payDocs = Object.values(payments);
    const paidDocs = payDocs.filter(p => p.status === "paid");
    const paidAmount = paidDocs.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
    const paidSems = paidDocs.length;
    const totalSems = payDocs.length;

    // If fee structure available also compute expected
    const semList = getSemList();
    let expectedTotal = 0;
    if (semList.length > 0) {
      expectedTotal = semList.reduce((s, x) => s + (parseFloat(x.amount) || 0), 0);
    } else {
      // From payment docs themselves
      expectedTotal = payDocs.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
    }
    const overdueCount = semList.filter(s => {
      const pay = payments[`sem${s.semester}`];
      return !pay && s.deadline && new Date(s.deadline) < new Date();
    }).length;

    return { paidAmount, paidSems, totalSems, expectedTotal, overdueCount };
  };

  // ── Open fee entry modal ──────────────────────────────────────────────────
  const openPayModal = (student, sem) => {
    const key = sem ? `sem${sem.semester}` : null;
    const existingPay = key ? paymentMap[student.uid]?.[key] : null;
    setSelected(student);
    setModalSem(sem || null);
    setPayForm({
      amount:    existingPay?.amount    || sem?.amount || "",
      method:    existingPay?.method    || "Cash",
      receiptNo: existingPay?.receiptNo || "",
      paidOn:    existingPay?.paidOn    || new Date().toISOString().split("T")[0],
      notes:     existingPay?.notes     || "",
      semester:  sem?.semester || "",
    });
    setSuccess("");
  };

  // Open from "Add Payment" with manual sem number (no fee structure case)
  const openManualPayModal = (student) => {
    setSelected(student);
    setModalSem(null);
    setPayForm({ amount: "", method: "Cash", receiptNo: "", paidOn: new Date().toISOString().split("T")[0], notes: "", semester: "" });
    setSuccess("");
  };

  // ── Save payment ──────────────────────────────────────────────────────────
  const handleMarkPaid = async (e) => {
    e.preventDefault();
    setSaving(true);
    const semNum = modalSem ? modalSem.semester : parseInt(payForm.semester);
    if (!semNum) { setSaving(false); return; }
    const semKey = `sem${semNum}`;
    const baseData = {
      studentUid:  selected.uid,
      studentName: selected.name || "",
      rollNo:      selected.rollNo || "",
      dept:        filterDept,
      year:        parseInt(filterYear),
      section:     filterSection,
      semester:    semNum,
      amount:      parseFloat(payForm.amount) || 0,
      method:      payForm.method,
      receiptNo:   payForm.receiptNo,
      paidOn:      payForm.paidOn,
      notes:       payForm.notes,
      status:      "paid",
      recordedAt:  new Date().toISOString(),
    };
    try {
      await setDoc(doc(db, "feePayments", selected.uid, "semesters", semKey), baseData, { merge: true });
      await setDoc(doc(db, "feePayments", `${selected.uid}_${semKey}`), baseData, { merge: true });
      setSuccess(`✅ Payment recorded for ${selected.name} – Semester ${semNum}`);
      await loadData();
      setTimeout(() => { setSelected(null); setModalSem(null); setSuccess(""); }, 1400);
    } catch (err) {
      console.error(err);
      setSuccess("❌ Error saving payment.");
    }
    setSaving(false);
  };

  // ── Derived ───────────────────────────────────────────────────────────────
  const semList = getSemList();
  const filteredStudents = students.filter(s =>
    !searchText ||
    s.name?.toLowerCase().includes(searchText.toLowerCase()) ||
    s.rollNo?.toLowerCase().includes(searchText.toLowerCase())
  );

  // Summary stats for the filter
  const totalStudents = filteredStudents.length;
  const fullyPaid = filteredStudents.filter(s => {
    const { paidSems, totalSems } = getStudentSummary(s.uid);
    return totalSems > 0 && paidSems >= totalSems;
  }).length;

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content animate-fade-up">
        <div className="page-header">
          <h1>💰 Student Fee Records</h1>
          <p>View all students' payment status — click a name for semester-wise details</p>
        </div>

        {/* ── Filters ── */}
        <div className="glass-card" style={{ marginBottom: 24 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 14, alignItems: "end" }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label><FaFilter style={{ marginRight: 6 }} />Department</label>
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
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label><FaSearch style={{ marginRight: 6 }} />Search Student</label>
              <input
                className="form-control"
                placeholder="Name or roll no..."
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
              />
            </div>
          </div>

          {/* Summary bar */}
          {filterDept && !loading && students.length > 0 && (
            <div style={{ display: "flex", gap: 20, marginTop: 14, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                👥 <strong style={{ color: "var(--text-color)" }}>{totalStudents}</strong> students
              </span>
              <span style={{ fontSize: 13, color: "var(--accent-green)" }}>
                ✓ <strong>{fullyPaid}</strong> fully paid
              </span>
              <span style={{ fontSize: 13, color: "var(--accent-orange)" }}>
                ⏳ <strong>{totalStudents - fullyPaid}</strong> partial / unpaid
              </span>
              {!feeStructure && (
                <span style={{ fontSize: 12, color: "var(--accent-orange)", background: "rgba(251,146,60,0.1)", padding: "3px 10px", borderRadius: 20 }}>
                  ⚠ No fee structure set — showing payment records only
                </span>
              )}
            </div>
          )}
        </div>

        {/* ── Main Table ── */}
        {!filterDept ? (
          <div className="glass-card" style={{ textAlign: "center", padding: "56px 24px", color: "var(--text-muted)" }}>
            <FaSearch style={{ fontSize: 40, marginBottom: 16, opacity: 0.3 }} />
            <p style={{ fontSize: 15 }}>Select a department to view student fee records.</p>
          </div>
        ) : loading ? (
          <div className="loading-center"><div className="spinner" /></div>
        ) : filteredStudents.length === 0 ? (
          <div className="glass-card" style={{ textAlign: "center", padding: "48px 24px", color: "var(--text-muted)" }}>
            No students found for this filter.
          </div>
        ) : (
          <div className="glass-card">
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 20 }}>
              {filteredStudents.length} Students · {filterDept} · Year {filterYear} · Section {filterSection}
            </h3>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Name</th>
                    <th>Roll No</th>
                    <th>Sems Paid</th>
                    <th>Amount Paid</th>
                    <th>Balance Due</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map((stud, i) => {
                    const { paidAmount, paidSems, totalSems, expectedTotal, overdueCount } = getStudentSummary(stud.uid);
                    const balance = expectedTotal - paidAmount;
                    const allPaid = totalSems > 0 && paidSems >= totalSems;
                    const rowStatus = allPaid ? "paid" : overdueCount > 0 ? "overdue" : "pending";

                    return (
                      <tr key={stud.uid}>
                        <td style={{ color: "var(--text-muted)", fontSize: 13 }}>{i + 1}</td>
                        <td>
                          {/* Clickable name → detail modal */}
                          <button
                            onClick={() => setDetailStudent(stud)}
                            style={{
                              background: "none", border: "none", cursor: "pointer",
                              color: "var(--accent-blue)", fontWeight: 600, fontSize: 14,
                              textDecoration: "underline", textUnderlineOffset: 3, padding: 0,
                              textAlign: "left",
                            }}
                          >
                            {stud.name || "—"}
                          </button>
                        </td>
                        <td><code style={{ fontSize: 12 }}>{stud.rollNo || stud.uid.slice(-6)}</code></td>
                        <td style={{ fontWeight: 600 }}>
                          {paidSems > 0
                            ? <><span style={{ color: "var(--accent-green)" }}>{paidSems}</span>{totalSems > 0 ? <span style={{ color: "var(--text-muted)", fontSize: 12 }}> / {totalSems}</span> : ""}</>
                            : <span style={{ color: "var(--text-muted)" }}>0</span>}
                        </td>
                        <td style={{ color: "var(--accent-green)", fontWeight: 600 }}>
                          {paidAmount > 0 ? `₹${paidAmount.toLocaleString("en-IN")}` : <span style={{ color: "var(--text-muted)" }}>—</span>}
                        </td>
                        <td style={{ color: balance > 0 ? "var(--accent-red)" : "var(--text-muted)", fontWeight: balance > 0 ? 600 : 400 }}>
                          {balance > 0 ? `₹${balance.toLocaleString("en-IN")}` : "—"}
                        </td>
                        <td><StatusBadge status={rowStatus} /></td>
                        <td>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button
                              className="btn btn-secondary"
                              style={{ padding: "5px 10px", fontSize: 12 }}
                              onClick={() => setDetailStudent(stud)}
                              title="View payment details"
                            >
                              <FaUser style={{ marginRight: 4 }} />Details
                            </button>
                            <button
                              className="btn btn-primary"
                              style={{ padding: "5px 10px", fontSize: 12 }}
                              onClick={() => openManualPayModal(stud)}
                              title="Add payment"
                            >
                              <FaMoneyBillWave style={{ marginRight: 4 }} />Pay
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
             STUDENT DETAIL MODAL — click name
        ══════════════════════════════════════════════════════ */}
        {detailStudent && !selected && (
          <div className="modal-overlay" onClick={() => setDetailStudent(null)}>
            <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: 700, width: "100%" }}>
              {/* Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                <div>
                  <h3 style={{ fontSize: 20, fontWeight: 700 }}>{detailStudent.name}</h3>
                  <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
                    <code>{detailStudent.rollNo}</code> · {filterDept} · Year {filterYear} · Section {filterSection}
                  </p>
                </div>
                <button
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-secondary)", fontSize: 20 }}
                  onClick={() => setDetailStudent(null)}
                >
                  <FaTimes />
                </button>
              </div>

              {/* Summary boxes */}
              {(() => {
                const { paidAmount, paidSems, totalSems, expectedTotal } = getStudentSummary(detailStudent.uid);
                const balance = Math.max(0, expectedTotal - paidAmount);
                return (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
                    {[
                      { label: "Total Paid", value: `₹${paidAmount.toLocaleString("en-IN")}`, color: "var(--accent-green)", bg: "rgba(52,211,153,0.08)" },
                      { label: "Semesters Paid", value: `${paidSems} / ${totalSems || "—"}`, color: "var(--accent-blue)", bg: "rgba(79,156,249,0.08)" },
                      { label: "Balance Due", value: balance > 0 ? `₹${balance.toLocaleString("en-IN")}` : "Nil", color: balance > 0 ? "var(--accent-red)" : "var(--accent-green)", bg: balance > 0 ? "rgba(248,113,113,0.08)" : "rgba(52,211,153,0.08)" },
                    ].map(box => (
                      <div key={box.label} style={{ padding: "16px 18px", background: box.bg, borderRadius: 12, border: `1px solid ${box.color}33` }}>
                        <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>{box.label}</div>
                        <div style={{ fontSize: 20, fontWeight: 700, color: box.color }}>{box.value}</div>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* Per-semester breakdown */}
              <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: "var(--text-secondary)" }}>
                Semester-wise Payment History
              </h4>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10 }}>
                {/* Render fee-structure semesters if available */}
                {semList.length > 0 ? semList.map(s => {
                  const pay = paymentMap[detailStudent.uid]?.[`sem${s.semester}`];
                  const isOverdue = !pay && s.deadline && new Date(s.deadline) < new Date();
                  const status = pay?.status === "paid" ? "paid" : isOverdue ? "overdue" : "pending";
                  return (
                    <div key={s.semester} style={{
                      padding: "12px 14px", background: "rgba(255,255,255,0.04)",
                      border: "1px solid var(--border)", borderRadius: 10,
                    }}>
                      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>Semester {s.semester}</div>
                      <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 4 }}>
                        ₹{(s.amount || 0).toLocaleString("en-IN")}
                      </div>
                      {s.deadline && <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>Due: {s.deadline}</div>}
                      <StatusBadge status={status} />
                      {pay?.status === "paid" && (
                        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>
                          {pay.paidOn} · {pay.method}{pay.receiptNo ? ` · #${pay.receiptNo}` : ""}
                        </div>
                      )}
                      <button
                        className={`btn ${pay?.status === "paid" ? "btn-secondary" : "btn-primary"}`}
                        style={{ padding: "5px 8px", fontSize: 11, marginTop: 8, width: "100%" }}
                        onClick={() => { setDetailStudent(null); openPayModal(detailStudent, s); }}
                      >
                        {pay?.status === "paid" ? <><FaEdit /> Update</> : <><FaMoneyBillWave /> Mark Paid</>}
                      </button>
                    </div>
                  );
                }) : (
                  /* No fee structure — show from raw payment docs */
                  Object.entries(paymentMap[detailStudent.uid] || {}).length > 0 ? (
                    Object.entries(paymentMap[detailStudent.uid] || {})
                      .sort(([a], [b]) => parseInt(a.replace("sem","")) - parseInt(b.replace("sem","")))
                      .map(([semKey, pay]) => (
                        <div key={semKey} style={{
                          padding: "12px 14px", background: "rgba(255,255,255,0.04)",
                          border: "1px solid var(--border)", borderRadius: 10,
                        }}>
                          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
                            Semester {pay.semester || semKey.replace("sem", "")}
                          </div>
                          <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 6 }}>
                            ₹{(pay.amount || 0).toLocaleString("en-IN")}
                          </div>
                          <StatusBadge status={pay.status || "pending"} />
                          {pay.status === "paid" && (
                            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>
                              {pay.paidOn} · {pay.method}{pay.receiptNo ? ` · #${pay.receiptNo}` : ""}
                            </div>
                          )}
                        </div>
                      ))
                  ) : (
                    <div style={{
                      gridColumn: "1 / -1", textAlign: "center", padding: "32px 0",
                      color: "var(--text-muted)", fontSize: 14,
                    }}>
                      <FaInfoCircle style={{ fontSize: 28, marginBottom: 10, opacity: 0.3 }} />
                      <p>No payment records found for this student.</p>
                      <button
                        className="btn btn-primary"
                        style={{ marginTop: 12 }}
                        onClick={() => { setDetailStudent(null); openManualPayModal(detailStudent); }}
                      >
                        <FaMoneyBillWave style={{ marginRight: 6 }} />Add First Payment
                      </button>
                    </div>
                  )
                )}
              </div>

              {/* Footer action */}
              <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  className="btn btn-primary"
                  onClick={() => { setDetailStudent(null); openManualPayModal(detailStudent); }}
                >
                  <FaMoneyBillWave style={{ marginRight: 6 }} />Add Payment
                </button>
                <button className="btn btn-secondary" onClick={() => setDetailStudent(null)}>Close</button>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
             PAYMENT FORM MODAL
        ══════════════════════════════════════════════════════ */}
        {selected && (
          <div className="modal-overlay" onClick={() => { setSelected(null); setModalSem(null); }}>
            <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: 460, width: "100%" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <h3 style={{ fontSize: 17, fontWeight: 700 }}>
                  <FaMoneyBillWave style={{ marginRight: 8, color: "var(--accent-green)" }} />
                  {modalSem ? `Semester ${modalSem.semester} · ` : "Record Payment · "}{selected.name}
                </h3>
                <button
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-secondary)", fontSize: 20 }}
                  onClick={() => { setSelected(null); setModalSem(null); }}
                >
                  <FaTimes />
                </button>
              </div>

              {success && (
                <div className={`alert ${success.startsWith("✅") ? "alert-success" : "alert-error"}`} style={{ marginBottom: 16 }}>
                  {success}
                </div>
              )}

              <form onSubmit={handleMarkPaid}>
                {/* Manual semester selector when no fee structure */}
                {!modalSem && (
                  <div className="form-group">
                    <label>Semester Number</label>
                    <input
                      className="form-control"
                      type="number"
                      min="1" max="8"
                      placeholder="e.g. 1"
                      value={payForm.semester}
                      onChange={e => setPayForm(f => ({ ...f, semester: e.target.value }))}
                      required
                    />
                  </div>
                )}
                <div className="form-group">
                  <label>Amount Paid (₹)</label>
                  <input
                    className="form-control"
                    type="number"
                    min="0"
                    placeholder="e.g. 45000"
                    value={payForm.amount}
                    onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Payment Date</label>
                  <input
                    className="form-control"
                    type="date"
                    value={payForm.paidOn}
                    onChange={e => setPayForm(f => ({ ...f, paidOn: e.target.value }))}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Payment Method</label>
                  <select
                    className="form-control"
                    value={payForm.method}
                    onChange={e => setPayForm(f => ({ ...f, method: e.target.value }))}
                  >
                    {PAYMENT_METHODS.map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Receipt Number</label>
                  <input
                    className="form-control"
                    placeholder="e.g. RCP-2025-001"
                    value={payForm.receiptNo}
                    onChange={e => setPayForm(f => ({ ...f, receiptNo: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label>Notes (optional)</label>
                  <input
                    className="form-control"
                    placeholder="Any remarks..."
                    value={payForm.notes}
                    onChange={e => setPayForm(f => ({ ...f, notes: e.target.value }))}
                  />
                </div>
                <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                  <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={saving}>
                    {saving ? <span className="spinner" /> : <><FaSave style={{ marginRight: 6 }} />Confirm Payment</>}
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => { setSelected(null); setModalSem(null); }}>
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
