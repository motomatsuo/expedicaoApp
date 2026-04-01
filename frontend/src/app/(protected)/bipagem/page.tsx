'use client';

import { BrowserMultiFormatReader } from '@zxing/browser';
import { useCallback, useEffect, useRef, useState } from 'react';
import * as XLSX from 'xlsx';

type BipagemModeId =
  | 'mercado_livre_comum'
  | 'mercado_livre_flex'
  | 'shopee_comum'
  | 'shopee_entrega_rapida';

type BipagemMode = {
  id: BipagemModeId;
  label: string;
  platform: 'mercado_livre' | 'shopee';
};

type SoundProfileId = 'digital' | 'alerta' | 'supermercado';

const BIPAGEM_MODES: BipagemMode[] = [
  {
    id: 'mercado_livre_comum',
    label: 'Mercado Livre comum',
    platform: 'mercado_livre',
  },
  {
    id: 'mercado_livre_flex',
    label: 'Mercado Livre Flex',
    platform: 'mercado_livre',
  },
  {
    id: 'shopee_comum',
    label: 'Shopee comum',
    platform: 'shopee',
  },
  {
    id: 'shopee_entrega_rapida',
    label: 'Shopee Entrega Rapida',
    platform: 'shopee',
  },
];

type ScannedCodeItem = {
  id?: number;
  code: string;
  scannedAt: string;
  userName: string;
  modeLabel: string;
};

