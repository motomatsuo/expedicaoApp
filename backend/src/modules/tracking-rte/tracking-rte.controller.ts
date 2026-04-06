import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ListTrackingRteColumnDto } from './dto/list-tracking-rte-column.dto';
import { TrackingRteService } from './tracking-rte.service';

@UseGuards(JwtAuthGuard)
@Controller('tracking-rte')
export class TrackingRteController {
  constructor(private readonly trackingRteService: TrackingRteService) {}

  /** Lista paginada de uma coluna do Kanban RTE (filtro por `setp_code`). */
  @Get('column')
  async listColumn(@Query() query: ListTrackingRteColumnDto) {
    return this.trackingRteService.listColumn(query);
  }
}
