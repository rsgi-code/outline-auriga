import { z } from "zod";

// One property condition from the advanced-search UI. Maps 1:1 onto Auriga's
// structured filter syntax (see deploy/README.md in the Auriga repo).
export const PropertyConditionSchema = z.object({
  field: z.string().min(1).max(200),
  op: z.enum([
    "is",
    "not",
    "any",
    "gt",
    "gte",
    "lt",
    "lte",
    "contains",
    "is_empty",
    "is_null",
  ]),
  value: z
    .union([
      z.string(),
      z.number(),
      z.boolean(),
      z.array(z.union([z.string(), z.number()])),
    ])
    .optional(),
});

export type PropertyCondition = z.infer<typeof PropertyConditionSchema>;

export const AurigaSearchSchema = z.object({
  body: z
    .object({
      query: z.string().max(1000).optional(),
      properties: z.array(PropertyConditionSchema).max(20).optional(),
      limit: z.coerce.number().gt(0).lte(100).prefault(25),
    })
    .refine((b) => !!(b.query?.trim() || b.properties?.length), {
      message: "query or properties is required",
    }),
});

export type AurigaSearchReq = z.infer<typeof AurigaSearchSchema>;

export const AurigaPropertiesSchema = z.object({
  body: z.object({
    id: z.string().uuid(),
  }),
});

export type AurigaPropertiesReq = z.infer<typeof AurigaPropertiesSchema>;
