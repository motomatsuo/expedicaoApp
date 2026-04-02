export type BipagemModeId =
  | 'mercado_livre_comum'
  | 'mercado_livre_flex'
  | 'shopee_comum'
  | 'shopee_entrega_rapida';

export type BipagemMode = {
  id: BipagemModeId;
  label: string;
  platform: 'mercado_livre' | 'shopee';
};

export const BIPAGEM_MODES: BipagemMode[] = [
  {
    id: 'mercado_livre_comum',
    label: 'Mercado Livre comum',
    platform: 'mercado_livre',
  },
  {
    id: 'mercado_livre_flex',
    label: 'Mercado Livre Flex',
    platform: 'mercado_livre',
  },
  {
    id: 'shopee_comum',
    label: 'Shopee comum',
    platform: 'shopee',
  },
  {
    id: 'shopee_entrega_rapida',
    label: 'Shopee Entrega Rapida',
    platform: 'shopee',
  },
];

/** Linha de bipagem na UI (sessão ou lista). */
export type BipagemScanRow = {
  id?: number;
  code: string;
  scannedAt: string;
  userName: string;
  modeLabel: string;
};

export function mapApiBipagemToScanRow(item: {
  id: number;
  created_at: string;
  plataforma: string;
  atendente: string;
  codigo: string;
}): BipagemScanRow {
  const matchedMode = BIPAGEM_MODES.find((mode) => mode.id === item.plataforma);

  return {
    id: item.id,
    code: item.codigo,
    scannedAt: new Date(item.created_at).toLocaleString('pt-BR'),
    userName: item.atendente || 'Usuario',
    modeLabel: matchedMode?.label ?? item.plataforma,
  };
}
