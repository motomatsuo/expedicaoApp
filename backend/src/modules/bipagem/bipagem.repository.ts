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

