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
  initialized: boolean;
};

function emptyState(): Record<RteColumnKey, ColumnState> {
  const o = {} as Record<RteColumnKey, ColumnState>;
  for (const { key } of RTE_KANBAN_COLUMNS) {
    o[key] = {
      items: [],
      total: 0,
      loading: false,
      sort: 'desc',
      initialized: false,
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

function initials(name: string | null | undefined): string {
  const n = (name ?? '').trim();
  if (!n) return 'VN';
  const parts = n.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
}

function ClientValueIcon({ value }: { value: number | null | undefined }) {
  if (value == null || value < 1 || value > 5) return null;

  if (value === 5) {
    return (
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-cyan-500" fill="currentColor" aria-hidden>
        <path d="M12 2 4 9l8 13 8-13-8-7z" />
      </svg>
    );
  }
  if (value === 4) {
    return (
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-violet-500" fill="currentColor" aria-hidden>
        <path d="M12 2 4 7v10l8 5 8-5V7l-8-5z" />
      </svg>
    );
  }
  if (value === 3) {
    return (
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-amber-500" fill="currentColor" aria-hidden>
        <path d="M7 3h10l-1 4a5 5 0 1 1-8 0L7 3zm3 13.5h4L15.5 22 12 20.5 8.5 22 10 16.5z" />
      </svg>
    );
  }
  if (value === 2) {
    return (
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-zinc-400" fill="currentColor" aria-hidden>
        <path d="M7 3h10l-1 4a5 5 0 1 1-8 0L7 3zm3 13.5h4L15.5 22 12 20.5 8.5 22 10 16.5z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-orange-700" fill="currentColor" aria-hidden>
      <path d="M7 3h10l-1 4a5 5 0 1 1-8 0L7 3zm3 13.5h4L15.5 22 12 20.5 8.5 22 10 16.5z" />
    </svg>
  );
}

function clientValueLabel(value: number | null | undefined): string {
  if (value === 5) return 'Diamante';
  if (value === 4) return 'Platina';
  if (value === 3) return 'Ouro';
  if (value === 2) return 'Prata';
  if (value === 1) return 'Bronze';
  return 'Sem classificação';
}

function formatYmdBr(ymd: string | null | undefined): string {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return '—';
  const [y, m, d] = ymd.split('-');
  return `${d}/${m}/${y}`;
}

function SlaTag({ item }: { item: TrackingNfExpedicaoItem }) {
  const s = item.sla_status;
  if (!s) return null;
  const meta = {
    no_prazo: {
      label: 'No prazo',
      className: 'border-emerald-200/90 bg-emerald-50 text-emerald-800',
      title: item.sla_data_limite
        ? `Dentro do prazo (dias permitidos). Limite: ${formatYmdBr(item.sla_data_limite)}`
        : 'Dentro do prazo',
    },
    atrasado: {
      label: 'Atrasado',
      className: 'border-red-200/90 bg-red-50 text-red-800',
      title: item.sla_data_limite
        ? `Fora do prazo. Limite: ${formatYmdBr(item.sla_data_limite)}`
        : 'Fora do prazo',
    },
    sem_recebido: {
      label: 'Sem recebido',
      className: 'border-gray-200 bg-gray-100 text-gray-600',
      title: 'Data de recebimento pela transportadora não registrada',
    },
    sem_cadastro: {
      label: 'Sem cadastro',
      className: 'border-amber-200/90 bg-amber-50 text-amber-900',
      title: 'Município/UF sem regra em db_rte_prazos',
    },
    indeterminado: {
      label: 'SLA indeterm.',
      className: 'border-slate-200 bg-slate-100 text-slate-700',
      title: 'Regra encontrada, mas não foi possível calcular a data limite (ex.: recebido_em inválido)',
    },
  }[s];
  return (
    <span
      className={`inline-flex max-w-full shrink-0 items-center rounded-md border px-1.5 py-0.5 text-[9px] font-bold leading-none tabular-nums ${meta.className}`}
      title={meta.title}
    >
      {meta.label}
    </span>
  );
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
  const [modalTab, setModalTab] = useState<'rte' | 'cliente'>('rte');
  const [loadError, setLoadError] = useState<string | null>(null);
  /** Colunas minimizáveis que iniciam fechadas por padrão. */
  const [recebidoMinimized, setRecebidoMinimized] = useState(true);
  const [emTransitoMinimized, setEmTransitoMinimized] = useState(true);
  const [naUnidadeMinimized, setNaUnidadeMinimized] = useState(true);
  const [entregueMinimized, setEntregueMinimized] = useState(false);
  const [encSemEntregaMinimized, setEncSemEntregaMinimized] = useState(true);
  const [isMobileView, setIsMobileView] = useState(false);

  const mobileColumnRef = useRef(mobileColumn);
  const recebidoMinimizedRef = useRef(recebidoMinimized);
  const emTransitoMinimizedRef = useRef(emTransitoMinimized);
  const naUnidadeMinimizedRef = useRef(naUnidadeMinimized);
  const entregueMinimizedRef = useRef(entregueMinimized);
  const encSemEntregaMinimizedRef = useRef(encSemEntregaMinimized);
  const isMobileViewRef = useRef(isMobileView);
  mobileColumnRef.current = mobileColumn;
  recebidoMinimizedRef.current = recebidoMinimized;
  emTransitoMinimizedRef.current = emTransitoMinimized;
  naUnidadeMinimizedRef.current = naUnidadeMinimized;
  entregueMinimizedRef.current = entregueMinimized;
  encSemEntregaMinimizedRef.current = encSemEntregaMinimized;
  isMobileViewRef.current = isMobileView;

  const getVisibleColumns = useCallback(
    (opts?: {
      isMobile?: boolean;
      mobileKey?: RteColumnKey;
      recebidoCollapsed?: boolean;
      emTransitoCollapsed?: boolean;
      naUnidadeCollapsed?: boolean;
      entregueCollapsed?: boolean;
      encSemEntregaCollapsed?: boolean;
    }): RteColumnKey[] => {
      const isMobile = opts?.isMobile ?? isMobileViewRef.current;
      const mobileKey = opts?.mobileKey ?? mobileColumnRef.current;
      const recebidoCollapsed = opts?.recebidoCollapsed ?? recebidoMinimizedRef.current;
      const emTransitoCollapsed = opts?.emTransitoCollapsed ?? emTransitoMinimizedRef.current;
      const naUnidadeCollapsed = opts?.naUnidadeCollapsed ?? naUnidadeMinimizedRef.current;
      const entregueCollapsed = opts?.entregueCollapsed ?? entregueMinimizedRef.current;
      const encSemEntregaCollapsed =
        opts?.encSemEntregaCollapsed ?? encSemEntregaMinimizedRef.current;

      if (isMobile) return [mobileKey];
      return RTE_KANBAN_COLUMNS.map(({ key }) => key).filter((key) => {
        if (key === 'recebido' && recebidoCollapsed) return false;
        if (key === 'em_transito' && emTransitoCollapsed) return false;
        if (key === 'na_unidade' && naUnidadeCollapsed) return false;
        if (key === 'enc_sem_entrega' && encSemEntregaCollapsed) return false;
        return true;
      });
    },
    [],
  );

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
        take: '5',
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
              initialized: true,
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
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 767px)');
    const apply = () => setIsMobileView(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    setColState(emptyState());
    const ac = new AbortController();
    const visibleKeys = getVisibleColumns();
    void Promise.all(visibleKeys.map((key) => loadColumn(key, { reset: true }, ac.signal)));
    return () => ac.abort();
  }, [debouncedSearch, loadColumn, getVisibleColumns]);

  useEffect(() => {
    const visibleKeys = getVisibleColumns({
      isMobile: isMobileView,
      mobileKey: mobileColumn,
      recebidoCollapsed: recebidoMinimized,
      emTransitoCollapsed: emTransitoMinimized,
      naUnidadeCollapsed: naUnidadeMinimized,
      entregueCollapsed: entregueMinimized,
      encSemEntregaCollapsed: encSemEntregaMinimized,
    });
    for (const key of visibleKeys) {
      const s = colStateRef.current[key];
      if (!s.initialized && !s.loading) {
        void loadColumn(key, { reset: true });
      }
    }
  }, [
    isMobileView,
    mobileColumn,
    recebidoMinimized,
    emTransitoMinimized,
    naUnidadeMinimized,
    entregueMinimized,
    encSemEntregaMinimized,
    getVisibleColumns,
    loadColumn,
  ]);

  useEffect(() => {
    if (!modalItem) return;
    setModalTab('rte');
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

  const openDeliveryReceipt = useCallback((nf: number | null) => {
    if (nf == null) return;
    const nfInt = Math.trunc(nf);
    const url = `${API_URL}/tracking-rte/delivery-receipt/${nfInt}/html`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }, []);

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
                    if (key === 'recebido') setRecebidoMinimized(true);
                    if (key === 'em_transito') setEmTransitoMinimized(true);
                    if (key === 'na_unidade') setNaUnidadeMinimized(true);
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
                  <div className="min-w-0">
                    <span
                      className="mt-1 inline-flex max-w-full items-center gap-1 rounded-md border border-gray-200 bg-gray-50 px-1 py-px text-[9px] font-semibold tabular-nums text-gray-600"
                      title={`Valor cliente: ${clientValueLabel(item.cliente_valor)}`}
                    >
                      {item.codcli?.trim() || 'CLI —'}
                      <ClientValueIcon value={item.cliente_valor} />
                    </span>
                    <span className="mt-0.5 block truncate text-[10px] text-gray-500" title={item.razao ?? ''}>
                      {item.razao?.trim() || 'Cliente sem razão social'}
                    </span>
                    <span className="mt-1 block min-w-0 truncate text-[18px] font-extrabold tracking-tight text-gray-900 tabular-nums">
                      NF {item.nf != null ? String(item.nf) : '—'}
                    </span>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    {item.setp_code != null ? <StepCodeBadge code={item.setp_code} /> : null}
                    <SlaTag item={item} />
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
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
                  <span className="font-normal tabular-nums text-gray-500">
                    {formatTrackingDate(item.date_tracking)}
                  </span>
                </div>
                <div className="mt-0.5 flex items-center gap-2 border-t border-gray-100 pt-2">
                  {item.vendedor_foto ? (
                    <img
                      src={item.vendedor_foto}
                      alt={item.vendedor_nome?.trim() ? `Foto de ${item.vendedor_nome}` : 'Foto do vendedor'}
                      className="h-6 w-6 shrink-0 rounded-full object-cover ring-1 ring-gray-200"
                      loading="lazy"
                    />
                  ) : (
                    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-200 text-[10px] font-semibold text-gray-600 ring-1 ring-gray-300">
                      {initials(item.vendedor_nome)}
                    </span>
                  )}
                  <span
                    className="truncate text-[11px] font-medium text-gray-600"
                    title={item.vendedor_nome ?? item.vend ?? ''}
                  >
                    {item.vendedor_nome?.trim() || item.vend?.trim() || 'Vendedor não identificado'}
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

  const desktopColumns = useMemo(
    () => {
      const isCollapsed = (key: RteColumnKey) =>
        (key === 'recebido' && recebidoMinimized) ||
        (key === 'em_transito' && emTransitoMinimized) ||
        (key === 'na_unidade' && naUnidadeMinimized) ||
        (key === 'enc_sem_entrega' && encSemEntregaMinimized);

      const collapsedKeys = RTE_KANBAN_COLUMNS.map(({ key }) => key).filter(isCollapsed);
      const expandedKeys = RTE_KANBAN_COLUMNS.map(({ key }) => key).filter((key) => !isCollapsed(key));

      return (
        <div className="flex w-full min-w-0 flex-1 gap-4 overflow-x-hidden pb-4">
          {collapsedKeys.length > 0 ? (
            <div className="flex h-full min-h-0 w-[48px] shrink-0 flex-col gap-2">
              {collapsedKeys.map((key) => {
                const label = RTE_KANBAN_COLUMNS.find((c) => c.key === key)?.label ?? key;
                const total = colState[key].total;
                return (
                  <div
                    key={key}
                    className="flex min-h-0 flex-1 flex-col rounded-xl border border-gray-200 bg-white p-0.5 shadow"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (key === 'recebido') setRecebidoMinimized(false);
                        if (key === 'em_transito') setEmTransitoMinimized(false);
                        if (key === 'na_unidade') setNaUnidadeMinimized(false);
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
              })}
            </div>
          ) : null}

          {expandedKeys.map((key) =>
            columnBody(key, {
              showMinimize:
                key === 'recebido' ||
                key === 'em_transito' ||
                key === 'na_unidade' ||
                key === 'enc_sem_entrega',
            }),
          )}
        </div>
      );
    },
    [
      recebidoMinimized,
      emTransitoMinimized,
      naUnidadeMinimized,
      encSemEntregaMinimized,
      colState,
      columnBody,
    ],
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
            placeholder="Buscar por NF, cliente, vendedor..."
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
              <div>
                <div className="inline-flex items-center gap-2">
                  <h2 id="rte-modal-title" className="text-xl font-extrabold tracking-tight text-gray-900">
                    NF {modalItem.nf != null ? String(modalItem.nf) : '—'}
                  </h2>
                  {modalItem.nf != null ? (
                    <button
                      type="button"
                      onClick={() => openDeliveryReceipt(modalItem.nf)}
                      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
                      title="Abrir comprovante de entrega"
                      aria-label="Abrir comprovante de entrega"
                    >
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M14 3h7m0 0v7m0-7L10 14M5 5v14h14v-5"
                        />
                      </svg>
                    </button>
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  {modalTab === 'rte' ? 'Informações de rastreio' : 'Informações do cliente'}
                </p>
              </div>
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
            <div className="mb-5 inline-flex rounded-xl border border-gray-200 bg-gray-50 p-1">
              <button
                type="button"
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                  modalTab === 'rte'
                    ? 'bg-white text-[#dc2626] shadow-sm ring-1 ring-red-100'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
                onClick={() => setModalTab('rte')}
              >
                Detalhes RTE
              </button>
              <button
                type="button"
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                  modalTab === 'cliente'
                    ? 'bg-white text-[#dc2626] shadow-sm ring-1 ring-red-100'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
                onClick={() => setModalTab('cliente')}
              >
                Detalhes Cliente
              </button>
            </div>

            {modalTab === 'rte' ? (
              <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <div className="rounded-lg border border-gray-200 bg-gray-50/70 p-3 sm:col-span-2">
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">SLA entrega</dt>
                  <dd className="mt-2 flex flex-wrap items-center gap-2">
                    <SlaTag item={modalItem} />
                    <span className="text-xs text-gray-600">
                      {modalItem.sla_prazo_dias != null
                        ? `Prazo: ${modalItem.sla_prazo_dias} dia(s) úteis (seg–sex, sem feriados nacionais)`
                        : '—'}
                    </span>
                  </dd>
                  <dd className="mt-3 grid gap-2 text-xs text-gray-700 sm:grid-cols-2">
                    <div>
                      <span className="font-semibold text-gray-500">Recebido em </span>
                      {formatTrackingDate(modalItem.recebido_em ?? null)}
                    </div>
                    <div>
                      <span className="font-semibold text-gray-500">Data limite </span>
                      {formatYmdBr(modalItem.sla_data_limite)}
                    </div>
                    <div>
                      <span className="font-semibold text-gray-500">Referência </span>
                      {formatYmdBr(modalItem.sla_referencia_data)}
                      <span className="block text-[10px] font-normal text-gray-500">
                        Contagem a partir do dia seguinte ao recebido (SP). Limite = próximo dia de rota do
                        município (planilha) após o último dia útil contado. Entregues: referência = rastreio.
                        Em trânsito: hoje (SP).
                      </span>
                    </div>
                  </dd>
                </div>
                <div className="rounded-lg border border-gray-200 bg-gray-50/70 p-3">
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Código etapa</dt>
                  <dd className="mt-1 text-sm font-semibold text-gray-900">{modalItem.setp_code ?? '—'}</dd>
                </div>
                <div className="rounded-lg border border-gray-200 bg-gray-50/70 p-3">
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Data rastreio</dt>
                  <dd className="mt-1 text-sm font-semibold text-gray-900">
                    {formatTrackingDate(modalItem.date_tracking)}
                  </dd>
                </div>
                <div className="rounded-lg border border-gray-200 bg-gray-50/70 p-3 sm:col-span-2">
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Descrição</dt>
                  <dd className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-900">
                    {modalItem.description?.trim() || '—'}
                  </dd>
                </div>
              </dl>
            ) : (
              <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <div className="rounded-lg border border-gray-200 bg-gray-50/70 p-3">
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">ID cliente</dt>
                  <dd className="mt-1 text-sm font-semibold text-gray-900">{modalItem.codcli ?? '—'}</dd>
                </div>
                <div className="rounded-lg border border-gray-200 bg-gray-50/70 p-3">
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Documento</dt>
                  <dd className="mt-1 text-sm font-semibold text-gray-900">{modalItem.cliente_documento ?? '—'}</dd>
                </div>
                <div className="rounded-lg border border-gray-200 bg-gray-50/70 p-3 sm:col-span-2">
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Razão social</dt>
                  <dd className="mt-1 text-sm leading-relaxed text-gray-900">
                    {modalItem.cliente_nome_empresa ?? modalItem.razao ?? '—'}
                  </dd>
                </div>
                <div className="rounded-lg border border-gray-200 bg-gray-50/70 p-3 sm:col-span-2">
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Município / UF</dt>
                  <dd className="mt-1 text-sm font-semibold text-gray-900">
                    {[modalItem.municipio, modalItem.est].filter(Boolean).join(' / ') || '—'}
                  </dd>
                </div>
              </dl>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
