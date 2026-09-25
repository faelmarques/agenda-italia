import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Save, TriangleAlert } from "lucide-react";
import {
  emptySessionNoteContent,
  sessionNoteFields,
  type SessionNoteContent,
} from "../../shared/clinical";
import { api, toQueryString } from "../lib/api";
import { dateInputValue, formatDateTime } from "../lib/date";
import type { Appointment, SessionNote, SessionNotesResponse } from "../types";
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

interface SessionNoteDialogProps {
  open: boolean;
  onClose: () => void;
  patientId: string;
  note?: SessionNote | null;
  appointmentId?: string | null;
  appointmentStartsAt?: string | null;
  presetContent?: SessionNoteContent | null;
  templateId?: string | null;
}

interface NoteForm {
  sessionDate: string;
  appointmentId: string;
  templateId: string | null;
  riskAlert: boolean;
  content: SessionNoteContent;
}

const createInitialForm = (
  props: Pick<
    SessionNoteDialogProps,
    "note" | "appointmentId" | "appointmentStartsAt" | "presetContent" | "templateId"
  >,
): NoteForm => {
  const { note, appointmentId, appointmentStartsAt, presetContent, templateId } = props;
  const reference = note?.appointmentStartsAt ?? appointmentStartsAt;
  return {
    sessionDate: note?.sessionDate ?? dateInputValue(new Date(reference ?? Date.now())),
    appointmentId: note?.appointmentId ?? appointmentId ?? "",
    templateId: note?.templateId ?? templateId ?? null,
    riskAlert: note?.riskAlert ?? false,
    content: note?.content ?? presetContent ?? emptySessionNoteContent(),
  };
};

const hasContent = (content: SessionNoteContent): boolean =>
  Object.values(content).some((value) => value.trim().length > 0);

export const SessionNoteDialog = ({
  open,
  onClose,
  patientId,
  note,
  appointmentId,
  appointmentStartsAt,
  presetContent,
  templateId,
}: SessionNoteDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [error, setError] = useState("");

  const linkedQuery = useQuery({
    queryKey: ["session-notes", "by-appointment", patientId, appointmentId],
    queryFn: () =>
      api<SessionNotesResponse>(
        `/api/session-notes${toQueryString({
          patientId,
          appointmentId: appointmentId ?? undefined,
          limit: 10,
        })}`,
      ),
    enabled: open && Boolean(appointmentId) && !note,
  });

  const activeNote =
    note ?? (appointmentId ? linkedQuery.data?.items[0] ?? null : null);

  const appointmentsQuery = useQuery({
    queryKey: ["appointments", "note-picker", patientId],
    queryFn: () =>
      api<{ items: Appointment[] }>(
        `/api/appointments${toQueryString({ patientId, limit: 200 })}`,
      ),
    enabled: open,
  });
  const appointments = appointmentsQuery.data?.items ?? [];

  const [form, setForm] = useState<NoteForm>(
    createInitialForm({ note, appointmentId, appointmentStartsAt, presetContent, templateId }),
  );
  const [formKey, setFormKey] = useState(activeNote?.id ?? "initial");

  const key = activeNote?.id ?? `initial:${appointmentId ?? ""}`;
  if (open && formKey !== key) {
    setFormKey(key);
    setForm(
      createInitialForm({ note: activeNote, appointmentId, appointmentStartsAt, presetContent, templateId }),
    );
    setError("");
  }

  const mutation = useMutation({
    mutationFn: () => {
      const body = {
        appointmentId: form.appointmentId || null,
        sessionDate: form.sessionDate,
        templateId: form.templateId,
        content: form.content,
        riskAlert: form.riskAlert,
      };
      return activeNote
        ? api<{ note: SessionNote }>(`/api/session-notes/${activeNote.id}`, {
            method: "PUT",
            body: JSON.stringify(body),
          })
        : api<{ note: SessionNote }>("/api/session-notes", {
            method: "POST",
            body: JSON.stringify({ ...body, patientId }),
          });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["session-notes"] }),
        queryClient.invalidateQueries({ queryKey: ["consultations"] }),
        queryClient.invalidateQueries({ queryKey: ["appointments"] }),
      ]);
      toast({
        type: "success",
        message: activeNote ? "Evolução atualizada." : "Evolução registrada.",
      });
      onClose();
    },
    onError: (caughtError: Error) => setError(caughtError.message),
  });

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (!form.sessionDate) {
      setError("Informe a data da sessão.");
      return;
    }
    if (!hasContent(form.content)) {
      setError("Escreva ao menos um campo da evolução.");
      return;
    }
    mutation.mutate();
  };

  const setContent = (field: keyof SessionNoteContent, value: string) => {
    setForm((current) => ({ ...current, content: { ...current.content, [field]: value } }));
  };

  const handleAppointmentChange = (value: string) => {
    const appointment = appointments.find((item) => item.id === value);
    setForm((current) => ({
      ...current,
      appointmentId: value,
      sessionDate: appointment ? dateInputValue(new Date(appointment.startsAt)) : current.sessionDate,
    }));
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={activeNote ? "Editar evolução" : "Registrar evolução"}
      description="Anotação clínica da sessão, visível apenas para você."
      size="large"
    >
      <form className="form-stack" onSubmit={handleSubmit}>
        <FormError>{error}</FormError>

        <div className="form-grid form-grid--two">
          <FormField label="Data da sessão" htmlFor="note-session-date" required>
            <Input
              id="note-session-date"
              type="date"
              value={form.sessionDate}
              onChange={(event) =>
                setForm((current) => ({ ...current, sessionDate: event.target.value }))
              }
              required
            />
          </FormField>
          <FormField
            label="Consulta vinculada"
            htmlFor="note-appointment"
            hint="Opcional. Vincula a evolução a um horário da agenda."
          >
            <Select
              id="note-appointment"
              value={form.appointmentId}
              onChange={(event) => handleAppointmentChange(event.target.value)}
            >
              <option value="">Sem vínculo</option>
              {appointments.map((appointment) => (
                <option key={appointment.id} value={appointment.id}>
                  {formatDateTime(appointment.startsAt)} — {appointment.type}
                </option>
              ))}
            </Select>
          </FormField>
        </div>

        {sessionNoteFields.map((field) => (
          <FormField
            key={field.key}
            label={field.label}
            htmlFor={`note-${field.key}`}
            hint={field.hint}
          >
            <Textarea
              id={`note-${field.key}`}
              value={form.content[field.key]}
              onChange={(event) => setContent(field.key, event.target.value)}
              rows={field.rows}
              maxLength={4000}
            />
          </FormField>
        ))}

        <Checkbox
          label="Marcar alerta de risco nesta sessão"
          description="Sinaliza ideação suicida, autolesão ou situação de risco para revisão posterior."
          checked={form.riskAlert}
          onChange={(event) =>
            setForm((current) => ({ ...current, riskAlert: event.target.checked }))
          }
        />

        <div className="privacy-note">
          <strong>
            <TriangleAlert size={15} aria-hidden="true" /> Sigilo profissional
          </strong>
          <p>Registre apenas o necessário para a continuidade do cuidado. Evite dados de terceiros.</p>
        </div>

        <div className="form-actions">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={mutation.isPending} icon={<Save size={18} />}>
            {activeNote ? "Salvar evolução" : "Registrar evolução"}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
