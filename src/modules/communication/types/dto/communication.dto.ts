import { IsDateString, IsNotEmpty, IsNumber, IsString } from "class-validator";

export class ParamOpeningCalls {
  @IsNotEmpty()
  @IsString()
  condominiumId: string;
  @IsNotEmpty()
  @IsDateString()
  startDate: string;
  @IsNotEmpty()
  @IsDateString()
  endDate: string;
}

export class BodyOpeningCalls {
  @IsNotEmpty()
  @IsString()
  date: string;
  @IsNotEmpty()
  @IsNumber()
  issueTypeId: number;
  @IsNotEmpty()
  @IsString()
  description: string;
  @IsNotEmpty()
  @IsNumber()
  responsibleId: number;
  @IsNotEmpty()
  @IsNumber()
  statusId: number;
  @IsNotEmpty()
  @IsString()
  startedDate?: string;
  @IsNotEmpty()
  @IsString()
  resolvedDate?: string;
}

export class BodyCreateEvent {
 title: string;
  type: string;
  location: string;
  description: string;
  startTime: string;
  endTime: string;
  date: string;
}
