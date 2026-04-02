import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BipagemService } from './bipagem.service';
import { CreateBipagemDto } from './dto/create-bipagem.dto';
import type { Response } from 'express';

@UseGuards(JwtAuthGuard)
@Controller('bipagem')
export class BipagemController {
  constructor(private readonly bipagemService: BipagemService) {}

  @Get()
  async list() {
    return { items: await this.bipagemService.list() };
  }

  @Post()
  async create(@Body() body: CreateBipagemDto) {
    return { item: await this.bipagemService.create(body) };
  }

  @Delete(':id')
  async delete(@Param('id', ParseIntPipe) id: number) {
    await this.bipagemService.delete(id);
    return { success: true };
  }

  @Get('export')
  async export(
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('scope') scope: 'all' | 'mode',
    @Query('modeId') modeId: string | undefined,
    @Res() res: Response,
  ) {
    const buffer = await this.bipagemService.exportToXlsx({
      from,
      to,
      scope: scope === 'mode' ? 'mode' : 'all',
      modeId: scope === 'mode' && modeId ? (modeId as any) : undefined,
    });

    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = String(now.getFullYear());
    const filename = `bipagem ${dd}-${mm}-${yyyy}.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    return res.send(buffer);
  }
}

