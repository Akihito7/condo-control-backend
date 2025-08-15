import { Inject, Injectable } from "@nestjs/common";
import { SUPABASE_CLIENT } from "../supabase/supabase.module";
import { SupabaseClient } from "@supabase/supabase-js";
import camelcaseKeys from "camelcase-keys";
import { BodyTransaction, CreateDeliquencyBodyDTO, FinanceInfoByCondominium, GetDelinquencyParamsDTO, GetProjectionParams, GetRegistersByCondominiumId, PatchDelinquencyBodyDTO, UpdateCondominiumExpensesBody, UpdateCondominiumIncomesBody } from "./types/dto/finance.dto";
import { startOfMonth, subMonths, format, differenceInMonths, isThisISOWeek, differenceInDays } from "date-fns"
import { parseCurrencyBRL } from "src/utils/parse-currency-brl";
import { getFullMonthInterval } from "src/utils/get-full-month-interval";
import { FinanceResponseData } from "./types/response/finance.response";


@Injectable()
export class FinanceService {
  constructor(@Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient) { }

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

  async getFinancialRecordsByCondominiumId({ condominiumId, startDate, endDate, incomeExpenseOptions }: any) {
    const { data: categories } = await this.supabase
      .from('categories')
      .select('id')
      .in('income_expense_type_id', incomeExpenseOptions);
    const categoryIds = categories?.map(c => c.id) ?? [];
    const { data, error } = await this.supabase
      .from('financial_records')
      .select(`
      *, 
      apartment (id, apartment_number),
      payment_status (id,name),
      payment_methods (id,name),
      categories (
       id,
        name,  
        record_type_id,
        income_expense_type_id, 
        income_expense_types (name)
      )
    `)
      .eq('is_deleted', false)
      .eq('condominium_id', condominiumId)
      .gte('due_date', startDate)
      .lte('due_date', endDate)
      .in('category_id', categoryIds)
      .order('amount', { ascending: false });

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
    const amountParsedBrl = parseCurrencyBRL(String(data.amount))
    const amountPaidParsedBrl = parseCurrencyBRL(String(data.amountPaid))

    const { error } = await this.supabase.from("financial_records").insert([
      {
        condominium_id: data.condominiumId,
        category_id: data.categoryId,
        due_date: data.dueDate,
        amount_paid: amountPaidParsedBrl,
        apartament_id: data.apartmentId === -1 ? null : data.apartmentId,
        status: data.paymentStatusId,
        payment_method_id: data.paymentMethodId,
        observation: data.notes,
        amount: amountParsedBrl,
        is_recurring: data.recurring,
        notes: data.notes,
        payment_date : data.paymentDate,
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
  }: GetRegistersByCondominiumId) {
    const [year, monthStartDate] = String(startDate).split('-');
    const [, monthEndDate] = String(endDate).split('-');
    const startDateFormatted = `${year}-${monthStartDate}-01`
    const isSameMonth = monthStartDate === monthEndDate;

    const { data: incomes } = await this.supabase
      .from('condominium_finances')
      .select("*")
      .eq("condominium_id", condominiumId)
      .gte('reference_month', startDateFormatted)
      .lte('reference_month', endDate)

    const totalIncomeFromCondiminiumFinances = incomes?.[0]?.income ?? 0
    const incomeTarget = incomes?.[0]?.income_target ?? undefined

    if (totalIncomeFromCondiminiumFinances) {
      return {
        totalIncome: totalIncomeFromCondiminiumFinances,
        incomeTarget: isSameMonth ? incomeTarget : undefined
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
      .gte('due_date', startDate)
      .lte('due_date', endDate);

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
    }
  }

  async getExpensesTotal({
    condominiumId,
    startDate,
    endDate
  }: GetRegistersByCondominiumId) {
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
      .gte('due_date', startDate)
      .lte('due_date', endDate);

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
  }: GetRegistersByCondominiumId) {
    const [, monthStartDate] = String(startDate).split('-');
    const [, monthEndDate] = String(endDate).split('-');
    const isSameMonth = monthStartDate === monthEndDate;
    const { totalIncome, incomeTarget } = await this.getRevenueTotal({ condominiumId, startDate, endDate });
    const { totalExpenses, expensesTarget } = await this.getExpensesTotal({ condominiumId, startDate, endDate });
    const balance = totalIncome - totalExpenses
    return {
      totalIncome,
      incomeTarget,
      totalExpenses,
      expensesTarget,
      balance,
      isSameMonth
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
    const amountParsedBrl = parseCurrencyBRL(transaction.amount)
    const amountPaidParsedBrl = parseCurrencyBRL(transaction.amountPaid)
    const { error } = await this.supabase.from("financial_records").update([
      {
        condominium_id: transaction.condominiumId,
        category_id: transaction.categoryId,
        due_date: transaction.dueDate,
        amount_paid: amountPaidParsedBrl,
        apartament_id: transaction.apartmentId,
        status: transaction.paymentStatusId,
        payment_method_id: transaction.paymentMethodId,
        observation: transaction.notes,
        amount: amountParsedBrl,
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

    const incomeParseBRL = parseCurrencyBRL(data.income);
    const targetIncomeParseBRL = parseCurrencyBRL(data.targetIncome);

    const { data: condiminiumFinances } = await this.supabase
      .from('condominium_finances')
      .select('*')
      .eq('condominium_id', condominiumId)
      .gte('reference_month', startDate)
      .lte('reference_month', endDate);


    if (condiminiumFinances?.length === 0) {
      const { error: createError } = await this.supabase.from('condominium_finances').insert({
        condominium_id: condominiumId,
        income: incomeParseBRL,
        income_target: targetIncomeParseBRL,
        reference_month: startDate,
      })

      if (createError) {
        throw new Error(createError.message)
      }

      return;
    }

    const condominiumFinanceId = condiminiumFinances?.[0]?.id;

    const { error: updateError } = await this.supabase.from('condominium_finances').update({
      income: incomeParseBRL,
      income_target: targetIncomeParseBRL
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

    const expenseParseBRL = parseCurrencyBRL(data.expenses);
    const targetExpenseParseBRL = parseCurrencyBRL(data.targetExpenses);

    const { data: condiminiumFinances } = await this.supabase
      .from('condominium_finances')
      .select('*')
      .eq('condominium_id', condominiumId)
      .gte('reference_month', startDate)
      .lte('reference_month', endDate);


    if (condiminiumFinances?.length === 0) {
      const { error: createError } = await this.supabase.from('condominium_finances').insert({
        condominium_id: condominiumId,
        expenseParseBRL: expenseParseBRL,
        expenses_target: targetExpenseParseBRL,
        reference_month: startDate,
      })

      if (createError) {
        throw new Error(createError.message)
      }
    }
    const condominiumFinanceId = condiminiumFinances?.[0]?.id;

    const { error: updateError } = await this.supabase.from('condominium_finances').update({
      expenses: expenseParseBRL,
      expenses_target: targetExpenseParseBRL
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

    let balanceAccumulated = quantityOfMonths > 0 ? balance * quantityOfMonths : balance * 1;

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
      total: number
      type: string
    }[] = [];

    recordsFinancial.forEach((record) => {
      const category = result.find(category => category.id === record.categories.id);

      if (!category) {
        const typeIncomeExpense = record.categories.income_expense_type_id === INCOME_TYPE_ID ? 'Receita' : 'Despesa'
        return result.push({
          id: record.categories.id,
          name: record.categories.name,
          total: record.amount,
          type: typeIncomeExpense
        })
      }

      category.total += record.amount
    });

    return result
  }


  async createDelinquency(condominiumId: string, data: CreateDeliquencyBodyDTO) {
    const amountParsedBrl = parseCurrencyBRL(data.amount)
    const amountPaidParsedBrl = parseCurrencyBRL(data.amountPaid)
    const { error } = await this.supabase.from('delinquency_records').insert([
      {
        condominium_id: condominiumId,
        apartament_id: data.apartamentId,
        category_id: data.categoryId,
        due_date: data.dueDate,
        amount: amountParsedBrl,
        amount_paid: amountPaidParsedBrl,
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

    const amountParsedBrl = parseCurrencyBRL(data.amount);
    const amountPaidParsedBrl = parseCurrencyBRL(data.amountPaid);

    if (!hasFinancialRecord && data?.paymentDate) {
      const { data: financialRecordInsert } = await this.supabase
        .from("financial_records")
        .insert(
          {
            condominium_id: delinquency.condominium_id,
            category_id: data.categoryId,
            due_date: data.dueDate,
            amount_paid: amountPaidParsedBrl,
            apartament_id: data.apartamentId,
            status: 2,
            payment_method_id: 2,
            amount: amountParsedBrl,
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
        amount: amountParsedBrl,
        amount_paid: amountPaidParsedBrl,
        category_id: data.categoryId
      })
        .eq("id", financialRecordId)
    }

    await this.supabase.from('delinquency_records').update({
      amount: amountParsedBrl,
      amount_paid: amountPaidParsedBrl,
      category_id: data.categoryId,
      payment_date: data.paymentDate,
      due_date: data.dueDate,
      updated_at: new Date()
    })
      .eq("id", delinquencyId)

  }
}
