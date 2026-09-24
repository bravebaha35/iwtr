import { z, type ZodTypeAny } from "zod";

/**
 * Returns a copy of `schema` in which every object — at any depth, including
 * inside arrays, optionals, defaults and .transform()/.refine() wrappers —
 * rejects keys it doesn't declare, instead of zod's default of silently
 * dropping them. Used for endpoints where an unexpected field should be a
 * 400, not ignored (e.g. the anonymous review pipeline: extra fields there
 * are either a buggy client or someone probing).
 */
export function deepStrict<T extends ZodTypeAny>(schema: T): T {
  return strictify(schema) as T;
}

function strictify(schema: ZodTypeAny): ZodTypeAny {
  // Rebuilds the same zod class around a modified _def, so every other
  // setting on the node (min/max, messages, defaults, effects) is kept.
  const rebuild = (defPatch: Record<string, unknown>) => {
    const Ctor = schema.constructor as new (def: unknown) => ZodTypeAny;
    return new Ctor({ ...schema._def, ...defPatch });
  };

  if (schema instanceof z.ZodObject) {
    const shape = Object.fromEntries(
      Object.entries(schema.shape as Record<string, ZodTypeAny>).map(([key, value]) => [key, strictify(value)]),
    );
    return rebuild({ shape: () => shape, unknownKeys: "strict" });
  }
  if (schema instanceof z.ZodArray) return rebuild({ type: strictify(schema._def.type) });
  if (schema instanceof z.ZodEffects) return rebuild({ schema: strictify(schema._def.schema) });
  if (
    schema instanceof z.ZodOptional ||
    schema instanceof z.ZodNullable ||
    schema instanceof z.ZodDefault ||
    schema instanceof z.ZodCatch
  ) {
    return rebuild({ innerType: strictify(schema._def.innerType) });
  }
  if (schema instanceof z.ZodUnion || schema instanceof z.ZodDiscriminatedUnion) {
    const options = (schema._def.options as ZodTypeAny[]).map(strictify);
    return schema instanceof z.ZodDiscriminatedUnion
      ? z.discriminatedUnion(schema._def.discriminator, options as never)
      : rebuild({ options });
  }
  return schema;
}
