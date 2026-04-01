import { Module } from '@nestjs/common';
import { SupabaseService } from '../../infra/db/supabase.client';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';

@Module({
  providers: [SupabaseService, UsersRepository, UsersService],
  exports: [UsersRepository, UsersService],
})
export class UsersModule {}
