/**
 * SLA RTE:
 * - **Contagem do prazo:** dias úteis **comuns** = segunda a sexta (1–5), exceto feriados nacionais (`date-fns-holiday-br`).
 *   Começa no **dia civil seguinte** ao `recebido_em` (SP).
 * - **Data limite de entrega:** após contar `prazo_dias`, avança para o **próximo** dia em `dias_semana`
 *   (dias em que a RTE entrega naquele município) que não seja feriado — ex.: se o 4º dia útil cai na sexta
 *   e só há rota ter/qui, o limite vai para a **terça** seguinte.
 */

import { getNationalHolidays } from 'date-fns-holiday-br';

const TZ = 'America/Sao_Paulo';

export type RteSlaStatus =
  | 'sem_recebido'
  | 'sem_cadastro'
  | 'indeterminado'
  | 'no_prazo'
  | 'atrasado';

export type RteSlaComputed = {
  sla_status: RteSlaStatus;
  sla_data_limite: string | null;
  sla_referencia_data: string | null;
  sla_prazo_dias: number | null;
};

export type RtePrazoRow = {
  municipio: string | null;
  uf: string | null;
  /** Supabase pode devolver number, string ou bigint conforme tipo da coluna. */
  prazo_dias: number | string | bigint | null;
  dias_semana: unknown;
};

const WEEKDAY_SHORT_TO_ISO: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

function isoWeekdayFromYmdSp(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return 1;
  const isoDate = `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const dt = new Date(`${isoDate}T12:00:00-03:00`);
  if (Number.isNaN(dt.getTime())) return 1;
  const short = dt.toLocaleDateString('en-US', { timeZone: TZ, weekday: 'short' });
  return WEEKDAY_SHORT_TO_ISO[short] ?? 1;
}

function addOneCalendarDayYmdSp(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const isoDate = `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const dt = new Date(`${isoDate}T12:00:00-03:00`);
  dt.setDate(dt.getDate() + 1);
  return dt.toLocaleDateString('en-CA', { timeZone: TZ });
}

export function ymdInSaoPaulo(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-CA', { timeZone: TZ });
}

/** Remove acentos para bater planilha "SAO PAULO" com rastreio "SÃO PAULO". */
export function stripDiacritics(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '');
}

/** Nome completo do estado (sem acento, maiúsculo) → sigla. Evita `est` = "Sao Paulo" virar "SA". */
const ESTADO_NOME_PARA_UF: Record<string, string> = {
  ACRE: 'AC',
  ALAGOAS: 'AL',
  AMAPA: 'AP',
  AMAZONAS: 'AM',
  BAHIA: 'BA',
  CEARA: 'CE',
  'DISTRITO FEDERAL': 'DF',
  'ESPIRITO SANTO': 'ES',
  GOIAS: 'GO',
  MARANHAO: 'MA',
  'MATO GROSSO': 'MT',
  'MATO GROSSO DO SUL': 'MS',
  'MINAS GERAIS': 'MG',
  PARA: 'PA',
  PARAIBA: 'PB',
  PARANA: 'PR',
  PERNAMBUCO: 'PE',
  PIAUI: 'PI',
  'RIO DE JANEIRO': 'RJ',
  'RIO GRANDE DO NORTE': 'RN',
  'RIO GRANDE DO SUL': 'RS',
  RONDONIA: 'RO',
  RORAIMA: 'RR',
  'SANTA CATARINA': 'SC',
  'SAO PAULO': 'SP',
  SERGIPE: 'SE',
  TOCANTINS: 'TO',
};

export function normalizeMunicipioKey(m: string | null | undefined): string {
  const raw = (m ?? '').replace(/\u00A0/g, ' ').replace(/\r|\n/g, ' ').trim();
  const s = stripDiacritics(raw).toUpperCase().replace(/\s+/g, ' ');
  return s;
}

export function normalizeUfKey(u: string | null | undefined): string {
  const raw = (u ?? '').replace(/\u00A0/g, ' ').trim();
  const t = stripDiacritics(raw).toUpperCase().replace(/\s+/g, ' ');
  if (!t) return '';
  if (t.length === 2 && /^[A-Z]{2}$/.test(t)) return t;
  return ESTADO_NOME_PARA_UF[t] ?? '';
}

