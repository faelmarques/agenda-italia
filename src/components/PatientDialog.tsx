import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Save, UserPlus } from "lucide-react";
import { api } from "../lib/api";
import type { Patient } from "../types";
import { useToast } from "./Toast";
import {
  Button,
  Checkbox,
  FormError,
  FormField,
  Input,
  Modal,
  Textarea,
} from "./ui";

interface PatientDialogProps {
  open: boolean;
  onClose: () => void;
  patient?: Patient | null;
}

interface PatientForm {
  name: string;
  birthDate: string;
  phone: string;
  email: string;
  notes: string;
  notificationConsent: boolean;
}

const createInitialForm = (patient?: Patient | null): PatientForm => ({
  name: patient?.name ?? "",
  birthDate: patient?.birthDate ?? "",
  phone: patient?.phone ?? "",
  email: patient?.email ?? "",
  notes: patient?.notes ?? "",
  notificationConsent: patient?.notificationConsent ?? false,
});

export const PatientDialog = ({ open, onClose, patient }: PatientDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<PatientForm>(createInitialForm(patient));
  const [formKey, setFormKey] = useState(patient?.id ?? "new");
  const [error, setError] = useState("");

  const key = patient?.id ?? "new";
  if (open && formKey !== key) {
    setFormKey(key);
    setForm(createInitialForm(patient));
    setError("");
  }

  const mutation = useMutation({
    mutationFn: () => {
      const body = {
        name: form.name,
        birthDate: form.birthDate || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        notes: form.notes.trim() || null,
        notificationConsent: form.notificationConsent,
      };
      return api<{ patient: Patient }>(patient ? `/api/patients/${patient.id}` : "/api/patients", {
        method: patient ? "PUT" : "POST",
        body: JSON.stringify(body),
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["patients"] }),
        queryClient.invalidateQueries({ queryKey: ["appointments"] }),
      ]);
      toast({ type: "success", message: patient ? "Cadastro atualizado." : "Paciente cadastrado." });
      onClose();
    },
    onError: (caughtError: Error) => setError(caughtError.message),
  });

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (form.name.trim().length < 2) {
      setError("Informe o nome do paciente.");
      return;
    }
    mutation.mutate();
  };

  const update = <Key extends keyof PatientForm>(key: Key, value: PatientForm[Key]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={patient ? "Editar paciente" : "Novo paciente"}
      description={patient ? "Atualize os dados de contato e preferências." : "Cadastre os dados necessários para os atendimentos."}
      size="large"
    >
      <form className="form-stack" onSubmit={handleSubmit}>
        <FormError>{error}</FormError>
        <div className="form-grid form-grid--two">
          <FormField label="Nome completo" htmlFor="patient-name" required>
            <Input
              id="patient-name"
              value={form.name}
              onChange={(event) => update("name", event.target.value)}
              maxLength={150}
              autoComplete="name"
              required
            />
          </FormField>
          <FormField label="Data de nascimento" htmlFor="patient-birth-date">
            <Input
              id="patient-birth-date"
              type="date"
              value={form.birthDate}
              onChange={(event) => update("birthDate", event.target.value)}
            />
          </FormField>
        </div>

        <div className="form-grid form-grid--two">
          <FormField label="Telefone / WhatsApp" htmlFor="patient-phone">
            <Input
              id="patient-phone"
              type="tel"
              value={form.phone}
              onChange={(event) => update("phone", event.target.value)}
              maxLength={30}
              autoComplete="tel"
              placeholder="(11) 99999-9999"
            />
          </FormField>
          <FormField label="E-mail" htmlFor="patient-email">
            <Input
              id="patient-email"
              type="email"
              value={form.email}
              onChange={(event) => update("email", event.target.value)}
              maxLength={200}
              autoComplete="email"
              placeholder="paciente@exemplo.com"
            />
          </FormField>
        </div>

        <FormField
          label="Observações administrativas"
          htmlFor="patient-notes"
          hint="Não registre diagnóstico, evolução clínica ou informações sensíveis sem necessidade."
        >
          <Textarea
            id="patient-notes"
            value={form.notes}
            onChange={(event) => update("notes", event.target.value)}
            rows={3}
            maxLength={2000}
          />
        </FormField>

        <Checkbox
          label="Autorizo lembretes automáticos por e-mail"
          description=" Necessário para confirmações automáticas. A autorização pode ser removida a qualquer momento."
          checked={form.notificationConsent}
          disabled={!form.email.trim()}
          onChange={(event) => update("notificationConsent", event.target.checked)}
        />

        <div className="privacy-note">
          <strong>Privacidade</strong>
          <p>Este cadastro contém dados pessoais. Use um computador protegido e não compartilhe a senha.</p>
        </div>

        <div className="form-actions">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={mutation.isPending} icon={patient ? <Save size={18} /> : <UserPlus size={18} />}>
            {patient ? "Salvar alterações" : "Cadastrar paciente"}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
