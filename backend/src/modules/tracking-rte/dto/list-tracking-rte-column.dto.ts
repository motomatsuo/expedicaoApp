import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

const COLUMN_KEYS = [
  'recebido',
  'em_transito',
  'na_unidade',
  'rota_entrega',
  'problemas',
  'entregue',
  'enc_sem_entrega',
] as const;

export class ListTrackingRteColumnDto {
  @IsIn(COLUMN_KEYS)
  column!: (typeof COLUMN_KEYS)[number];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  take?: number;

  /** Busca em descrição, etapa e NF (quando numérico). */
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined,
  )
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(['desc', 'asc'])
  sort?: 'desc' | 'asc';
}
