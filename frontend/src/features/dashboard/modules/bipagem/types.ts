export type BipagemModeId =
  | 'mercado_livre_comum'
  | 'mercado_livre_flex'
  | 'shopee_comum'
  | 'shopee_entrega_rapida';

export type BipagemMetrics = {
  range: {
    from: string;
    to: string;
    tz: string;
  };
  total: number;
  byMode: Record<BipagemModeId, number>;
  byUser: Array<{
    user: string;
    count: number;
  }>;
  byHour: Array<{
    hour: number;
    count: number;
  }>;
  byWeekdayHour: Array<{
    weekday: number;
    hour: number;
    count: number;
  }>;
  byDay: Array<{
    date: string;
    total: number;
    byMode: Record<BipagemModeId, number>;
  }>;
};
