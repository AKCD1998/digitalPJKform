import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./AuthProvider.jsx";

function ProtectedRoute() {
  const { isAuthenticated, isBootstrapping } = useAuth();
  const location = useLocation();

  if (isBootstrapping) {
    return (
      <main className="app-shell">
        <p>Loading session...</p>
      </main>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}

export default ProtectedRoute;
