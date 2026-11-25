import { Transform } from "class-transformer";
import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";

function trimString(value: unknown): unknown {
  return typeof value === "string" ? value.trim() : value;
}

export class CreateAddressDto {
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(100)
  label?: string;

  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  recipientName!: string;

  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  phone!: string;

  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  line1!: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(300)
  line2?: string;

  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  city!: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(100)
  region?: string;

  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  postalCode!: string;

  @Transform(({ value }) =>
    typeof value === "string" ? value.trim().toUpperCase() : value,
  )
  @Matches(/^[A-Z]{2}$/)
  countryCode!: string;
}
