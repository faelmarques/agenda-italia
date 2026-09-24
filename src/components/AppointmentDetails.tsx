import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CalendarClock,
  Check,
  Clock3,
  Copy,
  Mail,
  MapPin,
  MessageCircle,
  Pencil,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { api } from "../lib/api";
import { formatDateTime, formatTime } from "../lib/date";
import { appointmentMessage, whatsappUrl } from "../lib/whatsapp";
import type { Appointment, AppointmentStatus, NotificationResult } from "../types";
import { useAuth } from "../context/AuthContext";
import { useToast } from "./Toast";
import { Button, Modal, StatusBadge } from "./ui";

interface AppointmentDetailsProps {
  appointment: Appointment | null;
  onClose: () => void;
  onEdit: (appointment: Appointment) => void;
}

const statusOptions: Array<{ value: AppointmentStatus; label: string; className: string }> = [
  { value: "confirmed", label: "Confirmar", className: "text-success" },
  { value: "completed", label: "Concluir", className: "text-primary" },
  { value: "no_show", label: "Não compareceu", className: "text-warning" },
  { value: "cancelled", label: "Cancelar", className: "text-danger" },
];

export const AppointmentDetails = ({ appointment, onClose, onEdit }: AppointmentDetailsProps) => {
  const { session } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showDelete, setShowDelete] = useState(false);

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["appointments"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
    ]);
  };

  const statusMutation = useMutation({
    mutationFn: ({ status, notifyPatient }: { status: AppointmentStatus; notifyPatient: boolean }) =>
      api<{ appointment: Appointment; notification: NotificationResult }>(
        `/api/appointments/${appointment?.id}/status`,
        { method: "PATCH", body: JSON.stringify({ status, notifyPatient }) },
      ),
    onSuccess: async ({ notification }) => {
      await refresh();
      toast({ type: "success", message: notification.status === "sent" ? notification.message : "Status atualizado." });
    },
    onError: (error: Error) => toast({ type: "error", message: error.message }),
  });

  const confirmationMutation = useMutation({
    mutationFn: () => api<{ appointment: Appointment; notification: NotificationResult }>(
      `/api/appointments/${appointment?.id}/confirmation`,
      { method: "POST" },
    ),
    onSuccess: async ({ notification }) => {
      await refresh();
      toast({ type: notification.status === "sent" ? "success" : "info", message: notification.message });
    },
    onError: (error: Error) => toast({ type: "error", message: error.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api<void>(`/api/appointments/${appointment?.id}`, { method: "DELETE" }),
    onSuccess: async () => {
      await refresh();
      toast({ type: "success", message: "Consulta removida da agenda." });
      setShowDelete(false);
      onClose();
    },
    onError: (error: Error) => toast({ type: "error", message: error.message }),
  });

  if (!appointment || !session?.user) return null;

  const message = appointmentMessage(appointment, session.user);
  const canUseWhatsApp = Boolean(appointment.patient.phone);
  const canUseEmail = Boolean(appointment.patient.email && appointment.patient.notificationConsent);

  const copyMessage = async () => {
    try {
      await navigator.clipboard.writeText(message);
      toast({ type: "success", message: "Mensagem copiada." });
    } catch {
      toast({ type: "error", message: "Não foi possível copiar a mensagem." });
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={appointment.patient.name}
      description={`${formatDateTime(appointment.startsAt)} · ${appointment.type}`}
      size="medium"
    >
      <div className="appointment-details">
        <div className="appointment-details__hero">
          <div className="detail-icon"><CalendarClock size={24} /></div>
          <div>
            <strong>{formatTime(appointment.startsAt)} — {formatTime(appointment.endsAt)}</strong>
            <span>{formatDateTime(appointment.startsAt)}</span>
          </div>
          <StatusBadge status={appointment.status} />
        </div>

        <dl className="detail-list">
          <div>
            <dt><UserRound size={17} /> Paciente</dt>
            <dd>{appointment.patient.name}</dd>
          </div>
          <div>
            <dt><MapPin size={17} /> Modalidade</dt>
            <dd>{appointment.modality === "video" ? "Videochamada" : "Presencial"}{appointment.location ? ` · ${appointment.location}` : ""}</dd>
          </div>
          {appointment.privateNotes ? (
            <div>
              <dt><Clock3 size={17} /> Anotação privada</dt>
              <dd>{appointment.privateNotes}</dd>
            </div>
          ) : null}
          <div>
            <dt><Mail size={17} /> E-mail</dt>
            <dd>{appointment.patient.email ?? "Não informado"}</dd>
          </div>
        </dl>

        <div className="communication-box">
          <div>
            <strong>Conferir com o paciente</strong>
            <p>Use um canal em que você e o paciente já se comuniquem.</p>
          </div>
          <div className="button-row">
            <Button
              type="button"
              variant="secondary"
              size="small"
              icon={<Copy size={16} />}
              onClick={() => void copyMessage()}
            >
              Copiar mensagem
            </Button>
            {canUseWhatsApp ? (
              <Button
                type="button"
                variant="secondary"
                size="small"
                icon={<MessageCircle size={16} />}
                onClick={() => window.open(whatsappUrl(appointment.patient.phone ?? "", message), "_blank", "noopener,noreferrer")}
              >
                WhatsApp
              </Button>
            ) : null}
            {canUseEmail ? (
              <Button
                type="button"
                variant="secondary"
                size="small"
                icon={<Mail size={16} />}
                loading={confirmationMutation.isPending}
                onClick={() => confirmationMutation.mutate()}
              >
                Enviar e-mail
              </Button>
            ) : null}
          </div>
        </div>

        {appointment.status !== "completed" && appointment.status !== "cancelled" ? (
          <div className="status-actions">
            <span>Alterar status</span>
            <div>
              {statusOptions.map((option) => (
                <button
                  className={option.className}
                  type="button"
                  key={option.value}
                  onClick={() => statusMutation.mutate({ status: option.value, notifyPatient: false })}
                  disabled={statusMutation.isPending || appointment.status === option.value}
                >
                  {option.value === "confirmed" ? <Check size={15} /> : option.value === "cancelled" ? <X size={15} /> : null}
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="form-actions form-actions--spread">
          <Button
            type="button"
            variant="ghost"
            className="danger-text"
            icon={<Trash2 size={17} />}
            onClick={() => setShowDelete(true)}
          >
            Excluir
          </Button>
          <div className="button-row">
            <Button type="button" variant="ghost" onClick={onClose}>Fechar</Button>
            <Button type="button" icon={<Pencil size={17} />} onClick={() => onEdit(appointment)}>
              Editar
            </Button>
          </div>
        </div>

        {showDelete ? (
          <div className="danger-confirm" role="alert">
            <div>
              <strong>Excluir esta consulta?</strong>
              <p>Essa ação não pode ser desfeita.</p>
            </div>
            <Button type="button" variant="ghost" onClick={() => setShowDelete(false)}>Voltar</Button>
            <Button type="button" variant="danger" loading={deleteMutation.isPending} onClick={() => deleteMutation.mutate()}>
              Excluir
            </Button>
          </div>
        ) : null}
      </div>
    </Modal>
  );
};
