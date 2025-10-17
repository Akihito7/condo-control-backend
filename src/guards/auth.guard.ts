import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { AuthService } from 'src/modules/auth/auth.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();

    const headers = request.headers;

    const [, token] = headers.authorization?.split(' ');

    if (!token) {
      throw new ForbiddenException('Token was not provided.');
    }

    try {
      await this.authService.verifyToken(token);
    } catch (error) {
      throw new ForbiddenException(error.message || 'Invalid token.');
    }

    return true;
  }
}
