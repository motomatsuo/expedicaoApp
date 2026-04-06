import type { RteColumnKey } from './types';

export const RTE_KANBAN_COLUMNS: { key: RteColumnKey; label: string }[] = [
  { key: 'recebido', label: 'RECEBIDO' },
  { key: 'em_transito', label: 'EM TRANSITO' },
  { key: 'na_unidade', label: 'NA UNIDADE' },
  { key: 'rota_entrega', label: 'ROTA ENTREGA' },
  { key: 'problemas', label: 'PROBLEMAS' },
  { key: 'enc_sem_entrega', label: 'ENC. SEM ENTREGA' },
  { key: 'entregue', label: 'ENTREGUE' },
];
