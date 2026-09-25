export const anamnesisFieldKeys = [
  "queixaPrincipal",
  "inicioSintomas",
  "fonteInformacao",
  "evolucaoDemanda",
  "historicoFamiliar",
  "transtornosAnteriores",
  "internacoes",
  "medicacaoAtual",
  "usoSubstancias",
  "autolesao",
  "condicoesMedicas",
  "vidaSocial",
  "vidaOcupacional",
  "vidaFamiliar",
  "sonoApetite",
  "padraoEmocional",
  "risco",
  "fatoresProtetores",
  "hipoteseDiagnostica",
  "planoTerapeutico",
] as const;

export type AnamnesisFieldKey = (typeof anamnesisFieldKeys)[number];

export interface ClinicalField {
  key: AnamnesisFieldKey;
  label: string;
  hint?: string;
  rows?: number;
}

export interface ClinicalSection {
  id: string;
  title: string;
  description: string;
  fields: ClinicalField[];
}

export type AnamnesisContent = Record<AnamnesisFieldKey, string>;

export type AnamnesisStatus = "draft" | "completed";

export const anamnesisSections: ClinicalSection[] = [
  {
    id: "identificacao",
    title: "Identificação e queixa",
    description: "Motivo do atendimento e como a demanda chegou até você.",
    fields: [
      {
        key: "queixaPrincipal",
        label: "Queixa principal",
        hint: "Relato inicial do paciente, da família ou de quem encaminhou.",
        rows: 3,
      },
      {
        key: "inicioSintomas",
        label: "Início dos sintomas",
        hint: "Quando começou e como evoluiu até hoje.",
        rows: 2,
      },
      {
        key: "fonteInformacao",
        label: "Fonte da informação",
        hint: "Paciente, familiar, escola, médico, serviço de saúde.",
        rows: 1,
      },
      {
        key: "evolucaoDemanda",
        label: "Evolução da demanda",
        hint: "O que mudou entre o início e o momento atual.",
        rows: 2,
      },
    ],
  },
  {
    id: "historico",
    title: "Histórico pessoal e familiar",
    description: "Antecedentes que ajudam a compreender o quadro.",
    fields: [
      { key: "historicoFamiliar", label: "Histórico familiar e psiquiátrico", rows: 3 },
      { key: "transtornosAnteriores", label: "Transtornos e tratamentos anteriores", rows: 2 },
      { key: "internacoes", label: "Internações e passagens por urgência", rows: 2 },
      {
        key: "medicacaoAtual",
        label: "Medicação atual",
        hint: "Nome, dose e quem prescreveu, se houver.",
        rows: 2,
      },
      { key: "usoSubstancias", label: "Álcool e outras substâncias", rows: 2 },
      {
        key: "autolesao",
        label: "Autolesão ou ideação suicida",
        hint: "Registre datas, meios e circunstâncias, se conhecidas.",
        rows: 2,
      },
      { key: "condicoesMedicas", label: "Condições médicas e exames", rows: 2 },
    ],
  },
  {
    id: "funcionamento",
    title: "Funcionamento atual",
    description: "Como a pessoa está organizando o dia a dia.",
    fields: [
      { key: "vidaSocial", label: "Vida social e relacionamentos", rows: 2 },
      { key: "vidaOcupacional", label: "Vida ocupacional e escolar", rows: 2 },
      { key: "vidaFamiliar", label: "Vida familiar e moradia", rows: 2 },
      { key: "sonoApetite", label: "Sono, apetite e rotina", rows: 2 },
      { key: "padraoEmocional", label: "Padrão emocional e comportamental", rows: 2 },
    ],
  },
  {
    id: "avaliacao",
    title: "Avaliação e plano",
    description: "Sua leitura clínica e o rumo do tratamento.",
    fields: [
      {
        key: "risco",
        label: "Avaliação de risco",
        hint: "Risco suicida, autolesão, vitimização ou violência.",
        rows: 3,
      },
      { key: "fatoresProtetores", label: "Fatores de proteção", rows: 2 },
      { key: "hipoteseDiagnostica", label: "Hipótese diagnóstica", rows: 3 },
      { key: "planoTerapeutico", label: "Plano terapêutico e metas", rows: 3 },
    ],
  },
];

export const emptyAnamnesisContent = (): AnamnesisContent =>
  Object.fromEntries(anamnesisFieldKeys.map((key) => [key, ""])) as AnamnesisContent;

export const sessionNoteFieldKeys = [
  "objective",
  "interventions",
  "response",
  "homework",
  "planning",
] as const;

export type SessionNoteFieldKey = (typeof sessionNoteFieldKeys)[number];

export interface SessionNoteField {
  key: SessionNoteFieldKey;
  label: string;
  hint?: string;
  rows: number;
}

export type SessionNoteContent = Record<SessionNoteFieldKey, string>;

export const sessionNoteFields: SessionNoteField[] = [
  {
    key: "objective",
    label: "Objetivo da sessão",
    hint: "O que estava combinado para este encontro.",
    rows: 3,
  },
  {
    key: "interventions",
    label: "Intervenções e técnicas",
    hint: "O que foi feito: técnicas, exercícios, abordagens.",
    rows: 4,
  },
  {
    key: "response",
    label: "Resposta e evolução do paciente",
    hint: "Engajamento, reações, progressos e dificuldades.",
    rows: 3,
  },
  {
    key: "homework",
    label: "Tarefa de casa",
    hint: "Orientação ou prática combinada para a semana.",
    rows: 2,
  },
  {
    key: "planning",
    label: "Planejamento da próxima sessão",
    hint: "Próximo foco e pendências a retomar.",
    rows: 3,
  },
];

export const emptySessionNoteContent = (): SessionNoteContent =>
  Object.fromEntries(sessionNoteFieldKeys.map((key) => [key, ""])) as SessionNoteContent;
