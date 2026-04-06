'use client';

import { RTE_KANBAN_COLUMNS } from '@/features/acompanhamento-rte/columns';
import { StepCodeBadge } from '@/features/acompanhamento-rte/step-code-badge';
import type {
  RteColumnKey,
  TrackingNfExpedicaoItem,
  TrackingRteColumnResponse,
} from '@/features/acompanhamento-rte/types';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

type ColumnState = {
  items: TrackingNfExpedicaoItem[];
  total: number;
  loading: boolean;
  sort: 'asc' | 'desc';
};

function emptyState(): Record<RteColumnKey, ColumnState> {
  const o = {} as Record<RteColumnKey, ColumnState>;
  for (const { key } of RTE_KANBAN_COLUMNS) {
    o[key] = {
      items: [],
      total: 0,
      loading: true,
      sort: 'desc',
    };
  }
  return o;
}

function formatTrackingDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

/** Título em coluna minimizada (uma letra por linha), como no mock. */
function VerticalColumnTitle({ label, narrow }: { label: string; narrow?: boolean }) {
  const letterClass = narrow ? 'leading-none text-[10px]' : 'leading-none text-xs';
  return (
    <div className="flex flex-col items-center">
      {label.split('').map((char, i) => (
        <span key={i} className={letterClass}>
          {char === ' ' ? '\u00a0' : char}
        </span>
      ))}
    </div>
  );
}

