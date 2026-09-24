import { randomUUID } from "node:crypto";
import { Router } from "express";
import type { AppDatabase } from "./../database.js";
import { nowIso } from "./../database.js";
import type { MailService } from "./../email.js";
import { getAppointment, getUser, hasAppointmentConflict, listAppointments } from "./../appointments.js";
import { ApiError, asyncRoute } from "./../errors.js";
import {
  appointmentStatusSchema,
  createAppointmentSchema,
  listAppointmentsSchema,
  updateAppointmentSchema,
} from "./../validation.js";
import { toIso } from "./../time.js";

interface NotificationResult {
  status: "sent" | "not-configured" | "not-requested" | "not-available" | "failed";
  message: string;
}

export const createAppointmentsRouter = (
  database: AppDatabase,
  mailer: MailService,
): Router => {
  const router = Router();

  router.get("/", (request, response) => {
    const input = listAppointmentsSchema.parse(request.query);
    const items = listAppointments(database, {
      ...input,
      from: input.from ? toIso(input.from) : undefined,
      to: input.to ? toIso(input.to) : undefined,
    });
    response.json({ data: { items } });
  });

  router.get("/:id", (request, response) => {
    const appointment = getAppointment(database, requiredId(request.params.id));
    if (!appointment) throw new ApiError(404, "APPOINTMENT_NOT_FOUND", "Consulta não encontrada.");
    response.json({ data: { appointment } });
  });

  router.post(
    "/",
    asyncRoute(async (request, response) => {
      const input = createAppointmentSchema.parse(request.body);
      const startsAt = toIso(input.startsAt);
      const endsAt = toIso(input.endsAt);
      assertPatient(database, input.patientId);

      if (hasAppointmentConflict(database, startsAt, endsAt)) {
        throw new ApiError(
          409,
          "APPOINTMENT_CONFLICT",
          "Este horário conflita com outra consulta na agenda.",
        );
      }

      const id = randomUUID();
      const timestamp = nowIso();
      database
        .prepare(
          `INSERT INTO appointments (
            id, patient_id, starts_at, ends_at, type, modality, status, location,
            private_notes, confirmation_sent_at, reminder_sent_at, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?)`,
        )
        .run(
          id,
          input.patientId,
          startsAt,
          endsAt,
          input.type,
          input.modality,
          input.status,
          input.location ?? null,
          input.privateNotes ?? null,
          timestamp,
          timestamp,
        );

      const appointment = getAppointment(database, id);
      if (!appointment) throw new Error("Appointment not found after insert");
      const notification = input.sendConfirmation
        ? await sendNotification(database, mailer, id, "confirmation")
        : { status: "not-requested", message: "Confirmação não solicitada." } satisfies NotificationResult;

      response.status(201).json({ data: { appointment: getAppointment(database, id), notification } });
    }),
  );

  router.put(
    "/:id",
    asyncRoute(async (request, response) => {
      const id = requiredId(request.params.id);
      const input = updateAppointmentSchema.parse(request.body);
      const current = getAppointment(database, id);
      if (!current) throw new ApiError(404, "APPOINTMENT_NOT_FOUND", "Consulta não encontrada.");
      if (input.patientId) assertPatient(database, input.patientId, current.patientId);

      const patientId = input.patientId ?? current.patientId;
      const startsAt = input.startsAt ? toIso(input.startsAt) : current.startsAt;
      const endsAt = input.endsAt ? toIso(input.endsAt) : current.endsAt;
      if (new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
        throw new ApiError(422, "INVALID_INTERVAL", "O término deve ser depois do início.");
      }
      if (hasAppointmentConflict(database, startsAt, endsAt, id)) {
        throw new ApiError(409, "APPOINTMENT_CONFLICT", "Este horário conflita com outra consulta.");
      }

      const scheduleChanged =
        patientId !== current.patientId || startsAt !== current.startsAt || endsAt !== current.endsAt;
      const timestamp = nowIso();
      database
        .prepare(
          `UPDATE appointments SET
            patient_id = ?, starts_at = ?, ends_at = ?, type = ?, modality = ?,
            status = ?, location = ?, private_notes = ?,
            confirmation_sent_at = CASE WHEN ? THEN NULL ELSE confirmation_sent_at END,
            reminder_sent_at = CASE WHEN ? THEN NULL ELSE reminder_sent_at END,
            updated_at = ?
           WHERE id = ?`,
        )
        .run(
          patientId,
          startsAt,
          endsAt,
          input.type ?? current.type,
          input.modality ?? current.modality,
          input.status ?? current.status,
          input.location === undefined ? current.location : input.location,
          input.privateNotes === undefined ? current.privateNotes : input.privateNotes,
          scheduleChanged ? 1 : 0,
          scheduleChanged ? 1 : 0,
          timestamp,
          id,
        );

      const notification = input.sendConfirmation
        ? await sendNotification(database, mailer, id, "confirmation")
        : { status: "not-requested", message: "Confirmação não solicitada." } satisfies NotificationResult;

      response.json({ data: { appointment: getAppointment(database, id), notification } });
    }),
  );

  router.patch(
    "/:id/status",
    asyncRoute(async (request, response) => {
      const id = requiredId(request.params.id);
      const input = appointmentStatusSchema.parse(request.body);
      const current = getAppointment(database, id);
      if (!current) throw new ApiError(404, "APPOINTMENT_NOT_FOUND", "Consulta não encontrada.");

      database
        .prepare("UPDATE appointments SET status = ?, updated_at = ? WHERE id = ?")
        .run(input.status, nowIso(), id);

      let notification: NotificationResult = { status: "not-requested", message: "Notificação não solicitada." };
      if (input.notifyPatient) {
        notification = await sendNotification(
          database,
          mailer,
          id,
          input.status === "cancelled" ? "cancellation" : "confirmation",
        );
      }

      response.json({ data: { appointment: getAppointment(database, id), notification } });
    }),
  );

  router.post(
    "/:id/confirmation",
    asyncRoute(async (request, response) => {
      const id = requiredId(request.params.id);
      if (!getAppointment(database, id)) {
        throw new ApiError(404, "APPOINTMENT_NOT_FOUND", "Consulta não encontrada.");
      }
      const notification = await sendNotification(
        database,
        mailer,
        id,
        "confirmation",
      );
      response.json({
        data: { appointment: getAppointment(database, id), notification },
      });
    }),
  );

  router.delete("/:id", (request, response) => {
    const id = requiredId(request.params.id);
    const result = database.prepare("DELETE FROM appointments WHERE id = ?").run(id);
    if (result.changes === 0) {
      throw new ApiError(404, "APPOINTMENT_NOT_FOUND", "Consulta não encontrada.");
    }
    response.status(204).send();
  });

  return router;
};

