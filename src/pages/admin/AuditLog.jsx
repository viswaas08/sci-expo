import { useState, useEffect } from "react";
import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import { db } from "../../firebase";
import { useAuth } from "../../context/AuthContext";
import Sidebar from "../../components/Sidebar";

export default function AuditLog() {
  const { userRole } = useAuth();
  const [logs, setLogs]     = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const snap = await getDocs(query(collection(db, "auditLog"), orderBy("timestamp", "desc"), limit(100)));
        setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch(e) { console.error(e); }
      finally { setLoading(false); }
    };
    fetch();
  }, []);

  const actionColor = (a) => {
    if (a?.includes("delete") || a?.includes("remove")) return "var(--accent-red)";
    if (a?.includes("create") || a?.includes("add"))    return "var(--accent-green)";
    if (a?.includes("update") || a?.includes("change")) return "var(--accent-orange)";
    return "var(--accent-blue)";
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content animate-fade-up">
        <div className="page-header">
          <h1>🔍 Audit Log</h1>
          <p>Record of all administrative actions (last 100 events)</p>
        </div>

        {loading ? <div className="loading-center"><div className="spinner" /></div> : (
          logs.length === 0 ? (
            <div className="glass-card" style={{ textAlign:"center", padding:60, color:"var(--text-muted)" }}>
              <p>No audit events recorded yet. Events are logged when admins/teachers make changes.</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead><tr><th>Time</th><th>User</th><th>Role</th><th>Action</th><th>Details</th></tr></thead>
                <tbody>
                  {logs.map(l => (
                    <tr key={l.id}>
                      <td style={{ fontSize:12, color:"var(--text-muted)", whiteSpace:"nowrap" }}>{new Date(l.timestamp).toLocaleString()}</td>
                      <td style={{ fontWeight:500 }}>{l.userName || "—"}</td>
                      <td><span className="badge badge-purple" style={{ fontSize:11 }}>{l.userRole}</span></td>
                      <td><span style={{ color: actionColor(l.action), fontWeight:600, fontSize:13 }}>{l.action}</span></td>
                      <td style={{ fontSize:13, color:"var(--text-secondary)", maxWidth:300 }}>{l.details || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </main>
    </div>
  );
}
