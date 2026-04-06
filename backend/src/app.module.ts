import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { HealthModule } from './modules/health/health.module';
import { BipagemModule } from './modules/bipagem/bipagem.module';
import { TrackingRteModule } from './modules/tracking-rte/tracking-rte.module';
import { validateEnv } from './config/env.validation';
import { SupabaseService } from './infra/db/supabase.client';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 10,
      },
    ]),
    AuthModule,
    UsersModule,
    HealthModule,
    BipagemModule,
    TrackingRteModule,
  ],
  providers: [SupabaseService],
  exports: [SupabaseService],
})
export class AppModule {}
