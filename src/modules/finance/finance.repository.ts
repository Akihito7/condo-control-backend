import { Injectable } from "@nestjs/common";
import { DatabaseService } from "src/config/database/database.service";

@Injectable()
export class FinanceRepository {

  constructor(private readonly databaseClient: DatabaseService) { }

  async getFinancialRecordsByCondominiumId({ condominiumId, startDate, endDate, incomeExpenseOptions }: any) {
    const query = `
              SELECT
              fr.id,
              fr.condominium_id,
              fr.category_id,
              fr.amount,
              fr.due_date,
              fr.payment_date,
              fr.amount_paid,
              fr.is_recurring,
              fr.notes,
              fr.status,
              fr.payment_method_id,
              fr.observation,
              fr.is_deleted,
              fr.delinquency_record_id,
              fr.apartament_id,
              a.apartment_number,
              ps.name,
              pm.name,
              c.name,
              iet.name,
              COALESCE(fr.payment_date, fr.due_date) as effective_date,
              COALESCE(
                json_agg(
                  at.* ORDER BY at.id
                ) FILTER (WHERE at.id IS NOT NULL),
                '[]'
              ) AS attachments
            FROM financial_records fr
            LEFT JOIN apartment a ON a.id = fr.apartament_id
            LEFT JOIN payment_status ps ON ps.id = fr.status
            LEFT JOIN payment_methods pm ON pm.id = fr.payment_method_id
            LEFT JOIN categories c ON c.id = fr.category_id
            LEFT JOIN income_expense_types iet ON iet.id = c.income_expense_type_id
            LEFT JOIN attachments at ON at.related_id = fr.id AND at.screen_origin = 'finance'
            WHERE fr.is_deleted = false
              AND fr.condominium_id = $3
              AND COALESCE(fr.payment_date, fr.due_date) BETWEEN $1 AND $2
          GROUP BY fr.id, a.id, ps.id, pm.id, c.id, iet.id
          ORDER BY effective_date DESC;
    `
    const result = await this.databaseClient.query(query, [startDate, endDate, condominiumId]);
    return result;
  }
}