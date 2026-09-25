import {
  emptyAnamnesisContent,
  emptySessionNoteContent,
  type AnamnesisContent,
  type AnamnesisStatus,
  type SessionNoteContent,
} from "../shared/clinical.js";
import type { AppointmentModality, AppointmentStatus } from "./types.js";


export interface UserRow {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  professional_title: string | null;
  registration: string | null;
  clinic_name: string;
  default_duration_minutes: number;
  reminder_hours: number;
  timezone: string;
  created_at: string;
  updated_at: string;
}

export interface PatientRow {
  id: string;
  name: string;
  birth_date: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  active: number;
  notification_consent: number;
  created_at: string;
  updated_at: string;
  upcoming_appointments?: number;
}

export interface AppointmentRow {
  id: string;
  patient_id: string;
  starts_at: string;
  ends_at: string;
  type: string;
  modality: AppointmentModality;
  status: AppointmentStatus;
  location: string | null;
  private_notes: string | null;
  confirmation_sent_at: string | null;
  reminder_sent_at: string | null;
  created_at: string;
  updated_at: string;
  patient_name?: string;
  patient_phone?: string | null;
  patient_email?: string | null;
  patient_notification_consent?: number;
}

export const mapUser = (row: UserRow) => ({
  id: row.id,
  name: row.name,
  email: row.email,
  professionalTitle: row.professional_title,
  registration: row.registration,
  clinicName: row.clinic_name,
  defaultDurationMinutes: row.default_duration_minutes,
  reminderHours: row.reminder_hours,
  timezone: row.timezone,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const mapPatient = (row: PatientRow) => ({
  id: row.id,
  name: row.name,
  birthDate: row.birth_date,
  phone: row.phone,
  email: row.email,
  notes: row.notes,
  active: row.active === 1,
  notificationConsent: row.notification_consent === 1,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  upcomingAppointments: row.upcoming_appointments ?? 0,
});

export const mapAppointment = (row: AppointmentRow) => ({
  id: row.id,
  patientId: row.patient_id,
  startsAt: row.starts_at,
  endsAt: row.ends_at,
  type: row.type,
  modality: row.modality,
  status: row.status,
  location: row.location,
  privateNotes: row.private_notes,
  confirmationSentAt: row.confirmation_sent_at,
  reminderSentAt: row.reminder_sent_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  patient: {
    id: row.patient_id,
    name: row.patient_name ?? "",
    phone: row.patient_phone ?? null,
    email: row.patient_email ?? null,
    notificationConsent: row.patient_notification_consent === 1,
  },
});

export interface AnamnesisRow {
  id: string;
  patient_id: string;
  status: AnamnesisStatus;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface SessionNoteRow {
  id: string;
  patient_id: string;
  appointment_id: string | null;
  session_date: string;
  template_id: string | null;
  objective: string | null;
  interventions: string | null;
  response: string | null;
  homework: string | null;
  planning: string | null;
  risk_alert: number;
  created_at: string;
  updated_at: string;
  patient_name?: string;
  appointment_starts_at?: string | null;
}

export interface ClinicalTemplateRow {
  id: string;
  name: string;
  description: string;
  category: string;
  content: string;
  created_at: string;
}

export interface ConsultationRow extends AppointmentRow {
  note_id?: string | null;
  note_session_date?: string | null;
}

const parseContent = <T extends Record<string, string>>(raw: string, empty: () => T): T => {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return { ...empty(), ...(parsed as Partial<T>) } as T;
    }
  } catch {
    // conteúdo inválido volta ao formulário em branco
  }
  return empty();
};

export const mapAnamnesis = (row: AnamnesisRow) => ({
  id: row.id,
  patientId: row.patient_id,
  status: row.status,
  content: parseContent<AnamnesisContent>(row.content, emptyAnamnesisContent),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const mapSessionNote = (row: SessionNoteRow) => ({
  id: row.id,
  patientId: row.patient_id,
  appointmentId: row.appointment_id,
  sessionDate: row.session_date,
  templateId: row.template_id,
  riskAlert: row.risk_alert === 1,
  content: {
    ...emptySessionNoteContent(),
    objective: row.objective ?? "",
    interventions: row.interventions ?? "",
    response: row.response ?? "",
    homework: row.homework ?? "",
    planning: row.planning ?? "",
  } satisfies SessionNoteContent,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  patientName: row.patient_name ?? null,
  appointmentStartsAt: row.appointment_starts_at ?? null,
});

export const mapClinicalTemplate = (row: ClinicalTemplateRow) => ({
  id: row.id,
  name: row.name,
  description: row.description,
  category: row.category,
  content: parseContent<SessionNoteContent>(row.content, emptySessionNoteContent),
  createdAt: row.created_at,
});

export const mapConsultation = (row: ConsultationRow) => ({
  ...mapAppointment(row),
  noteId: row.note_id ?? null,
  noteSessionDate: row.note_session_date ?? null,
});

