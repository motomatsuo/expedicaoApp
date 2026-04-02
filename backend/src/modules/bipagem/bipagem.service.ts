import { Injectable } from '@nestjs/common';
import { BipagemRepository } from './bipagem.repository';
import { BipagemRecord } from './entities/bipagem.entity';
import { CreateBipagemDto } from './dto/create-bipagem.dto';
import * as ExcelJS from 'exceljs';

@Injectable()
export class BipagemService {
  constructor(private readonly bipagemRepository: BipagemRepository) {}

  async list(): Promise<BipagemRecord[]> {
    return this.bipagemRepository.findAll();
  }

  async create(input: CreateBipagemDto): Promise<BipagemRecord> {
    return this.bipagemRepository.create(input);
  }

  async delete(id: number): Promise<void> {
    await this.bipagemRepository.deleteById(id);
  }

  async exportToXlsx(options: {
    from: string;
    to: string;
    scope: 'all' | 'mode';
    modeId?: BipagemRecord['plataforma'];
  }): Promise<Buffer> {
    const records = await this.bipagemRepository.findByFilters({
      from: options.from,
      to: options.to,
      plataforma: options.scope === 'mode' ? options.modeId : undefined,
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Bipagens');

    sheet.columns = [
      { header: 'Codigo', key: 'codigo', width: 32 },
      { header: 'Modo', key: 'plataforma', width: 24 },
      { header: 'Data e hora', key: 'created_at', width: 28 },
      { header: 'Usuario', key: 'atendente', width: 24 },
    ];

    for (const item of records) {
      const date = new Date(item.created_at);
      const dd = String(date.getDate()).padStart(2, '0');
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const yyyy = String(date.getFullYear());
      const hh = String(date.getHours()).padStart(2, '0');
      const min = String(date.getMinutes()).padStart(2, '0');
      const ss = String(date.getSeconds()).padStart(2, '0');
      const formattedDateTime = `${dd}-${mm}-${yyyy} ${hh}:${min}:${ss}`;

      sheet.addRow({
        codigo: item.codigo,
        plataforma: item.plataforma,
        created_at: formattedDateTime,
        atendente: item.atendente,
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}

