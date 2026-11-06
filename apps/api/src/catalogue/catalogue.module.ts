import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AuthGuard } from "../auth/auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { AdminCategoriesController } from "./admin-categories.controller";
import { AdminProductsController } from "./admin-products.controller";
import { CatalogueService } from "./catalogue.service";
import { CategoriesController } from "./categories.controller";
import { ProductsController } from "./products.controller";

@Module({
  imports: [AuthModule],
  controllers: [
    CategoriesController,
    ProductsController,
    AdminCategoriesController,
    AdminProductsController,
  ],
  providers: [AuthGuard, RolesGuard, CatalogueService],
})
export class CatalogueModule {}
