import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarPlus, MapPin, Video } from "lucide-react";
import { api, toQueryString } from "../lib/api";
import {
  addMinutesIso,
  combineLocalDateTime,
  dateInputValue,
  localDateTimeValue,
} from "../lib/date";
import type { Appointment, NotificationResult, PatientsResponse } from "../types";
import { useAuth } from "../context/AuthContext";
import { useToast } from "./Toast";
import {
  Button,
  Checkbox,
  FormError,
  FormField,
  Input,
  Modal,
  Select,
  Textarea,
} from "./ui";

interface AppointmentDialogProps {
  open: boolean;
  onClose: () => void;
  appointment?: Appointment | null;
  initialDate?: Date;
}

interface AppointmentForm {
  patientId: string;
  date: string;
  time: string;
  type: string;
  modality: "presencial" | "video";
  location: string;
  privateNotes: string;
  sendConfirmation: boolean;
}

const defaultStart = (initialDate?: Date): Date => {
  const value = initialDate ? new Date(initialDate) : new Date();
  if (!initialDate) {
    value.setSeconds(0, 0);
    const minutes = value.getMinutes();
    value.setMinutes(Math.ceil((minutes + 1) / 30) * 30, 0);
  } else {
    value.setHours(9, 0, 0, 0);
  }
  return value;
};

