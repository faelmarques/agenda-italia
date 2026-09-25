import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import {
  ArrowLeft,
  CircleAlert,
  FileText,
  NotebookPen,
  Pencil,
  Plus,
  ScrollText,
  Trash2,
} from "lucide-react";
import { AnamnesisForm } from "../components/AnamnesisForm";
import { SessionNoteDialog } from "../components/SessionNoteDialog";
import { useToast } from "../components/Toast";
import { Button, EmptyState, PageHeader } from "../components/ui";
import { sessionNoteFields, type SessionNoteContent } from "../../shared/clinical";
import { api, toQueryString } from "../lib/api";
import { formatDateOnly, formatDateTime, formatLongDateOnly, formatTime } from "../lib/date";
import type {
  ClinicalTemplate,
  Patient,
  SessionNote,
  SessionNotesResponse,
} from "../types";

type RecordTab = "evolucao" | "anamnese" | "modelos";

interface NoteDialogState {
  note?: SessionNote | null;
  appointmentId?: string | null;
  appointmentStartsAt?: string | null;
  presetContent?: SessionNoteContent | null;
  templateId?: string | null;
}

const tabs: Array<{ id: RecordTab; label: string }> = [
  { id: "evolucao", label: "Evolução" },
  { id: "anamnese", label: "Anamnese" },
  { id: "modelos", label: "Modelos" },
];

