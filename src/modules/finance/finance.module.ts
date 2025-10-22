import { Module } from "@nestjs/common";
import { FinanceController } from "./finance.controller";
import { FinanceService } from "./finance.service";
import { FinanceRepository } from "./finance.repository";
import { DatabaseService } from "src/config/database/database.service";
import { PostgresService } from "src/config/database/postgres/postgres.service";


@Module({
  controllers: [FinanceController],
  providers: [FinanceService, FinanceRepository]
})
export class FinanceModule {

}