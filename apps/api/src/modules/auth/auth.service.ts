import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { getDefaultUserFeatureFlags, normalizeUserFeatureFlags } from '../feature-flags';
import type {
  AuthConfig,
  AuthResult,
  AuthUserRepository,
  JwtPayload,
  LoginInput,
  RegisterInput,
  SafeUser,
  UserEntity,
} from './auth.types';

function toSafeUser(user: UserEntity): SafeUser {
  return {
    id: user.id,
    email: user.email,
    credits: user.credits,
    role: user.role,
    status: user.status,
    feature_flags: normalizeUserFeatureFlags(user.feature_flags),
    created_at: user.created_at,
  };
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export class AuthService {
  constructor(
    private readonly userRepository: AuthUserRepository,
    private readonly config: AuthConfig,
  ) {}

  private isAdminEmail(email: string): boolean {
    const normalizedEmail = email.toLowerCase();
    return this.config.adminEmails?.includes(normalizedEmail) ?? false;
  }

  async register(input: RegisterInput): Promise<AuthResult> {
    const email = normalizeEmail(input.email);
    const password = input.password.trim();

    if (!email) {
      throw new Error('INVALID_EMAIL');
    }
    if (password.length < 6) {
      throw new Error('PASSWORD_TOO_SHORT');
    }

    const existed = await this.userRepository.findByEmail(email);
    if (existed) {
      throw new Error('EMAIL_ALREADY_EXISTS');
    }

    const hashed = await bcrypt.hash(password, this.config.bcryptRounds);
    const role = this.isAdminEmail(email) ? 'admin' : 'user';

    const user = await this.userRepository.create({
      email,
      password: hashed,
      role,
      status: 'active',
      credits: 0,
      feature_flags: getDefaultUserFeatureFlags(),
    });

    return {
      token: this.signToken(user),
      user: toSafeUser(user),
    };
  }

  async login(input: LoginInput): Promise<AuthResult> {
    const email = normalizeEmail(input.email);
    const password = input.password.trim();

    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      throw new Error('INVALID_CREDENTIALS');
    }
    if (user.status !== 'active') {
      throw new Error('USER_NOT_ACTIVE');
    }

    const matched = await bcrypt.compare(password, user.password);
    if (!matched) {
      throw new Error('INVALID_CREDENTIALS');
    }

    return {
      token: this.signToken(user),
      user: toSafeUser(user),
    };
  }

  async getUserInfo(userId: number): Promise<SafeUser> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('USER_NOT_FOUND');
    }
    return toSafeUser(user);
  }

  verifyToken(token: string): JwtPayload {
    const payload = jwt.verify(token, this.config.jwtSecret);
    if (!payload || typeof payload === 'string') {
      throw new Error('INVALID_TOKEN');
    }
    const parsed = payload as jwt.JwtPayload;
    if (typeof parsed.sub !== 'number' || typeof parsed.email !== 'string' || typeof parsed.role !== 'string') {
      throw new Error('INVALID_TOKEN');
    }
    return {
      sub: parsed.sub,
      email: parsed.email,
      role: parsed.role as JwtPayload['role'],
    };
  }

  private signToken(user: UserEntity): string {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    return jwt.sign(payload, this.config.jwtSecret, {
      expiresIn: this.config.jwtExpiresIn as jwt.SignOptions['expiresIn'],
    });
  }
}
