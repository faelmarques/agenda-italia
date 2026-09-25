import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { authenticate, requireAuth, requireSameOrigin } from "./auth.js";
import { config } from "./config.js";
import { createDatabase, type AppDatabase } from "./database.js";
import { createMailService, type MailService } from "./email.js";
import { errorHandler, notFoundHandler } from "./errors.js";
import { createAppointmentsRouter } from "./routes/appointments.js";
import { createAuthRouter } from "./routes/auth.js";
import { createClinicalRouter } from "./routes/clinical.js";
import { createDashboardRouter } from "./routes/dashboard.js";
import { createPatientsRouter } from "./routes/patients.js";
import { createSettingsRouter } from "./routes/settings.js";

export interface AppOptions {
  database?: AppDatabase;
  mailer?: MailService;
}

export const createApp = (options: AppOptions = {}): Express => {
  const database = options.database ?? createDatabase();
  const mailer = options.mailer ?? createMailService();
  const app = express();

  if (config.trustProxy !== false) app.set("trust proxy", config.trustProxy);
  app.disable("x-powered-by");
  app.use(
    helmet({
      contentSecurityPolicy: config.isProduction ? undefined : false,
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.use(authenticate);
  app.use("/api", (_request, response, next) => {
    response.setHeader("Cache-Control", "no-store");
    next();
  });

  app.get("/api/health", (_request, response) => {
    response.json({ data: { status: "ok" } });
  });

  app.use("/api", requireSameOrigin);
  app.use(
    "/api/auth",
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 30,
      standardHeaders: "draft-8",
      legacyHeaders: false,
    }),
    createAuthRouter(database),
  );

  app.use("/api", requireAuth);
  app.use("/api", createClinicalRouter(database));
  app.use("/api/patients", createPatientsRouter(database));
  app.use("/api/appointments", createAppointmentsRouter(database, mailer));
  app.use("/api/dashboard", createDashboardRouter(database));
  app.use("/api/settings", createSettingsRouter(database, mailer));
  app.use("/api", notFoundHandler);
  app.use(errorHandler);

  return app;
};
