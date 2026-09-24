import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { addWeeks, format, isSameWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Clock3,
  MapPin,
  Video,
} from "lucide-react";
import clsx from "clsx";
import { api, toQueryString } from "../lib/api";
import { formatTime, makeDayStrip, sameCalendarDay, weekRange } from "../lib/date";
import type { Appointment } from "../types";
import { AppointmentDialog } from "../components/AppointmentDialog";
import { AppointmentDetails } from "../components/AppointmentDetails";
import { Button, EmptyState, PageHeader, StatusBadge } from "../components/ui";

export const CalendarPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [weekDate, setWeekDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [detailsId, setDetailsId] = useState<string | null>(searchParams.get("appointment"));
  const [editing, setEditing] = useState<Appointment | null>(null);
  const range = useMemo(() => weekRange(weekDate), [weekDate]);
  const days = useMemo(() => makeDayStrip(range.start), [range.start]);
  const dialogOpen = searchParams.get("new") === "1";
  const initialDate = selectedDate;

  const query = useQuery({
    queryKey: ["appointments", "week", range.from, range.to],
    queryFn: () => api<{ items: Appointment[] }>(
      `/api/appointments${toQueryString({ from: range.from, to: range.to, status: "all", limit: 500 })}`,
    ),
  });

  const appointments = query.data?.items ?? [];
  const selectedAppointments = appointments.filter((appointment) =>
    sameCalendarDay(new Date(appointment.startsAt), selectedDate),
  );
  const details = appointments.find((appointment) => appointment.id === detailsId) ?? null;

  const closeDialog = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("new");
    setSearchParams(next, { replace: true });
  };

  const openNew = () => {
    const next = new URLSearchParams(searchParams);
    next.set("new", "1");
    next.delete("appointment");
    setSearchParams(next, { replace: true });
  };

  const openDetails = (id: string) => {
    setDetailsId(id);
    const next = new URLSearchParams(searchParams);
    next.set("appointment", id);
    setSearchParams(next, { replace: true });
  };

  const closeDetails = () => {
    setDetailsId(null);
    const next = new URLSearchParams(searchParams);
    next.delete("appointment");
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="calendar-page">
      <PageHeader
        eyebrow="Organize seu tempo"
        title="Agenda"
        description="Visualize a semana e cuide dos detalhes de cada atendimento."
        action={<Button icon={<CalendarPlus size={18} />} onClick={openNew}>Nova consulta</Button>}
      />

      <section className="calendar-panel panel">
        <div className="calendar-toolbar">
          <div className="calendar-toolbar__nav">
            <Button
              variant="ghost"
              size="small"
              aria-label="Semana anterior"
              onClick={() => {
                setSelectedDate((date) => addWeeks(date, -1));
                setWeekDate((date) => addWeeks(date, -1));
              }}
            >
              <ChevronLeft size={20} />
            </Button>
            <Button
              variant="ghost"
              size="small"
              aria-label="Próxima semana"
              onClick={() => {
                setSelectedDate((date) => addWeeks(date, 1));
                setWeekDate((date) => addWeeks(date, 1));
              }}
            >
              <ChevronRight size={20} />
            </Button>
            <h2>{format(range.start, "MMMM 'de' yyyy", { locale: ptBR })}</h2>
          </div>
          <Button
            variant="secondary"
            size="small"
            onClick={() => {
              const today = new Date();
              setWeekDate(today);
              setSelectedDate(today);
            }}
            disabled={isSameWeek(weekDate, new Date(), { weekStartsOn: 1 })}
          >
            Hoje
          </Button>
        </div>

        <div className="week-strip" role="tablist" aria-label="Dias da semana">
          {days.map((day) => {
            const count = appointments.filter((appointment) =>
              sameCalendarDay(new Date(appointment.startsAt), day),
            ).length;
            const active = sameCalendarDay(day, selectedDate);
            return (
              <button
                type="button"
                role="tab"
                aria-selected={active}
                className={clsx("day-card", active && "day-card--active")}
                key={day.toISOString()}
                onClick={() => setSelectedDate(day)}
              >
                <span>{format(day, "EEE", { locale: ptBR }).replace(".", "")}</span>
                <strong>{format(day, "d")}</strong>
                <small>{count === 0 ? "—" : `${count} ${count === 1 ? "consulta" : "consultas"}`}</small>
              </button>
            );
          })}
        </div>

        <div className="day-agenda">
          <div className="day-agenda__heading">
            <div>
              <span>{format(selectedDate, "EEEE", { locale: ptBR })}</span>
              <h3>{format(selectedDate, "d 'de' MMMM", { locale: ptBR })}</h3>
            </div>
            <Button
              variant="secondary"
              size="small"
              icon={<CalendarPlus size={16} />}
              onClick={openNew}
            >
              Adicionar
            </Button>
          </div>

          {query.isLoading ? (
            <div className="skeleton skeleton--large" />
          ) : selectedAppointments.length ? (
            <div className="calendar-appointments">
              {selectedAppointments.map((appointment) => (
                <button
                  type="button"
                  className={clsx(
                    "calendar-appointment",
                    `calendar-appointment--${appointment.modality}`,
                    appointment.status === "cancelled" && "calendar-appointment--cancelled",
                  )}
                  key={appointment.id}
                  onClick={() => openDetails(appointment.id)}
                >
                  <span className="calendar-appointment__time">
                    <Clock3 size={15} />
                    {formatTime(appointment.startsAt)}
                  </span>
                  <span className="calendar-appointment__main">
                    <strong>{appointment.patient.name}</strong>
                    <small>{appointment.type}</small>
                  </span>
                  <span className="calendar-appointment__place">
                    {appointment.modality === "video" ? <Video size={15} /> : <MapPin size={15} />}
                    {appointment.modality === "video" ? "Vídeo" : "Presencial"}
                  </span>
                  <StatusBadge status={appointment.status} />
                </button>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Dia sem consultas"
              description="Este horário está livre. Você pode adicionar um atendimento quando quiser."
              action={<Button variant="secondary" onClick={openNew}>Agendar neste dia</Button>}
            />
          )}
        </div>
      </section>

      <AppointmentDialog
        open={dialogOpen || editing !== null}
        onClose={() => {
          closeDialog();
          setEditing(null);
        }}
        appointment={editing}
        initialDate={initialDate}
      />
      <AppointmentDetails
        appointment={details}
        onClose={closeDetails}
        onEdit={(appointment) => {
          closeDetails();
          setEditing(appointment);
        }}
      />
    </div>
  );
};
