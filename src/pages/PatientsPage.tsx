import { useDeferredValue, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  ArchiveRestore,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Mail,
  MessageCircle,
  Pencil,
  Search,
  UserPlus,
} from "lucide-react";
import { api, toQueryString } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/Toast";
import { whatsappUrl } from "../lib/whatsapp";
import type { Patient, PatientsResponse } from "../types";
import { PatientDialog } from "../components/PatientDialog";
import { Button, EmptyState, PageHeader } from "../components/ui";

type PatientFilter = "active" | "inactive" | "all";

export const PatientsPage = () => {
  const { session } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [filter, setFilter] = useState<PatientFilter>("active");
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Patient | null>(null);

  const query = useQuery({
    queryKey: ["patients", "list", deferredSearch, filter, page],
    queryFn: () => api<PatientsResponse>(
      `/api/patients${toQueryString({ search: deferredSearch, status: filter, page, limit: 20 })}`,
    ),
  });

  const archiveMutation = useMutation({
    mutationFn: ({ patient, restore }: { patient: Patient; restore: boolean }) =>
      api<{ patient: Patient } | void>(
        restore ? `/api/patients/${patient.id}/restore` : `/api/patients/${patient.id}`,
        { method: restore ? "POST" : "DELETE" },
      ),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["patients"] });
      toast({
        type: "success",
        message: variables.restore ? "Paciente reativado." : "Paciente arquivado.",
      });
    },
    onError: (error: Error) => toast({ type: "error", message: error.message }),
  });

  const patients = query.data?.items ?? [];
  const pagination = query.data?.pagination;

  const setStatus = (nextStatus: PatientFilter) => {
    setFilter(nextStatus);
    setPage(1);
  };

  const archivePatient = (patient: Patient) => {
    const restore = !patient.active;
    if (!restore && !window.confirm(`Arquivar o cadastro de ${patient.name}? O histórico será preservado.`)) {
      return;
    }
    archiveMutation.mutate({ patient, restore });
  };

  const contactPatient = (patient: Patient) => {
    const message = `Olá, ${patient.name}! Tudo bem? Gostaria de entrar em contato para falar sobre seus próximos atendimentos.${session?.user?.name ? `\n\nAtenciosamente,\n${session.user.name}` : ""}`;
    if (patient.phone) {
      window.open(whatsappUrl(patient.phone, message), "_blank", "noopener,noreferrer");
    } else if (patient.email) {
      const mailto = `mailto:${patient.email}?subject=${encodeURIComponent("Agenda de atendimento")}&body=${encodeURIComponent(message)}`;
      window.open(mailto, "_self");
    }
  };

  return (
    <div className="patients-page">
      <PageHeader
        eyebrow="Relacionamento"
        title="Pacientes"
        description="Mantenha os dados de contato organizados e cuidar das confirmações."
        action={
          <Button
            icon={<UserPlus size={18} />}
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            Novo paciente
          </Button>
        }
      />

      <section className="panel patients-panel">
        <div className="patients-toolbar">
          <label className="search-field">
            <Search size={18} aria-hidden="true" />
            <span className="sr-only">Buscar pacientes</span>
            <input
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Buscar por nome, telefone ou e-mail"
            />
          </label>
          <div className="filter-tabs" role="group" aria-label="Filtrar pacientes">
            {(["active", "inactive", "all"] as PatientFilter[]).map((value) => (
              <button
                type="button"
                className={filter === value ? "is-active" : ""}
                key={value}
                onClick={() => setStatus(value)}
              >
                {value === "active" ? "Ativos" : value === "inactive" ? "Arquivados" : "Todos"}
              </button>
            ))}
          </div>
        </div>

        {query.isLoading ? (
          <div className="skeleton skeleton--large" />
        ) : patients.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Paciente</th>
                  <th>Contato</th>
                  <th>Próximos</th>
                  <th>Status</th>
                  <th><span className="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody>
                {patients.map((patient) => (
                  <tr key={patient.id} className={!patient.active ? "data-table__inactive" : ""}>
                    <td>
                      <div className="patient-cell">
                        <span className="avatar avatar--soft">{patient.name.slice(0, 2).toUpperCase()}</span>
                        <span>
                          <strong>{patient.name}</strong>
                          <small>{patient.birthDate ? `Nasc. ${formatBirthDate(patient.birthDate)}` : "Dados cadastrais"}</small>
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="contact-cell">
                        {patient.phone ? <span><MessageCircle size={14} /> {patient.phone}</span> : null}
                        {patient.email ? <span><Mail size={14} /> {patient.email}</span> : null}
                        {!patient.phone && !patient.email ? <span className="muted">Não informado</span> : null}
                      </div>
                    </td>
                    <td>
                      <strong>{patient.upcomingAppointments}</strong>
                      <span className="table-subtext"> agendada{patient.upcomingAppointments === 1 ? "" : "s"}</span>
                    </td>
                    <td>
                      <span className={patient.active ? "pill pill--success" : "pill"}>
                        {patient.active ? "Ativo" : "Arquivado"}
                      </span>
                    </td>
                    <td>
                      <div className="table-actions">
                        <Link
                          className="icon-button"
                          to={`/prontuario/${patient.id}`}
                          aria-label={`Abrir prontuário de ${patient.name}`}
                          title="Prontuário"
                        >
                          <ClipboardList size={17} />
                        </Link>
                        {(patient.phone || patient.email) ? (
                          <button
                            className="icon-button"
                            type="button"
                            aria-label={`Entrar em contato com ${patient.name}`}
                            title="Entrar em contato"
                            onClick={() => contactPatient(patient)}
                          >
                            <MessageCircle size={17} />
                          </button>
                        ) : null}
                        <button
                          className="icon-button"
                          type="button"
                          aria-label={`Editar ${patient.name}`}
                          title="Editar"
                          onClick={() => {
                            setEditing(patient);
                            setDialogOpen(true);
                          }}
                        >
                          <Pencil size={17} />
                        </button>
                        <button
                          className="icon-button"
                          type="button"
                          aria-label={`${patient.active ? "Arquivar" : "Reativar"} ${patient.name}`}
                          title={patient.active ? "Arquivar" : "Reativar"}
                          onClick={() => archivePatient(patient)}
                        >
                          {patient.active ? <Archive size={17} /> : <ArchiveRestore size={17} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title={deferredSearch ? "Nenhum paciente encontrado" : "Sua lista está vazia"}
            description={deferredSearch
              ? "Tente buscar por outro nome ou informação de contato."
              : "Cadastre um paciente para começar a organizar os atendimentos."}
            action={!deferredSearch ? (
              <Button icon={<UserPlus size={17} />} onClick={() => setDialogOpen(true)}>
                Cadastrar paciente
              </Button>
            ) : undefined}
          />
        )}

        {pagination && pagination.pages > 1 ? (
          <footer className="pagination">
            <span>Página {pagination.page} de {pagination.pages}</span>
            <div>
              <Button
                variant="secondary"
                size="small"
                disabled={page <= 1}
                onClick={() => setPage((value) => value - 1)}
              >
                <ChevronLeft size={17} /> Anterior
              </Button>
              <Button
                variant="secondary"
                size="small"
                disabled={page >= pagination.pages}
                onClick={() => setPage((value) => value + 1)}
              >
                Próxima <ChevronRight size={17} />
              </Button>
            </div>
          </footer>
        ) : null}
      </section>

      <PatientDialog
        open={dialogOpen}
        patient={editing}
        onClose={() => {
          setDialogOpen(false);
          setEditing(null);
        }}
      />
    </div>
  );
};

const formatBirthDate = (value: string): string => {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
};
