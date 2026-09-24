import bcrypt from "bcryptjs";
import { Router } from "express";
import type { AppDatabase } from "../database.js";
import { nowIso } from "../database.js";
import type { MailService } from "../email.js";
import { mapUser, type UserRow } from "../dto.js";
import { ApiError, asyncRoute } from "../errors.js";
import { passwordChangeSchema, profileSchema } from "../validation.js";
import { ensureValidTimezone } from "../time.js";

export const createSettingsRouter = (
  database: AppDatabase,
  mailer: MailService,
): Router => {
  const router = Router();

  router.get("/", (request, response) => {
    const user = getAuthenticatedUser(database, request.auth?.userId);
    response.json({
      data: {
        profile: mapUser(user),
        emailNotifications: {
          configured: mailer.isConfigured(),
          recipient: null,
        },
      },
    });
  });

  router.put("/profile", (request, response) => {
    const user = getAuthenticatedUser(database, request.auth?.userId);
    const input = profileSchema.parse(request.body);
    ensureValidTimezone(input.timezone);

    const duplicate = database.prepare("SELECT id FROM users WHERE email = ? AND id != ?").get(
      input.email,
      user.id,
    );
    if (duplicate) throw new ApiError(409, "EMAIL_IN_USE", "Este e-mail já está em uso.");

    database
      .prepare(
        `UPDATE users SET
          name = ?, email = ?, professional_title = ?, registration = ?,
          clinic_name = ?, default_duration_minutes = ?, reminder_hours = ?,
          timezone = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(
        input.name,
        input.email,
        input.professionalTitle ?? null,
        input.registration ?? null,
        input.clinicName,
        input.defaultDurationMinutes,
        input.reminderHours,
        input.timezone,
        nowIso(),
        user.id,
      );

    const updated = getAuthenticatedUser(database, user.id);
    response.json({ data: { profile: mapUser(updated) } });
  });

  router.put(
    "/password",
    asyncRoute(async (request, response) => {
      const user = getAuthenticatedUser(database, request.auth?.userId);
      const input = passwordChangeSchema.parse(request.body);
      const valid = await bcrypt.compare(input.currentPassword, user.password_hash);
      if (!valid) {
        throw new ApiError(422, "INVALID_PASSWORD", "A senha atual está incorreta.");
      }

      const passwordHash = await bcrypt.hash(input.newPassword, 12);
      database
        .prepare("UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?")
        .run(passwordHash, nowIso(), user.id);
      response.status(204).send();
    }),
  );

  return router;
};

const getAuthenticatedUser = (
  database: AppDatabase,
  userId: string | undefined,
): UserRow => {
  if (!userId) throw new ApiError(401, "UNAUTHENTICATED", "Faça login para continuar.");
  const user = database.prepare("SELECT * FROM users WHERE id = ?").get(userId) as
    | UserRow
    | undefined;
  if (!user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão inválida.");
  return user;
};
