import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.tsx";

const app = new Hono();

app.use("*", logger(console.log));

app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

const PREFIX = "/make-server-66b280dd";
const COLLECTIONS = ["clients", "prospects", "tasks", "revenue", "expenses", "closedMonths"] as const;

function kvKey(collection: string) {
  return `ks:${collection}`;
}

app.get(`${PREFIX}/health`, (c) => c.json({ status: "ok" }));

// GET all data — uses individual kv.get() to avoid mget ordering bug
app.get(`${PREFIX}/data`, async (c) => {
  try {
    const results = await Promise.all(
      COLLECTIONS.map((col) => kv.get(kvKey(col)))
    );
    const result: Record<string, any> = {};
    COLLECTIONS.forEach((col, i) => {
      result[col] = results[i] ?? null;
    });
    console.log(`[GET /data] Loaded ${COLLECTIONS.length} collections`);
    return c.json({ data: result });
  } catch (err: any) {
    console.log(`[GET /data] Error: ${err.message}`);
    return c.json({ error: `Failed to load data: ${err.message}` }, 500);
  }
});

// GET single collection (debug)
app.get(`${PREFIX}/data/:collection`, async (c) => {
  const collection = c.req.param("collection");
  if (!COLLECTIONS.includes(collection as any)) {
    return c.json({ error: `Invalid collection: ${collection}` }, 400);
  }
  try {
    const value = await kv.get(kvKey(collection));
    return c.json({ collection, value: value ?? null });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// PUT a single collection
app.put(`${PREFIX}/data/:collection`, async (c) => {
  const collection = c.req.param("collection");
  if (!COLLECTIONS.includes(collection as any)) {
    return c.json({ error: `Invalid collection: ${collection}` }, 400);
  }
  try {
    const body = await c.req.json();
    const value = body.value;
    if (value === undefined) {
      return c.json({ error: "Missing 'value' in request body" }, 400);
    }
    await kv.set(kvKey(collection), value);
    console.log(`[PUT /data/${collection}] Saved. Items: ${Array.isArray(value) ? value.length : "object"}`);
    return c.json({ ok: true });
  } catch (err: any) {
    return c.json({ error: `Failed to save ${collection}: ${err.message}` }, 500);
  }
});

// POST seed
app.post(`${PREFIX}/seed`, async (c) => {
  try {
    const body = await c.req.json();
    const existing = await Promise.all(
      COLLECTIONS.map((col) => kv.get(kvKey(col)))
    );
    const toSetKeys: string[] = [];
    const toSetValues: any[] = [];
    COLLECTIONS.forEach((col, i) => {
      if (existing[i] === null || existing[i] === undefined) {
        if (body[col] !== undefined) {
          toSetKeys.push(kvKey(col));
          toSetValues.push(body[col]);
        }
      }
    });
    if (toSetKeys.length > 0) {
      await kv.mset(toSetKeys, toSetValues);
    }
    return c.json({ ok: true, seeded: toSetKeys.map(k => k.replace("ks:", "")) });
  } catch (err: any) {
    return c.json({ error: `Failed to seed: ${err.message}` }, 500);
  }
});

// DELETE reset
app.delete(`${PREFIX}/data`, async (c) => {
  try {
    await kv.mdel(COLLECTIONS.map(kvKey));
    return c.json({ ok: true });
  } catch (err: any) {
    return c.json({ error: `Failed to reset: ${err.message}` }, 500);
  }
});

Deno.serve(app.fetch);
