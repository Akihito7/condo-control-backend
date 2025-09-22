import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, UploadedFiles, UseGuards, UseInterceptors } from "@nestjs/common";
import { Token } from "src/decorators/token.decorator";
import { AuthGuard } from "src/guards/auth.guard";
import { StructureService } from "./structure.service";
import { BodyAsset, CreateEmployeeBody, InterventionBody, UpdateEmployeeScheduleBody } from "./types/dto/structure.dto";
import { FilesInterceptor } from "@nestjs/platform-express";
import { throws } from "assert";

@Controller('structure')
export class StructureController {

  constructor(private readonly structureService: StructureService) { }

  @Get('work-areas/options')
  async getWorkAreasOptions() {
    return this.structureService.getWorkAreasOptions();
  }

  @Get('employee-status/options')
  async getEmployeeStatusOptions() {
    return this.structureService.getEmployeeStatusOptions()
  }

  @Get('employee-roles/options')
  async getEmployeeRolesOptions() {
    return this.structureService.getEmployeeRolesOptions()
  }

  @Post('employee/create')
  async createEmployee(@Body() body: CreateEmployeeBody) {
    return this.structureService.createEmployee(body)
  }

  @Patch('employee/update')
  async updateEmployee(@Body() body: CreateEmployeeBody) {
    return this.structureService.updateEmployee(body)
  }

  @Get('employee/list/:condominiumId')
  async getEmployees(@Param("condominiumId") condominiumId: string) {
    return this.structureService.getEmployees(condominiumId)
  }

  @Delete('employee/delete')
  @HttpCode(204)
  async deleteEmployee(@Body() body: any) {
    return this.structureService.deleteEmployee(body);
  }

  @Get('employee/schedule/:condominiumId/:date')
  async getEmployeeSchedule(
    @Param() params: string
  ) {
    return this.structureService.getEmployeeSchedule(params);
  }

  @Put('employee/schedule/update/:condominiumId')
  async updateScheduleEmployee(
    @Param('condominiumId') condominiumId: string,
    @Body() body: UpdateEmployeeScheduleBody[]
  ) {
    return this.structureService.updateScheduleEmployee(body, condominiumId)
  }

  @Get('management-spaces/:condominiumId')
  async getManagementSpaces(@Param("condominiumId") condominiumId: string) {
    return this.structureService.getManagementSpaces(condominiumId)
  }

  @Get('management-spaces/events/:spaceId/:date')
  async getManagementSpacesEvents(@Param() params: any) {
    const { spaceId, date } = params;
    return this.structureService.getManagementSpacesEvents(spaceId, date)
  }

  @Put('management-spaces/events/:eventId')
  async updateSpaceEvent(
    @Param('eventId') eventId: string,
    @Body() body: any
  ) {
    return this.structureService.updateSpaceEvent(eventId, body)
  }

  @Delete('management-spaces/events/guest/:id')
  async deleteGuestSpaceEvent(@Param('id') guestId: string) {
    return this.structureService.deleteGuestSpaceEvent(guestId)
  }


  @Delete('management-spaces/events/:id')
  async deleteEvent(@Param('id') eventId: string) {
    return this.structureService.deleteEvent(eventId)
  }

  @Post('management-spaces/events/create')
  async createEventSpace(
    @Body() body: any) {
    return this.structureService.createEventSpace(body)
  }

  @Get('maintenance-backlog/:date')
  async getMaintenances(
    @Param('date') date: string,
    @Token() token: string
  ) {
    return this.structureService.getMaintenances(date, token);
  }

  @Post('maintenance-backlog/create/:condominiumId')
  async createMaintenance(
    @Param("condominiumId") condominiumId: string,
    @Token() token: string,
    @Body() body: InterventionBody
  ) {
    return this.structureService.createMaintenance(condominiumId, token, body)
  }

  @Put('maintenance-backlog/update/:id')
  async updateMaintenance(
    @Token() token: string,
    @Param('id') maintenanceId: string,
    @Body() body: any
  ) {
    return this.structureService.updateMaintenance(token, body, maintenanceId)
  }

  @Delete('maintenance-backlog/delete/:id')
  async deleteMaintenance(
    @Param('id') maintenanceId: string
  ) {
    return this.structureService.deleteMaintenance(maintenanceId)
  }

