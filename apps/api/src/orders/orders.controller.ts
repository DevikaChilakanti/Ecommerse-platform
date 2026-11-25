import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import { UserProfile } from "../auth/auth.types";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { ListQueryDto } from "../catalogue/dto/list-query.dto";
import { OrdersService } from "./orders.service";
import { PlaceOrderDto } from "./dto/place-order.dto";

@Controller("orders")
@UseGuards(AuthGuard, RolesGuard)
@Roles("CUSTOMER")
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post()
  placeOrder(
    @CurrentUser() user: UserProfile,
    @Body() input: PlaceOrderDto,
  ) {
    return this.orders.placeOrder(user.id, input);
  }

  @Get()
  list(
    @CurrentUser() user: UserProfile,
    @Query() query: ListQueryDto,
  ) {
    return this.orders.list(user.id, query);
  }

  @Get(":id")
  getById(
    @CurrentUser() user: UserProfile,
    @Param("id", ParseUUIDPipe) orderId: string,
  ) {
    return this.orders.getById(user.id, orderId);
  }
}
