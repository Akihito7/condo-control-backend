import { createParamDecorator, ExecutionContext } from "@nestjs/common";

export const Token = createParamDecorator((_, ctx: ExecutionContext): string => {
  const request = ctx.switchToHttp().getRequest();
  const headers = request.headers;
  const [, token] = headers.authorization.split(' ')
  return token
})