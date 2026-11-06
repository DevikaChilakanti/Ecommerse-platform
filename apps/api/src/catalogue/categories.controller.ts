import { Controller, Get, Param, Query } from "@nestjs/common";
import { CatalogueService } from "./catalogue.service";
import { ListQueryDto } from "./dto/list-query.dto";
import { CategorySlugPipe } from "./slug.pipe";

@Controller("categories")
export class CategoriesController {
  constructor(private readonly catalogue: CatalogueService) {}

  @Get()
  list(@Query() query: ListQueryDto) {
    return this.catalogue.listCategories(query);
  }

  @Get(":slug")
  getBySlug(@Param("slug", CategorySlugPipe) slug: string) {
    return this.catalogue.getCategoryBySlug(slug);
  }
}
