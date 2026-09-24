import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BellRing,
  Check,
  Clock3,
  Database,
  KeyRound,
  MailCheck,
  Save,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { api } from "../lib/api";
import type { SettingsData, User } from "../types";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/Toast";
import { Button, FormError, FormField, Input, PageHeader, Select } from "../components/ui";

export const SettingsPage = () => {
  const query = useQuery({
    queryKey: ["settings"],
    queryFn: () => api<SettingsData>("/api/settings"),
  });

  return (
    <div className="settings-page">
      <PageHeader
        eyebrow="Preferências"
        title="Configurações"
        description="Personalize a agenda, as notificações e a segurança da sua conta."
      />

      {query.isLoading ? <div className="skeleton skeleton--large" /> : null}
      {query.isError ? (
        <div className="form-error">Não foi possível carregar as configurações.</div>
      ) : null}
      {query.data ? (
        <div className="settings-grid">
          <ProfileSettings initialProfile={query.data.profile} />
          <PasswordSettings />
          <aside className="settings-aside">
            <article className="panel setting-status">
              <span className={query.data.emailNotifications.configured ? "is-ready" : "is-pending"}>
                {query.data.emailNotifications.configured ? <MailCheck size={22} /> : <BellRing size={22} />}
              </span>
              <div>
                <h2>Confirmações por e-mail</h2>
                <p>
                  {query.data.emailNotifications.configured
                    ? "O serviço SMTP está pronto. Confirmações e lembretes podem ser enviados."
                    : "O SMTP ainda não foi configurado. A agenda continua funcionando normalmente."}
                </p>
              </div>
              <small>
                {query.data.emailNotifications.configured
                  ? "Configuração ativa"
                  : "Configure as variáveis SMTP no arquivo .env"}
              </small>
            </article>

            <article className="panel security-note">
              <ShieldCheck size={24} />
              <div>
                <h2>Dados sob seu controle</h2>
                <p>
                  O banco SQLite fica na pasta <code>data/</code> e não é enviado para o Git.
                  Faça cópias periódicas dessa pasta em um local seguro.
                </p>
              </div>
            </article>
          </aside>
        </div>
      ) : null}
    </div>
  );
};

interface ProfileForm {
  name: string;
  email: string;
  professionalTitle: string;
  registration: string;
  clinicName: string;
  defaultDurationMinutes: number;
  reminderHours: number;
  timezone: string;
}

