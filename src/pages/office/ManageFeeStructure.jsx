import { useState, useEffect } from "react";
import {
  collection, getDocs, doc, setDoc, deleteDoc, query, where, getDoc,
} from "firebase/firestore";
import { db } from "../../firebase";
import Sidebar from "../../components/Sidebar";
import { FaSave, FaLayerGroup, FaCalendarAlt, FaInfoCircle, FaEdit, FaTrash, FaSync, FaCog, FaPlus, FaTimes } from "react-icons/fa";

const DEFAULT_BATCHES = [
  { id: "2022-2026", name: "Batch 2022-2026", joiningYear: 22 },
  { id: "2023-2027", name: "Batch 2023-2027", joiningYear: 23 },
  { id: "2024-2028", name: "Batch 2024-2028", joiningYear: 24 },
  { id: "2025-2029", name: "Batch 2025-2029", joiningYear: 25 },
  { id: "2026-2030", name: "Batch 2026-2030", joiningYear: 26 }
];

export default function ManageFeeStructure() {
  const [depts, setDepts] = useState([]);
  const [selectedDept, setSelectedDept] = useState("");
  const [selectedSection, setSelectedSection] = useState("A");
  const semCount = 8; // Locked to 8 semesters (4 years)

  // Custom Category-wise fee configuration states
  const [feeCategories, setFeeCategories] = useState(["Tuition Fees", "Hostel Fees", "Other Fees"]);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [targetSemesterForCategory, setTargetSemesterForCategory] = useState("all");

  const [semesters, setSemesters] = useState(
    Array.from({ length: 8 }, (_, i) => ({
      sem: i + 1,
      fees: { "Tuition Fees": "", "Hostel Fees": "", "Other Fees": "" },
      deadline: ""
    }))
  );
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [applyAll, setApplyAll] = useState(false);
  const [sections, setSections] = useState(["A","B","C","D"]);
  const [isEditMode, setIsEditMode] = useState(false); // true when existing data loaded
  const [existingStructureKey, setExistingStructureKey] = useState(null);

  // Batch Configuration States
  const [batches, setBatches] = useState([]);
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [newBatchJoiningYear, setNewBatchJoiningYear] = useState("");
  const [batchError, setBatchError] = useState("");

  useEffect(() => {
    getDocs(collection(db, "departments")).then(snap => {
      setDepts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    loadBatches();
  }, []);

  const loadBatches = async () => {
    try {
      const snap = await getDoc(doc(db, "config", "batches"));
      if (snap.exists() && Array.isArray(snap.data().list)) {
        const list = snap.data().list;
        setBatches(list);
        if (list.length > 0) {
          setSelectedBatchId(list[0].id);
        }
      } else {
        await setDoc(doc(db, "config", "batches"), { list: DEFAULT_BATCHES });
        setBatches(DEFAULT_BATCHES);
        setSelectedBatchId(DEFAULT_BATCHES[0].id);
      }
    } catch (e) {
      console.error(e);
      setBatches(DEFAULT_BATCHES);
      setSelectedBatchId(DEFAULT_BATCHES[0].id);
    }
  };

  const handleAddBatch = async (e) => {
    e.preventDefault();
    setBatchError("");
    if (!newBatchJoiningYear.trim()) return;
    const yearNum = parseInt(newBatchJoiningYear);
    if (isNaN(yearNum)) {
      setBatchError("Joining year must be a valid number (e.g. 25).");
      return;
    }

    // Auto-calculate 4-year name: Batch 20XX-20YY where YY = XX + 4
    const fullJoiningYear = yearNum < 100 ? 2000 + yearNum : yearNum;
    const endYear = fullJoiningYear + 4;
    const name = `Batch ${fullJoiningYear}-${endYear}`;
    const id = `${fullJoiningYear}-${endYear}`;

    if (batches.some(b => b.id === id)) {
      setBatchError("A batch starting in this year already exists.");
      return;
    }

    const updatedList = [...batches, {
      id,
      name,
      joiningYear: yearNum % 100
    }].sort((a, b) => b.joiningYear - a.joiningYear);

    try {
      await setDoc(doc(db, "config", "batches"), { list: updatedList });
      setBatches(updatedList);
      setNewBatchJoiningYear("");
      if (!selectedBatchId) setSelectedBatchId(id);
    } catch (err) {
      setBatchError("Failed to save to database: " + err.message);
    }
  };

  const handleDeleteBatch = async (id) => {
    if (!confirm("Are you sure you want to delete this batch?")) return;
    const updatedList = batches.filter(b => b.id !== id);
    try {
      await setDoc(doc(db, "config", "batches"), { list: updatedList });
      setBatches(updatedList);
      if (selectedBatchId === id && updatedList.length > 0) {
        setSelectedBatchId(updatedList[0].id);
      }
    } catch (err) {
      alert("Failed to delete batch: " + err.message);
    }
  };

  const handleAddCategory = () => {
    if (!newCategoryName.trim()) return;
    const cat = newCategoryName.trim();
    if (feeCategories.includes(cat)) {
      alert("Category already exists.");
      return;
    }
    const updatedCats = [...feeCategories, cat];
    setFeeCategories(updatedCats);

    if (targetSemesterForCategory === "all") {
      setSemesters(prev => prev.map(s => ({
        ...s,
        fees: { ...s.fees, [cat]: "" }
      })));
    } else {
      const targetSem = parseInt(targetSemesterForCategory);
      setSemesters(prev => prev.map(s => {
        if (s.sem === targetSem) {
          return {
            ...s,
            fees: { ...s.fees, [cat]: "" }
          };
        }
        return s;
      }));
    }
    setNewCategoryName("");
    setTargetSemesterForCategory("all");
  };

  const handleRemoveCategory = (cat) => {
    if (["Tuition Fees", "Hostel Fees", "Other Fees"].includes(cat)) return;
    setFeeCategories(feeCategories.filter(c => c !== cat));
    setSemesters(prev => prev.map(s => {
      const nextFees = { ...s.fees };
      delete nextFees[cat];
      return { ...s, fees: nextFees };
    }));
  };

  const handleRemoveCategoryFromSemester = (sem, cat) => {
    if (["Tuition Fees", "Hostel Fees", "Other Fees"].includes(cat)) return;
    setSemesters(prev => prev.map(s => {
      if (s.sem === sem) {
        const nextFees = { ...s.fees };
        delete nextFees[cat];
        return { ...s, fees: nextFees };
      }
      return s;
    }));
  };

  // Reload structure when dept/batch/section changes
  useEffect(() => {
    if (!selectedDept || !selectedBatchId) return;
    setLoading(true);
    setSuccess("");
    const key = `${selectedDept}_B${selectedBatchId}_${selectedSection}`;
    getDocs(collection(db, "feeStructures", key, "semesters")).then(snap => {
      const existing = {};
      snap.forEach(d => { existing[d.id] = d.data(); });
      const hasData = Object.keys(existing).length > 0;
      setIsEditMode(hasData);
      setExistingStructureKey(hasData ? key : null);

      // Collect all unique categories found across loaded semester data
      const foundCategories = new Set(["Tuition Fees", "Hostel Fees", "Other Fees"]);
      snap.forEach(d => {
        const data = d.data();
        if (data.fees) {
          Object.keys(data.fees).forEach(cat => foundCategories.add(cat));
        }
      });
      const activeCats = Array.from(foundCategories);
      setFeeCategories(activeCats);

      setSemesters(prev => prev.map(s => {
        const data = existing[`sem${s.sem}`];
        const feesObj = {};
        activeCats.forEach(cat => {
          feesObj[cat] = "";
        });

        if (data) {
          if (data.fees) {
            Object.assign(feesObj, data.fees);
          } else if (data.amount) {
            // Backward-compatible fallback mapping old amount parameter to Tuition Fees
            feesObj["Tuition Fees"] = data.amount;
          }
        }

        return {
          sem: s.sem,
          fees: feesObj,
          deadline: data?.deadline || "",
        };
      }));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [selectedDept, selectedBatchId, selectedSection, semCount]);

  const updateSemFee = (sem, cat, value) => {
    setSemesters(prev => prev.map(s => {
      if (s.sem === sem) {
        return {
          ...s,
          fees: { ...s.fees, [cat]: value }
        };
      }
      return s;
    }));
  };

  const updateSemDeadline = (sem, value) => {
    setSemesters(prev => prev.map(s => s.sem === sem ? { ...s, deadline: value } : s));
  };

  const handleReset = () => {
    setSemesters(prev => {
      return prev.map(s => {
        const clearedFees = {};
        feeCategories.forEach(cat => { clearedFees[cat] = ""; });
        return { ...s, fees: clearedFees, deadline: "" };
      });
    });
    setIsEditMode(false);
    setSuccess("Form cleared. Fill in new values and save.");
  };

  const handleSave = async () => {
    if (!selectedDept || !selectedBatchId) { setSuccess(""); return; }
    setSaving(true);
    setSuccess("");
    try {
      const keys = applyAll
        ? sections.map(sec => `${selectedDept}_B${selectedBatchId}_${sec}`)
        : [`${selectedDept}_B${selectedBatchId}_${selectedSection}`];

      for (const key of keys) {
        // Save metadata doc
        await setDoc(doc(db, "feeStructures", key), {
          dept: selectedDept,
          batchId: selectedBatchId,
          section: applyAll ? "ALL" : selectedSection,
          programYears: 4,
          semesterCount: semCount,
          updatedAt: new Date().toISOString(),
        }, { merge: true });

        // Save per-semester sub-documents
        for (const s of semesters) {
          const semAmount = Object.values(s.fees || {}).reduce((sum, v) => sum + (parseFloat(v) || 0), 0);
          const cleanFees = {};
          Object.entries(s.fees || {}).forEach(([cat, val]) => {
            cleanFees[cat] = parseFloat(val) || 0;
          });

          await setDoc(doc(db, "feeStructures", key, "semesters", `sem${s.sem}`), {
            semester: s.sem,
            amount: semAmount, // fallback total amount for backwards compatibility
            fees: cleanFees,   // detailed categories map
            deadline: s.deadline || "",
            key,
            dept: selectedDept,
            batchId: selectedBatchId,
            updatedAt: new Date().toISOString(),
          });
        }
      }
      setIsEditMode(true);
      setExistingStructureKey(`${selectedDept}_B${selectedBatchId}_${selectedSection}`);
      const batchName = batches.find(b => b.id === selectedBatchId)?.name || selectedBatchId;
      setSuccess(applyAll
        ? `✅ Fee structure ${isEditMode ? "updated" : "saved"} for all sections of ${batchName} – ${selectedDept}!`
        : `✅ Fee structure ${isEditMode ? "updated" : "saved"} for ${selectedDept} – ${batchName} – Section ${selectedSection}!`
      );
    } catch (e) {
      console.error(e);
      setSuccess("❌ Error saving. Check console.");
    }
    setSaving(false);
  };

  const handleUpdateDeadlinesOnly = async () => {
    if (!selectedDept || !selectedBatchId) return;
    setSaving(true);
    setSuccess("");
    try {
      const key = `${selectedDept}_B${selectedBatchId}_${selectedSection}`;
      for (const s of semesters) {
        if (s.deadline) {
          await setDoc(doc(db, "feeStructures", key, "semesters", `sem${s.sem}`), {
            deadline: s.deadline,
            updatedAt: new Date().toISOString(),
          }, { merge: true });
        }
      }
      const batchName = batches.find(b => b.id === selectedBatchId)?.name || selectedBatchId;
      setSuccess(`✅ Due dates updated for ${selectedDept} – ${batchName} – Section ${selectedSection}!`);
    } catch (e) {
      console.error(e);
      setSuccess("❌ Error updating due dates.");
    }
    setSaving(false);
  };

  const totalFees = semesters.reduce((sum, sem) => {
    const semSum = Object.values(sem.fees || {}).reduce((s, v) => s + (parseFloat(v) || 0), 0);
    return sum + semSum;
  }, 0);

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
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label>Student Batch</label>
                <button
                  type="button"
                  onClick={() => setShowBatchModal(true)}
                  style={{
                    background: "none", border: "none", color: "var(--accent-blue)",
                    cursor: "pointer", fontSize: 11, fontWeight: 600, padding: 0,
                    textDecoration: "underline"
                  }}
                >
                  ⚙️ Manage Batches
                </button>
              </div>
              <select className="form-control" value={selectedBatchId} onChange={e => setSelectedBatchId(e.target.value)}>
                {batches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
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
              Apply this fee structure to <strong>all sections</strong> of {batches.find(b => b.id === selectedBatchId)?.name || "selected batch"} – {selectedDept || "selected dept"}
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

              {/* Fee Categories Management */}
              <div className="glass-card" style={{ marginBottom: 16 }}>
                <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 1 }}>
                  ➕ Fee Categories Configurator
                </h4>
                <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {feeCategories.map(cat => (
                      <span key={cat} className="badge badge-blue" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", fontSize: 12 }}>
                        {cat}
                        {!["Tuition Fees", "Hostel Fees", "Other Fees"].includes(cat) && (
                          <button
                            type="button"
                            onClick={() => handleRemoveCategory(cat)}
                            style={{ background: "none", border: "none", color: "var(--accent-red)", cursor: "pointer", fontSize: 14, padding: 0, fontWeight: "bold", marginLeft: 4 }}
                          >
                            ×
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 8, flex: 1, minWidth: 240 }}>
                    <input
                      className="form-control"
                      style={{ height: 38 }}
                      placeholder="Add custom fee (e.g. Transport Fees)"
                      value={newCategoryName}
                      onChange={e => setNewCategoryName(e.target.value)}
                    />
                    <select
                      className="form-control"
                      style={{ height: 38, width: 140, background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
                      value={targetSemesterForCategory}
                      onChange={e => setTargetSemesterForCategory(e.target.value)}
                    >
                      <option value="all">All Semesters</option>
                      {Array.from({ length: 8 }, (_, idx) => (
                        <option key={idx + 1} value={idx + 1}>Semester {idx + 1}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleAddCategory}
                      style={{ whiteSpace: "nowrap", padding: "0 16px" }}
                    >
                      Add Category
                    </button>
                  </div>
                </div>
              </div>

              <div className="glass-card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 700 }}>
                    <FaCalendarAlt style={{ marginRight: 8 }} />
                    {semCount} Semesters · {selectedDept} · {batches.find(b => b.id === selectedBatchId)?.name || selectedBatchId}{!applyAll ? ` · Section ${selectedSection}` : " · All Sections"}
                  </h3>
                  <div style={{ fontWeight: 700, color: "var(--accent-blue)", fontSize: 16 }}>
                    Total Fees: ₹{totalFees.toLocaleString("en-IN")}
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
                  {semesters.map(s => (
                    <div key={s.sem} style={{
                      padding: "18px 20px",
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid var(--border)",
                      borderRadius: 12,
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: "var(--accent-purple)" }}>
                          Semester {s.sem}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                          Total: ₹{Object.values(s.fees || {}).reduce((sum, v) => sum + (parseFloat(v) || 0), 0).toLocaleString("en-IN")}
                        </div>
                      </div>

                      {/* Inputs for each Category */}
                      {Object.keys(s.fees || {}).map(cat => (
                        <div key={cat} className="form-group" style={{ marginBottom: 12 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <label style={{ fontSize: 11, marginBottom: 4 }}>{cat} Amount (₹)</label>
                            {!["Tuition Fees", "Hostel Fees", "Other Fees"].includes(cat) && (
                              <button
                                type="button"
                                onClick={() => handleRemoveCategoryFromSemester(s.sem, cat)}
                                style={{ background: "none", border: "none", color: "var(--accent-red)", cursor: "pointer", fontSize: 10, padding: 0 }}
                              >
                                Delete
                              </button>
                            )}
                          </div>
                          <input
                            className="form-control"
                            type="number"
                            min="0"
                            placeholder="0"
                            value={s.fees?.[cat] || ""}
                            onChange={e => updateSemFee(s.sem, cat, e.target.value)}
                          />
                        </div>
                      ))}

                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label>Payment Due Date</label>
                        <input
                          className="form-control"
                          type="date"
                          value={s.deadline}
                          onChange={e => updateSemDeadline(s.sem, e.target.value)}
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

        {/* Batch Configuration Modal */}
        {showBatchModal && (
          <div className="modal-overlay" onClick={() => setShowBatchModal(false)}>
            <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: 500, width: "100%" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <h3 style={{ fontSize: 18, fontWeight: 700 }}>⚙️ Configure Batches</h3>
                <button
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-secondary)", fontSize: 20 }}
                  onClick={() => setShowBatchModal(false)}
                >
                  <FaTimes />
                </button>
              </div>

              {batchError && <div className="alert alert-error" style={{ marginBottom: 16 }}>{batchError}</div>}

              {/* Add New Batch Form */}
              <form onSubmit={handleAddBatch} style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20, alignItems: "flex-end" }}>
                <div className="form-group" style={{ flex: 1, minWidth: 150, marginBottom: 0 }}>
                  <label>Joining Year (e.g., 25 for 2025)</label>
                  <input
                    className="form-control"
                    placeholder="e.g. 25"
                    type="number"
                    value={newBatchJoiningYear}
                    onChange={e => setNewBatchJoiningYear(e.target.value)}
                    required
                  />
                </div>
                {newBatchJoiningYear.trim() && !isNaN(parseInt(newBatchJoiningYear)) && (
                  <div style={{ fontSize: 13, color: "var(--accent-blue)", fontWeight: 600, paddingBottom: 12, flex: "1 1 100%" }}>
                    Preview: Batch 20{newBatchJoiningYear.trim().padStart(2, "0")}-20{(parseInt(newBatchJoiningYear) + 4).toString().padStart(2, "0")} (4 Years)
                  </div>
                )}
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ height: 45, padding: "0 16px" }}
                >
                  <FaPlus style={{ marginRight: 6 }} /> Add 4-Year Batch
                </button>
              </form>

              {/* Batch list */}
              <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10, color: "var(--text-secondary)" }}>Active Batches</h4>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 220, overflowY: "auto", paddingRight: 6 }}>
                {batches.map(b => (
                  <div
                    key={b.id}
                    style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "10px 14px", background: "rgba(255, 255, 255, 0.04)",
                      border: "1px solid var(--border)", borderRadius: 8
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{b.name}</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Linked joining year: 20{b.joiningYear}</div>
                    </div>
                    <button
                      className="btn btn-danger btn-sm"
                      style={{ padding: "6px 8px" }}
                      onClick={() => handleDeleteBatch(b.id)}
                      title="Delete Batch"
                    >
                      <FaTrash />
                    </button>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 24, display: "flex", justifyContent: "flex-end" }}>
                <button className="btn btn-secondary" onClick={() => setShowBatchModal(false)}>Close</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
