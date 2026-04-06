import { BipagemModeId } from './list-bipagem-metrics.dto';

export type BipagemMetricsResponse = {
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