export const PatientRecordPage = () => {
  const { patientId = "" } = useParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<RecordTab>("evolucao");
  const [page, setPage] = useState(1);
  const [noteDialog, setNoteDialog] = useState<NoteDialogState | null>(null);

  const patientQuery = useQuery({
    queryKey: ["patients", "detail", patientId],
    queryFn: () => api<{ patient: Patient }>(`/api/patients/${patientId}`),
    enabled: Boolean(patientId),
  });

  const notesQuery = useQuery({
    queryKey: ["session-notes", patientId, page],
    queryFn: () =>
      api<SessionNotesResponse>(
        `/api/session-notes${toQueryString({ patientId, page, limit: 10 })}`,
      ),
    enabled: Boolean(patientId) && tab === "evolucao",
  });

  const templatesQuery = useQuery({
    queryKey: ["clinical-templates"],
    queryFn: () => api<{ items: ClinicalTemplate[] }>("/api/clinical-templates"),
    enabled: tab === "modelos",
  });

  const deleteMutation = useMutation({
    mutationFn: (note: SessionNote) =>
      api<void>(`/api/session-notes/${note.id}`, { method: "DELETE" }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["session-notes", patientId] });
      await queryClient.invalidateQueries({ queryKey: ["consultations"] });
      toast({ type: "success", message: "Evolução excluída." });
    },
    onError: (error: Error) => toast({ type: "error", message: error.message }),
  });

  const patient = patientQuery.data?.patient;
  const notes = notesQuery.data?.items ?? [];
  const pagination = notesQuery.data?.pagination;

  if (patientQuery.isLoading) {
    return <div className="skeleton skeleton--large" />;
  }

  if (!patient) {
    return (
      <div className="record-page">
        <EmptyState
          title="Paciente não encontrado"
          description="O cadastro pode ter sido removido. Volte para o prontuário e escolha outro paciente."
          action={
            <Link className="button button--primary button--medium" to="/prontuario">
              <ArrowLeft size={18} /> Voltar ao prontuário
            </Link>
          }
        />
      </div>
    );
  }

  const deleteNote = (note: SessionNote) => {
    if (window.confirm("Excluir esta evolução? Esta ação não pode ser desfeita.")) {
      deleteMutation.mutate(note);
    }
  };

  return (
    <div className="record-page">
      <PageHeader
        eyebrow="Prontuário"
        title={patient.name}
        description={[
          patient.birthDate ? `Nasc. ${formatDateOnly(patient.birthDate)}` : null,
          patient.phone,
          patient.email,
          patient.active ? null : "Cadastro arquivado",
        ]
          .filter(Boolean)
          .join(" · ")}
        action={
          <div className="page-header__actions">
            <Link className="button button--secondary button--medium" to="/prontuario">
              <ArrowLeft size={18} /> Prontuário
            </Link>
            <Button
              icon={<Plus size={18} />}
              onClick={() => setNoteDialog({})}
            >
              Nova evolução
            </Button>
          </div>
        }
      />

      <div className="record-tabs" role="tablist" aria-label="Seções do prontuário">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={clsx("record-tab", tab === item.id && "record-tab--active")}
            onClick={() => {
              setTab(item.id);
              setPage(1);
            }}
          >
            {item.id === "evolucao" ? <ScrollText size={17} /> : null}
            {item.id === "anamnese" ? <FileText size={17} /> : null}
            {item.id === "modelos" ? <NotebookPen size={17} /> : null}
            {item.label}
          </button>
        ))}
      </div>

      {tab === "anamnese" ? (
        <AnamnesisForm patientId={patient.id} />
      ) : null}

      {tab === "modelos" ? (
        <section className="panel record-panel">
          <div className="panel__heading">
            <div className="panel__heading-main">
              <span className="panel__heading-icon"><FileText size={18} /></span>
              <div>
                <h2>Modelos de evolução</h2>
                <p>Estruturas prontas para agilizar o registro das sessões.</p>
              </div>
            </div>
          </div>

          {templatesQuery.isLoading ? (
            <div className="skeleton skeleton--large" />
          ) : (templatesQuery.data?.items.length ?? 0) ? (
            <div className="template-grid">
              {templatesQuery.data?.items.map((template) => (
                <article className="template-card" key={template.id}>
                  <header className="template-card__header">
                    <span className="pill pill--soft">{template.category}</span>
                    <h3>{template.name}</h3>
                    <p>{template.description}</p>
                  </header>
                  <ul className="template-card__list">
                    {sessionNoteFields.map((field) => (
                      <li key={field.key}>
                        <strong>{field.label}</strong>
                        <span>{template.content[field.key]}</span>
                      </li>
                    ))}
                  </ul>
                  <footer className="template-card__footer">
                    <Button
                      variant="secondary"
                      size="small"
                      icon={<NotebookPen size={16} />}
                      onClick={() =>
                        setNoteDialog({
                          presetContent: template.content,
                          templateId: template.id,
                        })
                      }
                    >
                      Usar modelo
                    </Button>
                  </footer>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Nenhum modelo disponível"
              description="Os modelos de evolução são carregados automaticamente com o sistema."
            />
          )}
        </section>
      ) : null}

      {tab === "evolucao" ? (
        <section className="panel record-panel">
          <div className="panel__heading">
            <div className="panel__heading-main">
              <span className="panel__heading-icon"><ScrollText size={18} /></span>
              <div>
                <h2>Histórico de evolução</h2>
                <p>Registros clínicos das sessões deste paciente.</p>
              </div>
            </div>
            <Button
              variant="secondary"
              size="small"
              icon={<Plus size={16} />}
              onClick={() => setNoteDialog({})}
            >
              Nova evolução
            </Button>
          </div>

          {notesQuery.isLoading ? (
            <div className="skeleton skeleton--large" />
          ) : notes.length ? (
            <>
              <div className="note-timeline">
                {notes.map((note) => (
                  <article className="note-card" key={note.id}>
                    <header className="note-card__header">
                      <div>
                        <time dateTime={note.sessionDate}>
                          {formatLongDateOnly(note.sessionDate)}
                        </time>
                        <span className="muted">
                          {note.appointmentStartsAt
                            ? `Sessão às ${formatTime(note.appointmentStartsAt)}`
                            : "Registro avulso"}
                        </span>
                      </div>
                      <div className="table-actions">
                        {note.riskAlert ? (
                          <span className="pill pill--danger" title="Alerta de risco">
                            <CircleAlert size={14} /> Risco
                          </span>
                        ) : null}
                        <button
                          className="icon-button"
                          type="button"
                          aria-label="Editar evolução"
                          title="Editar"
                          onClick={() => setNoteDialog({ note })}
                        >
                          <Pencil size={17} />
                        </button>
                        <button
                          className="icon-button"
                          type="button"
                          aria-label="Excluir evolução"
                          title="Excluir"
                          onClick={() => deleteNote(note)}
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>
                    </header>

                    <dl className="note-card__body">
                      {sessionNoteFields
                        .filter((field) => note.content[field.key].trim().length > 0)
                        .map((field) => (
                          <div key={field.key}>
                            <dt>{field.label}</dt>
                            <dd>{note.content[field.key]}</dd>
                          </div>
                        ))}
                    </dl>
                    <footer className="note-card__footer">
                      Registrada em {formatDateTime(note.createdAt)}
                    </footer>
                  </article>
                ))}
              </div>

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
            </>
          ) : (
            <EmptyState
              title="Nenhuma evolução registrada"
              description="Registre a primeira sessão para começar o histórico clínico deste paciente."
              action={
                <Button icon={<Plus size={17} />} onClick={() => setNoteDialog({})}>
                  Registrar evolução
                </Button>
              }
            />
          )}
        </section>
      ) : null}

      <SessionNoteDialog
        open={Boolean(noteDialog)}
        onClose={() => setNoteDialog(null)}
        patientId={patient.id}
        note={noteDialog?.note ?? null}
        appointmentId={noteDialog?.appointmentId ?? null}
        appointmentStartsAt={noteDialog?.appointmentStartsAt ?? null}
        presetContent={noteDialog?.presetContent ?? null}
        templateId={noteDialog?.templateId ?? null}
      />
    </div>
  );
};
