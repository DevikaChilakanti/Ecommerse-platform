import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AuthGuard } from "../auth/auth.guard";
import { CartModule } from "../cart/cart.module";
import { RolesGuard } from "../auth/roles.guard";
import { OrdersController } from "./orders.controller";
import { OrdersService } from "./orders.service";

@Module({
  imports: [AuthModule, CartModule],
  controllers: [OrdersController],
  providers: [AuthGuard, RolesGuard, OrdersService],
})
export class OrdersModule {}
