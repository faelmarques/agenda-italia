import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { config } from "./config.js";

export type AppDatabase = Database.Database;

const migrations = [
  `
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      professional_title TEXT,
      registration TEXT,
      clinic_name TEXT NOT NULL DEFAULT 'Agenda Italia',
      default_duration_minutes INTEGER NOT NULL DEFAULT 50 CHECK (default_duration_minutes BETWEEN 15 AND 240),
      reminder_hours INTEGER NOT NULL DEFAULT 24 CHECK (reminder_hours BETWEEN 1 AND 168),
      timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE patients (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      birth_date TEXT,
      phone TEXT,
      email TEXT COLLATE NOCASE,
      notes TEXT,
      active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
      notification_consent INTEGER NOT NULL DEFAULT 0 CHECK (notification_consent IN (0, 1)),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE appointments (
      id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
      starts_at TEXT NOT NULL,
      ends_at TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'Sessão',
      modality TEXT NOT NULL CHECK (modality IN ('presencial', 'video')),
      status TEXT NOT NULL DEFAULT 'scheduled'
        CHECK (status IN ('scheduled', 'confirmed', 'cancelled', 'completed', 'no_show')),
      location TEXT,
      private_notes TEXT,
      confirmation_sent_at TEXT,
      reminder_sent_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      CHECK (datetime(ends_at) > datetime(starts_at))
    );

    CREATE INDEX idx_appointments_starts_at ON appointments(starts_at);
    CREATE INDEX idx_appointments_patient_id ON appointments(patient_id);
    CREATE INDEX idx_appointments_status ON appointments(status);
    CREATE INDEX idx_patients_name ON patients(name);
  `,
  `
    CREATE TABLE anamnesis (
      id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL UNIQUE REFERENCES patients(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'completed')),
      content TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE session_notes (
      id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      appointment_id TEXT REFERENCES appointments(id) ON DELETE SET NULL,
      session_date TEXT NOT NULL,
      template_id TEXT,
      objective TEXT,
      interventions TEXT,
      response TEXT,
      homework TEXT,
      planning TEXT,
      risk_alert INTEGER NOT NULL DEFAULT 0 CHECK (risk_alert IN (0, 1)),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX idx_session_notes_patient_id ON session_notes(patient_id);
    CREATE INDEX idx_session_notes_session_date ON session_notes(session_date);
    CREATE UNIQUE INDEX idx_session_notes_appointment_id ON session_notes(appointment_id);

    CREATE TABLE clinical_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    INSERT INTO clinical_templates (id, name, description, category, content, created_at) VALUES
      ('tcc', 'TCC — Sessão padrão', 'Estrutura clássica de sessão em Terapia Cognitivo-Comportamental.', 'TCC',
       '{"objective":"Revisão da semana e do registro de pensamentos. Escolha da situação-alvo do encontro.","interventions":"Reestruturação cognitiva, registro de pensamentos, resolução de problemas, exposição graduada quando indicado.","response":"Participação e engajamento, execução das tarefas, insights identificados e resistências encontradas.","homework":"Tarefa combinada na sessão anterior e registro de pensamentos na situação-alvo.","planning":"Retomar a tarefa, revisar o modelo cognitivo e definir a próxima situação-alvo."}',
       strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      ('psicodiagnostico', 'Psicodiagnóstico — Sessão de avaliação', 'Organiza a coleta de dados e a hipótese diagnóstica.', 'Avaliação',
       '{"objective":"Levantar anamnese, história de vida e critérios diagnósticos em investigação.","interventions":"Entrevista semiestruturada, escalas e instrumentos aplicados nesta sessão.","response":"Colaboração do paciente, reações aos instrumentos e dados relevantes relatados.","homework":"Trazer exames, relatórios anteriores e questionários preenchidos.","planning":"Organizar a hipótese diagnóstica e preparar a devolutiva."}',
       strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      ('casal', 'Terapia de casal', 'Acompanha o ciclo de conflito e os acordos do casal.', 'Casal',
       '{"objective":"Mapear o ciclo de conflito do casal na semana e os acordos vigentes.","interventions":"Técnicas de comunicação, fala do eu, externalização do problema e trabalho de empatia.","response":"Posicionamento de cada participante, pontos de alinhamento e desacordo.","homework":"Prática de escuta ativa por 10 minutos diárias, sem discussão de temas conflituosos.","planning":"Retomar acordos, revisar metas do casal e próxima situação a trabalhar."}',
       strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      ('infantojuvenil', 'Infantojuvenil', 'Registro pensado para sessões com crianças e adolescentes.', 'Infantil',
       '{"objective":"Acompanhar os ajustes escolares, familiares e a demanda trazida pelo paciente.","interventions":"Brinquedoterapia, desenho livre, jogos, psicoeducação e recursos lúdicos.","response":"Comportamento na sessão, afetividade, verbalização e nível de colaboração.","homework":"Orientação breve registrada para os responsáveis.","planning":"Definir o próximo foco e o feedback a ser enviado à família."}',
       strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      ('alta', 'Acompanhamento breve e alta', 'Fecha ciclos, reforça ganhos e organiza o retorno.', 'Alta',
       '{"objective":"Revisar ganhos, sintomas remanescentes e recursos mobilizados pelo paciente.","interventions":"Reforço de aprendizados, plano de autonomia e prevenção de recaída.","response":"Autopercepção de melhora, sinais de autonomia e situações de vulnerabilidade.","homework":"Lista de recursos de enfrentamento para momentos de crise.","planning":"Intervalos de retorno, sinais de alerta e critérios para novo agendamento."}',
       strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
  `,
];

export const createDatabase = (filename: string = config.databasePath): AppDatabase => {
  if (filename !== ":memory:") {
    fs.mkdirSync(path.dirname(filename), { recursive: true });
  }

  const database = new Database(filename);
  database.pragma("foreign_keys = ON");
  database.pragma("busy_timeout = 5000");
  if (filename !== ":memory:") {
    database.pragma("journal_mode = WAL");
  }

  migrate(database);
  return database;
};

const migrate = (database: AppDatabase): void => {
  const currentVersion = database.pragma("user_version", { simple: true }) as number;

  for (let version = currentVersion; version < migrations.length; version += 1) {
    const migration = migrations[version];
    if (!migration) continue;

    database.transaction(() => {
      database.exec(migration);
      database.pragma(`user_version = ${version + 1}`);
    })();
  }
};

export const nowIso = (): string => new Date().toISOString();
