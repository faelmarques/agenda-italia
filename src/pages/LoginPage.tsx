import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, CalendarCheck2, HeartHandshake, LockKeyhole, ShieldCheck } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/Toast";
import { Brand, Button, FormError, FormField, Input } from "../components/ui";

const AuthAside = () => (
  <aside className="auth-aside">
    <div className="auth-aside__glow auth-aside__glow--one" />
    <div className="auth-aside__glow auth-aside__glow--two" />
    <Brand />
    <div className="auth-aside__content">
      <span className="auth-aside__kicker">Agenda com mais presença</span>
      <h2>Mais tempo para cuidar. Menos tempo gerenciando.</h2>
      <p>
        Organiza pacientes, horários e confirmações em um só lugar — com simplicidade e respeito.
      </p>
      <div className="auth-benefits">
        <span><CalendarCheck2 size={19} /> Agenda organizada</span>
        <span><HeartHandshake size={19} />uidado sem complicação</span>
        <span><ShieldCheck size={19} /> Dados protegidos</span>
      </div>
    </div>
    <small className="auth-aside__footer">Feito para profissionais que acolhem pessoas.</small>
  </aside>
);

export const LoginPage = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      toast({ type: "success", message: "Bem-vindo(a) de volta." });
      navigate("/", { replace: true });
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Não foi possível entrar.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-page">
      <AuthAside />
      <section className="auth-form-panel">
        <div className="auth-form-wrap">
          <span className="auth-mobile-brand"><Brand /></span>
          <span className="auth-icon"><LockKeyhole size={24} /></span>
          <span className="eyebrow">Área profissional</span>
          <h1>Bem-vindo(a) de volta</h1>
          <p className="auth-intro">Entre para acessar sua agenda e continuar o cuidado.</p>

          <form className="form-stack" onSubmit={submit}>
            <FormError>{error}</FormError>
            <FormField label="E-mail" htmlFor="login-email" required>
              <Input
                id="login-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                autoFocus
                required
              />
            </FormField>
            <FormField label="Senha" htmlFor="login-password" required>
              <Input
                id="login-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
            </FormField>
            <Button type="submit" loading={loading} className="button--full">
              Entrar na agenda <ArrowRight size={18} />
            </Button>
          </form>

          <p className="auth-help">
            Acesso perdido? Para sua segurança, a redefinição de senha deve ser habilitada pelo responsável do sistema.
          </p>
        </div>
      </section>
    </main>
  );
};
