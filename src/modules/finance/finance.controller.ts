import { Body, Controller, Delete, Get, Header, HttpCode, Param, Patch, Post, Put, Query, Res, UseGuards, UseInterceptors } from "@nestjs/common";
import { BodyTransaction, CreateDeliquencyBodyDTO, FinanceInfoByCondominium, GetDelinquencyParamsDTO, GetProjectionParams, GetRegistersByCondominiumId, PatchDelinquencyBodyDTO, QueryGetRegistersByCondominiumId, UpdateCondominiumExpensesBody, UpdateCondominiumIncomesBody, UpdateRevenueBody, UpdateRevenueParams } from "./types/dto/finance.dto";
import { FinanceService } from "./finance.service";
import { Roles, RolesGuard } from "src/decorators/roles.decorator";
import { AuthGuard } from "src/guards/auth.guard";
import { Token } from "src/decorators/token.decorator";

@Controller('finance')
@UseGuards(AuthGuard, RolesGuard)
export class FinanceController {

  constructor(private readonly financeService: FinanceService) { }


  @Get('registers/:condominiumId/:selectedDate')
  async getRegistersByCondominiumId(@Param() param: GetRegistersByCondominiumId, @Query() query: QueryGetRegistersByCondominiumId) {
    const incomeExpenseOptions = query["incomeExpenseOptionsSelectedId[]"];
    const incomeExpenseOptionsFormatted = Array.isArray(incomeExpenseOptions)
      ? incomeExpenseOptions.map(Number)
      : [incomeExpenseOptions].map(Number)
    const filters = { ...param, incomeExpenseOptions: incomeExpenseOptionsFormatted }
    return this.financeService
      .getFinancialRecordsByCondominiumId(filters);
  }

  @Get('delinquency/monthly-evolution/:date')
  async getDelinquencyRecords(
    @Token() token: string, @Param() params: any) {
    const { date } = params;
    return this.financeService.getDelinquencyRecords(token, date)
  }

  @Get('/delinquency/:condominiumId/all-period')
  async getDelinquencyRegisterAllPeriod(@Param() param: { condominiumId: string }) {
    return this.financeService.getDelinquencyRegisterAllPeriod(param)
  }


  @Get('/delinquency/:condominiumId/:date')
  async getDelinquencyRegister(@Param() param: GetDelinquencyParamsDTO) {
    return this.financeService.getDelinquencyRegister(param)
  }

  @Get('/:condominiumId/:startDate/:endDate')
  async getFinanaceInfoByCondominium(@Param() params: FinanceInfoByCondominium) {
    return this.financeService.getFinanaceInfoByCondominium(params)
  }

  @Patch('update/revenue/:condominiumId/:startDate/:endDate')
  async updateRevenue(@Param() params: UpdateRevenueParams, @Body() body: UpdateRevenueBody) {
    return this.financeService.updateRevenue()
  }


  @Patch('update/expensive')
  async updateExpensive() {

  }

  @Post('records/:condominiumId')
  async createFinanceRecords(@Param('condominiumId') id: string) {
    return {
      message: 'Finance record created (mock)',
      condominiumId: id,
    };
  }

  @Get('categories-options')
  async getCategoriesOptions() {
    return this.financeService.getCategoriesOptions()
  }

  @Get('income-expense-options')
  async getIncomeExpenseOptions() {
    return this.financeService.getIncomeExpenseOptions()
  }

  @Get('payment-methods-options')
  async getPaymentMethodsOptions() {
    return this.financeService.getPaymentMethodsOptions()
  }

  @Get('apartments/:condominiumId')
  async getApartmentsByCondominiumId(@Param() params: any) {
    return this.financeService.getApartmentsByCondominiumId(params.condominiumId)
  }

  @Get('payment-status-options')
  async getPaymentStatusOptions() {
    return this.financeService.getPaymentStatusOptions()
  }

  @Post("create-transaction")
  async createTransaction(@Body() body: BodyTransaction) {
    return this.financeService.createTransaction(body)
  }

  @Get('revenue-total/:condominiumId/:startDate/:endDate')
  async getRevenueTotal(@Param() param: GetRegistersByCondominiumId) {
    return this.financeService.cardsFinancialEntry(param)
  }

  @Get('expenses-total/:condominiumId/:startDate/:endDate')
  async getExpensesTotal(@Param() param: GetRegistersByCondominiumId) {
    return this.financeService.getExpensesTotal(param)
  }

  @HttpCode(204)
  @Delete('registers/:registerId')
  async deleteFinancialRegister(@Param("registerId") registerId: string) {
    return this.financeService.deleteFinancialRegister(Number(registerId))
  }


  @HttpCode(204)
  @Put('registers/:registerId')
  async updateFinancialRegister(
    @Param("registerId") registerId: string,
    @Body() body: BodyTransaction
  ) {
    return this.financeService.updateFinancialRegister(Number(registerId), body)
  }

  @Patch('condominium/incomes/:condominiumId/:date')
  async updateCondominiumIncomes(
    @Param('date') date: string,
    @Param('condominiumId') condominiumId: string,
    @Body() body: UpdateCondominiumIncomesBody,
  ) {
    return this.financeService.updateCondominiumIncomes(date, condominiumId, body)
  }

  @Patch('condominium/expenses/:condominiumId/:date')
  async updateCondominiumExpenses(
    @Param('date') date: string,
    @Param('condominiumId') condominiumId: string,
    @Body() body: UpdateCondominiumExpensesBody,
  ) {
    return this.financeService.updateCondominiumExpenses(date, condominiumId, body)
  }

  @Patch('condominium/income-expenses/:condominiumId/:date')
  async redefineIncomesExpensesToCalculated(
    @Query("type") type: 'income' | 'expenses',
    @Param() params: any,
  ) {
    return this.financeService.redefineIncomesExpensesToCalculated(type, params);
  }

  @Get('projection/cards/:condominiumId/:date')
  async getProjectionCards(@Param() param: GetProjectionParams) {
    return this.financeService.getProjectionCards(param)
  }

  @Get('projection/registers/:condominiumId/:date')
  async getProjectionRegisters(@Param() param: GetProjectionParams) {
    return this.financeService.getProjectionRegisters(param)
  }

  @Post('delinquency/create/:condominiumId')
  @Roles('admin')
  async createDelinquency(
    @Param("condominiumId") condominiumId: string,
    @Body() body: CreateDeliquencyBodyDTO) {

    return this.financeService.createDelinquency(condominiumId, body)
  }

  @Patch('delinquency/update/:delinquencyId')
  async updateDelinquency(
    @Param("delinquencyId") delinquencyId,
    @Body() body: PatchDelinquencyBodyDTO
  ) {

    return this.financeService.updateDelinquency(delinquencyId, body)
  }

  @Delete('delinquency/:delinquencyId')
  async deleteDelinquency(@Param('delinquencyId') delinquencyId: string) {
    return this.financeService.deleteDelinquency(delinquencyId)
  }

  @Get('delinquency/resume/:startDate/:endDate')
  async getDelinquencyResume(
    @Param() params: {
      startDate: string,
      endDate: string;
    },
    @Token() token: string) {
    const { startDate, endDate } = params;
    return this.financeService.getDelinquencyResume({
      startDate,
      endDate,
      token
    })
  }

  @Get('delinquency/chart/distribution-by-type/:startDate/:endDate')
  async getChartDistribuitionByType(
    @Param() params: {
      startDate: string,
      endDate: string;
    },
    @Token() token: string
  ) {
    const {
      startDate,
      endDate
    } = params;
    return this.financeService.getChartDistruibitionByType({
      startDate,
      endDate,
      token
    })
  }
}
