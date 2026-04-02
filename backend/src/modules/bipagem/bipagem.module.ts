import { Module } from '@nestjs/common';
import { BipagemController } from './bipagem.controller';
import { BipagemService } from './bipagem.service';
import { BipagemRepository } from './bipagem.repository';
import { BipagemSseService } from './bipagem-sse.service';
import { SupabaseService } from '../../infra/db/supabase.client';

@Module({
  controllers: [BipagemController],
  providers: [SupabaseService, BipagemRepository, BipagemSseService, BipagemService],
})
export class BipagemModule {}

