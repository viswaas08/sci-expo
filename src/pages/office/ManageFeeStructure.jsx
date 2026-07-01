import { useState, useEffect } from "react";
import {
  collection, getDocs, doc, setDoc, deleteDoc, query, where,
} from "firebase/firestore";
import { db } from "../../firebase";
import Sidebar from "../../components/Sidebar";
import { FaSave, FaLayerGroup, FaCalendarAlt, FaInfoCircle, FaEdit, FaTrash, FaSync } from "react-icons/fa";

export default function ManageFeeStructure() {
  const [depts, setDepts] = useState([]);
  const [selectedDept, setSelectedDept] = useState("");
  const [selectedYear, setSelectedYear] = useState("1");
  const [selectedSection, setSelectedSection] = useState("A");
  const [programType, setProgramType] = useState("4"); // 3 or 4 year
  const [semCount, setSemCount] = useState(8);
  const [semesters, setSemesters] = useState([]); // [{sem, amount, deadline}]
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [applyAll, setApplyAll] = useState(false);
  const [sections, setSections] = useState(["A","B","C","D"]);
  const [isEditMode, setIsEditMode] = useState(false); // true when existing data loaded
  const [existingStructureKey, setExistingStructureKey] = useState(null);

  useEffect(() => {
    getDocs(collection(db, "departments")).then(snap => {
      setDepts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, []);

  // When programType changes, reset semCount
  useEffect(() => {
    const count = parseInt(programType) * 2;
    setSemCount(count);
    setSemesters(Array.from({ length: count }, (_, i) => ({ sem: i + 1, amount: "", deadline: "" })));
    setIsEditMode(false);
  }, [programType]);

  // Reload structure when dept/year/section changes
  useEffect(() => {
    if (!selectedDept) return;
    setLoading(true);
    setSuccess("");
    const key = `${selectedDept}_Y${selectedYear}_${selectedSection}`;
    getDocs(collection(db, "feeStructures", key, "semesters")).then(snap => {
      const existing = {};
      snap.forEach(d => { existing[d.id] = d.data(); });
      const hasData = Object.keys(existing).length > 0;
      setIsEditMode(hasData);
      setExistingStructureKey(hasData ? key : null);
      setSemesters(prev => prev.map(s => ({
        ...s,
        amount: existing[`sem${s.sem}`]?.amount || "",
        deadline: existing[`sem${s.sem}`]?.deadline || "",
      })));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [selectedDept, selectedYear, selectedSection, semCount]);

  const updateSem = (sem, field, value) => {
    setSemesters(prev => prev.map(s => s.sem === sem ? { ...s, [field]: value } : s));
  };

  const handleReset = () => {
    setSemesters(prev => prev.map(s => ({ ...s, amount: "", deadline: "" })));
    setIsEditMode(false);
    setSuccess("Form cleared. Fill in new values and save.");
  };

  const handleSave = async () => {
    if (!selectedDept) { setSuccess(""); return; }
    setSaving(true);
    setSuccess("");
    try {
      const keys = applyAll
        ? sections.map(sec => `${selectedDept}_Y${selectedYear}_${sec}`)
        : [`${selectedDept}_Y${selectedYear}_${selectedSection}`];

      for (const key of keys) {
        // Save metadata doc
        await setDoc(doc(db, "feeStructures", key), {
          dept: selectedDept,
          year: parseInt(selectedYear),
          section: applyAll ? "ALL" : selectedSection,
          programYears: parseInt(programType),
          semesterCount: semCount,
          updatedAt: new Date().toISOString(),
        }, { merge: true });

        // Save per-semester sub-documents
        for (const s of semesters) {
          if (s.amount) {
            await setDoc(doc(db, "feeStructures", key, "semesters", `sem${s.sem}`), {
              semester: s.sem,
              amount: parseFloat(s.amount) || 0,
              deadline: s.deadline || "",
              key,
              dept: selectedDept,
              year: parseInt(selectedYear),
              updatedAt: new Date().toISOString(),
            });
          }
        }
      }
      setIsEditMode(true);
      setExistingStructureKey(`${selectedDept}_Y${selectedYear}_${selectedSection}`);
      setSuccess(applyAll
        ? `✅ Fee structure ${isEditMode ? "updated" : "saved"} for all sections of Year ${selectedYear} – ${selectedDept}!`
        : `✅ Fee structure ${isEditMode ? "updated" : "saved"} for ${selectedDept} – Year ${selectedYear} – Section ${selectedSection}!`
      );
    } catch (e) {
      console.error(e);
      setSuccess("❌ Error saving. Check console.");
    }
    setSaving(false);
  };

  const handleUpdateDeadlinesOnly = async () => {
    if (!selectedDept) return;
    setSaving(true);
    setSuccess("");
    try {
      const key = `${selectedDept}_Y${selectedYear}_${selectedSection}`;
      for (const s of semesters) {
        if (s.deadline) {
          await setDoc(doc(db, "feeStructures", key, "semesters", `sem${s.sem}`), {
            deadline: s.deadline,
            updatedAt: new Date().toISOString(),
          }, { merge: true });
        }
      }
      setSuccess(`✅ Due dates updated for ${selectedDept} – Year ${selectedYear} – Section ${selectedSection}!`);
    } catch (e) {
      console.error(e);
      setSuccess("❌ Error updating due dates.");
    }
    setSaving(false);
  };

  const totalFees = semesters.reduce((s, x) => s + (parseFloat(x.amount) || 0), 0);

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content animate-fade-up">
        <div className="page-header">
          <h1>📋 Fee Structure</h1>
          <p>Configure and update semester-wise fees per department, year and section</p>
        </div>

        {/* Filters */}
        <div className="glass-card" style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
            <FaLayerGroup /> Configure Structure
            {isEditMode && (
              <span className="badge badge-blue" style={{ marginLeft: 8, fontSize: 12, fontWeight: 600 }}>
                ✏️ Editing Existing Structure
              </span>
            )}
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, alignItems: "end" }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Department</label>
              <select className="form-control" value={selectedDept} onChange={e => setSelectedDept(e.target.value)}>
                <option value="">-- Select --</option>
                {depts.map(d => <option key={d.id} value={d.name || d.id}>{d.name || d.id}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Program Duration</label>
              <select className="form-control" value={programType} onChange={e => setProgramType(e.target.value)}>
                <option value="3">3 Years (6 Semesters)</option>
                <option value="4">4 Years (8 Semesters)</option>
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Year / Class</label>
              <select className="form-control" value={selectedYear} onChange={e => setSelectedYear(e.target.value)}>
                {Array.from({ length: parseInt(programType) }, (_, i) => (
                  <option key={i+1} value={i+1}>Year {i+1}</option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Section</label>
              <select className="form-control" value={selectedSection} onChange={e => setSelectedSection(e.target.value)}>
                {sections.map(s => <option key={s} value={s}>Section {s}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 10 }}>
            <input
              type="checkbox"
              id="applyAll"
              checked={applyAll}
              onChange={e => setApplyAll(e.target.checked)}
              style={{ width: 16, height: 16, cursor: "pointer" }}
            />
            <label htmlFor="applyAll" style={{ cursor: "pointer", fontSize: 13, color: "var(--text-secondary)" }}>
              Apply this fee structure to <strong>all sections</strong> of Year {selectedYear} – {selectedDept || "selected dept"}
            </label>
          </div>
        </div>

        {/* Semester Grid */}
        {selectedDept ? (
          loading ? (
            <div className="loading-center"><div className="spinner" /></div>
          ) : (
            <>
              {/* Edit mode banner */}
              {isEditMode && (
                <div style={{
                  padding: "12px 20px",
                  background: "rgba(79,156,249,0.08)",
                  border: "1px solid rgba(79,156,249,0.3)",
                  borderRadius: 10,
                  marginBottom: 16,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 10,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <FaEdit style={{ color: "var(--accent-blue)" }} />
                    <span style={{ fontSize: 14, color: "var(--accent-blue)", fontWeight: 600 }}>
                      Existing fee structure loaded — you can modify amounts &amp; due dates
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      className="btn btn-secondary"
                      style={{ padding: "6px 14px", fontSize: 12 }}
                      onClick={handleUpdateDeadlinesOnly}
                      disabled={saving}
                    >
                      <FaCalendarAlt style={{ marginRight: 5 }} />Update Due Dates Only
                    </button>
                    <button
                      className="btn btn-secondary"
                      style={{ padding: "6px 14px", fontSize: 12 }}
                      onClick={handleReset}
                    >
                      <FaSync style={{ marginRight: 5 }} />Clear Form
                    </button>
                  </div>
                </div>
              )}

              <div className="glass-card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 700 }}>
                    <FaCalendarAlt style={{ marginRight: 8 }} />
                    {semCount} Semesters · {selectedDept} · Year {selectedYear}{!applyAll ? ` · Section ${selectedSection}` : " · All Sections"}
                  </h3>
                  <div style={{ fontWeight: 700, color: "var(--accent-blue)", fontSize: 16 }}>
                    Total Annual: ₹{totalFees.toLocaleString("en-IN")}
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
                  {semesters.map(s => (
                    <div key={s.sem} style={{
                      padding: "18px 20px",
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid var(--border)",
                      borderRadius: 12,
                    }}>
                      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14, color: "var(--accent-purple)" }}>
                        Semester {s.sem}
                      </div>
                      <div className="form-group" style={{ marginBottom: 12 }}>
                        <label>Fee Amount (₹)</label>
                        <input
                          className="form-control"
                          type="number"
                          min="0"
                          placeholder="0"
                          value={s.amount}
                          onChange={e => updateSem(s.sem, "amount", e.target.value)}
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label>Payment Due Date</label>
                        <input
                          className="form-control"
                          type="date"
                          value={s.deadline}
                          onChange={e => updateSem(s.sem, "deadline", e.target.value)}
                        />
                      </div>
                      {s.deadline && (
                        <div style={{ marginTop: 6, fontSize: 11, color: new Date(s.deadline) < new Date() ? "var(--accent-red)" : "var(--accent-green)" }}>
                          {new Date(s.deadline) < new Date() ? "⚠ Deadline passed" : "✓ Upcoming deadline"}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {success && <div className={`alert ${success.startsWith("✅") ? "alert-success" : "alert-error"}`} style={{ marginTop: 20 }}>{success}</div>}

                <div style={{ marginTop: 24, display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <button
                    className="btn btn-primary"
                    style={{ padding: "12px 32px", fontSize: 15 }}
                    onClick={handleSave}
                    disabled={saving}
                  >
                    {saving ? <span className="spinner" /> : <><FaSave style={{ marginRight: 8 }} />{isEditMode ? "Update Fee Structure" : "Save Fee Structure"}</>}
                  </button>
                  {isEditMode && (
                    <button
                      className="btn btn-secondary"
                      style={{ padding: "12px 24px", fontSize: 15 }}
                      onClick={handleUpdateDeadlinesOnly}
                      disabled={saving}
                    >
                      <FaCalendarAlt style={{ marginRight: 8 }} />Update Due Dates Only
                    </button>
                  )}
                </div>
              </div>
            </>
          )
        ) : (
          <div className="glass-card" style={{ textAlign: "center", padding: "56px 24px", color: "var(--text-muted)" }}>
            <FaInfoCircle style={{ fontSize: 40, marginBottom: 16, opacity: 0.3 }} />
            <p style={{ fontSize: 15 }}>Select a department above to set up or update its fee structure.</p>
          </div>
        )}
      </main>
    </div>
  );
}
