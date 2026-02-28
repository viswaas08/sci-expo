import { useState, useEffect } from "react";
import { collection, getDocs, doc, setDoc, deleteDoc, updateDoc } from "firebase/firestore";
import { db } from "../../firebase";
import Sidebar from "../../components/Sidebar";
import { FaPlus, FaTrash } from "react-icons/fa";

const DEFAULT_DEPTS = ["ECE", "IT", "MECH", "EEE", "CSE", "AIDS"];

export default function ManageDepartments() {
  const [depts, setDepts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newDept, setNewDept] = useState("");
  const [sections, setSections] = useState("A,B,C");
  const [years, setYears] = useState(4);
  const [success, setSuccess] = useState("");

  const fetchDepts = async () => {
    const snap = await getDocs(collection(db, "departments"));
    if (snap.empty) {
      // Seed default departments
      for (const d of DEFAULT_DEPTS) {
        await setDoc(doc(db, "departments", d), { name: d, sections: ["A", "B", "C"], years: 4 });
      }
      fetchDepts();
    } else {
      setDepts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }
  };

  useEffect(() => { fetchDepts(); }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    const name = newDept.toUpperCase().trim();
    if (!name) return;
    await setDoc(doc(db, "departments", name), { name, sections: sections.split(",").map(s => s.trim()), years: Number(years) });
    setNewDept(""); setSections("A,B,C"); setYears(4);
    setSuccess(`Department ${name} added.`);
    fetchDepts();
    setTimeout(() => setSuccess(""), 3000);
  };

  const handleDelete = async (id) => {
    if (!confirm(`Delete department ${id}?`)) return;
    await deleteDoc(doc(db, "departments", id));
    fetchDepts();
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content animate-fade-up">
        <div className="page-header">
          <h1>Manage Departments</h1>
          <p>Configure departments, sections, and academic years</p>
        </div>

        {success && <div className="alert alert-success">{success}</div>}

        <div className="glass-card" style={{ marginBottom: 28 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Add Department</h3>
          <form onSubmit={handleAdd} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 16, alignItems: "end" }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Department Name</label>
              <input className="form-control" placeholder="e.g. CIVIL" value={newDept} onChange={e => setNewDept(e.target.value)} required />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Sections (comma-separated)</label>
              <input className="form-control" placeholder="A,B,C" value={sections} onChange={e => setSections(e.target.value)} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Number of Years</label>
              <input className="form-control" type="number" min={1} max={5} value={years} onChange={e => setYears(e.target.value)} />
            </div>
            <button className="btn btn-primary" type="submit"><FaPlus /> Add</button>
          </form>
        </div>

        {loading ? (
          <div className="loading-center"><div className="spinner" /></div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr><th>Department</th><th>Sections</th><th>Years</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {depts.map(d => (
                  <tr key={d.id}>
                    <td style={{ fontWeight: 600, fontSize: 15 }}>{d.name}</td>
                    <td>
                      {(d.sections || []).map(s => <span key={s} className="badge badge-blue" style={{ marginRight: 4 }}>Sec {s}</span>)}
                    </td>
                    <td>
                      {Array.from({ length: d.years || 4 }, (_, i) => (
                        <span key={i} className="badge badge-orange" style={{ marginRight: 4 }}>Y{i + 1}</span>
                      ))}
                    </td>
                    <td>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(d.id)}><FaTrash /></button>
                    </td>
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
