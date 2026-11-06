import { Transform, Type } from "class-transformer";
import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from "class-validator";

const PRICE_PATTERN = /^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/;

export class ListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}

export class ListProductsQueryDto extends ListQueryDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  @MaxLength(100)
  category?: string;

  @IsOptional()
  @Matches(PRICE_PATTERN)
  minPrice?: string;

  @IsOptional()
  @Matches(PRICE_PATTERN)
  maxPrice?: string;

  @IsOptional()
  @Matches(/^(price|name|newest)$/)
  sortBy: "price" | "name" | "newest" = "newest";

  @IsOptional()
  @Matches(/^(asc|desc)$/)
  sortOrder?: "asc" | "desc";
}
