import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../../infra/db/supabase.client';
import { COLUMN_STEP_CODES, RteColumnKey } from './column-step-codes';
import { TrackingNfExpedicaoRecord } from './entities/tracking-nf-expedicao.entity';
import { type RtePrazoRow, buildPrazoMap, computeRteSla } from './rte-sla';

/** Por padrão usa `SUPABASE_URL`. Defina `TRACKING_RTE_USE_HOMOLOG=true` se a tabela existir só na homolog. */
function escapeIlike(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

function quoteFilterValue(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

const ENTREGUE_STEP_CODES = new Set<number>(COLUMN_STEP_CODES.entregue);

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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

  async buildDeliveryReceiptHtml(nf: number): Promise<string> {
    const taxId =
      this.configService.get<string>('RTE_TAX_ID_REGISTRATION')?.trim() || '43872050000171';
    const baseUrl =
      this.configService.get<string>('RTE_DELIVERY_RECEIPT_URL')?.trim() ||
      'https://tracking-apigateway.rte.com.br/api/v1/deliveryreceipt';

    const tokenResult = await this.trackingDb
      .from('rte_tokens')
      .select('access_token')
      .eq('id', '1')
      .single();
    if (tokenResult.error || !tokenResult.data?.access_token) {
      const msg = tokenResult.error?.message ?? 'token não encontrado';
      this.logger.error(`Supabase rte_tokens: ${msg}`);
      throw new InternalServerErrorException(`Falha ao obter token RTE: ${msg}`);
    }

    const url = `${baseUrl}?${new URLSearchParams({
      TaxIdRegistration: taxId,
      InvoiceNumber: String(nf),
    }).toString()}`;

    let payload: { Image?: string | null; Message?: string | null } | null = null;
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json,text/plain,*/*',
          Authorization: `Bearer ${tokenResult.data.access_token}`,
        },
      });
      if (!response.ok) {
        const txt = await response.text();
        throw new Error(`HTTP ${response.status} ${response.statusText} - ${txt.slice(0, 300)}`);
      }
      payload = (await response.json()) as { Image?: string | null; Message?: string | null };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'erro desconhecido';
      this.logger.error(`RTE deliveryreceipt: ${msg}`);
      throw new InternalServerErrorException(`Falha ao consultar comprovante RTE: ${msg}`);
    }

    if (!payload?.Image) {
      const message = payload?.Message?.trim() || 'Comprovante não disponível para essa NF.';
      return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Comprovante NF ${nf}</title>
    <style>
      body{font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif;margin:0;padding:24px;background:#f8fafc;color:#111827}
      .box{max-width:900px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:18px}
      h1{font-size:20px;margin:0 0 8px}
      p{margin:0;color:#374151}
    </style>
  </head>
  <body>
    <div class="box">
      <h1>NF ${nf}</h1>
      <p>${escapeHtml(message)}</p>
    </div>
  </body>
</html>`;
    }

    const imageDataUrl = `data:image/jpeg;base64,${payload.Image}`;
    return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Comprovante NF ${nf}</title>
    <style>
      body{font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif;margin:0;padding:18px;background:#f8fafc;color:#111827}
      .box{max-width:980px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:14px}
      h1{font-size:18px;margin:0 0 12px}
      img{max-width:100%;height:auto;border-radius:10px;border:1px solid #e5e7eb}
    </style>
  </head>
  <body>
    <div class="box">
      <h1>Comprovante de Entrega - NF ${nf}</h1>
      <img alt="Comprovante NF ${nf}" src="${imageDataUrl}" />
    </div>
  </body>
</html>`;
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

    const prazosResult = await this.trackingDb
      .from('db_rte_prazos')
      .select('municipio,uf,prazo_dias,dias_semana');
    let prazoMap = new Map<string, { prazo_dias: number; dias_semana: number[] }>();
    if (prazosResult.error) {
      this.logger.warn(
        `Supabase db_rte_prazos: ${prazosResult.error.message} (${prazosResult.error.code ?? 'no-code'})`,
      );
    } else {
      prazoMap = buildPrazoMap((prazosResult.data ?? []) as RtePrazoRow[]);
    }

    return {
      items: pageItems.map((item) => {
        const vendorKey = item.vend?.trim();
        const vendor = vendorKey ? vendorMap.get(vendorKey) : undefined;
        const codcliKey = item.codcli?.trim();
        const client = codcliKey ? clientMap.get(codcliKey) : undefined;
        const sla = computeRteSla({
          recebido_em: item.recebido_em ?? null,
          municipio: item.municipio,
          est: item.est,
          date_tracking: item.date_tracking,
          setp_code: item.setp_code,
          prazoMap,
          entregueStepCodes: ENTREGUE_STEP_CODES,
        });
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
          sla_status: sla.sla_status,
          sla_data_limite: sla.sla_data_limite,
          sla_referencia_data: sla.sla_referencia_data,
          sla_prazo_dias: sla.sla_prazo_dias,
        };
      }),
      total,
    };
  }
}
