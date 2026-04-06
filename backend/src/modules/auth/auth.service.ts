import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { compareSync } from 'bcryptjs';
import { UsersRepository } from '../users/users.repository';
import { LoginDto } from './dto/login.dto';
import {
  PortalUser,
  PublicPortalUser,
  toPublicPortalUser,
} from '../users/entities/portal-user.entity';
import { JwtPayload } from './types/jwt-payload.type';

@Injectable()
export class AuthService {
  private static readonly DEFAULT_SESSION_TTL_HOURS = 12;

  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(loginDto: LoginDto): Promise<{
    accessToken: string;
    user: PublicPortalUser;
    sessionMaxAgeMs: number;
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

    this.assertExpedicaoGroup(user);

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email_vend,
    };

    const sessionTtlHours = this.getSessionTtlHours();
    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn: `${sessionTtlHours}h`,
    });

    return {
      accessToken,
      user: toPublicPortalUser(user),
      sessionMaxAgeMs: sessionTtlHours * 60 * 60 * 1000,
    };
  }

  async me(email: string): Promise<PublicPortalUser | null> {
    const user = await this.usersRepository.findByEmail(email);
    if (!user) {
      return null;
    }

    this.assertExpedicaoGroup(user);

    return toPublicPortalUser(user);
  }

  /** Portal expedição: apenas usuários com grupo contendo EXPEDICAO. */
  private assertExpedicaoGroup(user: PortalUser): void {
    const grupo = user.grupo;
    if (!Array.isArray(grupo) || !grupo.includes('EXPEDICAO')) {
      throw new UnauthorizedException('Credenciais invalidas.');
    }
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

  private getSessionTtlHours(): number {
    const rawValue = this.configService.get<string>('SESSION_TTL_HOURS');
    if (!rawValue) {
      return AuthService.DEFAULT_SESSION_TTL_HOURS;
    }

    const ttlHours = Number(rawValue);
    if (!Number.isInteger(ttlHours) || ttlHours <= 0) {
      return AuthService.DEFAULT_SESSION_TTL_HOURS;
    }

    return ttlHours;
  }
}
