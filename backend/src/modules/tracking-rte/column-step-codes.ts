/** Mapeamento coluna Kanban RTE → códigos `setp_code` (fonte: regra de negócio). */
export const RTE_COLUMN_KEYS = [
  'recebido',
  'em_transito',
  'na_unidade',
  'rota_entrega',
  'problemas',
  'entregue',
  'enc_sem_entrega',
] as const;

export type RteColumnKey = (typeof RTE_COLUMN_KEYS)[number];

export const COLUMN_STEP_CODES: Record<RteColumnKey, readonly number[]> = {
  recebido: [204, 217],
  em_transito: [205, 16, 42, 51, 70, 77, 82, 83],
  na_unidade: [46, 98, 209, 64],
  rota_entrega: [206, 219],
  problemas: [
    3, 4, 6, 8, 9, 10, 11, 12, 13, 14, 15, 17, 19, 20, 21, 22, 23, 25, 26, 27, 28,
    30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 43, 44, 45, 47, 48, 49, 50, 52, 53, 54,
    55, 56, 57, 58, 59, 60, 61, 62, 63, 65, 66, 67, 68, 69, 71, 72, 73, 74, 75, 76,
    79, 80, 81, 84, 85, 86, 87, 88, 90, 92, 93, 94, 95, 96, 97, 100, 157, 159, 178,
    198,
  ],
  entregue: [1, 24, 29, 78, 99],
  enc_sem_entrega: [7, 41, 89],
};
