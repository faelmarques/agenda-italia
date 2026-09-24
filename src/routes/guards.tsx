import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Brand } from "../components/ui";

const LoadingScreen = () => (
  <div className="loading-screen">
    <Brand />
    <span className="loading-dots" aria-label="Carregando">
      <i />
      <i />
      <i />
    </span>
  </div>
);

export const ProtectedRoute = () => {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingScreen />;
  if (!session?.authenticated) {
    return <Navigate to="/entrar" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
};

export const PublicRoute = ({ setup = false }: { setup?: boolean }) => {
  const { session, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (session?.authenticated) return <Navigate to="/" replace />;
  if (session && (setup ? !session.setupRequired : session.setupRequired)) {
    return <Navigate to={setup ? "/entrar" : "/configurar"} replace />;
  }
  return <Outlet />;
};
