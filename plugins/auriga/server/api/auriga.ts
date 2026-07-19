import Router from "koa-router";
import { InvalidRequestError, NotFoundError } from "@server/errors";
import auth from "@server/middlewares/authentication";
import validate from "@server/middlewares/validate";
import { Document } from "@server/models";
import { can } from "@server/policies";
import { presentDocument, presentPolicies } from "@server/presenters";
import type { APIContext } from "@server/types";
import env from "../env";
import * as T from "./schema";

const router = new Router();

// All routes proxy to Auriga's internal API over the private network. The
// browser never reaches Auriga directly, and nothing returned here bypasses
// Outline's own document permissions.

async function aurigaRequest(
  method: "GET" | "POST",
  path: string,
  body?: object
): Promise<{ status: number; json: Record<string, unknown> }> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (env.AURIGA_TOKEN) {
    headers["Authorization"] = `Bearer ${env.AURIGA_TOKEN}`;
  }
  const res = await fetch(`${env.AURIGA_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let json: Record<string, unknown> = {};
  try {
    json = (await res.json()) as Record<string, unknown>;
  } catch {
    // non-JSON error body
  }
  return { status: res.status, json };
}

// UI conditions → Auriga structured filter syntax
export function conditionsToFilters(
  conditions: T.PropertyCondition[]
): Array<Record<string, unknown>> {
  return conditions.map((c) => {
    switch (c.op) {
      case "is":
        return { field: c.field, value: c.value };
      case "not":
        return { field: c.field, value: c.value, not: true };
      case "any":
        return {
          field: c.field,
          any: Array.isArray(c.value) ? c.value : [c.value],
        };
      case "gt":
      case "gte":
      case "lt":
      case "lte":
        return { field: c.field, [c.op]: c.value };
      case "contains":
        return { field: c.field, text: c.value };
      case "is_empty":
        return { field: c.field, is_empty: true };
      case "is_null":
        return { field: c.field, is_null: true };
    }
  });
}

router.post("auriga.info", auth(), async (ctx: APIContext) => {
  const { status, json } = await aurigaRequest("GET", "/v0/metadata/indexes");
  if (status !== 200) {
    throw InvalidRequestError("Auriga is unavailable");
  }
  // {"metadata.department": "keyword", ...} → [{field: "department", type: "keyword"}]
  const indexes = (json.indexes ?? {}) as Record<string, string>;
  const fields = Object.entries(indexes).map(([key, type]) => ({
    field: key.replace(/^metadata\./, ""),
    type,
  }));
  ctx.body = { data: { fields } };
});

router.post(
  "auriga.search",
  auth(),
  validate(T.AurigaSearchSchema),
  async (ctx: APIContext<T.AurigaSearchReq>) => {
    const { query, properties = [], limit } = ctx.input.body;
    const { user } = ctx.state.auth;

    const { status, json } = await aurigaRequest("POST", "/v0/outline/search", {
      query: query?.trim() || undefined,
      filters: properties.length ? conditionsToFilters(properties) : undefined,
      limit,
    });
    if (status === 400) {
      throw InvalidRequestError(
        typeof json.detail === "string" ? json.detail : "Invalid search"
      );
    }
    if (status !== 200) {
      throw InvalidRequestError("Auriga search is unavailable");
    }

    const hits = (json.results ?? []) as Array<{
      outline_id: string;
      doc_id: string;
      title: string;
      score: number | null;
      context: string | null;
    }>;

    // Load Outline's own Document models (membership-scoped) and drop anything
    // this user cannot read — Auriga results never bypass permissions.
    const loaded = await Promise.all(
      hits.map(async (hit) => {
        const document = await Document.findByPk(hit.outline_id, {
          userId: user.id,
        });
        if (!document || !can(user, "read", document)) {
          return null;
        }
        return { hit, document };
      })
    );
    const readable = loaded.filter(
      (item): item is NonNullable<typeof item> => item !== null
    );

    const data = await Promise.all(
      readable.map(async ({ hit, document }) => ({
        id: document.id,
        ranking: hit.score ?? 1,
        context: hit.context ?? undefined,
        document: await presentDocument(ctx, document),
      }))
    );

    ctx.body = {
      pagination: { offset: 0, limit, total: data.length },
      data,
      policies: presentPolicies(
        user,
        readable.map(({ document }) => document)
      ),
    };
  }
);

router.post(
  "auriga.properties",
  auth(),
  validate(T.AurigaPropertiesSchema),
  async (ctx: APIContext<T.AurigaPropertiesReq>) => {
    const { id } = ctx.input.body;
    const { user } = ctx.state.auth;

    const document = await Document.findByPk(id, { userId: user.id });
    if (!document || !can(user, "read", document)) {
      throw NotFoundError();
    }

    const { status, json } = await aurigaRequest(
      "GET",
      `/v0/outline/properties?outline_id=${encodeURIComponent(id)}`
    );
    if (status === 404) {
      ctx.body = { data: { found: false, properties: {} } };
      return;
    }
    if (status !== 200) {
      throw InvalidRequestError("Auriga is unavailable");
    }

    ctx.body = {
      data: {
        found: true,
        docId: json.doc_id,
        updatedAt: json.updated_at,
        properties: (json.metadata ?? {}) as Record<string, unknown>,
      },
    };
  }
);

export default router;
