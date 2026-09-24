import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
  CalendarDays,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Users,
  X,
} from "lucide-react";
import clsx from "clsx";
import { useAuth } from "../context/AuthContext";
import { Brand } from "./ui";
import { useToast } from "./Toast";

const navItems = [
  { to: "/", label: "Início", icon: LayoutDashboard, end: true },
  { to: "/agenda", label: "Agenda", icon: CalendarDays },
  { to: "/pacientes", label: "Pacientes", icon: Users },
  { to: "/configuracoes", label: "Configurações", icon: Settings },
];

export const AppLayout = () => {
  const { session, logout } = useAuth();
  const { toast } = useToast();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
      toast({ type: "success", message: "Sessão encerrada com segurança." });
    } catch {
      toast({ type: "error", message: "Não foi possível encerrar a sessão." });
    }
  };

  const initials = session?.user?.name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <div className="app-shell">
      <button
        className={clsx("sidebar-scrim", menuOpen && "sidebar-scrim--visible")}
        onClick={() => setMenuOpen(false)}
        aria-label="Fechar menu"
        type="button"
      />
      <aside className={clsx("sidebar", menuOpen && "sidebar--open")}>
        <div className="sidebar__top">
          <Brand />
          <button
            className="icon-button sidebar__close"
            type="button"
            onClick={() => setMenuOpen(false)}
            aria-label="Fechar menu"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="sidebar__nav" aria-label="Navegação principal">
          <span className="sidebar__label">Menu principal</span>
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => clsx("sidebar__link", isActive && "sidebar__link--active")}
              onClick={() => setMenuOpen(false)}
            >
              <Icon size={20} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar__footer">
          <div className="user-chip">
            <span className="avatar">{initials || "AI"}</span>
            <span className="user-chip__info">
              <strong>{session?.user?.name}</strong>
              <small>{session?.user?.professionalTitle ?? "Psicólogo(a)"}</small>
            </span>
          </div>
          <button className="sidebar__logout" type="button" onClick={() => void handleLogout()}>
            <LogOut size={18} />
            Sair
          </button>
        </div>
      </aside>

      <div className="app-main">
        <header className="mobile-header">
          <button
            className="icon-button"
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Abrir menu"
          >
            <Menu size={22} />
          </button>
          <Brand compact />
          <span className="mobile-header__title">{session?.user?.clinicName ?? "Agenda"}</span>
          <span className="avatar avatar--small">{initials || "AI"}</span>
        </header>
        <main className="page-container">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
