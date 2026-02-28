import { useState, useEffect } from "react";
import { collection, addDoc, getDocs, deleteDoc, doc, query, where, setDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { useAuth } from "../../context/AuthContext";
import Sidebar from "../../components/Sidebar";
import { FaPlus, FaTrash, FaSave, FaTimes } from "react-icons/fa";

const DAYS   = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const SLOTS  = ["8:00", "9:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00"];

export default function Timetable({ readOnly = false }) {
  const { currentUser, userData, userRole } = useAuth();
  const [timetable, setTimetable] = useState({}); // { "Monday-8:00": { subject, room } }
  const [loading, setLoading]     = useState(true);
  const [editing, setEditing]     = useState(null); // "Monday-8:00"
  const [cellForm, setCellForm]   = useState({ subject: "", room: "" });
  const [saving, setSaving]       = useState(false);

  // Read-only view uses student/parent's linked teacherId or dept
  const dept    = userData?.dept;
  const year    = userData?.year;
  const section = userData?.section;

  const fetchTimetable = async () => {
    if (!dept) return;
    setLoading(true);
    try {
      const snap = await getDocs(query(
        collection(db, "timetable"),
        where("dept", "==", dept),
        where("year", "==", year),
        where("section", "==", section)
      ));
      const map = {};
      snap.forEach(d => { map[d.data().slot] = { id: d.id, ...d.data() }; });
      setTimetable(map);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchTimetable(); }, [userData]);

  const openEdit = (slot) => {
    const existing = timetable[slot] || {};
    setCellForm({ subject: existing.subject || "", room: existing.room || "" });
    setEditing(slot);
  };

  const saveCell = async () => {
    setSaving(true);
    const docId = `${dept}_Y${year}_S${section}_${editing.replace(/[:\s]/g, "")}`;
    await setDoc(doc(db, "timetable", docId), {
      dept, year, section, slot: editing,
      subject: cellForm.subject, room: cellForm.room,
      teacherId: currentUser?.uid,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
    setSaving(false);
    setEditing(null);
    fetchTimetable();
  };

  const deleteCell = async (slot) => {
    const cell = timetable[slot];
    if (cell?.id) await deleteDoc(doc(db, "timetable", cell.id));
    fetchTimetable();
  };

  const isTeacher = userRole === "teacher";

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content animate-fade-up">
        <div className="page-header">
          <h1>📅 Timetable</h1>
          <p>{dept} · Year {year} · Section {section}</p>
        </div>

        {loading ? <div className="loading-center"><div className="spinner" /></div> : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ minWidth: 700 }}>
              <thead>
                <tr>
                  <th style={{ width: 60 }}>Time</th>
                  {DAYS.map(d => <th key={d}>{d}</th>)}
                </tr>
              </thead>
              <tbody>
                {SLOTS.map(slot => (
                  <tr key={slot}>
                    <td style={{ fontWeight: 600, fontSize: 12, color: "var(--text-muted)" }}>{slot}</td>
                    {DAYS.map(day => {
                      const key  = `${day}-${slot}`;
                      const cell = timetable[key];
                      const isEditingThis = editing === key;
                      return (
                        <td key={key} style={{ padding: 8, minWidth: 110 }}>
                          {isEditingThis ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                              <input className="form-control" style={{ padding: "6px 8px", fontSize: 12 }} placeholder="Subject" value={cellForm.subject} onChange={e => setCellForm(f => ({ ...f, subject: e.target.value }))} />
                              <input className="form-control" style={{ padding: "6px 8px", fontSize: 12 }} placeholder="Room" value={cellForm.room} onChange={e => setCellForm(f => ({ ...f, room: e.target.value }))} />
                              <div style={{ display: "flex", gap: 4 }}>
                                <button className="btn btn-primary btn-sm" style={{ flex: 1, padding: "4px 8px", fontSize: 11 }} onClick={saveCell} disabled={saving}><FaSave /></button>
                                <button className="btn btn-secondary btn-sm" style={{ padding: "4px 8px", fontSize: 11 }} onClick={() => setEditing(null)}><FaTimes /></button>
                              </div>
                            </div>
                          ) : cell ? (
                            <div style={{ background: "rgba(79,156,249,0.1)", borderRadius: 8, padding: "8px 10px", position: "relative" }}>
                              <div style={{ fontWeight: 600, fontSize: 13 }}>{cell.subject}</div>
                              {cell.room && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Room {cell.room}</div>}
                              {isTeacher && (
                                <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
                                  <button className="btn btn-secondary btn-sm" style={{ padding: "2px 8px", fontSize: 11 }} onClick={() => openEdit(key)}>Edit</button>
                                  <button className="btn btn-danger btn-sm" style={{ padding: "2px 8px", fontSize: 11 }} onClick={() => deleteCell(key)}><FaTrash /></button>
                                </div>
                              )}
                            </div>
                          ) : (
                            isTeacher ? (
                              <button onClick={() => openEdit(key)} style={{ width: "100%", height: 40, background: "transparent", border: "1px dashed var(--border)", borderRadius: 8, color: "var(--text-muted)", cursor: "pointer", fontSize: 18 }}>+</button>
                            ) : <div style={{ height: 32, background: "rgba(255,255,255,0.02)", borderRadius: 6 }} />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
