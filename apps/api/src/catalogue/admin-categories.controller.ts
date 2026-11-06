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
import { CreateCategoryDto, UpdateCategoryDto } from "./dto/category.dto";

@Controller("admin/categories")
@UseGuards(AuthGuard, RolesGuard)
@Roles("ADMIN")
export class AdminCategoriesController {
  constructor(private readonly catalogue: CatalogueService) {}

  @Post()
  create(@Body() input: CreateCategoryDto) {
    return this.catalogue.createCategory(input);
  }

  @Patch(":id")
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: UpdateCategoryDto,
  ) {
    return this.catalogue.updateCategory(id, input);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async deactivate(@Param("id", ParseUUIDPipe) id: string): Promise<void> {
    await this.catalogue.deactivateCategory(id);
  }
}
