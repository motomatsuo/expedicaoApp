import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { SupabaseService } from '../../infra/db/supabase.client';
import { BipagemRecord } from './entities/bipagem.entity';

@Injectable()
export class BipagemRepository {
  constructor(private readonly supabaseService: SupabaseService) {}

  async findAll(): Promise<BipagemRecord[]> {
    const queryResult = await this.supabaseService.homologClient
      .from('db_expedicao_bipagem')
      .select('*')
      .order('created_at', { ascending: false });

    if (queryResult.error) {
      throw new InternalServerErrorException('Falha ao consultar bipagens.');
    }

    return queryResult.data ?? [];
  }

  /** Busca parcial por código (case-insensitive), mais recentes primeiro. */
  async searchByCodigo(q: string, limit: number): Promise<BipagemRecord[]> {
    const safe = q.replace(/[%_\\]/g, '');
    if (safe.length < 2) {
      return [];
    }
    const pattern = `%${safe}%`;
    const queryResult = await this.supabaseService.homologClient
      .from('db_expedicao_bipagem')
      .select('*')
      .ilike('codigo', pattern)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (queryResult.error) {
      throw new InternalServerErrorException('Falha ao buscar bipagem por codigo.');
    }

    return queryResult.data ?? [];
  }

  async findByFilters(input: {
    from: string;
    to: string;
    plataforma?: BipagemRecord['plataforma'];
  }): Promise<BipagemRecord[]> {
    const query = this.supabaseService.homologClient
      .from('db_expedicao_bipagem')
      .select('*')
      .gte('created_at', input.from)
      .lte('created_at', `${input.to}T23:59:59.999Z`)
      .order('created_at', { ascending: false });

    const finalQuery = input.plataforma ? query.eq('plataforma', input.plataforma) : query;

    const queryResult = await finalQuery;

    if (queryResult.error) {
      throw new InternalServerErrorException('Falha ao consultar bipagens para exportacao.');
    }

    return queryResult.data ?? [];
  }

  async findByDateRange(input: { from: string; to: string }): Promise<BipagemRecord[]> {
    const queryResult = await this.supabaseService.homologClient
      .from('db_expedicao_bipagem')
      .select('*')
      .gte('created_at', `${input.from}T00:00:00.000Z`)
      .lte('created_at', `${input.to}T23:59:59.999Z`)
      .order('created_at', { ascending: false });

    if (queryResult.error) {
      throw new InternalServerErrorException('Falha ao consultar metricas de bipagem.');
    }

    return queryResult.data ?? [];
  }

  async create(input: {
    codigo: string;
    atendente: string;
    plataforma:
      | 'mercado_livre_comum'
      | 'mercado_livre_flex'
      | 'shopee_comum'
      | 'shopee_entrega_rapida';
  }): Promise<BipagemRecord> {
    const queryResult = await this.supabaseService.homologClient
      .from('db_expedicao_bipagem')
      .insert({
        codigo: input.codigo,
        atendente: input.atendente,
        plataforma: input.plataforma,
      })
      .select('*')
      .single();

    if (queryResult.error?.code === '23505') {
      throw new ConflictException('Esse codigo ja foi bipado.');
    }

    if (queryResult.error || !queryResult.data) {
      throw new InternalServerErrorException('Falha ao salvar bipagem.');
    }

    return queryResult.data;
  }

  async deleteById(id: number): Promise<void> {
    const queryResult = await this.supabaseService.homologClient
      .from('db_expedicao_bipagem')
      .delete()
      .eq('id', id);

    if (queryResult.error) {
      throw new InternalServerErrorException('Falha ao excluir bipagem.');
    }
  }
}

