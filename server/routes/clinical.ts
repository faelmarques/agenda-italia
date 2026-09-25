import { randomUUID } from "node:crypto";
import { Router } from "express";
import type { AnamnesisContent, SessionNoteContent } from "../../shared/clinical.js";
import type { AppDatabase } from "../database.js";
import { nowIso } from "../database.js";
import {
  mapAnamnesis,
  mapClinicalTemplate,
  mapConsultation,
  mapSessionNote,
  type AnamnesisRow,
  type ClinicalTemplateRow,
  type ConsultationRow,
  type SessionNoteRow,
} from "../dto.js";
import { ApiError } from "../errors.js";
import { toIso } from "../time.js";
import {
  createSessionNoteSchema,
  listConsultationsSchema,
  listSessionNotesSchema,
  parseAnamnesisContent,
  parseSessionNoteContent,
  updateAnamnesisSchema,
  updateSessionNoteSchema,
} from "../validation.js";

const consultationFrom = `
  FROM appointments a
  JOIN patients p ON p.id = a.patient_id
  LEFT JOIN session_notes sn ON sn.appointment_id = a.id
`;

const consultationSelect = `
  SELECT
    a.*,
    p.name AS patient_name,
    p.phone AS patient_phone,
    p.email AS patient_email,
    p.notification_consent AS patient_notification_consent,
    sn.id AS note_id,
    sn.session_date AS note_session_date
  ${consultationFrom}
`;

const noteFrom = `
  FROM session_notes sn
  JOIN patients p ON p.id = sn.patient_id
  LEFT JOIN appointments a ON a.id = sn.appointment_id
`;

const noteSelect = `
  SELECT sn.*, p.name AS patient_name, a.starts_at AS appointment_starts_at
  ${noteFrom}
`;

