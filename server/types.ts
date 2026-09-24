export const appointmentStatuses = [
  "scheduled",
  "confirmed",
  "cancelled",
  "completed",
  "no_show",
] as const;

export type AppointmentStatus = (typeof appointmentStatuses)[number];

export const appointmentModalities = ["presencial", "video"] as const;
export type AppointmentModality = (typeof appointmentModalities)[number];

export type AuthenticatedRequest = {
  auth?: {
    userId: string;
  };
};
