import { useDeferredValue, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ClipboardList, NotebookPen, Search, Video, MapPin } from "lucide-react";
import { SessionNoteDialog } from "../components/SessionNoteDialog";
import { Button, EmptyState, PageHeader, StatusBadge } from "../components/ui";
import { api, toQueryString } from "../lib/api";
import { formatDateOnly, formatTime } from "../lib/date";
import type { ConsultationsResponse } from "../types";

type StatusFilter = "all" | "pending" | "completed" | "cancelled" | "no_show";
type NoteFilter = "all" | "yes" | "no";

const statusTabs: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "Todas" },
  { value: "pending", label: "Agendadas" },
  { value: "completed", label: "Realizadas" },
  { value: "cancelled", label: "Canceladas" },
  { value: "no_show", label: "Faltas" },
];

interface DialogState {
  appointmentId: string;
  patientId: string;
  startsAt: string;
}

export const ConsultationsPage = () => {
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [hasNote, setHasNote] = useState<NoteFilter>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<DialogState | null>(null);

  const query = useQuery({
    queryKey: ["consultations", deferredSearch, status, hasNote, from, to, page],
    queryFn: () =>
      api<ConsultationsResponse>(
        `/api/consultations${toQueryString({
          search: deferredSearch,
          status,
          hasNote,
          page,
          limit: 20,
          from: from ? new Date(`${from}T00:00:00`).toISOString() : undefined,
          to: to ? new Date(`${to}T23:59:59.999`).toISOString() : undefined,
        })}`,
      ),
  });

  const consultations = query.data?.items ?? [];
  const pagination = query.data?.pagination;

  const setStatusFilter = (value: StatusFilter) => {
    setStatus(value);
    setPage(1);
  };

  const hasActiveFilters = Boolean(deferredSearch || from || to || hasNote !== "all");

  return (
    <div className="consultations-page">
      <PageHeader
        eyebrow="Documentação"
        title="Consultas"
        description="Histórico de atendimentos e a evolução clínica registrada em cada sessão."
      />

      <section className="panel patients-panel">
        <div className="patients-toolbar">
          <label className="search-field">
            <Search size={18} aria-hidden="true" />
            <span className="sr-only">Buscar consultas</span>
            <input
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Buscar por nome ou telefone do paciente"
            />
          </label>
          <div className="filter-tabs" role="group" aria-label="Filtrar consultas">
            {statusTabs.map((tab) => (
              <button
                key={tab.value}
                type="button"
                className={status === tab.value ? "is-active" : ""}
                onClick={() => setStatusFilter(tab.value)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="consultation-filters">
          <label className="consultation-filters__field">
            <span>De</span>
            <input
              type="date"
              value={from}
              onChange={(event) => {
                setFrom(event.target.value);
                setPage(1);
              }}
            />
          </label>
          <label className="consultation-filters__field">
            <span>Até</span>
            <input
              type="date"
              value={to}
              onChange={(event) => {
                setTo(event.target.value);
                setPage(1);
              }}
            />
          </label>
          <label className="consultation-filters__field">
            <span>Evolução</span>
            <select
              className="input select"
              value={hasNote}
              onChange={(event) => {
                setHasNote(event.target.value as NoteFilter);
                setPage(1);
              }}
            >
              <option value="all">Todas</option>
              <option value="yes">Com registro</option>
              <option value="no">Sem registro</option>
            </select>
          </label>
          {hasActiveFilters ? (
            <button
              type="button"
              className="consultation-filters__clear"
              onClick={() => {
                setSearch("");
                setFrom("");
                setTo("");
                setHasNote("all");
                setPage(1);
              }}
            >
              Limpar filtros
            </button>
          ) : null}
        </div>

        {query.isLoading ? (
          <div className="skeleton skeleton--large" />
        ) : consultations.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Paciente</th>
                  <th>Atendimento</th>
                  <th>Status</th>
                  <th>Evolução</th>
                  <th><span className="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody>
                {consultations.map((consultation) => (
                  <tr key={consultation.id}>
                    <td>
                      <strong>{formatDateOnly(consultation.startsAt)}</strong>
                      <span className="table-subtext"> {formatTime(consultation.startsAt)}</span>
                    </td>
                    <td>
                      <div className="patient-cell">
                        <span className="avatar avatar--soft">
                          {consultation.patient.name.slice(0, 2).toUpperCase()}
                        </span>
                        <span>
                          <strong>{consultation.patient.name}</strong>
                          <small>
                            {consultation.patient.phone ?? consultation.patient.email ?? "Sem contato"}
                          </small>
                        </span>
                      </div>
                    </td>
                    <td>
                      <strong>{consultation.type}</strong>
                      <span className="table-subtext consultation-modality">
                        {consultation.modality === "video" ? <Video size={13} /> : <MapPin size={13} />}
                        {consultation.modality === "video" ? "Online" : "Presencial"}
                      </span>
                    </td>
                    <td>
                      <StatusBadge status={consultation.status} />
                    </td>
                    <td>
                      {consultation.noteId ? (
                        <span className="pill pill--success">
                          {consultation.noteSessionDate
                            ? formatDateOnly(consultation.noteSessionDate)
                            : "Registrada"}
                        </span>
                      ) : (
                        <span className="pill">Pendente</span>
                      )}
                    </td>
                    <td>
                      <div className="table-actions">
                        <button
                          className="icon-button"
                          type="button"
                          aria-label={
                            consultation.noteId
                              ? `Editar evolução de ${consultation.patient.name}`
                              : `Registrar evolução de ${consultation.patient.name}`
                          }
                          title={consultation.noteId ? "Editar evolução" : "Registrar evolução"}
                          onClick={() =>
                            setDialog({
                              appointmentId: consultation.id,
                              patientId: consultation.patient.id,
                              startsAt: consultation.startsAt,
                            })
                          }
                        >
                          <NotebookPen size={17} />
                        </button>
                        <Link
                          className="icon-button"
                          to={`/prontuario/${consultation.patient.id}`}
                          aria-label={`Abrir prontuário de ${consultation.patient.name}`}
                          title="Abrir prontuário"
                        >
                          <ClipboardList size={17} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="Nenhuma consulta encontrada"
            description={
              hasActiveFilters
                ? "Ajuste os filtros ou o período para encontrar registros."
                : "As consultas da agenda aparecem aqui conforme acontecem."
            }
          />
        )}

        {pagination && pagination.pages > 1 ? (
          <footer className="pagination">
            <span>
              Página {pagination.page} de {pagination.pages}
            </span>
            <div>
              <Button
                variant="secondary"
                size="small"
                disabled={page <= 1}
                onClick={() => setPage((value) => value - 1)}
              >
                Anterior
              </Button>
              <Button
                variant="secondary"
                size="small"
                disabled={page >= pagination.pages}
                onClick={() => setPage((value) => value + 1)}
              >
                Próxima
              </Button>
            </div>
          </footer>
        ) : null}
      </section>

      <SessionNoteDialog
        open={Boolean(dialog)}
        onClose={() => setDialog(null)}
        patientId={dialog?.patientId ?? ""}
        appointmentId={dialog?.appointmentId ?? null}
        appointmentStartsAt={dialog?.startsAt ?? null}
      />
    </div>
  );
};