const requiredId = (value: string | string[] | undefined): string => {
  if (typeof value !== "string" || !value) {
    throw new ApiError(400, "INVALID_ID", "Identificador inválido.");
  }
  return value;
};

const assertPatient = (
  database: AppDatabase,
  patientId: string,
  allowedArchivedPatientId?: string,
): void => {
  const patient = database
    .prepare("SELECT id, active FROM patients WHERE id = ?")
    .get(patientId) as { id: string; active: number } | undefined;
  if (!patient) throw new ApiError(422, "PATIENT_NOT_FOUND", "Paciente não encontrado.");
  if (patient.active !== 1 && patient.id !== allowedArchivedPatientId) {
    throw new ApiError(422, "PATIENT_INACTIVE", "Reative o paciente antes de agendar.");
  }
};

const sendNotification = async (
  database: AppDatabase,
  mailer: MailService,
  appointmentId: string | undefined,
  kind: "confirmation" | "cancellation",
): Promise<NotificationResult> => {
  const appointment = appointmentId ? getAppointment(database, appointmentId) : null;
  if (!appointment) throw new Error("Appointment not found while notifying");

  const userId = (
    database.prepare("SELECT id FROM users ORDER BY created_at LIMIT 1").get() as
      | { id: string }
      | undefined
  )?.id;
  const user = userId ? getUser(database, userId) : undefined;
  if (!user) throw new Error("User not found while notifying");

  if (!appointment.patient.email || !appointment.patient.notificationConsent) {
    return {
      status: "not-available",
      message: "O paciente precisa autorizar e ter e-mail cadastrado.",
    };
  }
  if (!mailer.isConfigured()) {
    return {
      status: "not-configured",
      message: "Consulta salva. Configure o SMTP para enviar e-mails automaticamente.",
    };
  }

  const effectiveKind = appointment.status === "cancelled" ? "cancellation" : kind;

  try {
    await mailer.sendAppointmentEmail(
      effectiveKind,
      {
        startsAt: appointment.startsAt,
        type: appointment.type,
        modality: appointment.modality,
        location: appointment.location,
        patientName: appointment.patient.name,
        patientEmail: appointment.patient.email,
      },
      {
        therapistName: user.name,
        clinicName: user.clinic_name,
        timezone: user.timezone,
      },
    );

    if (effectiveKind === "confirmation") {
      const timestamp = nowIso();
      database
        .prepare("UPDATE appointments SET confirmation_sent_at = ?, updated_at = ? WHERE id = ?")
        .run(timestamp, timestamp, appointmentId);
    }
    return { status: "sent", message: "E-mail enviado ao paciente." };
  } catch {
    if (process.env.NODE_ENV !== "test") {
      console.error(`Falha ao enviar e-mail da consulta ${appointmentId}.`);
    }
    return {
      status: "failed",
      message: "Consulta salva, mas o e-mail não pôde ser enviado. Verifique o SMTP.",
    };
  }
};
