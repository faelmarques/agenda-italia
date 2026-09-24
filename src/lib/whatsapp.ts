import type { Appointment, User } from "../types";
import { formatDateTime } from "./date";

const normalizePhone = (phone: string): string => phone.replace(/\D/g, "");

export const whatsappUrl = (phone: string, message: string): string =>
  `https://wa.me/${normalizePhone(phone)}?text=${encodeURIComponent(message)}`;

export const appointmentMessage = (appointment: Appointment, user: User): string => {
  const place = appointment.modality === "video"
    ? appointment.location ?? "Videochamada"
    : appointment.location ?? "Atendimento presencial";

  return [
    `Olá, ${appointment.patient.name}!`,
    "",
    `Passando para lembrar da sua consulta de ${appointment.type}.`,
    `Data e hora: ${formatDateTime(appointment.startsAt)}`,
    `Local: ${place}`,
    "",
    `Se precisar remarcar, fale comigo.`,
    `${user.name}${user.professionalTitle ? ` — ${user.professionalTitle}` : ""}`,
  ].join("\n");
};
