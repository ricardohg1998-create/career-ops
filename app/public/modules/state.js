export const state = {
  view: 'home',
  health: null,
  applications: [],
  metrics: null,
  states: [],
  pipeline: [],
  reports: [],
  jobs: [],
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
  inbox: 'Inbox de oportunidades',
  evaluate: 'Evaluar y decidir',
  tracker: 'Tracker operativo',
  lab: 'Perfil, datos y operaciones',
};