export const AppointmentDialog = ({
  open,
  onClose,
  appointment,
  initialDate,
}: AppointmentDialogProps) => {
  const { session } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const start = useMemo(() => defaultStart(initialDate), [initialDate]);
  const [form, setForm] = useState<AppointmentForm>({
    patientId: "",
    date: dateInputValue(start),
    time: localDateTimeValue(start).slice(11, 16),
    type: "Sessão individual",
    modality: "presencial",
    location: "",
    privateNotes: "",
    sendConfirmation: true,
  });
  const [duration, setDuration] = useState(session?.user?.defaultDurationMinutes ?? 50);
  const [error, setError] = useState("");

  const patientsQuery = useQuery({
    queryKey: ["patients", "appointment-form"],
    queryFn: () => api<PatientsResponse>(`/api/patients${toQueryString({ status: "active", limit: 100 })}`),
    enabled: open,
  });

  const key = appointment
    ? `${appointment.id}-${appointment.updatedAt}`
    : `new-${initialDate?.toISOString() ?? "now"}`;
  const [formKey, setFormKey] = useState(key);
  if (open && formKey !== key) {
    setFormKey(key);
    setError("");
    setDuration(session?.user?.defaultDurationMinutes ?? 50);
    setForm({
      patientId: appointment?.patientId ?? "",
      date: appointment ? dateInputValue(new Date(appointment.startsAt)) : dateInputValue(start),
      time: appointment
        ? localDateTimeValue(new Date(appointment.startsAt)).slice(11, 16)
        : localDateTimeValue(start).slice(11, 16),
      type: appointment?.type ?? "Sessão individual",
      modality: appointment?.modality ?? "presencial",
      location: appointment?.location ?? "",
      privateNotes: appointment?.privateNotes ?? "",
      sendConfirmation: !appointment,
    });
  }

  const selectedPatient = patientsQuery.data?.items.find((patient) => patient.id === form.patientId);
  const canEmail = Boolean(selectedPatient?.email && selectedPatient.notificationConsent);

  const mutation = useMutation({
    mutationFn: async () => {
      const startsAt = combineLocalDateTime(form.date, form.time);
      const body = {
        patientId: form.patientId,
        startsAt,
        endsAt: addMinutesIso(startsAt, duration),
        type: form.type,
        modality: form.modality,
        location: form.location.trim() || null,
        privateNotes: form.privateNotes.trim() || null,
        sendConfirmation: form.sendConfirmation && canEmail,
      };
      return api<{ appointment: Appointment; notification: NotificationResult }>(
        appointment ? `/api/appointments/${appointment.id}` : "/api/appointments",
        {
          method: appointment ? "PUT" : "POST",
          body: JSON.stringify(body),
        },
      );
    },
    onSuccess: async ({ notification }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["appointments"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["patients"] }),
      ]);
      toast({
        type: notification.status === "sent" || appointment ? "success" : "info",
        message: appointment ? "Consulta atualizada com sucesso." : notification.message,
      });
      onClose();
    },
    onError: (caughtError: Error) => setError(caughtError.message),
  });

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (!form.patientId || !form.date || !form.time || !form.type.trim()) {
      setError("Preencha os campos obrigatórios.");
      return;
    }
    mutation.mutate();
  };

  const update = <Key extends keyof AppointmentForm>(key: Key, value: AppointmentForm[Key]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={appointment ? "Editar consulta" : "Nova consulta"}
      description={appointment ? "Atualize os detalhes do atendimento." : "Reserve um horário para seu paciente."}
      size="large"
    >
      <form className="form-stack" onSubmit={handleSubmit}>
        <FormError>{error}</FormError>
        <FormField label="Paciente" htmlFor="appointment-patient" required>
          <Select
            id="appointment-patient"
            value={form.patientId}
            onChange={(event) => update("patientId", event.target.value)}
            required
          >
            <option value="">
              {patientsQuery.data?.items.length ? "Selecione um paciente" : "Cadastre um paciente primeiro"}
            </option>
            {patientsQuery.data?.items.map((patient) => (
              <option value={patient.id} key={patient.id}>{patient.name}</option>
            ))}
          </Select>
        </FormField>

        <div className="form-grid form-grid--three">
          <FormField label="Data" htmlFor="appointment-date" required>
            <Input
              id="appointment-date"
              type="date"
              value={form.date}
              onChange={(event) => update("date", event.target.value)}
              required
            />
          </FormField>
          <FormField label="Horário" htmlFor="appointment-time" required>
            <Input
              id="appointment-time"
              type="time"
              value={form.time}
              onChange={(event) => update("time", event.target.value)}
              required
            />
          </FormField>
          <FormField label="Duração" htmlFor="appointment-duration">
            <Select
              id="appointment-duration"
              value={duration}
              onChange={(event) => setDuration(Number(event.target.value))}
            >
              {[30, 45, 50, 60, 75, 90, 120].map((minutes) => (
                <option value={minutes} key={minutes}>{minutes} min</option>
              ))}
            </Select>
          </FormField>
        </div>

        <div className="form-grid form-grid--two">
          <FormField label="Tipo de atendimento" htmlFor="appointment-type" required>
            <Input
              id="appointment-type"
              value={form.type}
              onChange={(event) => update("type", event.target.value)}
              maxLength={100}
              required
            />
          </FormField>
          <FormField label="Modalidade" htmlFor="appointment-modality">
            <div className="segmented-control">
              <label className={form.modality === "presencial" ? "is-active" : ""}>
                <input
                  type="radio"
                  name="modality"
                  value="presencial"
                  checked={form.modality === "presencial"}
                  onChange={() => update("modality", "presencial")}
                />
                <MapPin size={16} /> Presencial
              </label>
              <label className={form.modality === "video" ? "is-active" : ""}>
                <input
                  type="radio"
                  name="modality"
                  value="video"
                  checked={form.modality === "video"}
                  onChange={() => update("modality", "video")}
                />
                <Video size={16} /> Vídeo
              </label>
            </div>
          </FormField>
        </div>

        <FormField
          label={form.modality === "video" ? "Link da videochamada" : "Sala ou endereço"}
          htmlFor="appointment-location"
          hint={form.modality === "video" ? "Opcional. Pode ser adicionado depois." : "Opcional. Informe apenas a sala ou o endereço."}
        >
          <Input
            id="appointment-location"
            value={form.location}
            onChange={(event) => update("location", event.target.value)}
            maxLength={300}
            placeholder={form.modality === "video" ? "https://meet.google.com/..." : "Sala 2"}
          />
        </FormField>

        <FormField
          label="Anotação privada"
          htmlFor="appointment-notes"
          hint="Fica visível apenas no sistema. Evite registrar detalhes clínicos desnecessários."
        >
          <Textarea
            id="appointment-notes"
            value={form.privateNotes}
            onChange={(event) => update("privateNotes", event.target.value)}
            rows={3}
            maxLength={2000}
          />
        </FormField>

        {!appointment ? (
          <Checkbox
            label="Solicitar confirmação por e-mail"
            description={canEmail
              ? "Um lembrete será enviado para o paciente informado."
              : "O paciente precisa ter e-mail e autorização para receber mensagens."}
            checked={form.sendConfirmation && canEmail}
            disabled={!canEmail}
            onChange={(event) => update("sendConfirmation", event.target.checked)}
          />
        ) : null}

        <div className="form-actions">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={mutation.isPending} icon={<CalendarPlus size={18} />}>
            {appointment ? "Salvar alterações" : "Agendar consulta"}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
