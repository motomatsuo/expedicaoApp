/** Segunda a sexta (dias úteis simples, sem feriados). */

export function isWeekday(d: Date): boolean {
  const day = d.getDay();
  return day !== 0 && day !== 6;
}

export function startOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function addLocalDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** Chave YYYY-MM-DD no fuso local (para filtrar com horário do servidor convertido no cliente). */
export function toLocalDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function dateKeyFromIso(createdAtIso: string): string {
  return toLocalDateKey(new Date(createdAtIso));
}

/** `dateKey` no formato YYYY-MM-DD representa um dia útil válido no calendário local. */
export function isWeekdayDateKey(dateKey: string): boolean {
  const parts = dateKey.split('-').map(Number);
  if (parts.length !== 3) return false;
  const [y, m, day] = parts;
  const dt = new Date(y!, (m ?? 1) - 1, day ?? 1);
  if (Number.isNaN(dt.getTime())) return false;
  return toLocalDateKey(dt) === dateKey && isWeekday(dt);
}

/** Os N dias úteis mais recentes (hoje pode não entrar se for fim de semana — recua até completar N). */
export function getLastWeekdayKeys(count: number, from: Date = new Date()): string[] {
  const keys: string[] = [];
  let d = startOfLocalDay(from);
  while (keys.length < count) {
    if (isWeekday(d)) {
      keys.push(toLocalDateKey(d));
    }
    d = addLocalDays(d, -1);
  }
  return keys;
}

export function formatWeekdayLabel(dateKey: string): string {
  const [y, m, day] = dateKey.split('-').map(Number);
  const dt = new Date(y, (m ?? 1) - 1, day ?? 1);
  return dt.toLocaleDateString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  });
}
