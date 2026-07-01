import { useState, useEffect } from "react";
import { collection, getDocs, doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase";
import Sidebar from "../../components/Sidebar";
import { useAuth } from "../../context/AuthContext";
import { 
  FaCheckCircle, FaClock, FaExclamationCircle, FaInfoCircle, 
  FaMoneyBillWave, FaTimes, FaCreditCard, FaQrcode, FaShieldAlt, FaSpinner, FaPrint 
} from "react-icons/fa";

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

  const [studentInfo, setStudentInfo] = useState(null);
  const [selectedPayCategory, setSelectedPayCategory] = useState(null); // { semesterObj, categoryName, amount }
  const [paymentMethod, setPaymentMethod] = useState("UPI"); // UPI or Card
  const [txId, setTxId] = useState("");
  const [simStatus, setSimStatus] = useState("idle"); // idle, processing, success, failed
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [desktopPayLoading, setDesktopPayLoading] = useState(false);

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

        setStudentInfo({
          uid: studentUid,
          name: studentData.name || "",
          rollNo: studentData.rollNo || "",
          dept,
          year: studentData.year || 1,
          section,
          batchId: matchedBatchId,
          admissionYear
        });

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

  // Listen to live updates of the active payment simulation document
  useEffect(() => {
    if (!txId || !selectedPayCategory || !studentInfo) return;
    const unsub = onSnapshot(doc(db, "paymentSimulations", txId), async (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.status === "success") {
          setSimStatus("success");
          // Reload student payments
          const paySnap = await getDocs(collection(db, "feePayments", studentInfo.uid, "semesters"));
          const payMap = {};
          paySnap.forEach(d => { payMap[d.id] = d.data(); });
          setPayments(payMap);

          // Close modal after success delay
          setTimeout(() => {
            setSelectedPayCategory(null);
            setTxId("");
            setSimStatus("idle");
          }, 2500);
        } else if (data.status === "failed") {
          setSimStatus("failed");
        }
      }
    });
    return () => unsub();
  }, [txId, selectedPayCategory, studentInfo]);

  const total = semesters.reduce((s, f) => {
    const semSum = Object.values(f.fees || {}).reduce((sum, v) => sum + (parseFloat(v) || 0), 0);
    return s + (semSum || parseFloat(f.amount) || 0);
  }, 0);

  const paid = semesters.reduce((s, f) => {
    const p = payments[`sem${f.semester}`];
    if (p) {
      if (p.status === "paid") {
        const semSum = Object.values(f.fees || {}).reduce((sum, v) => sum + (parseFloat(v) || 0), 0);
        return s + (semSum || parseFloat(p.amount || f.amount) || 0);
      } else if (p.paidCategories) {
        const catSum = Object.values(p.paidCategories).reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
        return s + catSum;
      }
    }
    return s;
  }, 0);

  const due     = total - paid;
  const overdue = semesters.filter(f => {
    const p = payments[`sem${f.semester}`];
    const isPaid = p?.status === "paid";
    
    // Check if category breakdown exists
    let hasDues = !isPaid;
    if (p?.paidCategories && f.fees) {
      hasDues = Object.keys(f.fees).some(catName => !p.paidCategories[catName]);
    }
    
    return hasDues && f.deadline && daysDiff(f.deadline) < 0;
  }).length;

  const handleInitiatePayment = async (semesterObj, categoryName, amount) => {
    const generatedTxId = "TX-" + Math.floor(10000000 + Math.random() * 90000000);
    setTxId(generatedTxId);
    setSimStatus("idle");
    setPaymentMethod("UPI");
    
    const payData = {
      status: "pending",
      studentUid: studentInfo.uid,
      studentName: studentInfo.name,
      rollNo: studentInfo.rollNo || "N/A",
      dept: studentInfo.dept,
      year: studentInfo.year || 1,
      section: studentInfo.section || "A",
      batchId: studentInfo.batchId,
      admissionYear: studentInfo.admissionYear,
      semester: semesterObj.semester,
      category: categoryName,
      amount: parseFloat(amount),
      method: "UPI",
      createdAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, "paymentSimulations", generatedTxId), payData);
      
      const simUrl = `${window.location.origin}/payment-sim?txId=${generatedTxId}`;
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(simUrl)}`;
      setQrCodeUrl(qrUrl);
      setSelectedPayCategory({ semesterObj, categoryName, amount });
    } catch (err) {
      alert("Failed to initiate payment simulation: " + err.message);
    }
  };

  const handleCardPaymentSubmit = async (e) => {
    e.preventDefault();
    setDesktopPayLoading(true);

    await new Promise(resolve => setTimeout(resolve, 2000));

    try {
      const payRef = doc(db, "feePayments", studentInfo.uid, "semesters", `sem${selectedPayCategory.semesterObj.semester}`);
      const paySnap = await getDoc(payRef);
      
      let existingPaidCategories = {};
      if (paySnap.exists()) {
        existingPaidCategories = paySnap.data().paidCategories || {};
      }

      const generatedReceipt = "RCP-" + Math.floor(100000 + Math.random() * 900000);
      const paidOnDate = new Date().toISOString().split("T")[0];

      existingPaidCategories[selectedPayCategory.categoryName] = {
        amount: parseFloat(selectedPayCategory.amount),
        paidOn: paidOnDate,
        method: "Credit Card (Simulated)",
        receiptNo: generatedReceipt,
        status: "paid"
      };

      const structKey = `${studentInfo.dept}_B${studentInfo.batchId}_${studentInfo.section || "A"}`;
      const semsSnap = await getDoc(doc(db, "feeStructures", structKey, "semesters", `sem${selectedPayCategory.semesterObj.semester}`));
      
      let overallStatus = "partial";
      if (semsSnap.exists()) {
        const structureSems = semsSnap.data().fees || {};
        const allCatsPaid = Object.keys(structureSems).every(catName => {
          return existingPaidCategories[catName]?.status === "paid";
        });
        overallStatus = allCatsPaid ? "paid" : "partial";
      } else {
        overallStatus = "paid";
      }

      const totalAmountPaid = Object.values(existingPaidCategories).reduce((sum, item) => sum + (item.amount || 0), 0);

      const baseData = {
        studentUid: studentInfo.uid,
        studentName: studentInfo.name,
        rollNo: studentInfo.rollNo || "N/A",
        dept: studentInfo.dept,
        year: parseInt(studentInfo.year) || 1,
        section: studentInfo.section || "A",
        batchId: studentInfo.batchId,
        admissionYear: parseInt(studentInfo.admissionYear) || 24,
        semester: parseInt(selectedPayCategory.semesterObj.semester),
        amount: totalAmountPaid,
        method: "Credit Card (Simulated)",
        receiptNo: generatedReceipt,
        paidOn: paidOnDate,
        status: overallStatus,
        paidCategories: existingPaidCategories,
        recordedAt: new Date().toISOString()
      };

      await setDoc(doc(db, "feePayments", studentInfo.uid, "semesters", `sem${selectedPayCategory.semesterObj.semester}`), baseData, { merge: true });
      await setDoc(doc(db, "feePayments", `${studentInfo.uid}_sem${selectedPayCategory.semesterObj.semester}`), baseData, { merge: true });

      await setDoc(doc(db, "paymentSimulations", txId), {
        status: "success",
        receiptNo: generatedReceipt,
        paidOn: paidOnDate,
        method: "Credit Card (Simulated)",
        authorizedAt: new Date().toISOString()
      }, { merge: true });

    } catch (err) {
      alert("Payment failed: " + err.message);
    }
    setDesktopPayLoading(false);
  };

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

            <h3 style={{ fontSize:16, fontWeight:700, marginBottom:16 }}>Semester-wise Payment Details</h3>
            
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 20, marginBottom: 32 }}>
              {semesters.map(f => {
                const pay = payments[`sem${f.semester}`];
                const isPaid = pay?.status === "paid";
                const diff   = daysDiff(f.deadline);
                const isOverdue = !isPaid && diff !== null && diff < 0;
                const isDueSoon = !isPaid && diff !== null && diff >= 0 && diff <= 7;

                const cats = Object.entries(f.fees || {});
                const paidCats = pay?.paidCategories || {};

                let overallStatus = "pending";
                if (isPaid) {
                  overallStatus = "paid";
                } else if (Object.keys(paidCats).length > 0) {
                  const allPaid = cats.every(([catName]) => paidCats[catName]?.status === "paid");
                  overallStatus = allPaid ? "paid" : "partial";
                } else {
                  overallStatus = isOverdue ? "overdue" : "pending";
                }

                return (
                  <div key={f.semester} className="glass-card animate-fade-up" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                        <h4 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Semester {f.semester}</h4>
                        {overallStatus === "paid" && (
                          <span className="badge badge-green" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                            <FaCheckCircle /> Paid
                          </span>
                        )}
                        {overallStatus === "partial" && (
                          <span className="badge badge-yellow" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                            ⏳ Partial
                          </span>
                        )}
                        {overallStatus === "pending" && (
                          <span className="badge badge-yellow" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                            <FaClock /> Pending
                          </span>
                        )}
                        {overallStatus === "overdue" && (
                          <span className="badge badge-red" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                            <FaExclamationCircle /> Overdue
                          </span>
                        )}
                      </div>

                      <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 14 }}>
                        {f.deadline ? (
                          <span style={{ color: isOverdue ? "var(--accent-red)" : isDueSoon ? "var(--accent-orange)" : "var(--text-secondary)" }}>
                            📅 Due: {f.deadline} {diff !== null && (diff < 0 ? `(${Math.abs(diff)}d overdue)` : diff === 0 ? "(Today!)" : `(${diff}d left)`)}
                          </span>
                        ) : "📅 No due date set"}
                      </div>

                      {/* Categories Breakdown */}
                      <div style={{ background: "rgba(255, 255, 255, 0.02)", borderRadius: 10, padding: "4px 12px", border: "1px solid var(--border)", marginBottom: 16 }}>
                        {cats.map(([catName, expectedAmount]) => {
                          const catPayment = paidCats[catName];
                          const isCatPaid = catPayment?.status === "paid" || isPaid;
                          return (
                            <div key={catName} style={{ display: "flex", flexDirection: "column", gap: 4, padding: "10px 0", borderBottom: "1px solid rgba(255, 255, 255, 0.04)" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span style={{ fontWeight: 600, fontSize: 13, color: "var(--text-secondary)" }}>{catName}</span>
                                {isCatPaid ? (
                                  <span style={{ color: "var(--accent-green)", fontSize: 12, fontWeight: 700 }}>✓ Paid</span>
                                ) : (
                                  <button
                                    className="btn btn-primary btn-sm"
                                    style={{ padding: "4px 10px", fontSize: 11, background: "rgba(79, 156, 249, 0.15)", color: "var(--accent-blue)", border: "1px solid rgba(79, 156, 249, 0.3)" }}
                                    onClick={() => handleInitiatePayment(f, catName, expectedAmount)}
                                  >
                                    💳 Pay
                                  </button>
                                )}
                              </div>
                              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-muted)" }}>
                                <span>Amount: ₹{(expectedAmount || 0).toLocaleString("en-IN")}</span>
                                {isCatPaid && (
                                  <span>via {catPayment?.method || pay?.method || "Office Rec"}</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {selectedPayCategory && (
              <div style={{
                position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
                background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)",
                display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
                padding: 16
              }}>
                <div className="glass-card animate-fade-up" style={{ maxWidth: 440, width: "100%", position: "relative", padding: 24 }}>
                  <button
                    type="button"
                    onClick={() => { setSelectedPayCategory(null); setTxId(""); setSimStatus("idle"); }}
                    style={{ position: "absolute", top: 16, right: 16, background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 18 }}
                  >
                    <FaTimes />
                  </button>

                  <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                    <FaShieldAlt style={{ color: "#10B981" }} /> Pay College Fees
                  </h3>

                  {simStatus === "idle" && (
                    <>
                      <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)", borderRadius: 10, padding: 14, marginBottom: 20 }}>
                        <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase" }}>Category</div>
                        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>
                          Semester {selectedPayCategory.semesterObj.semester} · {selectedPayCategory.categoryName}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase" }}>Amount Due</div>
                        <div style={{ fontSize: 24, fontWeight: 800, color: "var(--accent-green)" }}>
                          ₹{parseFloat(selectedPayCategory.amount).toLocaleString("en-IN")}.00
                        </div>
                      </div>

                      {/* Payment Method Selector */}
                      <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
                        <button
                          type="button"
                          onClick={() => setPaymentMethod("UPI")}
                          style={{
                            flex: 1, padding: "12px 8px", borderRadius: 8,
                            background: paymentMethod === "UPI" ? "rgba(79, 156, 249, 0.15)" : "rgba(255,255,255,0.02)",
                            border: paymentMethod === "UPI" ? "1px solid var(--accent-blue)" : "1px solid var(--border)",
                            color: paymentMethod === "UPI" ? "var(--accent-blue)" : "var(--text-primary)",
                            fontWeight: 700, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 6
                          }}
                        >
                          <FaQrcode style={{ fontSize: 20 }} /> Scan UPI QR
                        </button>
                        <button
                          type="button"
                          onClick={() => setPaymentMethod("Card")}
                          style={{
                            flex: 1, padding: "12px 8px", borderRadius: 8,
                            background: paymentMethod === "Card" ? "rgba(79, 156, 249, 0.15)" : "rgba(255,255,255,0.02)",
                            border: paymentMethod === "Card" ? "1px solid var(--accent-blue)" : "1px solid var(--border)",
                            color: paymentMethod === "Card" ? "var(--accent-blue)" : "var(--text-primary)",
                            fontWeight: 700, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 6
                          }}
                        >
                          <FaCreditCard style={{ fontSize: 20 }} /> Card / Online
                        </button>
                      </div>

                      {/* UPI Mode */}
                      {paymentMethod === "UPI" && (
                        <div style={{ textAlign: "center", margin: "10px 0" }}>
                          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12 }}>
                            Scan this QR Code with any UPI app on your mobile phone to complete payment:
                          </p>
                          <div style={{
                            background: "#fff", padding: 12, borderRadius: 12, display: "inline-block",
                            border: "4px solid rgba(255,255,255,0.1)", marginBottom: 10
                          }}>
                            <img src={qrCodeUrl} alt="UPI QR Code" style={{ display: "block", width: 180, height: 180 }} />
                          </div>
                          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                            Or click the Simulator shortcut below if testing on computer:
                          </div>
                          <a
                            href={`${window.location.origin}/payment-sim?txId=${txId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: "inline-block", marginTop: 8, fontSize: 13, color: "var(--accent-blue)",
                              textDecoration: "underline", fontWeight: 600
                            }}
                          >
                            🔗 Open Mobile Simulator in new tab
                          </a>
                        </div>
                      )}

                      {/* Card Mode */}
                      {paymentMethod === "Card" && (
                        <form onSubmit={handleCardPaymentSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                          <div className="form-group">
                            <label style={{ fontSize: 11 }}>Cardholder Name</label>
                            <input className="form-control" type="text" placeholder="John Doe" required />
                          </div>
                          <div className="form-group">
                            <label style={{ fontSize: 11 }}>Card Number</label>
                            <input className="form-control" type="text" placeholder="4111 2222 3333 4444" required />
                          </div>
                          <div style={{ display: "flex", gap: 12 }}>
                            <div className="form-group" style={{ flex: 1 }}>
                              <label style={{ fontSize: 11 }}>Expiry Date</label>
                              <input className="form-control" type="text" placeholder="MM/YY" required />
                            </div>
                            <div className="form-group" style={{ flex: 1 }}>
                              <label style={{ fontSize: 11 }}>CVV</label>
                              <input className="form-control" type="password" placeholder="123" required />
                            </div>
                          </div>
                          <button
                            className="btn btn-primary"
                            type="submit"
                            style={{ padding: 12, fontSize: 14, fontWeight: 700, marginTop: 10 }}
                            disabled={desktopPayLoading}
                          >
                            {desktopPayLoading ? (
                              <><FaSpinner className="spinner" style={{ marginRight: 6 }} /> Authorizing...</>
                            ) : (
                              `Pay ₹${parseFloat(selectedPayCategory.amount).toLocaleString("en-IN")}`
                            )}
                          </button>
                        </form>
                      )}
                    </>
                  )}

                  {simStatus === "processing" && (
                    <div style={{ textAlign: "center", padding: "40px 0" }}>
                      <FaSpinner className="spinner" style={{ fontSize: 44, color: "var(--accent-blue)", animation: "spin 1s linear infinite" }} />
                      <h3 style={{ fontSize: 16, fontWeight: 700, marginTop: 16 }}>Processing Transaction</h3>
                      <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 6 }}>Contacting banking servers...</p>
                    </div>
                  )}

                  {simStatus === "success" && (
                    <div style={{ textAlign: "center", padding: "30px 0" }}>
                      <FaCheckCircle style={{ fontSize: 56, color: "#10B981", marginBottom: 16 }} />
                      <h3 style={{ fontSize: 18, fontWeight: 800, color: "#10B981" }}>Payment Successful!</h3>
                      <p style={{ color: "var(--text-secondary)", fontSize: 13, marginTop: 8 }}>
                        The payment has been synchronized and records updated in real-time.
                      </p>
                    </div>
                  )}

                  {simStatus === "failed" && (
                    <div style={{ textAlign: "center", padding: "30px 0" }}>
                      <FaTimes style={{ fontSize: 56, color: "var(--accent-red)", marginBottom: 16 }} />
                      <h3 style={{ fontSize: 18, fontWeight: 800, color: "var(--accent-red)" }}>Transaction Cancelled</h3>
                      <p style={{ color: "var(--text-secondary)", fontSize: 13, marginTop: 8 }}>
                        The payment simulation was rejected or timed out.
                      </p>
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ marginTop: 16 }}
                        onClick={() => setSimStatus("idle")}
                      >
                        Try Again
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
