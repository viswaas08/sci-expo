import { useState } from "react";
import { useNavigate, NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import {
  FaHome, FaChalkboardTeacher, FaBuilding, FaUserGraduate,
  FaCog, FaSignOutAlt, FaSun, FaMoon, FaBell, FaBars, FaTimes,
  FaBullhorn, FaCalendarAlt, FaClipboardList, FaComments, FaMoneyBill,
  FaSearch, FaAward, FaFire, FaFilePdf, FaUserTie, FaLayerGroup, FaListAlt,
} from "react-icons/fa";

const adminNav = [
  { label: "Dashboard",    icon: <FaHome />,            to: "/admin" },
  { label: "Teachers",     icon: <FaChalkboardTeacher />, to: "/admin/teachers" },
  { label: "Departments",  icon: <FaBuilding />,         to: "/admin/departments" },
  { label: "All Students", icon: <FaUserGraduate />,     to: "/admin/students" },
  { label: "Office Staff", icon: <FaUserTie />,          to: "/admin/office-staff" },
  { label: "Announcements",icon: <FaBullhorn />,         to: "/admin/announcements" },
  { label: "Audit Log",    icon: <FaClipboardList />,    to: "/admin/audit" },
  { label: "Settings",     icon: <FaCog />,              to: "/admin/settings" },
];

const officeNav = [
  { label: "Dashboard",     icon: <FaHome />,          to: "/office" },
  { label: "Fee Structure", icon: <FaLayerGroup />,    to: "/office/fee-structure" },
  { label: "Student Fees",  icon: <FaMoneyBill />,     to: "/office/student-fees" },
  { label: "Deadlines",     icon: <FaCalendarAlt />,   to: "/office/deadlines" },
  { label: "Payment History",icon: <FaListAlt />,      to: "/office/payment-history" },
];

const teacherNav = [
  { label: "Dashboard",    icon: <FaHome />,             to: "/teacher" },
  { label: "Students",     icon: <FaUserGraduate />,     to: "/teacher/students" },
  { label: "Exams & Marks",icon: <FaBuilding />,         to: "/teacher/exams" },
  { label: "Attendance",   icon: <FaChalkboardTeacher />, to: "/teacher/attendance" },
  { label: "Timetable",    icon: <FaCalendarAlt />,      to: "/teacher/timetable" },
  { label: "Assignments",  icon: <FaClipboardList />,    to: "/teacher/assignments" },
  { label: "Gradebook",    icon: <FaSearch />,           to: "/teacher/gradebook" },
  { label: "Leave Requests",icon: <FaBell />,            to: "/teacher/leave-requests" },
  { label: "Settings",     icon: <FaCog />,              to: "/teacher/settings" },
];

const studentNav = [
  { label: "Dashboard",    icon: <FaHome />,             to: "/student" },
  { label: "Attendance",   icon: <FaChalkboardTeacher />, to: "/student/attendance" },
  { label: "Marks",        icon: <FaBuilding />,         to: "/student/marks" },
  { label: "Timetable",    icon: <FaCalendarAlt />,      to: "/student/timetable" },
  { label: "Assignments",  icon: <FaClipboardList />,    to: "/student/assignments" },
  { label: "Att. Calendar",icon: <FaFire />,             to: "/student/heatmap" },
  { label: "Badges",       icon: <FaAward />,            to: "/student/badges" },
  { label: "Report Card",  icon: <FaFilePdf />,          to: "/student/report" },
  { label: "Portfolio",    icon: <FaUserGraduate />,     to: "/student/portfolio" },
  { label: "Fee Status",   icon: <FaMoneyBill />,        to: "/student/fees" },
  { label: "Settings",     icon: <FaCog />,              to: "/student/settings" },
];

const parentNav = [
  { label: "Dashboard",    icon: <FaHome />,             to: "/parent" },
  { label: "Attendance",   icon: <FaChalkboardTeacher />, to: "/parent/attendance" },
  { label: "Marks",        icon: <FaBuilding />,         to: "/parent/marks" },
  { label: "Timetable",    icon: <FaCalendarAlt />,      to: "/parent/timetable" },
  { label: "Leave Request",icon: <FaClipboardList />,    to: "/parent/leave" },
  { label: "Fee Status",   icon: <FaMoneyBill />,        to: "/parent/fees" },
  { label: "Chat Teacher", icon: <FaComments />,         to: "/parent/chat" },
];

const navMap = { admin: adminNav, teacher: teacherNav, student: studentNav, parent: parentNav, office_staff: officeNav };

const roleLabels = {
  admin:        { label: "Admin",        color: "var(--accent-purple)" },
  teacher:      { label: "Teacher",      color: "var(--accent-orange)" },
  student:      { label: "Student",      color: "var(--accent-blue)"   },
  parent:       { label: "Parent",       color: "var(--accent-green)"  },
  office_staff: { label: "Office Staff", color: "#f59e0b"               },
};

export default function Sidebar() {
  const { userData, userRole, logout } = useAuth();
  const { theme, toggleTheme }         = useTheme();
  const navigate  = useNavigate();
  const [open, setOpen] = useState(false); // mobile menu

  const navItems = navMap[userRole] || [];
  const roleInfo = roleLabels[userRole] || {};

  const handleLogout = async () => { await logout(); navigate("/"); };

  const sidebarContent = (
    <>
      {/* Logo + close (mobile) */}
      <div className="sidebar-logo" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>🎓 <span>SPPortal</span></span>
        <button className="mobile-close-btn" onClick={() => setOpen(false)} aria-label="Close menu">
          <FaTimes />
        </button>
      </div>

      {/* User info */}
      <div style={{ padding: "0 12px 16px", borderBottom: "1px solid var(--border)", marginBottom: 12 }}>
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

      {/* Nav links */}
      <nav style={{ flex: 1, overflowY: "auto" }}>
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to.split("/").length === 2}
            className={({ isActive }) => `sidebar-nav-item${isActive ? " active" : ""}`}
            onClick={() => setOpen(false)}
          >
            {item.icon} {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Footer: theme toggle + logout */}
      <div className="sidebar-footer">
        <button
          className="sidebar-nav-item"
          style={{ width: "100%", border: "none", background: "transparent", marginBottom: 6, justifyContent: "flex-start" }}
          onClick={toggleTheme}
        >
          {theme === "dark" ? <FaSun style={{ color: "var(--accent-orange)" }} /> : <FaMoon style={{ color: "var(--accent-purple)" }} />}
          {theme === "dark" ? "Light Mode" : "Dark Mode"}
        </button>
        <button className="sidebar-nav-item btn-danger" style={{ width: "100%", border: "none" }} onClick={handleLogout}>
          <FaSignOutAlt /> Sign Out
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile hamburger button */}
      <button className="hamburger-btn" onClick={() => setOpen(true)} aria-label="Open menu">
        <FaBars />
      </button>

      {/* Desktop sidebar */}
      <aside className="sidebar desktop-sidebar">
        {sidebarContent}
      </aside>

      {/* Mobile overlay sidebar */}
      {open && (
        <>
          <div className="sidebar-overlay" onClick={() => setOpen(false)} />
          <aside className="sidebar mobile-sidebar open">
            {sidebarContent}
          </aside>
        </>
      )}
    </>
  );
}
