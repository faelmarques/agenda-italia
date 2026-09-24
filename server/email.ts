import nodemailer from "nodemailer";
import { config } from "./config.js";
import { ApiError } from "./errors.js";

export interface MailAppointment {
  startsAt: string;
  type: string;
  modality: "presencial" | "video";
  location: string | null;
  patientName: string;
  patientEmail: string;
}

export interface MailContext {
  therapistName: string;
  clinicName: string;
  timezone: string;
}

export type MailKind = "confirmation" | "reminder" | "cancellation";

export interface MailService {
  isConfigured(): boolean;
  sendAppointmentEmail(kind: MailKind, appointment: MailAppointment, context: MailContext): Promise<void>;
}

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const formatWhen = (iso: string, timezone: string): string =>
  new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: timezone,
  }).format(new Date(iso));

const formatPlace = (appointment: MailAppointment): string => {
  if (appointment.modality === "video") {
    return appointment.location ? `Videochamada: ${appointment.location}` : "Videochamada";
  }
  return appointment.location ? `Presencial: ${appointment.location}` : "Atendimento presencial";
};

export const createMailService = (): MailService => {
  const isConfigured = Boolean(config.smtp.host);

  const transport = isConfigured
    ? nodemailer.createTransport({
        host: config.smtp.host,
        port: config.smtp.port,
        secure: config.smtp.secure,
        auth: config.smtp.user
          ? { user: config.smtp.user, pass: config.smtp.pass }
          : undefined,
      })
    : null;

  return {
    isConfigured: () => isConfigured,
    async sendAppointmentEmail(kind, appointment, context) {
      if (!transport) {
        throw new ApiError(
          503,
          "SMTP_NOT_CONFIGURED",
          "O e-mail não está configurado. Configure as variáveis SMTP para enviar confirmações.",
        );
      }

      const when = formatWhen(appointment.startsAt, context.timezone);
      const place = formatPlace(appointment);
      const greeting = `Olá, ${appointment.patientName}!`;
      const signature = `Atenciosamente,\n${context.therapistName}\n${context.clinicName}`;

      const copy = {
        confirmation: {
          subject: `Consulta confirmada — ${context.clinicName}`,
          intro: `Este é um lembrete para confirmar sua consulta de ${appointment.type}.`,
        },
        reminder: {
          subject: `Lembrete da sua consulta — ${context.clinicName}`,
          intro: `Passando para lembrar sua próxima consulta de ${appointment.type}.`,
        },
        cancellation: {
          subject: `Consulta cancelada — ${context.clinicName}`,
          intro: `Informamos que sua consulta de ${appointment.type} foi cancelada.`,
        },
      }[kind];

      const text = [
        greeting,
        "",
        copy.intro,
        `Data e hora: ${when}`,
        place,
        "",
        "Se precisar remarcar, responda a este e-mail ou entre em contato com o profissional.",
        "",
        signature,
      ].join("\n");

      const safe = {
        patient: escapeHtml(appointment.patientName),
        when: escapeHtml(when),
        place: escapeHtml(place),
        type: escapeHtml(appointment.type),
        intro: escapeHtml(copy.intro),
        therapist: escapeHtml(context.therapistName),
        clinic: escapeHtml(context.clinicName),
      };

      await transport.sendMail({
        from: config.smtp.from,
        to: appointment.patientEmail,
        subject: copy.subject,
        text,
        html: `
          <div style="background:#f3f7f5;padding:32px 16px;font-family:Arial,sans-serif;color:#173b36">
            <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:18px;padding:32px;border:1px solid #dbe9e4">
              <p style="margin:0 0 24px;color:#176b62;font-weight:700">${safe.clinic}</p>
              <h1 style="font-size:22px;line-height:1.35;margin:0 0 18px">Olá, ${safe.patient}!</h1>
              <p style="line-height:1.6;margin:0 0 18px">${safe.intro}</p>
              <div style="background:#edf7f4;border-radius:12px;padding:18px;line-height:1.6">
                <strong>${safe.when}</strong><br />
                ${safe.type}<br />
                ${safe.place}
              </div>
              <p style="line-height:1.6;margin:24px 0 0">Se precisar remarcar, responda a este e-mail ou entre em contato com o profissional.</p>
              <p style="line-height:1.6;margin:28px 0 0">Atenciosamente,<br /><strong>${safe.therapist}</strong><br />${safe.clinic}</p>
            </div>
          </div>
        `,
      });
    },
  };
};
