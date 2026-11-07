import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator";
import { AuthGuard } from "../auth/auth.guard";
import { UserProfile } from "../auth/auth.types";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { AddCartItemDto, UpdateCartItemDto } from "./dto/cart-item.dto";
import { CartService } from "./cart.service";

@Controller("cart")
@UseGuards(AuthGuard, RolesGuard)
@Roles("CUSTOMER")
export class CartController {
  constructor(private readonly cart: CartService) {}

  @Get()
  getCart(@CurrentUser() user: UserProfile) {
    return this.cart.getCart(user.id);
  }

  @Post("items")
  addItem(@CurrentUser() user: UserProfile, @Body() input: AddCartItemDto) {
    return this.cart.addItem(user.id, input);
  }

  @Patch("items/:itemId")
  updateItem(
    @CurrentUser() user: UserProfile,
    @Param("itemId", ParseUUIDPipe) itemId: string,
    @Body() input: UpdateCartItemDto,
  ) {
    return this.cart.updateItem(user.id, itemId, input);
  }

  @Delete("items/:itemId")
  removeItem(
    @CurrentUser() user: UserProfile,
    @Param("itemId", ParseUUIDPipe) itemId: string,
  ) {
    return this.cart.removeItem(user.id, itemId);
  }

  @Delete()
  clearCart(@CurrentUser() user: UserProfile) {
    return this.cart.clearCart(user.id);
  }
}
