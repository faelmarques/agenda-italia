import { Router } from "express";
import type { AppDatabase } from "../database.js";
import { nowIso } from "../database.js";
import { mapAppointment, type AppointmentRow } from "../dto.js";
import { listAppointments } from "../appointments.js";
import { dateRangeSchema } from "../validation.js";
import { toIso } from "../time.js";

export const createDashboardRouter = (database: AppDatabase): Router => {
  const router = Router();

  router.get("/", (request, response) => {
    const { from: rawFrom, to: rawTo } = dateRangeSchema.parse(request.query);
    const from = toIso(rawFrom);
    const to = toIso(rawTo);
    const weekEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const todayRow = database
      .prepare(
        `SELECT COUNT(*) AS count
         FROM appointments
         WHERE starts_at >= ? AND starts_at < ? AND status IN ('scheduled', 'confirmed')`,
      )
      .get(from, to) as { count: number };

    const upcomingRow = database
      .prepare(
        `SELECT COUNT(*) AS count
         FROM appointments
         WHERE starts_at >= ? AND starts_at < ? AND status IN ('scheduled', 'confirmed')`,
      )
      .get(nowIso(), weekEnd.toISOString()) as { count: number };

    const patientsRow = database
      .prepare("SELECT COUNT(*) AS count FROM patients WHERE active = 1")
      .get() as { count: number };

    const nextRow = database
      .prepare(
        `SELECT
           a.*, p.name AS patient_name, p.phone AS patient_phone,
           p.email AS patient_email, p.notification_consent AS patient_notification_consent
         FROM appointments a
         JOIN patients p ON p.id = a.patient_id
         WHERE a.starts_at >= ? AND a.status IN ('scheduled', 'confirmed')
         ORDER BY a.starts_at ASC LIMIT 1`,
      )
      .get(nowIso()) as AppointmentRow | undefined;

    const todayItems = listAppointments(database, {
      from,
      to,
      status: "all",
      limit: 100,
    });

    response.json({
      data: {
        metrics: {
          today: todayRow.count,
          nextSevenDays: upcomingRow.count,
          activePatients: patientsRow.count,
        },
        nextAppointment: nextRow ? mapAppointment(nextRow) : null,
        todayAppointments: todayItems,
      },
    });
  });

  return router;
};
