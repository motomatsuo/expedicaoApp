import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BipagemService } from './bipagem.service';
import { CreateBipagemDto } from './dto/create-bipagem.dto';

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
}

