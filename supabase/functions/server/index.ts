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

// Health check
app.get(`${PREFIX}/health`, (c) => {
  return c.json({ status: "ok" });
});

// GET all data at once
app.get(`${PREFIX}/data`, async (c) => {
  try {
    // Use individual gets to avoid mget ordering bug
    // (mget returns rows in DB order, not key order)
    const results = await Promise.all(
      COLLECTIONS.map((col) => kv.get(kvKey(col)))
    );
    const result: Record<string, any> = {};
    COLLECTIONS.forEach((col, i) => {
      result[col] = results[i] ?? null;
    });
    console.log(`[GET /data] Loaded ${COLLECTIONS.length} collections. Non-null: ${Object.values(result).filter(v => v !== null).length}`);
    return c.json({ data: result });
  } catch (err: any) {
    console.log(`[GET /data] Error loading data: ${err.message}`);
    return c.json({ error: `Failed to load data: ${err.message}` }, 500);
  }
});

// GET a single collection (debug)
app.get(`${PREFIX}/data/:collection`, async (c) => {
  const collection = c.req.param("collection");
  if (!COLLECTIONS.includes(collection as any)) {
    return c.json({ error: `Invalid collection: ${collection}` }, 400);
  }
  try {
    const value = await kv.get(kvKey(collection));
    console.log(`[GET /data/${collection}] Raw value type: ${typeof value}, isArray: ${Array.isArray(value)}`);
    return c.json({ collection, value: value ?? null });
  } catch (err: any) {
    console.log(`[GET /data/${collection}] Error: ${err.message}`);
    return c.json({ error: err.message }, 500);
  }
});

// PUT a single collection
app.put(`${PREFIX}/data/:collection`, async (c) => {
  const collection = c.req.param("collection");
  if (!COLLECTIONS.includes(collection as any)) {
    return c.json({ error: `Invalid collection: ${collection}. Valid: ${COLLECTIONS.join(", ")}` }, 400);
  }
  try {
    const body = await c.req.json();
    const value = body.value;
    if (value === undefined) {
      return c.json({ error: "Missing 'value' in request body" }, 400);
    }
    await kv.set(kvKey(collection), value);
    console.log(`[PUT /data/${collection}] Saved successfully. Items: ${Array.isArray(value) ? value.length : "object"}`);
    return c.json({ ok: true });
  } catch (err: any) {
    console.log(`[PUT /data/${collection}] Error saving: ${err.message}`);
    return c.json({ error: `Failed to save ${collection}: ${err.message}` }, 500);
  }
});

// POST seed — initialize all collections with provided data (only if empty)
app.post(`${PREFIX}/seed`, async (c) => {
  try {
    const body = await c.req.json();
    // Use individual gets to avoid mget ordering bug
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
      // mset is safe — it writes key+value pairs, ordering doesn't matter
      await kv.mset(toSetKeys, toSetValues);
      console.log(`[POST /seed] Seeded ${toSetKeys.length} collections: ${toSetKeys.map(k => k.replace("ks:", "")).join(", ")}`);
    } else {
      console.log(`[POST /seed] All collections already exist, skipping seed`);
    }

    return c.json({ ok: true, seeded: toSetKeys.map(k => k.replace("ks:", "")) });
  } catch (err: any) {
    console.log(`[POST /seed] Error seeding: ${err.message}`);
    return c.json({ error: `Failed to seed data: ${err.message}` }, 500);
  }
});

// DELETE reset — clear all data (for debugging/reset)
app.delete(`${PREFIX}/data`, async (c) => {
  try {
    const keys = COLLECTIONS.map(kvKey);
    await kv.mdel(keys);
    console.log(`[DELETE /data] Cleared all collections`);
    return c.json({ ok: true });
  } catch (err: any) {
    console.log(`[DELETE /data] Error: ${err.message}`);
    return c.json({ error: `Failed to reset data: ${err.message}` }, 500);
  }
});

Deno.serve(app.fetch);
