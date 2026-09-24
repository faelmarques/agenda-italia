import type { AppDatabase } from "./database.js";
import { mapAppointment, type AppointmentRow, type UserRow } from "./dto.js";

const appointmentSelect = `
  SELECT
    a.*,
    p.name AS patient_name,
    p.phone AS patient_phone,
    p.email AS patient_email,
    p.notification_consent AS patient_notification_consent
  FROM appointments a
  JOIN patients p ON p.id = a.patient_id
`;

export const getAppointment = (database: AppDatabase, id: string) => {
  const row = database.prepare(`${appointmentSelect} WHERE a.id = ?`).get(id) as
    | AppointmentRow
    | undefined;
  return row ? mapAppointment(row) : null;
};

export const getAppointmentRow = (database: AppDatabase, id: string) =>
  database.prepare(`${appointmentSelect} WHERE a.id = ?`).get(id) as AppointmentRow | undefined;

export const hasAppointmentConflict = (
  database: AppDatabase,
  startsAt: string,
  endsAt: string,
  excludeId?: string,
): boolean => {
  const row = database
    .prepare(
      `SELECT id
       FROM appointments
       WHERE starts_at < ?
         AND ends_at > ?
         AND status NOT IN ('cancelled', 'no_show')
         AND (? IS NULL OR id != ?)
       LIMIT 1`,
    )
    .get(endsAt, startsAt, excludeId ?? null, excludeId ?? null) as { id: string } | undefined;

  return Boolean(row);
};

export const listAppointments = (
  database: AppDatabase,
  options: {
    from?: string;
    to?: string;
    patientId?: string;
    status?: string;
    limit: number;
  },
) => {
  const conditions: string[] = [];
  const values: Array<string | number> = [];

  if (options.from) {
    conditions.push("a.ends_at > ?");
    values.push(options.from);
  }
  if (options.to) {
    conditions.push("a.starts_at < ?");
    values.push(options.to);
  }
  if (options.patientId) {
    conditions.push("a.patient_id = ?");
    values.push(options.patientId);
  }
  if (options.status && options.status !== "all") {
    conditions.push("a.status = ?");
    values.push(options.status);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  values.push(options.limit);
  const rows = database
    .prepare(`${appointmentSelect} ${where} ORDER BY a.starts_at ASC LIMIT ?`)
    .all(...values) as AppointmentRow[];

  return rows.map(mapAppointment);
};

export const getUser = (database: AppDatabase, id: string) =>
  database.prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow | undefined;

export const getFirstUser = (database: AppDatabase) =>
  database.prepare("SELECT * FROM users ORDER BY created_at LIMIT 1").get() as
    | UserRow
    | undefined;
