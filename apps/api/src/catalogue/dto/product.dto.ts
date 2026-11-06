import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from "class-validator";

const PRICE_PATTERN = /^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/;

export class CreateProductDto {
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Matches(/.*\S.*/)
  @MaxLength(200)
  name!: string;

  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  @MaxLength(150)
  slug!: string;

  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Matches(/.*\S.*/)
  @MaxLength(100)
  sku!: string;

  @IsString()
  @MaxLength(20_000)
  description!: string;

  @IsUUID()
  categoryId!: string;

  @Matches(PRICE_PATTERN)
  price!: string;

  @IsOptional()
  @Matches(PRICE_PATTERN)
  compareAtPrice?: string;

  @Matches(/^[A-Z]{3}$/)
  currencyCode!: string;
}

export class UpdateProductDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Matches(/.*\S.*/)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  @MaxLength(150)
  slug?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Matches(/.*\S.*/)
  @MaxLength(100)
  sku?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20_000)
  description?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @Matches(PRICE_PATTERN)
  price?: string;

  @IsOptional()
  @Matches(PRICE_PATTERN)
  compareAtPrice?: string | null;

  @IsOptional()
  @Matches(/^[A-Z]{3}$/)
  currencyCode?: string;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}
