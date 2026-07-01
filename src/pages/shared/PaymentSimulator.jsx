import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { FaCheckCircle, FaTimesCircle, FaShieldAlt, FaSpinner, FaUniversity } from "react-icons/fa";

export default function PaymentSimulator() {
  const [searchParams] = useSearchParams();
  const txId = searchParams.get("txId");

  const [loading, setLoading] = useState(true);
  const [txData, setTxData] = useState(null);
  const [status, setStatus] = useState("idle"); // idle, processing, success, failed
  const [error, setError] = useState("");
  const [receiptNo, setReceiptNo] = useState("");

  useEffect(() => {
    if (!txId) {
      setError("Invalid transaction reference (missing txId).");
      setLoading(false);
      return;
    }

    const fetchTx = async () => {
      try {
        const docSnap = await getDoc(doc(db, "paymentSimulations", txId));
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.status === "success") {
            setStatus("success");
            setReceiptNo(data.receiptNo || "");
          } else if (data.status === "failed") {
            setStatus("failed");
          }
          setTxData(data);
        } else {
          setError("Transaction reference not found or expired.");
        }
      } catch (err) {
        console.error(err);
        setError("Failed to fetch transaction details.");
      }
      setLoading(false);
    };

    fetchTx();
  }, [txId]);

  const handleAuthorize = async (simulateSuccess) => {
    if (!txData || status !== "idle") return;
    setStatus("processing");
    setError("");

    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 2000));

    if (!simulateSuccess) {
      try {
        await setDoc(doc(db, "paymentSimulations", txId), { status: "failed" }, { merge: true });
        setStatus("failed");
      } catch (err) {
        console.error(err);
        setError("Failed to update simulation state.");
        setStatus("idle");
      }
      return;
    }

    // Process payment success
    const {
      studentUid, studentName, rollNo, dept, year, section,
      batchId, admissionYear, semester, category, amount, method
    } = txData;

    const semKey = `sem${semester}`;
    const generatedReceipt = "RCP-" + Math.floor(100000 + Math.random() * 900000);
    const paidOnDate = new Date().toISOString().split("T")[0];

    try {
      // 1. Fetch current payment details
      const payRef = doc(db, "feePayments", studentUid, "semesters", semKey);
      const paySnap = await getDoc(payRef);
      
      let existingPaidCategories = {};
      if (paySnap.exists()) {
        existingPaidCategories = paySnap.data().paidCategories || {};
      }

      // Add this new payment category
      existingPaidCategories[category] = {
        amount: parseFloat(amount),
        paidOn: paidOnDate,
        method: method || "Online Simulation",
        receiptNo: generatedReceipt,
        status: "paid"
      };

      // 2. Fetch expected fee categories from structure to determine overall status
      const structKey = `${dept}_B${batchId}_${section || "A"}`;
      const semsSnap = await getDoc(doc(db, "feeStructures", structKey, "semesters", semKey));
      
      let overallStatus = "partial";
      if (semsSnap.exists()) {
        const structureSems = semsSnap.data().fees || {};
        const allCatsPaid = Object.keys(structureSems).every(catName => {
          return existingPaidCategories[catName]?.status === "paid";
        });
        overallStatus = allCatsPaid ? "paid" : "partial";
      } else {
        // Fallback: if no fee structure, mark overall status as paid since they paid their manual amount
        overallStatus = "paid";
      }

      // Compute total amount paid so far
      const totalAmountPaid = Object.values(existingPaidCategories).reduce((sum, item) => sum + (item.amount || 0), 0);

      const baseData = {
        studentUid,
        studentName,
        rollNo,
        dept,
        year: parseInt(year) || 1,
        section: section || "A",
        batchId,
        admissionYear: parseInt(admissionYear) || 24,
        semester: parseInt(semester),
        amount: totalAmountPaid,
        method: method || "Online Simulation",
        receiptNo: generatedReceipt,
        paidOn: paidOnDate,
        status: overallStatus,
        paidCategories: existingPaidCategories,
        recordedAt: new Date().toISOString()
      };

      // Write payment documents
      await setDoc(doc(db, "feePayments", studentUid, "semesters", semKey), baseData, { merge: true });
      await setDoc(doc(db, "feePayments", `${studentUid}_${semKey}`), baseData, { merge: true });

      // Update simulation doc to success
      await setDoc(doc(db, "paymentSimulations", txId), {
        status: "success",
        receiptNo: generatedReceipt,
        paidOn: paidOnDate,
        authorizedAt: new Date().toISOString()
      }, { merge: true });

      setReceiptNo(generatedReceipt);
      setStatus("success");
    } catch (err) {
      console.error(err);
      setError("Failed to record payment in database: " + err.message);
      setStatus("idle");
    }
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <FaSpinner style={styles.spinner} />
        <p style={{ marginTop: 14 }}>Connecting to payment gateway...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.container}>
        <FaTimesCircle style={{ ...styles.icon, color: "var(--accent-red)" }} />
        <h2 style={{ fontSize: 20, fontWeight: 700, margin: "14px 0" }}>Payment Verification Error</h2>
        <p style={{ color: "var(--text-muted)", maxWidth: 300, textAlign: "center" }}>{error}</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {/* Secure Header */}
        <div style={styles.cardHeader}>
          <FaShieldAlt style={{ fontSize: 20, color: "#10B981" }} />
          <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.5, color: "#10B981" }}>
            SECURE SIMULATED PAYMENT GATEWAY
          </span>
        </div>

        {status === "idle" && (
          <>
            {/* Payment Summary */}
            <div style={styles.paymentBox}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <FaUniversity style={{ fontSize: 28, color: "var(--accent-blue)" }} />
                <div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase" }}>Payee Portal</div>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>Fee Settlement System</div>
                </div>
              </div>
              
              <div style={{ borderTop: "1px dashed var(--border)", paddingTop: 12, marginTop: 12 }}>
                <div style={styles.detailRow}>
                  <span>Student Name:</span>
                  <strong>{txData.studentName}</strong>
                </div>
                <div style={styles.detailRow}>
                  <span>Roll Number:</span>
                  <code>{txData.rollNo}</code>
                </div>
                <div style={styles.detailRow}>
                  <span>Semester / Category:</span>
                  <strong>Sem {txData.semester} · {txData.category}</strong>
                </div>
                <div style={styles.detailRow}>
                  <span>Payment Mode:</span>
                  <strong>{txData.method}</strong>
                </div>
              </div>

              <div style={{ borderTop: "1px dashed var(--border)", paddingTop: 12, marginTop: 12, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ fontWeight: 600 }}>Amount Due:</span>
                <span style={{ fontSize: 24, fontWeight: 800, color: "var(--accent-green)" }}>
                  ₹{(txData.amount || 0).toLocaleString("en-IN")}.00
                </span>
              </div>
            </div>

            {/* Authorize buttons */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button
                style={{ ...styles.btn, ...styles.btnSuccess }}
                onClick={() => handleAuthorize(true)}
              >
                ✅ Authorize Payment (Success)
              </button>
              <button
                style={{ ...styles.btn, ...styles.btnDanger }}
                onClick={() => handleAuthorize(false)}
              >
                ❌ Decline Payment (Cancel/Fail)
              </button>
            </div>
          </>
        )}

        {status === "processing" && (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <FaSpinner style={styles.spinner} />
            <h3 style={{ fontSize: 16, fontWeight: 700, marginTop: 16, marginBottom: 8 }}>Processing Transaction</h3>
            <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Please do not refresh or close this screen...</p>
          </div>
        )}

        {status === "success" && (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <FaCheckCircle style={{ fontSize: 64, color: "#10B981", marginBottom: 16 }} />
            <h2 style={{ fontSize: 22, fontWeight: 800, color: "#10B981", marginBottom: 8 }}>Payment Successful!</h2>
            <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 16 }}>
              The payment has been processed and credited to the student billing records in real-time.
            </p>
            <div style={styles.receiptBox}>
              <div style={styles.detailRow}>
                <span>Receipt Number:</span>
                <strong>{receiptNo}</strong>
              </div>
              <div style={styles.detailRow}>
                <span>Transaction Ref:</span>
                <code>{txId.slice(0, 10)}...</code>
              </div>
            </div>
            <p style={{ color: "var(--text-muted)", fontSize: 11, marginTop: 20 }}>
              You can now close this tab on your mobile device.
            </p>
          </div>
        )}

        {status === "failed" && (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <FaTimesCircle style={{ fontSize: 64, color: "var(--accent-red)", marginBottom: 16 }} />
            <h2 style={{ fontSize: 22, fontWeight: 800, color: "var(--accent-red)", marginBottom: 8 }}>Transaction Declined</h2>
            <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 20 }}>
              The transaction was cancelled or declined by the user. No funds were debited.
            </p>
            <button
              style={{ ...styles.btn, ...styles.btnNeutral }}
              onClick={() => setStatus("idle")}
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100vh",
    background: "#0d0f14",
    color: "#fff",
    fontFamily: "'Inter', system-ui, sans-serif",
    padding: "20px"
  },
  card: {
    maxWidth: "420px",
    width: "100%",
    background: "rgba(255, 255, 255, 0.03)",
    backdropFilter: "blur(12px)",
    border: "1px solid rgba(255, 255, 255, 0.08)",
    borderRadius: "16px",
    padding: "24px"
  },
  cardHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 20,
    borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
    paddingBottom: 14
  },
  paymentBox: {
    background: "rgba(255,255,255,0.02)",
    border: "1px solid rgba(255,255,255,0.04)",
    borderRadius: "12px",
    padding: "16px",
    marginBottom: 20
  },
  detailRow: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: "13px",
    margin: "6px 0",
    color: "var(--text-secondary)"
  },
  btn: {
    width: "100%",
    padding: "12px",
    fontSize: "14px",
    fontWeight: "700",
    borderRadius: "8px",
    border: "none",
    cursor: "pointer",
    transition: "opacity 0.2s"
  },
  btnSuccess: {
    background: "#10B981",
    color: "#fff"
  },
  btnDanger: {
    background: "var(--accent-red)",
    color: "#fff"
  },
  btnNeutral: {
    background: "rgba(255,255,255,0.08)",
    color: "#fff"
  },
  receiptBox: {
    background: "rgba(16, 185, 129, 0.08)",
    border: "1px solid rgba(16, 185, 129, 0.2)",
    borderRadius: "8px",
    padding: "12px",
    marginTop: 14
  },
  spinner: {
    fontSize: "36px",
    color: "var(--accent-blue)",
    animation: "spin 1s linear infinite"
  },
  icon: {
    fontSize: "56px"
  }
};
