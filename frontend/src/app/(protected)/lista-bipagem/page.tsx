'use client';

import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { mapApiBipagemToScanRow, type BipagemScanRow } from '@/features/bipagem/bipagem-catalog';
import { BIPAGEM_LIST_BROADCAST_CHANNEL } from '@/features/bipagem/bipagem-list-sync';
import { ROUTES } from '@/shared/constants/routes';
import {
  dateKeyFromIso,
  formatWeekdayLabel,
  getLastWeekdayKeys,
  isWeekday,
  isWeekdayDateKey,
  toLocalDateKey,
} from './business-days';

type ListaBipagemRow = BipagemScanRow & { dateKey: string };

function mapToListaRow(item: {
  id: number;
  created_at: string;
  plataforma: string;
  atendente: string;
  codigo: string;
}): ListaBipagemRow {
  return { ...mapApiBipagemToScanRow(item), dateKey: dateKeyFromIso(item.created_at) };
}

function OlderDateCalendarModal({
  open,
  onClose,
  onSelectDateKey,
  maxDateKey,
  minDateKey,
}: {
  open: boolean;
  onClose: () => void;
  onSelectDateKey: (key: string) => void;
  maxDateKey: string;
  minDateKey: string;
}) {
  const [weekendHint, setWeekendHint] = useState('');

  useEffect(() => {
    if (open) {
      setWeekendHint('');
    }
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 px-0 pb-0 backdrop-blur-sm sm:items-center sm:px-4 sm:pb-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-md rounded-t-2xl border border-gray-200 bg-white shadow-xl sm:rounded-xl"
        role="dialog"
        aria-modal="true"
        aria-label="Calendario para outra data"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-gray-100 p-4 sm:p-5">
          <h2 className="text-base font-semibold text-gray-900">Outra data</h2>
          <p className="mt-1 text-sm text-gray-600">
            Escolha um dia útil no calendário (apenas segunda a sexta).
          </p>
        </div>
        <div className="p-4 sm:p-5">
          <label htmlFor="lista-bipagem-calendario" className="mb-2 block text-sm font-medium text-gray-700">
            Data
          </label>
          <input
            id="lista-bipagem-calendario"
            type="date"
            min={minDateKey}
            max={maxDateKey}
            className="focus-ring w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-base text-gray-900 shadow-sm"
            onChange={(e) => {
              const v = e.target.value;
              if (!v) return;
              const [y, m, d] = v.split('-').map(Number);
              const dt = new Date(y!, m! - 1, d!);
              if (!isWeekday(dt)) {
                setWeekendHint('Esta data é fim de semana. Selecione um dia útil.');
                return;
              }
              setWeekendHint('');
              onSelectDateKey(v);
              onClose();
              e.target.blur();
            }}
          />
          {weekendHint ? (
            <p className="mt-2 text-sm text-red-600" role="alert">
              {weekendHint}
            </p>
          ) : null}
        </div>
        <div className="border-t border-gray-100 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-4">
          <button
            type="button"
            onClick={onClose}
            className="focus-ring h-10 w-full rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

function DatePickerPanel({
  lastFiveKeys,
  selectedDateKey,
  onSelect,
  onOpenCalendar,
}: {
  lastFiveKeys: string[];
  selectedDateKey: string;
  onSelect: (key: string) => void;
  onOpenCalendar: () => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Dia útil</p>
      <div className="flex flex-col gap-1.5">
        {lastFiveKeys.map((key) => {
          const active = key === selectedDateKey;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(key)}
              className={[
                'focus-ring rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition-colors',
                active
                  ? 'border-[#980F0F] bg-[#980F0F]/10 text-[#980F0F]'
                  : 'border-gray-200 bg-white text-gray-800 hover:bg-gray-50',
              ].join(' ')}
            >
              <span className="block capitalize">{formatWeekdayLabel(key)}</span>
              <span className="mt-0.5 block text-xs font-normal text-gray-500">
                {key.split('-').reverse().join('/')}
              </span>
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={onOpenCalendar}
        className="focus-ring w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-left text-sm font-medium text-gray-800 transition-colors hover:bg-gray-100"
      >
        Mais antigas…
      </button>
    </div>
  );
}

export default function ListaBipagemPage() {
  const pathname = usePathname();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';
  const [items, setItems] = useState<ListaBipagemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [calendarOpen, setCalendarOpen] = useState(false);

  const lastFiveKeys = useMemo(() => getLastWeekdayKeys(5, new Date()), []);

  const maxDateKey = useMemo(() => toLocalDateKey(new Date()), []);
  const minDateKey = useMemo(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 5);
    return toLocalDateKey(d);
  }, []);

  const [selectedDateKey, setSelectedDateKey] = useState<string>(() => lastFiveKeys[0] ?? '');

  useEffect(() => {
    if (!selectedDateKey) {
      setSelectedDateKey(lastFiveKeys[0] ?? '');
      return;
    }
    const valid = lastFiveKeys.includes(selectedDateKey) || isWeekdayDateKey(selectedDateKey);
    if (!valid) {
      setSelectedDateKey(lastFiveKeys[0] ?? '');
    }
  }, [lastFiveKeys, selectedDateKey]);

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

      setItems((data.items ?? []).map(mapToListaRow));
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

  const filteredItems = useMemo(
    () => items.filter((row) => row.dateKey === selectedDateKey),
    [items, selectedDateKey],
  );

  const dateSummary = selectedDateKey
    ? `${formatWeekdayLabel(selectedDateKey)} (${selectedDateKey.split('-').reverse().join('/')})`
    : '';

  return (
    <section className="relative mx-auto max-w-7xl pb-28 lg:pb-8">
      <OlderDateCalendarModal
        open={calendarOpen}
        onClose={() => setCalendarOpen(false)}
        onSelectDateKey={setSelectedDateKey}
        maxDateKey={maxDateKey}
        minDateKey={minDateKey}
      />

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
        <div className="min-w-0 flex-1">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm text-gray-600">
                Historico de bipagens no servidor. Filtrado por dia útil selecionado.
              </p>
              {!loading ? (
                <p className="mt-1 text-xs font-medium uppercase tracking-wide text-gray-500">
                  {items.length === 0
                    ? 'Nenhum registro carregado'
                    : `${filteredItems.length} registro${filteredItems.length === 1 ? '' : 's'} neste dia · ${items.length} no total`}
                </p>
              ) : null}
              {dateSummary ? (
                <p className="mt-1 text-xs text-gray-600">
                  Data: <span className="font-medium capitalize text-gray-900">{dateSummary}</span>
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
            ) : filteredItems.length === 0 ? (
              <p className="p-8 text-center text-sm text-gray-500">
                Nenhuma bipagem neste dia útil. Escolha outra data ao lado ou abaixo.
              </p>
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
                    {filteredItems.map((row, index) => (
                      <tr
                        key={row.id ?? `${row.code}-${row.scannedAt}-${index}`}
                        className="hover:bg-gray-50/80"
                      >
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
        </div>

        <aside
          className="sticky top-24 hidden w-56 shrink-0 self-start lg:block"
          aria-label="Filtrar por dia útil"
        >
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <DatePickerPanel
              lastFiveKeys={lastFiveKeys}
              selectedDateKey={selectedDateKey}
              onSelect={setSelectedDateKey}
              onOpenCalendar={() => setCalendarOpen(true)}
            />
          </div>
        </aside>
      </div>

      <div
        className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 shadow-[0_-8px_30px_rgba(15,23,42,0.08)] backdrop-blur-md lg:hidden"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        <div className="mx-auto max-w-7xl px-3 pt-3">
          <p className="mb-2 text-center text-[10px] font-semibold uppercase tracking-wide text-gray-500">
            Dia útil
          </p>
          <div className="-mx-1 flex gap-2 overflow-x-auto pb-2 pt-0.5">
            {lastFiveKeys.map((key) => {
              const active = key === selectedDateKey;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedDateKey(key)}
                  className={[
                    'focus-ring shrink-0 rounded-xl border px-3 py-2 text-left text-xs font-medium transition-colors',
                    active
                      ? 'border-[#980F0F] bg-[#980F0F]/10 text-[#980F0F]'
                      : 'border-gray-200 bg-gray-50 text-gray-800',
                  ].join(' ')}
                >
                  <span className="block whitespace-nowrap capitalize">{formatWeekdayLabel(key)}</span>
                  <span className="mt-0.5 block text-[10px] font-normal text-gray-500">
                    {key.split('-').reverse().join('/')}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="border-t border-gray-100 pt-2 pb-1">
            <button
              type="button"
              onClick={() => setCalendarOpen(true)}
              className="focus-ring w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-100"
            >
              Mais antigas…
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
