import { Type } from "class-transformer";
import { IsArray, IsNotEmpty, IsOptional, IsString, ValidateNested } from "class-validator";

export class CreateVisitBody {
  @IsString()
  @IsNotEmpty()
  condominiumId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => Person)
  people: Person[]


  @IsString()
  @IsNotEmpty()
  visitType: string;

  @IsString()
  @IsNotEmpty()
  apartamentNumber: string

  @IsString()
  @IsOptional()
  vehiclePlate: string;
}

class Person {
  @IsString()
  @IsNotEmpty()
  fullName: string;
  @IsString()
  @IsNotEmpty()
  cpf: string;
}

export class GetVisitorsParams {
  @IsString()
  @IsNotEmpty()
  startDate: string;
  @IsString()
  @IsNotEmpty()
  endDate: string;
  @IsString()
  @IsNotEmpty()
  condominiumId: string
}
