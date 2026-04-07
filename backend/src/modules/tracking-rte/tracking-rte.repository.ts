import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../../infra/db/supabase.client';
import { COLUMN_STEP_CODES, RteColumnKey } from './column-step-codes';
import { TrackingNfExpedicaoRecord } from './entities/tracking-nf-expedicao.entity';

/** Por padrão usa `SUPABASE_URL`. Defina `TRACKING_RTE_USE_HOMOLOG=true` se a tabela existir só na homolog. */
function escapeIlike(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

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
    const searchRaw = input.search?.trim().replace(/,/g, ' ');
    let pageItems: TrackingNfExpedicaoRecord[] = [];
    let total = 0;

    if (!searchRaw) {
      const from = input.skip;
      const to = input.skip + input.take - 1;
      const queryResult = await this.trackingDb
        .from('db_tracking_nf_expedicao')
        .select('*', { count: 'exact' })
        .in('setp_code', codes)
        .order('date_tracking', { ascending })
        .range(from, to);

      if (queryResult.error) {
        this.logger.error(
          `Supabase db_tracking_nf_expedicao: ${queryResult.error.message} (${queryResult.error.code ?? 'no-code'})`,
        );
        throw new InternalServerErrorException(
          `Falha ao consultar rastreio RTE: ${queryResult.error.message}`,
        );
      }

      pageItems = (queryResult.data ?? []) as TrackingNfExpedicaoRecord[];
      total = queryResult.count ?? 0;
    } else {
      // Busca flexível (NF parcial, cliente e vendedor) sem depender de cast no PostgREST.
      const term = searchRaw.toLowerCase();
      const numeric = /^\d+$/.test(searchRaw) ? Number(searchRaw) : null;
      const vendorQ = quoteFilterValue(`%${escapeIlike(searchRaw)}%`);

      const allRowsResult = await this.trackingDb
        .from('db_tracking_nf_expedicao')
        .select('*')
        .in('setp_code', codes)
        .order('date_tracking', { ascending });
      if (allRowsResult.error) {
        this.logger.error(
          `Supabase db_tracking_nf_expedicao: ${allRowsResult.error.message} (${allRowsResult.error.code ?? 'no-code'})`,
        );
        throw new InternalServerErrorException(
          `Falha ao consultar rastreio RTE: ${allRowsResult.error.message}`,
        );
      }

      const vendorByNameResult = await this.trackingDb
        .from('db_vendedores')
        .select('id_protheus')
        .or(`nome.ilike.${vendorQ},nome_formatado.ilike.${vendorQ}`)
        .limit(60);
      const matchedVendorIds = new Set(
        (vendorByNameResult.data ?? [])
          .map((row) => row.id_protheus?.trim())
          .filter((id): id is string => Boolean(id)),
      );

      const allRows = (allRowsResult.data ?? []) as TrackingNfExpedicaoRecord[];
      const filtered = allRows.filter((row) => {
        const matchText =
          row.description?.toLowerCase().includes(term) ||
          row.razao?.toLowerCase().includes(term) ||
          row.codcli?.toLowerCase().includes(term) ||
          row.vend?.toLowerCase().includes(term);
        const matchVendorName = row.vend ? matchedVendorIds.has(row.vend.trim()) : false;
        const nfText = row.nf != null ? String(row.nf) : '';
        const matchNf = numeric !== null && !Number.isNaN(numeric) && (row.nf === numeric || nfText.includes(searchRaw));
        return Boolean(matchText || matchVendorName || matchNf);
      });

      total = filtered.length;
      pageItems = filtered.slice(input.skip, input.skip + input.take);
    }

    const vendorIds = [...new Set(pageItems.map((item) => item.vend?.trim()).filter(Boolean))] as string[];
    const codcliIds = [...new Set(pageItems.map((item) => item.codcli?.trim()).filter(Boolean))] as string[];

    const vendorMap = new Map<string, { nome: string | null; foto: string | null }>();
    if (vendorIds.length > 0) {
      const vendorsResult = await this.trackingDb
        .from('db_vendedores')
        .select('id_protheus,nome,foto')
        .in('id_protheus', vendorIds);

      if (vendorsResult.error) {
        this.logger.warn(
          `Supabase db_vendedores: ${vendorsResult.error.message} (${vendorsResult.error.code ?? 'no-code'})`,
        );
      } else {
        for (const vendor of vendorsResult.data ?? []) {
          vendorMap.set(vendor.id_protheus, { nome: vendor.nome, foto: vendor.foto });
        }
      }
    }

    const clientMap = new Map<
      string,
      {
        nome_empresa: string | null;
        documento: string | null;
        vendedor: string | null;
        valor: number | null;
        status: string | null;
        classificacao: string | null;
        tp_comercio: string | null;
        descricao: string | null;
      }
    >();
    if (codcliIds.length > 0) {
      const clientsResult = await this.trackingDb
        .from('db_rfv')
        .select('codigo,nome_empresa,documento,vendedor,valor,status,classificacao,tp_comercio,descricao')
        .in('codigo', codcliIds);

      if (clientsResult.error) {
        this.logger.warn(
          `Supabase db_rfv: ${clientsResult.error.message} (${clientsResult.error.code ?? 'no-code'})`,
        );
      } else {
        for (const client of clientsResult.data ?? []) {
          clientMap.set(client.codigo, {
            nome_empresa: client.nome_empresa ?? null,
            documento: client.documento ?? null,
            vendedor: client.vendedor ?? null,
            valor: client.valor ?? null,
            status: client.status ?? null,
            classificacao: client.classificacao ?? null,
            tp_comercio: client.tp_comercio ?? null,
            descricao: client.descricao ?? null,
          });
        }
      }
    }

    return {
      items: pageItems.map((item) => {
        const vendorKey = item.vend?.trim();
        const vendor = vendorKey ? vendorMap.get(vendorKey) : undefined;
        const codcliKey = item.codcli?.trim();
        const client = codcliKey ? clientMap.get(codcliKey) : undefined;
        return {
          ...item,
          vendedor_nome: vendor?.nome ?? null,
          vendedor_foto: vendor?.foto ?? null,
          cliente_nome_empresa: client?.nome_empresa ?? null,
          cliente_documento: client?.documento ?? null,
          cliente_vendedor: client?.vendedor ?? null,
          cliente_valor: client?.valor ?? null,
          cliente_status: client?.status ?? null,
          cliente_classificacao: client?.classificacao ?? null,
          cliente_tp_comercio: client?.tp_comercio ?? null,
          cliente_descricao: client?.descricao ?? null,
        };
      }),
      total,
    };
  }
}
