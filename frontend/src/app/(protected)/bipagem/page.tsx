'use client';

import { BrowserMultiFormatReader } from '@zxing/browser';
import { useCallback, useEffect, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  BIPAGEM_MODES,
  mapApiBipagemToScanRow,
  type BipagemMode,
  type BipagemModeId,
  type BipagemScanRow,
} from '@/features/bipagem/bipagem-catalog';
import {
  BIPAGEM_LIST_BROADCAST_CHANNEL,
  notifyBipagemListChanged,
} from '@/features/bipagem/bipagem-list-sync';

type SoundProfileId = 'digital' | 'alerta' | 'supermercado';

function IconBipagemFooter({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 7V5a2 2 0 0 1 2-2h2" />
      <path d="M17 3h2a2 2 0 0 1 2 2v2" />
      <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
      <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
      <path d="M7 12h6M12 7v10" />
    </svg>
  );
}

function IconListaFooter({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
}

/** Evita perder bipagens locais quando o GET inicial termina depois do POST (corrida de rede/cache). */
function mergeBipagemRowsById(
  serverItems: BipagemScanRow[],
  previous: BipagemScanRow[],
): BipagemScanRow[] {
  const byId = new Map<number, BipagemScanRow>();
  for (const row of serverItems) {
    if (typeof row.id === 'number') {
      byId.set(row.id, row);
    }
  }
  for (const row of previous) {
    if (typeof row.id === 'number' && !byId.has(row.id)) {
      byId.set(row.id, row);
    }
  }
  const merged = Array.from(byId.values());
  merged.sort((a, b) => (b.id ?? 0) - (a.id ?? 0));
  return merged;
}

export default function BipagemPage() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const lastHandledRef = useRef<{ code: string; ts: number }>({ code: '', ts: 0 });
  const audioContextRef = useRef<AudioContext | null>(null);
  const [selectedMode, setSelectedMode] = useState<BipagemModeId | null>(null);
  const [scannedCodes, setScannedCodes] = useState<BipagemScanRow[]>([]);
  const [currentUserName, setCurrentUserName] = useState<string>('Usuario');
  const [pendingMercadoLivreCode, setPendingMercadoLivreCode] = useState<string | null>(null);
  const [pendingShopeeCode, setPendingShopeeCode] = useState<string | null>(null);
  const [error, setError] = useState<string>('');
  const [popupMessage, setPopupMessage] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [status, setStatus] = useState<'idle' | 'success'>('idle');
  const [bipagemModalOpen, setBipagemModalOpen] = useState(false);
  const [listaModalOpen, setListaModalOpen] = useState(false);

  const openBipagemModal = useCallback(() => {
    setListaModalOpen(false);
    setBipagemModalOpen(true);
  }, []);

  const openListaModal = useCallback(() => {
    setBipagemModalOpen(false);
    setListaModalOpen(true);
  }, []);

  const registerValidScan = useCallback(
    async (code: string, mode: BipagemMode) => {
      const now = Date.now();
      const duplicatedQuickScan =
        lastHandledRef.current.code === code && now - lastHandledRef.current.ts < 2000;
      if (duplicatedQuickScan) {
        return;
      }

      lastHandledRef.current = { code, ts: now };

      try {
        const response = await fetch(`${apiUrl}/bipagem`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            codigo: code,
            atendente: currentUserName,
            plataforma: mode.id,
          }),
        });

        if (!response.ok) {
          if (response.status === 409) {
            setPopupMessage('Esse codigo ja foi bipado.');
            setSuccessMessage('');
            setStatus('idle');
            return;
          }

          throw new Error('Falha ao salvar bipagem.');
        }

        const data = (await response.json()) as {
          item?: {
            id: number;
            created_at: string;
            plataforma: string;
            atendente: string;
            codigo: string;
          };
        };

        const item = data.item;
        if (!item) {
          throw new Error('Resposta invalida ao salvar bipagem.');
        }

        setScannedCodes((previous) => [mapApiBipagemToScanRow(item), ...previous]);
        setError('');
        setSuccessMessage(`Leitura valida para ${mode.label}.`);
        setStatus('success');
        playBeep(audioContextRef, 'alerta');
        notifyBipagemListChanged();
      } catch {
        setError('Nao foi possivel salvar a bipagem no servidor.');
        setSuccessMessage('');
        setStatus('idle');
      }
    },
    [apiUrl, currentUserName],
  );

  useEffect(() => {
    async function fetchCurrentUser() {
      try {
        const response = await fetch(`${apiUrl}/auth/me`, {
          method: 'GET',
          credentials: 'include',
        });

        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as {
          user?: { nome?: string | null };
        };

        if (data.user?.nome) {
          setCurrentUserName(data.user.nome);
        }
      } catch {
        // Mantem fallback silencioso.
      }
    }

    void fetchCurrentUser();
  }, [apiUrl]);

  useEffect(() => {
    const reader = new BrowserMultiFormatReader();
    let active = true;

    async function startScanner() {
      if (!videoRef.current) {
        return;
      }

      try {
        controlsRef.current = await reader.decodeFromVideoDevice(
          undefined,
          videoRef.current,
          (result, scanError) => {
            if (!active) {
              return;
            }

            if (pendingMercadoLivreCode || pendingShopeeCode) {
              return;
            }

            if (result) {
              const rawCode = result.getText().trim();
              const mode = BIPAGEM_MODES.find((item) => item.id === selectedMode) ?? null;

              if (!mode) {
                return;
              }

              const code = normalizeScannedCode(rawCode, mode.platform);
              const mercadoLivreNormalizedCode = normalizeScannedCode(rawCode, 'mercado_livre');
              const validation = validateCodeForMode(code, mode.platform);

              if (!validation.valid) {
                if (validation.reason === 'shopee_received_mercado_livre') {
                  setPendingMercadoLivreCode(mercadoLivreNormalizedCode);
                  setError('');
                  setSuccessMessage('');
                  setStatus('idle');
                  return;
                }

                if (validation.reason === 'mercado_livre_received_shopee') {
                  setPendingShopeeCode(code);
                  setError('');
                  setSuccessMessage('');
                  setStatus('idle');
                  return;
                }

                setError(validation.message);
                setSuccessMessage('');
                setStatus('idle');
                return;
              }

              void registerValidScan(code, mode);
              return;
            }

            if (
              scanError &&
              !(scanError instanceof Error && scanError.name === 'NotFoundException')
            ) {
              setError('Erro ao processar o QR Code.');
            }
          },
        );
      } catch {
        setError('Nao foi possivel acessar a camera do dispositivo.');
      }
    }

    void startScanner();

    return () => {
      active = false;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [pendingMercadoLivreCode, pendingShopeeCode, registerValidScan, selectedMode]);

  const fetchScansFromServer = useCallback(async () => {
    try {
      const response = await fetch(`${apiUrl}/bipagem`, {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
      });

      if (!response.ok) {
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

      const serverItems = (data.items ?? []).map(mapApiBipagemToScanRow);
      setScannedCodes((previous) => mergeBipagemRowsById(serverItems, previous));
    } catch {
      // Mantem lista local em caso de erro.
    }
  }, [apiUrl]);

  useEffect(() => {
    void fetchScansFromServer();
  }, [fetchScansFromServer]);

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') {
      return;
    }
    const channel = new BroadcastChannel(BIPAGEM_LIST_BROADCAST_CHANNEL);
    channel.onmessage = () => void fetchScansFromServer();
    return () => channel.close();
  }, [fetchScansFromServer]);

  useEffect(() => {
    if (typeof EventSource === 'undefined') {
      return;
    }
    const url = `${apiUrl}/bipagem/stream`;
    const es = new EventSource(url, { withCredentials: true });
    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data) as { type?: string };
        if (data.type === 'bipagem-list-changed') {
          void fetchScansFromServer();
        }
      } catch {
        // ping ou payload invalido
      }
    };
    return () => es.close();
  }, [apiUrl, fetchScansFromServer]);

  function handleSelectMode(modeId: BipagemModeId) {
    setSelectedMode(modeId);
    setError('');
    setSuccessMessage('');
    setStatus('idle');
    setBipagemModalOpen(false);
  }

  function resetModeSelection() {
    setSelectedMode(null);
    clearRead();
  }

  function clearRead() {
    setError('');
    setSuccessMessage('');
    setStatus('idle');
  }

  function clearScannedList() {
    const idsToDelete = scannedCodes
      .map((scan) => scan.id)
      .filter((id): id is number => typeof id === 'number');
    if (idsToDelete.length > 0) {
      void Promise.all(
        idsToDelete.map((id) =>
          fetch(`${apiUrl}/bipagem/${id}`, {
            method: 'DELETE',
            credentials: 'include',
          }),
        ),
      ).then(() => {
        notifyBipagemListChanged();
      });
    }

    setScannedCodes([]);
    clearRead();
  }

  function confirmMercadoLivreMode(modeId: 'mercado_livre_comum' | 'mercado_livre_flex') {
    if (!pendingMercadoLivreCode) {
      return;
    }

    const mode = BIPAGEM_MODES.find((item) => item.id === modeId);
    if (!mode) {
      return;
    }

    setSelectedMode(modeId);
    void registerValidScan(normalizeScannedCode(pendingMercadoLivreCode, 'mercado_livre'), mode);
    setPendingMercadoLivreCode(null);
  }

  function confirmShopeeMode(modeId: 'shopee_comum' | 'shopee_entrega_rapida') {
    if (!pendingShopeeCode) {
      return;
    }

    const mode = BIPAGEM_MODES.find((item) => item.id === modeId);
    if (!mode) {
      return;
    }

    setSelectedMode(modeId);
    void registerValidScan(pendingShopeeCode, mode);
    setPendingShopeeCode(null);
  }

  function deleteScan(scan: BipagemScanRow) {
    if (typeof scan.id !== 'number') {
      setScannedCodes((previous) =>
        previous.filter((item) => item.scannedAt !== scan.scannedAt || item.code !== scan.code),
      );
      return;
    }

    void (async () => {
      try {
        const response = await fetch(`${apiUrl}/bipagem/${scan.id}`, {
          method: 'DELETE',
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error('Falha ao excluir bipagem.');
        }

        setScannedCodes((previous) => previous.filter((item) => item.id !== scan.id));
        notifyBipagemListChanged();
      } catch {
        setError('Nao foi possivel excluir a bipagem.');
      }
    })();
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col bg-white">
      <div className="relative min-h-0 flex-1 bg-black">
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover"
          muted
          playsInline
        />
        <div
          className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-6"
          aria-hidden
        >
          <div className="relative aspect-square w-[min(72vw,50dvh,20rem)] drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)]">
            <span className="absolute left-0 top-0 h-10 w-10 rounded-tl-xl border-l-[3px] border-t-[3px] border-white" />
            <span className="absolute right-0 top-0 h-10 w-10 rounded-tr-xl border-r-[3px] border-t-[3px] border-white" />
            <span className="absolute bottom-0 left-0 h-10 w-10 rounded-bl-xl border-b-[3px] border-l-[3px] border-white" />
            <span className="absolute bottom-0 right-0 h-10 w-10 rounded-br-xl border-b-[3px] border-r-[3px] border-white" />
          </div>
        </div>
        <div
          className="pointer-events-none absolute inset-x-0 bottom-[calc(1.25rem+env(safe-area-inset-bottom,0px))] z-20 flex justify-center px-3"
          role="status"
          aria-live="polite"
        >
          <div className="max-w-[calc(100vw-1.5rem)] rounded-full border border-white/35 bg-black/35 px-4 py-1.5 text-center text-xs font-medium text-white shadow-md backdrop-blur-sm sm:text-sm">
            {selectedMode ? (
              <span>
                Modo:{' '}
                <span className="font-semibold text-white">
                  {BIPAGEM_MODES.find((m) => m.id === selectedMode)?.label}
                </span>
              </span>
            ) : (
              <span>Toque no icone de bipagem para escolher o modo</span>
            )}
            <span className="mx-2 text-white/40" aria-hidden>
              |
            </span>
            <span
              className={
                status === 'success'
                  ? 'text-green-300'
                  : selectedMode
                    ? 'text-green-300'
                    : 'text-white/70'
              }
            >
              {status === 'success'
                ? 'Leitura valida'
                : selectedMode
                  ? 'Pronto'
                  : 'Aguardando modo'}
            </span>
          </div>
        </div>
      </div>

      <footer className="relative z-30 w-full shrink-0 bg-white">
        <nav
          className="flex w-full items-stretch gap-1 rounded-t-2xl border-t border-gray-200/90 bg-white py-2 pl-3 pr-3 shadow-[0_-10px_40px_rgba(15,23,42,0.08)] sm:rounded-t-[1.35rem] sm:py-2.5 sm:pl-5 sm:pr-5 pb-[max(0.65rem,env(safe-area-inset-bottom))] pt-3"
          aria-label="Ações de bipagem"
        >
          <button
            type="button"
            onClick={openBipagemModal}
            aria-label="Modo de bipagem"
            aria-pressed={bipagemModalOpen}
            title="Modo de bipagem"
            className={`focus-ring flex min-h-[3.25rem] flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-4 py-2 text-xs font-medium transition-all duration-200 sm:min-h-[3.5rem] sm:rounded-[0.625rem] ${
              bipagemModalOpen
                ? 'bg-[#980F0F]/10 text-[#980F0F] shadow-[inset_0_0_0_1px_rgba(152,15,15,0.18)]'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 active:bg-gray-100'
            }`}
          >
            <IconBipagemFooter className="h-6 w-6 shrink-0 sm:h-7 sm:w-7" />
            <span className="mt-0.5 text-[10px] font-semibold leading-tight sm:text-xs">Bipagem</span>
          </button>
          <span
            className="my-2 w-px shrink-0 self-stretch bg-gradient-to-b from-transparent via-gray-200 to-transparent"
            aria-hidden
          />
          <button
            type="button"
            onClick={openListaModal}
            aria-label="Lista de bipagens"
            aria-pressed={listaModalOpen}
            title="Lista de bipagens"
            className={`focus-ring flex min-h-[3.25rem] flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-4 py-2 text-xs font-medium transition-all duration-200 sm:min-h-[3.5rem] sm:rounded-[0.625rem] ${
              listaModalOpen
                ? 'bg-[#980F0F]/10 text-[#980F0F] shadow-[inset_0_0_0_1px_rgba(152,15,15,0.18)]'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 active:bg-gray-100'
            }`}
          >
            <IconListaFooter className="h-6 w-6 shrink-0 sm:h-7 sm:w-7" />
            <span className="mt-0.5 text-[10px] font-semibold leading-tight sm:text-xs">Lista</span>
          </button>
        </nav>
      </footer>

      {bipagemModalOpen ? (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 px-0 pb-0 backdrop-blur-sm sm:items-center sm:px-4 sm:pb-4"
          onClick={() => setBipagemModalOpen(false)}
          role="presentation"
        >
          <div
            className="flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-gray-200 bg-white shadow-xl sm:max-h-[85dvh] sm:max-w-lg sm:rounded-xl"
            role="dialog"
            aria-modal="true"
            aria-label="Modo de bipagem"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="min-h-0 flex-1 overflow-y-auto p-4 pt-5 sm:p-5">
              <div
                className={`mb-3 flex flex-wrap items-center gap-2 ${selectedMode ? 'justify-end' : ''}`}
              >
                {selectedMode ? (
                  <button
                    type="button"
                    onClick={() => {
                      resetModeSelection();
                    }}
                    className="focus-ring rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100 sm:text-sm"
                  >
                    Encerrar modo
                  </button>
                ) : (
                  <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Escolha o modo
                  </span>
                )}
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                {BIPAGEM_MODES.map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => handleSelectMode(mode.id)}
                    className={`focus-ring inline-flex min-h-11 items-center justify-center rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${
                      selectedMode === mode.id
                        ? 'border-[#980F0F] bg-[#980F0F]/10 text-[#980F0F]'
                        : 'border-gray-200 bg-gray-50 text-gray-800 hover:bg-gray-100'
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="shrink-0 border-t border-gray-100 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <button
                type="button"
                onClick={() => setBipagemModalOpen(false)}
                className="focus-ring h-10 w-full rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {listaModalOpen ? (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 px-0 pb-0 backdrop-blur-sm sm:items-center sm:px-4 sm:pb-4"
          onClick={() => setListaModalOpen(false)}
          role="presentation"
        >
          <div
            className="flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-gray-200 bg-white shadow-xl sm:max-h-[85dvh] sm:max-w-lg sm:rounded-xl"
            role="dialog"
            aria-modal="true"
            aria-label="Codigos bipados"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex min-h-0 flex-1 flex-col gap-3 p-4 pt-5 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {scannedCodes.length === 0
                    ? 'Nenhum codigo'
                    : `${scannedCodes.length} codigo${scannedCodes.length === 1 ? '' : 's'}`}
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={exportScansToXlsx}
                    disabled={scannedCodes.length === 0}
                    className="focus-ring rounded-lg bg-red-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
                  >
                    Exportar
                  </button>
                  <button
                    type="button"
                    onClick={clearScannedList}
                    className="focus-ring rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100 sm:text-sm"
                  >
                    Limpar lista
                  </button>
                </div>
              </div>

              {error ? (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
              ) : null}
              {successMessage ? (
                <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">{successMessage}</p>
              ) : null}

              <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-gray-200 bg-gray-50/80 p-2 sm:max-h-[min(50dvh,28rem)]">
                {scannedCodes.length > 0 ? (
                  <ul className="flex flex-col gap-2">
                    {scannedCodes.map((scan, index) => (
                      <li
                        key={scan.id ?? `${scan.code}-${scan.scannedAt}-${index}`}
                        className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 shadow-sm"
                      >
                        <p className="break-all text-sm font-semibold text-gray-900">{scan.code}</p>
                        <p className="mt-1 text-xs text-gray-500">{scan.scannedAt}</p>
                        <p className="text-xs text-gray-500">{scan.modeLabel}</p>
                        <p className="text-xs text-gray-500">{scan.userName}</p>
                        <button
                          type="button"
                          onClick={() => deleteScan(scan)}
                          className="focus-ring mt-2 inline-flex h-8 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 px-3 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100"
                        >
                          Excluir
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="py-8 text-center text-sm text-gray-500">Nenhum codigo bipado ainda.</p>
                )}
              </div>
            </div>

            <div className="shrink-0 border-t border-gray-100 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <button
                type="button"
                onClick={() => setListaModalOpen(false)}
                className="focus-ring h-10 w-full rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {pendingMercadoLivreCode ? (
        <div
          className="fixed inset-0 z-[110] flex items-end justify-center bg-black/50 px-0 pb-0 backdrop-blur-sm sm:items-center sm:px-4 sm:pb-4"
          onClick={() => setPendingMercadoLivreCode(null)}
          role="presentation"
        >
          <div
            className="flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-gray-200 bg-white shadow-xl sm:max-h-[85dvh] sm:max-w-lg sm:rounded-xl"
            role="dialog"
            aria-modal="true"
            aria-label="Modo incorreto — confirmar Mercado Livre"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="min-h-0 flex-1 overflow-y-auto p-4 pt-5 sm:p-5">
              <p className="rounded-lg bg-[#980F0F]/12 px-3 py-2.5 text-sm font-semibold text-[#980F0F]">
                Modo incorreto
              </p>
              <p className="mt-3 text-sm leading-relaxed text-gray-600">
                Este codigo nao corresponde ao modo selecionado. Escolha o modelo de Mercado Livre
                para confirmar a bipagem.
              </p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => confirmMercadoLivreMode('mercado_livre_comum')}
                  className="focus-ring inline-flex min-h-11 items-center justify-center rounded-xl border border-[#980F0F]/35 bg-[#980F0F]/10 px-3 py-2.5 text-sm font-medium text-[#980F0F] transition-colors hover:bg-[#980F0F]/15"
                >
                  Mercado Livre comum
                </button>
                <button
                  type="button"
                  onClick={() => confirmMercadoLivreMode('mercado_livre_flex')}
                  className="focus-ring inline-flex min-h-11 items-center justify-center rounded-xl border border-[#980F0F]/35 bg-[#980F0F]/10 px-3 py-2.5 text-sm font-medium text-[#980F0F] transition-colors hover:bg-[#980F0F]/15"
                >
                  Mercado Livre Flex
                </button>
              </div>
            </div>
            <div className="shrink-0 border-t border-gray-100 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <button
                type="button"
                onClick={() => setPendingMercadoLivreCode(null)}
                className="focus-ring h-10 w-full rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {pendingShopeeCode ? (
        <div
          className="fixed inset-0 z-[110] flex items-end justify-center bg-black/50 px-0 pb-0 backdrop-blur-sm sm:items-center sm:px-4 sm:pb-4"
          onClick={() => setPendingShopeeCode(null)}
          role="presentation"
        >
          <div
            className="flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-gray-200 bg-white shadow-xl sm:max-h-[85dvh] sm:max-w-lg sm:rounded-xl"
            role="dialog"
            aria-modal="true"
            aria-label="Modo incorreto — confirmar Shopee"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="min-h-0 flex-1 overflow-y-auto p-4 pt-5 sm:p-5">
              <p className="rounded-lg bg-[#980F0F]/12 px-3 py-2.5 text-sm font-semibold text-[#980F0F]">
                Modo incorreto
              </p>
              <p className="mt-3 text-sm leading-relaxed text-gray-600">
                Este codigo nao corresponde ao modo selecionado. Escolha o modelo Shopee para
                confirmar a bipagem.
              </p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => confirmShopeeMode('shopee_comum')}
                  className="focus-ring inline-flex min-h-11 items-center justify-center rounded-xl border border-[#980F0F]/35 bg-[#980F0F]/10 px-3 py-2.5 text-sm font-medium text-[#980F0F] transition-colors hover:bg-[#980F0F]/15"
                >
                  Shopee comum
                </button>
                <button
                  type="button"
                  onClick={() => confirmShopeeMode('shopee_entrega_rapida')}
                  className="focus-ring inline-flex min-h-11 items-center justify-center rounded-xl border border-[#980F0F]/35 bg-[#980F0F]/10 px-3 py-2.5 text-sm font-medium text-[#980F0F] transition-colors hover:bg-[#980F0F]/15"
                >
                  Shopee Entrega Rapida
                </button>
              </div>
            </div>
            <div className="shrink-0 border-t border-gray-100 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <button
                type="button"
                onClick={() => setPendingShopeeCode(null)}
                className="focus-ring h-10 w-full rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {popupMessage ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-gray-900">Aviso</h3>
            <p className="mt-2 text-sm text-gray-600">{popupMessage}</p>
            <button
              type="button"
              onClick={() => setPopupMessage('')}
              className="focus-ring mt-5 inline-flex h-10 w-full items-center justify-center rounded-lg bg-red-600 px-3 text-sm font-medium text-white transition-colors hover:bg-red-700"
            >
              Fechar
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );

  function exportScansToXlsx() {
    const rows = scannedCodes.map((scan) => ({
      Codigo: scan.code,
      Modelo: scan.modeLabel,
      Horario: scan.scannedAt,
      Usuario: scan.userName,
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows, {
      header: ['Codigo', 'Modelo', 'Horario', 'Usuario'],
    });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Bipagens');
    XLSX.writeFile(workbook, `bipagens_${new Date().getTime()}.xlsx`);
  }
}

function validateCodeForMode(
  code: string,
  platform: BipagemMode['platform'],
): { valid: boolean; message: string; reason?: string } {
  const normalizedCode = code.toUpperCase();
  const startsWithBr = normalizedCode.startsWith('BR');
  const isOnlyNumbers = /^\d+$/.test(code);

  if (platform === 'shopee') {
    if (!startsWithBr) {
      return {
        valid: false,
        message: '',
        reason: 'shopee_received_mercado_livre',
      };
    }

    return { valid: true, message: '' };
  }

  if (startsWithBr) {
    return {
      valid: false,
      message: '',
      reason: 'mercado_livre_received_shopee',
    };
  }

  if (!isOnlyNumbers) {
    return {
      valid: false,
      message: 'Este codigo nao corresponde ao modo Mercado Livre selecionado.',
    };
  }

  return { valid: true, message: '' };
}

function normalizeScannedCode(code: string, platform: BipagemMode['platform']): string {
  if (platform !== 'mercado_livre') {
    return code;
  }

  if (!code.startsWith('{') || !code.endsWith('}')) {
    return code;
  }

  try {
    const parsed = JSON.parse(code) as { id?: string | number };
    if (parsed.id !== undefined && parsed.id !== null) {
      return String(parsed.id).trim();
    }
  } catch {
    return code;
  }

  return code;
}

function playBeep(
  audioContextRef: { current: AudioContext | null },
  profile: SoundProfileId,
) {
  if (typeof window === 'undefined') {
    return;
  }

  const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) {
    return;
  }

  const context = audioContextRef.current ?? new AudioContextClass();
  audioContextRef.current = context;

  if (context.state === 'suspended') {
    void context.resume();
  }

  if (profile === 'alerta') {
    playAlertaBeep(context);
    return;
  }

  if (profile === 'supermercado') {
    playSupermercadoBeep(context);
    return;
  }

  playDigitalBeep(context);
}

function playDigitalBeep(context: AudioContext) {
  const now = context.currentTime;

  const firstOscillator = context.createOscillator();
  const secondOscillator = context.createOscillator();
  const gainNode = context.createGain();

  firstOscillator.type = 'triangle';
  secondOscillator.type = 'triangle';
  firstOscillator.frequency.setValueAtTime(1040, now);
  secondOscillator.frequency.setValueAtTime(1310, now + 0.06);

  gainNode.gain.value = 0.001;
  gainNode.gain.exponentialRampToValueAtTime(0.22, now + 0.01);
  gainNode.gain.exponentialRampToValueAtTime(0.12, now + 0.06);
  gainNode.gain.exponentialRampToValueAtTime(0.2, now + 0.09);
  gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

  firstOscillator.connect(gainNode);
  secondOscillator.connect(gainNode);
  gainNode.connect(context.destination);

  firstOscillator.start(now);
  firstOscillator.stop(now + 0.11);

  secondOscillator.start(now + 0.06);
  secondOscillator.stop(now + 0.2);
}

function playAlertaBeep(context: AudioContext) {
  const now = context.currentTime;
  const oscillator = context.createOscillator();
  const gainNode = context.createGain();

  oscillator.type = 'square';
  oscillator.frequency.setValueAtTime(1500, now);
  oscillator.frequency.setValueAtTime(1900, now + 0.08);

  gainNode.gain.value = 0.001;
  gainNode.gain.exponentialRampToValueAtTime(0.35, now + 0.01);
  gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

  oscillator.connect(gainNode);
  gainNode.connect(context.destination);

  oscillator.start(now);
  oscillator.stop(now + 0.17);
}

function playSupermercadoBeep(context: AudioContext) {
  const now = context.currentTime;
  const oscillator = context.createOscillator();
  const gainNode = context.createGain();

  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(980, now);

  gainNode.gain.value = 0.001;
  gainNode.gain.exponentialRampToValueAtTime(0.2, now + 0.01);
  gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

  oscillator.connect(gainNode);
  gainNode.connect(context.destination);

  oscillator.start(now);
  oscillator.stop(now + 0.12);
}