export default function BipagemPage() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const lastHandledRef = useRef<{ code: string; ts: number }>({ code: '', ts: 0 });
  const audioContextRef = useRef<AudioContext | null>(null);
  const [selectedMode, setSelectedMode] = useState<BipagemModeId | null>(null);
  const [lastCode, setLastCode] = useState<string>('');
  const [scannedCodes, setScannedCodes] = useState<ScannedCodeItem[]>([]);
  const [currentUserName, setCurrentUserName] = useState<string>('Usuario');
  const [pendingMercadoLivreCode, setPendingMercadoLivreCode] = useState<string | null>(null);
  const [pendingShopeeCode, setPendingShopeeCode] = useState<string | null>(null);
  const [error, setError] = useState<string>('');
  const [popupMessage, setPopupMessage] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [status, setStatus] = useState<'idle' | 'success'>('idle');

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

        setLastCode(code);
        setScannedCodes((previous) => [mapApiItemToScannedCode(item), ...previous]);
        setError('');
        setSuccessMessage(`Leitura valida para ${mode.label}.`);
        setStatus('success');
        playBeep(audioContextRef, 'alerta');
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
                setError('Selecione um modelo de bipagem antes de iniciar a leitura.');
                setSuccessMessage('');
                setStatus('idle');
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

  useEffect(() => {
    async function fetchScans() {
      try {
        const response = await fetch(`${apiUrl}/bipagem`, {
          method: 'GET',
          credentials: 'include',
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

        setScannedCodes((data.items ?? []).map(mapApiItemToScannedCode));
      } catch {
        // Mantem lista local vazia em caso de erro.
      }
    }

    void fetchScans();
  }, [apiUrl]);

  function handleSelectMode(modeId: BipagemModeId) {
    setSelectedMode(modeId);
    setError('');
    setSuccessMessage('');
    setStatus('idle');
  }

  function resetModeSelection() {
    setSelectedMode(null);
    clearRead();
  }

  function clearRead() {
    setLastCode('');
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
      );
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

  function deleteScan(scan: ScannedCodeItem) {
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
      } catch {
        setError('Nao foi possivel excluir a bipagem.');
      }
    })();
  }

  return (
    <section className="mx-auto w-full max-w-6xl">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
        <div className="rounded-3xl border border-border-default bg-surface p-4 shadow-[0_8px_24px_rgba(15,23,42,0.08)] md:p-6">
          <h2 className="text-xl font-semibold tracking-tight text-primary">Bipagem</h2>
          <p className="mt-2 text-sm text-secondary">
            Posicione o QR Code no centro da camera para leitura em tempo real.
          </p>

          {selectedMode ? (
            <div className="mt-4 flex items-center justify-between rounded-2xl border border-border-default bg-app px-4 py-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary">
                  Modo selecionado
                </p>
                <p className="mt-1 text-sm font-semibold text-primary">
                  {BIPAGEM_MODES.find((mode) => mode.id === selectedMode)?.label}
                </p>
              </div>
              <button
                type="button"
                onClick={resetModeSelection}
                className="focus-ring inline-flex h-10 items-center justify-center rounded-xl border border-border-default bg-white px-3 text-sm font-semibold text-primary transition hover:bg-slate-50"
              >
                Trocar modo
              </button>
            </div>
          ) : null}

          {selectedMode ? (
            <div className="mt-4 overflow-hidden rounded-3xl border border-border-default bg-black">
              <video ref={videoRef} className="h-[420px] w-full object-cover" muted playsInline />
            </div>
          ) : null}

          <div className="mt-4 flex items-center justify-between rounded-2xl border border-border-default bg-app px-4 py-3">
            <p className="text-sm font-medium text-primary">Status da camera</p>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                status === 'success'
                  ? 'bg-green-100 text-green-700'
                  : selectedMode
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-slate-200 text-slate-700'
              }`}
            >
              {status === 'success'
                ? 'Leitura valida'
                : selectedMode
                  ? 'Pronto para bipar'
                  : 'Selecione um modelo'}
            </span>
          </div>
        </div>

        <div className="rounded-3xl border border-border-default bg-surface p-4 shadow-[0_8px_24px_rgba(15,23,42,0.08)] md:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary">
            Ultima leitura
          </p>
          <p className="mt-2 break-all text-sm font-medium text-primary md:text-base">
            {lastCode || 'Nenhum QR Code lido ainda.'}
          </p>

          {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
          {successMessage ? <p className="mt-3 text-sm text-green-700">{successMessage}</p> : null}

          <div className="mt-6 rounded-2xl border border-border-default bg-app p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-secondary">
                Codigos bipados
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={exportScansToXlsx}
                  disabled={scannedCodes.length === 0}
                  className="focus-ring rounded-lg bg-brand-primary px-3 py-1 text-xs font-semibold text-white transition hover:bg-brand-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Exportar
                </button>
                <button
                  type="button"
                  onClick={clearScannedList}
                  className="focus-ring rounded-lg px-2 py-1 text-xs font-semibold text-primary hover:bg-slate-100"
                >
                  Limpar lista
                </button>
              </div>
            </div>
            <div className="max-h-56 overflow-y-auto rounded-xl bg-white p-2">
              {scannedCodes.length > 0 ? (
                <ul className="space-y-2">
                  {scannedCodes.map((scan, index) => (
                    <li
                      key={scan.id ?? `${scan.code}-${scan.scannedAt}-${index}`}
                      className="rounded-lg border border-border-default px-3 py-2"
                    >
                      <p className="break-all text-sm font-semibold text-primary">{scan.code}</p>
                      <p className="mt-1 text-xs text-secondary">{scan.scannedAt}</p>
                      <p className="text-xs text-secondary">{scan.modeLabel}</p>
                      <p className="text-xs text-secondary">{scan.userName}</p>
                      <button
                        type="button"
                        onClick={() => deleteScan(scan)}
                        className="focus-ring mt-2 inline-flex h-8 items-center justify-center rounded-lg border border-border-default bg-white px-2 text-xs font-semibold text-primary transition hover:bg-slate-50"
                      >
                        Excluir
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-1 py-2 text-sm text-secondary">Nenhum codigo armazenado ainda.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {!selectedMode ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/55 px-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-border-default bg-surface p-5 shadow-[0_16px_40px_rgba(15,23,42,0.22)] md:p-6">
            <h3 className="text-lg font-semibold tracking-tight text-primary">
              Selecione o modelo de bipagem
            </h3>
            <p className="mt-1 text-sm text-secondary">
              Escolha uma opcao para iniciar a leitura da camera.
            </p>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {BIPAGEM_MODES.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => handleSelectMode(mode.id)}
                  className="focus-ring inline-flex min-h-11 items-center justify-center rounded-xl border border-border-default bg-white px-3 py-2 text-sm font-medium text-primary transition-all hover:bg-slate-50"
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {pendingMercadoLivreCode ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-border-default bg-surface p-5 shadow-[0_16px_40px_rgba(15,23,42,0.24)] md:p-6">
            <h3 className="text-lg font-semibold tracking-tight text-primary">
              Codigo de Mercado Livre detectado
            </h3>
            <p className="mt-2 text-sm text-secondary">
              Voce estava em Shopee, mas esse codigo parece ser de Mercado Livre. Escolha o modelo
              para confirmar a bipagem:
            </p>

            <div className="mt-4 grid gap-2">
              <button
                type="button"
                onClick={() => confirmMercadoLivreMode('mercado_livre_comum')}
                className="focus-ring inline-flex min-h-11 items-center justify-center rounded-xl border border-border-default bg-white px-3 py-2 text-sm font-semibold text-primary transition hover:bg-slate-50"
              >
                Mercado Livre comum
              </button>
              <button
                type="button"
                onClick={() => confirmMercadoLivreMode('mercado_livre_flex')}
                className="focus-ring inline-flex min-h-11 items-center justify-center rounded-xl border border-border-default bg-white px-3 py-2 text-sm font-semibold text-primary transition hover:bg-slate-50"
              >
                Mercado Livre Flex
              </button>
            </div>

            <button
              type="button"
              onClick={() => setPendingMercadoLivreCode(null)}
              className="focus-ring mt-3 inline-flex h-10 w-full items-center justify-center rounded-xl border border-border-default bg-white px-3 text-sm font-semibold text-secondary transition hover:bg-slate-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : null}

      {pendingShopeeCode ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-border-default bg-surface p-5 shadow-[0_16px_40px_rgba(15,23,42,0.24)] md:p-6">
            <h3 className="text-lg font-semibold tracking-tight text-primary">
              Codigo de Shopee detectado
            </h3>
            <p className="mt-2 text-sm text-secondary">
              Voce estava em Mercado Livre, mas esse codigo comeca com BR. Escolha o modelo Shopee
              para confirmar a bipagem:
            </p>

            <div className="mt-4 grid gap-2">
              <button
                type="button"
                onClick={() => confirmShopeeMode('shopee_comum')}
                className="focus-ring inline-flex min-h-11 items-center justify-center rounded-xl border border-border-default bg-white px-3 py-2 text-sm font-semibold text-primary transition hover:bg-slate-50"
              >
                Shopee comum
              </button>
              <button
                type="button"
                onClick={() => confirmShopeeMode('shopee_entrega_rapida')}
                className="focus-ring inline-flex min-h-11 items-center justify-center rounded-xl border border-border-default bg-white px-3 py-2 text-sm font-semibold text-primary transition hover:bg-slate-50"
              >
                Shopee Entrega Rapida
              </button>
            </div>

            <button
              type="button"
              onClick={() => setPendingShopeeCode(null)}
              className="focus-ring mt-3 inline-flex h-10 w-full items-center justify-center rounded-xl border border-border-default bg-white px-3 text-sm font-semibold text-secondary transition hover:bg-slate-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : null}

      {popupMessage ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl border border-border-default bg-surface p-5 shadow-[0_16px_40px_rgba(15,23,42,0.24)] md:p-6">
            <h3 className="text-lg font-semibold tracking-tight text-primary">Aviso</h3>
            <p className="mt-2 text-sm text-secondary">{popupMessage}</p>
            <button
              type="button"
              onClick={() => setPopupMessage('')}
              className="focus-ring mt-4 inline-flex h-10 w-full items-center justify-center rounded-xl border border-border-default bg-white px-3 text-sm font-semibold text-primary transition hover:bg-slate-50"
            >
              Fechar
            </button>
          </div>
        </div>
      ) : null}
    </section>
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
        message:
          'Codigo invalido para Shopee. Se o codigo nao comeca com BR, selecione Mercado Livre.',
        reason: 'shopee_received_mercado_livre',
      };
    }

    return { valid: true, message: '' };
  }

  if (startsWithBr) {
    return {
      valid: false,
      message:
        'Codigo com BR detectado. Para esse padrao, selecione Shopee antes de bipar.',
      reason: 'mercado_livre_received_shopee',
    };
  }

  if (!isOnlyNumbers) {
    return {
      valid: false,
      message:
        'Codigo invalido para Mercado Livre. O codigo deve conter apenas numeros.',
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

function mapApiItemToScannedCode(item: {
  id: number;
  created_at: string;
  plataforma: string;
  atendente: string;
  codigo: string;
}): ScannedCodeItem {
  const matchedMode = BIPAGEM_MODES.find((mode) => mode.id === item.plataforma);

  return {
    id: item.id,
    code: item.codigo,
    scannedAt: new Date(item.created_at).toLocaleString('pt-BR'),
    userName: item.atendente || 'Usuario',
    modeLabel: matchedMode?.label ?? item.plataforma,
  };
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
