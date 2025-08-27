import { Body, Controller, Delete, Get, Param, Patch, Post, Put, UploadedFiles, UseGuards, UseInterceptors } from "@nestjs/common";
import { CommunicationService } from "./communication.service";
import { BodyCreateEvent, BodyOpeningCalls, ParamOpeningCalls } from "./types/dto/communication.dto";
import { FilesInterceptor } from "@nestjs/platform-express";
import { AuthGuard } from "src/guards/auth.guard";
import { Token } from "src/decorators/token.decorator";

@Controller('communication')
export class CommunicationController {
  constructor(private readonly communicationSerivce: CommunicationService) { }

  @Get('assembly-virtual/polls/vote-options/:pollId')
  async getOptionsVoteByPoll(@Param('pollId') pollId: string) {
    return this.communicationSerivce.getOptionsVoteByPoll(pollId)
  }

  @Get('opening-calls/options/status')
  async getOptionsStatusOpeningCalls() {
    return this.communicationSerivce.getOptionsStatusOpeningCalls()
  }

  @Get('opening-calls/options/issues')
  async getOptionsIssuesOpeningCalls() {
    return this.communicationSerivce.getOptionsIssuesOpeningCalls()
  }

  @Get('opening-calls/cards/:condominiumId/:startDate/:endDate')
  async getCardsOpeningOfCalls(@Param() param: ParamOpeningCalls) {
    return this.communicationSerivce.getCardsOpeningOfCalls(param)
  }

  @Get('opening-calls/records/:condominiumId/:startDate/:endDate')
  async getRecordsOpeningOfCalls(@Param() param: ParamOpeningCalls) {
    return this.communicationSerivce.getRecordsOpeningOfCalls(param)
  }

  @Post('opening-calls/records/create/:condominiumId')
  @UseInterceptors(FilesInterceptor('attachment'))
  async createOpeningCallRecord(
    @Param('condominiumId') condominiumId: string,
    @Body() body: BodyOpeningCalls,
    @UploadedFiles() attachment: any,
  ) {
    return this.communicationSerivce.createOpeningCallRecord(condominiumId, body, attachment)
  }

  @Put('opening-calls/records/update/:recordId')
  async updateOpeningCallRecord(
    @Param("recordId") recordId: string,
    @Body() body: Omit<BodyOpeningCalls, 'date'>
  ) {

    return this.communicationSerivce.updateOpeningCallRecord(recordId, body)
  }

  @Post('opening-calls/attachment/donwload')
  async openingCallsAttachmentDownload(@Body() body: any) {
    return this.communicationSerivce.openingCallsAttachmentDownload(body.fullPath)
  }


  //mudar para o modulo correto depois
  @Get('employees')
  async getEmployees() {
    return this.communicationSerivce.getEmployees();
  }

  @Post("opening-calls/attachment/upload")
  @UseInterceptors(FilesInterceptor('attachment'))
  async createAttachmentOpeningCalls(
    @Body() data: any,
    @UploadedFiles() attachment: any
  ) {
    return this.communicationSerivce.createAttachmentOpeningCalls(data.openingRecordId, data.condominiumId, attachment)
  }

  @Delete("opening-calls/attachment/delete/:attachmentId")
  async deleteAttachmentOpeningCall(@Param('attachmentId') attachmentId: string) {
    return this.communicationSerivce.deleteAttachmentOpeningCall(attachmentId)
  }


  @Delete("opening-calls/records/delete/:recordId")
  async deleteOpeningCallsRecord(@Param('recordId') recordId: string) {
    return this.communicationSerivce.deleteOpeningCallsRecord(recordId)
  }

  @Get('delivery/status-options')
  async getDeliveryStatusOptions() {
    return this.communicationSerivce.getDeliveryStatusOptions();
  }

  @Get('apartaments/:condominiumId')
  async getApartamentsByCondominiumId(@Param("condominiumId") condominiumId: string) {
    return this.communicationSerivce.getApartamentsByCondominiumId(condominiumId)
  }

  @Get('deliveries/:condominiumId/:startDate/:endDate')
  async getDeliveriesByCondominiumId(@Param() params: any) {
    return this.communicationSerivce.getDeliveriesByCondominiumId(params)
  }

  @Post('delivery/create')
  @UseInterceptors(FilesInterceptor('attachment'))
  async createDelivery(
    @Body() body: FormData,
    @UploadedFiles() attachment: any
  ) {
    return this.communicationSerivce.createDelivery(body, attachment);
  }

  @Patch('delivery/update/:deliveryId')
  @UseInterceptors(FilesInterceptor('attachment'))
  async updateDelivery(
    @Param('deliveryId') deliveryId: string,
    @Body() body: FormData,
    @UploadedFiles() attachment: any
  ) {
    return this.communicationSerivce.updateDelivery(deliveryId, body, attachment);
  }

  @Patch('delivery/mark-as-delivered/:id')
  async markAsDelivered(@Param('id') deliveryId) {
    return this.communicationSerivce.markAsDelivered(deliveryId)
  }

  @Delete('delivery/delete/:deliveryId')
  async deleteDelivery(@Param("deliveryId") deliveryId: string) {
    return this.communicationSerivce.deleteDelivery(deliveryId)
  }

  @UseGuards(AuthGuard)
  @Get('assembly-virtual/polls/:condominiumId/:date')
  async getAssemblyVirtualPolls(@Param() filters: {
    date: string,
    condominiumId: string,
  },
    @Token() token) {
    return this.communicationSerivce.getAssemblyVirtualPolls(filters, token)
  }

  @UseGuards(AuthGuard)
  @Post('assembly-virtual/polls/vote/:pollId')
  async createVoteAssemblyVirtualPoll(
    @Param('pollId') pollId: string,
    @Body() body: {
      choice: string;
    },
    @Token() token,
  ) {
    return this.communicationSerivce.createVoteAssemblyVirtualPoll(pollId, body, token)
  }

  @Post('assembly-virtual/polls/create')
  async createAssemblyVirtualPoll(
    @Body() body: any,
    @Token() token: string
  ) {
    return this.communicationSerivce.createAssemblyVirtualPoll(body, token)
  }

  @Put('assembly-virtual/polls/update/:pollId')
  async updateAssemblyVirtualPoll(
    @Param("pollId") pollId: string,
    @Body() body: any,
    @Token() token: string
  ) {
    return this.communicationSerivce.updateAssemblyVirtualPoll(pollId, body, token)
  }

  @Delete('assembly-virtual/polls/delete/:pollId')
  async deleteAssemblyVirtualPoll(@Param("pollId") pollId: string,) {
    return this.communicationSerivce.deleteAssemblyVirtualPoll(pollId)
  }

  @Get('schedule/:condominiumId/:date')
  async getScheduleCondomnium(@Param() params: any) {
    const { condominiumId, date } = params;
    return this.communicationSerivce.getScheduleCondomnium({
      condominiumId,
      date
    })
  }

  @Post('schedule')
  async createEventCondominium(
    @Token() token: string,
    @Body() body: BodyCreateEvent) {
    return this.communicationSerivce.createEventCondominium(token, body);
  }
}