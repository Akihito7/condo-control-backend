import { Controller, Get, Param } from "@nestjs/common";
import { IndicatorsService } from "./indicators.service";
import { ChartParams } from "./types/dto/indicators.dto";

@Controller('indicators')
export class IndicatorsController {

  constructor(private readonly indicatorsService: IndicatorsService) { }

  @Get('chart/revenue-by-category/:condominiumId/:startDate/:endDate')
  async getChartRevenueByCategory(
    @Param() params: ChartParams
  ) {
    return this.indicatorsService.getChartRevenueByCategory(params)
  }

  @Get('chart/expense-by-category/:condominiumId/:startDate/:endDate')
  async getChartExpenseByCategory(
    @Param() params: ChartParams
  ) {
    return this.indicatorsService.getChartExpenseByCategory(params)
  }


  @Get('chart/revenue/fixed-vs-variable/:condominiumId/:startDate/:endDate')
  async getChartRevenuFixedVariable(
    @Param() params: ChartParams
  ) {
    return this.indicatorsService.getChartRevenuFixedVariable(params)
  }

  @Get('chart/expensive/fixed-vs-variable/:condominiumId/:startDate/:endDate')
  async getChartExpensiveFixedVariable(
    @Param() params: ChartParams
  ) {
    return this.indicatorsService.getChartExpensiveFixedVariable(params)
  }

  @Get('chart/financial-summary/monthly-balance/:condominiumId/:year')
  async getFinancialSummaryMonthlyBalance(
    @Param() params: any
  ) {
    return this.indicatorsService.getFinancialSummaryMonthlyBalance(params)
  }
}