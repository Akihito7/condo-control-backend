export interface FinanceResponseData {
  id: number;
  condominium_id: number;
  period: string
  revenue: number
  expenses: number
  createdAt: Date
  updatedAt: Date
}


export type Category = {
  id: number;
  name: string;
  record_type_id: number;
  income_expense_type_id: number;
};

export type FinancialRecord = {
  id: number;
  condominium_id: number;
  category_id: number;
  amount: number;
  due_date: string;
  payment_date: string | null;
  amount_paid: number;
  is_recurring: boolean;
  notes: string;
  apartament_id: number;
  status: number;
  payment_method_id: number;
  observation: string;
  is_deleted: boolean;
  categories: Category;
};