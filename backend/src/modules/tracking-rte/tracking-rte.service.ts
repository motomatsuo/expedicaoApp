import { Injectable } from '@nestjs/common';
import { ListTrackingRteColumnDto } from './dto/list-tracking-rte-column.dto';
import { TrackingRteRepository } from './tracking-rte.repository';

@Injectable()
export class TrackingRteService {
  constructor(private readonly trackingRteRepository: TrackingRteRepository) {}

  async listColumn(dto: ListTrackingRteColumnDto) {
    const skip = dto.skip ?? 0;
    const take = dto.take ?? 10;
    const sort = dto.sort ?? 'desc';
    return this.trackingRteRepository.findColumnPage({
      column: dto.column,
      skip,
      take,
      search: dto.search,
      sort,
    });
  }

  async deliveryReceiptHtml(nf: number): Promise<string> {
    return this.trackingRteRepository.buildDeliveryReceiptHtml(nf);
  }
}
