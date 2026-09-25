import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "../server/app.js";
import { createDatabase, type AppDatabase } from "../server/database.js";
import type { MailService } from "../server/email.js";
import { runReminderSweep } from "../server/reminders.js";

const createMailer = (configured = false): MailService => ({
  isConfigured: () => configured,
  sendAppointmentEmail: vi.fn(async () => undefined),
});

describe("API da agenda", () => {
  let database: AppDatabase;

  beforeEach(() => {
    database = createDatabase(":memory:");
  });

  afterEach(() => {
    database.close();
  });

  it("configura a conta, cadastra paciente e protege a agenda", async () => {
    const agent = request.agent(createApp({ database, mailer: createMailer() }));

    const initialSession = await agent.get("/api/auth/session").expect(200);
    expect(initialSession.body.data).toMatchObject({ setupRequired: true, authenticated: false });

    await agent
      .post("/api/auth/setup")
      .send({
        name: "Dra. Marina Costa",
        email: "marina@example.com",
        password: "senhasegura123",
        professionalTitle: "Psicóloga",
        registration: "CRP 06/12345",
        clinicName: "Clinic Marina",
      })
      .expect(201);

    const patientResponse = await agent
      .post("/api/patients")
      .send({
        name: "Ana Souza",
        birthDate: "1992-05-14",
        phone: "+55 11 99999-1111",
        email: "ana@example.com",
        notificationConsent: true,
      })
      .expect(201);

    expect(patientResponse.body.data.patient).toMatchObject({
      name: "Ana Souza",
      active: true,
      notificationConsent: true,
    });

    const start = "2099-05-20T11:00:00-03:00";
    const end = "2099-05-20T11:50:00-03:00";
    const appointmentResponse = await agent
      .post("/api/appointments")
      .send({
        patientId: patientResponse.body.data.patient.id,
        startsAt: start,
        endsAt: end,
        type: "Sessão individual",
        modality: "presencial",
        location: "Sala 1",
        sendConfirmation: false,
      })
      .expect(201);

    expect(appointmentResponse.body.data.appointment).toMatchObject({
      startsAt: "2099-05-20T14:00:00.000Z",
      status: "scheduled",
      patient: { name: "Ana Souza" },
    });

    const conflict = await agent
      .post("/api/appointments")
      .send({
        patientId: patientResponse.body.data.patient.id,
        startsAt: "2099-05-20T14:25:00.000Z",
        endsAt: "2099-05-20T15:15:00.000Z",
        type: "Sessão individual",
        modality: "presencial",
        sendConfirmation: false,
      })
      .expect(409);
    expect(conflict.body.error.code).toBe("APPOINTMENT_CONFLICT");

    const list = await agent.get("/api/appointments").expect(200);
    expect(list.body.data.items).toHaveLength(1);

    await agent.post("/api/auth/logout").expect(204);
    await agent.get("/api/patients").expect(401);
  });

  it("impede uma segunda configuração inicial", async () => {
    const app = createApp({ database, mailer: createMailer() });
    const payload = {
      name: "Dra. Helena",
      email: "helena@example.com",
      password: "outrasenha123",
      clinicName: "Agenda Helena",
    };

    await request(app).post("/api/auth/setup").send(payload).expect(201);
    await request(app).post("/api/auth/setup").send(payload).expect(409);
  });
});

describe("Lembretes automáticos", () => {
  it("envia uma vez e marca a consulta como lembrada", async () => {
    const database = createDatabase(":memory:");
    const timestamp = new Date().toISOString();
    const userId = randomUUID();
    const patientId = randomUUID();
    const appointmentId = randomUUID();
    const startsAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const endsAt = new Date(Date.now() + 110 * 60 * 1000).toISOString();

    database.prepare(
      `INSERT INTO users (
        id, name, email, password_hash, clinic_name, default_duration_minutes,
        reminder_hours, timezone, created_at, updated_at
      ) VALUES (?, 'Dra. Lara', 'lara@example.com', 'hash', 'Agenda Lara', 50, 24, 'UTC', ?, ?)`,
    ).run(userId, timestamp, timestamp);
    database.prepare(
      `INSERT INTO patients (
        id, name, email, active, notification_consent, created_at, updated_at
      ) VALUES (?, 'Pedro Lima', 'pedro@example.com', 1, 1, ?, ?)`,
    ).run(patientId, timestamp, timestamp);
    database.prepare(
      `INSERT INTO appointments (
        id, patient_id, starts_at, ends_at, type, modality, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'Sessão', 'video', 'confirmed', ?, ?)`,
    ).run(appointmentId, patientId, startsAt, endsAt, timestamp, timestamp);

    const mailer = createMailer(true);
    await expect(runReminderSweep(database, mailer)).resolves.toBe(1);
    await expect(runReminderSweep(database, mailer)).resolves.toBe(0);
    expect(mailer.sendAppointmentEmail).toHaveBeenCalledWith(
      "reminder",
      expect.objectContaining({ patientName: "Pedro Lima", patientEmail: "pedro@example.com" }),
      expect.objectContaining({ therapistName: "Dra. Lara" }),
    );

    const row = database
      .prepare("SELECT reminder_sent_at FROM appointments WHERE id = ?")
      .get(appointmentId) as { reminder_sent_at: string | null };
    expect(row.reminder_sent_at).not.toBeNull();
    database.close();
  });
});

