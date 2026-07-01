import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children, allowedRole }) {
  const { currentUser, userRole, loading } = useAuth();

  if (loading) {
    return <div className="loading-center"><div className="spinner" /></div>;
  }

  if (!currentUser) {
    if (allowedRole === "office_staff") {
      return <Navigate to="/office/login" replace />;
    }
    return <Navigate to={`/${allowedRole}/login`} replace />;
  }

  // Wait for userRole to be populated before rejecting access
  if (userRole === null) {
    return <div className="loading-center"><div className="spinner" /></div>;
  }

  if (allowedRole && userRole !== allowedRole) {
    if (userRole === "office_staff") return <Navigate to="/office" replace />;
    return <Navigate to={`/${userRole || ""}`} replace />;
  }

  return children;
}
