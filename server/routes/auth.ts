import { randomUUID } from "node:crypto";
import { Router } from "express";
import bcrypt from "bcryptjs";
import type { AppDatabase } from "../database.js";
import { nowIso } from "../database.js";
import { mapUser, type UserRow } from "../dto.js";
import { clearSessionCookie, createSessionToken, requireAuth, setSessionCookie } from "../auth.js";
import { ApiError, asyncRoute } from "../errors.js";
import { loginSchema, setupSchema } from "../validation.js";
import { ensureValidTimezone } from "../time.js";

export const createAuthRouter = (database: AppDatabase): Router => {
  const router = Router();

  router.get("/session", (request, response) => {
    const setupRequired = (database.prepare("SELECT COUNT(*) AS count FROM users").get() as {
      count: number;
    }).count === 0;

    if (!request.auth) {
      response.json({ data: { setupRequired, authenticated: false, user: null } });
      return;
    }

    const user = database.prepare("SELECT * FROM users WHERE id = ?").get(request.auth.userId) as
      | UserRow
      | undefined;

    if (!user) {
      clearSessionCookie(response);
      response.json({ data: { setupRequired: false, authenticated: false, user: null } });
      return;
    }

    response.json({
      data: { setupRequired: false, authenticated: true, user: mapUser(user) },
    });
  });

  router.post(
    "/setup",
    asyncRoute(async (request, response) => {
      const input = setupSchema.parse(request.body);
      ensureValidTimezone(input.timezone);
      const timestamp = nowIso();
      const id = randomUUID();
      const passwordHash = await bcrypt.hash(input.password, 12);

      const createUser = database.transaction(() => {
        const count = (database.prepare("SELECT COUNT(*) AS count FROM users").get() as {
          count: number;
        }).count;
        if (count > 0) {
          throw new ApiError(409, "SETUP_ALREADY_COMPLETE", "O cadastro inicial já foi realizado.");
        }

        database
          .prepare(
            `INSERT INTO users (
              id, name, email, password_hash, professional_title, registration,
              clinic_name, default_duration_minutes, reminder_hours, timezone,
              created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 50, 24, ?, ?, ?)`,
          )
          .run(
            id,
            input.name,
            input.email,
            passwordHash,
            input.professionalTitle ?? null,
            input.registration ?? null,
            input.clinicName,
            input.timezone,
            timestamp,
            timestamp,
          );
      });

      createUser();
      const token = await createSessionToken(id);
      setSessionCookie(response, token);
      const user = database.prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow;
      response.status(201).json({ data: { user: mapUser(user) } });
    }),
  );

  router.post(
    "/login",
    asyncRoute(async (request, response) => {
      const input = loginSchema.parse(request.body);
      const user = database.prepare("SELECT * FROM users WHERE email = ?").get(input.email) as
        | UserRow
        | undefined;

      const valid = user ? await bcrypt.compare(input.password, user.password_hash) : false;
      if (!user || !valid) {
        throw new ApiError(401, "INVALID_CREDENTIALS", "E-mail ou senha incorretos.");
      }

      const token = await createSessionToken(user.id);
      setSessionCookie(response, token);
      response.json({ data: { user: mapUser(user) } });
    }),
  );

  router.post("/logout", (_request, response) => {
    clearSessionCookie(response);
    response.status(204).send();
  });

  router.post(
    "/setup/reset-password-link",
    requireAuth,
    (_request, response) => {
      response.status(501).json({
        error: {
          code: "NOT_IMPLEMENTED",
          message: "A recuperação de senha deve ser configurada com um provedor de e-mail.",
        },
      });
    },
  );

  return router;
};
