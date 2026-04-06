'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  BIPAGEM_MODES,
  mapApiBipagemToScanRow,
  type BipagemModeId,
  type BipagemScanRow,
} from '@/features/bipagem/bipagem-catalog';
import {
  BIPAGEM_LIST_BROADCAST_CHANNEL,
  notifyBipagemListChanged,
} from '@/features/bipagem/bipagem-list-sync';
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
const PAGE_SIZE_OPTIONS = [20, 50, 100, 200, 500] as const;
const DEFAULT_PAGE_SIZE = 20;

/** Títulos curtos apenas nos blocos de métrica da lista. */
const LISTA_METRIC_TITLE_BY_MODE: Record<BipagemModeId, string> = {
  mercado_livre_comum: 'MELI Comum',
  mercado_livre_flex: 'MELI Flex',
  shopee_comum: 'Shopee comum',
  shopee_entrega_rapida: 'Shopee E.R',
};

type MetricAccent = BipagemModeId | 'total_shopee' | 'total_meli';
type ExportScope = 'mode' | 'all';

/** Cartões neutros com faixa lateral discreta para distinguir sem cores chapadas. */
const METRIC_ACCENTS: Record<
  MetricAccent,
  { box: string; title: string; value: string; skeleton: string }
> = {
  mercado_livre_comum: {
    box: 'border border-gray-200 bg-white shadow-sm border-l-[3px] border-l-stone-500',
    title: 'text-gray-600',
    value: 'text-gray-900',
    skeleton: 'border border-gray-200 bg-gray-50/90 border-l-[3px] border-l-stone-300',
  },
  mercado_livre_flex: {
    box: 'border border-gray-200 bg-white shadow-sm border-l-[3px] border-l-slate-500',
    title: 'text-gray-600',
    value: 'text-gray-900',
    skeleton: 'border border-gray-200 bg-gray-50/90 border-l-[3px] border-l-slate-300',
  },
  shopee_comum: {
    box: 'border border-gray-200 bg-white shadow-sm border-l-[3px] border-l-orange-400',
    title: 'text-gray-600',
    value: 'text-gray-900',
    skeleton: 'border border-gray-200 bg-gray-50/90 border-l-[3px] border-l-orange-200',
  },
  shopee_entrega_rapida: {
    box: 'border border-gray-200 bg-white shadow-sm border-l-[3px] border-l-violet-400',
    title: 'text-gray-600',
    value: 'text-gray-900',
    skeleton: 'border border-gray-200 bg-gray-50/90 border-l-[3px] border-l-violet-200',
  },
  total_shopee: {
    box: 'border border-gray-200 bg-white shadow-sm border-l-[3px] border-l-[#980F0F]',
    title: 'text-gray-600',
    value: 'text-gray-900',
    skeleton: 'border border-gray-200 bg-gray-50/90 border-l-[3px] border-l-red-200',
  },
  total_meli: {
    box: 'border border-gray-200 bg-white shadow-sm border-l-[3px] border-l-blue-600',
    title: 'text-gray-600',
    value: 'text-gray-900',
    skeleton: 'border border-gray-200 bg-gray-50/90 border-l-[3px] border-l-blue-200',
  },
};

function mapToListaRow(item: {
  id: number;
  created_at: string;
  plataforma: string;
  atendente: string;
  codigo: string;
}): ListaBipagemRow {
  return { ...mapApiBipagemToScanRow(item), dateKey: dateKeyFromIso(item.created_at) };
}

function IconGridAll({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
      />
    </svg>
  );
}

function IconUser({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
      />
    </svg>
  );
}

