import { useNavigate, NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  FaHome, FaChalkboardTeacher, FaBuilding, FaUserGraduate,
  FaCog, FaSignOutAlt
} from "react-icons/fa";

const adminNav = [
  { label: "Dashboard", icon: <FaHome />, to: "/admin" },
  { label: "Teachers", icon: <FaChalkboardTeacher />, to: "/admin/teachers" },
  { label: "Departments", icon: <FaBuilding />, to: "/admin/departments" },
  { label: "All Students", icon: <FaUserGraduate />, to: "/admin/students" },
  { label: "Settings", icon: <FaCog />, to: "/admin/settings" },
];

const teacherNav = [
  { label: "Dashboard", icon: <FaHome />, to: "/teacher" },
  { label: "Students", icon: <FaUserGraduate />, to: "/teacher/students" },
  { label: "Exams & Marks", icon: <FaBuilding />, to: "/teacher/exams" },
  { label: "Attendance", icon: <FaChalkboardTeacher />, to: "/teacher/attendance" },
];

const studentNav = [
  { label: "Dashboard", icon: <FaHome />, to: "/student" },
  { label: "Attendance", icon: <FaChalkboardTeacher />, to: "/student/attendance" },
  { label: "Marks", icon: <FaBuilding />, to: "/student/marks" },
  { label: "Portfolio", icon: <FaUserGraduate />, to: "/student/portfolio" },
];

const parentNav = [
  { label: "Dashboard", icon: <FaHome />, to: "/parent" },
  { label: "Attendance", icon: <FaChalkboardTeacher />, to: "/parent/attendance" },
  { label: "Marks", icon: <FaBuilding />, to: "/parent/marks" },
];

const navMap = { admin: adminNav, teacher: teacherNav, student: studentNav, parent: parentNav };

const roleLabels = {
  admin: { label: "Admin", color: "var(--accent-purple)" },
  teacher: { label: "Teacher", color: "var(--accent-orange)" },
  student: { label: "Student", color: "var(--accent-blue)" },
  parent: { label: "Parent", color: "var(--accent-green)" },
};

export default function Sidebar() {
  const { userData, userRole, logout } = useAuth();
  const navigate = useNavigate();

  const navItems = navMap[userRole] || [];
  const roleInfo = roleLabels[userRole] || {};

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        🎓 <span>SPPortal</span>
      </div>
      <div style={{ padding: "0 12px 16px", borderBottom: "1px solid var(--border)", marginBottom: "12px" }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
          {userData?.name || userData?.email || "User"}
        </div>
        <span className="badge" style={{ background: `${roleInfo.color}20`, color: roleInfo.color, marginTop: 6, fontSize: 11 }}>
          {roleInfo.label}
        </span>
        {userData?.dept && (
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
            {userData.dept}{userData.year ? ` · Year ${userData.year}` : ""}{userData.section ? ` · Sec ${userData.section}` : ""}
          </div>
        )}
      </div>

      <nav>
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to.split("/").length === 2}
            className={({ isActive }) => `sidebar-nav-item${isActive ? " active" : ""}`}
          >
            {item.icon} {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <button className="sidebar-nav-item btn-danger" style={{ width: "100%", border: "none" }} onClick={handleLogout}>
          <FaSignOutAlt /> Sign Out
        </button>
      </div>
    </aside>
  );
}
