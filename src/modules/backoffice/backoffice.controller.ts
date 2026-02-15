import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { BackofficeService } from './backoffice.service';

@Controller('backoffice')
export class BackofficeController {
  constructor(private readonly backofficeService: BackofficeService) {}

  @Get('condominiums')
  async getCondominiums() {
    return this.backofficeService.getCondominiums();
  }

  @Get('apartaments/:condominiumId')
  async getApartaments(@Param('condominiumId') condominiumId: string) {
    return this.backofficeService.getApartaments(condominiumId);
  }

  @Post('user')
  async createUser(@Body() body: any) {
    return this.backofficeService.createUser(body);
  }
}
