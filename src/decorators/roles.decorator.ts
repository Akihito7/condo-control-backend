import { SetMetadata } from '@nestjs/common';

export const Roles = (...roles: string[]) => SetMetadata('roles', roles);

import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from 'src/modules/auth/auth.service';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private readonly authService: AuthService
  ) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.get<string[]>('roles', context.getHandler());
    if (!requiredRoles) {
      return true;
    }
    const request = context.switchToHttp().getRequest();

    const [, token] = request.headers.authorization.split(' ')

    const { userId } = await this.authService.decodeToken(token);

    const userInfo = await this.authService.me(userId);

    const userHasPermission = requiredRoles.some(
      requiredRole => userInfo.userAssociationRole.toLocaleLowerCase() === requiredRole.toLocaleLowerCase());

    return userHasPermission
  }
}