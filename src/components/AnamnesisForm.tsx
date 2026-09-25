import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Circle, Save } from "lucide-react";
import {
  anamnesisSections,
  emptyAnamnesisContent,
  type AnamnesisContent,
  type AnamnesisFieldKey,
  type AnamnesisStatus,
} from "../../shared/clinical";
import { api } from "../lib/api";
import { formatDateTime } from "../lib/date";
import type { Anamnesis } from "../types";
import { useToast } from "./Toast";
import { Button, FormError, FormField, Textarea } from "./ui";

export const AnamnesisForm = ({ patientId }: { patientId: string }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState<AnamnesisStatus>("draft");
  const [form, setForm] = useState<AnamnesisContent>(emptyAnamnesisContent());
  const [syncedKey, setSyncedKey] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["anamnesis", patientId],
    queryFn: () => api<{ anamnesis: Anamnesis | null }>(`/api/anamnesis/${patientId}`),
  });

  const anamnesis = query.data?.anamnesis ?? null;
  const syncKey = anamnesis ? anamnesis.updatedAt : "empty";

  if (!dirty && query.data && syncedKey !== syncKey) {
    setSyncedKey(syncKey);
    setForm(anamnesis?.content ?? emptyAnamnesisContent());
    setStatus(anamnesis?.status ?? "draft");
  }

  const mutation = useMutation({
    mutationFn: (nextStatus: AnamnesisStatus) =>
      api<{ anamnesis: Anamnesis }>(`/api/anamnesis/${patientId}`, {
        method: "PUT",
        body: JSON.stringify({ status: nextStatus, content: form }),
      }),
    onSuccess: async (data, nextStatus) => {
      setDirty(false);
      setStatus(data.anamnesis.status);
      await queryClient.invalidateQueries({ queryKey: ["anamnesis", patientId] });
      toast({
        type: "success",
        message: nextStatus === "completed"
          ? "Anamnese concluída."
          : "Rascunho da anamnese salvo.",
      });
    },
    onError: (caughtError: Error) => setError(caughtError.message),
  });

  const setContent = (key: AnamnesisFieldKey, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setDirty(true);
  };

  if (query.isLoading) {
    return <div className="skeleton skeleton--large" />;
  }

  return (
    <div className="anamnesis">
      <div className="anamnesis__status">
        <span className={status === "completed" ? "pill pill--success" : "pill"}>
          {status === "completed" ? (
            <>
              <CheckCircle2 size={14} aria-hidden="true" /> Concluída
            </>
          ) : (
            <>
              <Circle size={14} aria-hidden="true" /> Rascunho
            </>
          )}
        </span>
        <span className="muted">
          {anamnesis
            ? `Atualizada em ${formatDateTime(anamnesis.updatedAt)}`
            : "Nenhuma anamnese registrada ainda."}
        </span>
        {dirty ? <span className="anamnesis__dirty">Alterações não salvas</span> : null}
      </div>

      <form
        className="anamnesis__form"
        onSubmit={(event) => {
          event.preventDefault();
          setError("");
          mutation.mutate("draft");
        }}
      >
        <FormError>{error}</FormError>

        {anamnesisSections.map((section, index) => (
          <section className="clinical-section" key={section.id} id={`anamnesis-${section.id}`}>
            <header className="clinical-section__header">
              <span className="clinical-section__index">{index + 1}</span>
              <div>
                <h3>{section.title}</h3>
                <p>{section.description}</p>
              </div>
            </header>

            <div className="clinical-section__grid">
              {section.fields.map((field) => (
                <FormField
                  key={field.key}
                  label={field.label}
                  htmlFor={`anamnesis-${field.key}`}
                  hint={field.hint}
                >
                  <Textarea
                    id={`anamnesis-${field.key}`}
                    value={form[field.key]}
                    onChange={(event) => setContent(field.key, event.target.value)}
                    rows={field.rows ?? 3}
                    maxLength={8000}
                  />
                </FormField>
              ))}
            </div>
          </section>
        ))}

        <div className="privacy-note">
          <strong>Documentação clínica</strong>
          <p>
            Este conteúdo compõe o prontuário do paciente e deve seguir o sigilo profissional.
            Revise antes de marcar como concluída.
          </p>
        </div>

        <div className="form-actions form-actions--spread">
          <Button
            type="button"
            variant="secondary"
            loading={mutation.isPending && mutation.variables === "draft"}
            onClick={() => {
              setError("");
              mutation.mutate("draft");
            }}
          >
            <Save size={18} /> Salvar rascunho
          </Button>
          <Button
            type="button"
            loading={mutation.isPending && mutation.variables === "completed"}
            icon={<CheckCircle2 size={18} />}
            onClick={() => {
              setError("");
              mutation.mutate("completed");
            }}
          >
            Salvar e concluir
          </Button>
        </div>
      </form>
    </div>
  );
};
