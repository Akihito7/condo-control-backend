import { Module } from "@nestjs/common";
import { StructureController } from "./structure.controller";
import { AuthService } from "../auth/auth.service";
import { JwtService } from "@nestjs/jwt";
import { FinanceModule } from "../finance/finance.module";
import { FinanceService } from "../finance/finance.service";
import { StructureService } from "./structure.service";
import { FinanceRepository } from "../finance/finance.repository";

@Module({
  imports: [FinanceModule],
  controllers: [StructureController],
  providers: [StructureService, AuthService, JwtService, FinanceService, FinanceRepository]
})
export class StructureModule { }