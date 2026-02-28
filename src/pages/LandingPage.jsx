import { Link } from "react-router-dom";
import { FaUserShield, FaChalkboardTeacher, FaUserGraduate, FaUsers } from "react-icons/fa";
import { useAuth } from "../context/AuthContext";

const portals = [
  {
    role: "admin",
    title: "Admin Portal",
    description: "Manage departments, teachers, students and view overall performance analytics.",
    icon: <FaUserShield />,
    gradient: "var(--grad-admin)",
    glow: "rgba(102,126,234,0.3)",
    link: "/admin/login",
  },
  {
    role: "teacher",
    title: "Teacher Portal",
    description: "Handle classes, manage student data, mark attendance and enter exam results.",
    icon: <FaChalkboardTeacher />,
    gradient: "var(--grad-teacher)",
    glow: "rgba(245,87,108,0.3)",
    link: "/teacher/login",
  },
  {
    role: "student",
    title: "Student Portal",
    description: "Track your performance, view attendance, exam marks and portfolio analytics.",
    icon: <FaUserGraduate />,
    gradient: "var(--grad-student)",
    glow: "rgba(79,172,254,0.3)",
    link: "/student/login",
  },
  {
    role: "parent",
    title: "Parent Portal",
    description: "Monitor your child's academic performance and attendance in real-time.",
    icon: <FaUsers />,
    gradient: "var(--grad-parent)",
    glow: "rgba(67,233,123,0.3)",
    link: "/parent/login",
  },
];

export default function LandingPage() {
  const { currentUser, userRole } = useAuth();

  return (
    <div className="landing-page">
      {/* Background blobs */}
      <div className="login-bg-blob" style={{ width: 500, height: 500, background: "#667eea", top: -150, left: -100 }} />
      <div className="login-bg-blob" style={{ width: 400, height: 400, background: "#f5576c", bottom: -100, right: -100 }} />
      <div className="login-bg-blob" style={{ width: 300, height: 300, background: "#4facfe", top: "40%", left: "45%" }} />

      <div className="landing-content">
        {/* Hero */}
        <div className="landing-hero animate-fade-up">
          <div className="landing-logo">
            <span>🎓</span>
          </div>
          <h1>Student Performance Portal</h1>
          <p>A comprehensive academic management system for institutions.</p>
          <div className="landing-meta">
            <span className="badge badge-blue">ECE • IT • MECH • EEE • CSE • AIDS</span>
          </div>
        </div>

        {/* Portal cards */}
        <div className="portal-grid animate-fade-in">
          {portals.map((p) => (
            <Link
              key={p.role}
              to={currentUser && userRole === p.role ? `/${p.role}` : p.link}
              className="portal-card"
              style={{ "--glow": p.glow }}
            >
              <div className="portal-card-icon" style={{ background: p.gradient }}>
                {p.icon}
              </div>
              <div className="portal-card-gradient" style={{ background: p.gradient }} />
              <h3>{p.title}</h3>
              <p>{p.description}</p>
              <span className="portal-card-cta">
                {currentUser && userRole === p.role ? "Go to Dashboard →" : "Sign In →"}
              </span>
            </Link>
          ))}
        </div>

        <p className="landing-footer">© 2026 Student Performance Portal. Built with Firebase + React.</p>
      </div>

      <style>{`
        .landing-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--bg-primary);
          position: relative;
          overflow: hidden;
          padding: 40px 24px;
        }
        .landing-content {
          position: relative;
          z-index: 1;
          max-width: 1100px;
          width: 100%;
        }
        .landing-hero {
          text-align: center;
          margin-bottom: 56px;
        }
        .landing-logo {
          font-size: 64px;
          margin-bottom: 20px;
          display: inline-block;
          animation: float 3s ease-in-out infinite;
        }
        .landing-hero h1 {
          font-family: 'Outfit', sans-serif;
          font-size: clamp(28px, 5vw, 52px);
          font-weight: 800;
          background: linear-gradient(135deg, #fff 0%, #94a3b8 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          margin-bottom: 16px;
        }
        .landing-hero > p {
          font-size: 18px;
          color: var(--text-secondary);
          margin-bottom: 20px;
        }
        .landing-meta { margin-top: 12px; }
        .portal-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 24px;
          margin-bottom: 48px;
        }
        .portal-card {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-xl);
          padding: 32px 28px;
          text-decoration: none;
          color: var(--text-primary);
          display: flex;
          flex-direction: column;
          gap: 12px;
          position: relative;
          overflow: hidden;
          transition: all 0.35s cubic-bezier(0.4,0,0.2,1);
          cursor: pointer;
        }
        .portal-card:hover {
          transform: translateY(-6px);
          border-color: rgba(255,255,255,0.15);
          box-shadow: 0 20px 60px var(--glow, rgba(0,0,0,0.3));
        }
        .portal-card-gradient {
          position: absolute;
          inset: 0;
          opacity: 0;
          transition: opacity 0.35s ease;
        }
        .portal-card:hover .portal-card-gradient { opacity: 0.06; }
        .portal-card-icon {
          width: 56px;
          height: 56px;
          border-radius: var(--radius-md);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          color: #fff;
          margin-bottom: 8px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.3);
        }
        .portal-card h3 {
          font-family: 'Outfit', sans-serif;
          font-size: 20px;
          font-weight: 700;
        }
        .portal-card > p {
          color: var(--text-secondary);
          font-size: 14px;
          line-height: 1.6;
          flex: 1;
        }
        .portal-card-cta {
          font-size: 14px;
          font-weight: 600;
          color: var(--accent-blue);
          margin-top: 8px;
        }
        .landing-footer {
          text-align: center;
          color: var(--text-muted);
          font-size: 13px;
        }
        @media (max-width: 600px) {
          .portal-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}
