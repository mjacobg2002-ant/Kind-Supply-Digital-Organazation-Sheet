// Supabase connection config
// In Figma Make: auto-provided. On Vercel: set VITE_SUPABASE_PROJECT_ID and VITE_SUPABASE_ANON_KEY env vars.
const FALLBACK_PROJECT_ID = "raexuafwzmvgnapwdjxk";
const FALLBACK_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJhZXh1YWZ3em12Z25hcHdkanhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMDU3NjQsImV4cCI6MjA4ODY4MTc2NH0.QZtR9tXrjxDW3lQs6FReYbGWntr3cHaP9MXm07kooXM";

const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || FALLBACK_PROJECT_ID;
const publicAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || FALLBACK_ANON_KEY;

const BASE = `https://${projectId}.supabase.co/functions/v1/server/make-server-66b280dd`;

const headers = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${publicAnonKey}`,
};

export interface AllData {
  clients: any[] | null;
  prospects: any[] | null;
  tasks: any[] | null;
  revenue: any[] | null;
  expenses: any[] | null;
  closedMonths: string[] | null;
}

export async function fetchAllData(): Promise<AllData> {
  const res = await fetch(`${BASE}/data`, { headers });
  if (!res.ok) {
    const err = await res.text();
    console.error("[api] fetchAllData error:", err);
    throw new Error(`Failed to load data: ${res.status}`);
  }
  const json = await res.json();
  return json.data;
}

export async function saveCollection(collection: string, value: any): Promise<void> {
  const isEmptyArray = Array.isArray(value) && value.length === 0;
  const res = await fetch(`${BASE}/data/${collection}`, {
    method: "PUT",
    headers,
    body: JSON.stringify({ value }),
    keepalive: isEmptyArray,
  });
  if (!res.ok) {
    const err = await res.text();
    console.error(`[api] saveCollection(${collection}) error:`, err);
    throw new Error(`Failed to save ${collection}: ${res.status}`);
  }
}

export async function seedData(data: Record<string, any>): Promise<string[]> {
  const res = await fetch(`${BASE}/seed`, {
    method: "POST",
    headers,
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error("[api] seedData error:", err);
    throw new Error(`Failed to seed: ${res.status}`);
  }
  const json = await res.json();
  return json.seeded;
}

export async function resetAllData(): Promise<void> {
  const res = await fetch(`${BASE}/data`, {
    method: "DELETE",
    headers,
  });
  if (!res.ok) {
    const err = await res.text();
    console.error("[api] resetAllData error:", err);
    throw new Error(`Failed to reset: ${res.status}`);
  }
}
