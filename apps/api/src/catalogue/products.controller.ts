import { Controller, Get, Param, Query } from "@nestjs/common";
import { CatalogueService } from "./catalogue.service";
import { ListProductsQueryDto } from "./dto/list-query.dto";
import { SlugPipe } from "./slug.pipe";

@Controller("products")
export class ProductsController {
  constructor(private readonly catalogue: CatalogueService) {}

  @Get()
  list(@Query() query: ListProductsQueryDto) {
    return this.catalogue.listProducts(query);
  }

  @Get(":slug")
  getBySlug(@Param("slug", SlugPipe) slug: string) {
    return this.catalogue.getProductBySlug(slug);
  }
}
