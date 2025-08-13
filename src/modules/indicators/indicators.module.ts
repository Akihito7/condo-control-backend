import { Module } from "@nestjs/common";
import { IndicatorsController } from "./indicators.controller";
import { IndicatorsService } from "./indicators.service";

@Module({
  imports: [],
  controllers: [IndicatorsController],
  providers: [IndicatorsService]
})
export class IndicatorsModule { }