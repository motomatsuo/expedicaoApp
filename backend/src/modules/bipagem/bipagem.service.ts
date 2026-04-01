import { Injectable } from '@nestjs/common';
import { BipagemRepository } from './bipagem.repository';
import { BipagemRecord } from './entities/bipagem.entity';
import { CreateBipagemDto } from './dto/create-bipagem.dto';

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
}

