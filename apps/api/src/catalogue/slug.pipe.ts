import { BadRequestException, PipeTransform } from "@nestjs/common";

function validateSlug(value: string, maxLength: number): string {
  if (value.length > maxLength || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
    throw new BadRequestException("Invalid slug.");
  }
  return value;
}

export class SlugPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    return validateSlug(value, 150);
  }
}

export class CategorySlugPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    return validateSlug(value, 100);
  }
}
