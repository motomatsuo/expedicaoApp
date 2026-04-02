/** Canal compartilhado para avisar a Lista bipagem de alterações (nova leitura, exclusão, etc.). */

export const BIPAGEM_LIST_BROADCAST_CHANNEL = 'expedicao-bipagem-list-v1';

export function notifyBipagemListChanged(): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    const channel = new BroadcastChannel(BIPAGEM_LIST_BROADCAST_CHANNEL);
    channel.postMessage({ type: 'bipagem-list-changed' });
    channel.close();
  } catch {
    /* BroadcastChannel indisponível (navegador antigo, etc.) */
  }
}
