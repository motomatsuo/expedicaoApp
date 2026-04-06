import { BadRequestException, Injectable } from '@nestjs/common';
import { BipagemRepository } from './bipagem.repository';
import { BipagemRecord } from './entities/bipagem.entity';
import { CreateBipagemDto } from './dto/create-bipagem.dto';
import { BipagemSseService } from './bipagem-sse.service';
import * as ExcelJS from 'exceljs';
import {
  BipagemModeId,
  BIPAGEM_MODE_IDS,
  ListBipagemMetricsDto,
} from './dto/list-bipagem-metrics.dto';
import { BipagemMetricsResponse } from './dto/bipagem-metrics-response.dto';

@Injectable()
export class BipagemService {
  private static readonly DEFAULT_TOP_N = 10;
  private static readonly DEFAULT_RANGE_DAYS = 7;
  private static readonly DEFAULT_TZ = 'America/Sao_Paulo';

  constructor(
    private readonly bipagemRepository: BipagemRepository,
    private readonly bipagemSseService: BipagemSseService,
  ) {}

  async list(): Promise<BipagemRecord[]> {
    return this.bipagemRepository.findAll();
  }

  async create(input: CreateBipagemDto): Promise<BipagemRecord> {
    const record = await this.bipagemRepository.create(input);
    this.bipagemSseService.emitListChanged();
    return record;
  }

  async delete(id: number): Promise<void> {
    await this.bipagemRepository.deleteById(id);
    this.bipagemSseService.emitListChanged();
  }

