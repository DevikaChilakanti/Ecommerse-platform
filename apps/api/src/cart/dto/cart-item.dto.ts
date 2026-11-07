import { Type } from "class-transformer";
import {
  IsInt,
  IsUUID,
  Max,
  Min,
  ValidateIf,
} from "class-validator";

export class AddCartItemDto {
  @IsUUID()
  productId!: string;

  @ValidateIf((_object, value) => value !== undefined)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(99)
  quantity = 1;
}

export class UpdateCartItemDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(99)
  quantity!: number;
}
