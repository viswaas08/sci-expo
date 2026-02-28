import Sidebar from "../../components/Sidebar";
import { useAuth } from "../../context/AuthContext";

const DUMMY_FEES = [
  { term: "Term 1 – June 2024",    amount: 15000, paid: true,  paidOn: "2024-06-05", method: "Online" },
  { term: "Term 2 – October 2024", amount: 15000, paid: true,  paidOn: "2024-10-12", method: "DD"     },
  { term: "Term 3 – January 2025", amount: 15000, paid: false, paidOn: null,          method: null     },
];

export default function FeeStatus() {
  const { userData } = useAuth();
  const total  = DUMMY_FEES.reduce((s, f) => s + f.amount, 0);
  const paid   = DUMMY_FEES.filter(f => f.paid).reduce((s, f) => s + f.amount, 0);
  const due    = total - paid;

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content animate-fade-up">
        <div className="page-header">
          <h1>💰 Fee Payment Status</h1>
          <p>{userData?.name}</p>
        </div>

        {/* Summary cards */}
        <div className="stat-grid" style={{ marginBottom: 32 }}>
          {[
            { label: "Total Fees",    value: `₹${total.toLocaleString()}`, color: "var(--accent-blue)"   },
            { label: "Paid Amount",   value: `₹${paid.toLocaleString()}`,  color: "var(--accent-green)"  },
            { label: "Amount Due",    value: `₹${due.toLocaleString()}`,   color: due > 0 ? "var(--accent-red)" : "var(--accent-green)" },
          ].map(s => (
            <div key={s.label} className="stat-card">
              <div className="stat-card-value" style={{ color: s.color, fontSize: 26 }}>{s.value}</div>
              <div className="stat-card-label">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="glass-card">
          <h3 style={{ fontSize:15, fontWeight:600, marginBottom:16 }}>Payment History</h3>
          <div className="table-wrapper">
            <table>
              <thead><tr><th>Term</th><th>Amount</th><th>Status</th><th>Paid On</th><th>Method</th></tr></thead>
              <tbody>
                {DUMMY_FEES.map((f, i) => (
                  <tr key={i}>
                    <td>{f.term}</td>
                    <td>₹{f.amount.toLocaleString()}</td>
                    <td><span className={`badge ${f.paid ? "badge-green" : "badge-red"}`}>{f.paid ? "✓ Paid" : "Pending"}</span></td>
                    <td style={{ color:"var(--text-secondary)" }}>{f.paidOn || "—"}</td>
                    <td style={{ color:"var(--text-secondary)" }}>{f.method || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {due > 0 && (
            <div style={{ marginTop:20, padding:"14px 18px", background:"rgba(248,113,113,0.08)", borderRadius:10, border:"1px solid rgba(248,113,113,0.2)", fontSize:14 }}>
              ⚠️ You have a pending fee of <strong>₹{due.toLocaleString()}</strong>. Please contact the office to make the payment.
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
