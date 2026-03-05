import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import ProtectedRoute from "./components/ProtectedRoute";

// ── Core Pages ───────────────────────────────────────────────────────────────
import LandingPage from "./pages/LandingPage";

// Admin
import AdminLogin       from "./pages/admin/AdminLogin";
import AdminDashboard   from "./pages/admin/AdminDashboard";
import ManageTeachers   from "./pages/admin/ManageTeachers";
import ManageDepartments from "./pages/admin/ManageDepartments";
import AdminSettings    from "./pages/admin/AdminSettings";
import AllStudents      from "./pages/admin/AllStudents";
import AuditLog         from "./pages/admin/AuditLog";
import ManageOfficeStaff from "./pages/admin/ManageOfficeStaff";

// Office Staff
import OfficeDashboard     from "./pages/office/OfficeDashboard";
import ManageFeeStructure  from "./pages/office/ManageFeeStructure";
import StudentFeeRecords   from "./pages/office/StudentFeeRecords";
import FeesDeadlines       from "./pages/office/FeesDeadlines";
import PaymentHistory      from "./pages/office/PaymentHistory";

// Teacher
import TeacherLogin     from "./pages/teacher/TeacherLogin";
import TeacherDashboard from "./pages/teacher/TeacherDashboard";
import ManageStudents   from "./pages/teacher/ManageStudents";
import ManageExams      from "./pages/teacher/ManageExams";
import MarkAttendance   from "./pages/teacher/MarkAttendance";
import TeacherSettings  from "./pages/teacher/TeacherSettings";
import Gradebook        from "./pages/teacher/Gradebook";

// Student
import StudentLogin      from "./pages/student/StudentLogin";
import StudentDashboard  from "./pages/student/StudentDashboard";
import StudentAttendance from "./pages/student/StudentAttendance";
import StudentMarks      from "./pages/student/StudentMarks";
import StudentPortfolio  from "./pages/student/StudentPortfolio";
import StudentSettings   from "./pages/student/StudentSettings";
import AttendanceHeatmap from "./pages/student/AttendanceHeatmap";
import AchievementBadges from "./pages/student/AchievementBadges";
import ReportCard        from "./pages/student/ReportCard";

// Parent
import ParentLogin      from "./pages/parent/ParentLogin";
import ParentDashboard  from "./pages/parent/ParentDashboard";
import ParentAttendance from "./pages/parent/ParentAttendance";
import ParentMarks      from "./pages/parent/ParentMarks";
import FeeStatus        from "./pages/parent/FeeStatus";

// Shared (multi-portal)
import Announcements  from "./pages/shared/Announcements";
import Timetable      from "./pages/shared/Timetable";
import Assignments    from "./pages/shared/Assignments";
import LeaveRequests  from "./pages/shared/LeaveRequests";
import Chat           from "./pages/shared/Chat";

import "./index.css";

const P = (role, Component) => (
  <ProtectedRoute allowedRole={role}><Component /></ProtectedRoute>
);

export default function App() {
  return (
    <ThemeProvider>
      <Router>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<LandingPage />} />

            {/* ── Admin ─────────────────────────────────────────── */}
            <Route path="/admin/login"       element={<AdminLogin />} />
            <Route path="/admin"             element={P("admin", AdminDashboard)} />
            <Route path="/admin/teachers"    element={P("admin", ManageTeachers)} />
            <Route path="/admin/departments" element={P("admin", ManageDepartments)} />
            <Route path="/admin/students"    element={P("admin", AllStudents)} />
            <Route path="/admin/office-staff" element={P("admin", ManageOfficeStaff)} />
            <Route path="/admin/settings"    element={P("admin", AdminSettings)} />
            <Route path="/admin/announcements" element={P("admin", Announcements)} />
            <Route path="/admin/audit"       element={P("admin", AuditLog)} />

            {/* ── Office Staff ───────────────────────────────────── */}
            <Route path="/office"                 element={P("office_staff", OfficeDashboard)} />
            <Route path="/office/fee-structure"   element={P("office_staff", ManageFeeStructure)} />
            <Route path="/office/student-fees"    element={P("office_staff", StudentFeeRecords)} />
            <Route path="/office/deadlines"       element={P("office_staff", FeesDeadlines)} />
            <Route path="/office/payment-history" element={P("office_staff", PaymentHistory)} />

            {/* ── Teacher ───────────────────────────────────────── */}
            <Route path="/teacher/login"     element={<TeacherLogin />} />
            <Route path="/teacher"           element={P("teacher", TeacherDashboard)} />
            <Route path="/teacher/students"  element={P("teacher", ManageStudents)} />
            <Route path="/teacher/exams"     element={P("teacher", ManageExams)} />
            <Route path="/teacher/attendance"element={P("teacher", MarkAttendance)} />
            <Route path="/teacher/settings"  element={P("teacher", TeacherSettings)} />
            <Route path="/teacher/gradebook" element={P("teacher", Gradebook)} />
            <Route path="/teacher/timetable" element={P("teacher", Timetable)} />
            <Route path="/teacher/assignments" element={P("teacher", Assignments)} />
            <Route path="/teacher/announcements" element={P("teacher", Announcements)} />
            <Route path="/teacher/leave-requests" element={P("teacher", LeaveRequests)} />

            {/* ── Student ───────────────────────────────────────── */}
            <Route path="/student/login"     element={<StudentLogin />} />
            <Route path="/student"           element={P("student", StudentDashboard)} />
            <Route path="/student/attendance"element={P("student", StudentAttendance)} />
            <Route path="/student/marks"     element={P("student", StudentMarks)} />
            <Route path="/student/portfolio" element={P("student", StudentPortfolio)} />
            <Route path="/student/settings"  element={P("student", StudentSettings)} />
            <Route path="/student/timetable" element={P("student", Timetable)} />
            <Route path="/student/assignments" element={P("student", Assignments)} />
            <Route path="/student/heatmap"   element={P("student", AttendanceHeatmap)} />
            <Route path="/student/badges"    element={P("student", AchievementBadges)} />
            <Route path="/student/report"    element={P("student", ReportCard)} />

            {/* ── Parent ────────────────────────────────────────── */}
            <Route path="/parent/login"      element={<ParentLogin />} />
            <Route path="/parent"            element={P("parent", ParentDashboard)} />
            <Route path="/parent/attendance" element={P("parent", ParentAttendance)} />
            <Route path="/parent/marks"      element={P("parent", ParentMarks)} />
            <Route path="/parent/timetable"  element={P("parent", Timetable)} />
            <Route path="/parent/leave"      element={P("parent", LeaveRequests)} />
            <Route path="/parent/fees"       element={P("parent", FeeStatus)} />
            <Route path="/parent/chat"       element={P("parent", Chat)} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </Router>
    </ThemeProvider>
  );
}
