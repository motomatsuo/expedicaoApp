'use client';

import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { mapApiBipagemToScanRow, type BipagemScanRow } from '@/features/bipagem/bipagem-catalog';
import { BIPAGEM_LIST_BROADCAST_CHANNEL } from '@/features/bipagem/bipagem-list-sync';
import { ROUTES } from '@/shared/constants/routes';

export default function ListaBipagemPage() {
  const pathname = usePathname();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';
  const [items, setItems] = useState<BipagemScanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  const load = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent === true;
    if (!silent) {
      setError('');
      setLoading(true);
    }
    try {
      const response = await fetch(`${apiUrl}/bipagem`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        setError('Nao foi possivel carregar as bipagens.');
        setItems([]);
        return;
      }

      const data = (await response.json()) as {
        items?: Array<{
          id: number;
          created_at: string;
          plataforma: string;
          atendente: string;
          codigo: string;
        }>;
      };

      setItems((data.items ?? []).map(mapApiBipagemToScanRow));
      if (silent) {
        setError('');
      }
    } catch {
      setError('Nao foi possivel carregar as bipagens.');
      setItems([]);
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [apiUrl]);

  useEffect(() => {
    if (pathname !== ROUTES.listaBipagem) {
      return;
    }
    void load();
  }, [pathname, load]);

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') {
      return;
    }
    const channel = new BroadcastChannel(BIPAGEM_LIST_BROADCAST_CHANNEL);
    channel.onmessage = () => void load({ silent: true });
    return () => channel.close();
  }, [load]);

  return (
    <section className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-gray-600">
            Historico de todas as bipagens registradas no servidor (mesmos dados da sessao de bipagem).
          </p>
          {!loading ? (
            <p className="mt-1 text-xs font-medium uppercase tracking-wide text-gray-500">
              {items.length === 0
                ? 'Nenhum registro'
                : `${items.length} registro${items.length === 1 ? '' : 's'}`}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => void load({ silent: false })}
          disabled={loading}
          className="focus-ring inline-flex h-10 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white px-4 text-sm font-medium text-gray-800 shadow-sm transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? 'Atualizando...' : 'Atualizar'}
        </button>
      </div>

      {error ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {loading && items.length === 0 ? (
          <p className="p-8 text-center text-sm text-gray-500">Carregando...</p>
        ) : items.length === 0 ? (
          <p className="p-8 text-center text-sm text-gray-500">Nenhuma bipagem encontrada.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/90">
                  <th className="px-4 py-3 font-semibold text-gray-900">Codigo</th>
                  <th className="px-4 py-3 font-semibold text-gray-900">Modelo</th>
                  <th className="px-4 py-3 font-semibold text-gray-900">Data e hora</th>
                  <th className="px-4 py-3 font-semibold text-gray-900">Usuario</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((row, index) => (
                  <tr key={row.id ?? `${row.code}-${row.scannedAt}-${index}`} className="hover:bg-gray-50/80">
                    <td className="max-w-[220px] break-all px-4 py-3 font-medium text-gray-900">
                      {row.code}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-700">{row.modeLabel}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-600">{row.scannedAt}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-600">{row.userName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
