import type { RteSlaStatus } from '../rte-sla';

export type TrackingNfExpedicaoRecord = {
  id: number;
  created_at: string;
  nf: number | null;
  date_tracking: string | null;
  description: string | null;
  setp_code: number | null;
  recebido_em: string | null;
  codcli: string | null;
  vend: string | null;
  razao: string | null;
  municipio: string | null;
  est: string | null;
  vendedor_nome?: string | null;
  vendedor_foto?: string | null;
  cliente_nome_empresa?: string | null;
  cliente_documento?: string | null;
  cliente_vendedor?: string | null;
  cliente_valor?: number | null;
  cliente_status?: string | null;
  cliente_classificacao?: string | null;
  cliente_tp_comercio?: string | null;
  cliente_descricao?: string | null;
  /** Calculado no backend a partir de `recebido_em` e `db_rte_prazos`. */
  sla_status?: RteSlaStatus | null;
  sla_data_limite?: string | null;
  sla_referencia_data?: string | null;
  sla_prazo_dias?: number | null;
};
