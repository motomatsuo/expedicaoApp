import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../../infra/db/supabase.client';
import { COLUMN_STEP_CODES, RteColumnKey } from './column-step-codes';
import { TrackingNfExpedicaoRecord } from './entities/tracking-nf-expedicao.entity';

/** Por padrão usa `SUPABASE_URL`. Defina `TRACKING_RTE_USE_HOMOLOG=true` se a tabela existir só na homolog. */

function escapeIlike(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

/** PostgREST: valores com caracteres especiais em ilike. */
function quoteFilterValue(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

@Injectable()
export class TrackingRteRepository {
  private readonly logger = new Logger(TrackingRteRepository.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly configService: ConfigService,
  ) {}

  private get trackingDb() {
    return this.configService.get<string>('TRACKING_RTE_USE_HOMOLOG') === 'true'
      ? this.supabaseService.homologClient
      : this.supabaseService.client;
  }

  async findColumnPage(input: {
    column: RteColumnKey;
    skip: number;
    take: number;
    search?: string;
    sort: 'asc' | 'desc';
  }): Promise<{ items: TrackingNfExpedicaoRecord[]; total: number }> {
    const codes = [...COLUMN_STEP_CODES[input.column]];
    const ascending = input.sort === 'asc';

    let query = this.trackingDb
      .from('db_tracking_nf_expedicao')
      .select('*', { count: 'exact' })
      .in('setp_code', codes)
      .order('date_tracking', { ascending });

    const searchRaw = input.search?.trim().replace(/,/g, ' ');
    if (searchRaw) {
      const pattern = `%${escapeIlike(searchRaw)}%`;
      const q = quoteFilterValue(pattern);
      const numeric = /^\d+$/.test(searchRaw) ? Number(searchRaw) : null;
      if (numeric !== null && !Number.isNaN(numeric)) {
        query = query.or(`description.ilike.${q},nf.eq.${numeric}`);
      } else {
        query = query.ilike('description', pattern);
      }
    }

    const from = input.skip;
    const to = input.skip + input.take - 1;
    const queryResult = await query.range(from, to);

    if (queryResult.error) {
      this.logger.error(
        `Supabase db_tracking_nf_expedicao: ${queryResult.error.message} (${queryResult.error.code ?? 'no-code'})`,
      );
      throw new InternalServerErrorException(
        `Falha ao consultar rastreio RTE: ${queryResult.error.message}`,
      );
    }

    return {
      items: (queryResult.data ?? []) as TrackingNfExpedicaoRecord[],
      total: queryResult.count ?? 0,
    };
  }
}
