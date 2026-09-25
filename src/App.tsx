import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ToastProvider } from "./components/Toast";
import { AppLayout } from "./components/Layout";
import { DashboardPage } from "./pages/DashboardPage";
import { CalendarPage } from "./pages/CalendarPage";
import { PatientsPage } from "./pages/PatientsPage";
import { ConsultationsPage } from "./pages/ConsultationsPage";
import { ProntuarioPage } from "./pages/ProntuarioPage";
import { PatientRecordPage } from "./pages/PatientRecordPage";
import { SettingsPage } from "./pages/SettingsPage";
import { LoginPage } from "./pages/LoginPage";
import { SetupPage } from "./pages/SetupPage";
import { ProtectedRoute, PublicRoute } from "./routes/guards";

export const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <ToastProvider>
        <Routes>
          <Route element={<PublicRoute />}>
            <Route path="/entrar" element={<LoginPage />} />
          </Route>
          <Route element={<PublicRoute setup />}>
            <Route path="/configurar" element={<SetupPage />} />
          </Route>
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route index element={<DashboardPage />} />
              <Route path="agenda" element={<CalendarPage />} />
              <Route path="pacientes" element={<PatientsPage />} />
              <Route path="consultas" element={<ConsultationsPage />} />
              <Route path="prontuario" element={<ProntuarioPage />} />
              <Route path="prontuario/:patientId" element={<PatientRecordPage />} />
              <Route path="configuracoes" element={<SettingsPage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ToastProvider>
    </AuthProvider>
  </BrowserRouter>
);
