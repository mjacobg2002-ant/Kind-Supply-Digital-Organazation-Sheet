import { useState, useMemo, useCallback } from "react";
import {
  Plus, X, Trash2, ChevronLeft, ChevronRight, TrendingUp, TrendingDown,
  CircleDollarSign, Receipt, Pencil, Check, RotateCcw, Lock, Send,
  Search, Zap,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import type { Expense, MonthlyRevenue } from "../data/mockData";
import { formatMonth, stepMonth, EARLIEST_MONTH, recurringPresets } from "../data/mockData";
import type { Client } from "../data/mockData";
import { toast } from "sonner";

interface Props {
  clients: Client[];
  revenue: MonthlyRevenue[];
  setRevenue: React.Dispatch<React.SetStateAction<MonthlyRevenue[]>>;
  expenses: Expense[];
  setExpenses: React.Dispatch<React.SetStateAction<Expense[]>>;
  closedMonths: string[];
  setClosedMonths: React.Dispatch<React.SetStateAction<string[]>>;
}

const expenseCategories: Expense["category"][] = ["Software", "Advertising", "Contractor", "Insurance", "Office", "Tax", "Other"];

const n = (v: any): number => (typeof v === "number" && !isNaN(v) ? v : 0);

const categoryColor: Record<string, string> = {
  Software: "#4a7c6a",
  Advertising: "#c8973e",
  Contractor: "#6b7f97",
  Insurance: "#8a6b97",
  Office: "#5a8a7a",
  Tax: "#b86b5a",
  Other: "#8a9e96",
};

const inputClass = "px-2.5 py-1.5 text-[13px] border border-[#e2e8e0] rounded-md bg-white focus:outline-none focus:border-[#4a7c6a] focus:ring-1 focus:ring-[#4a7c6a]/20 transition-colors";

const emptyExpense: Omit<Expense, "id" | "month"> = {
  description: "", category: "Software", amount: 0, recurring: false, notes: "",
};

export function FinanceSheet({ clients, revenue, setRevenue, expenses, setExpenses, closedMonths, setClosedMonths }: Props) {
  const [selectedMonth, setSelectedMonth] = useState("2026-03");
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Omit<Expense, "id" | "month">>(emptyExpense);
  const [editingExpense, setEditingExpense] = useState<string | null>(null);
  const [view, setView] = useState<"overview" | "revenue" | "expenses">("overview");
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [presetSearch, setPresetSearch] = useState("");
  const [showPresets, setShowPresets] = useState(false);
  const [taxRate, setTaxRate] = useState(30);
  const [editingTaxRate, setEditingTaxRate] = useState(false);

  const isClosed = closedMonths.includes(selectedMonth);

  // Navigate months — no limit
  const navigateMonth = useCallback((dir: -1 | 1) => {
    const next = stepMonth(selectedMonth, dir);
    if (next < EARLIEST_MONTH) return;
    setSelectedMonth(next);
  }, [selectedMonth]);

  // Calculate recurring expenses for any month
  const getMonthExpenses = useCallback((month: string) => {
    const directExpenses = expenses.filter((e) => e.month === month);
    const recurringFromOther = expenses.filter(
      (e) => e.recurring && e.month !== month && e.month <= month
    ).map((e) => ({ ...e, id: `${e.id}-${month}`, month }));
    const recurringIds = new Set(directExpenses.filter((e) => e.recurring).map((e) => e.description));
    const deduped = recurringFromOther.filter((e) => !recurringIds.has(e.description));
    return [...directExpenses, ...deduped];
  }, [expenses]);

  const monthRevenue = revenue.filter((r) => r.month === selectedMonth);
  const monthExpenses = getMonthExpenses(selectedMonth);

  const totalRevenue = monthRevenue.reduce((a, r) => a + n(r.retainer) + n(r.adMgmt) + n(r.oneTime), 0);
  const totalRecurring = monthRevenue.reduce((a, r) => a + n(r.retainer) + n(r.adMgmt), 0);
  const totalOneTime = monthRevenue.reduce((a, r) => a + n(r.oneTime), 0);
  const totalExpenses = monthExpenses.reduce((a, e) => a + n(e.amount), 0);
  const profit = totalRevenue - totalExpenses;
  const margin = totalRevenue > 0 ? ((profit / totalRevenue) * 100).toFixed(1) : "0";
  const unpaid = monthRevenue.filter((r) => !r.paid).reduce((a, r) => a + n(r.retainer) + n(r.adMgmt) + n(r.oneTime), 0);

  // Live MRR from client data (always reflects current roster)
  const liveMRR = clients.reduce((a, c) => a + n(c.retainer) + n(c.adMgmt), 0);

  // One-time revenue for the selected year (website builds, etc.) — pulls from live client data
  const selectedYear = selectedMonth.split("-")[0];
  const yearOneTimeTotal = useMemo(() => {
    return clients.reduce((a, c) => a + n(c.websiteBuild), 0);
  }, [clients]);

  const liveAnnualRunRate = liveMRR * 12 + yearOneTimeTotal;

  // Recurring monthly expenses total (for accurate take-home projection)
  const recurringExpenseTotal = useMemo(() => {
    const seen = new Set<string>();
    let total = 0;
    expenses.filter((e) => e.recurring).forEach((e) => {
      if (!seen.has(e.description)) {
        seen.add(e.description);
        total += n(e.amount);
      }
    });
    return total;
  }, [expenses]);

  // Monthly net based on live client data minus recurring expenses
  const liveMonthlyNet = liveMRR - recurringExpenseTotal;

  // Previous month comparison
  const prevMonth = stepMonth(selectedMonth, -1);
  const prevRevenue = prevMonth >= EARLIEST_MONTH
    ? revenue.filter((r) => r.month === prevMonth).reduce((a, r) => a + n(r.retainer) + n(r.adMgmt) + n(r.oneTime), 0) : 0;
  const revenueChange = prevRevenue > 0 ? (((totalRevenue - prevRevenue) / prevRevenue) * 100).toFixed(0) : null;

  // Chart data — last 6 months
  const chartData = useMemo(() => {
    const months: string[] = [];
    let m = selectedMonth;
    for (let i = 0; i < 6; i++) {
      if (m >= EARLIEST_MONTH) months.unshift(m);
      m = stepMonth(m, -1);
    }
    return months.map((mo) => {
      const mRev = revenue.filter((r) => r.month === mo);
      const mExp = getMonthExpenses(mo);
      const rev = mRev.reduce((a, r) => a + n(r.retainer) + n(r.adMgmt) + n(r.oneTime), 0);
      const exp = mExp.reduce((a, e) => a + n(e.amount), 0);
      return {
        month: formatMonth(mo).split(" ")[0],
        revenue: rev,
        expenses: exp,
        profit: rev - exp,
      };
    });
  }, [selectedMonth, revenue, expenses]);

  // Expense breakdown by category
  const expenseBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    monthExpenses.forEach((e) => { map[e.category] = (map[e.category] || 0) + n(e.amount); });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([cat, amount]) => ({ category: cat, amount }));
  }, [monthExpenses]);

  // Revenue breakdown by client
  const clientBreakdown = useMemo(() => {
    return monthRevenue.map((r, i) => ({
      name: r.clientName?.split(" ").slice(0, 2).join(" ") || `Client ${i + 1}`,
      uniqueName: `${r.clientName?.split(" ").slice(0, 2).join(" ") || "Client"}-${i}`,
      fullName: r.clientName || `Client ${i + 1}`,
      clientId: r.clientId || `unknown-${i}`,
      recurring: n(r.retainer) + n(r.adMgmt),
      oneTime: n(r.oneTime),
      total: n(r.retainer) + n(r.adMgmt) + n(r.oneTime),
      paid: r.paid,
    }));
  }, [monthRevenue]);

  // Quick month jumps — show 6 months around selected
  const quickMonths = useMemo(() => {
    const months: string[] = [];
    let m = stepMonth(selectedMonth, -2);
    for (let i = 0; i < 6; i++) {
      if (m >= EARLIEST_MONTH) months.push(m);
      m = stepMonth(m, 1);
    }
    // make sure selectedMonth is included
    if (!months.includes(selectedMonth)) months.push(selectedMonth);
    return [...new Set(months)].sort();
  }, [selectedMonth]);

  // Filtered presets
  const filteredPresets = useMemo(() => {
    const alreadyAdded = new Set(monthExpenses.map((e) => e.description));
    return recurringPresets.filter((p) => {
      const matchesSearch = presetSearch === "" ||
        p.description.toLowerCase().includes(presetSearch.toLowerCase()) ||
        p.category.toLowerCase().includes(presetSearch.toLowerCase());
      return matchesSearch && !alreadyAdded.has(p.description);
    });
  }, [presetSearch, monthExpenses]);

  const addExpense = () => {
    if (!draft.description.trim() || draft.amount <= 0) return;
    setExpenses((prev) => [...prev, { ...draft, id: Date.now().toString(), month: selectedMonth }]);
    setDraft(emptyExpense);
    setAdding(false);
    setShowPresets(false);
  };

  const addFromPreset = (preset: typeof recurringPresets[0]) => {
    setExpenses((prev) => [...prev, {
      ...preset,
      id: Date.now().toString() + Math.random().toString(36).slice(2, 5),
      month: selectedMonth,
      recurring: true,
    }]);
  };

  const deleteExpense = (id: string) => {
    setExpenses((prev) => prev.filter((e) => e.id !== id));
    if (editingExpense === id) setEditingExpense(null);
  };

  const updateExpense = (id: string, field: keyof Expense, value: string | number | boolean) => {
    setExpenses((prev) => prev.map((e) => (e.id === id ? { ...e, [field]: value } : e)));
  };

  const togglePaid = (clientId: string) => {
    if (isClosed) return;
    setRevenue((prev) => prev.map((r) =>
      r.month === selectedMonth && r.clientId === clientId ? { ...r, paid: !r.paid } : r
    ));
  };

  // Close Month
  const closeMonth = () => {
    setClosedMonths((prev) => [...prev, selectedMonth]);
    setShowCloseConfirm(false);
    setEditingExpense(null);
    setAdding(false);
    toast.success(`Month ${formatMonth(selectedMonth)} closed successfully.`);
  };

  const reopenMonth = () => {
    setClosedMonths((prev) => prev.filter((m) => m !== selectedMonth));
    toast.success(`Month ${formatMonth(selectedMonth)} reopened successfully.`);
  };

  const customTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload) return null;
    return (
      <div className="bg-white border border-[#e2e8e0] rounded-lg px-3 py-2 shadow-lg text-[12px]">
        <p className="text-[#2d4a3e] mb-1">{label}</p>
        {payload.map((p: any) => (
          <p key={p.dataKey} style={{ color: p.color }}>
            {p.name}: ${p.value.toLocaleString()}
          </p>
        ))}
      </div>
    );
  };

  return (
    <div>
      {/* Month Navigator */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-6 pb-5 border-b border-[#e2e8e0]">
        <div className="flex items-center gap-3">
          <button onClick={() => navigateMonth(-1)} disabled={stepMonth(selectedMonth, -1) < EARLIEST_MONTH}
            className="p-1.5 rounded-md text-[#8a9e96] hover:bg-[#eef5f0] hover:text-[#4a7c6a] disabled:opacity-30 transition-colors">
            <ChevronLeft size={18} />
          </button>
          <div className="text-center min-w-[140px] md:min-w-[160px]">
            <div className="flex items-center justify-center gap-2">
              <p className="text-[20px] md:text-[22px] text-[#2d4a3e] tracking-tight">{formatMonth(selectedMonth)}</p>
              {isClosed && (
                <span className="flex items-center gap-1 text-[10px] text-[#4a7c6a] bg-[#eef5f0] px-2 py-0.5 rounded-full">
                  <Lock size={9} /> Closed
                </span>
              )}
            </div>
            <p className="text-[11px] text-[#8a9e96] tracking-widest uppercase">Financial Overview</p>
          </div>
          <button onClick={() => navigateMonth(1)}
            className="p-1.5 rounded-md text-[#8a9e96] hover:bg-[#eef5f0] hover:text-[#4a7c6a] transition-colors">
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Quick month jumps */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {quickMonths.map((m) => (
            <button key={m} onClick={() => setSelectedMonth(m)}
              className={`px-2 py-1 rounded-md text-[11px] transition-colors flex items-center gap-0.5 shrink-0 ${
                selectedMonth === m ? "bg-[#2d4a3e] text-white" : "text-[#8a9e96] hover:bg-[#eef5f0]"
              }`}>
              {closedMonths.includes(m) && selectedMonth !== m && <Lock size={8} className="opacity-50" />}
              {formatMonth(m).split(" ")[0]}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mb-6">
        <div className="bg-white border border-[#e2e8e0] rounded-xl p-4 shadow-[0_1px_3px_rgba(45,74,62,0.04)]">
          <div className="flex items-center gap-2 mb-1">
            <CircleDollarSign size={13} className="text-[#4a7c6a]" />
            <span className="text-[10px] text-[#8a9e96] tracking-widest uppercase">Revenue</span>
          </div>
          <p className="text-[20px] text-[#2d4a3e] tracking-tight">${totalRevenue.toLocaleString()}</p>
          {revenueChange !== null && (
            <p className={`text-[11px] flex items-center gap-0.5 mt-0.5 ${Number(revenueChange) >= 0 ? "text-[#4a7c6a]" : "text-[#b86b5a]"}`}>
              {Number(revenueChange) >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
              {revenueChange}% vs prev
            </p>
          )}
        </div>

        <div className="bg-white border border-[#e2e8e0] rounded-xl p-4 shadow-[0_1px_3px_rgba(45,74,62,0.04)]">
          <div className="flex items-center gap-2 mb-1">
            <Receipt size={13} className="text-[#b86b5a]" />
            <span className="text-[10px] text-[#8a9e96] tracking-widest uppercase">Expenses</span>
          </div>
          <p className="text-[20px] text-[#2d4a3e] tracking-tight">${totalExpenses.toLocaleString()}</p>
          <p className="text-[11px] text-[#8a9e96] mt-0.5">{monthExpenses.length} items</p>
        </div>

        <div className="bg-white border border-[#e2e8e0] rounded-xl p-4 shadow-[0_1px_3px_rgba(45,74,62,0.04)]">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp size={13} className={profit >= 0 ? "text-[#4a7c6a]" : "text-[#b86b5a]"} />
            <span className="text-[10px] text-[#8a9e96] tracking-widest uppercase">Net Profit</span>
          </div>
          <p className={`text-[20px] tracking-tight ${profit >= 0 ? "text-[#4a7c6a]" : "text-[#b86b5a]"}`}>
            ${profit.toLocaleString()}
          </p>
          <p className="text-[11px] text-[#8a9e96] mt-0.5">{margin}% margin</p>
        </div>

        <div className="bg-white border border-[#e2e8e0] rounded-xl p-4 shadow-[0_1px_3px_rgba(45,74,62,0.04)]">
          <div className="flex items-center gap-2 mb-1">
            <RotateCcw size={13} className="text-[#c8973e]" />
            <span className="text-[10px] text-[#8a9e96] tracking-widest uppercase">MRR</span>
          </div>
          <p className="text-[20px] text-[#2d4a3e] tracking-tight">${totalRecurring.toLocaleString()}</p>
          <p className="text-[11px] text-[#8a9e96] mt-0.5">+ ${totalOneTime.toLocaleString()} one-time</p>
        </div>

        <div className="bg-white border border-[#e2e8e0] rounded-xl p-4 shadow-[0_1px_3px_rgba(45,74,62,0.04)]">
          <div className="flex items-center gap-2 mb-1">
            <CircleDollarSign size={13} className={unpaid > 0 ? "text-[#b86b5a]" : "text-[#4a7c6a]"} />
            <span className="text-[10px] text-[#8a9e96] tracking-widest uppercase">Unpaid</span>
          </div>
          <p className={`text-[20px] tracking-tight ${unpaid > 0 ? "text-[#b86b5a]" : "text-[#4a7c6a]"}`}>
            ${unpaid.toLocaleString()}
          </p>
          <p className="text-[11px] text-[#8a9e96] mt-0.5">{unpaid > 0 ? "Outstanding" : "All collected"}</p>
        </div>
      </div>

      {/* Sub-nav + Close Month Button */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-1">
          {(["overview", "revenue", "expenses"] as const).map((v) => (
            <button key={v} onClick={() => setView(v)}
              className={`px-3 py-1.5 rounded-md text-[12px] capitalize transition-colors ${
                view === v ? "bg-[#2d4a3e] text-white" : "text-[#8a9e96] hover:bg-[#eef5f0] hover:text-[#4a7c6a]"
              }`}>
              {v}
            </button>
          ))}
        </div>

        {/* Close / Reopen Month */}
        {!isClosed ? (
          <button
            onClick={() => setShowCloseConfirm(true)}
            className="flex items-center gap-1.5 text-[13px] text-white bg-[#2d4a3e] px-4 py-2 rounded-md hover:bg-[#243d33] transition-colors shadow-sm"
          >
            <Send size={13} /> Close {formatMonth(selectedMonth)}
          </button>
        ) : (
          <button
            onClick={reopenMonth}
            className="flex items-center gap-1.5 text-[12px] text-[#8a9e96] hover:text-[#2d4a3e] px-3 py-1.5 rounded-md hover:bg-[#eef5f0] transition-colors"
          >
            <Lock size={11} /> Reopen Month
          </button>
        )}
      </div>

      {/* Close Month Confirmation Modal */}
      {showCloseConfirm && (
        <div className="border-2 border-[#2d4a3e]/20 rounded-xl p-5 mb-5 bg-white shadow-md">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-[#eef5f0] flex items-center justify-center shrink-0">
              <Send size={18} className="text-[#4a7c6a]" />
            </div>
            <div className="flex-1">
              <p className="text-[15px] text-[#2d4a3e] mb-1">Close {formatMonth(selectedMonth)}?</p>
              <p className="text-[13px] text-[#8a9e96] mb-3">
                This will lock the month's financials as final. You'll still be able to view everything, but edits will be disabled. You can reopen it later if needed.
              </p>
              <div className="grid grid-cols-3 gap-4 mb-4 py-3 px-4 bg-[#f9fbf9] rounded-lg">
                <div>
                  <p className="text-[10px] text-[#8a9e96] uppercase tracking-widest">Revenue</p>
                  <p className="text-[16px] text-[#2d4a3e]">${totalRevenue.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[10px] text-[#8a9e96] uppercase tracking-widest">Expenses</p>
                  <p className="text-[16px] text-[#2d4a3e]">${totalExpenses.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[10px] text-[#8a9e96] uppercase tracking-widest">Net Profit</p>
                  <p className={`text-[16px] ${profit >= 0 ? "text-[#4a7c6a]" : "text-[#b86b5a]"}`}>${profit.toLocaleString()}</p>
                </div>
              </div>
              {unpaid > 0 && (
                <p className="text-[12px] text-[#c8973e] mb-3 flex items-center gap-1">
                  ⚠ ${unpaid.toLocaleString()} is still unpaid — you can still close and collect later.
                </p>
              )}
              <div className="flex items-center gap-2">
                <button onClick={closeMonth}
                  className="flex items-center gap-1.5 text-[13px] text-white bg-[#4a7c6a] px-5 py-2 rounded-md hover:bg-[#3d6858] transition-colors shadow-sm">
                  <Check size={13} /> Confirm & Close
                </button>
                <button onClick={() => setShowCloseConfirm(false)}
                  className="text-[13px] text-[#8a9e96] hover:text-[#2d4a3e] px-4 py-2 rounded-md hover:bg-[#f0f4f1] transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Closed month banner */}
      {isClosed && (
        <div className="flex items-center gap-3 bg-[#eef5f0] border border-[#c8d4cd] rounded-xl px-4 py-3 mb-5">
          <Lock size={14} className="text-[#4a7c6a]" />
          <p className="text-[13px] text-[#2d4a3e]">
            <span className="text-[#4a7c6a]">{formatMonth(selectedMonth)}</span> is closed. Financials are locked as final.
          </p>
          <button onClick={reopenMonth} className="ml-auto text-[12px] text-[#4a7c6a] hover:text-[#2d4a3e] underline underline-offset-2 transition-colors">
            Reopen
          </button>
        </div>
      )}

      {/* ── OVERVIEW ── */}
      {view === "overview" && (
        <div className="space-y-6">
          <div className="bg-white border border-[#e2e8e0] rounded-xl p-5 shadow-[0_1px_3px_rgba(45,74,62,0.04)]">
            <p className="text-[10px] text-[#8a9e96] uppercase tracking-widest mb-3">Revenue vs Expenses — Last 6 Months</p>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                  <defs key="custom-gradients">
                    <linearGradient id="grad-revenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#4a7c6a" stopOpacity={0.15} />
                      <stop offset="100%" stopColor="#4a7c6a" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="grad-expenses" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#b86b5a" stopOpacity={0.08} />
                      <stop offset="100%" stopColor="#b86b5a" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="grad-profit" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#c8973e" stopOpacity={0.12} />
                      <stop offset="100%" stopColor="#c8973e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8e0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#8a9e96" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#8a9e96" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip content={customTooltip} />
                  <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#4a7c6a" fill="url(#grad-revenue)" strokeWidth={2} />
                  <Area type="monotone" dataKey="expenses" name="Expenses" stroke="#b86b5a" fill="url(#grad-expenses)" strokeWidth={1.5} strokeDasharray="4 4" />
                  <Area type="monotone" dataKey="profit" name="Profit" stroke="#c8973e" fill="url(#grad-profit)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white border border-[#e2e8e0] rounded-xl p-4 md:p-5 shadow-[0_1px_3px_rgba(45,74,62,0.04)]">
              <p className="text-[10px] text-[#8a9e96] uppercase tracking-widest mb-3">Revenue by Client</p>
              {clientBreakdown.length > 0 ? (
                <div className="h-[180px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={clientBreakdown} layout="vertical" margin={{ left: 0, right: 10, top: 0, bottom: 0 }}>
                      <XAxis type="number" tick={{ fontSize: 10, fill: "#8a9e96" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                      <YAxis type="category" dataKey="uniqueName" tick={{ fontSize: 11, fill: "#2d4a3e" }} axisLine={false} tickLine={false} width={100} tickFormatter={(v) => String(v).replace(/-\d+$/, "")} />
                      <Tooltip content={customTooltip} />
                      <Bar dataKey="recurring" name="Recurring" stackId="a" fill="#4a7c6a" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="oneTime" name="One-Time" stackId="a" fill="#c8973e" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-[13px] text-[#b8c4be] py-8 text-center">No revenue this month</p>
              )}
            </div>

            <div className="bg-white border border-[#e2e8e0] rounded-xl p-4 md:p-5 shadow-[0_1px_3px_rgba(45,74,62,0.04)]">
              <p className="text-[10px] text-[#8a9e96] uppercase tracking-widest mb-3">Expenses by Category</p>
              {expenseBreakdown.length > 0 ? (
                <div className="space-y-2">
                  {expenseBreakdown.map((eb) => {
                    const pct = totalExpenses > 0 ? (eb.amount / totalExpenses) * 100 : 0;
                    return (
                      <div key={eb.category}>
                        <div className="flex items-center justify-between text-[12px] mb-0.5">
                          <span className="text-[#2d4a3e]">{eb.category}</span>
                          <span className="text-[#8a9e96]">${eb.amount.toLocaleString()} <span className="text-[10px]">({pct.toFixed(0)}%)</span></span>
                        </div>
                        <div className="h-1.5 bg-[#f0f4f1] rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: categoryColor[eb.category] || "#8a9e96" }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[13px] text-[#b8c4be] py-8 text-center">No expenses this month</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── REVENUE ── */}
      {view === "revenue" && (
        <div className="bg-white border border-[#e2e8e0] rounded-xl overflow-hidden shadow-[0_1px_3px_rgba(45,74,62,0.04)]">
          {/* Desktop Table */}
          <div className="hidden md:block">
            <div className="grid grid-cols-[1fr_100px_100px_100px_100px_80px] gap-2 px-5 py-2.5 bg-[#f5f8f5] text-[10px] text-[#8a9e96] uppercase tracking-widest">
              <span>Client</span>
              <span className="text-right">Retainer</span>
              <span className="text-right">Ad Mgmt</span>
              <span className="text-right">One-Time</span>
              <span className="text-right">Total</span>
              <span className="text-center">Paid</span>
            </div>
            {monthRevenue.length > 0 ? monthRevenue.map((r) => (
              <div key={r.clientId} className="grid grid-cols-[1fr_100px_100px_100px_100px_80px] gap-2 px-5 py-3 border-t border-[#e2e8e0] items-center hover:bg-[#f9fbf9] transition-colors">
                <div>
                  <p className="text-[13px] text-[#2d4a3e]">{r.clientName}</p>
                  {r.oneTimeLabel && <p className="text-[11px] text-[#c8973e]">{r.oneTimeLabel}</p>}
                </div>
                <p className="text-[13px] text-[#2d4a3e] text-right">${n(r.retainer).toLocaleString()}</p>
                <p className="text-[13px] text-[#2d4a3e] text-right">${n(r.adMgmt).toLocaleString()}</p>
                <p className="text-[13px] text-right">{n(r.oneTime) > 0 ? <span className="text-[#c8973e]">${n(r.oneTime).toLocaleString()}</span> : <span className="text-[#b8c4be]">—</span>}</p>
                <p className="text-[13px] text-[#2d4a3e] text-right">${(n(r.retainer) + n(r.adMgmt) + n(r.oneTime)).toLocaleString()}</p>
                <div className="flex justify-center">
                  <button
                    onClick={() => togglePaid(r.clientId)}
                    disabled={isClosed}
                    className={`w-[18px] h-[18px] rounded-md border-[1.5px] flex items-center justify-center transition-all ${
                      r.paid ? "bg-[#4a7c6a] border-[#4a7c6a] text-white" : "border-[#c8d4cd] hover:border-[#4a7c6a]"
                    } ${isClosed ? "opacity-60 cursor-not-allowed" : ""}`}
                  >
                    {r.paid && <span className="text-[10px]">✓</span>}
                  </button>
                </div>
              </div>
            )) : (
              <div className="text-center py-12 text-[14px] text-[#b8c4be]">No revenue records for {formatMonth(selectedMonth)}</div>
            )}
            {monthRevenue.length > 0 && (
              <div className="grid grid-cols-[1fr_100px_100px_100px_100px_80px] gap-2 px-5 py-3 border-t-2 border-[#e2e8e0] bg-[#f5f8f5]">
                <p className="text-[12px] text-[#8a9e96] uppercase tracking-widest">Total</p>
                <p className="text-[13px] text-[#2d4a3e] text-right">${monthRevenue.reduce((a, r) => a + n(r.retainer), 0).toLocaleString()}</p>
                <p className="text-[13px] text-[#2d4a3e] text-right">${monthRevenue.reduce((a, r) => a + n(r.adMgmt), 0).toLocaleString()}</p>
                <p className="text-[13px] text-[#c8973e] text-right">${totalOneTime.toLocaleString()}</p>
                <p className="text-[13px] text-[#2d4a3e] text-right">${totalRevenue.toLocaleString()}</p>
                <div />
              </div>
            )}
          </div>
          {/* Mobile Revenue Cards */}
          <div className="md:hidden">
            {monthRevenue.length > 0 ? monthRevenue.map((r, i) => (
              <div key={r.clientId} className={`px-4 py-3 ${i !== 0 ? "border-t border-[#e2e8e0]" : ""}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="min-w-0">
                    <p className="text-[14px] text-[#2d4a3e]">{r.clientName}</p>
                    {r.oneTimeLabel && <p className="text-[11px] text-[#c8973e]">{r.oneTimeLabel}</p>}
                  </div>
                  <button
                    onClick={() => togglePaid(r.clientId)}
                    disabled={isClosed}
                    className={`w-[22px] h-[22px] rounded-md border-[1.5px] flex items-center justify-center transition-all shrink-0 ml-2 ${
                      r.paid ? "bg-[#4a7c6a] border-[#4a7c6a] text-white" : "border-[#c8d4cd]"
                    } ${isClosed ? "opacity-60 cursor-not-allowed" : ""}`}
                  >
                    {r.paid && <span className="text-[11px]">✓</span>}
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2 text-[12px]">
                  <div>
                    <p className="text-[10px] text-[#8a9e96] uppercase">Retainer</p>
                    <p className="text-[#2d4a3e]">${n(r.retainer).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-[#8a9e96] uppercase">Ad Mgmt</p>
                    <p className="text-[#2d4a3e]">${n(r.adMgmt).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-[#8a9e96] uppercase">Total</p>
                    <p className="text-[#2d4a3e]">${(n(r.retainer) + n(r.adMgmt) + n(r.oneTime)).toLocaleString()}</p>
                  </div>
                </div>
              </div>
            )) : (
              <div className="text-center py-12 text-[14px] text-[#b8c4be]">No revenue records for {formatMonth(selectedMonth)}</div>
            )}
            {monthRevenue.length > 0 && (
              <div className="px-4 py-3 border-t-2 border-[#e2e8e0] bg-[#f5f8f5] flex items-center justify-between">
                <p className="text-[12px] text-[#8a9e96] uppercase tracking-widest">Total</p>
                <p className="text-[14px] text-[#2d4a3e]">${totalRevenue.toLocaleString()}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── EXPENSES ── */}
      {view === "expenses" && (
        <div>
          {/* Actions */}
          {!isClosed && (
            <div className="flex items-center gap-2 justify-end mb-3">
              <button onClick={() => { setShowPresets(!showPresets); setAdding(false); }}
                className={`flex items-center gap-1.5 text-[13px] px-4 py-2 rounded-md transition-colors shadow-sm ${
                  showPresets ? "bg-[#c8973e] text-white hover:bg-[#b5872f]" : "text-[#c8973e] border border-[#c8973e]/30 hover:bg-[#fdf6eb]"
                }`}>
                <Zap size={14} /> Quick Add Software
              </button>
              <button onClick={() => { setAdding(true); setShowPresets(false); }}
                className="flex items-center gap-1.5 text-[13px] text-white bg-[#4a7c6a] px-4 py-2 rounded-md hover:bg-[#3d6858] transition-colors shadow-sm">
                <Plus size={14} /> Add Expense
              </button>
            </div>
          )}

          {/* Quick-Add Presets Panel */}
          {showPresets && !isClosed && (
            <div className="border-2 border-[#c8973e]/30 rounded-xl p-4 md:p-5 mb-4 bg-white shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Zap size={15} className="text-[#c8973e]" />
                  <span className="text-[14px] text-[#2d4a3e]">Quick Add</span>
                </div>
                <button onClick={() => setShowPresets(false)} className="text-[#8a9e96] hover:text-[#2d4a3e] transition-colors"><X size={14} /></button>
              </div>
              <div className="relative mb-3">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#b8c4be]" />
                <input
                  value={presetSearch}
                  onChange={(e) => setPresetSearch(e.target.value)}
                  placeholder="Filter subscriptions..."
                  className={`w-full pl-8 ${inputClass}`}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[240px] overflow-y-auto">
                {filteredPresets.map((p) => (
                  <button
                    key={p.description}
                    onClick={() => addFromPreset(p)}
                    className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-[#e2e8e0] hover:border-[#c8973e]/40 hover:bg-[#fdf6eb] transition-colors text-left group"
                  >
                    <div className="min-w-0">
                      <p className="text-[13px] text-[#2d4a3e] truncate">{p.description}</p>
                      <p className="text-[11px] text-[#8a9e96]">{p.category}{p.notes ? ` · ${p.notes}` : ""}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <span className="text-[13px] text-[#2d4a3e]">${p.amount}</span>
                      <Plus size={12} className="text-[#b8c4be] group-hover:text-[#c8973e] transition-colors" />
                    </div>
                  </button>
                ))}
                {filteredPresets.length === 0 && (
                  <p className="col-span-2 text-center py-4 text-[13px] text-[#b8c4be]">
                    {presetSearch ? "No matching subscriptions" : "All subscriptions already added"}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Manual Add Form */}
          {adding && !isClosed && (
            <div className="border-2 border-[#4a7c6a]/30 rounded-xl p-4 md:p-5 mb-4 bg-white shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[14px] text-[#2d4a3e]">New Expense — {formatMonth(selectedMonth)}</span>
                <button onClick={() => { setAdding(false); setDraft(emptyExpense); }} className="text-[#8a9e96] hover:text-[#2d4a3e] transition-colors"><X size={14} /></button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                <input placeholder="Description *" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} className={`sm:col-span-2 ${inputClass}`} />
                <select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value as Expense["category"] })} className={inputClass}>
                  {expenseCategories.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                <div>
                  <label className="text-[10px] text-[#8a9e96] uppercase tracking-widest">Amount ($)</label>
                  <input type="number" placeholder="0" value={draft.amount || ""} onChange={(e) => setDraft({ ...draft, amount: +e.target.value })} className={`w-full ${inputClass}`} />
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={draft.recurring} onChange={(e) => setDraft({ ...draft, recurring: e.target.checked })} className="accent-[#4a7c6a] w-3.5 h-3.5" />
                    <span className="text-[13px] text-[#2d4a3e]">Recurring monthly</span>
                  </label>
                </div>
                <input placeholder="Notes (optional)" value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} className={inputClass} />
              </div>
              <button onClick={addExpense} className="text-[13px] text-white bg-[#4a7c6a] px-5 py-2 rounded-md hover:bg-[#3d6858] transition-colors shadow-sm">Add Expense</button>
            </div>
          )}

          {/* Expense Table — Desktop */}
          <div className="bg-white border border-[#e2e8e0] rounded-xl overflow-hidden shadow-[0_1px_3px_rgba(45,74,62,0.04)]">
            <div className="hidden md:grid grid-cols-[1fr_110px_90px_70px_120px_40px] gap-2 px-5 py-2.5 bg-[#f5f8f5] text-[10px] text-[#8a9e96] uppercase tracking-widest">
              <span>Description</span>
              <span>Category</span>
              <span className="text-right">Amount</span>
              <span className="text-center">Recur</span>
              <span>Notes</span>
              <span />
            </div>
            {monthExpenses.length > 0 ? monthExpenses.map((e) => {
              const isEditing = editingExpense === e.id;
              const isOriginal = expenses.find((ex) => ex.id === e.id);

              return (
                <div key={e.id}>
                  {/* Desktop expense row */}
                  <div className="hidden md:grid grid-cols-[1fr_110px_90px_70px_120px_40px] gap-2 px-5 py-2.5 border-t border-[#e2e8e0] items-center group hover:bg-[#f9fbf9] transition-colors">
                    {isEditing && isOriginal && !isClosed ? (
                      <>
                        <input value={e.description} onChange={(ev) => updateExpense(e.id, "description", ev.target.value)} className={inputClass} />
                        <select value={e.category} onChange={(ev) => updateExpense(e.id, "category", ev.target.value)} className={`text-[12px] ${inputClass}`}>
                          {expenseCategories.map((c) => <option key={c}>{c}</option>)}
                        </select>
                        <input type="number" value={e.amount} onChange={(ev) => updateExpense(e.id, "amount", +ev.target.value)} className={`text-right ${inputClass}`} />
                        <div className="flex justify-center">
                          <input type="checkbox" checked={e.recurring} onChange={(ev) => updateExpense(e.id, "recurring", ev.target.checked)} className="accent-[#4a7c6a]" />
                        </div>
                        <input value={e.notes} onChange={(ev) => updateExpense(e.id, "notes", ev.target.value)} className={inputClass} />
                        <button onClick={() => setEditingExpense(null)} className="p-1 text-[#4a7c6a]"><Check size={13} /></button>
                      </>
                    ) : (
                      <>
                        <p className="text-[13px] text-[#2d4a3e]">{e.description}</p>
                        <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ color: categoryColor[e.category], backgroundColor: `${categoryColor[e.category]}15` }}>
                          {e.category}
                        </span>
                        <p className="text-[13px] text-[#2d4a3e] text-right">${n(e.amount).toLocaleString()}</p>
                        <div className="flex justify-center">
                          {e.recurring && <RotateCcw size={11} className="text-[#c8973e]" />}
                        </div>
                        <p className="text-[12px] text-[#8a9e96] truncate">{e.notes || "—"}</p>
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          {isOriginal && !isClosed && (
                            <button onClick={() => setEditingExpense(e.id)} className="p-0.5 text-[#b8c4be] hover:text-[#4a7c6a] transition-colors"><Pencil size={11} /></button>
                          )}
                          {isOriginal && !isClosed && (
                            <button onClick={() => deleteExpense(e.id)} className="p-0.5 text-[#b8c4be] hover:text-[#b86b5a] transition-colors"><Trash2 size={11} /></button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                  {/* Mobile expense row */}
                  <div className="md:hidden border-t border-[#e2e8e0] px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[13px] text-[#2d4a3e]">{e.description}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ color: categoryColor[e.category], backgroundColor: `${categoryColor[e.category]}15` }}>
                            {e.category}
                          </span>
                          {e.recurring && <RotateCcw size={10} className="text-[#c8973e]" />}
                          {e.notes && <span className="text-[11px] text-[#8a9e96] truncate">{e.notes}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <p className="text-[14px] text-[#2d4a3e]">${n(e.amount).toLocaleString()}</p>
                        {isOriginal && !isClosed && (
                          <button onClick={() => deleteExpense(e.id)} className="p-1.5 text-[#b8c4be] hover:text-[#b86b5a] transition-colors"><Trash2 size={14} /></button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            }) : (
              <div className="text-center py-12 text-[14px] text-[#b8c4be]">No expenses for {formatMonth(selectedMonth)}</div>
            )}
            {monthExpenses.length > 0 && (
              <div>
                <div className="hidden md:grid grid-cols-[1fr_110px_90px_70px_120px_40px] gap-2 px-5 py-3 border-t-2 border-[#e2e8e0] bg-[#f5f8f5]">
                  <p className="text-[12px] text-[#8a9e96] uppercase tracking-widest">Total</p>
                  <span />
                  <p className="text-[13px] text-[#2d4a3e] text-right">${totalExpenses.toLocaleString()}</p>
                  <span /><span /><span />
                </div>
                <div className="md:hidden px-4 py-3 border-t-2 border-[#e2e8e0] bg-[#f5f8f5] flex items-center justify-between">
                  <p className="text-[12px] text-[#8a9e96] uppercase tracking-widest">Total</p>
                  <p className="text-[14px] text-[#2d4a3e]">${totalExpenses.toLocaleString()}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bottom Summary */}
      <div className="mt-8 pt-5 border-t border-[#e2e8e0] grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8">
        <div>
          <p className="text-[10px] text-[#8a9e96] uppercase tracking-widest mb-1">Annual Run Rate</p>
          <p className="text-[20px] text-[#2d4a3e] tracking-tight">${liveAnnualRunRate.toLocaleString()}<span className="text-[13px] text-[#8a9e96]">/yr</span></p>
          <p className="text-[11px] text-[#8a9e96]">{clients.length} clients · ${liveMRR.toLocaleString()}/mo MRR</p>
          {yearOneTimeTotal > 0 && (
            <p className="text-[10px] text-[#c8973e] mt-0.5">+ ${yearOneTimeTotal.toLocaleString()} one-time in {selectedYear}</p>
          )}
        </div>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <p className="text-[10px] text-[#8a9e96] uppercase tracking-widest">Tax Reserve</p>
            {editingTaxRate ? (
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={taxRate}
                  onChange={(e) => setTaxRate(Math.min(100, Math.max(0, +e.target.value)))}
                  className="w-[48px] px-1.5 py-0.5 text-[12px] border border-[#4a7c6a] rounded bg-white focus:outline-none text-center"
                  autoFocus
                  onKeyDown={(e) => e.key === "Enter" && setEditingTaxRate(false)}
                />
                <span className="text-[11px] text-[#8a9e96]">%</span>
                <button onClick={() => setEditingTaxRate(false)} className="p-0.5 text-[#4a7c6a] hover:text-[#2d4a3e] transition-colors">
                  <Check size={11} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setEditingTaxRate(true)}
                className="flex items-center gap-1 text-[11px] text-[#c8973e] hover:text-[#2d4a3e] transition-colors group"
              >
                ({taxRate}%)
                <Pencil size={9} className="opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            )}
          </div>
          <p className="text-[20px] text-[#c8973e] tracking-tight">${Math.round(liveMonthlyNet * (taxRate / 100)).toLocaleString()}<span className="text-[13px] text-[#8a9e96]">/mo</span></p>
          <p className="text-[11px] text-[#8a9e96]">Set aside monthly · ${Math.round(liveMonthlyNet * (taxRate / 100) * 12).toLocaleString()}/yr total</p>
          <p className="text-[10px] text-[#b8c4be] mt-0.5">Pay quarterly: Apr 15, Jun 15, Sep 15, Jan 15</p>
        </div>
        <div>
          <p className="text-[10px] text-[#8a9e96] uppercase tracking-widest mb-1">Take-Home</p>
          <p className="text-[20px] text-[#4a7c6a] tracking-tight">${Math.round(liveMonthlyNet * (1 - taxRate / 100)).toLocaleString()}<span className="text-[13px] text-[#8a9e96]">/mo</span></p>
          <p className="text-[11px] text-[#8a9e96]">${Math.round(liveMonthlyNet * (1 - taxRate / 100) * 12).toLocaleString()}/yr after {taxRate}% reserve</p>
        </div>
      </div>
    </div>
  );
}
