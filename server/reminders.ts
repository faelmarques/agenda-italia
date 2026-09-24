import type { AppDatabase } from "./database.js";
import type { MailService } from "./email.js";
import { getFirstUser } from "./appointments.js";
import { nowIso } from "./database.js";

interface ReminderRow {
  id: string;
  starts_at: string;
  type: string;
  modality: "presencial" | "video";
  location: string | null;
  patient_name: string;
  patient_email: string;
}

export const runReminderSweep = async (
  database: AppDatabase,
  mailer: MailService,
): Promise<number> => {
  const user = getFirstUser(database);
  if (!user || !mailer.isConfigured()) return 0;

  const now = nowIso();
  const limit = new Date(Date.now() + user.reminder_hours * 60 * 60 * 1000).toISOString();

  const reminders = database
    .prepare(
      `SELECT
         a.id,
         a.starts_at,
         a.type,
         a.modality,
         a.location,
         p.name AS patient_name,
         p.email AS patient_email
       FROM appointments a
       JOIN patients p ON p.id = a.patient_id
       WHERE a.status IN ('scheduled', 'confirmed')
         AND a.starts_at > ?
         AND a.starts_at <= ?
         AND a.reminder_sent_at IS NULL
         AND p.active = 1
         AND p.notification_consent = 1
         AND p.email IS NOT NULL
       ORDER BY a.starts_at ASC
       LIMIT 100`,
    )
    .all(now, limit) as ReminderRow[];

  let sent = 0;
  for (const reminder of reminders) {
    try {
      await mailer.sendAppointmentEmail(
        "reminder",
        {
          startsAt: reminder.starts_at,
          type: reminder.type,
          modality: reminder.modality,
          location: reminder.location,
          patientName: reminder.patient_name,
          patientEmail: reminder.patient_email,
        },
        {
          therapistName: user.name,
          clinicName: user.clinic_name,
          timezone: user.timezone,
        },
      );

      const timestamp = nowIso();
      database
        .prepare("UPDATE appointments SET reminder_sent_at = ?, updated_at = ? WHERE id = ?")
        .run(timestamp, timestamp, reminder.id);
      sent += 1;
    } catch {
      if (process.env.NODE_ENV !== "test") {
        console.error(`Falha ao enviar lembrete da consulta ${reminder.id}.`);
      }
    }
  }

  return sent;
};
