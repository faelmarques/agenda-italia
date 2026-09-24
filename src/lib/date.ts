import {
  addDays,
  addMinutes,
  endOfDay,
  endOfWeek,
  format,
  isSameDay,
  startOfDay,
  startOfWeek,
} from "date-fns";
import { ptBR } from "date-fns/locale";

export const localDateTimeValue = (date: Date): string => format(date, "yyyy-MM-dd'T'HH:mm");

export const dateInputValue = (date: Date): string => format(date, "yyyy-MM-dd");

export const combineLocalDateTime = (date: string, time: string): string => {
  const parsed = new Date(`${date}T${time}:00`);
  if (Number.isNaN(parsed.getTime())) throw new Error("Data ou horário inválido.");
  return parsed.toISOString();
};

export const addMinutesIso = (iso: string, minutes: number): string =>
  addMinutes(new Date(iso), minutes).toISOString();

export const dayRange = (date: Date) => ({
  from: startOfDay(date).toISOString(),
  to: endOfDay(date).toISOString(),
});

export const weekRange = (date: Date) => {
  const start = startOfWeek(date, { weekStartsOn: 1 });
  const end = endOfWeek(date, { weekStartsOn: 1 });
  return {
    start,
    end,
    from: start.toISOString(),
    to: endOfDay(end).toISOString(),
  };
};

export const formatLongDate = (date: Date | string): string =>
  format(typeof date === "string" ? new Date(date) : date, "EEEE, d 'de' MMMM", { locale: ptBR });

export const formatShortDate = (date: Date | string): string =>
  format(typeof date === "string" ? new Date(date) : date, "dd/MM/yyyy");

export const formatTime = (date: Date | string): string =>
  format(typeof date === "string" ? new Date(date) : date, "HH:mm");

export const formatDateTime = (date: Date | string): string =>
  format(typeof date === "string" ? new Date(date) : date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

export const capitalize = (value: string): string =>
  value.charAt(0).toUpperCase() + value.slice(1);

export const sameCalendarDay = (left: Date, right: Date): boolean => isSameDay(left, right);

export const makeDayStrip = (weekStart: Date): Date[] =>
  Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
