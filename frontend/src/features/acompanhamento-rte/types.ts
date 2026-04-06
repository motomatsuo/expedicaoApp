export type RteColumnKey =
  | 'recebido'
  | 'em_transito'
  | 'na_unidade'
  | 'rota_entrega'
  | 'problemas'
  | 'entregue'
  | 'enc_sem_entrega';

export type TrackingNfExpedicaoItem = {
  id: number;
  created_at: string;
  nf: number | null;
  date_tracking: string | null;
  description: string | null;
  setp_code: number | null;
};

export type TrackingRteColumnResponse = {
  items: TrackingNfExpedicaoItem[];
  total: number;
};
