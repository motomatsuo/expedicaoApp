'use client';

import { useCallback, useEffect, useState } from 'react';
import { BipagemMetrics } from './types';

type UseBipagemMetricsInput = {
  from: string;
  to: string;
};

type UseBipagemMetricsResult = {
  data: BipagemMetrics | null;
  loading: boolean;
  error: string;
  reload: () => Promise<void>;
};

export function useBipagemMetrics(input: UseBipagemMetricsInput): UseBipagemMetricsResult {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';
  const [data, setData] = useState<BipagemMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const query = new URLSearchParams({
        from: input.from,
        to: input.to,
      });
      const response = await fetch(`${apiUrl}/bipagem/metrics?${query.toString()}`, {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error('Falha ao carregar metricas de bipagem.');
      }

      const payload = (await response.json()) as BipagemMetrics;
      setData(payload);
    } catch {
      setError('Nao foi possivel carregar as metricas de bipagem.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [apiUrl, input.from, input.to]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, loading, error, reload: load };
}
