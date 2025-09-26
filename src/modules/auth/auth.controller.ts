import { Body, Controller, Get, Patch, Post, UseGuards, UseInterceptors } from "@nestjs/common";
import { AuthGuard } from "src/guards/auth.guard";
import { Token } from "src/decorators/token.decorator";
import { AuthService } from "./auth.service";

@Controller('auth')
export class AuthController {

  constructor(private readonly authService: AuthService) { }

  @Post('signup')
  async createAccount(@Body() body: any) {
    return this.authService.createAccount(body)
  }

  @Post('signin')
  async login(@Body() body: any) {
    return this.authService.login(body)
  }

  @UseGuards(AuthGuard)
  @Get('me')
  async me(@Token() token: string) {
    const { userId } = await this.authService.decodeToken(token);
    return this.authService.me(userId)
  }

  @Post('forget-password')
  async forgetPassword(@Body() body: { email: string }) {
    return this.authService.forgetPassword(body)
  }

  @Patch('reset-password')
  async resetPassword(@Body() body: { password: string, code: string }) {
    return this.authService.resetPassword(body)
  }
} 