function toIntLoose(v: unknown): number | null {
  if (v == null || v === '') return null;
  if (typeof v === 'bigint') return Number(v);
  const n = Number(v);
  if (Number.isNaN(n) || !Number.isFinite(n)) return null;
  return Math.trunc(n);
}

/** PostgREST / driver às vezes devolve array Postgres como string (`{1,2,3}`). */
export function coerceDiasSemana(raw: unknown): number[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    const nums = raw
      .map((n) => toIntLoose(n))
      .filter((n): n is number => n != null && n >= 1 && n <= 7);
    return [...new Set(nums)].sort((a, b) => a - b);
  }
  if (typeof raw === 'string') {
    const s = raw.trim();
    const inner =
      s.startsWith('{') && s.endsWith('}')
        ? s.slice(1, -1)
        : s.replace(/^\[/, '').replace(/\]$/, '');
    if (!inner) return [];
    const parts = inner.split(',').map((p) => p.trim().replace(/^"+|"+$/g, '')).filter(Boolean);
    const nums = parts
      .map((p) => toIntLoose(p))
      .filter((n): n is number => n != null && n >= 1 && n <= 7);
    return [...new Set(nums)].sort((a, b) => a - b);
  }
  return [];
}

export function buildPrazoMap(rows: RtePrazoRow[]): Map<string, { prazo_dias: number; dias_semana: number[] }> {
  const map = new Map<string, { prazo_dias: number; dias_semana: number[] }>();
  for (const r of rows) {
    const m = normalizeMunicipioKey(r.municipio);
    const uf = normalizeUfKey(r.uf);
    const key = `${m}|${uf}`;
    if (!m || !uf || key === '|') continue;
    const pd = toIntLoose(r.prazo_dias);
    const ds = coerceDiasSemana(r.dias_semana);
    if (pd == null || pd <= 0 || ds.length === 0) continue;
    map.set(key, { prazo_dias: pd, dias_semana: ds });
  }
  return map;
}

/**
 * Localiza regra em `prazoMap`:
 * 1) `MUNICIPIO|UF` exato (após normalização);
 * 2) Se não achar, qualquer chave `MUNICIPIO|*` — só se houver **uma** (evita homônimos).
 */
export function resolveRtePrazoRule(
  prazoMap: Map<string, { prazo_dias: number; dias_semana: number[] }>,
  municipio: string | null | undefined,
  est: string | null | undefined,
): { prazo_dias: number; dias_semana: number[] } | null {
  const m = normalizeMunicipioKey(municipio);
  if (!m) return null;
  const uf = normalizeUfKey(est);
  if (uf) {
    const exact = prazoMap.get(`${m}|${uf}`);
    if (exact) return exact;
  }
  const prefix = `${m}|`;
  const hits = [...prazoMap.keys()].filter((k) => k.startsWith(prefix));
  if (hits.length === 1) {
    return prazoMap.get(hits[0]) ?? null;
  }
  return null;
}

/** Datas YYYY-MM-DD (America/Sao_Paulo) dos feriados nacionais retornados pela lib, para os anos do intervalo de SLA. */
function buildNationalHolidayYmdSet(startYmd: string): Set<string> {
  const y0 = parseInt(startYmd.slice(0, 4), 10);
  if (Number.isNaN(y0)) return new Set();
  const years = [y0 - 1, y0, y0 + 1, y0 + 2];
  const set = new Set<string>();
  for (const year of years) {
    if (year < 1970 || year > 2100) continue;
    for (const d of getNationalHolidays(year)) {
      set.add(d.toLocaleDateString('en-CA', { timeZone: TZ }));
    }
  }
  return set;
}

/** Segunda–sexta (ISO 1–5), fora feriados nacionais. */
function isDiaUtilComum(ymd: string, feriados: Set<string>): boolean {
  const dow = isoWeekdayFromYmdSp(ymd);
  if (dow < 1 || dow > 5) return false;
  return !feriados.has(ymd);
}

