import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { CheckCircle2, CircleAlert, Info, X } from "lucide-react";
import clsx from "clsx";

interface ToastItem {
  id: number;
  type: "success" | "error" | "info";
  message: string;
}

type ToastInput = Omit<ToastItem, "id"> | string;

interface ToastContextValue {
  toast: (input: ToastInput) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);
let nextId = 1;

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback(
    (input: ToastInput) => {
      const item: ToastItem = typeof input === "string"
        ? { id: nextId++, type: "info", message: input }
        : { ...input, id: nextId++ };
      setItems((current) => [...current, item]);
      window.setTimeout(() => dismiss(item.id), 5000);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="toast-region" aria-live="polite" aria-atomic="true">
        {items.map((item) => {
          const Icon = item.type === "success"
            ? CheckCircle2
            : item.type === "error"
              ? CircleAlert
              : Info;
          return (
            <div className={clsx("toast", `toast--${item.type}`)} key={item.id} role="status">
              <Icon size={20} aria-hidden="true" />
              <span>{item.message}</span>
              <button
                className="icon-button icon-button--small"
                type="button"
                aria-label="Fechar aviso"
                onClick={() => dismiss(item.id)}
              >
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextValue => {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast deve ser usado dentro de ToastProvider.");
  return context;
};
