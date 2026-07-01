import { useState, useEffect, useCallback } from "react";
import {
  collection, getDocs, query, where, doc, setDoc, getDoc,
} from "firebase/firestore";
import { db } from "../../firebase";
import Sidebar from "../../components/Sidebar";
import {
  FaSearch, FaCheckCircle, FaClock, FaExclamationCircle,
  FaTimes, FaSave, FaMoneyBillWave, FaEdit, FaFilter, FaUser,
  FaInfoCircle, FaPrint, FaCog,
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

const DEFAULT_BATCHES = [
  { id: "2022-2026", name: "Batch 2022-2026", joiningYear: 22 },
  { id: "2023-2027", name: "Batch 2023-2027", joiningYear: 23 },
  { id: "2024-2028", name: "Batch 2024-2028", joiningYear: 24 },
  { id: "2025-2029", name: "Batch 2025-2029", joiningYear: 25 },
  { id: "2026-2030", name: "Batch 2026-2030", joiningYear: 26 }
];

function numberToWords(num) {
  const a = ['', 'one ', 'two ', 'three ', 'four ', 'five ', 'six ', 'seven ', 'eight ', 'nine ', 'ten ', 'eleven ', 'twelve ', 'thirteen ', 'fourteen ', 'fifteen ', 'sixteen ', 'seventeen ', 'eighteen ', 'nineteen '];
  const b = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

  if ((num = num.toString()).length > 9) return 'overflow';
  let n = ('000000000' + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
  if (!n) return ''; 
  let str = '';
  str += (n[1] != 0) ? (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]) + 'crore ' : '';
  str += (n[2] != 0) ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) + 'lakh ' : '';
  str += (n[3] != 0) ? (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]]) + 'thousand ' : '';
  str += (n[4] != 0) ? (a[Number(n[4])] || b[n[4][0]] + ' ' + a[n[4][1]]) + 'hundred ' : '';
  str += (n[5] != 0) ? ((str != '') ? 'and ' : '') + (a[Number(n[5])] || b[n[5][0]] + ' ' + a[n[5][1]]) : '';
  return str.trim() ? str.toUpperCase() + ' RUPEES ONLY' : 'ZERO RUPEES ONLY';
}

