export interface User {
  id: string;
  name: string;
  email: string;
  professionalTitle: string | null;
  registration: string | null;
  clinicName: string;
  defaultDurationMinutes: number;
  reminderHours: number;
  timezone: string;
  createdAt: string;
  updatedAt: string;
}

export interface SessionData {
  setupRequired: boolean;
  authenticated: boolean;
  user: User | null;
}

export interface Patient {
  id: string;
  name: string;
  birthDate: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  active: boolean;
  notificationConsent: boolean;
  createdAt: string;
  updatedAt: string;
  upcomingAppointments: number;
}

export type AppointmentStatus =
  | "scheduled"
  | "confirmed"
  | "cancelled"
  | "completed"
  | "no_show";

export type AppointmentModality = "presencial" | "video";

export interface Appointment {
  id: string;
  patientId: string;
  startsAt: string;
  endsAt: string;
  type: string;
  modality: AppointmentModality;
  status: AppointmentStatus;
  location: string | null;
  privateNotes: string | null;
  confirmationSentAt: string | null;
  reminderSentAt: string | null;
  createdAt: string;
  updatedAt: string;
  patient: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    notificationConsent: boolean;
  };
}

export interface NotificationResult {
  status: "sent" | "not-configured" | "not-requested" | "not-available" | "failed";
  message: string;
}

export interface DashboardData {
  metrics: {
    today: number;
    nextSevenDays: number;
    activePatients: number;
  };
  nextAppointment: Appointment | null;
  todayAppointments: Appointment[];
}

export interface PatientsResponse {
  items: Patient[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface SettingsData {
  profile: User;
  emailNotifications: {
    configured: boolean;
    recipient: string | null;
  };
}
