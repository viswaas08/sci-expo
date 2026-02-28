import { useState, useEffect } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../firebase";
import { useAuth } from "../../context/AuthContext";
import Sidebar from "../../components/Sidebar";
import { FaDownload } from "react-icons/fa";

const DEPT_SUBJECTS = {
  ECE:["Electronics Circuits","Digital Electronics","Signals & Systems","Microprocessors","Communication Systems"],
  IT: ["Web Technologies","Database Systems","Operating Systems","Computer Networks","Software Engineering"],
  MECH:["Engineering Mechanics","Thermodynamics","Fluid Mechanics","Manufacturing Technology","Machine Design"],
  EEE:["Circuit Theory","Power Systems","Control Systems","Electrical Machines","Power Electronics"],
  CSE:["Data Structures","Algorithms","DBMS","Operating Systems","Computer Networks"],
  AIDS:["Machine Learning","Data Mining","Statistical Methods","Big Data Analytics","Neural Networks"],
};

async function generatePDF(student, marks, attendance, subjects) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF();
  const margin = 20;
  let y = margin;

  // Header
  doc.setFillColor(79, 156, 249);
  doc.rect(0, 0, 210, 40, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("SCI EXPO – Student Report Card", margin, 18);
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text(`Academic Year 2024–25`, margin, 30);
  y = 55;

  // Student info
  doc.setTextColor(30, 30, 60);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("Student Information", margin, y); y += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(`Name:      ${student.name}`,    margin + 4, y); y += 7;
  doc.text(`Roll No:   ${student.rollNo}`,  margin + 4, y); y += 7;
  doc.text(`Dept:      ${student.dept}  ·  Year: ${student.year}  ·  Section: ${student.section}`, margin + 4, y); y += 7;
  doc.text(`Email:     ${student.email}`,   margin + 4, y); y += 14;

  // Attendance
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Attendance", margin, y); y += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(`Present: ${attendance.present}  |  Total: ${attendance.total}  |  Percentage: ${attendance.pct}%`, margin + 4, y);
  y += 14;

  // Marks table header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Marks", margin, y); y += 8;
  doc.setFillColor(240, 244, 248);
  doc.rect(margin, y - 5, 170, 8, "F");
  doc.setFontSize(10);
  doc.text("Subject",          margin + 2,  y);
  doc.text("Internal",         margin + 90, y);
  doc.text("External",         margin + 120,y);
  doc.text("Total",            margin + 145,y);
  doc.text("Grade",            margin + 160,y);
  y += 3;
  doc.setDrawColor(200,200,200);
  doc.line(margin, y, margin + 170, y);
  y += 5;

  doc.setFont("helvetica", "normal");
  marks.forEach(m => {
    if (y > 270) { doc.addPage(); y = margin; }
    doc.text(m.subject || "—",                    margin + 2,  y);
    doc.text(String(m.internal1 ?? "—"),           margin + 90, y);
    doc.text(String(m.external  ?? "—"),           margin + 120,y);
    doc.text(String(m.total     ?? "—"),           margin + 145,y);
    doc.text(m.grade            ?? "—",            margin + 160,y);
    y += 7;
  });

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(9);
    doc.setTextColor(150);
    doc.text(`Generated on ${new Date().toLocaleString()} · SCI EXPO Portal`, margin, 290);
    doc.text(`Page ${i} of ${pageCount}`, 185, 290, { align: "right" });
  }

  doc.save(`ReportCard_${student.rollNo}_${student.name.replace(/\s+/g,"_")}.pdf`);
}

export default function ReportCard() {
  const { currentUser, userData } = useAuth();
  const [marks, setMarks]       = useState([]);
  const [attendance, setAtt]    = useState({ present:0, total:0, pct:0 });
  const [loading, setLoading]   = useState(true);
  const [generating, setGen]    = useState(false);
  const subjects = DEPT_SUBJECTS[userData?.dept] || [];

  useEffect(() => {
    if (!currentUser || !userData) return;
    const fetch = async () => {
      try {
        const [mSnap, aSnap] = await Promise.all([
          getDocs(query(collection(db,"exams"), where("studentId","==",currentUser.uid))),
          getDocs(query(collection(db,"attendance"), where("studentId","==",currentUser.uid))),
        ]);
        setMarks(mSnap.docs.map(d => ({ id:d.id, ...d.data() })));
        let present=0, total=aSnap.size;
        aSnap.forEach(d => { if(d.data().status==="present") present++; });
        setAtt({ present, total, pct: total ? Math.round((present/total)*100) : 0 });
      } catch(e) { console.error(e); }
      finally { setLoading(false); }
    };
    fetch();
  }, [currentUser, userData]);

  const handleDownload = async () => {
    setGen(true);
    try { await generatePDF(userData, marks, attendance, subjects); }
    catch(e) { console.error(e); alert("Failed to generate PDF: " + e.message); }
    finally { setGen(false); }
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content animate-fade-up">
        <div className="page-header" style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
          <div><h1>📄 Report Card</h1><p>Your academic performance summary</p></div>
          <button className="btn btn-primary" onClick={handleDownload} disabled={generating || loading}>
            {generating ? <span className="spinner" style={{ width:16,height:16 }} /> : <FaDownload />} Download PDF
          </button>
        </div>

        {loading ? <div className="loading-center"><div className="spinner" /></div> : (
          <>
            {/* Attendance */}
            <div className="glass-card" style={{ marginBottom:24, borderLeft:"4px solid var(--accent-blue)" }}>
              <h3 style={{ fontSize:15, fontWeight:600, marginBottom:12 }}>Attendance Summary</h3>
              <div style={{ display:"flex", gap:32, flexWrap:"wrap", fontSize:14 }}>
                <span>Present: <strong style={{ color:"var(--accent-green)" }}>{attendance.present}</strong></span>
                <span>Total: <strong>{attendance.total}</strong></span>
                <span>Percentage: <strong style={{ color: attendance.pct>=75?"var(--accent-green)":"var(--accent-red)" }}>{attendance.pct}%</strong></span>
              </div>
            </div>

            {/* Marks */}
            <div className="glass-card">
              <h3 style={{ fontSize:15, fontWeight:600, marginBottom:16 }}>Subject-wise Marks</h3>
              {marks.length === 0 ? (
                <p style={{ color:"var(--text-muted)", fontSize:14 }}>No marks recorded yet. Ask your teacher to enter marks via the Exams & Marks page.</p>
              ) : (
                <div className="table-wrapper">
                  <table>
                    <thead><tr><th>Subject</th><th>Internal 1</th><th>Internal 2</th><th>External</th><th>Assignment</th><th>Total</th><th>Grade</th></tr></thead>
                    <tbody>
                      {marks.map(m => (
                        <tr key={m.id}>
                          <td style={{ fontWeight:500 }}>{m.subject}</td>
                          <td style={{ textAlign:"center" }}>{m.internal1 ?? "—"}</td>
                          <td style={{ textAlign:"center" }}>{m.internal2 ?? "—"}</td>
                          <td style={{ textAlign:"center" }}>{m.external  ?? "—"}</td>
                          <td style={{ textAlign:"center" }}>{m.assignment ?? "—"}</td>
                          <td style={{ textAlign:"center", fontWeight:700 }}>{m.total ?? "—"}</td>
                          <td style={{ textAlign:"center" }}>
                            <span className={`badge ${m.grade==="O"||m.grade==="A+"?"badge-green":m.grade==="A"||m.grade==="B+"?"badge-blue":"badge-orange"}`}>{m.grade||"—"}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
