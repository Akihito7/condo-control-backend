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

  @Get('condominiums')
  async getCondominiums() {
    return this.backofficeService.getCondominiums();
  }

  @Get('apartaments')
  async getApartaments() {
    return this.backofficeService.getApartaments()
  }


  async createModule() {

  }

  async createPage() {

  }
}