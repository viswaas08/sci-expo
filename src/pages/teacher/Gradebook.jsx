import { useState, useEffect } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../firebase";
import { useAuth } from "../../context/AuthContext";
import Sidebar from "../../components/Sidebar";

const DEPT_SUBJECTS = {
  ECE:  ["Electronics Circuits","Digital Electronics","Signals & Systems","Microprocessors","Communication Systems"],
  IT:   ["Web Technologies","Database Systems","Operating Systems","Computer Networks","Software Engineering"],
  MECH: ["Engineering Mechanics","Thermodynamics","Fluid Mechanics","Manufacturing Technology","Machine Design"],
  EEE:  ["Circuit Theory","Power Systems","Control Systems","Electrical Machines","Power Electronics"],
  CSE:  ["Data Structures","Algorithms","DBMS","Operating Systems","Computer Networks"],
  AIDS: ["Machine Learning","Data Mining","Statistical Methods","Big Data Analytics","Neural Networks"],
};

export default function Gradebook() {
  const { currentUser, userData } = useAuth();
  const [students, setStudents] = useState([]);
  const [marksMap, setMarksMap] = useState({}); // studentId → { subject → marksObtained }
  const [loading, setLoading]   = useState(true);
  const subjects = DEPT_SUBJECTS[userData?.dept] || [];

  useEffect(() => {
    if (!userData) return;
    const fetch = async () => {
      setLoading(true);
      const [stuSnap, marksSnap] = await Promise.all([
        getDocs(query(collection(db,"users"), where("role","==","student"), where("dept","==",userData.dept), where("year","==",userData.year), where("section","==",userData.section))),
        getDocs(query(collection(db,"marks"), where("dept","==",userData.dept), where("year","==",userData.year), where("section","==",userData.section))),
      ]);
      setStudents(stuSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      const map = {};
      marksSnap.forEach(d => {
        const { studentId, subject, marksObtained } = d.data();
        if (!map[studentId]) map[studentId] = {};
        map[studentId][subject] = marksObtained;
      });
      setMarksMap(map);
      setLoading(false);
    };
    fetch();
  }, [userData]);

  const avg = (row) => {
    const vals = subjects.map(s => row[s]).filter(v => v !== undefined);
    return vals.length ? Math.round(vals.reduce((a,b) => a+b, 0) / vals.length) : "—";
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content animate-fade-up">
        <div className="page-header">
          <h1>📊 Gradebook</h1>
          <p>{userData?.dept} · Year {userData?.year} · Section {userData?.section} — all students × all subjects</p>
        </div>
        {loading ? <div className="loading-center"><div className="spinner" /></div> : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ minWidth: 800 }}>
              <thead>
                <tr>
                  <th>Name</th><th>Roll No</th>
                  {subjects.map(s => <th key={s} style={{ fontSize: 11, maxWidth: 90, wordBreak: "break-word" }}>{s}</th>)}
                  <th>Avg</th>
                </tr>
              </thead>
              <tbody>
                {students.map(s => {
                  const row = marksMap[s.id] || {};
                  const average = avg(row);
                  return (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 500 }}>{s.name}</td>
                      <td><span className="badge badge-blue">{s.rollNo}</span></td>
                      {subjects.map(sub => {
                        const v = row[sub];
                        return <td key={sub} style={{ textAlign: "center", color: v !== undefined ? (v >= 75 ? "var(--accent-green)" : v >= 50 ? "var(--accent-orange)" : "var(--accent-red)") : "var(--text-muted)" }}>{v ?? "—"}</td>;
                      })}
                      <td style={{ fontWeight: 700, color: typeof average === "number" ? (average >= 75 ? "var(--accent-green)" : average >= 50 ? "var(--accent-orange)" : "var(--accent-red)") : "var(--text-muted)" }}>{average}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
