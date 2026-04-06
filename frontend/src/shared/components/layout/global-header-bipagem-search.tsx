'use client';

import { BIPAGEM_MODES } from '@/features/bipagem/bipagem-catalog';
import { ROUTES } from '@/shared/constants/routes';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

type BipagemApiRow = {
  id: number;
  created_at: string;
  plataforma: string;
  atendente: string;
  codigo: string;
};

function modeLabel(id: string) {
  return BIPAGEM_MODES.find((m) => m.id === id)?.label ?? id;
}

function formatRowDate(iso: string) {
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function GlobalHeaderBipagemSearch() {
  const router = useRouter();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<BipagemApiRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const goToLista = useCallback(
    (codigo: string) => {
      const c = codigo.trim();
      if (!c) return;
      router.push(`${ROUTES.listaBipagem}?${new URLSearchParams({ codigo: c }).toString()}`);
      setQuery('');
      setResults([]);
      setOpen(false);
    },
    [router],
  );

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    const ac = new AbortController();
    const timer = window.setTimeout(() => {
      void (async () => {
        setLoading(true);
        try {
          const res = await fetch(
            `${apiUrl}/bipagem?${new URLSearchParams({ codigo: q }).toString()}`,
            { credentials: 'include', cache: 'no-store', signal: ac.signal },
          );
          if (!res.ok) {
            if (!ac.signal.aborted) setResults([]);
            return;
          }
          const data = (await res.json()) as { items?: BipagemApiRow[] };
          if (!ac.signal.aborted) {
            setResults(data.items ?? []);
          }
        } catch {
          if (!ac.signal.aborted) setResults([]);
        } finally {
          if (!ac.signal.aborted) setLoading(false);
        }
      })();
    }, 320);
    return () => {
      window.clearTimeout(timer);
      ac.abort();
    };
  }, [query, apiUrl]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const showPanel = open && query.trim().length >= 2;

  return (
    <div ref={wrapRef} className="relative w-full max-w-[13rem] sm:max-w-xl">
      <div className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-gray-400"
          aria-hidden
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
      </div>
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            const t = query.trim();
            if (t.length >= 2) {
              if (results.length === 1) {
                goToLista(results[0].codigo);
              } else {
                goToLista(t);
              }
            }
          }
        }}
        className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-10 pr-16 text-sm text-gray-800 shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-200 sm:pr-20 sm:text-base"
        placeholder="Código de bipagem…"
        aria-label="Pesquisar código de bipagem"
        autoComplete="off"
      />
      <div className="absolute bottom-0 right-0 top-0 flex items-center py-[3px] pr-[3px]">
        <span className="pointer-events-none px-1.5 text-lg text-gray-300 sm:px-2">|</span>
        <Link
          href={ROUTES.bipagem}
          className="flex h-full shrink-0 items-center justify-center rounded-r-lg bg-[#F9FAFB] px-1.5 text-red-600 transition-all duration-200 hover:bg-[#E5E7EB] hover:text-red-700 sm:px-2"
          title="Ir para Bipagem"
          aria-label="Ir para Bipagem"
        >
          <svg
            width="16"
            height="16"
            className="sm:h-6 sm:w-6"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            viewBox="0 0 24 24"
            aria-hidden
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </Link>
      </div>

      {showPanel ? (
        <div
          className="absolute left-0 right-0 top-[calc(100%+4px)] z-[120] max-h-[min(22rem,50vh)] overflow-auto rounded-xl border border-gray-200 bg-white py-1 shadow-lg"
          role="listbox"
          aria-label="Resultados da busca"
        >
          {loading ? (
            <p className="px-3 py-2.5 text-sm text-gray-500">Buscando…</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-2.5 text-sm text-gray-500">Nenhuma bipagem com esse código.</p>
          ) : (
            results.map((row) => (
              <button
                key={row.id}
                type="button"
                role="option"
                className="flex w-full flex-col gap-0.5 border-b border-gray-50 px-3 py-2.5 text-left last:border-b-0 hover:bg-red-50/60"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => goToLista(row.codigo)}
              >
                <span className="break-all text-sm font-semibold text-gray-900">{row.codigo}</span>
                <span className="text-xs text-gray-600">
                  {modeLabel(row.plataforma)} · {formatRowDate(row.created_at)}
                </span>
                <span className="text-xs text-gray-500">{row.atendente}</span>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
