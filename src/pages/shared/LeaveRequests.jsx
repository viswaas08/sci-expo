import { useState, useEffect } from "react";
import { collection, addDoc, getDocs, query, where, updateDoc, doc } from "firebase/firestore";
import { db } from "../../firebase";
import { useAuth } from "../../context/AuthContext";
import Sidebar from "../../components/Sidebar";
import { FaPlus, FaCheck, FaTimes } from "react-icons/fa";

export default function LeaveRequests() {
  const { currentUser, userData, userRole } = useAuth();
  const [leaves, setLeaves]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ fromDate: "", toDate: "", reason: "" });
  const isParent  = userRole === "parent";
  const isTeacher = userRole === "teacher";

  const fetchLeaves = async () => {
    setLoading(true);
    try {
      const q = isParent
        ? query(collection(db,"leaveRequests"), where("parentId","==",currentUser.uid))
        : query(collection(db,"leaveRequests"), where("dept","==",userData.dept), where("year","==",userData.year), where("section","==",userData.section));
      const snap = await getDocs(q);
      setLeaves(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => b.createdAt?.localeCompare(a.createdAt)));
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (userData) fetchLeaves(); }, [userData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    await addDoc(collection(db, "leaveRequests"), {
      ...form,
      parentId: currentUser.uid,
      parentName: userData.name,
      studentId: userData.linkedStudentId || userData.studentUid || "",
      dept: userData.dept, year: userData.year, section: userData.section,
      status: "pending",
      createdAt: new Date().toISOString(),
    });
    setForm({ fromDate: "", toDate: "", reason: "" });
    setShowForm(false);
    fetchLeaves();
  };

  const updateStatus = async (id, status) => {
    await updateDoc(doc(db, "leaveRequests", id), { status, processedAt: new Date().toISOString(), processedBy: userData.name });
    fetchLeaves();
  };

  const statusColor = s => s === "approved" ? "var(--accent-green)" : s === "rejected" ? "var(--accent-red)" : "var(--accent-orange)";

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content animate-fade-up">
        <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div><h1>🗓 Leave Requests</h1><p>{isParent ? "Submit leave requests for your child" : "Manage leave requests from parents"}</p></div>
          {isParent && <button className="btn btn-primary" onClick={() => setShowForm(s => !s)}><FaPlus /> New Request</button>}
        </div>

        {showForm && (
          <div className="glass-card" style={{ marginBottom: 24 }}>
            <form onSubmit={handleSubmit}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
                <div className="form-group"><label>From Date</label><input className="form-control" type="date" value={form.fromDate} onChange={e => setForm(f=>({...f,fromDate:e.target.value}))} required /></div>
                <div className="form-group"><label>To Date</label><input className="form-control" type="date" value={form.toDate} onChange={e => setForm(f=>({...f,toDate:e.target.value}))} required /></div>
              </div>
              <div className="form-group"><label>Reason</label><textarea className="form-control" rows={2} value={form.reason} onChange={e => setForm(f=>({...f,reason:e.target.value}))} required style={{ resize:"vertical" }} /></div>
              <button className="btn btn-primary" type="submit">Submit Request</button>
            </form>
          </div>
        )}

        {loading ? <div className="loading-center"><div className="spinner" /></div> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {leaves.length === 0 ? <div className="glass-card" style={{ textAlign:"center", padding:60, color:"var(--text-muted)" }}>No leave requests yet.</div>
            : leaves.map(l => (
              <div key={l.id} className="glass-card" style={{ borderLeft: `4px solid ${statusColor(l.status)}` }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                  <div>
                    <div style={{ fontWeight:600, marginBottom:4 }}>{l.parentName} — {l.fromDate} to {l.toDate}</div>
                    <p style={{ fontSize:14, color:"var(--text-secondary)" }}>{l.reason}</p>
                    <div style={{ fontSize:12, color:"var(--text-muted)", marginTop:6 }}>
                      Submitted {new Date(l.createdAt).toLocaleDateString()}
                      {l.processedBy && ` · ${l.status} by ${l.processedBy}`}
                    </div>
                  </div>
                  <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                    <span className="badge" style={{ background:`${statusColor(l.status)}20`, color:statusColor(l.status) }}>{l.status}</span>
                    {isTeacher && l.status === "pending" && (
                      <>
                        <button className="btn btn-success btn-sm" onClick={() => updateStatus(l.id,"approved")}><FaCheck /></button>
                        <button className="btn btn-danger btn-sm" onClick={() => updateStatus(l.id,"rejected")}><FaTimes /></button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
