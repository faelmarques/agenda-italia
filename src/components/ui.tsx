import {
  useEffect,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import clsx from "clsx";
import { CalendarX2, LoaderCircle, X } from "lucide-react";
import type { AppointmentStatus } from "../types";
import { capitalize } from "../lib/date";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "small" | "medium";
  loading?: boolean;
  icon?: ReactNode;
}

export const Button = ({
  variant = "primary",
  size = "medium",
  loading = false,
  icon,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) => (
  <button
    className={clsx("button", `button--${variant}`, `button--${size}`, className)}
    disabled={disabled || loading}
    {...props}
  >
    {loading ? <LoaderCircle className="spin" size={18} aria-hidden="true" /> : icon}
    {children}
  </button>
);

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  size?: "small" | "medium" | "large";
}

export const Modal = ({
  open,
  onClose,
  title,
  description,
  children,
  size = "medium",
}: ModalProps) => {
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section
        className={clsx("modal", `modal--${size}`)}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="modal__header">
          <div>
            <h2 id="modal-title">{title}</h2>
            {description ? <p>{description}</p> : null}
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Fechar">
            <X size={20} />
          </button>
        </header>
        <div className="modal__body">{children}</div>
      </section>
    </div>
  );
};

export const FormField = ({
  label,
  htmlFor,
  hint,
  error,
  required,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}) => (
  <div className="form-field">
    <label htmlFor={htmlFor}>
      {label} {required ? <span aria-hidden="true">*</span> : null}
    </label>
    {children}
    {error ? <span className="field-error">{error}</span> : null}
    {!error && hint ? <span className="field-hint">{hint}</span> : null}
  </div>
);

export const Input = ({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) => (
  <input className={clsx("input", className)} {...props} />
);

export const Select = ({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) => (
  <select className={clsx("input", "select", className)} {...props} />
);

export const Textarea = ({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea className={clsx("input", "textarea", className)} {...props} />
);

export const Checkbox = ({
  label,
  description,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; description?: string }) => (
  <label className="checkbox-field">
    <input type="checkbox" {...props} />
    <span>
      <strong>{label}</strong>
      {description ? <small>{description}</small> : null}
    </span>
  </label>
);

export const FormError = ({ children }: { children: ReactNode }) => {
  if (!children) return null;
  return <div className="form-error" role="alert">{children}</div>;
};

export const EmptyState = ({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) => (
  <div className="empty-state">
    <span className="empty-state__icon"><CalendarX2 size={28} /></span>
    <h3>{title}</h3>
    <p>{description}</p>
    {action}
  </div>
);

const statusLabels: Record<AppointmentStatus, string> = {
  scheduled: "Agendado",
  confirmed: "Confirmado",
  cancelled: "Cancelado",
  completed: "Concluído",
  no_show: "Não compareceu",
};

export const StatusBadge = ({ status }: { status: AppointmentStatus }) => (
  <span className={clsx("status-badge", `status-badge--${status}`)}>
    {statusLabels[status] ?? capitalize(status)}
  </span>
);

export const PageHeader = ({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) => (
  <header className="page-header">
    <div>
      {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
      <h1>{title}</h1>
      {description ? <p>{description}</p> : null}
    </div>
    {action ? <div className="page-header__action">{action}</div> : null}
  </header>
);

export const Brand = ({ compact = false }: { compact?: boolean }) => (
  <div className={clsx("brand", compact && "brand--compact")}>
    <span className="brand__mark" aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
    {!compact ? (
      <span className="brand__text">
        <strong>Agenda Itália</strong>
        <small>Gestão de atendimentos</small>
      </span>
    ) : null}
  </div>
);
