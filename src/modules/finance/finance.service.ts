import { Inject, Injectable } from "@nestjs/common";
import { SUPABASE_CLIENT } from "../supabase/supabase.module";
import { SupabaseClient } from "@supabase/supabase-js";
import camelcaseKeys from "camelcase-keys";
import { BodyTransaction, CreateDeliquencyBodyDTO, FinanceInfoByCondominium, GetDelinquencyParamsDTO, GetProjectionParams, GetRegistersByCondominiumId, PatchDelinquencyBodyDTO, UpdateCondominiumExpensesBody, UpdateCondominiumIncomesBody } from "./types/dto/finance.dto";
import { startOfMonth, subMonths, format, differenceInMonths, isThisISOWeek, differenceInDays, addMonths, parseISO } from "date-fns"
import { getFullMonthInterval } from "src/utils/get-full-month-interval";
import { FinanceResponseData } from "./types/response/finance.response";
import { AuthService } from "../auth/auth.service";
import { flattenObject } from "src/utils/flatten-object";



@Injectable()
export class FinanceService {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly authService: AuthService
  ) { }

  async getFinanaceInfoByCondominium(
    { condominiumId, startDate, endDate }: FinanceInfoByCondominium): Promise<FinanceResponseData> {
    const { data, error } = await this.supabase
      .from('financial_records')
      .select("*")
      .eq('condominium_id', condominiumId)
    /*   .eq('period', period)
 */
    if (error) {
      throw new Error(error.message)
    }

    const result = camelcaseKeys(data[0]);

    return result;
  }

  async updateRevenue() {

  }

  async getFinancialRecordsByCondominiumId({ condominiumId, selectedDate, incomeExpenseOptions }: any) {
    const {
      startDate,
      endDate
    } = getFullMonthInterval(selectedDate)
    const { data: categories } = await this.supabase
      .from('categories')
      .select('id')
      .in('income_expense_type_id', incomeExpenseOptions);
    const categoryIds = categories?.map(c => c.id) ?? [];

    const { data, error } = await this.supabase.rpc('get_filtered_financial_records', {
      p_condominium_id: condominiumId,
      p_start_date: startDate,
      p_end_date: endDate,
      p_category_ids: categoryIds,
    });



    if (error) {
      throw new Error(error.message)
    }

    const normalized = data.map((record) => ({
      ...record,
      category_name: record.categories?.name || null,
      category_type_id: record.categories?.income_expense_type_id || null,
      category_type_name: record.categories?.income_expense_types?.name || null,
      payment_method_name: record.payment_methods?.name || null,
      payment_status_name: record.payment_status?.name || null,
      apartment_number: record.apartment?.apartment_number || null,
      apartment_id: record.apartment?.id || null,
      income_expense_type_id: record.categories?.income_expense_type_id || null,
      payment_method_id: record.payment_methods?.id || null,
      payment_status_id: record.payment_methods?.id || null,
      record_type_id: record.categories?.record_type_id || null
    }));

    return camelcaseKeys(normalized)
  }

  async getCategoriesOptions() {
    const { data, error } = await this.supabase.from('categories')
      .select(`*`)

    if (error) {
      throw new Error(error.message)
    }

    return camelcaseKeys(data);
  }

  async getIncomeExpenseOptions() {
    const { data, error } = await this.supabase.from('income_expense_types')
      .select('*')

    if (error) {
      throw new Error(error.message)
    }

    return camelcaseKeys(data);
  }

  async getPaymentMethodsOptions() {
    const { data, error } = await this.supabase.from('payment_methods')
      .select('*')

    if (error) {
      throw new Error(error.message)
    }

    return camelcaseKeys(data);
  }

  async getApartmentsByCondominiumId(condominiumId: number) {
    const { data, error } = await this.supabase
      .from('apartment')
      .select("*")
      .eq('condominium_id', condominiumId);

    if (error) {
      throw new Error(error.message)
    }

    return camelcaseKeys(data);
  }

  async getPaymentStatusOptions() {
    const { data, error } = await this.supabase.from('payment_status')
      .select('*')

    if (error) {
      throw new Error(error.message)
    }

    return camelcaseKeys(data);
  }

  async createTransaction(data: BodyTransaction) {
    const { error } = await this.supabase.from("financial_records").insert([
      {
        condominium_id: data.condominiumId,
        category_id: data.categoryId,
        due_date: data.dueDate,
        amount_paid: Number(data.amountPaid),
        apartament_id: data.apartmentId === -1 ? null : data.apartmentId,
        status: data.paymentStatusId,
        payment_method_id: data.paymentMethodId,
        observation: data.notes,
        amount: Number(data.amount),
        is_recurring: data.recurring,
        notes: data.notes,
        payment_date: data.paymentDate,
      }
    ])

    if (error) {
      throw new Error(error.message)
    }
  }

  async getRevenueTotal({
    condominiumId,
    startDate,
    endDate
  }: any) {
    const [year, monthStartDate] = String(startDate).split('-');
    const [, monthEndDate] = String(endDate).split('-');
    const startDateFormatted = `${year}-${monthStartDate}-01`
    const isSameMonth = monthStartDate === monthEndDate;

    const { data: incomes } = await this.supabase
      .from('condominium_finances')
      .select("*")
      .eq("condominium_id", condominiumId)
      .gte('reference_month', startDateFormatted)
      .lte('reference_month', endDate);


    let accumulatedBalance = 0;


    let start = new Date(startDateFormatted);
    let end = new Date(endDate);
    let current = new Date(start.getFullYear(), 0, 1);
    end = new Date(end.getFullYear(), 11, 31);

    while (current <= end) {
      const monthKey = format(current, "yyyy-MM-dd");
      // tenta pegar o saldo do mês em condominium_finances
      const { data: monthFinance } = await this.supabase
        .from("condominium_finances")
        .select("*")
        .eq("condominium_id", condominiumId)
        .eq("reference_month", monthKey);

      let monthIncome = monthFinance?.[0]?.income ?? null;
      let monthExpense = monthFinance?.[0]?.expenses ?? null; // <- se existir no condomínio
      const { data: records } = await this.supabase
        .from("financial_records")
        .select(`
        amount_paid,
        categories (income_expense_type_id)
      `)
        .eq("is_deleted", false)
        .eq("condominium_id", condominiumId)
        .gte("payment_date", format(current, "yyyy-MM-01"))
        .lte(
          "payment_date",
          format(new Date(current.getFullYear(), current.getMonth() + 1, 0), "yyyy-MM-dd")
        );

      if (monthIncome == null) {
        // se não tiver, calcular pelas financial_records
        const INCOME_TYPE_ID = 4;

        monthIncome =
          records?.reduce((total, register: any) => {
            if (register.categories?.income_expense_type_id === INCOME_TYPE_ID) {
              return total + register.amount_paid;
            }
            return total;
          }, 0) ?? 0;
      }

      if (monthExpense == null) {
        const EXPENSE_TYPE_ID = 6;
        monthExpense =
          records?.reduce((total, register: any) => {
            if (register.categories?.income_expense_type_id === EXPENSE_TYPE_ID) {
              return total + register.amount_paid;
            }
            return total;
          }, 0) ?? 0;

      }

      // saldo do mês (receitas - despesas)
      accumulatedBalance += monthIncome - monthExpense;

      current = addMonths(current, 1);
    }
    const totalIncomeFromCondiminiumFinances = incomes?.[0]?.income ?? 0
    const incomeTarget = incomes?.[0]?.income_target ?? undefined

    if (totalIncomeFromCondiminiumFinances) {
      return {
        totalIncome: totalIncomeFromCondiminiumFinances,
        incomeTarget: isSameMonth ? incomeTarget : undefined,
        accumulatedBalance
      }
    }

    const { data } = await this.supabase
      .from('financial_records')
      .select(`
      *, 
      apartment (apartment_number),
      payment_status (name),
      payment_methods (name),
      categories (
        name,  
        income_expense_type_id, 
        income_expense_types (name)
      )
    `)
      .eq('is_deleted', false)
      .eq('condominium_id', condominiumId)
      .gte('payment_date', startDate)
      .lte('payment_date', endDate);

    const INCOME_TYPE_ID = 4;

    const totalIncomeFromRegisters = data?.reduce((total, register) => {
      if (register.categories?.income_expense_type_id === INCOME_TYPE_ID) {
        return total + register.amount_paid
      }
      return total
    }, 0)

    return {
      totalIncome: totalIncomeFromRegisters,
      incomeTarget: isSameMonth ? incomeTarget : undefined,
      accumulatedBalance
    }
  }

  async getExpensesTotal({
    condominiumId,
    startDate,
    endDate
  }: any) {
    const [year, monthStartDate] = String(startDate).split('-');
    const startDateFormatted = `${year}-${monthStartDate}-01`
    const [, monthEndDate] = String(endDate).split('-');
    const isSameMonth = monthStartDate === monthEndDate;
    const { data: finances } = await this.supabase
      .from('condominium_finances')
      .select('*')
      .eq('condominium_id', condominiumId)
      .gte('reference_month', startDateFormatted)
      .lte('reference_month', endDate);

    const totalExpensesFromCondominiumFinances = finances?.[0]?.expenses ?? 0;
    const expensesTarget = finances?.[0]?.expenses_target ?? undefined

    if (totalExpensesFromCondominiumFinances) {
      return {
        totalExpenses: totalExpensesFromCondominiumFinances,
        expensesTarget: isSameMonth ? expensesTarget : undefined
      }
    }

    const { data: records } = await this.supabase
      .from('financial_records')
      .select(`
      *, 
      apartment (apartment_number),
      payment_status (name),
      payment_methods (name),
      categories (
        name,  
        income_expense_type_id, 
        income_expense_types (name)
      )
    `)
      .eq('is_deleted', false)
      .eq('condominium_id', condominiumId)
      .gte('payment_date', startDate)
      .lte('payment_date', endDate);

    const EXPENSE_TYPE_ID = 6;

    const totalExpensesFromRegisters = records?.reduce((total, record) => {
      if (record.categories?.income_expense_type_id === EXPENSE_TYPE_ID) {
        return total + record.amount_paid;
      }
      return total;
    }, 0) ?? 0;

    return {
      totalExpenses: totalExpensesFromRegisters,
      expensesTarget: isSameMonth ? expensesTarget : undefined
    };
  }

  async cardsFinancialEntry({
    condominiumId,
    endDate,
    startDate
  }: any) {
    const [, monthStartDate] = String(startDate).split('-');
    const [, monthEndDate] = String(endDate).split('-');
    const isSameMonth = monthStartDate === monthEndDate;
    const { totalIncome, incomeTarget, accumulatedBalance } = await this.getRevenueTotal({ condominiumId, startDate, endDate });
    const { totalExpenses, expensesTarget } = await this.getExpensesTotal({ condominiumId, startDate, endDate });
    const balance = totalIncome - totalExpenses
    return {
      totalIncome,
      incomeTarget,
      totalExpenses,
      expensesTarget,
      balance,
      isSameMonth,
      accumulatedBalance
    }
  }

  async deleteFinancialRegister(registerId: number) {
    const { error } = await this.supabase.from('financial_records')
      .update({
        is_deleted: true
      })
      .eq('id', registerId);

    if (error) {
      throw new Error(error.message)
    }

  }

  async updateFinancialRegister(registerId: number, transaction: BodyTransaction) {
    const { error } = await this.supabase.from("financial_records").update([
      {
        payment_date: transaction.paymentDate,
        condominium_id: transaction.condominiumId,
        category_id: transaction.categoryId,
        due_date: transaction.dueDate,
        amount_paid: Number(transaction.amountPaid),
        apartament_id: transaction.apartmentId,
        status: transaction.paymentStatusId,
        payment_method_id: transaction.paymentMethodId,
        observation: transaction.notes,
        amount: Number(transaction.amount),
        is_recurring: transaction.recurring,
        notes: transaction.notes
      }
    ])
      .eq('id', registerId)

    if (error) {
      throw new Error(error.message)
    }
  }

  async updateCondominiumIncomes(date: string, condominiumId: string, data: UpdateCondominiumIncomesBody) {

    const { startDate, endDate } = getFullMonthInterval(date);

    const { data: condiminiumFinances } = await this.supabase
      .from('condominium_finances')
      .select('*')
      .eq('condominium_id', condominiumId)
      .gte('reference_month', startDate)
      .lte('reference_month', endDate);


    if (condiminiumFinances?.length === 0) {
      const { error: createError } = await this.supabase.from('condominium_finances').insert({
        condominium_id: condominiumId,
        income: Number(data.income),
        income_target: Number(data.targetIncome),
        reference_month: startDate,
      })

      if (createError) {
        throw new Error(createError.message)
      }

      return;
    }

    const condominiumFinanceId = condiminiumFinances?.[0]?.id;

    const { error: updateError } = await this.supabase.from('condominium_finances').update({
      income: Number(data.income),
      income_target: Number(data.targetIncome),
    })
      .eq('id', condominiumFinanceId)

    if (updateError) {
      throw new Error(updateError.message)
    }
  }

  async updateCondominiumExpenses(
    date: string,
    condominiumId: string,
    data: UpdateCondominiumExpensesBody
  ) {
    const { startDate, endDate } = getFullMonthInterval(date);
    const { data: condiminiumFinances } = await this.supabase
      .from('condominium_finances')
      .select('*')
      .eq('condominium_id', condominiumId)
      .gte('reference_month', startDate)
      .lte('reference_month', endDate);


    if (condiminiumFinances?.length === 0) {
      const { error: createError } = await this.supabase.from('condominium_finances').insert({
        condominium_id: condominiumId,
        expenses: Number(data.expenses),
        expenses_target: Number(data.targetExpenses),
        reference_month: startDate,
      })

      if (createError) {
        throw new Error(createError.message)
      }
    }
    const condominiumFinanceId = condiminiumFinances?.[0]?.id;

    const { error: updateError } = await this.supabase.from('condominium_finances').update({
      expenses: Number(data.expenses),
      expenses_target: Number(data.targetExpenses)
    })
      .eq('id', condominiumFinanceId)

    if (updateError) {
      throw new Error(updateError.message)
    }

  }

  async redefineIncomesExpensesToCalculated(type: 'income' | 'expenses', data: any) {
    const { startDate, endDate } = getFullMonthInterval(data.date);
    const { data: condiminiumFinances } = await this.supabase
      .from('condominium_finances')
      .select('*')
      .eq('condominium_id', data.condominiumId)
      .gte('reference_month', startDate)
      .lte('reference_month', endDate);


    const condominiumFinanceId = condiminiumFinances?.[0]?.id;

    const fieldToUpdate = type === 'income' ? 'income' : 'expenses'

    const { error } = await this.supabase.from("condominium_finances").update({
      [fieldToUpdate]: null
    })
      .eq('id', condominiumFinanceId)

    if (error) {
      throw new Error(error.message)
    }
  }

  async getProjectionCards(data: GetProjectionParams) {
    const currentDate = new Date()
    const dateSubtractOneMonth = format(currentDate, "yyyy-MM-dd");
    const dateFromParams = new Date(data.date);
    const quantityOfMonths = differenceInMonths(startOfMonth(dateFromParams), startOfMonth(currentDate));
    const { startDate, endDate } = getFullMonthInterval(dateSubtractOneMonth);
    const INCOME_TYPE_ID = 4;
    const EXPENSE_TYPE_ID = 6;

    const { data: recordsFinancial, error } = await this.supabase.from('financial_records')
      .select(`
        *,
        categories (name, income_expense_type_id, record_type_id)
        
        `)
      .eq('is_deleted', false)
      .eq('condominium_id', data.condominiumId)
      .eq('is_recurring', true)
      .gte('due_date', startDate)
      .lte('due_date', endDate)

    if (error) {
      throw new Error(error.message)
    }

    const { accumulatedBalance } = await this.getRevenueTotal({
      condominiumId: data.condominiumId,
      startDate,
      endDate
    })
    const finalRecordFormmated: any[] = [];


    recordsFinancial.forEach(financialRecord => {

      let currentObjectCreate = {};

      const keys = Object.keys(financialRecord);

      for (const key of keys) {
        const currentValue = financialRecord[key];

        if (typeof currentValue === 'object' && currentValue) {
          const keysOfCurrentValue = Object.keys(currentValue);
          for (const currentKey of keysOfCurrentValue) {
            currentObjectCreate[currentKey] = currentValue[currentKey]
          }
          break;
        }
        currentObjectCreate[key] = currentValue
      }

      finalRecordFormmated.push(currentObjectCreate)
    })

    const recordsCamelcase = camelcaseKeys(finalRecordFormmated);

    let incomesTotal = 0
    let expensesTotal = 0
    let balance = 0

    recordsCamelcase.forEach(record => {
      if (record.incomeExpenseTypeId === INCOME_TYPE_ID) {
        incomesTotal += record.amount;
        balance += record.amount;
      }
      if (record.incomeExpenseTypeId === EXPENSE_TYPE_ID) {
        expensesTotal += record.amount;
        balance -= record.amount
      }
    })

    let balanceAccumulated = balance + accumulatedBalance;

    return {
      incomesTotal,
      expensesTotal,
      balance,
      balanceAccumulated
    }

  }

  async getProjectionRegisters(data: GetProjectionParams) {
    const currentDate = new Date()
    const dateSubtractOneMonth = format(currentDate, "yyyy-MM-dd");
    const { startDate, endDate } = getFullMonthInterval(dateSubtractOneMonth);
    const INCOME_TYPE_ID = 4;

    const { data: recordsFinancial, error } = await this.supabase.from('financial_records')
      .select(`
        *,
        categories (id, name, income_expense_type_id, record_type_id)
        
        `)
      .eq('is_deleted', false)
      .eq('condominium_id', data.condominiumId)
      .eq('is_recurring', true)
      .gte('due_date', startDate)
      .lte('due_date', endDate)

    if (error) {
      throw new Error(error.message)
    }

    const result: {
      id: number;
      name: string;
      total: number;
      type: string;
      observation: string
    }[] = [];

    recordsFinancial.forEach((record) => {
      const category = result.find(category => category.id === record.categories.id);

      if (!category) {
        const typeIncomeExpense = record.categories.income_expense_type_id === INCOME_TYPE_ID ? 'Receita' : 'Despesa'
        return result.push({
          id: record.categories.id,
          name: record.categories.name,
          total: record.amount,
          type: typeIncomeExpense,
          observation: record.observation,
        })
      }

      category.total += record.amount
    });

    return result
  }


  async createDelinquency(condominiumId: string, data: CreateDeliquencyBodyDTO) {
    const { error } = await this.supabase.from('delinquency_records').insert([
      {
        condominium_id: condominiumId,
        apartament_id: data.apartamentId,
        category_id: data.categoryId,
        due_date: data.dueDate,
        amount: Number(data.amount),
        amount_paid: Number(data.amountPaid),
        payment_date: data.paymentDate
      }
    ])

    if (error) {
      throw new Error(error.message)
    }
  }

  async getDelinquencyRegister(data: GetDelinquencyParamsDTO) {
    const { startDate, endDate } = getFullMonthInterval(data.date);
    const { data: delinquencyRecords, error } = await this.supabase.from('delinquency_records')
      .select(`
        *,
        categories (name)
        `)
      .eq('condominium_id', data.condominiumId)
      .gte('due_date', startDate)
      .lte('due_date', endDate)
      .order('due_date', { ascending: false })
    if (error) {
      throw new Error(error.message)
    }

    const deliquencyRecordsWithDaysLate = delinquencyRecords.map(delinquecy => {
      const paymentDate = delinquecy.payment_date ? new Date(delinquecy.payment_date) : new Date();

      const daysLate = differenceInDays(paymentDate, delinquecy.due_date);

      return {
        ...delinquecy,
        categoryName: delinquecy?.categories?.name,
        daysLate,
      }
    })

    return camelcaseKeys(deliquencyRecordsWithDaysLate)
  }

  async deleteDelinquency(delinquencyId: string) {

    const { data: financialRecords, error: financialRecordsError } = await this.supabase
      .from('financial_records')
      .select('*')
      .eq('delinquency_record_id', delinquencyId)

    const finalcialRecord = financialRecords?.[0];

    if (finalcialRecord) {
      await this.supabase.from('financial_records').delete().eq('id', delinquencyId)
    }
    await this.supabase.from('delinquency_records').delete().eq('id', delinquencyId)
  }

  async updateDelinquency(delinquencyId: string, data: PatchDelinquencyBodyDTO) {
    const { data: delinquency, error: delinquencyError } =
      await this.supabase
        .from('delinquency_records')
        .select("*")
        .eq('id', delinquencyId)
        .single()

    if (delinquencyError) {
      throw new Error(delinquencyError.message)
    }

    const { data: financialRecords, error: financialRecordsError } = await this.supabase
      .from('financial_records')
      .select('*')
      .eq('delinquency_record_id', delinquency.id)
      .eq("is_deleted", false)

    if (financialRecordsError) {
      throw new Error(financialRecordsError.message)
    }
    const finalcialRecord = financialRecords[0];

    const hasFinancialRecord = !!finalcialRecord;

    let financialRecordId = finalcialRecord?.id;


    if (!hasFinancialRecord && data?.paymentDate) {
      const { data: financialRecordInsert } = await this.supabase
        .from("financial_records")
        .insert(
          {
            condominium_id: delinquency.condominium_id,
            category_id: data.categoryId,
            due_date: data.dueDate,
            amount_paid: Number(data.amountPaid),
            apartament_id: data.apartamentId,
            status: 2,
            payment_method_id: 2,
            amount: Number(data.amount),
            is_recurring: false,
            notes: undefined,
            delinquency_record_id: delinquencyId
          },
        ).select();

      financialRecordId = financialRecordInsert?.[0].id
    }

    if (hasFinancialRecord && !data?.paymentDate) {
      await this.supabase.from('financial_records').delete().eq("id", financialRecordId)
    }

    if (hasFinancialRecord && data?.paymentDate) {
      await this.supabase.from('financial_records').update({
        payment_date: data.paymentDate,
        due_date: data.dueDate,
        amount: Number(data.amount),
        amount_paid: Number(data.amountPaid),
        category_id: data.categoryId
      })
        .eq("id", financialRecordId)
    }

    await this.supabase.from('delinquency_records').update({
      amount: Number(data.amount),
      amount_paid: Number(data.amountPaid),
      category_id: data.categoryId,
      payment_date: data.paymentDate,
      due_date: data.dueDate,
      updated_at: new Date()
    })
      .eq("id", delinquencyId)

  }

  async getDelinquencyResume({
    startDate,
    endDate,
    token
  }: {
    startDate: string,
    endDate: string,
    token: string
  }) {
    const { userId } = await this.authService.decodeToken(token);
    const { condominiumId } = await this.authService.me(userId);

    const { data: delinquencyRecords, error } = await this.supabase
      .from('delinquency_records')
      .select("*")
      .eq('condominium_id', condominiumId)
      .gte('due_date', startDate)
      .lte('due_date', endDate)

    const { data: apartaments, error: apartamentsError } = await this.supabase
      .from('apartment')
      .select('id')
      .eq('condominium_id', condominiumId);


    if (error) {
      throw new Error(error.message)
    }

    const apartamentsTotal = apartaments?.length ?? 0;

    const records = camelcaseKeys(delinquencyRecords);

    const summary = {
      uniqueApartmentIds: new Set<number>(),
      totalInstallments: 0,
      unpaidCount: 0,
      averageDaysOverdue: 0,
      totalAmountToReceive: 0,
      totalDaysOverdue: 0,
      uniqueApartamentsLength: 0,
      delinquencyPercentage: ''
    };

    records.forEach((record) => {
      const { paymentDate, dueDate, apartamentId, amount } = record;

      const isPaid = Boolean(paymentDate);

      const due = parseISO(dueDate);
      const end = isPaid ? parseISO(paymentDate!) : new Date();
      const daysOverdue = differenceInDays(end, due);


      summary.totalDaysOverdue += daysOverdue;
      summary.totalInstallments += 1;

      if (!isPaid) {
        summary.unpaidCount += 1;
        summary.totalAmountToReceive += amount;
      }
      summary.uniqueApartmentIds.add(apartamentId);
    });
    summary.averageDaysOverdue = summary.totalDaysOverdue > 0 && summary.totalInstallments > 0 ?
      Math.floor(summary.totalDaysOverdue / summary.totalInstallments) : 0

    summary.uniqueApartamentsLength = summary.uniqueApartmentIds.size;
    summary.delinquencyPercentage = ((summary.uniqueApartamentsLength / apartamentsTotal) * 100).toFixed(2);

    return summary;
  }

  async getChartDistruibitionByType({
    startDate,
    endDate,
    token
  }: {
    startDate: string,
    endDate: string,
    token: string
  }) {
    const { userId } = await this.authService.decodeToken(token);
    const { condominiumId } = await this.authService.me(userId);

    const { data: delinquencyRecords, error } = await this.supabase
      .from('delinquency_records')
      .select(`*, categories (*)`)
      .eq('condominium_id', condominiumId)
      .gte('due_date', startDate)
      .lte('due_date', endDate)

    if (error) {
      throw new Error(error.message)
    }

    const records = camelcaseKeys(delinquencyRecords.map(delinquency => flattenObject(delinquency)));

    const result: {
      categoryId: number;
      categoryName: string;
      categoryCount: number;
      categoryPercentage: number;
      categoryAmount: number;
    }[] = [];

    const totalAmountRecords = records.reduce((acc, current: any) => acc += current.amount, 0);

    records.forEach((record: any) => {
      const indexCategoryInResult = result.findIndex(item => item.categoryId === record.categoriesId);
      if (indexCategoryInResult === -1) {
        return result.push({
          categoryId: record.categoriesId,
          categoryName: record.categoriesName,
          categoryPercentage: (record.amount / totalAmountRecords) * 100,
          categoryCount: 1,
          categoryAmount: record.amount
        })


      }
      const currentItem = result[indexCategoryInResult];
      currentItem.categoryAmount += record.amount
      currentItem.categoryCount += 1;
      currentItem.categoryPercentage = (currentItem.categoryAmount / totalAmountRecords) * 100;

    })

    return result;
  }

  async getDelinquencyRecords(token: string, date: string) {

    const yearFormatted = format(date, 'yyyy')

    const { userId } = await this.authService.decodeToken(token);
    const { condominiumId } = await this.authService.me(userId);

    const { data, error } = await this.supabase
      .rpc('get_monthly_delinquency', { condo_id: condominiumId, year_input: yearFormatted });

    if (error) {
      throw new Error(error.message)
    }

    return camelcaseKeys(data);

  }
}
