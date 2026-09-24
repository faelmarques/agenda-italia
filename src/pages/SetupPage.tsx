import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, CalendarCheck2, HeartHandshake, ShieldCheck, UserRoundCheck } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/Toast";
import { Brand, Button, FormError, FormField, Input } from "../components/ui";

export const SetupPage = () => {
  const navigate = useNavigate();
  const { setup } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    professionalTitle: "Psicólogo(a)",
    registration: "",
    clinicName: "Agenda Itália",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Sao_Paulo",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const update = (key: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (form.password.length < 10) {
      setError("Use uma senha com pelo menos 10 caracteres, uma letra e um número.");
      return;
    }
    setLoading(true);
    try {
      await setup(form);
      toast({ type: "success", message: "Agenda configurada. Seu espaço está pronto!" });
      navigate("/", { replace: true });
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Não foi possível concluir a configuração.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-page auth-page--setup">
      <aside className="auth-aside">
        <div className="auth-aside__glow auth-aside__glow--one" />
        <div className="auth-aside__glow auth-aside__glow--two" />
        <Brand />
        <div className="auth-aside__content">
          <span className="auth-aside__kicker">Comece com calma</span>
          <h2>Seu espaço de trabalho, pronto para acolher.</h2>
          <p>
            Em poucos passos, você terá uma agenda segura e organizada para cuidar da rotina do consultório.
          </p>
          <div className="auth-benefits">
            <span><UserRoundCheck size={19} /> Conta protegida</span>
            <span><CalendarCheck2 size={19} /> Agenda pronta para usar</span>
            <span><HeartHandshake size={19} /> Interface acolhedora</span>
          </div>
        </div>
        <div className="setup-security"><ShieldCheck size={18} /> Seus dados ficam armazenados localmente.</div>
      </aside>

      <section className="auth-form-panel auth-form-panel--setup">
        <div className="auth-form-wrap auth-form-wrap--setup">
          <span className="auth-mobile-brand"><Brand /></span>
          <span className="eyebrow">Primeiro acesso</span>
          <h1>Crie sua conta profissional</h1>
          <p className="auth-intro">Esta será a única conta de acesso a esta agenda.</p>

          <form className="form-stack" onSubmit={submit}>
            <FormError>{error}</FormError>
            <div className="form-grid form-grid--two">
              <FormField label="Seu nome" htmlFor="setup-name" required>
                <Input
                  id="setup-name"
                  value={form.name}
                  onChange={(event) => update("name", event.target.value)}
                  autoComplete="name"
                  autoFocus
                  required
                />
              </FormField>
              <FormField label="E-mail" htmlFor="setup-email" required>
                <Input
                  id="setup-email"
                  type="email"
                  value={form.email}
                  onChange={(event) => update("email", event.target.value)}
                  autoComplete="email"
                  required
                />
              </FormField>
            </div>
            <div className="form-grid form-grid--two">
              <FormField label="Título profissional" htmlFor="setup-title">
                <Input
                  id="setup-title"
                  value={form.professionalTitle}
                  onChange={(event) => update("professionalTitle", event.target.value)}
                  placeholder="Psicólogo(a)"
                />
              </FormField>
              <FormField label="Registro profissional" htmlFor="setup-registration" hint="Opcional">
                <Input
                  id="setup-registration"
                  value={form.registration}
                  onChange={(event) => update("registration", event.target.value)}
                  placeholder="CRP 00.000-00"
                />
              </FormField>
            </div>
            <FormField label="Nome da agenda" htmlFor="setup-clinic" required>
              <Input
                id="setup-clinic"
                value={form.clinicName}
                onChange={(event) => update("clinicName", event.target.value)}
                required
              />
            </FormField>
            <FormField
              label="Senha de acesso"
              htmlFor="setup-password"
              hint="Mínimo de 10 caracteres, com pelo menos uma letra e um número."
              required
            >
              <Input
                id="setup-password"
                type="password"
                value={form.password}
                onChange={(event) => update("password", event.target.value)}
                minLength={10}
                autoComplete="new-password"
                required
              />
            </FormField>

            <div className="setup-consent">
              <ShieldCheck size={19} />
              <p>Use um dispositivo protegido e mantenha sua senha pessoal. O banco de dados desta versão fica no computador.</p>
            </div>

            <Button type="submit" loading={loading} className="button--full">
              Criar minha agenda <ArrowRight size={18} />
            </Button>
          </form>
        </div>
      </section>
    </main>
  );
};
