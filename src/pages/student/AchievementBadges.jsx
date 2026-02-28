import { useState, useEffect } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../firebase";
import { useAuth } from "../../context/AuthContext";
import Sidebar from "../../components/Sidebar";

const BADGE_DEFS = [
  { id:"perfect_att",  emoji:"🏆", label:"Perfect Attendance",   desc:"100% attendance this month",        check: (a,m) => a.pct === 100 },
  { id:"high_att",     emoji:"⭐", label:"Star Attender",         desc:"Attendance above 90%",               check: (a,m) => a.pct >= 90  },
  { id:"min_att",      emoji:"✅", label:"Consistent Attender",   desc:"Attendance above 75%",               check: (a,m) => a.pct >= 75  },
  { id:"top_scorer",   emoji:"🥇", label:"Top Scorer",            desc:"Avg marks above 85%",                check: (a,m) => m.avg >= 85  },
  { id:"good_scorer",  emoji:"📚", label:"Academic Achiever",     desc:"Avg marks above 70%",                check: (a,m) => m.avg >= 70  },
  { id:"pass",         emoji:"✨", label:"Passed All Subjects",    desc:"All subject scores above 50",        check: (a,m) => m.min >= 50  },
];

export default function AchievementBadges() {
  const { currentUser, userData } = useAuth();
  const [attData, setAttData]   = useState({ pct: 0 });
  const [marksData, setMarksData] = useState({ avg: 0, min: 0 });
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    if (!currentUser) return;
    const fetch = async () => {
      try {
        const [attSnap, marksSnap] = await Promise.all([
          getDocs(query(collection(db,"attendance"), where("studentId","==",currentUser.uid))),
          getDocs(query(collection(db,"marks"),      where("studentId","==",currentUser.uid))),
        ]);

        let present = 0;
        attSnap.forEach(d => { if (d.data().status === "present") present++; });
        const pct = attSnap.size ? Math.round((present / attSnap.size) * 100) : 0;
        setAttData({ pct });

        const scores = marksSnap.docs.map(d => d.data().marksObtained).filter(v => v !== undefined && v !== null);
        const avg = scores.length ? Math.round(scores.reduce((a,b) => a+b,0)/scores.length) : 0;
        const min = scores.length ? Math.min(...scores) : 0;
        setMarksData({ avg, min });
      } catch(e) { console.error(e); }
      finally { setLoading(false); }
    };
    fetch();
  }, [currentUser]);

  const earned = BADGE_DEFS.filter(b => b.check(attData, marksData));
  const locked = BADGE_DEFS.filter(b => !b.check(attData, marksData));

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content animate-fade-up">
        <div className="page-header">
          <h1>🏅 Achievement Badges</h1>
          <p>You've earned {earned.length} of {BADGE_DEFS.length} badges</p>
        </div>

        {loading ? <div className="loading-center"><div className="spinner" /></div> : (
          <>
            {earned.length > 0 && (
              <>
                <h2 style={{ fontSize:15, fontWeight:700, color:"var(--accent-green)", marginBottom:16 }}>✅ Earned Badges</h2>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(200px,1fr))", gap:16, marginBottom:32 }}>
                  {earned.map(b => (
                    <div key={b.id} className="glass-card" style={{ textAlign:"center", borderColor:"rgba(52,211,153,0.3)", background:"rgba(52,211,153,0.06)" }}>
                      <div style={{ fontSize:48, marginBottom:12 }}>{b.emoji}</div>
                      <div style={{ fontWeight:700, fontSize:15, color:"var(--accent-green)", marginBottom:6 }}>{b.label}</div>
                      <div style={{ fontSize:13, color:"var(--text-muted)" }}>{b.desc}</div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {locked.length > 0 && (
              <>
                <h2 style={{ fontSize:15, fontWeight:700, color:"var(--text-muted)", marginBottom:16 }}>🔒 Locked Badges</h2>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(200px,1fr))", gap:16 }}>
                  {locked.map(b => (
                    <div key={b.id} className="glass-card" style={{ textAlign:"center", opacity:0.5 }}>
                      <div style={{ fontSize:48, marginBottom:12, filter:"grayscale(1)" }}>{b.emoji}</div>
                      <div style={{ fontWeight:700, fontSize:15, marginBottom:6 }}>{b.label}</div>
                      <div style={{ fontSize:13, color:"var(--text-muted)" }}>{b.desc}</div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
