import { Injectable } from '@nestjs/common';
import {
  PublicPortalUser,
  toPublicPortalUser,
} from './entities/portal-user.entity';
import { UsersRepository } from './users.repository';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async findPublicByEmail(email: string): Promise<PublicPortalUser | null> {
    const user = await this.usersRepository.findByEmail(email);
    if (!user) {
      return null;
    }

    return toPublicPortalUser(user);
  }
}
