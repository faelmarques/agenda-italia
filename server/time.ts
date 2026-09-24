import { ApiError } from "./errors.js";

export const toIso = (value: string): string => new Date(value).toISOString();

export const ensureValidTimezone = (timezone: string): void => {
  try {
    new Intl.DateTimeFormat("pt-BR", { timeZone: timezone }).format();
  } catch {
    throw new ApiError(422, "INVALID_TIMEZONE", "Fuso horário inválido.");
  }
};
