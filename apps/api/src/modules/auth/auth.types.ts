import type { UserFeatureFlags } from '../feature-flags';

export type UserRole = 'user' | 'admin' | 'operator';

export type UserStatus = 'active' | 'disabled' | 'banned';

export interface UserEntity {
  id: number;
  email: string;
  password: string;
  credits: number;
  role: UserRole;
  status: UserStatus;
  feature_flags: unknown;
  created_at: string;
}

export interface SafeUser {
  id: number;
  email: string;
  credits: number;
  role: UserRole;
  status: UserStatus;
  feature_flags: UserFeatureFlags;
  created_at: string;
}

export interface RegisterInput {
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface JwtPayload {
  sub: number;
  email: string;
  role: UserRole;
}

export interface AuthResult {
  token: string;
  user: SafeUser;
}

export interface AuthConfig {
  jwtSecret: string;
  jwtExpiresIn: string;
  bcryptRounds: number;
}

export interface AuthUserRepository {
  findByEmail(email: string): Promise<UserEntity | null>;
  findById(id: number): Promise<UserEntity | null>;
  create(data: {
    email: string;
    password: string;
    role: UserRole;
    status: UserStatus;
    credits: number;
    feature_flags: UserFeatureFlags;
  }): Promise<UserEntity>;
}
