import { Injectable, UnauthorizedException } from '@nestjs/common';
import { SupabaseService } from '../../infra/db/supabase.client';
import { PortalUser } from './entities/portal-user.entity';

@Injectable()
export class UsersRepository {
  constructor(private readonly supabaseService: SupabaseService) {}

  async findByEmail(email: string): Promise<PortalUser | null> {
    const queryResult = await this.supabaseService.client
      .from('db_login_portal')
      .select('*')
      .eq('email_vend', email)
      .limit(1)
      .maybeSingle();

    if (queryResult.error) {
      throw new UnauthorizedException('Falha ao consultar usuario.');
    }

    return queryResult.data;
  }
}
