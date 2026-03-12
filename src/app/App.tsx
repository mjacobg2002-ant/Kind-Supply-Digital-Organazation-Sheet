import { useState, useEffect, useRef, useCallback } from "react";
import { Building2, UserSearch, ListChecks, DollarSign, BookOpen, Loader2, RefreshCw, Cloud, CloudOff, CheckCircle2, RotateCcw } from "lucide-react";
import { Toaster, toast } from "sonner";
import { initialClients, initialProspects, initialTasks, initialRevenue, initialExpenses, initialClosedMonths } from "./data/mockData";
import type { Client, Prospect, Task, MonthlyRevenue, Expense } from "./data/mockData";
import { AuthGate, LogoutButton, useAuth } from "./components/AuthGate";
import { ClientsSheet } from "./components/ClientsSheet";
import { ProspectsSheet } from "./components/ProspectsSheet";
import { TasksSheet } from "./components/TasksSheet";
import { SOPSheet } from "./components/SOPSheet";
import { FinanceSheet } from "./components/FinanceSheet";
import { fetchAllData, saveCollection, seedData, resetAllData } from "./lib/api";

type Tab = "clients" | "prospects" | "tasks" | "finance" | "sops";

const tabs: { id: Tab; label: string; icon: typeof Building2 }[] = [
  { id: "clients", label: "Clients", icon: Building2 },
  { id: "prospects", label: "Prospects", icon: UserSearch },
  { id: "tasks", label: "Tasks", icon: ListChecks },
  { id: "finance", label: "Finance", icon: DollarSign },
  { id: "sops", label: "SOPs", icon: BookOpen },
];

// Debounce save helper
function useDebouncedSave(collection: string, data: any, ready: boolean, delay = 1200) {
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const isFirstRender = useRef(true);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!ready) return;
    // Skip the initial render (data load from server)
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    clearTimeout(timer.current);
    const isEmptyArray = Array.isArray(data) && data.length === 0;
    const saveDelay = isEmptyArray ? 0 : delay;
    timer.current = setTimeout(async () => {
      setSaving(true);
      setError(false);
      try {
        await saveCollection(collection, data);
        setLastSaved(new Date());
        console.log(`[autosave] ${collection} saved (${Array.isArray(data) ? data.length + " items" : "object"})${isEmptyArray ? " [immediate — empty array]" : ""}`);
      } catch (err) {
        console.error(`[autosave] Failed to save ${collection}:`, err);
        setError(true);
        toast.error(`Failed to save ${collection}. Changes may be lost.`);
      } finally {
        setSaving(false);
      }
    }, saveDelay);

    return () => clearTimeout(timer.current);
  }, [data, ready, collection, delay]);

  return { saving, lastSaved, error };
}

type SyncStatus = "loading" | "ready" | "error";

// Validate that loaded data isn't corrupt (empty objects/missing required fields)
// Empty arrays are valid (user deleted everything) — only catch structurally corrupt data
function isValidClients(data: any): data is Client[] {
  if (!Array.isArray(data)) return false;
  if (data.length === 0) return true;
  return data.every((c: any) => c && typeof c.name === "string" && c.name.trim().length > 0);
}
function isValidProspects(data: any): data is Prospect[] {
  if (!Array.isArray(data)) return false;
  if (data.length === 0) return true;
  return data.every((p: any) => p && typeof p.company === "string" && p.company.trim().length > 0);
}
function isValidTasks(data: any): data is Task[] {
  if (!Array.isArray(data)) return false;
  if (data.length === 0) return true;
  return data.every((t: any) => t && typeof t.title === "string" && t.title.trim().length > 0);
}

