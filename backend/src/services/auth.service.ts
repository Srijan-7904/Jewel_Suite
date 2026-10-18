import { z } from 'zod';
import { userRepository, UserRecord } from '../repositories/user.repository.js';
import { auditRepository } from '../repositories/audit.repository.js';
import { comparePassword } from '../utils/password.js';
import { signToken } from '../utils/jwt.js';
import { UnauthorizedError, NotFoundError } from '../utils/errors.js';

export const loginSchema = z.object({
  username: z.string().min(1, 'Username is required').trim(),
  password: z.string().min(1, 'Password is required'),
});

export type LoginInput = z.infer<typeof loginSchema>;

export interface AuthSession {
  user: Omit<UserRecord, 'password_hash'>;
  token: string;
}

export class AuthService {
  async login(input: LoginInput): Promise<AuthSession> {
    const validated = loginSchema.parse(input);
    const user = userRepository.findByUsername(validated.username);

    if (!user) {
      throw new UnauthorizedError('Invalid username or password');
    }

    if (!user.is_active) {
      throw new UnauthorizedError('This account has been deactivated. Please contact your administrator.');
    }

    const isMatch = await comparePassword(validated.password, user.password_hash);
    if (!isMatch) {
      throw new UnauthorizedError('Invalid username or password');
    }

    const token = signToken({
      userId: user.id,
      username: user.username,
      role: user.role,
    });

    userRepository.recordLogin(user.id);

    auditRepository.log({
      user_id: user.id,
      action: 'USER_LOGIN',
      entity_type: 'USER',
      entity_id: user.id,
      metadata: { username: user.username },
    });

    const { password_hash, ...safeUser } = user;
    return {
      user: safeUser,
      token,
    };
  }

  getCurrentUser(userId: string): Omit<UserRecord, 'password_hash'> {
    const user = userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }
    if (!user.is_active) {
      throw new UnauthorizedError('User account is inactive');
    }

    const { password_hash, ...safeUser } = user;
    return safeUser;
  }
}

export const authService = new AuthService();
