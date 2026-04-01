import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class CreateBipagemDto {
  @IsString()
  @IsNotEmpty()
  codigo!: string;

  @IsString()
  @IsNotEmpty()
  atendente!: string;

  @IsString()
  @IsIn([
    'mercado_livre_comum',
    'mercado_livre_flex',
    'shopee_comum',
    'shopee_entrega_rapida',
  ])
  plataforma!:
    | 'mercado_livre_comum'
    | 'mercado_livre_flex'
    | 'shopee_comum'
    | 'shopee_entrega_rapida';
}

