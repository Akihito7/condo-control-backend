import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

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
  responsibleName: string;
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

export class ResidentRequestBody {
  @IsInt()
  @IsNotEmpty()
  apartament_id: number;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsInt()
  @IsNotEmpty()
  status_id: number;

  @IsString()
  @IsOptional()
  observation?: string;

  @IsDateString()
  @IsNotEmpty()
  start_date: string;

  @IsDateString()
  @IsNotEmpty()
  end_date: string;

  @IsInt()
  @IsNotEmpty()
  gravity_id: number;
}

export class GetResidentRequestParams {
  startDate: string;
  endDate: string;
}
