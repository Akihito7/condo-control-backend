import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsNumber,
  IsDateString,
  MaxLength,
  IsBoolean,
  IsDate,
  MinLength,
} from 'class-validator';

export class CreateCondominiumDTO {
  @IsNotEmpty()
  @IsNumber()
  tenantId: number;

  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  neighborhood?: string;

  @IsNotEmpty()
  @IsString()
  city: string;

  @IsOptional()
  @IsString()
  @MaxLength(2)
  state?: string;

  @IsOptional()
  @IsString()
  @MaxLength(9)
  postalCode?: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;

  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  manager?: string;

  @IsOptional()
  @IsDateString()
  foundationDate?: string;

  @IsOptional()
  @IsNumber()
  numberOfBlocks?: number;

  @IsOptional()
  @IsNumber()
  numberOfUnits?: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  internalRegulations?: string;

  @IsOptional()
  @IsString()
  status?: string;
}



export class CreatePlanDTO {
  @IsString()
  name: string

  @IsNumber()
  price: number;

  @IsString()
  description: string;

  @IsBoolean()
  isCustom: boolean;
}

export class CreateTenantDTO {
  @IsString()
  name: string;

  @IsNumber()
  planId: number;

  @IsNumber()
  ownerId: number;

  @IsOptional()
  @IsDate()
  lastPaymentAt: Date;

  @IsBoolean()
  isActive: boolean;
}


export class CreateUserDTO {
  @IsOptional()
  @IsNumber()
  condominiumId: number;
  @IsOptional()
  @IsNumber()
  apartamentId: number;
  @IsOptional()
  @IsString()
  role: string;
  @IsString()
  name: string;
  @IsEmail()
  email: string;
  @IsBoolean()
  isSuper: boolean;
  @IsString()
  phone: number;
  @IsString()
  cpf: number;
  @MinLength(8)
  @IsString()
  password: string
  @IsString()
  documentNumber: string

}