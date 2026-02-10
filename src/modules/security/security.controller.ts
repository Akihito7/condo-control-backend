import { Body, Controller, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { CreateVisitBody, GetVisitorsParams } from './types/dto/security.dto';
import { SecurityService } from './security.service';
import { Token } from 'src/decorators/token.decorator';

@Controller('security')
export class SecurityController {
  constructor(private readonly securityService: SecurityService) {}

  @Post('visitor/registration')
  async visitorRegistration(@Body() body: CreateVisitBody) {
    return this.securityService.visitorRegistration(body);
  }

  @Get('visitors/:condominiumId/:startDate/:endDate')
  async getVisitorsByCondominium(@Param() param: GetVisitorsParams) {
    return this.securityService.getVisitorsByCondominium(param);
  }

  @Patch('visitors/check-out/:visitId')
  async doneCheckoutOut(@Param('visitId') visitId: string) {
    return this.securityService.doneCheckoutOut(visitId);
  }

  @Get('units/status')
  async getUnitStatuses() {
    return this.securityService.getUnitStatuses();
  }

  @Post('units')
  async createUnit(@Body() data: any, @Token() token: string) {
    return this.securityService.createUnit(data, token);
  }

  @Put('units/:unitId')
  async updateUnit(@Param('unitId') unitId: string, @Body() data: any) {
    return this.securityService.updateUnit(unitId, data);
  }

  @Get('units')
  async getUnits(@Token() token: string) {
    return this.securityService.getUnits(token);
  }

  @Get('blocks')
  async getBlocks(@Token() token: string) {
    return this.securityService.getBlocks(token);
  }
}
