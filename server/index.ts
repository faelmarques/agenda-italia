import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cron from "node-cron";
import { createApp } from "./app.js";
import { config } from "./config.js";
import { createDatabase } from "./database.js";
import { createMailService } from "./email.js";
import { runReminderSweep } from "./reminders.js";

const database = createDatabase();
const mailer = createMailService();
const app = createApp({ database, mailer });

if (config.isProduction) {
  const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
  const clientDirectory = path.resolve(currentDirectory, "..", "dist");
  app.use(express.static(clientDirectory, { maxAge: "1d", index: false }));
  app.get(/.*/, (_request, response) => {
    response.sendFile(path.join(clientDirectory, "index.html"));
  });
} else {
  const { createServer: createViteServer } = await import("vite");
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
}

const server = app.listen(config.port, () => {
  console.log(`Agenda Itália disponível em http://localhost:${config.port}`);
});

let reminderTask: ReturnType<typeof cron.schedule> | undefined;
let reminderRunning = false;
if (!config.disableReminderJobs) {
  reminderTask = cron.schedule("* * * * *", () => {
    if (reminderRunning) return;
    reminderRunning = true;
    void runReminderSweep(database, mailer)
      .catch(() => {
        console.error("Falha ao processar lembretes automáticos.");
      })
      .finally(() => {
        reminderRunning = false;
      });
  });
}

const shutdown = (): void => {
  reminderTask?.stop();
  server.close(() => {
    database.close();
    process.exit(0);
  });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
