import { Controller, Get, Param, ParseIntPipe, Query, Res, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ListTrackingRteColumnDto } from './dto/list-tracking-rte-column.dto';
import { TrackingRteService } from './tracking-rte.service';
import type { Response } from 'express';

@UseGuards(JwtAuthGuard)
@Controller('tracking-rte')
export class TrackingRteController {
  constructor(private readonly trackingRteService: TrackingRteService) {}

  /** Lista paginada de uma coluna do Kanban RTE (filtro por `setp_code`). */
  @Get('column')
  async listColumn(@Query() query: ListTrackingRteColumnDto) {
    return this.trackingRteService.listColumn(query);
  }

  @Get('delivery-receipt/:nf/html')
  async deliveryReceiptHtml(
    @Param('nf', ParseIntPipe) nf: number,
    @Res() res: Response,
  ) {
    const html = await this.trackingRteService.deliveryReceiptHtml(nf);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(html);
  }
}
