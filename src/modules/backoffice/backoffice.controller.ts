import { Body, Controller, Post } from "@nestjs/common";
import { CreateCondominiumDTO, CreatePlanDTO, CreateTenantDTO, CreateUserDTO } from "./types/dto/backoffice.dto";
import { BackofficeService } from "./backoffice.service";

@Controller('backoffice')
export class BackofficeController {

  constructor(private readonly backofficeService: BackofficeService) { }

  @Post('create/user')
  async createUser(@Body() body: CreateUserDTO) {
    return this.backofficeService.createUser(body)
  }

  @Post('create/plan')
  async createPlan(@Body() body: CreatePlanDTO) {
    return this.backofficeService.createPlan(body)
  }

  @Post('create/tenant')
  async createTenant(@Body() body: CreateTenantDTO) {
    return this.backofficeService.createTenant(body)
  }

  @Post('create/condominium')
  async createCondominium(@Body() body: CreateCondominiumDTO) {
    return this.backofficeService.createCondominium(body)
  }


  async createModule() {

  }

  async createPage() {

  }
}