import { useState, useEffect } from "react";
import { collection, getDocs, query, where, doc, setDoc, deleteDoc, updateDoc } from "firebase/firestore";
import { createUserWithEmailAndPassword, getAuth } from "firebase/auth";
import { auth, db, firebaseConfig } from "../../firebase";
import { initializeApp } from "firebase/app";
import { useAuth } from "../../context/AuthContext";
import Sidebar from "../../components/Sidebar";
import { FaPlus, FaEdit, FaTrash, FaSave, FaTimes, FaLink, FaKey } from "react-icons/fa";

const DEPTS = ["ECE", "IT", "MECH", "EEE", "CSE", "AIDS"];
const CURRENT_YEARS = [1, 2, 3, 4];
const SECTIONS = ["A", "B", "C"];
const ADMISSION_YEARS = [22, 23, 24, 25, 26, 27];

export default function ManageStudents() {
  const { currentUser, userData } = useAuth();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ name: "", password: "", admissionYear: 24, dept: "ECE", year: 1, section: "A" });
  const [parentForm, setParentForm] = useState(null); // { studentId, studentName }
  const [parentInfo, setParentInfo] = useState(null); // generated creds
  const [error, setError] = useState(""); const [success, setSuccess] = useState("");
  // Filters
  const [admissionYearFilter, setAdmissionYearFilter] = useState("");
  const [deptFilter, setDeptFilter] = useState("");

  const fetchStudents = async () => {
    if (!userData) return;
    const snap = await getDocs(query(collection(db, "users"), where("role", "==", "student"),
      where("dept", "==", userData.dept), where("year", "==", userData.year), where("section", "==", userData.section)
    ));
    setStudents(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    setLoading(false);
  };

  useEffect(() => {
    if (!userData) return;
    let isMounted = true;
    const loadStudents = async () => {
      let q;
      if (userData.role === "admin") {
        q = query(collection(db, "users"), where("role", "==", "student"));
      } else if (Array.isArray(userData.assignedClasses) && userData.assignedClasses.length > 0) {
        // Note: Client side filtering will be applied below for teachers based on assignedClasses.
        q = query(collection(db, "users"), where("role", "==", "student")); 
      } else {
         q = query(collection(db, "users"), where("role", "==", "student")); 
      }
      
      const snap = await getDocs(q);
      let docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      if (userData.role !== "admin" && Array.isArray(userData.assignedClasses) && userData.assignedClasses.length > 0) {
          const classes = userData.assignedClasses.map(c => c.trim().toLowerCase());
          docs = docs.filter(student => classes.includes(`${student.dept} year ${student.year} sec ${student.section}`.toLowerCase()));
      }
      
      if (isMounted) {
        setStudents(docs);
        setLoading(false);
      }
    };
    loadStudents();
    return () => { isMounted = false; };
  }, [userData]);

  const resetForm = () => { setForm({ name: "", password: "", admissionYear: 24, dept: "ECE", year: 1, section: "A" }); setEditId(null); setShowForm(false); setError(""); };

  const handleSave = async (e) => {
    e.preventDefault(); setError(""); setSuccess("");
    try {
      if (editId) {
        await updateDoc(doc(db, "users", editId), { name: form.name, dept: form.dept, year: form.year, section: form.section });
        setSuccess("Student updated.");
      } else {
        // Generate Roll Number
        const batchQuery = query(collection(db, "users"), where("role", "==", "student"), where("dept", "==", form.dept), where("admissionYear", "==", form.admissionYear), where("section", "==", form.section));
        const batchSnap = await getDocs(batchQuery);
        const count = batchSnap.size + 1;
        const rollNo = `${form.admissionYear}_${form.dept}_${form.section}_${count}`.toUpperCase();
        const email = `${rollNo.toLowerCase()}@student.portal`;

        const secondaryApp = initializeApp(firebaseConfig, "SecondaryAppStudent");
        const secondaryAuth = getAuth(secondaryApp);

        try {
          const cred = await createUserWithEmailAndPassword(secondaryAuth, email, form.password);
          await setDoc(doc(db, "users", cred.user.uid), {
            name: form.name, rollNo: rollNo, email: email, role: "student",
            admissionYear: form.admissionYear, dept: form.dept, year: form.year, section: form.section,
            teacherId: currentUser.uid, uid: cred.user.uid, createdAt: new Date().toISOString(),
          });
          setSuccess(`Student added successfully with Roll No: ${rollNo}`);
        } finally {
          await secondaryAuth.signOut();
        }
      }
      resetForm(); fetchStudents();
    } catch (err) { setError(err.message); }
  };

  const handleLinkParent = async (student) => {
    setError(""); setSuccess("");
    const parentEmail = `parent.${student.rollNo?.toLowerCase()}@portal.edu`;
    const parentPassword = `Parent@${student.rollNo}`;
    
    const secondaryApp = initializeApp(firebaseConfig, "SecondaryAppParent");
    const secondaryAuth = getAuth(secondaryApp);

    try {
      // Create parent Firebase Auth account
      const cred = await createUserWithEmailAndPassword(secondaryAuth, parentEmail, parentPassword);
      await setDoc(doc(db, "users", cred.user.uid), {
        name: `Parent of ${student.name}`, email: parentEmail, role: "parent",
        linkedStudentId: student.id, linkedStudentName: student.name,
        uid: cred.user.uid, createdAt: new Date().toISOString(),
      });
      // Update student with parent link
      await updateDoc(doc(db, "users", student.id), { parentUid: cred.user.uid });
      setParentInfo({ name: `Parent of ${student.name}`, email: parentEmail, password: parentPassword });
      setSuccess("Parent account created!");
      fetchStudents();
    } catch (err) {
      if (err.code === "auth/email-already-in-use") {
        setParentInfo({ name: `Parent of ${student.name}`, email: parentEmail, password: parentPassword, existing: true });
        setSuccess("Parent account already exists.");
      } else {
        setError(err.message);
      }
    } finally {
      await secondaryAuth.signOut();
    }
  };

  const handleViewParent = (student) => {
    setError(""); setSuccess("");
    const parentEmail = `parent.${student.rollNo?.toLowerCase()}@portal.edu`;
    const parentPassword = `Parent@${student.rollNo}`;
    setParentInfo({ name: `Parent of ${student.name}`, email: parentEmail, password: parentPassword, existing: true });
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this student?")) return;
    await deleteDoc(doc(db, "users", id));
    fetchStudents();
  };

  // Filtered list
  const filteredStudents = students.filter(s =>
    (!admissionYearFilter || s.admissionYear === Number(admissionYearFilter)) &&
    (!deptFilter || s.dept === deptFilter)
  );
  const allDepts = [...new Set(students.map(s => s.dept).filter(Boolean))];

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content animate-fade-up">
        <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h1>Manage Students</h1>
            <p>{userData?.dept} · Year {userData?.year} · Section {userData?.section}</p>
          </div>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}><FaPlus /> Add Student</button>
        </div>
        {/* Academic Year & Dept Filters */}
        <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
          <select className="form-control" style={{ maxWidth: 190 }} value={admissionYearFilter} onChange={e => setAdmissionYearFilter(e.target.value)}>
            <option value="">All Admission Years</option>
            {ADMISSION_YEARS.map(y => <option key={y} value={y}>Joined 20{y} (Batch {y})</option>)}
          </select>
          <select className="form-control" style={{ maxWidth: 160 }} value={deptFilter} onChange={e => setDeptFilter(e.target.value)}>
            <option value="">All Departments</option>
            {allDepts.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          {(admissionYearFilter || deptFilter) && (
            <span style={{ alignSelf: "center", fontSize: 12, color: "var(--text-muted)" }}>
              {filteredStudents.length} of {students.length} students
            </span>
          )}
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

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

        {showForm && (
          <div className="glass-card" style={{ marginBottom: 24 }}>
            <h3 style={{ marginBottom: 20, fontSize: 16, fontWeight: 600 }}>{editId ? "Edit Student" : "Add New Student"}</h3>
            <form onSubmit={handleSave}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div className="form-group"><label>Full Name</label><input className="form-control" placeholder="Student Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required /></div>
                
                <div className="form-group">
                  <label>Admission Year</label>
                  <select className="form-control" value={form.admissionYear} onChange={e => setForm({ ...form, admissionYear: Number(e.target.value) })} disabled={!!editId}>
                    {ADMISSION_YEARS.map(y => <option key={y} value={y}>20{y}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Department</label>
                  <select className="form-control" value={form.dept} onChange={e => setForm({ ...form, dept: e.target.value })} disabled={!!editId}>
                    {DEPTS.map(d => <option key={d}>{d}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Current Year</label>
                  <select className="form-control" value={form.year} onChange={e => setForm({ ...form, year: Number(e.target.value) })}>
                    {CURRENT_YEARS.map(y => <option key={y} value={y}>Year {y}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Section</label>
                  <select className="form-control" value={form.section} onChange={e => setForm({ ...form, section: e.target.value })}>
                    {SECTIONS.map(s => <option key={s}>Section {s}</option>)}
                  </select>
                </div>

                {!editId && <>
                  <div className="form-group"><label>Initial Password</label><input className="form-control" type="password" placeholder="Temporary password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required /></div>
                </>}
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <button className="btn btn-primary" type="submit"><FaSave /> Save</button>
                <button className="btn btn-secondary" type="button" onClick={resetForm}><FaTimes /> Cancel</button>
              </div>
            </form>
          </div>
        )}

        {loading ? <div className="loading-center"><div className="spinner" /></div> : (
          <div className="table-wrapper">
            <table>
              <thead><tr><th>Name</th><th>Roll No</th><th>Admission Year</th><th>Email</th><th>Parent Linked</th><th>Actions</th></tr></thead>
              <tbody>
                {filteredStudents.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--text-muted)", padding: "40px 0" }}>No students found.</td></tr>
                ) : filteredStudents.map(s => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 500 }}>{s.name}</td>
                    <td><span className="badge badge-blue">{s.rollNo}</span></td>
                    <td><span className="badge badge-purple" style={{ fontSize: 12 }}>20{s.admissionYear || "—"}</span></td>
                    <td style={{ color: "var(--text-secondary)", fontSize: 13 }}>{s.email}</td>
                    <td>
                      {s.parentUid ? (
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <span className="badge badge-green">Linked ✓</span>
                          <button className="btn btn-secondary btn-sm" title="View Parent Credentials" onClick={() => handleViewParent(s)}>View Credentials</button>
                        </div>
                      ) : <span className="badge badge-orange">Not Linked</span>}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button className="btn btn-secondary btn-sm" title="Edit" onClick={() => { setForm({ name: s.name, dept: s.dept || "ECE", year: s.year || 1, section: s.section || "A", admissionYear: s.admissionYear || 24, password: "" }); setEditId(s.id); setShowForm(true); }}><FaEdit /></button>
                        {!s.parentUid && <button className="btn btn-success btn-sm" title="Link Parent" onClick={() => handleLinkParent(s)}><FaLink /></button>}
                        <button className="btn btn-danger btn-sm" title="Delete" onClick={() => handleDelete(s.id)}><FaTrash /></button>
                      </div>
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
