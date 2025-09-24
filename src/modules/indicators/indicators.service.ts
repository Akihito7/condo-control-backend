import { Inject, Injectable } from "@nestjs/common";
import { SUPABASE_CLIENT } from "../supabase/supabase.module";
import { SupabaseClient } from "@supabase/supabase-js";
import { ChartParams } from "./types/dto/indicators.dto";
import { equal } from "assert";


@Injectable()
export class IndicatorsService {
  constructor(@Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient) { }

  async getChartRevenueByCategory(filters: ChartParams) {
    const {
      condominiumId,
      startDate,
      endDate
    } = filters;

    const { data: financialRecords, error: financialRecordsError } = await this.supabase
      .from("financial_records")
      .select(`
        *,
        categories (*)
        `)
      .eq('condominium_id', condominiumId)
      .eq('is_deleted', false)
      .gte('due_date', startDate)
      .lte('due_date', endDate);

    if (financialRecordsError) {
      throw new Error(financialRecordsError.message)
    }
    const result: {
      name: string;
      id: number;
      value: string
    }[] = []

    const financialFilteredRevenue = financialRecords.filter(financial => financial.categories.income_expense_type_id === 4);

    financialFilteredRevenue.forEach(finacial => {
      const currentCategory = result.find(item => item.id === finacial.categories.id);

      if (!currentCategory) {
        const category = {
          name: finacial.categories.name,
          id: finacial.categories.id,
          value: finacial.amount_paid
        }
        return result.push(category);
      }

      currentCategory!.value = currentCategory?.value + finacial.amount_paid
    })

    return result.sort((a, b) => Number(b.value) - Number(a.value))
  }

  async getChartExpenseByCategory(filters: ChartParams) {
    const {
      condominiumId,
      startDate,
      endDate
    } = filters;

    const { data: financialRecords, error: financialRecordsError } = await this.supabase
      .from("financial_records")
      .select(`
        *,
        categories (*)
        `)
      .eq('condominium_id', condominiumId)
      .eq('is_deleted', false)
      .gte('due_date', startDate)
      .lte('due_date', endDate);

    if (financialRecordsError) {
      throw new Error(financialRecordsError.message)
    }

    const result: {
      name: string;
      id: number;
      value: string
    }[] = []

    const financialFilteredExpense = financialRecords.filter(financial => financial.categories.income_expense_type_id === 6);

    financialFilteredExpense.forEach(finacial => {
      const currentCategory = result.find(item => item.id === finacial.categories.id);

      if (!currentCategory) {
        const category = {
          name: finacial.categories.name,
          id: finacial.categories.id,
          value: finacial.amount_paid
        }
        return result.push(category);
      }

      currentCategory!.value = currentCategory?.value + finacial.amount_paid
    })

    return result.sort((a, b) => Number(b.value) - Number(a.value));
  }

  async getChartRevenuFixedVariable(filters: ChartParams) {
    const {
      condominiumId,
      startDate,
      endDate
    } = filters;

    const { data: financialRecords, error: financialRecordsError } = await this.supabase
      .from("financial_records")
      .select(`
        *,
        categories (*)
        `)
      .eq('condominium_id', condominiumId)
      .eq('is_deleted', false)
      .gte('due_date', startDate)
      .lte('due_date', endDate);

    if (financialRecordsError) {
      throw new Error(financialRecordsError.message)
    }

    const financialFilteredRevenue = financialRecords.filter(financial => financial.categories.income_expense_type_id === 4);

    const totalAmountRegisters = financialFilteredRevenue.reduce((acc, currentValue) => (acc += currentValue.amount), 0);
    const totalAmountRegistersFixed = financialFilteredRevenue.filter(financial => financial.categories.record_type_id === 1)
      .reduce((acc, currentValue) => (acc += currentValue.amount), 0)
      ;
    const totalAmountRegistersVariable = financialFilteredRevenue.filter(financial => financial.categories.record_type_id === 2)
      .reduce((acc, currentValue) => (acc += currentValue.amount), 0)
      ;

    const result = {
      fixed: ((totalAmountRegistersFixed / totalAmountRegisters) * 100).toFixed(2),
      variable: ((totalAmountRegistersVariable / totalAmountRegisters) * 100).toFixed(2)
    }

    return [{
      name: 'Fixo',
      value: parseFloat(result.fixed)
    }, {
      name: 'Variavel',
      value: parseFloat(result.variable)
    }]

  }

  async getChartExpensiveFixedVariable(filters: ChartParams) {
    const {
      condominiumId,
      startDate,
      endDate
    } = filters;

    const { data: financialRecords, error: financialRecordsError } = await this.supabase
      .from("financial_records")
      .select(`
        *,
        categories (*)
        `)
      .eq('condominium_id', condominiumId)
      .eq('is_deleted', false)
      .gte('due_date', startDate)
      .lte('due_date', endDate);

    if (financialRecordsError) {
      throw new Error(financialRecordsError.message)
    }

    const financialFilteredRevenue = financialRecords.filter(financial => financial.categories.income_expense_type_id === 6);

    const totalAmountRegisters = financialFilteredRevenue.reduce((acc, currentValue) => acc += currentValue.amount, 0);

    const totalAmountRegistersFixed = financialFilteredRevenue.filter(financial => financial.categories.record_type_id === 1)
      .reduce((acc, currentValue) => acc += currentValue.amount, 0);
    const totalAmountRegistersVariable = financialFilteredRevenue.filter(financial => financial.categories.record_type_id === 2)
      .reduce((acc, currentValue) => acc += currentValue.amount, 0)

    console.log(totalAmountRegisters)

    const result = {
      fixed: ((totalAmountRegistersFixed / totalAmountRegisters) * 100).toFixed(2),
      variable: ((totalAmountRegistersVariable / totalAmountRegisters) * 100).toFixed(2)
    }

    return [{
      name: 'Fixo',
      value: parseFloat(result.fixed)
    }, {
      name: 'Variavel',
      value: parseFloat(result.variable)
    }]
  }

  async getFinancialSummaryMonthlyBalance(filters: any) {
    const {
      condominiumId,
      year
    } = filters;
    const { data, error } = await this.supabase.rpc('get_chart_monthly_totals_by_type', {
      condo_id: condominiumId,
      target_year: year
    });

    if (error) {
      throw new Error(error.message)
    }

    const resultFormmated: any[] = [];

    const shortMonths = [
      'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
      'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
    ];


    for (let i = 0; i < 12; i++) {

      const hasIndexMonth = data.filter(item => {
        const [_, currentMonth] = item.month.split('-');
        const matchWithIndexMonth = Number(currentMonth) === (i + 1);
        return matchWithIndexMonth
      })

      const formattedMonth = `${shortMonths[i]}/${String(year).slice(-2)}`;
      if (hasIndexMonth.length === 0) {
        const monthData = {
          month: formattedMonth,
          income: 0,
          expense: 0,
          total: 0
        }

        resultFormmated.push(monthData)
        continue;
      }

      const totalncome = hasIndexMonth.filter(item => item.record_type_id === 4)?.[0]?.total ?? 0
      const totalExpense = hasIndexMonth.filter(item => item.record_type_id === 6)?.[0]?.total ?? 0
      const total = totalncome - totalExpense;

      const monthData = {
        month: formattedMonth,
        income: totalncome,
        expense: totalExpense,
        total,
      }
      resultFormmated.push(monthData)
    }

    let left = 0;
    let right = 1;
    while (right < resultFormmated.length) {
      const total = resultFormmated[left].total + resultFormmated[right].total;
      resultFormmated[right].total = total;
      left + 1
      right + 1
    }
    return resultFormmated

  }
} 