const ProfileSettings = ({ initialProfile }: { initialProfile: User }) => {
  const { refresh } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ProfileForm>({
    name: initialProfile.name,
    email: initialProfile.email,
    professionalTitle: initialProfile.professionalTitle ?? "",
    registration: initialProfile.registration ?? "",
    clinicName: initialProfile.clinicName,
    defaultDurationMinutes: initialProfile.defaultDurationMinutes,
    reminderHours: initialProfile.reminderHours,
    timezone: initialProfile.timezone,
  });
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: () => api<{ profile: User }>("/api/settings/profile", {
      method: "PUT",
      body: JSON.stringify({
        ...form,
        professionalTitle: form.professionalTitle || null,
        registration: form.registration || null,
      }),
    }),
    onSuccess: async () => {
      await Promise.all([refresh(), queryClient.invalidateQueries({ queryKey: ["settings"] })]);
      toast({ type: "success", message: "Preferências salvas." });
    },
    onError: (caughtError: Error) => setError(caughtError.message),
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError("");
    mutation.mutate();
  };

  const update = <Key extends keyof ProfileForm>(key: Key, value: ProfileForm[Key]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  return (
    <section className="panel settings-form-panel">
      <div className="settings-section-title">
        <span><UserRound size={21} /></span>
        <div>
          <h2>Perfil profissional</h2>
          <p>Estas informações aparecem nos e-mails e lembretes.</p>
        </div>
      </div>

      <form className="form-stack" onSubmit={submit}>
        <FormError>{error}</FormError>
        <div className="form-grid form-grid--two">
          <FormField label="Seu nome" htmlFor="settings-name" required>
            <Input
              id="settings-name"
              value={form.name}
              onChange={(event) => update("name", event.target.value)}
              required
            />
          </FormField>
          <FormField label="E-mail de acesso" htmlFor="settings-email" required>
            <Input
              id="settings-email"
              type="email"
              value={form.email}
              onChange={(event) => update("email", event.target.value)}
              required
            />
          </FormField>
        </div>
        <div className="form-grid form-grid--two">
          <FormField label="Título profissional" htmlFor="settings-title" hint="Ex.: Psicóloga ou Psicólogo">
            <Input
              id="settings-title"
              value={form.professionalTitle}
              onChange={(event) => update("professionalTitle", event.target.value)}
              placeholder="Psicólogo(a)"
            />
          </FormField>
          <FormField label="Registro profissional" htmlFor="settings-registration" hint="Opcional">
            <Input
              id="settings-registration"
              value={form.registration}
              onChange={(event) => update("registration", event.target.value)}
              placeholder="CRP 00.000-00"
            />
          </FormField>
        </div>
        <FormField label="Nome da agenda" htmlFor="settings-clinic" required>
          <Input
            id="settings-clinic"
            value={form.clinicName}
            onChange={(event) => update("clinicName", event.target.value)}
            required
          />
        </FormField>

        <div className="settings-divider" />

        <div className="settings-section-title settings-section-title--small">
          <span><Clock3 size={19} /></span>
          <div>
            <h3>Preferências de agenda</h3>
            <p>Valores usados como sugestão e para lembretes.</p>
          </div>
        </div>
        <div className="form-grid form-grid--two">
          <FormField label="Duração padrão" htmlFor="settings-duration">
            <Select
              id="settings-duration"
              value={form.defaultDurationMinutes}
              onChange={(event) => update("defaultDurationMinutes", Number(event.target.value))}
            >
              {[30, 45, 50, 60, 75, 90, 120].map((minutes) => (
                <option value={minutes} key={minutes}>{minutes} minutos</option>
              ))}
            </Select>
          </FormField>
          <FormField label="Antecedência do lembrete" htmlFor="settings-reminder">
            <Select
              id="settings-reminder"
              value={form.reminderHours}
              onChange={(event) => update("reminderHours", Number(event.target.value))}
            >
              <option value={2}>2 horas antes</option>
              <option value={6}>6 horas antes</option>
              <option value={24}>24 horas antes</option>
              <option value={48}>48 horas antes</option>
              <option value={72}>3 dias antes</option>
            </Select>
          </FormField>
        </div>
        <FormField label="Fuso horário das mensagens" htmlFor="settings-timezone">
          <Input
            id="settings-timezone"
            value={form.timezone}
            onChange={(event) => update("timezone", event.target.value)}
            placeholder="America/Sao_Paulo"
          />
        </FormField>

        <div className="form-actions">
          <Button type="submit" icon={<Save size={18} />} loading={mutation.isPending}>
            Salvar preferências
          </Button>
        </div>
      </form>
    </section>
  );
};

const PasswordSettings = () => {
  const { toast } = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: () => api<void>("/api/settings/password", {
      method: "PUT",
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
    onSuccess: () => {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmation("");
      toast({ type: "success", message: "Senha alterada com segurança." });
    },
    onError: (caughtError: Error) => setError(caughtError.message),
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (newPassword !== confirmation) {
      setError("A confirmação da nova senha não corresponde.");
      return;
    }
    mutation.mutate();
  };

  return (
    <section className="panel settings-form-panel">
      <div className="settings-section-title">
        <span><KeyRound size={21} /></span>
        <div>
          <h2>Segurança da conta</h2>
          <p>Use uma senha longa e exclusiva para esta agenda.</p>
        </div>
      </div>
      <form className="form-stack" onSubmit={submit}>
        <FormError>{error}</FormError>
        <FormField label="Senha atual" htmlFor="password-current" required>
          <Input
            id="password-current"
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
        </FormField>
        <div className="form-grid form-grid--two">
          <FormField label="Nova senha" htmlFor="password-new" hint="Mínimo de 10 caracteres, com letra e número." required>
            <Input
              id="password-new"
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              minLength={10}
              autoComplete="new-password"
              required
            />
          </FormField>
          <FormField label="Confirmar nova senha" htmlFor="password-confirm" required>
            <Input
              id="password-confirm"
              type="password"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              minLength={10}
              autoComplete="new-password"
              required
            />
          </FormField>
        </div>
        <div className="password-rules">
          <span><Check size={14} /> Pelo menos 10 caracteres</span>
          <span><Check size={14} /> Letras e números</span>
          <span><Database size={14} /> Nunca salve a senha no navegador</span>
        </div>
        <div className="form-actions">
          <Button
            type="submit"
            variant="secondary"
            icon={<KeyRound size={17} />}
            loading={mutation.isPending}
          >
            Alterar senha
          </Button>
        </div>
      </form>
    </section>
  );
};