export default function App() {
  const { authenticated, login, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("clients");

  // Data state — starts empty, loaded from server
  const [clients, setClients] = useState<Client[]>([]);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [revenue, setRevenue] = useState<MonthlyRevenue[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [closedMonths, setClosedMonths] = useState<string[]>([]);

  // Sync status
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("loading");
  const [dataReady, setDataReady] = useState(false);

  // Load data from Supabase on mount
  useEffect(() => {
    if (!authenticated) return;

    let cancelled = false;
    async function load() {
      setSyncStatus("loading");
      try {
        // Fetch everything from server
        const data = await fetchAllData();

        if (cancelled) return;

        console.log("[init] Raw data from server:", {
          clients: data.clients === null ? "null" : `array(${Array.isArray(data.clients) ? data.clients.length : "??"})`,
          prospects: data.prospects === null ? "null" : `array(${Array.isArray(data.prospects) ? data.prospects.length : "??"})`,
          tasks: data.tasks === null ? "null" : `array(${Array.isArray(data.tasks) ? data.tasks.length : "??"})`,
          revenue: data.revenue === null ? "null" : `array(${Array.isArray(data.revenue) ? data.revenue.length : "??"})`,
          expenses: data.expenses === null ? "null" : `array(${Array.isArray(data.expenses) ? data.expenses.length : "??"})`,
          closedMonths: data.closedMonths === null ? "null" : `array(${Array.isArray(data.closedMonths) ? data.closedMonths.length : "??"})`,
        });

        // Check if this is a completely fresh install (ALL collections are null)
        const allNull = data.clients === null && data.prospects === null && data.tasks === null
          && data.revenue === null && data.expenses === null && data.closedMonths === null;

        if (allNull) {
          // First-time use — seed with initial data and save to server
          console.log("[init] All collections null — first-time setup, seeding defaults");
          await Promise.all([
            saveCollection("clients", initialClients),
            saveCollection("prospects", initialProspects),
            saveCollection("tasks", initialTasks),
            saveCollection("revenue", initialRevenue),
            saveCollection("expenses", initialExpenses),
            saveCollection("closedMonths", initialClosedMonths),
          ]);
          if (cancelled) return;
          setClients(initialClients);
          setProspects(initialProspects);
          setTasks(initialTasks);
          setRevenue(initialRevenue);
          setExpenses(initialExpenses);
          setClosedMonths(initialClosedMonths);
        } else {
          // Existing data — null means "user deleted everything" (empty), not "needs defaults"
          // Corrupt data → use empty array, NOT mock defaults (mock data causes phantom rows)
          const loadedClients = data.clients === null ? [] : isValidClients(data.clients) ? data.clients : [];
          const loadedProspects = data.prospects === null ? [] : isValidProspects(data.prospects) ? data.prospects : [];
          const loadedTasks = data.tasks === null ? [] : isValidTasks(data.tasks) ? data.tasks : [];
          const loadedRevenue = data.revenue === null ? [] : Array.isArray(data.revenue) ? data.revenue : [];
          const loadedExpenses = data.expenses === null ? [] : Array.isArray(data.expenses) ? data.expenses : [];
          const loadedClosedMonths = data.closedMonths === null ? [] : Array.isArray(data.closedMonths) ? data.closedMonths : [];

          // If any collection was corrupt (NOT null — null is fine), force-save clean empty arrays
          const corruptCollections: [string, any][] = [];
          if (data.clients !== null && !isValidClients(data.clients)) {
            console.warn("[init] Clients data was corrupt, clearing to empty. Raw:", data.clients);
            corruptCollections.push(["clients", []]);
          }
          if (data.prospects !== null && !isValidProspects(data.prospects)) {
            console.warn("[init] Prospects data was corrupt, clearing to empty. Raw:", data.prospects);
            corruptCollections.push(["prospects", []]);
          }
          if (data.tasks !== null && !isValidTasks(data.tasks)) {
            console.warn("[init] Tasks data was corrupt, clearing to empty. Raw:", data.tasks);
            corruptCollections.push(["tasks", []]);
          }
          if (data.revenue !== null && !Array.isArray(data.revenue)) {
            corruptCollections.push(["revenue", []]);
          }
          if (data.expenses !== null && !Array.isArray(data.expenses)) {
            corruptCollections.push(["expenses", []]);
          }

          if (corruptCollections.length > 0) {
            console.warn(`[init] Force-saving ${corruptCollections.length} corrupt collections`);
            await Promise.all(corruptCollections.map(([col, val]) => saveCollection(col, val)));
          }

          setClients(loadedClients);
          setProspects(loadedProspects);
          setTasks(loadedTasks);
          setRevenue(loadedRevenue);
          setExpenses(loadedExpenses);
          setClosedMonths(loadedClosedMonths);
        }

        setSyncStatus("ready");
        // Small delay so the debounced saves don't fire on initial data set
        setTimeout(() => setDataReady(true), 100);
        console.log("[init] Data loaded from Supabase");
      } catch (err) {
        console.error("[init] Failed to load data:", err);
        if (cancelled) return;

        // Fallback to mock data so the app still works
        setClients(initialClients);
        setProspects(initialProspects);
        setTasks(initialTasks);
        setRevenue(initialRevenue);
        setExpenses(initialExpenses);
        setClosedMonths(initialClosedMonths);

        setSyncStatus("error");
        setDataReady(true);
        toast.error("Couldn't connect to database. Using local data — changes won't persist.");
      }
    }

    load();
    return () => { cancelled = true; };
  }, [authenticated]);

  // Auto-save each collection when it changes
  const s1 = useDebouncedSave("clients", clients, dataReady);
  const s2 = useDebouncedSave("prospects", prospects, dataReady);
  const s3 = useDebouncedSave("tasks", tasks, dataReady);
  const s4 = useDebouncedSave("revenue", revenue, dataReady);
  const s5 = useDebouncedSave("expenses", expenses, dataReady);
  const s6 = useDebouncedSave("closedMonths", closedMonths, dataReady);

  const anySaving = s1.saving || s2.saving || s3.saving || s4.saving || s5.saving || s6.saving;
  const anyError = s1.error || s2.error || s3.error || s4.error || s5.error || s6.error;
  const allSaves = [s1.lastSaved, s2.lastSaved, s3.lastSaved, s4.lastSaved, s5.lastSaved, s6.lastSaved].filter(Boolean) as Date[];
  const lastSaved = allSaves.length > 0 ? new Date(Math.max(...allSaves.map(d => d.getTime()))) : null;

  // Scroll to top when switching tabs
  const switchTab = (tab: Tab) => {
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Sync revenue when clients change (add/delete/edit pricing)
  useEffect(() => {
    if (!dataReady) return;
    setRevenue((prev) => {
      const clientIds = new Set(clients.map((c) => c.id));
      let updated = prev.filter((r) => clientIds.has(r.clientId));

      const currentMonth = "2026-03";

      for (const client of clients) {
        const existingMonths = new Set(updated.filter((r) => r.clientId === client.id).map((r) => r.month));

        if (existingMonths.size === 0) {
          updated.push({
            clientId: client.id,
            clientName: client.name,
            month: currentMonth,
            retainer: client.retainer,
            adMgmt: client.adMgmt,
            oneTime: client.websiteBuild > 0 ? Math.round(client.websiteBuild / 2) : 0,
            oneTimeLabel: client.websiteBuild > 0 ? "Website deposit" : "",
            paid: false,
          });
        } else {
          updated = updated.map((r) => {
            if (r.clientId === client.id && !closedMonths.includes(r.month)) {
              return {
                ...r,
                clientName: client.name,
                  retainer: client.retainer,
                adMgmt: client.adMgmt,
                oneTime: client.websiteBuild > 0 ? client.websiteBuild : 0,
                oneTimeLabel: client.websiteBuild > 0 ? "Website build" : "",
              };
            }
            return r;
          });
        }
      }

      return updated;
    });
  }, [clients, closedMonths, dataReady]);

  // Manual retry
  const retryLoad = useCallback(async () => {
    setSyncStatus("loading");
    setDataReady(false);
    try {
      const data = await fetchAllData();
      const allNull = data.clients === null && data.prospects === null && data.tasks === null
        && data.revenue === null && data.expenses === null && data.closedMonths === null;
      if (allNull) {
        setClients(initialClients);
        setProspects(initialProspects);
        setTasks(initialTasks);
        setRevenue(initialRevenue);
        setExpenses(initialExpenses);
        setClosedMonths(initialClosedMonths);
      } else {
        setClients(data.clients === null ? [] : Array.isArray(data.clients) ? data.clients : []);
        setProspects(data.prospects === null ? [] : Array.isArray(data.prospects) ? data.prospects : []);
        setTasks(data.tasks === null ? [] : Array.isArray(data.tasks) ? data.tasks : []);
        setRevenue(data.revenue === null ? [] : Array.isArray(data.revenue) ? data.revenue : []);
        setExpenses(data.expenses === null ? [] : Array.isArray(data.expenses) ? data.expenses : []);
        setClosedMonths(data.closedMonths === null ? [] : Array.isArray(data.closedMonths) ? data.closedMonths : []);
      }
      setSyncStatus("ready");
      setTimeout(() => setDataReady(true), 100);
      toast.success("Reconnected to database");
    } catch {
      setSyncStatus("error");
      setDataReady(true);
      toast.error("Still can't connect. Working offline.");
    }
  }, []);

  // Reset all data to defaults (wipes KV store and re-seeds)
  const handleResetData = useCallback(async () => {
    if (!window.confirm("Reset ALL data to defaults? This will erase any changes you've made.")) return;
    setSyncStatus("loading");
    setDataReady(false);
    try {
      await resetAllData();
      await Promise.all([
        saveCollection("clients", initialClients),
        saveCollection("prospects", initialProspects),
        saveCollection("tasks", initialTasks),
        saveCollection("revenue", initialRevenue),
        saveCollection("expenses", initialExpenses),
        saveCollection("closedMonths", initialClosedMonths),
      ]);
      setClients(initialClients);
      setProspects(initialProspects);
      setTasks(initialTasks);
      setRevenue(initialRevenue);
      setExpenses(initialExpenses);
      setClosedMonths(initialClosedMonths);
      setSyncStatus("ready");
      setTimeout(() => setDataReady(true), 100);
      toast.success("Data reset to defaults");
    } catch (err) {
      console.error("[reset] Failed:", err);
      setClients(initialClients);
      setProspects(initialProspects);
      setTasks(initialTasks);
      setRevenue(initialRevenue);
      setExpenses(initialExpenses);
      setClosedMonths(initialClosedMonths);
      setSyncStatus("error");
      setDataReady(true);
      toast.error("Reset failed but loaded defaults locally.");
    }
  }, []);

  if (!authenticated) {
    return <AuthGate onAuthenticated={login} />;
  }

  // Loading state
  if (syncStatus === "loading" && !dataReady) {
    return (
      <div className="min-h-screen bg-[#faf9f6] flex items-center justify-center font-['Inter',sans-serif]">
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              background: "#2d4a3e",
              color: "#fff",
              border: "none",
              fontSize: "13px",
              borderRadius: "10px",
            },
          }}
        />
        <div className="text-center">
          <div className="w-14 h-14 bg-[#2d4a3e] rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg">
            <Loader2 size={24} className="text-white/80 animate-spin" />
          </div>
          <h1 className="font-['Instrument_Serif'] text-[28px] text-[#2d4a3e] tracking-tight leading-none">
            Kind Supply Digital
          </h1>
          <p className="text-[13px] text-[#8a9e96] mt-2">Loading your data from the cloud...</p>
        </div>
      </div>
    );
  }

  function formatTimeSince(d: Date): string {
    const secs = Math.round((Date.now() - d.getTime()) / 1000);
    if (secs < 5) return "just now";
    if (secs < 60) return `${secs}s ago`;
    const mins = Math.round(secs / 60);
    return `${mins}m ago`;
  }

  return (
    <div className="min-h-screen bg-[#faf9f6] font-['Inter',sans-serif] pb-16 md:pb-0">
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: "#2d4a3e",
            color: "#fff",
            border: "none",
            fontSize: "13px",
            borderRadius: "10px",
          },
        }}
      />

      {/* Header */}
      <header className="bg-[#2d4a3e] px-4 py-3 md:px-8 md:py-5 flex items-center justify-between">
        <div>
          <h1 className="font-['Instrument_Serif'] text-[22px] md:text-[28px] text-white/95 tracking-tight leading-none">
            Kind Supply Digital
          </h1>
          <p className="text-[11px] md:text-[12px] text-white/50 mt-0.5">Organization Sheet</p>
        </div>
        <div className="flex items-center gap-3 md:gap-6 text-[11px] md:text-[13px] text-white/45">
          {/* Sync indicator */}
          <span className="flex items-center gap-1.5 text-[11px]">
            {anySaving ? (
              <>
                <Loader2 size={12} className="animate-spin text-white/50" />
                <span className="hidden sm:inline text-white/40">Saving...</span>
              </>
            ) : anyError ? (
              <>
                <CloudOff size={12} className="text-[#b86b5a]" />
                <button onClick={retryLoad} className="hidden sm:inline text-[#b86b5a] hover:text-[#d4816e] underline">
                  Offline — retry
                </button>
              </>
            ) : syncStatus === "ready" ? (
              <>
                <Cloud size={12} className="text-[#4a7c6a]" />
                <span className="hidden sm:inline text-white/40">
                  {lastSaved ? `Saved ${formatTimeSince(lastSaved)}` : "Synced"}
                </span>
              </>
            ) : (
              <>
                <CloudOff size={12} className="text-[#c8973e]" />
                <button onClick={retryLoad} className="hidden sm:inline text-[#c8973e] hover:text-[#d4a64e] underline">
                  Offline — retry
                </button>
              </>
            )}
          </span>
          <span className="hidden sm:inline">{clients.length} clients</span>
          <span className="hidden sm:inline">{prospects.filter((p) => !["Won", "Lost"].includes(p.status)).length} in pipeline</span>
          <span className="hidden md:inline">{tasks.filter((t) => !t.done).length} open tasks</span>
          <button
            onClick={handleResetData}
            className="flex items-center gap-1 text-[11px] text-white/30 hover:text-white/60 transition-colors"
            title="Reset all data to defaults"
          >
            <RotateCcw size={12} />
            <span className="hidden md:inline">Reset</span>
          </button>
          <LogoutButton onLogout={logout} />
        </div>
      </header>

      {/* Desktop Tabs */}
      <div className="hidden md:block border-b border-[#e2e8e0] px-8 bg-white">
        <div className="flex gap-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => switchTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-3 text-[14px] border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-[#4a7c6a] text-[#2d4a3e]"
                  : "border-transparent text-[#8a9e96] hover:text-[#2d4a3e]"
              }`}
            >
              <tab.icon size={15} strokeWidth={1.6} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <main className="px-4 py-4 md:px-8 md:py-8 max-w-[1100px]">
        {activeTab === "clients" && <ClientsSheet clients={clients} setClients={setClients} />}
        {activeTab === "prospects" && <ProspectsSheet prospects={prospects} setProspects={setProspects} clients={clients} setClients={setClients} />}
        {activeTab === "tasks" && <TasksSheet tasks={tasks} setTasks={setTasks} clients={clients} prospects={prospects} />}
        {activeTab === "finance" && <FinanceSheet clients={clients} revenue={revenue} setRevenue={setRevenue} expenses={expenses} setExpenses={setExpenses} closedMonths={closedMonths} setClosedMonths={setClosedMonths} />}
        {activeTab === "sops" && <SOPSheet />}
      </main>

      {/* Mobile Bottom Tab Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-[#e2e8e0] flex items-center justify-around px-1 py-1 z-50 safe-area-bottom">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => switchTab(tab.id)}
            className={`flex flex-col items-center gap-0.5 flex-1 py-2 rounded-lg transition-colors ${
              activeTab === tab.id
                ? "text-[#4a7c6a] bg-[#eef5f0]"
                : "text-[#8a9e96]"
            }`}
          >
            <tab.icon size={18} strokeWidth={1.6} />
            <span className="text-[10px]">{tab.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