export const createClinicalRouter = (database: AppDatabase): Router => {
  const router = Router();

  router.get("/consultations", (request, response) => {
    const input = listConsultationsSchema.parse(request.query);
    const conditions: string[] = [];
    const values: Array<string | number> = [];

    if (input.patientId) {
      conditions.push("a.patient_id = ?");
      values.push(input.patientId);
    }
    if (input.status === "pending") {
      conditions.push("a.status IN ('scheduled', 'confirmed')");
    } else if (input.status !== "all") {
      conditions.push("a.status = ?");
      values.push(input.status);
    }
    if (input.from) {
      conditions.push("a.starts_at >= ?");
      values.push(toIso(input.from));
    }
    if (input.to) {
      conditions.push("a.starts_at <= ?");
      values.push(toIso(input.to));
    }
    if (input.search) {
      conditions.push("(p.name LIKE ? COLLATE NOCASE OR p.phone LIKE ?)");
      const search = `%${input.search}%`;
      values.push(search, search);
    }
    if (input.hasNote === "yes") conditions.push("sn.id IS NOT NULL");
    if (input.hasNote === "no") conditions.push("sn.id IS NULL");

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const countRow = database
      .prepare(`SELECT COUNT(*) AS count ${consultationFrom} ${where}`)
      .get(...values) as { count: number };

    const rows = database
      .prepare(
        `${consultationSelect} ${where}
         ORDER BY a.starts_at DESC, a.created_at DESC
         LIMIT ? OFFSET ?`,
      )
      .all(...values, input.limit, (input.page - 1) * input.limit) as ConsultationRow[];

    response.json({
      data: {
        items: rows.map(mapConsultation),
        pagination: {
          page: input.page,
          limit: input.limit,
          total: countRow.count,
          pages: Math.max(1, Math.ceil(countRow.count / input.limit)),
        },
      },
    });
  });

  router.get("/anamnesis/:patientId", (request, response) => {
    const patientId = requiredId(request.params.patientId);
    assertPatient(database, patientId);
    const row = database
      .prepare("SELECT * FROM anamnesis WHERE patient_id = ?")
      .get(patientId) as AnamnesisRow | undefined;

    response.json({ data: { anamnesis: row ? mapAnamnesis(row) : null } });
  });

  router.put("/anamnesis/:patientId", (request, response) => {
    const patientId = requiredId(request.params.patientId);
    assertPatient(database, patientId);
    const input = updateAnamnesisSchema.parse(request.body);
    const content: AnamnesisContent = parseAnamnesisContent(input.content);
    const timestamp = nowIso();
    const existing = database
      .prepare("SELECT id FROM anamnesis WHERE patient_id = ?")
      .get(patientId) as { id: string } | undefined;

    if (existing) {
      database
        .prepare("UPDATE anamnesis SET status = ?, content = ?, updated_at = ? WHERE patient_id = ?")
        .run(input.status, JSON.stringify(content), timestamp, patientId);
    } else {
      database
        .prepare(
          `INSERT INTO anamnesis (id, patient_id, status, content, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(randomUUID(), patientId, input.status, JSON.stringify(content), timestamp, timestamp);
    }

    const row = database
      .prepare("SELECT * FROM anamnesis WHERE patient_id = ?")
      .get(patientId) as AnamnesisRow;
    response.json({ data: { anamnesis: mapAnamnesis(row) } });
  });

  router.get("/session-notes", (request, response) => {
    const input = listSessionNotesSchema.parse(request.query);
    assertPatient(database, input.patientId);

    const conditions = ["sn.patient_id = ?"];
    const values: Array<string | number> = [input.patientId];
    if (input.appointmentId) {
      conditions.push("sn.appointment_id = ?");
      values.push(input.appointmentId);
    }
    const where = `WHERE ${conditions.join(" AND ")}`;

    const countRow = database
      .prepare(`SELECT COUNT(*) AS count ${noteFrom} ${where}`)
      .get(...values) as { count: number };

    const rows = database
      .prepare(
        `${noteSelect}
         ${where}
         ORDER BY sn.session_date DESC, sn.created_at DESC
         LIMIT ? OFFSET ?`,
      )
      .all(...values, input.limit, (input.page - 1) * input.limit) as SessionNoteRow[];

    response.json({
      data: {
        items: rows.map(mapSessionNote),
        pagination: {
          page: input.page,
          limit: input.limit,
          total: countRow.count,
          pages: Math.max(1, Math.ceil(countRow.count / input.limit)),
        },
      },
    });
  });

  router.post("/session-notes", (request, response) => {
    const input = createSessionNoteSchema.parse(request.body);
    assertPatient(database, input.patientId);
    assertAppointment(database, input.patientId, input.appointmentId ?? null);
    assertAppointmentNoteFree(database, input.appointmentId ?? null);

    const id = randomUUID();
    const timestamp = nowIso();
    const content = parseSessionNoteContent(input.content);

    database
      .prepare(
        `INSERT INTO session_notes (
          id, patient_id, appointment_id, session_date, template_id,
          objective, interventions, response, homework, planning,
          risk_alert, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        input.patientId,
        input.appointmentId ?? null,
        input.sessionDate,
        input.templateId ?? null,
        content.objective,
        content.interventions,
        content.response,
        content.homework,
        content.planning,
        input.riskAlert ? 1 : 0,
        timestamp,
        timestamp,
      );

    const row = database.prepare(`${noteSelect} WHERE sn.id = ?`).get(id) as SessionNoteRow;
    response.status(201).json({ data: { note: mapSessionNote(row) } });
  });

  router.put("/session-notes/:id", (request, response) => {
    const id = requiredId(request.params.id);
    const input = updateSessionNoteSchema.parse(request.body);
    const current = getNote(database, id);

    if (input.appointmentId !== undefined) {
      assertAppointment(database, current.patientId, input.appointmentId);
      assertAppointmentNoteFree(database, input.appointmentId, id);
    }

    const merged: SessionNoteContent = input.content
      ? parseSessionNoteContent({ ...current.content, ...input.content })
      : current.content;
    const timestamp = nowIso();

    database
      .prepare(
        `UPDATE session_notes SET
          appointment_id = ?,
          session_date = ?,
          template_id = ?,
          objective = ?,
          interventions = ?,
          response = ?,
          homework = ?,
          planning = ?,
          risk_alert = ?,
          updated_at = ?
         WHERE id = ?`,
      )
      .run(
        input.appointmentId === undefined ? current.appointmentId : input.appointmentId,
        input.sessionDate ?? current.sessionDate,
        input.templateId === undefined ? current.templateId : input.templateId,
        merged.objective,
        merged.interventions,
        merged.response,
        merged.homework,
        merged.planning,
        (input.riskAlert ?? current.riskAlert) ? 1 : 0,
        timestamp,
        id,
      );

    const row = database.prepare(`${noteSelect} WHERE sn.id = ?`).get(id) as SessionNoteRow;
    response.json({ data: { note: mapSessionNote(row) } });
  });

  router.delete("/session-notes/:id", (request, response) => {
    const id = requiredId(request.params.id);
    getNote(database, id);
    database.prepare("DELETE FROM session_notes WHERE id = ?").run(id);
    response.status(204).send();
  });

  router.get("/clinical-templates", (_request, response) => {
    const rows = database
      .prepare("SELECT * FROM clinical_templates ORDER BY category COLLATE NOCASE ASC, name ASC")
      .all() as ClinicalTemplateRow[];
    response.json({ data: { items: rows.map(mapClinicalTemplate) } });
  });

  return router;
};

const requiredId = (value: string | string[] | undefined): string => {
  if (typeof value !== "string" || !value) {
    throw new ApiError(400, "INVALID_ID", "Identificador inválido.");
  }
  return value;
};

const assertPatient = (database: AppDatabase, patientId: string): void => {
  const patient = database
    .prepare("SELECT id FROM patients WHERE id = ?")
    .get(patientId) as { id: string } | undefined;
  if (!patient) throw new ApiError(404, "PATIENT_NOT_FOUND", "Paciente não encontrado.");
};

const assertAppointment = (
  database: AppDatabase,
  patientId: string,
  appointmentId: string | null,
): void => {
  if (!appointmentId) return;
  const appointment = database
    .prepare("SELECT patient_id FROM appointments WHERE id = ?")
    .get(appointmentId) as { patient_id: string } | undefined;
  if (!appointment) throw new ApiError(422, "APPOINTMENT_NOT_FOUND", "Consulta não encontrada.");
  if (appointment.patient_id !== patientId) {
    throw new ApiError(422, "APPOINTMENT_MISMATCH", "Esta consulta pertence a outro paciente.");
  }
};

const assertAppointmentNoteFree = (
  database: AppDatabase,
  appointmentId: string | null,
  excludeNoteId = "",
): void => {
  if (!appointmentId) return;
  const existing = database
    .prepare("SELECT id FROM session_notes WHERE appointment_id = ? AND id != ?")
    .get(appointmentId, excludeNoteId) as { id: string } | undefined;
  if (existing) {
    throw new ApiError(
      409,
      "APPOINTMENT_NOTE_EXISTS",
      "Esta consulta já tem uma evolução registrada.",
    );
  }
};

const getNote = (database: AppDatabase, id: string): ReturnType<typeof mapSessionNote> => {
  const row = database.prepare(`${noteSelect} WHERE sn.id = ?`).get(id) as SessionNoteRow | undefined;
  if (!row) throw new ApiError(404, "SESSION_NOTE_NOT_FOUND", "Evolução não encontrada.");
  return mapSessionNote(row);
};
