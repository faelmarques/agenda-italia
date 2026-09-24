import { z } from "zod";
import { appointmentModalities, appointmentStatuses } from "./types.js";

const optionalText = (maximum: number) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? null : value),
    z.string().trim().max(maximum).nullable().optional(),
  );

export const setupSchema = z.object({
  name: z.string().trim().min(2, "Informe seu nome.").max(100),
  email: z.email("Informe um e-mail válido.").trim().toLowerCase().max(200),
  password: z
    .string()
    .min(10, "Use pelo menos 10 caracteres.")
    .max(128)
    .regex(/[A-Za-z]/, "Inclua ao menos uma letra.")
    .regex(/[0-9]/, "Inclua ao menos um número."),
  professionalTitle: z.string().trim().max(100).optional(),
  registration: z.string().trim().max(50).optional(),
  clinicName: z.string().trim().min(2).max(100).default("Agenda Italia"),
  timezone: z.string().trim().min(1).max(100).default("America/Sao_Paulo"),
});

export const loginSchema = z.object({
  email: z.email("Informe um e-mail válido.").trim().toLowerCase().max(200),
  password: z.string().min(1, "Informe sua senha.").max(128),
});

const appointmentFields = {
  patientId: z.uuid("Paciente inválido."),
  startsAt: z.iso.datetime({ offset: true }),
  endsAt: z.iso.datetime({ offset: true }),
  type: z.string().trim().min(1, "Informe o tipo de atendimento.").max(100),
  modality: z.enum(appointmentModalities),
  status: z.enum(appointmentStatuses).default("scheduled"),
  location: optionalText(300),
  privateNotes: optionalText(2000),
  sendConfirmation: z.boolean().default(false),
};

const validInterval = (
  value: { startsAt?: string; endsAt?: string },
  context: z.RefinementCtx,
): void => {
  if (!value.startsAt || !value.endsAt) return;
  if (new Date(value.endsAt).getTime() <= new Date(value.startsAt).getTime()) {
    context.addIssue({
      code: "custom",
      path: ["endsAt"],
      message: "O término deve ser depois do início.",
    });
  }
};

export const createAppointmentSchema = z.object(appointmentFields).superRefine(validInterval);
export const updateAppointmentSchema = z
  .object(appointmentFields)
  .partial()
  .refine((value) => Object.keys(value).length > 0, "Informe ao menos um campo.")
  .superRefine(validInterval);

export const appointmentStatusSchema = z.object({
  status: z.enum(appointmentStatuses),
  notifyPatient: z.boolean().default(false),
});

export const patientFields = {
  name: z.string().trim().min(2, "Informe o nome do paciente.").max(150),
  birthDate: z.iso.date().nullable().optional(),
  phone: optionalText(30),
  email: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? null : value),
    z.email("Informe um e-mail válido.").nullable().optional(),
  ),
  notes: optionalText(2000),
  active: z.boolean().optional(),
  notificationConsent: z.boolean().optional(),
};

export const createPatientSchema = z.object(patientFields);
export const updatePatientSchema = z
  .object(patientFields)
  .partial()
  .refine((value) => Object.keys(value).length > 0, "Informe ao menos um campo.");

export const listPatientsSchema = z.object({
  search: z.string().trim().max(100).default(""),
  status: z.enum(["active", "inactive", "all"]).default("active"),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const listAppointmentsSchema = z.object({
  from: z.iso.datetime({ offset: true }).optional(),
  to: z.iso.datetime({ offset: true }).optional(),
  patientId: z.uuid().optional(),
  status: z.enum([...appointmentStatuses, "all"]).default("all"),
  limit: z.coerce.number().int().min(1).max(1000).default(500),
});

export const profileSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.email().trim().toLowerCase().max(200),
  professionalTitle: optionalText(100),
  registration: optionalText(50),
  clinicName: z.string().trim().min(2).max(100),
  defaultDurationMinutes: z.coerce.number().int().min(15).max(240).default(50),
  reminderHours: z.coerce.number().int().min(1).max(168).default(24),
  timezone: z.string().trim().min(1).max(100).default("America/Sao_Paulo"),
});

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z
    .string()
    .min(10, "Use pelo menos 10 caracteres.")
    .max(128)
    .regex(/[A-Za-z]/, "Inclua ao menos uma letra.")
    .regex(/[0-9]/, "Inclua ao menos um número."),
});

export const dateRangeSchema = z.object({
  from: z.iso.datetime({ offset: true }),
  to: z.iso.datetime({ offset: true }),
});