export default function StudentFeeRecords() {
  const [depts, setDepts]                 = useState([]);
  const [filterDept, setFilterDept]       = useState("");
  const [filterBatchId, setFilterBatchId] = useState("");
  const [filterSection, setFilterSection] = useState("A");
  const [searchText, setSearchText]       = useState("");

  const [batches, setBatches]             = useState([]);
  const [students, setStudents]           = useState([]);
  const [feeStructure, setFeeStructure]   = useState(null); // may be null
  const [paymentMap, setPaymentMap]       = useState({});   // uid → { semKey: payDoc }
  const [loading, setLoading]             = useState(false);

  // Detail modal (click student name)
  const [detailStudent, setDetailStudent] = useState(null);

  // Receipt Layout Configuration
  const [activeReceipt, setActiveReceipt] = useState(null);
  const [showReceiptConfig, setShowReceiptConfig] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [receiptConfig, setReceiptConfig] = useState({
    collegeName: "METROPOLITAN INSTITUTE OF TECHNOLOGY",
    collegeSubtitle: "Approved by AICTE & Affiliated to State University",
    collegeAddress: "123 Educational Campus, Knowledge City - 600001",
    receiptFooter: "This is a computer-generated receipt and does not require a physical signature.",
  });

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
    loadBatches();
    const loadReceiptConfig = async () => {
      try {
        const snap = await getDoc(doc(db, "config", "receipt"));
        if (snap.exists()) {
          setReceiptConfig(snap.data());
        }
      } catch (e) {
        console.error(e);
      }
    };
    loadReceiptConfig();
  }, []);

  const loadBatches = async () => {
    try {
      const snap = await getDoc(doc(db, "config", "batches"));
      if (snap.exists() && Array.isArray(snap.data().list)) {
        setBatches(snap.data().list);
        setFilterBatchId(""); // Default to All Batches
      } else {
        setBatches(DEFAULT_BATCHES);
        setFilterBatchId("");
      }
    } catch (e) {
      console.error(e);
      setBatches(DEFAULT_BATCHES);
      setFilterBatchId("");
    }
  };

  const [allFeeStructures, setAllFeeStructures] = useState({});

  // ── Load students + fee structures + payments ──────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      let q = collection(db, "users");
      const constraints = [where("role", "==", "student")];

      if (filterDept) {
        constraints.push(where("dept", "==", filterDept));
      }

      if (filterBatchId) {
        const selectedBatch = batches.find(b => b.id === filterBatchId);
        const joiningYear = selectedBatch ? selectedBatch.joiningYear : 24;
        constraints.push(where("admissionYear", "==", parseInt(joiningYear)));
      }

      if (filterSection) {
        constraints.push(where("section", "==", filterSection));
      }

      const studSnap = await getDocs(query(q, ...constraints));
      const studList = studSnap.docs.map(d => ({ uid: d.id, ...d.data() }));
      setStudents(studList);

      // Fetch all fee structures in the system
      const fsSnap = await getDocs(collection(db, "feeStructures"));
      const structures = {};
      for (const fsDoc of fsSnap.docs) {
        const meta = fsDoc.data();
        const semsSnap = await getDocs(collection(db, "feeStructures", fsDoc.id, "semesters"));
        const sems = {};
        semsSnap.forEach(s => { sems[s.id] = s.data(); });
        structures[fsDoc.id] = { ...meta, sems };
      }
      setAllFeeStructures(structures);

      // Payment records for every student
      const pMap = {};
      for (const stud of studList) {
        const paySnap = await getDocs(collection(db, "feePayments", stud.uid, "semesters"));
        pMap[stud.uid] = {};
        paySnap.forEach(d => { pMap[stud.uid][d.id] = d.data(); });
      }
      setPaymentMap(pMap);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [filterDept, filterBatchId, filterSection, batches]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  // Compute student summary from payment records
  const getStudentSummary = (uid, student) => {
    if (!student) return { paidAmount: 0, paidSems: 0, totalSems: 0, expectedTotal: 0, overdueCount: 0 };
    const payments = paymentMap[uid] || {};
    const payDocs = Object.values(payments);
    const paidDocs = payDocs.filter(p => p.status === "paid");
    const paidAmount = paidDocs.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
    const paidSems = paidDocs.length;

    // Resolve fee structure key for this student
    const sBatch = batches.find(b => b.joiningYear === parseInt(student.admissionYear));
    const sBatchId = sBatch ? sBatch.id : `20${student.admissionYear}-20${parseInt(student.admissionYear) + 4}`;
    const key = `${student.dept}_B${sBatchId}_${student.section || "A"}`;
    const fs = allFeeStructures[key] || allFeeStructures[`${student.dept}_B${sBatchId}_A` /* fallback A */];

    const semsList = fs ? Object.values(fs.sems).sort((a, b) => a.semester - b.semester) : [];
    let expectedTotal = 0;
    if (semsList.length > 0) {
      expectedTotal = semsList.reduce((s, x) => s + (parseFloat(x.amount) || 0), 0);
    } else {
      expectedTotal = payDocs.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
    }

    const overdueCount = semsList.filter(s => {
      const pay = payments[`sem${s.semester}`];
      return !pay && s.deadline && new Date(s.deadline) < new Date();
    }).length;

    return { paidAmount, paidSems, totalSems: semsList.length || paidSems, expectedTotal, overdueCount };
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
      year:        parseInt(selected.year) || 1,
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
  const filteredStudents = students.filter(s =>
    !searchText ||
    s.name?.toLowerCase().includes(searchText.toLowerCase()) ||
    s.rollNo?.toLowerCase().includes(searchText.toLowerCase())
  );

  // Summary stats for the filter
  const totalStudents = filteredStudents.length;
  const fullyPaid = filteredStudents.filter(s => {
    const { paidSems, totalSems } = getStudentSummary(s.uid, s);
    return totalSems > 0 && paidSems >= totalSems;
  }).length;

  const handleSaveReceiptConfig = async (e) => {
    e.preventDefault();
    setSavingConfig(true);
    try {
      await setDoc(doc(db, "config", "receipt"), receiptConfig);
      setShowReceiptConfig(false);
    } catch (err) {
      alert("Failed to save receipt template: " + err.message);
    }
    setSavingConfig(false);
  };

  const handlePrint = (student, sem, pay) => {
    setActiveReceipt({ student, semester: sem, payment: pay });
    setTimeout(() => {
      window.print();
    }, 100);
  };

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
                <option value="">All Departments</option>
                {depts.map(d => <option key={d.id} value={d.name || d.id}>{d.name || d.id}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Batch</label>
              <select className="form-control" value={filterBatchId} onChange={e => setFilterBatchId(e.target.value)}>
                <option value="">All Batches</option>
                {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
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
            <div className="form-group" style={{ marginBottom: 0, display: "flex", alignItems: "flex-end" }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ width: "100%", height: "45px", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                onClick={() => setShowReceiptConfig(true)}
              >
                <FaCog /> Template Settings
              </button>
            </div>
          </div>

          {/* Financial Dues Summary Cards */}
          {!loading && students.length > 0 && (
            <div style={{
              display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: 16, marginTop: 16, marginBottom: 16
            }}>
              {(() => {
                let totalExpected = 0;
                let totalPaid = 0;
                students.forEach(s => {
                  const summary = getStudentSummary(s.uid, s);
                  totalExpected += summary.expectedTotal;
                  totalPaid += summary.paidAmount;
                });
                const totalDues = Math.max(0, totalExpected - totalPaid);
                return (
                  <>
                    <div style={{ background: "rgba(255,255,255,0.02)", padding: "16px", borderRadius: 12, border: "1px solid var(--border)" }}>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 1 }}>Expected Collections</div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: "var(--accent-blue)", marginTop: 4 }}>₹{totalExpected.toLocaleString("en-IN")}</div>
                    </div>
                    <div style={{ background: "rgba(255,255,255,0.02)", padding: "16px", borderRadius: 12, border: "1px solid var(--border)" }}>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 1 }}>Collected Amount</div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: "var(--accent-green)", marginTop: 4 }}>₹{totalPaid.toLocaleString("en-IN")}</div>
                    </div>
                    <div style={{ background: "rgba(248,113,113,0.04)", padding: "16px", borderRadius: 12, border: "1px solid rgba(248,113,113,0.2)" }}>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 1 }}>Outstanding Dues</div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: "var(--accent-red)", marginTop: 4 }}>₹{totalDues.toLocaleString("en-IN")}</div>
                    </div>
                    <div style={{ background: "rgba(255,255,255,0.02)", padding: "16px", borderRadius: 12, border: "1px solid var(--border)" }}>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 1 }}>Dues Clearance</div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text-color)", marginTop: 4 }}>
                        {totalExpected > 0 ? `${Math.round((totalPaid / totalExpected) * 100)}%` : "100%"}
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </div>

        {/* ── Main Table ── */}
        {loading ? (
          <div className="loading-center"><div className="spinner" /></div>
        ) : filteredStudents.length === 0 ? (
          <div className="glass-card" style={{ textAlign: "center", padding: "48px 24px", color: "var(--text-muted)" }}>
            No students found for this filter.
          </div>
        ) : (
          <div className="glass-card">
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 20 }}>
              {filteredStudents.length} Students · {filterDept || "All Departments"} · {batches.find(b => b.id === filterBatchId)?.name || "All Batches"} · Section {filterSection}
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
                    const { paidAmount, paidSems, totalSems, expectedTotal, overdueCount } = getStudentSummary(stud.uid, stud);
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
                    <code>{detailStudent.rollNo}</code> · {filterDept} · Year {detailStudent.year || 1} · Section {filterSection}
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
                const { paidAmount, paidSems, totalSems, expectedTotal } = getStudentSummary(detailStudent.uid, detailStudent);
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
                {(() => {
                  const sBatch = batches.find(b => b.joiningYear === parseInt(detailStudent.admissionYear));
                  const sBatchId = sBatch ? sBatch.id : `20${detailStudent.admissionYear}-20${parseInt(detailStudent.admissionYear) + 4}`;
                  const key = `${detailStudent.dept}_B${sBatchId}_${detailStudent.section || "A"}`;
                  const fs = allFeeStructures[key] || allFeeStructures[`${detailStudent.dept}_B${sBatchId}_A` /* fallback A */];
                  const studentSemList = fs ? Object.values(fs.sems).sort((a, b) => a.semester - b.semester) : [];

                  return studentSemList.length > 0 ? studentSemList.map(s => {
                    const pay = paymentMap[detailStudent.uid]?.[`sem${s.semester}`];
                    const isOverdue = !pay && s.deadline && new Date(s.deadline) < new Date();
                    const status = pay?.status === "paid" ? "paid" : isOverdue ? "overdue" : "pending";
                    return (
                      <div key={s.semester} style={{
                        padding: "12px 14px", background: "rgba(255,255,255,0.04)",
                        border: "1px solid var(--border)", borderRadius: 10,
                        display: "flex", flexDirection: "column", justifyContent: "space-between"
                      }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>Semester {s.semester}</div>
                          <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 4 }}>
                            ₹{(s.amount || 0).toLocaleString("en-IN")}
                          </div>
                          {s.deadline && <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>Due: {s.deadline}</div>}
                          <StatusBadge status={status} />
                          {pay?.status === "paid" && (
                            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6, lineHeight: "1.4" }}>
                              Paid On: {pay.paidOn}<br />
                              Method: {pay.method}<br />
                              Receipt: {pay.receiptNo ? `#${pay.receiptNo}` : "—"}
                            </div>
                          )}
                        </div>
                        <div>
                          {pay?.status === "paid" ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
                              <button
                                className="btn btn-secondary btn-sm"
                                style={{ padding: "4px 8px", fontSize: 11, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}
                                onClick={() => handlePrint(detailStudent, s, pay)}
                              >
                                <FaPrint /> Print Receipt
                              </button>
                              <button
                                className="btn btn-secondary btn-sm"
                                style={{ padding: "4px 8px", fontSize: 11, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}
                                onClick={() => { setDetailStudent(null); openPayModal(detailStudent, s); }}
                              >
                                <FaEdit /> Update Payment
                              </button>
                            </div>
                          ) : (
                            <button
                              className="btn btn-primary btn-sm"
                              style={{ padding: "5px 8px", fontSize: 11, marginTop: 8, width: "100%" }}
                              onClick={() => { setDetailStudent(null); openPayModal(detailStudent, s); }}
                            >
                              <FaMoneyBillWave /> Mark Paid
                            </button>
                          )}
                        </div>
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
                              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
                                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                                  {pay.paidOn} · {pay.method}{pay.receiptNo ? ` · #${pay.receiptNo}` : ""}
                                </div>
                                <button
                                  className="btn btn-secondary btn-sm"
                                  style={{ padding: "4px 8px", fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}
                                  onClick={() => handlePrint(detailStudent, { semester: pay.semester || semKey.replace("sem", "") }, pay)}
                                >
                                  <FaPrint /> Print Receipt
                                </button>
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
                  );
                })()}
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

        {/* Receipt Config Modal */}
        {showReceiptConfig && (
          <div className="modal-overlay" onClick={() => setShowReceiptConfig(false)}>
            <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: 500, width: "100%" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <h3 style={{ fontSize: 18, fontWeight: 700 }}>⚙️ Configure Receipt Template</h3>
                <button style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "var(--text-secondary)" }} onClick={() => setShowReceiptConfig(false)}>
                  <FaTimes />
                </button>
              </div>
              <form onSubmit={handleSaveReceiptConfig}>
                <div className="form-group">
                  <label>College Name (Header 1)</label>
                  <input
                    className="form-control"
                    value={receiptConfig.collegeName}
                    onChange={e => setReceiptConfig(f => ({ ...f, collegeName: e.target.value }))}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Subtitle / Affiliation (Header 2)</label>
                  <input
                    className="form-control"
                    value={receiptConfig.collegeSubtitle}
                    onChange={e => setReceiptConfig(f => ({ ...f, collegeSubtitle: e.target.value }))}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Address details (Header 3)</label>
                  <input
                    className="form-control"
                    value={receiptConfig.collegeAddress}
                    onChange={e => setReceiptConfig(f => ({ ...f, collegeAddress: e.target.value }))}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Terms / Footer Note</label>
                  <textarea
                    className="form-control"
                    rows="3"
                    value={receiptConfig.receiptFooter}
                    onChange={e => setReceiptConfig(f => ({ ...f, receiptFooter: e.target.value }))}
                    required
                  />
                </div>
                <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                  <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={savingConfig}>
                    {savingConfig ? <span className="spinner" /> : <><FaSave style={{ marginRight: 6 }} />Save Settings</>}
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowReceiptConfig(false)}>
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>

      {/* Printable Area for Receipt */}
      {activeReceipt && (
        <div id="printable-receipt-area" style={{ display: "none" }}>
          <div style={{
            padding: "40px", fontFamily: "serif", color: "#000", background: "#fff",
            border: "2px double #000", maxWidth: "800px", margin: "0 auto"
          }}>
            {/* Header / Letterhead */}
            <div style={{ textAlign: "center", borderBottom: "3px double #000", paddingBottom: "15px", marginBottom: "20px" }}>
              <h1 style={{ margin: "0 0 5px 0", fontSize: "24px", fontWeight: "bold" }}>{receiptConfig.collegeName}</h1>
              <p style={{ margin: "0 0 5px 0", fontSize: "14px", fontStyle: "italic" }}>{receiptConfig.collegeSubtitle}</p>
              <p style={{ margin: "0", fontSize: "12px" }}>{receiptConfig.collegeAddress}</p>
            </div>

            {/* Receipt Title */}
            <div style={{ textAlign: "center", marginBottom: "25px" }}>
              <h2 style={{ margin: "0", fontSize: "18px", textDecoration: "underline", fontWeight: "bold", letterSpacing: "1px" }}>FEES PAYMENT RECEIPT</h2>
            </div>

            {/* Receipt Meta Details */}
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px", fontSize: "14px" }}>
              <div>
                <p style={{ margin: "0 0 6px 0" }}><strong>Receipt No:</strong> #{activeReceipt.payment.receiptNo || "N/A"}</p>
                <p style={{ margin: "0" }}><strong>Payment Date:</strong> {activeReceipt.payment.paidOn}</p>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ margin: "0 0 6px 0" }}><strong>Admission Year:</strong> 20{activeReceipt.student.admissionYear || "—"}</p>
                <p style={{ margin: "0" }}><strong>Current Year of Study:</strong> Year {activeReceipt.student.year || 1}</p>
              </div>
            </div>

            {/* Student Info Table */}
            <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "25px", fontSize: "14px" }}>
              <tbody>
                <tr style={{ borderBottom: "1px solid #ddd" }}>
                  <td style={{ padding: "8px 0", width: "150px" }}><strong>Student Name:</strong></td>
                  <td style={{ padding: "8px 0" }}>{activeReceipt.student.name}</td>
                  <td style={{ padding: "8px 0", width: "120px" }}><strong>Roll Number:</strong></td>
                  <td style={{ padding: "8px 0" }}><code>{activeReceipt.student.rollNo}</code></td>
                </tr>
                <tr style={{ borderBottom: "1px solid #ddd" }}>
                  <td style={{ padding: "8px 0" }}><strong>Department:</strong></td>
                  <td style={{ padding: "8px 0" }}>{activeReceipt.student.dept}</td>
                  <td style={{ padding: "8px 0" }}><strong>Section:</strong></td>
                  <td style={{ padding: "8px 0" }}>Section {activeReceipt.student.section || "A"}</td>
                </tr>
              </tbody>
            </table>

            {/* Payment Details Table */}
            <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "25px", fontSize: "14px" }}>
              <thead>
                <tr style={{ background: "#f5f5f5" }}>
                  <th style={{ padding: "10px", border: "1px solid #000", textAlign: "left" }}>Description</th>
                  <th style={{ padding: "10px", border: "1px solid #000", textAlign: "center", width: "120px" }}>Semester</th>
                  <th style={{ padding: "10px", border: "1px solid #000", textAlign: "right", width: "150px" }}>Amount Paid</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: "12px 10px", border: "1px solid #000" }}>
                    <strong>Academic Fee Payment</strong><br />
                    <span style={{ fontSize: "12px", color: "#555" }}>Mode of Payment: {activeReceipt.payment.method} {activeReceipt.payment.notes ? `(${activeReceipt.payment.notes})` : ""}</span>
                  </td>
                  <td style={{ padding: "12px 10px", border: "1px solid #000", textAlign: "center" }}>Semester {activeReceipt.semester.semester}</td>
                  <td style={{ padding: "12px 10px", border: "1px solid #000", textAlign: "right", fontWeight: "bold" }}>₹{(activeReceipt.payment.amount || 0).toLocaleString("en-IN")}.00</td>
                </tr>
                <tr style={{ fontWeight: "bold" }}>
                  <td colSpan="2" style={{ padding: "10px", border: "1px solid #000", textAlign: "right" }}>Total Amount:</td>
                  <td style={{ padding: "10px", border: "1px solid #000", textAlign: "right" }}>₹{(activeReceipt.payment.amount || 0).toLocaleString("en-IN")}.00</td>
                </tr>
              </tbody>
            </table>

            {/* Amount in words */}
            <div style={{ marginBottom: "40px", fontSize: "14px", border: "1px dashed #000", padding: "12px" }}>
              <strong>Amount in Words:</strong> {numberToWords(activeReceipt.payment.amount || 0)}
            </div>

            {/* Signatures */}
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "60px", fontSize: "14px" }}>
              <div style={{ textAlign: "center", width: "200px" }}>
                <div style={{ borderTop: "1px solid #000", paddingTop: "5px" }}>Student Signature</div>
              </div>
              <div style={{ textAlign: "center", width: "200px" }}>
                <div style={{ borderTop: "1px solid #000", paddingTop: "5px" }}>Authorized Signatory</div>
              </div>
            </div>

            {/* Footer Notice */}
            <div style={{ marginTop: "40px", borderTop: "1px solid #ddd", paddingTop: "10px", textAlign: "center", fontSize: "11px", color: "#666" }}>
              {receiptConfig.receiptFooter}
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Print CSS Style */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-receipt-area, #printable-receipt-area * {
            visibility: visible !important;
          }
          #printable-receipt-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            display: block !important;
            background: white !important;
          }
          @page {
            size: auto;
            margin: 10mm 15mm;
          }
        }
      `}</style>
    </div>
  );
}
