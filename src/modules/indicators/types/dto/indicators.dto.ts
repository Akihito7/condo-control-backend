import { IsNotEmpty, IsString } from "class-validator";

export class ChartParams {
  @IsNotEmpty()
  @IsString()
  condominiumId: string;
  @IsNotEmpty()
  @IsString()
  startDate: string;
  @IsNotEmpty()
  @IsString()
  endDate: string;
}