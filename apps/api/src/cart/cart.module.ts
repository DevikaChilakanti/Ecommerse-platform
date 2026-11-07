import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AuthGuard } from "../auth/auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { CartController } from "./cart.controller";
import { CartService } from "./cart.service";

@Module({
  imports: [AuthModule],
  controllers: [CartController],
  providers: [AuthGuard, RolesGuard, CartService],
})
export class CartModule {}
