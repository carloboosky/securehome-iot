import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/auth";

function ProtectedRoute({ allow, children }) {
  const { session, role, loading } = useAuth();

  if (loading) {
    return (
      <main className="dashboard-loading-container">
        <div className="dashboard-loader" />
        <p>Verificando acceso...</p>
      </main>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (allow && role !== allow) {
    return <Navigate to={role === "admin" ? "/admin" : "/dashboard"} replace />;
  }

  return children;
}

export default ProtectedRoute;