describe("Documentação clínica", () => {
  it("cobre anamnese, consultas, modelos e evolução", async () => {
    const database = createDatabase(":memory:");
    const app = createApp({ database, mailer: createMailer() });
    const agent = request.agent(app);

    await agent
      .post("/api/auth/setup")
      .send({
        name: "Dra. Marina Costa",
        email: "marina@example.com",
        password: "senhasegura123",
        clinicName: "Clinic Marina",
      })
      .expect(201);

    const patient = (
      await agent.post("/api/patients").send({ name: "Ana Souza" }).expect(201)
    ).body.data.patient;

    const templates = await agent.get("/api/clinical-templates").expect(200);
    expect(templates.body.data.items.length).toBeGreaterThanOrEqual(5);
    expect(templates.body.data.items[0]).toMatchObject({
      id: expect.any(String),
      content: expect.objectContaining({ objective: expect.any(String) }),
    });

    const missingAnamnesis = await agent
      .get(`/api/anamnesis/${randomUUID()}`)
      .expect(404);
    expect(missingAnamnesis.body.error.code).toBe("PATIENT_NOT_FOUND");

    const emptyAnamnesis = await agent.get(`/api/anamnesis/${patient.id}`).expect(200);
    expect(emptyAnamnesis.body.data.anamnesis).toBeNull();

    const savedAnamnesis = await agent
      .put(`/api/anamnesis/${patient.id}`)
      .send({
        status: "completed",
        content: { queixaPrincipal: "Insônia há três meses", risco: "Sem ideação relatada" },
      })
      .expect(200);

    expect(savedAnamnesis.body.data.anamnesis).toMatchObject({ status: "completed" });
    expect(savedAnamnesis.body.data.anamnesis.content).toMatchObject({
      queixaPrincipal: "Insônia há três meses",
      risco: "Sem ideação relatada",
      historicoFamiliar: "",
    });

    const appointment = (
      await agent
        .post("/api/appointments")
        .send({
          patientId: patient.id,
          startsAt: "2099-06-01T11:00:00-03:00",
          endsAt: "2099-06-01T11:50:00-03:00",
          type: "Sessão individual",
          modality: "video",
          sendConfirmation: false,
        })
        .expect(201)
    ).body.data.appointment;

    const pendingConsultation = await agent.get("/api/consultations?hasNote=no").expect(200);
    expect(pendingConsultation.body.data.items).toHaveLength(1);
    expect(pendingConsultation.body.data.items[0]).toMatchObject({
      id: appointment.id,
      noteId: null,
      patient: { name: "Ana Souza" },
    });

    const noteResponse = await agent
      .post("/api/session-notes")
      .send({
        patientId: patient.id,
        appointmentId: appointment.id,
        sessionDate: "1999-06-01",
        templateId: "tcc",
        content: { objective: "Revisão da semana", interventions: "Reestruturação cognitiva" },
        riskAlert: true,
      })
      .expect(201);

    expect(noteResponse.body.data.note).toMatchObject({
      riskAlert: true,
      templateId: "tcc",
      sessionDate: "1999-06-01",
      content: expect.objectContaining({
        objective: "Revisão da semana",
        planning: "",
      }),
    });

    const duplicate = await agent
      .post("/api/session-notes")
      .send({
        patientId: patient.id,
        appointmentId: appointment.id,
        sessionDate: "1999-06-01",
        content: { objective: "Registro repetido" },
      })
      .expect(409);
    expect(duplicate.body.error.code).toBe("APPOINTMENT_NOTE_EXISTS");

    const completedConsultation = await agent.get("/api/consultations?hasNote=yes").expect(200);
    expect(completedConsultation.body.data.items[0]).toMatchObject({
      noteId: noteResponse.body.data.note.id,
      noteSessionDate: "1999-06-01",
    });

    const notes = await agent.get(`/api/session-notes?patientId=${patient.id}`).expect(200);
    expect(notes.body.data.items).toHaveLength(1);

    const updated = await agent
      .put(`/api/session-notes/${noteResponse.body.data.note.id}`)
      .send({ content: { planning: "Revisar higiene do sono" }, riskAlert: false })
      .expect(200);

    expect(updated.body.data.note).toMatchObject({ riskAlert: false });
    expect(updated.body.data.note.content).toMatchObject({
      objective: "Revisão da semana",
      planning: "Revisar higiene do sono",
    });

    await agent
      .delete(`/api/session-notes/${noteResponse.body.data.note.id}`)
      .expect(204);

    const afterDelete = await agent
      .get(`/api/session-notes?patientId=${patient.id}`)
      .expect(200);
    expect(afterDelete.body.data.items).toHaveLength(0);

    await agent.post("/api/auth/logout").expect(204);
    await agent.get("/api/consultations").expect(401);
    database.close();
  });
});
