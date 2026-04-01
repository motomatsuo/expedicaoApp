import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { compareSync } from 'bcryptjs';
import { UsersRepository } from '../users/users.repository';
import { LoginDto } from './dto/login.dto';
import {
  PublicPortalUser,
  toPublicPortalUser,
} from '../users/entities/portal-user.entity';
import { JwtPayload } from './types/jwt-payload.type';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(loginDto: LoginDto): Promise<{
    accessToken: string;
    user: PublicPortalUser;
  }> {
    const user = await this.usersRepository.findByEmail(loginDto.email);

    if (!user || !user.email_vend || !user.senha_vend) {
      throw new UnauthorizedException('Credenciais invalidas.');
    }

    const validPassword = this.verifyPassword(
      loginDto.password,
      user.senha_vend,
    );

    if (!validPassword) {
      throw new UnauthorizedException('Credenciais invalidas.');
    }

    if (user.status && user.status.toLowerCase() !== 'ativo') {
      throw new UnauthorizedException('Usuario inativo.');
    }

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email_vend,
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn: '15m',
    });

    return { accessToken, user: toPublicPortalUser(user) };
  }

  async me(email: string): Promise<PublicPortalUser | null> {
    const user = await this.usersRepository.findByEmail(email);
    if (!user) {
      return null;
    }

    return toPublicPortalUser(user);
  }

  private verifyPassword(
    inputPassword: string,
    storedPassword: string,
  ): boolean {
    const isBcrypt =
      storedPassword.startsWith('$2a$') || storedPassword.startsWith('$2b$');

    if (isBcrypt) {
      return compareSync(inputPassword, storedPassword);
    }

    // Compatibilidade legada para fase inicial.
    return inputPassword === storedPassword;
  }
}
