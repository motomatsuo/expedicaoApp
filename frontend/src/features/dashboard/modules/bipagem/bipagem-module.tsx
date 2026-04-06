'use client';

import { BIPAGEM_MODES } from '@/features/bipagem/bipagem-catalog';
import { useEffect, useRef, useState } from 'react';
import { DashboardModuleShell } from '../../components/dashboard-module-shell';
import { useBipagemMetrics } from './use-bipagem-metrics';

type NamedMetric = { label: string; value: number };

const MODE_COLORS = ['#14B8A6', '#3B82F6', '#8B5CF6', '#F97316'];

function formatValue(value: number) {
  return new Intl.NumberFormat('pt-BR').format(value);
}

function formatDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDefaultDateRange(): { from: string; to: string } {
  const toDate = new Date();
  const fromDate = new Date(toDate);
  fromDate.setDate(fromDate.getDate() - 6);
  return {
    from: formatDateInput(fromDate),
    to: formatDateInput(toDate),
  };
}

function KpiCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: number;
  hint: string;
  tone: 'teal' | 'blue' | 'violet' | 'orange';
}) {
  const toneClasses = {
    teal: 'from-teal-500/15 to-cyan-500/5 text-teal-700',
    blue: 'from-blue-500/15 to-sky-500/5 text-blue-700',
    violet: 'from-violet-500/15 to-indigo-500/5 text-violet-700',
    orange: 'from-orange-500/15 to-amber-500/5 text-orange-700',
  }[tone];

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-gray-200/80 bg-white p-4 shadow-[0_8px_24px_-16px_rgba(15,23,42,0.35)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_28px_-18px_rgba(15,23,42,0.45)] sm:p-5">
      <div className={`absolute -right-10 -top-10 h-24 w-24 rounded-full bg-gradient-to-br ${toneClasses} blur-2xl`} aria-hidden />
      <div className="relative">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
        <p className="mt-2 text-2xl font-bold tabular-nums text-gray-900 sm:text-[1.75rem]">{formatValue(value)}</p>
        <div className="mt-3 flex items-center justify-between">
          <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-medium text-gray-600">
            {hint}
          </span>
          <span className="text-xs font-semibold text-gray-400">Atualizado agora</span>
        </div>
      </div>
    </div>
  );
}