function IconX({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function IconTrash({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  );
}

function IconTagModel({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
      />
    </svg>
  );
}

function IconUsersGroup({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 11a4 4 0 100-8 4 4 0 000 8z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"
      />
    </svg>
  );
}

type FilterMenuKind = 'model' | 'user';

function MetricCard({
  title,
  value,
  wide,
  hint,
  accent,
}: {
  title: string;
  value: number;
  wide?: boolean;
  /** Texto completo no tooltip (ex.: nome oficial do modo). */
  hint?: string;
  accent: MetricAccent;
}) {
  const palette = METRIC_ACCENTS[accent];
  return (
    <div
      className={[
        'flex shrink-0 flex-col justify-center rounded-lg px-2 py-1.5 sm:px-2.5 sm:py-2',
        palette.box,
        wide ? 'w-[7rem] sm:w-[7.75rem]' : 'w-[5.75rem] sm:w-[6.75rem]',
      ].join(' ')}
    >
      <p
        className={[
          'overflow-hidden text-ellipsis whitespace-nowrap text-[10px] font-semibold leading-tight sm:text-[11px]',
          palette.title,
        ].join(' ')}
        title={hint ?? title}
      >
        {title}
      </p>
      <p
        className={[
          'mt-0.5 text-center text-lg font-bold tabular-nums leading-none sm:text-xl',
          palette.value,
        ].join(' ')}
      >
        {value}
      </p>
    </div>
  );
}

function FilterMenu({
  menu,
  openMenu,
  onOpenMenu,
  hasActiveFilter,
  title,
  alignRight,
  children,
}: {
  menu: FilterMenuKind;
  openMenu: FilterMenuKind | null;
  onOpenMenu: (m: FilterMenuKind | null) => void;
  hasActiveFilter: boolean;
  title: string;
  alignRight?: boolean;
  children: ReactNode;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const open = openMenu === menu;

  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        onOpenMenu(null);
      }
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open, onOpenMenu]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        title={title}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => onOpenMenu(open ? null : menu)}
        className={[
          'p-2 rounded-lg transition-all duration-200',
          hasActiveFilter || open
            ? 'bg-[#980F0F]/15 text-[#980F0F] ring-1 ring-[#980F0F]/25'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
        ].join(' ')}
      >
        {menu === 'model' ? (
          <IconTagModel className="h-5 w-5" />
        ) : (
          <IconUsersGroup className="h-5 w-5" />
        )}
      </button>
      {open ? (
        <div
          className={[
            'absolute top-full mt-2 z-50 min-w-[220px] origin-top scale-100 transform transition-all duration-200 ease-out',
            alignRight ? 'right-0' : 'left-0',
          ].join(' ')}
          role="menu"
        >
          <div className="rounded-lg border border-gray-200 bg-white py-2 shadow-lg">{children}</div>
        </div>
      ) : null}
    </div>
  );
}

