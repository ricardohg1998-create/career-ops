export const state = {
  view: 'home',
  health: null,
  applications: [],
  applicationEvents: [],
  metrics: null,
  states: [],
  pipeline: [],
  reports: [],
  jobs: [],
  nextActions: [],
  lastModuleResult: null,
  scanner: null,
  scannerSchedule: null,
  scannerStrategy: null,
  followups: null,
  patterns: null,
  selected: { kind: 'home', id: null },
  editorKey: 'profile',
  editorData: {},
  loadedReport: null,
  liveness: {},
};

export const statusLabels = {
  Evaluated: 'Evaluada',
  Applied: 'Aplicada',
  Responded: 'Respondida',
  Interview: 'Entrevista',
  Offer: 'Oferta',
  Rejected: 'Rechazada',
  Discarded: 'Descartada',
  SKIP: 'No aplicar',
};

export const viewTitles = {
  home: 'Inicio',
  opportunities: 'Oportunidades',
  evaluate: 'Evaluación 360',
  dossier: 'Dossier de candidatura',
  tracker: 'Seguimiento operativo',
  profile: 'Perfil y datos',
  system: 'Sistema',
  /* backward compat */
  inbox: 'Oportunidades',
  lab: 'Dossier de candidatura',
};

export const presetLabels = {
  fast: 'Cribado rápido',
  '': 'Evaluación completa',
  review: 'Revisión crítica',
  long: 'Contexto largo',
};

export const moduleLabels = {
  'apply-assistant': 'Asistente de candidatura',
  'form-reader': 'Lector de formulario',
  'deep-research': 'Investigación profunda',
  'interview-prep': 'Preparación de entrevista',
  'outreach': 'Contacto LinkedIn',
  'offer-comparison': 'Comparar ofertas',
  'training': 'Evaluar formación',
  'project': 'Evaluar proyecto',
};

export const modeLabels = {
  draft: 'Solo borrador',
  assisted: 'Modo asistido',
};

export const stepLabels = {
  'url-guard': 'URL segura',
  'liveness': 'Vigencia',
  'jd-extraction': 'Extracción de descripción',
  'evaluation': 'Evaluación',
  'tracker-merge': 'Integración en registro',
  'report-pdf': 'PDF informe',
  'cv-pdf': 'CV ATS',
  'apply-draft': 'Borrador candidatura',
};
