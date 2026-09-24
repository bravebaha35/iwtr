import { BadRequestException, PipeTransform } from "@nestjs/common";
import type { ZodType, ZodTypeAny } from "zod";
import { deepStrict } from "./deep-strict";

export class ZodValidationPipe implements PipeTransform {
  private readonly schema: ZodType;

  /**
   * `strict: true` rejects any field the schema doesn't declare, at every
   * depth (see deep-strict.ts), instead of zod's default of silently
   * dropping it.
   */
  constructor(schema: ZodType, options: { strict?: boolean } = {}) {
    this.schema = options.strict ? deepStrict(schema as ZodTypeAny) : schema;
  }

  transform(value: unknown) {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException(result.error.flatten());
    }
    return result.data;
  }
}
