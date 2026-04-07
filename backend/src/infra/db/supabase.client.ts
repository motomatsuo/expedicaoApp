import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { PortalUser } from '../../modules/users/entities/portal-user.entity';
import { BipagemRecord } from '../../modules/bipagem/entities/bipagem.entity';
import { TrackingNfExpedicaoRecord } from '../../modules/tracking-rte/entities/tracking-nf-expedicao.entity';

type Database = {
  public: {
    Tables: {
      db_login_portal: {
        Row: PortalUser;
        Insert: Partial<PortalUser>;
        Update: Partial<PortalUser>;
        Relationships: [];
      };
      db_expedicao_bipagem: {
        Row: BipagemRecord;
        Insert: {
          codigo: string;
          atendente: string;
          plataforma:
            | 'mercado_livre_comum'
            | 'mercado_livre_flex'
            | 'shopee_comum'
            | 'shopee_entrega_rapida';
        };
        Update: Partial<BipagemRecord>;
        Relationships: [];
      };
      db_tracking_nf_expedicao: {
        Row: TrackingNfExpedicaoRecord;
        Insert: Partial<TrackingNfExpedicaoRecord>;
        Update: Partial<TrackingNfExpedicaoRecord>;
        Relationships: [];
      };
      db_vendedores: {
        Row: {
          id_protheus: string;
          nome: string;
          telefone: string;
          disponivel: boolean;
          id_chatwoot: number | null;
          instancia_evo_api: string | null;
          foto: string | null;
          email: string | null;
          id_slack: string | null;
          apikey_evo: string | null;
          nome_formatado: string | null;
        };
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
      };
      db_rfv: {
        Row: {
          codigo: string;
          nome_empresa: string;
          vendedor: string | null;
          valor: number | null;
          status: string | null;
          classificacao: string | null;
          descricao: string | null;
          tp_comercio: string | null;
          documento: string | null;
        };
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

@Injectable()
export class SupabaseService {
  private readonly clientInstance: SupabaseClient<Database>;
  private readonly homologClientInstance: SupabaseClient<Database>;

  constructor(private readonly configService: ConfigService) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const serviceRoleKey = this.configService.get<string>(
      'SUPABASE_SERVICE_ROLE_KEY',
    );
    const homologSupabaseUrl = this.configService.get<string>('SUPABASE_HOMOLOG_URL');
    const homologServiceRoleKey = this.configService.get<string>(
      'SUPABASE_HOMOLOG_SERVICE_ROLE_KEY',
    );

    if (
      !supabaseUrl ||
      !serviceRoleKey ||
      !homologSupabaseUrl ||
      !homologServiceRoleKey
    ) {
      throw new Error('Supabase nao configurado corretamente.');
    }

    this.clientInstance = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    this.homologClientInstance = createClient(
      homologSupabaseUrl,
      homologServiceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );
  }

  get client(): SupabaseClient<Database> {
    return this.clientInstance;
  }

  get homologClient(): SupabaseClient<Database> {
    return this.homologClientInstance;
  }
}
