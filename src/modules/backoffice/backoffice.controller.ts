import { Body, Controller, Delete, Get, Param, Post, Put } from "@nestjs/common";
import { CreateCondominiumDTO, CreatePlanDTO, CreateTenantDTO, CreateUserDTO } from "./types/dto/backoffice.dto";
import { BackofficeService } from "./backoffice.service";

@Controller('backoffice')
export class BackofficeController {

  constructor(private readonly backofficeService: BackofficeService) { }

  @Post('/user')
  async createUser(@Body() body: CreateUserDTO) {
    return this.backofficeService.createUser(body)
  }

  @Put('/user/:userId')
  async updateUser(
    @Param("userId") userId: string,
    @Body() body: CreateUserDTO

  ) {
    return this.backofficeService.updateUser(userId, body);
  }

  @Delete("/user/:userId")
  async deleteUser(@Param('userId') userId: string) {
    return this.backofficeService.deleteUser(userId)
  }

  @Get('users')
  async getUsers() {
    return this.backofficeService.getUsers();
  }


  @Get('users/:userId')
  async getUserById(@Param('userId') userId: string) {
    return this.backofficeService.getUserById(userId);
  }

  @Post('plans')
  async createPlan(@Body() body: CreatePlanDTO) {
    return this.backofficeService.createPlan(body)
  }


  @Put('plans/:planId')
  async updatePlan(
    @Param('planId') planId: string,
    @Body() body: any) {
    return this.backofficeService.updatePlan(planId, body)
  }

  @Post('create/tenant')
  async createTenant(@Body() body: CreateTenantDTO) {
    return this.backofficeService.createTenant(body)
  }

  @Post('create/condominium')
  async createCondominium(@Body() body: CreateCondominiumDTO) {
    return this.backofficeService.createCondominium(body)
  }

  @Get('condominiums')
  async getCondominiums() {
    return this.backofficeService.getCondominiums();
  }

  @Get('plans')
  async getPlans() {
    return this.backofficeService.getPlans()
  }

  @Get('plans/:planId')
  async getPlanById(@Param('planId') planId: string) {
    return this.backofficeService.getPlanById(planId)
  }

  @Get('modules')
  async getModules() {
    return this.backofficeService.getModules()
  }


  @Get('tenants')
  async getTenants() {
    return this.backofficeService.getTenants()
  }

  @Get('apartaments')
  async getApartaments() {
    return this.backofficeService.getApartaments()
  }

  @Get('pages')
  async getPages() {
    return this.backofficeService.getPages()
  }


  async createModule() {

  }

  async createPage() {

  }
}