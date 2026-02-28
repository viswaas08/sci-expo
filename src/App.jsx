import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";

// Pages
import LandingPage from "./pages/LandingPage";

import AdminLogin from "./pages/admin/AdminLogin";
import AdminDashboard from "./pages/admin/AdminDashboard";
import ManageTeachers from "./pages/admin/ManageTeachers";
import ManageDepartments from "./pages/admin/ManageDepartments";
import AdminSettings from "./pages/admin/AdminSettings";
import AllStudents from "./pages/admin/AllStudents";

// Teacher
import TeacherLogin from "./pages/teacher/TeacherLogin";
import TeacherDashboard from "./pages/teacher/TeacherDashboard";
import ManageStudents from "./pages/teacher/ManageStudents";
import ManageExams from "./pages/teacher/ManageExams";
import MarkAttendance from "./pages/teacher/MarkAttendance";

// Student
import StudentLogin from "./pages/student/StudentLogin";
import StudentDashboard from "./pages/student/StudentDashboard";
import StudentAttendance from "./pages/student/StudentAttendance";
import StudentMarks from "./pages/student/StudentMarks";
import StudentPortfolio from "./pages/student/StudentPortfolio";

// Parent
import ParentLogin from "./pages/parent/ParentLogin";
import ParentDashboard from "./pages/parent/ParentDashboard";
import ParentAttendance from "./pages/parent/ParentAttendance";
import ParentMarks from "./pages/parent/ParentMarks";

import "./index.css";

export default function App() {
  return (
    // Router must wrap AuthProvider because AuthContext uses useLocation()
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<LandingPage />} />

          {/* Admin */}
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<ProtectedRoute allowedRole="admin"><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/teachers" element={<ProtectedRoute allowedRole="admin"><ManageTeachers /></ProtectedRoute>} />
          <Route path="/admin/departments" element={<ProtectedRoute allowedRole="admin"><ManageDepartments /></ProtectedRoute>} />
          <Route path="/admin/students" element={<ProtectedRoute allowedRole="admin"><AllStudents /></ProtectedRoute>} />
          <Route path="/admin/settings" element={<ProtectedRoute allowedRole="admin"><AdminSettings /></ProtectedRoute>} />

          {/* Teacher */}
          <Route path="/teacher/login" element={<TeacherLogin />} />
          <Route path="/teacher" element={<ProtectedRoute allowedRole="teacher"><TeacherDashboard /></ProtectedRoute>} />
          <Route path="/teacher/students" element={<ProtectedRoute allowedRole="teacher"><ManageStudents /></ProtectedRoute>} />
          <Route path="/teacher/exams" element={<ProtectedRoute allowedRole="teacher"><ManageExams /></ProtectedRoute>} />
          <Route path="/teacher/attendance" element={<ProtectedRoute allowedRole="teacher"><MarkAttendance /></ProtectedRoute>} />

          {/* Student */}
          <Route path="/student/login" element={<StudentLogin />} />
          <Route path="/student" element={<ProtectedRoute allowedRole="student"><StudentDashboard /></ProtectedRoute>} />
          <Route path="/student/attendance" element={<ProtectedRoute allowedRole="student"><StudentAttendance /></ProtectedRoute>} />
          <Route path="/student/marks" element={<ProtectedRoute allowedRole="student"><StudentMarks /></ProtectedRoute>} />
          <Route path="/student/portfolio" element={<ProtectedRoute allowedRole="student"><StudentPortfolio /></ProtectedRoute>} />

          {/* Parent */}
          <Route path="/parent/login" element={<ParentLogin />} />
          <Route path="/parent" element={<ProtectedRoute allowedRole="parent"><ParentDashboard /></ProtectedRoute>} />
          <Route path="/parent/attendance" element={<ProtectedRoute allowedRole="parent"><ParentAttendance /></ProtectedRoute>} />
          <Route path="/parent/marks" element={<ProtectedRoute allowedRole="parent"><ParentMarks /></ProtectedRoute>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

