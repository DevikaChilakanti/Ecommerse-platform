import { IsUUID } from "class-validator";

export class PlaceOrderDto {
  @IsUUID()
  shippingAddressId!: string;
}