  async getMetrics(query: ListBipagemMetricsDto): Promise<BipagemMetricsResponse> {
    const tz = query.tz?.trim() || BipagemService.DEFAULT_TZ;
    const { from, to } = this.resolveDateRange(query.from, query.to, tz);
    const records = await this.bipagemRepository.findByDateRange({ from, to });
    const topN = query.topN ?? BipagemService.DEFAULT_TOP_N;

    const byMode = this.createEmptyByModeMap();
    const byUserCount = new Map<string, number>();
    const byDayMap = new Map<string, { total: number; byMode: Record<BipagemModeId, number> }>();
    const byHourCount = new Map<number, number>();
    const byWeekdayHourCount = new Map<string, number>();

    for (const day of this.listDateKeys(from, to)) {
      byDayMap.set(day, { total: 0, byMode: this.createEmptyByModeMap() });
    }
    for (let hour = 0; hour < 24; hour += 1) {
      byHourCount.set(hour, 0);
    }
    for (let weekday = 1; weekday <= 7; weekday += 1) {
      for (let hour = 8; hour <= 19; hour += 1) {
        byWeekdayHourCount.set(`${weekday}-${hour}`, 0);
      }
    }

    for (const record of records) {
      const modeId = this.getModeId(record.plataforma);
      if (!modeId) {
        continue;
      }

      const dayKey = this.getDateKeyInTimezone(record.created_at, tz);
      if (!byDayMap.has(dayKey)) {
        byDayMap.set(dayKey, { total: 0, byMode: this.createEmptyByModeMap() });
      }

      byMode[modeId] += 1;

      const day = byDayMap.get(dayKey);
      if (day) {
        day.total += 1;
        day.byMode[modeId] += 1;
      }

      const normalizedUser = record.atendente?.trim() || 'Sem usuario';
      byUserCount.set(normalizedUser, (byUserCount.get(normalizedUser) ?? 0) + 1);

      const hour = this.getHourInTimezone(record.created_at, tz);
      byHourCount.set(hour, (byHourCount.get(hour) ?? 0) + 1);

      if (hour >= 8 && hour <= 19) {
        const weekday = this.getWeekdayFromDateKey(dayKey);
        const key = `${weekday}-${hour}`;
        byWeekdayHourCount.set(key, (byWeekdayHourCount.get(key) ?? 0) + 1);
      }
    }

    const byUser = [...byUserCount.entries()]
      .map(([user, count]) => ({ user, count }))
      .sort((a, b) => (b.count - a.count) || a.user.localeCompare(b.user, 'pt-BR'))
      .slice(0, topN);

    const byDay = [...byDayMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, value]) => ({ date, total: value.total, byMode: value.byMode }));
    const byHour = [...byHourCount.entries()]
      .sort(([a], [b]) => a - b)
      .map(([hour, count]) => ({ hour, count }));
    const byWeekdayHour = [...byWeekdayHourCount.entries()]
      .map(([key, count]) => {
        const [weekdayStr, hourStr] = key.split('-');
        return {
          weekday: Number(weekdayStr),
          hour: Number(hourStr),
          count,
        };
      })
      .sort((a, b) => (a.weekday - b.weekday) || (a.hour - b.hour));

    return {
      range: { from, to, tz },
      total: Object.values(byMode).reduce((acc, count) => acc + count, 0),
      byMode,
      byUser,
      byHour,
      byWeekdayHour,
      byDay,
    };
  }

  async exportToXlsx(options: {
    from: string;
    to: string;
    scope: 'all' | 'mode';
    modeId?: BipagemRecord['plataforma'];
  }): Promise<Buffer> {
    const records = await this.bipagemRepository.findByFilters({
      from: options.from,
      to: options.to,
      plataforma: options.scope === 'mode' ? options.modeId : undefined,
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Bipagens');

    sheet.columns = [
      { header: 'Codigo', key: 'codigo', width: 32 },
      { header: 'Modo', key: 'plataforma', width: 24 },
      { header: 'Data e hora', key: 'created_at', width: 28 },
      { header: 'Usuario', key: 'atendente', width: 24 },
    ];

    for (const item of records) {
      const date = new Date(item.created_at);
      const dd = String(date.getDate()).padStart(2, '0');
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const yyyy = String(date.getFullYear());
      const hh = String(date.getHours()).padStart(2, '0');
      const min = String(date.getMinutes()).padStart(2, '0');
      const ss = String(date.getSeconds()).padStart(2, '0');
      const formattedDateTime = `${dd}-${mm}-${yyyy} ${hh}:${min}:${ss}`;

      sheet.addRow({
        codigo: item.codigo,
        plataforma: item.plataforma,
        created_at: formattedDateTime,
        atendente: item.atendente,
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  private resolveDateRange(
    fromInput: string | undefined,
    toInput: string | undefined,
    tz: string,
  ): { from: string; to: string } {
    const today = this.getDateKeyInTimezone(new Date().toISOString(), tz);
    const to = toInput ?? today;

    const defaultFromDate = new Date(`${to}T00:00:00.000Z`);
    defaultFromDate.setUTCDate(defaultFromDate.getUTCDate() - (BipagemService.DEFAULT_RANGE_DAYS - 1));
    const defaultFrom = defaultFromDate.toISOString().slice(0, 10);
    const from = fromInput ?? defaultFrom;

    if (!this.isDateKey(from) || !this.isDateKey(to)) {
      throw new BadRequestException('Periodo invalido. Use o formato YYYY-MM-DD.');
    }
    if (from > to) {
      throw new BadRequestException('Periodo invalido. A data inicial nao pode ser maior que a final.');
    }

    return { from, to };
  }

  private isDateKey(value: string): boolean {
    return /^\d{4}-\d{2}-\d{2}$/.test(value);
  }

  private getDateKeyInTimezone(isoDate: string, tz: string): string {
    try {
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date(isoDate));
    } catch {
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: BipagemService.DEFAULT_TZ,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date(isoDate));
    }
  }

  private getHourInTimezone(isoDate: string, tz: string): number {
    try {
      const hour = new Intl.DateTimeFormat('en-GB', {
        timeZone: tz,
        hour: '2-digit',
        hourCycle: 'h23',
      }).format(new Date(isoDate));
      const parsed = Number(hour);
      return Number.isInteger(parsed) && parsed >= 0 && parsed <= 23 ? parsed : 0;
    } catch {
      return 0;
    }
  }

  private listDateKeys(from: string, to: string): string[] {
    const result: string[] = [];
    const cursor = new Date(`${from}T00:00:00.000Z`);
    const end = new Date(`${to}T00:00:00.000Z`);
    while (cursor <= end) {
      result.push(cursor.toISOString().slice(0, 10));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return result;
  }

  private getWeekdayFromDateKey(dateKey: string): number {
    const jsDay = new Date(`${dateKey}T00:00:00.000Z`).getUTCDay();
    return jsDay === 0 ? 7 : jsDay;
  }

  private createEmptyByModeMap(): Record<BipagemModeId, number> {
    return {
      mercado_livre_comum: 0,
      mercado_livre_flex: 0,
      shopee_comum: 0,
      shopee_entrega_rapida: 0,
    };
  }

  private getModeId(value: string): BipagemModeId | null {
    return (BIPAGEM_MODE_IDS as readonly string[]).includes(value)
      ? (value as BipagemModeId)
      : null;
  }
}

