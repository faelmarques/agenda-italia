import { useDeferredValue, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList, Mail, MessageCircle, Search } from "lucide-react";
import { Button, EmptyState, PageHeader } from "../components/ui";
import { api, toQueryString } from "../lib/api";
import type { PatientsResponse } from "../types";

type RecordFilter = "active" | "all";

export const ProntuarioPage = () => {
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [filter, setFilter] = useState<RecordFilter>("active");
  const [page, setPage] = useState(1);

  const query = useQuery({
    queryKey: ["patients", "prontuario", deferredSearch, filter, page],
    queryFn: () =>
      api<PatientsResponse>(
        `/api/patients${toQueryString({
          search: deferredSearch,
          status: filter,
          page,
          limit: 20,
        })}`,
      ),
  });

  const patients = query.data?.items ?? [];
  const pagination = query.data?.pagination;

  const setFilterValue = (value: RecordFilter) => {
    setFilter(value);
    setPage(1);
  };

  return (
    <div className="prontuario-page">
      <PageHeader
        eyebrow="Documentação"
        title="Prontuário"
        description="Acesse a anamnese, o histórico de evolução e os modelos de cada paciente."
      />

      <section className="panel patients-panel">
        <div className="patients-toolbar">
          <label className="search-field">
            <Search size={18} aria-hidden="true" />
            <span className="sr-only">Buscar pacientes no prontuário</span>
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
            {(["active", "all"] as RecordFilter[]).map((value) => (
              <button
                key={value}
                type="button"
                className={filter === value ? "is-active" : ""}
                onClick={() => setFilterValue(value)}
              >
                {value === "active" ? "Ativos" : "Todos"}
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
                  <th>Cadastro</th>
                  <th><span className="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody>
                {patients.map((patient) => (
                  <tr key={patient.id} className={!patient.active ? "data-table__inactive" : ""}>
                    <td>
                      <div className="patient-cell">
                        <span className="avatar avatar--soft">
                          {patient.name.slice(0, 2).toUpperCase()}
                        </span>
                        <span>
                          <strong>{patient.name}</strong>
                          <small>
                            {patient.birthDate
                              ? `Nasc. ${patient.birthDate.split("-").reverse().join("/")}`
                              : "Sem data de nascimento"}
                          </small>
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="contact-cell">
                        {patient.phone ? (
                          <span><MessageCircle size={14} /> {patient.phone}</span>
                        ) : null}
                        {patient.email ? (
                          <span><Mail size={14} /> {patient.email}</span>
                        ) : null}
                        {!patient.phone && !patient.email ? (
                          <span className="muted">Não informado</span>
                        ) : null}
                      </div>
                    </td>
                    <td>
                      <span className={patient.active ? "pill pill--success" : "pill"}>
                        {patient.active ? "Ativo" : "Arquivado"}
                      </span>
                    </td>
                    <td>
                      <div className="table-actions">
                        <Link
                          className="button button--secondary button--small"
                          to={`/prontuario/${patient.id}`}
                        >
                          <ClipboardList size={16} /> Abrir prontuário
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
            title="Nenhum paciente encontrado"
            description={
              deferredSearch
                ? "Tente buscar por outro nome ou informação de contato."
                : "Cadastre um paciente para começar a documentação clínica."
            }
            action={
              !deferredSearch ? (
                <Link className="button button--primary button--medium" to="/pacientes">
                  Cadastrar paciente
                </Link>
              ) : (
                <Button variant="secondary" onClick={() => setSearch("")}>
                  Limpar busca
                </Button>
              )
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
    </div>
  );
};
