import {
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import { UserProfile } from "../auth/auth.types";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { AddressesService } from "./addresses.service";
import { CreateAddressDto } from "./dto/create-address.dto";

@Controller("addresses")
@UseGuards(AuthGuard, RolesGuard)
@Roles("CUSTOMER")
export class AddressesController {
  constructor(private readonly addresses: AddressesService) {}

  @Post()
  create(
    @CurrentUser() user: UserProfile,
    @Body() input: CreateAddressDto,
  ) {
    return this.addresses.create(user.id, input);
  }

  @Get()
  list(@CurrentUser() user: UserProfile) {
    return this.addresses.list(user.id);
  }
}
