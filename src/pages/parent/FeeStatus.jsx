import { useState, useEffect } from "react";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "../../firebase";
import Sidebar from "../../components/Sidebar";
import { useAuth } from "../../context/AuthContext";
import { FaCheckCircle, FaClock, FaExclamationCircle, FaInfoCircle } from "react-icons/fa";

function daysDiff(dateStr) {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24));
}

export default function FeeStatus() {
  const { userData, currentUser } = useAuth();
  const [semesters, setSemesters] = useState([]);
  const [payments, setPayments]   = useState({});
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");

  useEffect(() => {
    if (!currentUser || !userData) return;
    const fetchFees = async () => {
      try {
        // Find the student by parentUID or via studentUid linked to this parent
        let studentData = null;
        let studentUid  = null;

        if (userData.role === "parent") {
          // Try finding student linked to this parent
          const studUid = userData.studentUid || userData.childUid;
          if (studUid) {
            const studDoc = await getDoc(doc(db, "users", studUid));
            if (studDoc.exists()) {
              studentData = studDoc.data();
              studentUid  = studUid;
            }
          }
          if (!studentData) {
            // Fall back: this parent IS the fee payer; use their own linked data
            studentData = userData;
            studentUid  = currentUser.uid;
          }
        } else {
          studentData = userData;
          studentUid  = currentUser.uid;
        }

        const dept    = studentData.dept;
        const admissionYear = studentData.admissionYear;
        const section = studentData.section || "A";

        if (!dept || !admissionYear) {
          setError("Student department or admission year information is missing. Contact the office.");
          setLoading(false);
          return;
        }

        // Fetch batches config to link the student
        let matchedBatchId = "";
        try {
          const configSnap = await getDoc(doc(db, "config", "batches"));
          const DEFAULT_BATCHES = [
            { id: "2022-2026", name: "Batch 2022-2026", joiningYear: 22 },
            { id: "2023-2027", name: "Batch 2023-2027", joiningYear: 23 },
            { id: "2024-2028", name: "Batch 2024-2028", joiningYear: 24 },
            { id: "2025-2029", name: "Batch 2025-2029", joiningYear: 25 },
            { id: "2026-2030", name: "Batch 2026-2030", joiningYear: 26 }
          ];
          const batchList = (configSnap.exists() && Array.isArray(configSnap.data().list))
            ? configSnap.data().list
            : DEFAULT_BATCHES;
          const match = batchList.find(b => b.joiningYear === parseInt(admissionYear));
          if (match) {
            matchedBatchId = match.id;
          } else {
            // fallback construct
            matchedBatchId = `20${admissionYear}-20${parseInt(admissionYear) + 4}`;
          }
        } catch (e) {
          console.error(e);
          matchedBatchId = `20${admissionYear}-20${parseInt(admissionYear) + 4}`;
        }

        // Fetch fee structure (try exact section, fallback to A)
        let structureKey = `${dept}_B${matchedBatchId}_${section}`;
        let fsMeta = await getDoc(doc(db, "feeStructures", structureKey));
        if (!fsMeta.exists()) {
          structureKey = `${dept}_B${matchedBatchId}_A`;
          fsMeta = await getDoc(doc(db, "feeStructures", structureKey));
        }

        if (!fsMeta.exists()) {
          setError("No fee structure has been configured yet. Please contact the office.");
          setLoading(false);
          return;
        }

        const semsSnap = await getDocs(collection(db, "feeStructures", structureKey, "semesters"));
        const semList = semsSnap.docs
          .map(d => d.data())
          .sort((a, b) => a.semester - b.semester);
        setSemesters(semList);

        // Fetch this student's payments
        const paySnap = await getDocs(collection(db, "feePayments", studentUid, "semesters"));
        const payMap = {};
        paySnap.forEach(d => { payMap[d.id] = d.data(); });
        setPayments(payMap);
      } catch (e) {
        console.error(e);
        setError("Failed to load fee data. Please try again.");
      }
      setLoading(false);
    };
    fetchFees();
  }, [currentUser, userData]);

  const total   = semesters.reduce((s, f) => s + (parseFloat(f.amount) || 0), 0);
  const paid    = semesters.reduce((s, f) => {
    const p = payments[`sem${f.semester}`];
    return s + (p?.status === "paid" ? parseFloat(p.amount || f.amount) || 0 : 0);
  }, 0);
  const due     = total - paid;
  const overdue = semesters.filter(f => {
    const p = payments[`sem${f.semester}`];
    return (!p || p.status !== "paid") && f.deadline && daysDiff(f.deadline) < 0;
  }).length;

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content animate-fade-up">
        <div className="page-header">
          <h1>💰 Fee Payment Status</h1>
          <p>{userData?.name}</p>
        </div>

        {loading ? (
          <div className="loading-center"><div className="spinner" /></div>
        ) : error ? (
          <div className="glass-card" style={{ textAlign:"center", padding:"48px 24px" }}>
            <FaInfoCircle style={{ fontSize:40, marginBottom:16, color:"var(--accent-orange)", opacity:0.7 }} />
            <p style={{ color:"var(--text-secondary)" }}>{error}</p>
          </div>
        ) : (
          <>
            {/* Overdue alert */}
            {overdue > 0 && (
              <div style={{
                marginBottom:20, padding:"14px 18px",
                background:"rgba(248,113,113,0.08)",
                borderRadius:10, border:"1px solid rgba(248,113,113,0.2)",
                fontSize:14, display:"flex", alignItems:"center", gap:10
              }}>
                <FaExclamationCircle style={{ color:"var(--accent-red)", flexShrink:0 }} />
                <span>You have <strong>{overdue} overdue semester{overdue > 1 ? "s" : ""}</strong>. Please contact the office immediately to clear the dues.</span>
              </div>
            )}

            {/* Summary cards */}
            <div className="stat-grid" style={{ marginBottom:32 }}>
              {[
                { label:"Total Fees",   value:`₹${total.toLocaleString("en-IN")}`,  color:"var(--accent-blue)"  },
                { label:"Paid Amount",  value:`₹${paid.toLocaleString("en-IN")}`,   color:"var(--accent-green)" },
                { label:"Amount Due",   value:`₹${due.toLocaleString("en-IN")}`,    color: due > 0 ? "var(--accent-red)" : "var(--accent-green)" },
              ].map(s => (
                <div key={s.label} className="stat-card">
                  <div className="stat-card-value" style={{ color:s.color, fontSize:24 }}>{s.value}</div>
                  <div className="stat-card-label">{s.label}</div>
                </div>
              ))}
            </div>

            <div className="glass-card">
              <h3 style={{ fontSize:15, fontWeight:600, marginBottom:16 }}>Semester-wise Payment Details</h3>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Semester</th>
                      <th>Fee Amount</th>
                      <th>Deadline</th>
                      <th>Status</th>
                      <th>Paid On</th>
                      <th>Method</th>
                      <th>Receipt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {semesters.map(f => {
                      const pay = payments[`sem${f.semester}`];
                      const isPaid = pay?.status === "paid";
                      const diff   = daysDiff(f.deadline);
                      const isOverdue = !isPaid && diff !== null && diff < 0;
                      const isDueSoon = !isPaid && diff !== null && diff >= 0 && diff <= 7;
                      return (
                        <tr key={f.semester}>
                          <td style={{ fontWeight:600 }}>Semester {f.semester}</td>
                          <td>₹{(parseFloat(f.amount)||0).toLocaleString("en-IN")}</td>
                          <td>
                            {f.deadline ? (
                              <span style={{ color: isOverdue ? "var(--accent-red)" : isDueSoon ? "var(--accent-orange)" : "var(--text-secondary)", fontSize:13 }}>
                                {f.deadline}
                                {!isPaid && diff !== null && (
                                  <span style={{ marginLeft:6, fontSize:11 }}>
                                    {diff < 0 ? `(${Math.abs(diff)}d overdue)` : diff === 0 ? "(Today!)" : `(${diff}d left)`}
                                  </span>
                                )}
                              </span>
                            ) : "—"}
                          </td>
                          <td>
                            {isPaid ? (
                              <span className="badge badge-green" style={{ display:"inline-flex", alignItems:"center", gap:4 }}>
                                <FaCheckCircle /> Paid
                              </span>
                            ) : isOverdue ? (
                              <span className="badge badge-red" style={{ display:"inline-flex", alignItems:"center", gap:4 }}>
                                <FaExclamationCircle /> Overdue
                              </span>
                            ) : (
                              <span className="badge badge-yellow" style={{ display:"inline-flex", alignItems:"center", gap:4 }}>
                                <FaClock /> Pending
                              </span>
                            )}
                          </td>
                          <td style={{ color:"var(--text-secondary)", fontSize:13 }}>{pay?.paidOn || "—"}</td>
                          <td style={{ color:"var(--text-secondary)", fontSize:13 }}>{pay?.method || "—"}</td>
                          <td style={{ color:"var(--text-muted)", fontSize:12 }}>{pay?.receiptNo ? `#${pay.receiptNo}` : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {due > 0 && (
                <div style={{ marginTop:20, padding:"14px 18px", background:"rgba(248,113,113,0.08)", borderRadius:10, border:"1px solid rgba(248,113,113,0.2)", fontSize:14 }}>
                  ⚠️ You have a pending balance of <strong>₹{due.toLocaleString("en-IN")}</strong>. Please contact the office to make the payment.
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