  @Get('maintenance-backlog/types/options')
  async getMaintenancesTypesOptions() {
    return this.structureService.getMaintenancesTypesOptions();
  }
  @Get('maintenance-backlog/priority/options')
  async getPriorityOptions() {
    return this.structureService.getPriorityOptions();
  }

  @Get('maintenance-backlog/status/options')
  async getMaintenancesStatus() {
    return this.structureService.getMaintenancesStatus()
  }

  @Get('maintenance-backlog/payment-methods/options')
  async getPaymentMethodsOptions() {
    return this.structureService.getPaymentMethodsOptions()
  }

  @Get('maintenance-backlog/areas/options/:condominiumId')
  async getAreas(@Param('condominiumId') condominiumId: string) {
    return this.structureService.getAreas(condominiumId);
  }

  @Get('maintenance-backlog/cards/:date')
  async getMaintenaneCards(
    @Param('date') date: string,
    @Token() token: string
  ) {
    return this.structureService.getMaintenaneCards(date, token);
  }

  @Get('maintenance-backlog/indicators/resume/:date')
  async getIndicatorsResume(
    @Param() params: { date: string },
    @Token() token: string
  ) {
    const { date } = params;
    return this.structureService.getIndicatorsResume(date, token);
  }

  @Get('asset/category/options')
  async getAssetsCategoryOptions() {
    return this.structureService.getAssetsCategoryOptions()
  }

  @Get('asset/status/options')
  async getAssetsStatusOptions() {
    return this.structureService.getAssetsStatusOptions()
  }

  @UseInterceptors(FilesInterceptor('photo'))
  @Post('asset/:condominiumId')
  async createAsset(
    @Param('condominiumId') condominiumId: string,
    @Body() body: BodyAsset,
    @UploadedFiles() photo: any,
  ) {
    return this.structureService.createAsset(condominiumId, body, photo)
  }

  @Get('assets/:condominiumId')
  async getAssets(@Param('condominiumId') condominiumId: string) {
    return this.structureService.getAssets(condominiumId)
  }

  @Put('assets/:assetId')
  async updateAsset(
    @Param('assetId') assetId: string,
    @Body() body: BodyAsset
  ) {
    return this.structureService.updateAsset(assetId, body)
  }


  @Delete('assets/:assetId')
  async deleteAsset(@Param('assetId') assetId: string) {
    return this.structureService.deleteAsset(assetId);
  }

  @Patch('assets/image/:assetId')
  @UseInterceptors(FilesInterceptor('photo'))
  async updateAssetImage(
    @Param('assetId') assetId,
    @UploadedFiles() photo: any,
  ) {
    return this.structureService.updateAssetImage(assetId, photo)
  }

  @Patch('assets/image/delete/:assetId')
  async deleteAssetImage(@Param('assetId') assetId) {
    return this.structureService.deleteAssetImage(assetId);
  }


  @Get('notifications')
  async getNotifications(@Token() token: string) {
    return this.structureService.getNotifications(token)
  }

  @Patch('notifications/:notificationId')
  async markNotificationAsRead(@Param('notificationId') notificationId) {
    return this.structureService.markNotificationAsRead(notificationId)
  }

  @Post('assets/report/:assetId')
  @UseInterceptors(FilesInterceptor('photos'))
  async createReportAsset(
    @Param('assetId') assetId: string,
    @Body() body: any,
    @UploadedFiles() photos: any,
    @Token() token: string,

  ) {
    return this.structureService.createReportAsset(assetId, body, photos, token)
  }

  @Get('assets/details/:assetId')
  async getAssetWithReports(@Param('assetId') assetId: string) {
    return this.structureService.getAssetWithReports(assetId)
  }

  @Get('maintenace-backlog/chart/improvements-by-area/:date')
  async getChartImprovementsByArea(@Param('date') date: string, @Token() token: string) {
    return this.structureService.getChartImprovementsByArea({ date, token })
  }

  @Get('maintenace-backlog/monthly-expenses/summary/:date')
  async getChartMonthlyExpensesSummary(@Param('date') date: string, @Token() token: string) {
    return this.structureService.getChartMonthlyExpensesSummary({ date, token })
  }
}