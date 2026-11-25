import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AuthGuard } from "../auth/auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { AddressesController } from "./addresses.controller";
import { AddressesService } from "./addresses.service";

@Module({
  imports: [AuthModule],
  controllers: [AddressesController],
  providers: [AuthGuard, RolesGuard, AddressesService],
})
export class AddressesModule {}
