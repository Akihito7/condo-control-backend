import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { CreateVisitBody, GetVisitorsParams } from "./types/dto/security.dto";
import { SecurityService } from "./security.service";

@Controller('security')
export class SecurityController {
  constructor(private readonly securityService: SecurityService) { }

  @Post('visitor/registration')
  async visitorRegistration(@Body() body: CreateVisitBody) {
    return this.securityService.visitorRegistration(body)
  }

  @Get('visitors/:condominiumId/:startDate/:endDate')
  async getVisitorsByCondominium(
    @Param() param: GetVisitorsParams
  ) {
    return this.securityService.getVisitorsByCondominium(param)
  }

  @Patch('visitors/check-out/:visitId')
  async doneCheckoutOut(@Param("visitId") visitId: string) {
    return this.securityService.doneCheckoutOut(visitId)
  }

}