/** Primeira data >= `fromYmd` em que a RTE entrega (dow ∈ `diasEntregaRte`) e não é feriado. */
function snapParaProximaJanelaEntrega(
  fromYmd: string,
  diasEntregaRte: Set<number>,
  feriados: Set<string>,
): string | null {
  let ymd = fromYmd;
  for (let guard = 0; guard < 400; guard += 1) {
    const dow = isoWeekdayFromYmdSp(ymd);
    if (diasEntregaRte.has(dow) && !feriados.has(ymd)) {
      return ymd;
    }
    ymd = addOneCalendarDayYmdSp(ymd);
  }
  return null;
}

/** Data limite (dia de entrega RTE) em YYYY-MM-DD (America/Sao_Paulo). */
export function computeDataLimitePrazoPermitidos(
  recebidoEmIso: string,
  prazoDias: number,
  diasSemana: number[],
): string | null {
  const prazoN = toIntLoose(prazoDias) ?? 0;
  const diasNorm = [...new Set(diasSemana.map((n) => toIntLoose(n)).filter((n): n is number => n != null && n >= 1 && n <= 7))];
  if (prazoN <= 0 || diasNorm.length === 0) return null;
  const diasEntregaRte = new Set(diasNorm);

  let ymd = ymdInSaoPaulo(recebidoEmIso);
  if (!ymd) return null;
  /** 1º dia analisado para contagem = dia **seguinte** ao recebido. */
  ymd = addOneCalendarDayYmdSp(ymd);

  const feriadosNacionaisYmD = buildNationalHolidayYmdSet(ymd);

  let counted = 0;
  let candidatoAposPrazo: string | null = null;
  for (let guard = 0; guard < 400; guard += 1) {
    if (isDiaUtilComum(ymd, feriadosNacionaisYmD)) {
      counted += 1;
      if (counted >= prazoN) {
        candidatoAposPrazo = ymd;
        break;
      }
    }
    ymd = addOneCalendarDayYmdSp(ymd);
  }

  if (!candidatoAposPrazo) return null;
  return snapParaProximaJanelaEntrega(candidatoAposPrazo, diasEntregaRte, feriadosNacionaisYmD);
}

export function computeRteSla(input: {
  recebido_em: string | null | undefined;
  municipio: string | null | undefined;
  est: string | null | undefined;
  date_tracking: string | null | undefined;
  setp_code: number | null | undefined;
  prazoMap: Map<string, { prazo_dias: number; dias_semana: number[] }>;
  entregueStepCodes: ReadonlySet<number>;
  now?: Date;
}): RteSlaComputed {
  const { recebido_em, municipio, est, date_tracking, setp_code, prazoMap, entregueStepCodes } = input;
  const now = input.now ?? new Date();

  if (!recebido_em?.trim()) {
    return {
      sla_status: 'sem_recebido',
      sla_data_limite: null,
      sla_referencia_data: null,
      sla_prazo_dias: null,
    };
  }

  const rule = resolveRtePrazoRule(prazoMap, municipio, est);
  if (!rule) {
    return {
      sla_status: 'sem_cadastro',
      sla_data_limite: null,
      sla_referencia_data: null,
      sla_prazo_dias: null,
    };
  }

  const sla_data_limite = computeDataLimitePrazoPermitidos(
    recebido_em,
    rule.prazo_dias,
    rule.dias_semana,
  );
  if (!sla_data_limite) {
    /** Regra encontrada, mas `recebido_em` inválido ou laço de prazo não fechou — não confundir com falta de linha em `db_rte_prazos`. */
    return {
      sla_status: 'indeterminado',
      sla_data_limite: null,
      sla_referencia_data: null,
      sla_prazo_dias: rule.prazo_dias,
    };
  }

  const isEntregue = setp_code != null && entregueStepCodes.has(setp_code);
  const sla_referencia_data = isEntregue
    ? (ymdInSaoPaulo(date_tracking) ?? ymdInSaoPaulo(recebido_em))
    : ymdInSaoPaulo(now.toISOString());

  if (!sla_referencia_data) {
    return {
      sla_status: 'no_prazo',
      sla_data_limite,
      sla_referencia_data: null,
      sla_prazo_dias: rule.prazo_dias,
    };
  }

  const sla_status: RteSlaStatus =
    sla_referencia_data > sla_data_limite ? 'atrasado' : 'no_prazo';

  return {
    sla_status,
    sla_data_limite,
    sla_referencia_data,
    sla_prazo_dias: rule.prazo_dias,
  };
}
