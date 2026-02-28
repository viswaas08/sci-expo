import { useState, useEffect } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../firebase";
import Sidebar from "../../components/Sidebar";
import { FaKey, FaTimes } from "react-icons/fa";

export default function AllStudents() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [parentInfo, setParentInfo] = useState(null);

  useEffect(() => {
    const fetch = async () => {
      const snap = await getDocs(query(collection(db, "users"), where("role", "==", "student")));
      setStudents(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    };
    fetch();
  }, []);

  const [yearFilter, setYearFilter] = useState("");
  const [sectionFilter, setSectionFilter] = useState("");

  const filtered = students.filter(s =>
    (!search || s.name?.toLowerCase().includes(search.toLowerCase()) || s.rollNo?.includes(search)) &&
    (!deptFilter || s.dept === deptFilter) &&
    (!yearFilter || s.year === Number(yearFilter)) &&
    (!sectionFilter || s.section === sectionFilter)
  );

  const depts = [...new Set(students.map(s => s.dept).filter(Boolean))];
  const years = [1, 2, 3, 4];
  const sections = ["A", "B", "C"];

  const handleViewParent = (student) => {
    const parentEmail = `parent.${student.rollNo?.toLowerCase()}@portal.edu`;
    const parentPassword = `Parent@${student.rollNo}`;
    setParentInfo({ name: `Parent of ${student.name}`, email: parentEmail, password: parentPassword, existing: true });
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content animate-fade-up">
        <div className="page-header">
          <h1>All Students</h1>
          <p>View and search students across all departments</p>
        </div>

        <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
          <input className="form-control" style={{ maxWidth: 300 }} placeholder="Search by name or roll no..." value={search} onChange={e => setSearch(e.target.value)} />
          <select className="form-control" style={{ maxWidth: 200 }} value={deptFilter} onChange={e => setDeptFilter(e.target.value)}>
            <option value="">All Departments</option>
            {depts.map(d => <option key={d}>{d}</option>)}
          </select>
          <select className="form-control" style={{ maxWidth: 150 }} value={yearFilter} onChange={e => setYearFilter(e.target.value)}>
            <option value="">All Years</option>
            {years.map(y => <option key={y} value={y}>Year {y}</option>)}
          </select>
          <select className="form-control" style={{ maxWidth: 150 }} value={sectionFilter} onChange={e => setSectionFilter(e.target.value)}>
            <option value="">All Sections</option>
            {sections.map(s => <option key={s} value={s}>Section {s}</option>)}
          </select>
        </div>

        {parentInfo && (
          <div className="glass-card" style={{ marginBottom: 24, borderColor: "rgba(52,211,153,0.3)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, color: "var(--accent-green)" }}>
                <FaKey style={{ marginRight: 8 }} />Parent Credentials Generated
              </h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setParentInfo(null)}><FaTimes /></button>
            </div>
            <div style={{ background: "rgba(52,211,153,0.06)", borderRadius: 8, padding: 16, fontFamily: "monospace", fontSize: 14 }}>
              <p><strong>Name:</strong> {parentInfo.name}</p>
              <p style={{ marginTop: 8 }}><strong>Email:</strong> {parentInfo.email}</p>
              <p style={{ marginTop: 8 }}><strong>Password:</strong> {parentInfo.password}</p>
            </div>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 10 }}>⚠ Share these credentials with the parent securely.</p>
          </div>
        )}

        {loading ? (
          <div className="loading-center"><div className="spinner" /></div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr><th>Name</th><th>Roll No</th><th>Department</th><th>Class</th><th>Email</th><th>Parent Linked</th></tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--text-muted)", padding: "40px 0" }}>No students found.</td></tr>
                ) : filtered.map(s => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 500 }}>{s.name || "—"}</td>
                    <td><span className="badge badge-blue">{s.rollNo || "—"}</span></td>
                    <td><span className="badge badge-purple">{s.dept || "—"}</span></td>
                    <td style={{ color: "var(--text-secondary)" }}>Yr {s.year || "—"} • Sec {s.section || "—"}</td>
                    <td style={{ color: "var(--text-secondary)", fontSize: 13 }}>{s.email || "—"}</td>
                    <td>
                      {s.parentUid ? (
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <span className="badge badge-green">Linked ✓</span>
                          <button className="btn btn-secondary btn-sm" title="View Parent Credentials" onClick={() => handleViewParent(s)}>View Credentials</button>
                        </div>
                      ) : <span className="badge badge-orange">Not Linked</span>}
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
