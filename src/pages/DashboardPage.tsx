import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  CalendarCheck2,
  CalendarPlus,
  Clock3,
  MapPin,
  Sparkles,
  Users,
  Video,
} from "lucide-react";
import { api, toQueryString } from "../lib/api";
import {
  capitalize,
  dayRange,
  formatLongDate,
  formatTime,
} from "../lib/date";
import type { DashboardData } from "../types";
import { useAuth } from "../context/AuthContext";
import { Button, EmptyState, PageHeader, StatusBadge } from "../components/ui";

export const DashboardPage = () => {
  const navigate = useNavigate();
  const { session } = useAuth();
  const range = useMemo(() => dayRange(new Date()), []);
  const query = useQuery({
    queryKey: ["dashboard", range.from, range.to],
    queryFn: () => api<DashboardData>(`/api/dashboard${toQueryString(range)}`),
  });

  const firstName = session?.user?.name.split(" ")[0] ?? "";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const metrics = query.data?.metrics;

  return (
    <div className="dashboard-page">
      <PageHeader
        eyebrow={formatLongDate(new Date())}
        title={`${greeting}, ${firstName}.`}
        description="Aqui está um resumo cuidadoso do seu dia."
        action={
          <Button icon={<CalendarPlus size={18} />} onClick={() => navigate("/agenda?new=1")}>
            Nova consulta
          </Button>
        }
      />

      {query.isError ? (
        <div className="form-error">Não foi possível carregar o resumo. Atualize a página para tentar novamente.</div>
      ) : null}

      <section className="metric-grid" aria-label="Resumo da agenda">
        <article className="metric-card metric-card--mint">
          <span className="metric-card__icon"><CalendarCheck2 size={22} /></span>
          <div>
            <small>Consultas hoje</small>
            <strong>{metrics?.today ?? "—"}</strong>
            <p>{metrics?.today === 1 ? "atendimento agendado" : "atendimentos agendados"}</p>
          </div>
        </article>
        <article className="metric-card metric-card--blue">
          <span className="metric-card__icon"><Clock3 size={22} /></span>
          <div>
            <small>Próximos 7 dias</small>
            <strong>{metrics?.nextSevenDays ?? "—"}</strong>
            <p>consultas a confirmar</p>
          </div>
        </article>
        <article className="metric-card metric-card--sand">
          <span className="metric-card__icon"><Users size={22} /></span>
          <div>
            <small>Pacientes ativos</small>
            <strong>{metrics?.activePatients ?? "—"}</strong>
            <p>cadastros em cuidado</p>
          </div>
        </article>
      </section>

      <div className="dashboard-grid">
        <section className="panel panel--next">
          <div className="panel__heading">
            <div>
              <span className="eyebrow">Acompanhe</span>
              <h2>Próximo atendimento</h2>
            </div>
            <Sparkles size={20} className="panel__heading-icon" />
          </div>

          {query.isLoading ? (
            <div className="skeleton skeleton--large" />
          ) : query.data?.nextAppointment ? (
            <div className="next-appointment">
              <div className="next-appointment__time">
                <strong>{formatTime(query.data.nextAppointment.startsAt)}</strong>
                <span>{capitalize(formatLongDate(query.data.nextAppointment.startsAt).split(",")[0] ?? "")}</span>
              </div>
              <div className="next-appointment__body">
                <span className="next-appointment__patient">{query.data.nextAppointment.patient.name}</span>
                <p>{query.data.nextAppointment.type}</p>
                <div className="appointment-meta">
                  <span>
                    {query.data.nextAppointment.modality === "video" ? <Video size={15} /> : <MapPin size={15} />}
                    {query.data.nextAppointment.modality === "video" ? "Videochamada" : "Presencial"}
                  </span>
                  <StatusBadge status={query.data.nextAppointment.status} />
                </div>
              </div>
              <Button
                variant="ghost"
                size="small"
                onClick={() => navigate("/agenda")}
                aria-label="Abrir agenda"
              >
                <ArrowRight size={19} />
              </Button>
            </div>
          ) : (
            <EmptyState
              title="Sua agenda está livre"
              description="Quando o próximo atendimento for criado, ele aparecerá aqui."
            />
          )}
        </section>

        <section className="panel panel--care-note">
          <span className="care-note__icon"><Sparkles size={21} /></span>
          <h2>Um dia com mais presença</h2>
          <p>
            Reserve alguns minutos entre os atendimentos para registrar anotações e respirar.
            A agenda acompanha o tempo; você cuida das pessoas.
          </p>
          <div className="care-note__line" />
          <small>Agende com intention.</small>
        </section>
      </div>

      <section className="panel today-panel">
        <div className="panel__heading">
          <div>
            <span className="eyebrow">Sua rotina</span>
            <h2>Consultas de hoje</h2>
          </div>
          <Button variant="ghost" size="small" onClick={() => navigate("/agenda")}>
            Ver agenda <ArrowRight size={16} />
          </Button>
        </div>

        {query.isLoading ? (
          <div className="skeleton" />
        ) : query.data?.todayAppointments.length ? (
          <div className="appointment-list">
            {query.data.todayAppointments.map((appointment) => (
              <button
                type="button"
                className="appointment-row"
                key={appointment.id}
                onClick={() => navigate(`/agenda?appointment=${appointment.id}`)}
              >
                <span className="appointment-row__time">{formatTime(appointment.startsAt)}</span>
                <span className="appointment-row__line" />
                <span className="appointment-row__main">
                  <strong>{appointment.patient.name}</strong>
                  <small>{appointment.type}</small>
                </span>
                <span className="appointment-row__place">
                  {appointment.modality === "video" ? <Video size={15} /> : <MapPin size={15} />}
                  {appointment.modality === "video" ? "Vídeo" : "Presencial"}
                </span>
                <StatusBadge status={appointment.status} />
              </button>
            ))}
          </div>
        ) : (
          <EmptyState
            title="Nenhuma consulta hoje"
            description="Aproveite o momento ou abra a agenda para planejar os próximos atendimentos."
            action={<Button variant="secondary" onClick={() => navigate("/agenda?new=1")}>Agendar atendimento</Button>}
          />
        )}
      </section>
    </div>
  );
};
