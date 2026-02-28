import { useState, useEffect } from "react";
import { collection, addDoc, getDocs, deleteDoc, doc, query, orderBy } from "firebase/firestore";
import { db } from "../../firebase";
import { useAuth } from "../../context/AuthContext";
import Sidebar from "../../components/Sidebar";
import { FaPlus, FaTrash, FaBullhorn } from "react-icons/fa";

const AUDIENCES = ["All", "Students", "Teachers", "Parents"];

export default function Announcements() {
  const { currentUser, userData, userRole } = useAuth();
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading]    = useState(true);
  const [showForm, setShowForm]  = useState(false);
  const [form, setForm] = useState({ title: "", body: "", audience: "All", priority: "normal" });
  const canPost = userRole === "admin" || userRole === "teacher";

  const fetch = async () => {
    setLoading(true);
    const snap = await getDocs(query(collection(db, "announcements"), orderBy("createdAt", "desc")));
    setAnnouncements(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    setLoading(false);
  };
  useEffect(() => { fetch(); }, []);

  const handlePost = async (e) => {
    e.preventDefault();
    await addDoc(collection(db, "announcements"), {
      ...form,
      authorName: userData?.name || "Unknown",
      authorRole: userRole,
      createdAt: new Date().toISOString(),
    });
    setForm({ title: "", body: "", audience: "All", priority: "normal" });
    setShowForm(false);
    fetch();
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete announcement?")) return;
    await deleteDoc(doc(db, "announcements", id));
    fetch();
  };

  const priorityColor = (p) => p === "urgent" ? "var(--accent-red)" : p === "important" ? "var(--accent-orange)" : "var(--accent-blue)";

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content animate-fade-up">
        <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div><h1>📢 Announcements</h1><p>School-wide notices and updates</p></div>
          {canPost && (
            <button className="btn btn-primary" onClick={() => setShowForm(s => !s)}>
              <FaPlus /> Post Announcement
            </button>
          )}
        </div>

        {showForm && (
          <div className="glass-card" style={{ marginBottom: 24 }}>
            <form onSubmit={handlePost}>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 14, marginBottom: 14 }}>
                <div className="form-group">
                  <label>Title</label>
                  <input className="form-control" placeholder="Announcement title..." value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />
                </div>
                <div className="form-group">
                  <label>Audience</label>
                  <select className="form-control" value={form.audience} onChange={e => setForm(f => ({ ...f, audience: e.target.value }))}>
                    {AUDIENCES.map(a => <option key={a}>{a}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Priority</label>
                  <select className="form-control" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                    <option value="normal">Normal</option>
                    <option value="important">Important</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Message</label>
                <textarea className="form-control" rows={3} placeholder="Write your announcement..." value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} required style={{ resize: "vertical" }} />
              </div>
              <button className="btn btn-primary" type="submit"><FaBullhorn /> Post</button>
            </form>
          </div>
        )}

        {loading ? (
          <div className="loading-center"><div className="spinner" /></div>
        ) : announcements.length === 0 ? (
          <div className="glass-card" style={{ textAlign: "center", padding: 60, color: "var(--text-muted)" }}>
            <FaBullhorn style={{ fontSize: 36, opacity: 0.3, marginBottom: 12 }} />
            <p>No announcements yet.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {announcements.map(a => (
              <div key={a.id} className="glass-card" style={{ borderLeft: `4px solid ${priorityColor(a.priority)}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
                      <h3 style={{ fontSize: 16, fontWeight: 700 }}>{a.title}</h3>
                      <span className="badge" style={{ background: `${priorityColor(a.priority)}20`, color: priorityColor(a.priority), fontSize: 11 }}>{a.priority}</span>
                      <span className="badge badge-purple" style={{ fontSize: 11 }}>{a.audience}</span>
                    </div>
                    <p style={{ color: "var(--text-secondary)", fontSize: 14, lineHeight: 1.7 }}>{a.body}</p>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 10 }}>
                      By {a.authorName} ({a.authorRole}) · {new Date(a.createdAt).toLocaleString()}
                    </div>
                  </div>
                  {canPost && (
                    <button className="btn btn-danger btn-sm" style={{ marginLeft: 16 }} onClick={() => handleDelete(a.id)}><FaTrash /></button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