function ExportModal({
  open,
  onClose,
  onConfirm,
  minDateKey,
  maxDateKey,
  initialDateKey,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (options: { scope: ExportScope; from: string; to: string; modeId?: BipagemModeId }) => void;
  minDateKey: string;
  maxDateKey: string;
  initialDateKey: string;
}) {
  const [scope, setScope] = useState<ExportScope>('all');
  const [from, setFrom] = useState(initialDateKey);
  const [to, setTo] = useState(initialDateKey);
   const [modeId, setModeId] = useState<BipagemModeId | ''>('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setScope('all');
      setFrom(initialDateKey);
      setTo(initialDateKey);
      setModeId('');
      setError('');
    }
  }, [open, initialDateKey]);

  if (!open) return null;

  function handleConfirm() {
    if (!from || !to) {
      setError('Preencha as duas datas para exportar.');
      return;
    }
    if (from > to) {
      setError('A data inicial nao pode ser maior que a final.');
      return;
    }
    if (scope === 'mode' && !modeId) {
      setError('Selecione o modo de bipagem para exportar.');
      return;
    }
    setError('');
    onConfirm({ scope, from, to, modeId: scope === 'mode' ? (modeId as BipagemModeId) : undefined });
  }

  return (
    <div
      className="fixed inset-0 z-[110] flex items-end justify-center bg-black/50 px-0 pb-0 backdrop-blur-sm sm:items-center sm:px-4 sm:pb-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-md rounded-t-2xl border border-gray-200 bg-white shadow-xl sm:rounded-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lista-exportar-titulo"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-gray-100 p-4 sm:p-5">
          <h2 id="lista-exportar-titulo" className="text-base font-semibold text-gray-900">
            Exportar bipagens
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            Escolha o que deseja exportar e o intervalo de datas.
          </p>
        </div>
        <div className="space-y-4 p-4 sm:p-5">
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-gray-800">Escopo</legend>
            <div className="mt-1 space-y-2">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-800">
                <input
                  type="radio"
                  name="lista-export-scope"
                  value="all"
                  checked={scope === 'all'}
                  onChange={() => setScope('all')}
                  className="h-4 w-4 text-[#980F0F] focus:ring-[#980F0F]"
                />
                <span>Todos os modos de bipagem</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-800">
                <input
                  type="radio"
                  name="lista-export-scope"
                  value="mode"
                  checked={scope === 'mode'}
                  onChange={() => setScope('mode')}
                  className="h-4 w-4 text-[#980F0F] focus:ring-[#980F0F]"
                />
                <span>Apenas por modo de bipagem</span>
              </label>
            </div>
          </fieldset>

          {scope === 'mode' ? (
            <div className="space-y-2">
              <label
                htmlFor="lista-export-mode"
                className="block text-sm font-medium text-gray-800"
              >
                Modo de bipagem
              </label>
              <select
                id="lista-export-mode"
                value={modeId}
                onChange={(e) => setModeId(e.target.value as BipagemModeId | '')}
                className="focus-ring w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 shadow-sm"
              >
                <option value="">Selecione um modo</option>
                {BIPAGEM_MODES.map((mode) => (
                  <option key={mode.id} value={mode.id}>
                    {mode.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-800">Intervalo de datas</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="lista-export-from"
                  className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500"
                >
                  De
                </label>
                <input
                  id="lista-export-from"
                  type="date"
                  min={minDateKey}
                  max={maxDateKey}
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="focus-ring w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 shadow-sm"
                />
              </div>
              <div>
                <label
                  htmlFor="lista-export-to"
                  className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500"
                >
                  Ate
                </label>
                <input
                  id="lista-export-to"
                  type="date"
                  min={minDateKey}
                  max={maxDateKey}
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="focus-ring w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 shadow-sm"
                />
              </div>
            </div>
            {error ? (
              <p className="text-sm text-red-600" role="alert">
                {error}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex flex-col-reverse gap-2 border-t border-gray-100 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end sm:pb-4">
          <button
            type="button"
            onClick={onClose}
            className="focus-ring h-10 w-full rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 sm:w-auto sm:min-w-[7rem]"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="focus-ring h-10 w-full rounded-lg bg-[#980F0F] text-sm font-medium text-white transition-colors hover:bg-[#7b0c0c] sm:w-auto sm:min-w-[7rem]"
          >
            Exportar
          </button>
        </div>
      </div>
    </div>
  );
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

export default function ListaBipagemPageClient() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const codigoFromUrl = (searchParams.get('codigo') ?? '').trim();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';
  const [items, setItems] = useState<ListaBipagemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [filterModelLabel, setFilterModelLabel] = useState<string | null>(null);
  const [filterUserName, setFilterUserName] = useState<string | null>(null);
  const [openFilterMenu, setOpenFilterMenu] = useState<FilterMenuKind | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: number; code: string } | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const [currentPage, setCurrentPage] = useState<number>(1);

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

  const syncedUrlCodigoRef = useRef<string | null>(null);
  useEffect(() => {
    if (!codigoFromUrl) {
      syncedUrlCodigoRef.current = null;
      return;
    }
    if (items.length === 0) return;
    if (syncedUrlCodigoRef.current === codigoFromUrl) return;
    const c = codigoFromUrl.toLowerCase();
    const hit =
      items.find((r) => r.code.toLowerCase() === c) ??
      items.find((r) => r.code.toLowerCase().includes(c));
    if (hit) {
      setSelectedDateKey(hit.dateKey);
      syncedUrlCodigoRef.current = codigoFromUrl;
    }
  }, [codigoFromUrl, items]);

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
        cache: 'no-store',
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

  /** Push do servidor: atualiza na hora entre dispositivos (ex.: bip no celular, lista no desktop). */
  useEffect(() => {
    if (pathname !== ROUTES.listaBipagem) {
      return;
    }
    if (typeof EventSource === 'undefined') {
      return;
    }
    const url = `${apiUrl}/bipagem/stream`;
    const es = new EventSource(url, { withCredentials: true });
    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data) as { type?: string };
        if (data.type === 'bipagem-list-changed') {
          void load({ silent: true });
        }
      } catch {
        // ping ou payload invalido
      }
    };
    return () => es.close();
  }, [pathname, load, apiUrl]);

  useEffect(() => {
    if (pathname !== ROUTES.listaBipagem) {
      return;
    }
    function onVisibility() {
      if (document.visibilityState === 'visible') {
        void load({ silent: true });
      }
    }
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [pathname, load]);

  const performDeleteBipagem = useCallback(
    async (id: number): Promise<boolean> => {
      setDeletingId(id);
      setError('');
      try {
        const response = await fetch(`${apiUrl}/bipagem/${id}`, {
          method: 'DELETE',
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error('Falha ao excluir bipagem.');
        }

        setItems((previous) => previous.filter((row) => row.id !== id));
        notifyBipagemListChanged();
        return true;
      } catch {
        setError('Nao foi possivel excluir a bipagem.');
        return false;
      } finally {
        setDeletingId(null);
      }
    },
    [apiUrl],
  );

  const dayItems = useMemo(
    () => items.filter((row) => row.dateKey === selectedDateKey),
    [items, selectedDateKey],
  );

  const uniqueUserNames = useMemo(() => {
    const names = new Set(items.map((row) => row.userName));
    return [...names].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [items]);

  const filteredItems = useMemo(() => {
    let rows = dayItems
      .filter((row) => filterModelLabel === null || row.modeLabel === filterModelLabel)
      .filter((row) => filterUserName === null || row.userName === filterUserName);
    if (codigoFromUrl) {
      const c = codigoFromUrl.toLowerCase();
      rows = rows.filter((row) => row.code.toLowerCase().includes(c));
    }
    return rows;
  }, [dayItems, filterModelLabel, filterUserName, codigoFromUrl]);

  const totalFilteredItems = filteredItems.length;
  const totalPages = Math.max(1, Math.ceil(totalFilteredItems / pageSize));
  const currentPageSafe = Math.min(currentPage, totalPages);
  const pageStartIndex = (currentPageSafe - 1) * pageSize;
  const pageEndIndex = pageStartIndex + pageSize;
  const paginatedItems = useMemo(
    () => filteredItems.slice(pageStartIndex, pageEndIndex),
    [filteredItems, pageStartIndex, pageEndIndex],
  );

  const highlightCodigoNorm = codigoFromUrl ? codigoFromUrl.toLowerCase() : '';

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedDateKey, filterModelLabel, filterUserName, pageSize, codigoFromUrl]);

  useEffect(() => {
    if (!codigoFromUrl) return;
    const c = codigoFromUrl.toLowerCase();
    const idx = filteredItems.findIndex((r) => r.code.toLowerCase().includes(c));
    if (idx >= 0) {
      setCurrentPage(Math.floor(idx / pageSize) + 1);
    }
  }, [codigoFromUrl, filteredItems, pageSize]);

  useEffect(() => {
    if (!highlightCodigoNorm || paginatedItems.length === 0) return;
    const match = paginatedItems.find((r) => r.code.toLowerCase().includes(highlightCodigoNorm));
    if (match?.id == null) return;
    const id = `bip-row-${match.id}`;
    requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
  }, [highlightCodigoNorm, paginatedItems]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const countsByModeId = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const m of BIPAGEM_MODES) {
      counts[m.id] = 0;
    }
    for (const row of filteredItems) {
      const mode = BIPAGEM_MODES.find((item) => item.label === row.modeLabel);
      if (mode) {
        counts[mode.id] = (counts[mode.id] ?? 0) + 1;
      }
    }
    return counts;
  }, [filteredItems]);

  const totalShopee = (countsByModeId.shopee_comum ?? 0) + (countsByModeId.shopee_entrega_rapida ?? 0);
  const totalMercadoLivre =
    (countsByModeId.mercado_livre_comum ?? 0) + (countsByModeId.mercado_livre_flex ?? 0);

  const handleConfirmExport = useCallback(
    (options: { scope: ExportScope; from: string; to: string; modeId?: BipagemModeId }) => {
      const { scope, from, to, modeId } = options;
      const params = new URLSearchParams();
      params.set('from', from);
      params.set('to', to);
      params.set('scope', scope);
      if (scope === 'mode' && modeId) {
        params.set('modeId', modeId);
      }

      const url = `${apiUrl}/bipagem/export?${params.toString()}`;

      if (typeof window !== 'undefined') {
        window.open(url, '_blank');
      }

      setExportOpen(false);
    },
    [apiUrl],
  );

  return (
    <section className="relative mx-auto max-w-7xl pb-28 lg:pb-8">
      <ExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        onConfirm={handleConfirmExport}
        minDateKey={minDateKey}
        maxDateKey={maxDateKey}
        initialDateKey={selectedDateKey}
      />
      <OlderDateCalendarModal
        open={calendarOpen}
        onClose={() => setCalendarOpen(false)}
        onSelectDateKey={setSelectedDateKey}
        maxDateKey={maxDateKey}
        minDateKey={minDateKey}
      />

      {confirmDelete ? (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 px-0 pb-0 backdrop-blur-sm sm:items-center sm:px-4 sm:pb-4"
          onClick={() => setConfirmDelete(null)}
          role="presentation"
        >
          <div
            className="w-full max-w-md rounded-t-2xl border border-gray-200 bg-white shadow-xl sm:rounded-xl"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="lista-excluir-titulo"
            aria-describedby="lista-excluir-desc"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-gray-100 p-4 sm:p-5">
              <h2 id="lista-excluir-titulo" className="text-base font-semibold text-gray-900">
                Excluir bipagem?
              </h2>
              <p id="lista-excluir-desc" className="mt-2 text-sm text-gray-600">
                Esta acao nao pode ser desfeita. Confirme a exclusao do codigo:
              </p>
              <p className="mt-2 break-all rounded-lg bg-gray-50 px-3 py-2 text-sm font-medium text-gray-900">
                {confirmDelete.code}
              </p>
            </div>
            <div className="flex flex-col-reverse gap-2 border-t border-gray-100 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end sm:pb-4">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                disabled={deletingId !== null}
                className="focus-ring h-10 w-full rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 sm:w-auto sm:min-w-[7rem]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = confirmDelete;
                  void (async () => {
                    const ok = await performDeleteBipagem(target.id);
                    if (ok) setConfirmDelete(null);
                  })();
                }}
                disabled={deletingId !== null}
                className="focus-ring h-10 w-full rounded-lg bg-red-600 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:min-w-[7rem]"
              >
                {deletingId !== null ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
        <div className="min-w-0 flex-1">
          <div className="mb-6 flex min-w-0 flex-nowrap items-center gap-2 sm:gap-3">
            <div className="-mx-0.5 flex min-h-10 min-w-0 flex-1 flex-nowrap items-center gap-2 overflow-x-auto px-0.5 py-0.5 [scrollbar-width:thin]">
              {!loading ? (
                <>
                  {BIPAGEM_MODES.map((mode) => (
                    <MetricCard
                      key={mode.id}
                      accent={mode.id}
                      title={LISTA_METRIC_TITLE_BY_MODE[mode.id]}
                      hint={mode.label}
                      value={countsByModeId[mode.id] ?? 0}
                    />
                  ))}
                  <MetricCard wide accent="total_shopee" title="Total Shopee" value={totalShopee} />
                  <MetricCard
                    wide
                    accent="total_meli"
                    title="Total MELI"
                    hint="Total Mercado Livre"
                    value={totalMercadoLivre}
                  />
                </>
              ) : (
                <>
                  {BIPAGEM_MODES.map((mode) => (
                    <div
                      key={mode.id}
                      className={[
                        'h-[3.35rem] w-[5.75rem] shrink-0 animate-pulse rounded-lg sm:h-[3.6rem] sm:w-[6.75rem]',
                        METRIC_ACCENTS[mode.id].skeleton,
                      ].join(' ')}
                    />
                  ))}
                  <div
                    className={[
                      'h-[3.35rem] w-[7rem] shrink-0 animate-pulse rounded-lg sm:h-[3.6rem] sm:w-[7.75rem]',
                      METRIC_ACCENTS.total_shopee.skeleton,
                    ].join(' ')}
                  />
                  <div
                    className={[
                      'h-[3.35rem] w-[7rem] shrink-0 animate-pulse rounded-lg sm:h-[3.6rem] sm:w-[7.75rem]',
                      METRIC_ACCENTS.total_meli.skeleton,
                    ].join(' ')}
                  />
                </>
              )}
            </div>
            <div className="flex shrink-0 flex-nowrap items-center justify-end gap-2 border-l border-gray-200/90 pl-2 sm:pl-3">
              <FilterMenu
                menu="model"
                openMenu={openFilterMenu}
                onOpenMenu={setOpenFilterMenu}
                hasActiveFilter={filterModelLabel !== null}
                title="Filtrar por modelo"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setFilterModelLabel(null);
                    setOpenFilterMenu(null);
                  }}
                  className={[
                    'flex w-full items-center gap-2 px-4 py-2 text-left text-sm transition-colors duration-200',
                    filterModelLabel === null
                      ? 'bg-red-100 font-medium text-red-700'
                      : 'text-gray-700 hover:bg-red-50',
                  ].join(' ')}
                >
                  <IconGridAll className="h-4 w-4 shrink-0 text-red-500" />
                  <span>Todos os modelos</span>
                </button>
                <div className="my-1 border-t border-gray-100" />
                {BIPAGEM_MODES.map((mode) => {
                  const active = filterModelLabel === mode.label;
                  return (
                    <button
                      key={mode.id}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setFilterModelLabel(mode.label);
                        setOpenFilterMenu(null);
                      }}
                      className={[
                        'flex w-full items-center gap-2 px-4 py-2 text-left text-sm transition-colors duration-200',
                        active
                          ? 'bg-red-100 font-medium text-red-700'
                          : 'text-gray-700 hover:bg-red-50',
                      ].join(' ')}
                    >
                      <IconTagModel className="h-4 w-4 shrink-0 text-red-500" />
                      <span>{mode.label}</span>
                    </button>
                  );
                })}
                <div className="my-1 border-t border-gray-100" />
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setFilterModelLabel(null);
                    setOpenFilterMenu(null);
                  }}
                  className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-500 transition-colors duration-200 hover:bg-gray-50"
                >
                  <IconX className="h-4 w-4 shrink-0" />
                  <span>Desativar filtro</span>
                </button>
              </FilterMenu>

              <FilterMenu
                menu="user"
                openMenu={openFilterMenu}
                onOpenMenu={setOpenFilterMenu}
                hasActiveFilter={filterUserName !== null}
                title="Filtrar por usuario"
                alignRight
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setFilterUserName(null);
                    setOpenFilterMenu(null);
                  }}
                  className={[
                    'flex w-full items-center gap-2 px-4 py-2 text-left text-sm transition-colors duration-200',
                    filterUserName === null
                      ? 'bg-red-100 font-medium text-red-700'
                      : 'text-gray-700 hover:bg-red-50',
                  ].join(' ')}
                >
                  <IconGridAll className="h-4 w-4 shrink-0 text-red-500" />
                  <span>Todos os usuarios</span>
                </button>
                <div className="my-1 border-t border-gray-100" />
                <div className="max-h-[min(50vh,280px)] overflow-y-auto">
                  {uniqueUserNames.map((name) => {
                    const active = filterUserName === name;
                    return (
                      <button
                        key={name}
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setFilterUserName(name);
                          setOpenFilterMenu(null);
                        }}
                        className={[
                          'flex w-full items-center gap-2 px-4 py-2 text-left text-sm transition-colors duration-200',
                          active
                            ? 'bg-red-100 font-medium text-red-700'
                            : 'text-gray-700 hover:bg-red-50',
                        ].join(' ')}
                      >
                        <IconUser className="h-4 w-4 shrink-0 text-red-500" />
                        <span>{name}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="my-1 border-t border-gray-100" />
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setFilterUserName(null);
                    setOpenFilterMenu(null);
                  }}
                  className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-500 transition-colors duration-200 hover:bg-gray-50"
                >
                  <IconX className="h-4 w-4 shrink-0" />
                  <span>Desativar filtro</span>
                </button>
              </FilterMenu>

              <button
                type="button"
                onClick={() => setExportOpen(true)}
                className="focus-ring inline-flex h-10 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white px-4 text-sm font-medium text-gray-800 shadow-sm transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Exportar
              </button>
            </div>
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
            ) : dayItems.length === 0 ? (
              <p className="p-8 text-center text-sm text-gray-500">
                Nenhuma bipagem neste dia útil. Escolha outra data ao lado ou abaixo.
              </p>
            ) : filteredItems.length === 0 ? (
              <p className="p-8 text-center text-sm text-gray-500">
                Nenhum registro com os filtros de modelo ou usuario selecionados. Ajuste os filtros
                acima.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50/90">
                      <th className="px-4 py-3 font-semibold text-gray-900">Codigo</th>
                      <th className="px-4 py-3 font-semibold text-gray-900">Modelo</th>
                      <th className="px-4 py-3 font-semibold text-gray-900">Data e hora</th>
                      <th className="px-4 py-3 font-semibold text-gray-900">Usuario</th>
                      <th className="w-14 px-2 py-3 text-right font-semibold text-gray-900">
                        <span className="sr-only">Excluir</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {paginatedItems.map((row, index) => {
                      const highlighted =
                        !!highlightCodigoNorm &&
                        row.code.toLowerCase().includes(highlightCodigoNorm);
                      return (
                      <tr
                        key={row.id ?? `${row.code}-${row.scannedAt}-${pageStartIndex + index}`}
                        id={typeof row.id === 'number' ? `bip-row-${row.id}` : undefined}
                        className={
                          highlighted
                            ? 'bg-red-50/90 ring-1 ring-inset ring-red-200/80 hover:bg-red-50'
                            : 'hover:bg-gray-50/80'
                        }
                      >
                        <td className="max-w-[220px] break-all px-4 py-3 font-medium text-gray-900">
                          {row.code}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-gray-700">{row.modeLabel}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-gray-600">{row.scannedAt}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-gray-600">{row.userName}</td>
                        <td className="whitespace-nowrap px-2 py-2 text-right align-middle">
                          {typeof row.id === 'number' ? (
                            <button
                              type="button"
                              onClick={() => setConfirmDelete({ id: row.id!, code: row.code })}
                              disabled={deletingId === row.id}
                              title="Excluir bipagem"
                              aria-label={`Excluir bipagem ${row.code}`}
                              className="focus-ring inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              <IconTrash className="h-5 w-5" />
                            </button>
                          ) : (
                            <span className="inline-block w-9" aria-hidden />
                          )}
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {!loading && filteredItems.length > 0 ? (
              <div className="flex flex-col gap-3 border-t border-gray-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-gray-600 sm:text-sm">
                  Mostrando {pageStartIndex + 1}-{Math.min(pageEndIndex, totalFilteredItems)} de{' '}
                  {totalFilteredItems} registros
                </p>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                  <label className="inline-flex items-center gap-2 text-xs text-gray-600 sm:text-sm">
                    <span>Por página</span>
                    <select
                      value={pageSize}
                      onChange={(e) => setPageSize(Number(e.target.value))}
                      className="focus-ring h-9 rounded-lg border border-gray-200 bg-white px-2 text-xs text-gray-800 sm:text-sm"
                      aria-label="Selecionar quantidade por página"
                    >
                      {PAGE_SIZE_OPTIONS.map((size) => (
                        <option key={size} value={size}>
                          {size}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                      disabled={currentPageSafe <= 1}
                      className="focus-ring h-9 rounded-lg border border-gray-200 bg-white px-3 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
                    >
                      Anterior
                    </button>
                    <span className="min-w-[5.5rem] text-center text-xs text-gray-700 sm:text-sm">
                      Página {currentPageSafe} de {totalPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                      disabled={currentPageSafe >= totalPages}
                      className="focus-ring h-9 rounded-lg border border-gray-200 bg-white px-3 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
                    >
                      Próxima
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
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
