import { IsIn, IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export const BIPAGEM_MODE_IDS = [
  'mercado_livre_comum',
  'mercado_livre_flex',
  'shopee_comum',
  'shopee_entrega_rapida',
] as const;

export type BipagemModeId = (typeof BIPAGEM_MODE_IDS)[number];

export class ListBipagemMetricsDto {
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to?: string;

  @IsOptional()
  @IsString()
  tz?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  topN?: number;

  @IsOptional()
  @IsString()
  @IsIn(['day'])
  groupBy?: 'day';
}
