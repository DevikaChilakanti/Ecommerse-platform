import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { CatalogueService } from "./catalogue.service";
import {
  CreateProductDto,
  UpdateProductDto,
} from "./dto/product.dto";
import {
  CreateProductImageDto,
  UpdateProductImageDto,
} from "./dto/product-image.dto";

@Controller("admin/products")
@UseGuards(AuthGuard, RolesGuard)
@Roles("ADMIN")
export class AdminProductsController {
  constructor(private readonly catalogue: CatalogueService) {}

  @Post()
  create(@Body() input: CreateProductDto) {
    return this.catalogue.createProduct(input);
  }

  @Patch(":id")
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: UpdateProductDto,
  ) {
    return this.catalogue.updateProduct(id, input);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async deactivate(@Param("id", ParseUUIDPipe) id: string): Promise<void> {
    await this.catalogue.deactivateProduct(id);
  }

  @Post(":id/images")
  addImage(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: CreateProductImageDto,
  ) {
    return this.catalogue.addProductImage(id, input);
  }

  @Patch(":id/images/:imageId")
  updateImage(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("imageId", ParseUUIDPipe) imageId: string,
    @Body() input: UpdateProductImageDto,
  ) {
    return this.catalogue.updateProductImage(id, imageId, input);
  }

  @Delete(":id/images/:imageId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteImage(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("imageId", ParseUUIDPipe) imageId: string,
  ): Promise<void> {
    await this.catalogue.deleteProductImage(id, imageId);
  }
}