export default function AcompanhamentoRtePage() {
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [colState, setColState] = useState<Record<RteColumnKey, ColumnState>>(emptyState);
  const colStateRef = useRef(colState);
  colStateRef.current = colState;

  const [mobileColumn, setMobileColumn] = useState<RteColumnKey>('recebido');
  const [modalItem, setModalItem] = useState<TrackingNfExpedicaoItem | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  /** Colunas ENTREGUE e ENC. SEM ENTREGA podem minimizar; iniciam fechadas. */
  const [entregueMinimized, setEntregueMinimized] = useState(true);
  const [encSemEntregaMinimized, setEncSemEntregaMinimized] = useState(true);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, 320);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const loadColumn = useCallback(
    async (
      key: RteColumnKey,
      opts: { reset: boolean; sort?: 'asc' | 'desc' },
      signal?: AbortSignal,
    ) => {
      const current = colStateRef.current[key];
      const sort = opts.sort ?? current.sort;
      const skip = opts.reset ? 0 : current.items.length;

      setColState((prev) => ({
        ...prev,
        [key]: {
          ...prev[key],
          loading: true,
          ...(opts.sort ? { sort: opts.sort } : {}),
          ...(opts.reset ? { items: [], total: 0 } : {}),
        },
      }));

      const params = new URLSearchParams({
        column: key,
        skip: String(skip),
        take: '10',
        sort,
      });
      if (debouncedSearch) {
        params.set('search', debouncedSearch);
      }

      try {
        const res = await fetch(`${API_URL}/tracking-rte/column?${params.toString()}`, {
          method: 'GET',
          credentials: 'include',
          signal,
        });
        if (!res.ok) {
          throw new Error(res.status === 401 ? 'Sessão expirada.' : 'Falha ao carregar dados.');
        }
        const data = (await res.json()) as TrackingRteColumnResponse;
        if (signal?.aborted) return;

        setColState((prev) => {
          const prevKey = prev[key];
          const nextItems = opts.reset
            ? data.items
            : [...prevKey.items, ...data.items];
          return {
            ...prev,
            [key]: {
              ...prevKey,
              items: nextItems,
              total: data.total,
              loading: false,
              sort,
            },
          };
        });
        setLoadError(null);
      } catch (e) {
        if (signal?.aborted || (e instanceof DOMException && e.name === 'AbortError')) {
          return;
        }
        setLoadError(e instanceof Error ? e.message : 'Erro ao carregar.');
        setColState((prev) => ({
          ...prev,
          [key]: { ...prev[key], loading: false },
        }));
      }
    },
    [debouncedSearch],
  );

  useEffect(() => {
    setColState(emptyState());
    const ac = new AbortController();
    void Promise.all(
      RTE_KANBAN_COLUMNS.map(({ key }) => loadColumn(key, { reset: true }, ac.signal)),
    );
    return () => ac.abort();
  }, [debouncedSearch, loadColumn]);

  useEffect(() => {
    if (!modalItem) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') setModalItem(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modalItem]);

  const toggleSort = useCallback(
    (key: RteColumnKey) => {
      const next = colStateRef.current[key].sort === 'desc' ? 'asc' : 'desc';
      void loadColumn(key, { reset: true, sort: next });
    },
    [loadColumn],
  );

  const loadMore = useCallback(
    (key: RteColumnKey) => {
      const s = colStateRef.current[key];
      if (s.loading || s.items.length >= s.total) return;
      void loadColumn(key, { reset: false });
    },
    [loadColumn],
  );

  const columnBody = useCallback(
    (key: RteColumnKey, options?: { showMinimize?: boolean }) => {
      const showMinimize = options?.showMinimize ?? false;
      const col = colState[key];
      const label = RTE_KANBAN_COLUMNS.find((c) => c.key === key)?.label ?? key;
      const remaining = Math.max(0, col.total - col.items.length);
      const sortBtnTitle =
        col.sort === 'desc' ? 'Mostrar mais antigos primeiro' : 'Mostrar mais recentes primeiro';

      return (
        <div
          key={key}
          className="flex min-h-0 min-w-0 flex-1 basis-0 flex-col rounded-xl border border-gray-200 bg-white p-3 shadow"
        >
          <div className="mb-5 flex items-center justify-between rounded-lg p-1.5 transition-colors">
            <h2 className="flex w-full items-center text-xl font-bold text-gray-700">
              <span
                className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap"
                title={`${label} (${col.total})`}
              >
                {label} ({col.total})
              </span>
              {showMinimize ? (
                <button
                  type="button"
                  title="Minimizar coluna"
                  onClick={() => {
                    if (key === 'entregue') setEntregueMinimized(true);
                    if (key === 'enc_sem_entrega') setEncSemEntregaMinimized(true);
                  }}
                  className="ml-2 shrink-0 rounded p-1 text-gray-500 hover:bg-gray-100"
                  aria-label="Minimizar coluna"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
                    />
                  </svg>
                </button>
              ) : null}
              <button
                type="button"
                title={sortBtnTitle}
                onClick={() => toggleSort(key)}
                className="ml-2 shrink-0 rounded p-1 text-gray-500 hover:bg-gray-100"
                aria-label={sortBtnTitle}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d={
                      col.sort === 'desc'
                        ? 'M5 15l7-7 7 7'
                        : 'M19 9l-7 7-7-7'
                    }
                  />
                </svg>
              </button>
            </h2>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overflow-x-hidden">
            {col.loading && col.items.length === 0 ? (
              <p className="text-center text-xs text-gray-400">Carregando…</p>
            ) : null}
            {col.items.map((item) => (
              <button
                key={item.id}
                type="button"
                draggable={false}
                onClick={() => setModalItem(item)}
                className="group relative flex cursor-pointer select-none flex-col gap-2.5 overflow-hidden rounded-xl border border-gray-200/90 bg-white p-3.5 text-left shadow-[0_1px_2px_rgba(15,23,42,0.06)] transition-all duration-200 hover:-translate-y-px hover:border-[#dc2626]/30 hover:shadow-[0_4px_14px_-2px_rgba(220,38,38,0.12),0_2px_6px_-1px_rgba(15,23,42,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#dc2626]/35 focus-visible:ring-offset-2 active:translate-y-0 active:shadow-[0_1px_2px_rgba(15,23,42,0.06)]"
              >
                <span
                  className="pointer-events-none absolute inset-y-2 left-0 w-0.5 rounded-full bg-gradient-to-b from-[#ef4444] to-[#dc2626] opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                  aria-hidden
                />
                <div className="flex min-w-0 items-start justify-between gap-2 pl-0.5">
                  <span className="min-w-0 truncate text-[15px] font-bold tracking-tight text-gray-900 tabular-nums">
                    NF {item.nf != null ? String(item.nf) : '—'}
                  </span>
                  {item.setp_code != null ? (
                    <StepCodeBadge code={item.setp_code} />
                  ) : null}
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
                  <svg
                    className="h-3.5 w-3.5 shrink-0 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span className="font-medium tabular-nums text-gray-600">
                    {formatTrackingDate(item.date_tracking)}
                  </span>
                </div>
              </button>
            ))}
            {col.items.length === 0 && !col.loading ? (
              <p className="text-center text-xs text-gray-400">Nenhum item</p>
            ) : null}
          </div>

          {remaining > 0 ? (
            <button
              type="button"
              disabled={col.loading}
              onClick={() => loadMore(key)}
              className="group mt-3 flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 p-3 text-gray-500 transition-all duration-200 hover:border-[#dc2626] hover:bg-red-50 hover:text-[#dc2626] disabled:opacity-50"
            >
              <svg
                className="h-4 w-4 transition-transform duration-200 group-hover:rotate-180"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
              <span className="font-medium">Visualizar ({remaining})</span>
            </button>
          ) : null}
        </div>
      );
    },
    [colState, loadMore, toggleSort],
  );

  const desktopColumnOrCollapsed = useCallback(
    (key: RteColumnKey) => {
      const collapsed =
        (key === 'entregue' && entregueMinimized) ||
        (key === 'enc_sem_entrega' && encSemEntregaMinimized);

      if (collapsed) {
        const label = RTE_KANBAN_COLUMNS.find((c) => c.key === key)?.label ?? key;
        const total = colState[key].total;
        return (
          <div
            key={key}
            className="flex h-full min-h-0 w-[48px] shrink-0 flex-col rounded-xl border border-gray-200 bg-white p-0.5 shadow"
          >
            <button
              type="button"
              onClick={() => {
                if (key === 'entregue') setEntregueMinimized(false);
                if (key === 'enc_sem_entrega') setEncSemEntregaMinimized(false);
              }}
              className="flex min-h-0 flex-1 cursor-pointer flex-col items-center justify-center rounded-md px-0 py-1 transition-colors hover:bg-gray-50"
              title={`${label} (${total}) — clique para expandir`}
              aria-label={`Expandir coluna ${label}, ${total} itens`}
            >
              <h2 className="w-full text-center font-semibold text-gray-700">
                <VerticalColumnTitle label={label} narrow />
              </h2>
            </button>
          </div>
        );
      }
      return columnBody(key, {
        showMinimize: key === 'entregue' || key === 'enc_sem_entrega',
      });
    },
    [entregueMinimized, encSemEntregaMinimized, colState, columnBody],
  );

  const desktopColumns = useMemo(
    () => (
      <div className="flex w-full min-w-0 flex-1 gap-4 overflow-x-hidden pb-4">
        {RTE_KANBAN_COLUMNS.map(({ key }) => desktopColumnOrCollapsed(key))}
      </div>
    ),
    [desktopColumnOrCollapsed],
  );

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-x-hidden">
      <div className="w-full min-w-0 shrink-0 px-0 pb-2 pt-0 md:pb-3">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <select
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-[#dc2626] focus:outline-none md:text-base"
            aria-label="Tipo de acompanhamento"
            defaultValue="rte"
          >
            <option value="rte">Acomp. RTE</option>
          </select>
          <input
            type="search"
            placeholder="Filtrar por valores..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-[#dc2626] focus:outline-none sm:max-w-[280px] md:text-base"
          />
          <div className="relative">
            <button
              type="button"
              className="rounded-lg bg-gray-100 p-2 text-gray-600 transition-all duration-200 hover:bg-gray-200"
              title="Filtro de Admin"
              aria-label="Filtro de Admin"
              disabled
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {loadError ? (
        <div className="mb-3 shrink-0 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 md:mb-4">
          {loadError}
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col md:hidden">
        <label className="mb-2 block text-xs font-medium text-gray-600" htmlFor="rte-col-mobile">
          Coluna
        </label>
        <select
          id="rte-col-mobile"
          value={mobileColumn}
          onChange={(e) => setMobileColumn(e.target.value as RteColumnKey)}
          className="mb-3 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-[#dc2626] focus:outline-none"
        >
          {RTE_KANBAN_COLUMNS.map(({ key, label }) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <div className="min-h-0 flex-1 rounded-xl border border-gray-100 bg-gray-50/50 p-1">
          {columnBody(mobileColumn, { showMinimize: false })}
        </div>
      </div>

      <div className="hidden min-h-0 flex-1 flex-col md:flex">{desktopColumns}</div>

      {modalItem ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="presentation"
          onClick={() => setModalItem(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="rte-modal-title"
            className="max-h-[min(90vh,640px)] w-full max-w-lg overflow-y-auto rounded-xl border border-gray-200 bg-white p-4 shadow-xl md:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-2">
              <h2 id="rte-modal-title" className="text-lg font-bold text-gray-900">
                NF {modalItem.nf != null ? String(modalItem.nf) : '—'}
              </h2>
              <button
                type="button"
                className="rounded-lg p-1 text-gray-500 hover:bg-gray-100"
                onClick={() => setModalItem(null)}
                aria-label="Fechar"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="font-medium text-gray-500">Código etapa</dt>
                <dd className="mt-0.5 text-gray-900">{modalItem.setp_code ?? '—'}</dd>
              </div>
              <div>
                <dt className="font-medium text-gray-500">Data rastreio</dt>
                <dd className="mt-0.5 text-gray-900">{formatTrackingDate(modalItem.date_tracking)}</dd>
              </div>
              <div>
                <dt className="font-medium text-gray-500">Descrição</dt>
                <dd className="mt-0.5 whitespace-pre-wrap break-words text-gray-900">
                  {modalItem.description?.trim() || '—'}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-gray-500">Registro</dt>
                <dd className="mt-0.5 text-gray-900">{formatTrackingDate(modalItem.created_at)}</dd>
              </div>
            </dl>
          </div>
        </div>
      ) : null}
    </div>
  );
}
