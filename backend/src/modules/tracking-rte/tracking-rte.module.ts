import { Module } from '@nestjs/common';
import { SupabaseService } from '../../infra/db/supabase.client';
import { TrackingRteController } from './tracking-rte.controller';
import { TrackingRteRepository } from './tracking-rte.repository';
import { TrackingRteService } from './tracking-rte.service';

@Module({
  controllers: [TrackingRteController],
  providers: [SupabaseService, TrackingRteRepository, TrackingRteService],
})
export class TrackingRteModule {}