function DonutChart({
  data,
  total: totalCount,
}: {
  data: NamedMetric[];
  total: number;
}) {
  const values = data.map((item) => item.value);
  const total = values.reduce((acc, value) => acc + value, 0) || 1;
  const r = 42;
  const c = 2 * Math.PI * r;
  const segments = values.reduce<Array<{ length: number; offset: number; index: number; value: number }>>(
    (acc, value, index) => {
      if (value <= 0) {
        return acc;
      }

      const lastSegment = acc[acc.length - 1];
      const previousOffset = lastSegment ? lastSegment.offset + lastSegment.length : 0;
      const length = (value / total) * c;
      acc.push({ length, offset: previousOffset, index, value });
      return acc;
    },
    [],
  );

  return (
    <div className="grid gap-4 sm:grid-cols-[148px_1fr] sm:items-center">
      <div className="relative mx-auto h-36 w-36">
        <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" role="img" aria-label="Distribuicao por modo de bipagem">
          <circle cx="60" cy="60" r={r} fill="none" stroke="#EEF2F7" strokeWidth="13" />
          {segments.map((segment) => {
            return (
              <circle
                key={`${MODE_COLORS[segment.index]}-${segment.index}`}
                cx="60"
                cy="60"
                r={r}
                fill="none"
                stroke={MODE_COLORS[segment.index % MODE_COLORS.length]}
                strokeWidth="13"
                strokeDasharray={`${segment.length} ${c - segment.length}`}
                strokeDashoffset={-segment.offset}
                strokeLinecap="round"
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[11px] font-medium uppercase tracking-wide text-gray-400">Total</span>
          <span className="text-2xl font-bold tabular-nums text-gray-900">{formatValue(totalCount)}</span>
        </div>
      </div>
      <ul className="space-y-2.5">
        {data.map((item, index) => {
          const percent = total > 0 ? Math.round((item.value / total) * 100) : 0;
          return (
            <li key={item.label} className="rounded-xl border border-gray-100 bg-gray-50/70 px-3 py-2">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: MODE_COLORS[index % MODE_COLORS.length] }}
                    aria-hidden
                  />
                  <span className="truncate text-xs font-medium text-gray-700">{item.label}</span>
                </div>
                <span className="text-xs font-semibold tabular-nums text-gray-900">{percent}%</span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function LineChart({ data }: { data: NamedMetric[] }) {
  const width = 360;
  const height = 198;
  const padX = 24;
  const padY = 26;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2 - 18;
  const max = Math.max(...data.map((item) => item.value), 1);
  const ticks = 4;

  const points = data
    .map((item, index) => {
      const x = padX + (index / Math.max(data.length - 1, 1)) * innerW;
      const y = padY + innerH - (item.value / max) * innerH;
      return { x, y, value: item.value, label: item.label };
    })
    .filter(Boolean);

  const linePath = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');
  const areaPath = points.length
    ? `${linePath} L ${points[points.length - 1]?.x ?? 0} ${padY + innerH} L ${points[0]?.x ?? 0} ${padY + innerH} Z`
    : '';

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-48 w-full" role="img" aria-label="Tendencia diaria de bipagem">
        <defs>
          <linearGradient id="trend-fill" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.24" />
            <stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
          </linearGradient>
        </defs>
        {Array.from({ length: ticks + 1 }).map((_, index) => {
          const y = padY + (index / ticks) * innerH;
          return (
            <line
              key={`grid-${index}`}
              x1={padX}
              y1={y}
              x2={width - padX}
              y2={y}
              stroke={index === ticks ? '#D1D5DB' : '#EEF2F7'}
              strokeDasharray={index === ticks ? undefined : '3 4'}
            />
          );
        })}
        {areaPath ? <path d={areaPath} fill="url(#trend-fill)" /> : null}
        <path d={linePath} fill="none" stroke="#2563EB" strokeWidth="3.2" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((point) => (
          <g key={`${point.label}-${point.value}`}>
            <circle cx={point.x} cy={point.y} r="4.2" fill="#ffffff" stroke="#2563EB" strokeWidth="2.4" />
            <text x={point.x} y={point.y - 10} textAnchor="middle" className="fill-gray-500 text-[9px] font-semibold">
              {formatValue(point.value)}
            </text>
          </g>
        ))}
      </svg>
      <div className="mt-2 grid grid-cols-4 gap-2 text-[10px] font-medium text-gray-500 sm:grid-cols-7">
        {data.map((item) => (
          <span key={item.label} className="truncate">
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function VerticalTopUsersChart({ data }: { data: NamedMetric[] }) {
  const topUsers = data.slice(0, 8);
  const max = Math.max(...topUsers.map((item) => item.value), 1);
  const colors = ['#0EA5E9', '#14B8A6', '#8B5CF6', '#F97316', '#F43F5E', '#64748B', '#06B6D4', '#A855F7'];

  return (
    <div className="space-y-3">
      <div className="flex h-52 items-end gap-2 overflow-x-auto rounded-xl border border-gray-100 bg-gray-50/60 p-3">
        {topUsers.map((item, index) => {
          const height = Math.max(14, Math.round((item.value / max) * 100));
          return (
            <div key={item.label} className="flex min-w-[56px] flex-1 flex-col items-center justify-end gap-2">
              <span className="text-[11px] font-semibold tabular-nums text-gray-700">{formatValue(item.value)}</span>
              <div className="flex h-36 w-full items-end rounded-md bg-white/70 px-1.5 pb-1.5">
                <div
                  className="w-full rounded-md transition-all duration-300"
                  style={{
                    height: `${height}%`,
                    backgroundColor: colors[index % colors.length],
                  }}
                  aria-hidden
                />
              </div>
              <span className="w-full truncate text-center text-[10px] font-medium text-gray-600">
                {item.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PeakHourHeatmap({
  data,
}: {
  data?: Array<{ weekday: number; hour: number; count: number }>;
}) {
  const weekDays = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'];
  const hours = Array.from({ length: 12 }, (_, i) => i + 8);
  const source = data ?? [];
  const matrix = new Map<string, number>();

  for (const weekday of [1, 2, 3, 4, 5]) {
    for (const hour of hours) {
      matrix.set(`${weekday}-${hour}`, 0);
    }
  }
  for (const item of source) {
    if (item.hour >= 8 && item.hour <= 19 && item.weekday >= 1 && item.weekday <= 5) {
      matrix.set(`${item.weekday}-${item.hour}`, item.count);
    }
  }

  const cells = [...matrix.entries()].map(([key, count]) => {
    const [weekdayStr, hourStr] = key.split('-');
    return { weekday: Number(weekdayStr), hour: Number(hourStr), count };
  });
  const max = Math.max(...cells.map((item) => item.count), 1);
  const peak = cells.reduce(
    (acc, item) => (item.count > acc.count ? item : acc),
    { weekday: 1, hour: 8, count: 0 },
  );

  function getCellColor(count: number): string {
    const intensity = count / max;
    if (intensity === 0) return '#F3F4F6';
    if (intensity < 0.25) return '#DBEAFE';
    if (intensity < 0.5) return '#93C5FD';
    if (intensity < 0.75) return '#3B82F6';
    return '#1D4ED8';
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-3">
        <div className="w-full">
          <div>
            <div className="mb-2 grid grid-cols-[34px_repeat(12,minmax(0,1fr))] gap-0.5 sm:grid-cols-[38px_repeat(12,minmax(0,1fr))] sm:gap-1">
              <div className="text-[10px] text-gray-400">Dia</div>
              {hours.map((hour) => (
                <p key={hour} className="text-center text-[9px] font-medium text-gray-500 sm:text-[10px]">
                  {hour.toString().padStart(2, '0')}
                </p>
              ))}
            </div>
            {weekDays.map((dayLabel, index) => {
              const weekday = index + 1;
              return (
                <div
                  key={dayLabel}
                  className="grid grid-cols-[34px_repeat(12,minmax(0,1fr))] gap-0.5 py-0.5 sm:grid-cols-[38px_repeat(12,minmax(0,1fr))] sm:gap-1"
                >
                  <p className="pr-1 text-right text-[10px] font-semibold text-gray-600">{dayLabel}</p>
                  {hours.map((hour) => {
                    const count = matrix.get(`${weekday}-${hour}`) ?? 0;
                    return (
                      <div
                        key={`${dayLabel}-${hour}`}
                        className="h-6 rounded border border-white/80"
                        style={{ backgroundColor: getCellColor(count) }}
                        title={`${dayLabel} ${hour.toString().padStart(2, '0')}:00 - ${count}`}
                        aria-label={`${dayLabel} ${hour.toString().padStart(2, '0')} horas: ${count} bipagens`}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 text-xs">
        <p className="text-gray-600">
          Pico:{' '}
          <span className="font-semibold text-gray-900">
            {weekDays[peak.weekday - 1]} {peak.hour.toString().padStart(2, '0')}:00
          </span>
        </p>
        <p className="text-gray-600">
          Volume: <span className="font-semibold text-gray-900">{formatValue(peak.count)}</span>
        </p>
      </div>
    </div>
  );
}

export function BipagemModule() {
  const moduleContainerRef = useRef<HTMLDivElement | null>(null);
  const defaultRange = getDefaultDateRange();
  const [fromDate, setFromDate] = useState(defaultRange.from);
  const [toDate, setToDate] = useState(defaultRange.to);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { data, loading, error, reload } = useBipagemMetrics({
    from: fromDate,
    to: toDate,
  });
  const shellDescription = 'Visao consolidada dos principais numeros de bipagem.';

  useEffect(() => {
    function handleFullscreenChange() {
      setIsFullscreen(document.fullscreenElement === moduleContainerRef.current);
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  async function toggleBrowserFullscreen() {
    const moduleElement = moduleContainerRef.current;
    if (!moduleElement) {
      return;
    }

    try {
      if (document.fullscreenElement !== moduleElement) {
        await moduleElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // Sem suporte/permissão: mantém apenas o modo expandido interno.
      setIsFullscreen((prev) => !prev);
    }
  }

  if (loading) {
    return (
      <DashboardModuleShell moduleTitle="Bipagem" moduleDescription={shellDescription}>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={`kpi-loading-${index}`} className="h-28 animate-pulse rounded-2xl border border-gray-200 bg-gray-100/70" />
            ))}
          </div>
          <div className="h-56 animate-pulse rounded-2xl border border-gray-200 bg-gray-100/70" />
        </div>
      </DashboardModuleShell>
    );
  }

  if (error) {
    return (
      <DashboardModuleShell moduleTitle="Bipagem" moduleDescription={shellDescription}>
        <div className="rounded-2xl border border-red-200 bg-gradient-to-br from-red-50 via-white to-red-100 p-5">
          <p className="text-sm font-medium text-red-700">{error}</p>
          <button
            type="button"
            onClick={() => void reload()}
            className="focus-ring mt-4 rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100"
          >
            Tentar novamente
          </button>
        </div>
      </DashboardModuleShell>
    );
  }

  if (!data || data.total === 0) {
    return (
      <DashboardModuleShell moduleTitle="Bipagem" moduleDescription={shellDescription}>
        <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-gray-50 via-white to-gray-100 p-8 text-center">
          <p className="text-sm font-medium text-gray-600">Nenhum dado de bipagem encontrado para o periodo.</p>
          <p className="mt-1 text-xs text-gray-500">Ajuste o periodo ou aguarde novas operacoes para visualizar metricas.</p>
        </div>
      </DashboardModuleShell>
    );
  }

  const totalShopee = (data.byMode.shopee_comum ?? 0) + (data.byMode.shopee_entrega_rapida ?? 0);
  const totalMeli = (data.byMode.mercado_livre_comum ?? 0) + (data.byMode.mercado_livre_flex ?? 0);
  const modeChartData: NamedMetric[] = BIPAGEM_MODES.map((mode) => ({ label: mode.label, value: data.byMode[mode.id] ?? 0 }));
  const trendChartData = data.byDay.map((day) => ({
    label: day.date.split('-').slice(1).reverse().join('/'),
    value: day.total,
  }));
  const topUserChartData: NamedMetric[] = data.byUser.map((user) => ({ label: user.user, value: user.count }));
  return (
    <div
      ref={moduleContainerRef}
      className={
        isFullscreen
          ? 'fixed inset-0 z-[130] overflow-y-auto bg-[#f5f6fa] p-3 sm:p-6'
          : ''
      }
    >
      <DashboardModuleShell
        moduleTitle="Bipagem"
        moduleDescription={shellDescription}
        headerRight={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:gap-2">
            <button
              type="button"
              onClick={() => void toggleBrowserFullscreen()}
              className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-700 transition hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-300 sm:inline-flex"
              title={isFullscreen ? 'Sair do fullscreen' : 'Fullscreen do modulo'}
              aria-label={isFullscreen ? 'Sair do fullscreen' : 'Fullscreen do modulo'}
            >
              {isFullscreen ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                  <path
                    d="M8 3H3v5M16 3h5v5M8 21H3v-5M21 16v5h-5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                  <path
                    d="M15 3h6v6M9 3H3v6M21 15v6h-6M3 15v6h6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </button>
            <div className="w-full rounded-lg bg-white p-2 sm:w-auto">
              <div className="flex flex-nowrap items-center gap-2 sm:grid sm:grid-cols-[auto_auto_auto] sm:items-end">
                <label className="block">
                  <input
                    type="date"
                    value={fromDate}
                    max={toDate}
                    onChange={(event) => setFromDate(event.target.value)}
                    className="focus-ring h-8 w-[118px] rounded-md border border-gray-200 bg-gray-50 px-2 text-xs text-gray-800 sm:w-[126px]"
                  />
                </label>
                <label className="block">
                  <input
                    type="date"
                    value={toDate}
                    min={fromDate}
                    onChange={(event) => setToDate(event.target.value)}
                    className="focus-ring h-8 w-[118px] rounded-md border border-gray-200 bg-gray-50 px-2 text-xs text-gray-800 sm:w-[126px]"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const range = getDefaultDateRange();
                    setFromDate(range.from);
                    setToDate(range.to);
                  }}
                  className="focus-ring hidden h-8 rounded-md border border-gray-200 bg-white px-3 text-xs font-medium text-gray-700 transition hover:bg-gray-50 sm:inline-flex sm:items-center"
                >
                  7 dias
                </button>
              </div>
            </div>
          </div>
        }
      >
      <div className="space-y-5 sm:space-y-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Total no periodo" value={data.total} hint="Volume geral" tone="teal" />
          <KpiCard label="Total Shopee" value={totalShopee} hint="Canal Shopee" tone="blue" />
          <KpiCard label="Total MELI" value={totalMeli} hint="Canal MELI" tone="violet" />
          <KpiCard label="Top usuario" value={data.byUser[0]?.count ?? 0} hint={data.byUser[0]?.user ?? 'Sem ranking'} tone="orange" />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <div className="rounded-2xl border border-gray-200/80 bg-white p-4 shadow-[0_8px_24px_-16px_rgba(15,23,42,0.35)] sm:p-5 xl:col-span-5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-gray-900">Distribuicao por modo</h3>
              <span className="rounded-full bg-teal-50 px-2.5 py-1 text-[11px] font-semibold text-teal-700">Atual</span>
            </div>
            <div className="mt-4">
              <DonutChart data={modeChartData} total={data.total} />
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200/80 bg-white p-4 shadow-[0_8px_24px_-16px_rgba(15,23,42,0.35)] sm:p-5 xl:col-span-7">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-gray-900">Tendencia diaria</h3>
              <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">{trendChartData.length} dias</span>
            </div>
            <div className="mt-3">
              <LineChart data={trendChartData} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <div className="rounded-2xl border border-gray-200/80 bg-white p-4 shadow-[0_8px_24px_-16px_rgba(15,23,42,0.35)] sm:p-5 xl:col-span-6">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-gray-900">Top usuarios</h3>
              <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-700">
                Barras verticais
              </span>
            </div>
            <div className="mt-4">
              <VerticalTopUsersChart data={topUserChartData} />
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200/80 bg-white p-4 shadow-[0_8px_24px_-16px_rgba(15,23,42,0.35)] sm:p-5 xl:col-span-6">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-gray-900">Horario de pico</h3>
              <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
                Seg-Sex | 08h-19h
              </span>
            </div>
            <div className="mt-4">
              <PeakHourHeatmap data={data.byWeekdayHour ?? []} />
            </div>
          </div>
        </div>

      </div>
      </DashboardModuleShell>
    </div>
  );
}
