import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ quiet: true });

const isProduction = process.env.NODE_ENV === "production";
const sessionSecret = process.env.SESSION_SECRET ??
  (isProduction ? "" : "development-only-secret-change-before-production");

if (isProduction && sessionSecret.length < 32) {
  throw new Error("SESSION_SECRET deve ter pelo menos 32 caracteres em produção.");
}

const parseBoolean = (value: string | undefined, fallback = false): boolean => {
  if (value === undefined) return fallback;
  return value.toLowerCase() === "true";
};

const databasePath = process.env.DATABASE_PATH
  ? path.resolve(process.cwd(), process.env.DATABASE_PATH)
  : path.resolve(process.cwd(), "data", "agenda.sqlite");

export const config = {
  isProduction,
  port: Number(process.env.PORT ?? 3000),
  trustProxy: process.env.TRUST_PROXY ? Number(process.env.TRUST_PROXY) : false,
  databasePath,
  sessionSecret,
  secureCookie: process.env.COOKIE_SECURE === undefined
    ? isProduction
    : parseBoolean(process.env.COOKIE_SECURE),
  disableReminderJobs: parseBoolean(process.env.DISABLE_REMINDER_JOBS),
  smtp: {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: parseBoolean(process.env.SMTP_SECURE, false),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM ?? "Agenda Italia <agenda@localhost>",
  },
};
