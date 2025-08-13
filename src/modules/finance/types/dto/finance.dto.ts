import { IsArray, IsBoolean, IsDate, isDate, IsDateString, isNotEmpty, IsNotEmpty, IsNumber, IsString, isString, Matches } from "class-validator";

export class FinanceInfoByCondominium {
  @IsNotEmpty()
  @IsNumber()
  condominiumId: number;

  @IsNotEmpty()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: 'O período deve estar no formato YYYY-MM, por exemplo: 2025-07',
  })
  startDate: string;

  @IsNotEmpty()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: 'O período deve estar no formato YYYY-MM, por exemplo: 2025-07',
  })
  endDate: string;
}

export class UpdateRevenueParams {

  @IsNotEmpty()
  @IsNumber()
  condominiumId: number;

  @IsNotEmpty()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: 'O período deve estar no formato YYYY-MM, por exemplo: 2025-07',
  })
  period: string;
}

export class UpdateRevenueBody {

  @IsNumber()
  revenue: number;
}

export class GetRegistersByCondominiumId {

  @IsNotEmpty()
  @IsNumber()
  condominiumId: number;

  @IsNotEmpty()
  @IsDateString()
  startDate: string


  @IsNotEmpty()
  @IsDateString()
  endDate: string
}

export class QueryGetRegistersByCondominiumId {
  @IsArray()
  'incomeExpenseOptionsSelectedId[]'?: string[];
}


export class BodyTransaction {

  @IsNotEmpty()
  @IsNumber()
  condominiumId: number
  @IsNotEmpty()
  @IsDate()
  dueDate: Date
  @IsDate()
  paymentDate: Date
  @IsNotEmpty()
  @IsNumber()
  recordTypeId: number
  @IsNotEmpty()
  @IsNumber()
  categoryId: number
  @IsNotEmpty()
  @IsNumber()
  apartmentId: number
  @IsNotEmpty()
  @IsNumber()
  paymentMethodId: number
  @IsNotEmpty()
  @IsNumber()
  paymentStatusId: number
  @IsString()
  notes: string | undefined
  @IsNotEmpty()
  @IsBoolean()
  recurring: boolean
  @IsNotEmpty()
  @IsNumber()
  type: number

  @IsNotEmpty()
  @IsString()
  amount: string;

  @IsString()
  amountPaid: string;
}

export class UpdateCondominiumIncomesBody {
  income: string | undefined
  targetIncome: string | undefined
}

export class UpdateCondominiumExpensesBody {
  @IsString()
  expenses: string | undefined
  @IsString()
  targetExpenses: string | undefined
}

export class GetProjectionParams {
  @IsNotEmpty()
  @IsString()
  condominiumId: string;

  @IsNotEmpty()
  @IsString()
  date: string
}

export class CreateDeliquencyBodyDTO {
  amount: string;
  apartamentId: string;
  categoryId: string;
  dueDate: Date;
  amountPaid?: Date;
  paymentDate?: string;
}

export class GetDelinquencyParamsDTO {
  @IsNotEmpty()
  @IsString()
  condominiumId: string;

  @IsNotEmpty()
  @IsDateString()
  date: string
}

export class PatchDelinquencyBodyDTO {
  apartamentId: string
  categoryId: string;
  dueDate: string;
  amount: string;
  amountPaid: string
  paymentDate: string;
}

