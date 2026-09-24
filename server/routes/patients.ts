import { randomUUID } from "node:crypto";
import { Router } from "express";
import type { AppDatabase } from "../database.js";
import { nowIso } from "../database.js";
import { mapPatient, type PatientRow } from "../dto.js";
import { ApiError } from "../errors.js";
import { createPatientSchema, listPatientsSchema, updatePatientSchema } from "../validation.js";

export const createPatientsRouter = (database: AppDatabase): Router => {
  const router = Router();

  router.get("/", (request, response) => {
    const input = listPatientsSchema.parse(request.query);
    const conditions: string[] = [];
    const values: Array<string | number> = [];

    if (input.status !== "all") {
      conditions.push("active = ?");
      values.push(input.status === "active" ? 1 : 0);
    }
    if (input.search) {
      conditions.push("(name LIKE ? COLLATE NOCASE OR phone LIKE ? OR email LIKE ? COLLATE NOCASE)");
      const search = `%${input.search}%`;
      values.push(search, search, search);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const countRow = database
      .prepare(`SELECT COUNT(*) AS count FROM patients ${where}`)
      .get(...values) as { count: number };

    const rows = database
      .prepare(
        `SELECT p.*,
           (SELECT COUNT(*) FROM appointments a
            WHERE a.patient_id = p.id
              AND a.starts_at >= ?
              AND a.status NOT IN ('cancelled', 'no_show')) AS upcoming_appointments
         FROM patients p
         ${where}
         ORDER BY p.active DESC, p.name COLLATE NOCASE ASC
         LIMIT ? OFFSET ?`,
      )
      .all(nowIso(), ...values, input.limit, (input.page - 1) * input.limit) as PatientRow[];

    response.json({
      data: {
        items: rows.map(mapPatient),
        pagination: {
          page: input.page,
          limit: input.limit,
          total: countRow.count,
          pages: Math.max(1, Math.ceil(countRow.count / input.limit)),
        },
      },
    });
  });

  router.post("/", (request, response) => {
    const input = createPatientSchema.parse(request.body);
    const id = randomUUID();
    const timestamp = nowIso();

    database
      .prepare(
        `INSERT INTO patients (
          id, name, birth_date, phone, email, notes, active, notification_consent, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
      )
      .run(
        id,
        input.name,
        input.birthDate ?? null,
        input.phone ?? null,
        input.email ?? null,
        input.notes ?? null,
        input.notificationConsent ? 1 : 0,
        timestamp,
        timestamp,
      );

    const row = database.prepare("SELECT * FROM patients WHERE id = ?").get(id) as PatientRow;
    response.status(201).json({ data: { patient: mapPatient(row) } });
  });

  router.get("/:id", (request, response) => {
    const row = getPatient(database, request.params.id);
    const upcoming = database
      .prepare(
        `SELECT COUNT(*) AS count FROM appointments
         WHERE patient_id = ? AND starts_at >= ? AND status NOT IN ('cancelled', 'no_show')`,
      )
      .get(request.params.id, nowIso()) as { count: number };

    response.json({ data: { patient: { ...mapPatient(row), upcomingAppointments: upcoming.count } } });
  });

  router.put("/:id", (request, response) => {
    const input = updatePatientSchema.parse(request.body);
    const current = getPatient(database, request.params.id);
    const timestamp = nowIso();

    database
      .prepare(
        `UPDATE patients SET
          name = ?, birth_date = ?, phone = ?, email = ?, notes = ?, active = ?,
          notification_consent = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(
        input.name ?? current.name,
        input.birthDate === undefined ? current.birth_date : input.birthDate,
        input.phone === undefined ? current.phone : input.phone,
        input.email === undefined ? current.email : input.email,
        input.notes === undefined ? current.notes : input.notes,
        input.active === undefined ? current.active : input.active ? 1 : 0,
        input.notificationConsent === undefined
          ? current.notification_consent
          : input.notificationConsent
            ? 1
            : 0,
        timestamp,
        request.params.id,
      );

    const row = database.prepare("SELECT * FROM patients WHERE id = ?").get(request.params.id) as PatientRow;
    response.json({ data: { patient: mapPatient(row) } });
  });

  router.delete("/:id", (request, response) => {
    getPatient(database, request.params.id);
    database
      .prepare("UPDATE patients SET active = 0, updated_at = ? WHERE id = ?")
      .run(nowIso(), request.params.id);
    response.status(204).send();
  });

  router.post("/:id/restore", (request, response) => {
    getPatient(database, request.params.id);
    database
      .prepare("UPDATE patients SET active = 1, updated_at = ? WHERE id = ?")
      .run(nowIso(), request.params.id);
    const row = database.prepare("SELECT * FROM patients WHERE id = ?").get(request.params.id) as PatientRow;
    response.json({ data: { patient: mapPatient(row) } });
  });

  return router;
};

const getPatient = (database: AppDatabase, id: string | undefined): PatientRow => {
  if (!id) throw new ApiError(400, "INVALID_ID", "Identificador inválido.");
  const row = database.prepare("SELECT * FROM patients WHERE id = ?").get(id) as PatientRow | undefined;
  if (!row) throw new ApiError(404, "PATIENT_NOT_FOUND", "Paciente não encontrado.");
  return row;
};
