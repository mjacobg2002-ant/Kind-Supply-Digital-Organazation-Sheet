import { useState, useMemo } from "react";
import { Plus, X, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Task } from "../data/mockData";
import type { Client, Prospect } from "../data/mockData";

interface Props {
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  clients: Client[];
  prospects: Prospect[];
}

const categories: Task["category"][] = ["Client", "Prospect", "Internal", "Finance"];
const priorities: Task["priority"][] = ["High", "Medium", "Low"];

const priorityColor: Record<string, string> = {
  High: "text-[#b86b5a]",
  Medium: "text-[#c8973e]",
  Low: "text-[#8a9e96]",
};

const categoryColor: Record<string, string> = {
  Client: "text-[#4a7c6a] bg-[#eef5f0]",
  Prospect: "text-[#c8973e] bg-[#fdf6eb]",
  Internal: "text-[#8a9e96] bg-[#f0f4f1]",
  Finance: "text-[#6b7f97] bg-[#eef2f7]",
};

const emptyTask: Omit<Task, "id"> = {
  title: "", category: "Client", related: "", due: "", done: false, priority: "Medium",
};

const inputClass = "px-2.5 py-2 text-[13px] border border-[#e2e8e0] rounded-md bg-white focus:outline-none focus:border-[#4a7c6a] focus:ring-1 focus:ring-[#4a7c6a]/20 transition-colors";

export function TasksSheet({ tasks, setTasks, clients, prospects }: Props) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Omit<Task, "id">>(emptyTask);
  const [filter, setFilter] = useState<string>("All");
  const [hideCompleted, setHideCompleted] = useState(false);

  // Build dynamic list of related names from clients + prospects
  const relatedOptions = useMemo(() => {
    const names: string[] = [];
    clients.forEach((c) => { if (c.name) names.push(c.name); });
    prospects.forEach((p) => { if (p.company) names.push(p.company); });
    // Deduplicate
    return [...new Set(names)].sort();
  }, [clients, prospects]);

  const remaining = tasks.filter((t) => !t.done).length;
  const highPriority = tasks.filter((t) => !t.done && t.priority === "High").length;

  let filtered = filter === "All" ? tasks : tasks.filter((t) => t.category === filter);
  if (hideCompleted) filtered = filtered.filter((t) => !t.done);

  const toggleDone = (id: string) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
    const task = tasks.find((t) => t.id === id);
    if (task) toast.success(task.done ? `"${task.title}" reopened` : `"${task.title}" completed`);
  };

  const deleteTask = (id: string) => {
    const task = tasks.find((t) => t.id === id);
    setTasks((prev) => prev.filter((t) => t.id !== id));
    if (task) toast.success(`Task removed`);
  };

  const addTask = () => {
    if (!draft.title.trim()) return;
    setTasks((prev) => [...prev, { ...draft, id: Date.now().toString() }]);
    setDraft(emptyTask);
    setAdding(false);
    toast.success("Task added");
  };

  const updateField = (id: string, field: keyof Task, value: string | boolean) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, [field]: value } : t)));
  };

  return (
    <div>
      {/* Summary */}
      <div className="flex flex-wrap items-center gap-4 md:gap-8 mb-6 pb-5 border-b border-[#e2e8e0]">
        <div>
          <p className="text-[11px] text-[#8a9e96] tracking-widest uppercase">Open Tasks</p>
          <p className="text-[22px] text-[#2d4a3e] tracking-tight">{remaining}</p>
        </div>
        <div>
          <p className="text-[11px] text-[#8a9e96] tracking-widest uppercase">High Priority</p>
          <p className="text-[22px] text-[#b86b5a] tracking-tight">{highPriority}</p>
        </div>
        <div className="ml-auto flex items-center gap-3 md:gap-4">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={hideCompleted} onChange={(e) => setHideCompleted(e.target.checked)} className="accent-[#4a7c6a] w-3.5 h-3.5" />
            <span className="text-[12px] text-[#8a9e96]">Hide done</span>
          </label>
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 text-[13px] text-white bg-[#4a7c6a] px-3 md:px-4 py-2 rounded-md hover:bg-[#3d6858] transition-colors shadow-sm"
          >
            <Plus size={14} /> <span className="hidden sm:inline">Add</span> Task
          </button>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-1 mb-4 overflow-x-auto pb-1 -mx-1 px-1">
        {["All", ...categories].map((c) => (
          <button key={c} onClick={() => setFilter(c)}
            className={`px-2.5 py-1 rounded-md text-[12px] transition-colors whitespace-nowrap shrink-0 ${filter === c ? "bg-[#2d4a3e] text-white" : "text-[#8a9e96] hover:bg-[#eef5f0] hover:text-[#4a7c6a]"}`}>
            {c}
          </button>
        ))}
      </div>

      {/* Add Task */}
      {adding && (
        <div className="border-2 border-[#4a7c6a]/30 rounded-xl p-4 mb-4 bg-white shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[14px] text-[#2d4a3e]">New Task</span>
            <button onClick={() => { setAdding(false); setDraft(emptyTask); }} className="text-[#8a9e96] hover:text-[#2d4a3e] transition-colors"><X size={14} /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <input placeholder="Task title *" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className={`sm:col-span-2 ${inputClass}`} />
            <select value={draft.related} onChange={(e) => setDraft({ ...draft, related: e.target.value })} className={inputClass}>
              <option value="">Related to (client/prospect)</option>
              {relatedOptions.map((name) => <option key={name}>{name}</option>)}
            </select>
            <input placeholder="Due date" value={draft.due} onChange={(e) => setDraft({ ...draft, due: e.target.value })} className={inputClass} />
            <select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value as Task["category"] })} className={inputClass}>
              {categories.map((c) => <option key={c}>{c}</option>)}
            </select>
            <select value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: e.target.value as Task["priority"] })} className={inputClass}>
              {priorities.map((p) => <option key={p}>{p}</option>)}
            </select>
          </div>
          <button onClick={addTask} className="text-[13px] text-white bg-[#4a7c6a] px-5 py-2 rounded-md hover:bg-[#3d6858] transition-colors shadow-sm">Add Task</button>
        </div>
      )}

      {/* Task List — Desktop */}
      <div className="hidden md:block border border-[#e2e8e0] rounded-xl overflow-hidden bg-white shadow-[0_1px_3px_rgba(45,74,62,0.04)]">
        {filtered.map((t, i) => (
          <div key={t.id} className={`flex items-center gap-3 px-4 py-3 group transition-colors hover:bg-[#f9fbf9] ${i !== 0 ? "border-t border-[#e2e8e0]" : ""} ${t.done ? "opacity-45" : ""}`}>
            <button onClick={() => toggleDone(t.id)} className={`w-[18px] h-[18px] rounded-md border-[1.5px] flex items-center justify-center shrink-0 transition-all ${t.done ? "bg-[#4a7c6a] border-[#4a7c6a] text-white" : "border-[#c8d4cd] hover:border-[#4a7c6a]"}`}>
              {t.done && <span className="text-[10px]">✓</span>}
            </button>
            <select
              value={t.priority}
              onChange={(e) => updateField(t.id, "priority", e.target.value)}
              className={`text-[10px] uppercase tracking-widest bg-transparent border-0 cursor-pointer focus:outline-none w-14 ${priorityColor[t.priority]}`}
            >
              {priorities.map((p) => <option key={p}>{p}</option>)}
            </select>
            <div className="flex-1 min-w-0">
              <p className={`text-[13px] truncate ${t.done ? "line-through text-[#8a9e96]" : "text-[#2d4a3e]"}`}>{t.title}</p>
            </div>
            <span className={`text-[10px] px-2 py-0.5 rounded-full shrink-0 ${categoryColor[t.category]}`}>{t.category}</span>
            <span className="text-[12px] text-[#8a9e96] shrink-0 w-[160px] text-right truncate">{t.related}</span>
            <span className="text-[12px] text-[#8a9e96] shrink-0 w-14 text-right">{t.due}</span>
            <button onClick={() => deleteTask(t.id)} className="p-1 text-[#c8d4cd] hover:text-[#b86b5a] opacity-0 group-hover:opacity-100 transition-all shrink-0">
              <Trash2 size={12} />
            </button>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-[14px] text-[#b8c4be]">No tasks</div>
        )}
      </div>

      {/* Task List — Mobile */}
      <div className="md:hidden space-y-2">
        {filtered.map((t) => (
          <div key={t.id} className={`border border-[#e2e8e0] rounded-xl bg-white shadow-[0_1px_3px_rgba(45,74,62,0.04)] px-4 py-3 ${t.done ? "opacity-45" : ""}`}>
            <div className="flex items-start gap-3">
              <button onClick={() => toggleDone(t.id)} className={`w-[20px] h-[20px] rounded-md border-[1.5px] flex items-center justify-center shrink-0 mt-0.5 transition-all ${t.done ? "bg-[#4a7c6a] border-[#4a7c6a] text-white" : "border-[#c8d4cd]"}`}>
                {t.done && <span className="text-[11px]">✓</span>}
              </button>
              <div className="flex-1 min-w-0">
                <p className={`text-[14px] ${t.done ? "line-through text-[#8a9e96]" : "text-[#2d4a3e]"}`}>{t.title}</p>
                <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                  <select
                    value={t.priority}
                    onChange={(e) => updateField(t.id, "priority", e.target.value)}
                    className={`text-[10px] uppercase tracking-widest bg-transparent border-0 cursor-pointer focus:outline-none ${priorityColor[t.priority]}`}
                  >
                    {priorities.map((p) => <option key={p}>{p}</option>)}
                  </select>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${categoryColor[t.category]}`}>{t.category}</span>
                  {t.related && <span className="text-[11px] text-[#8a9e96]">· {t.related}</span>}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-[11px] text-[#8a9e96]">{t.due}</span>
                <button onClick={() => deleteTask(t.id)} className="p-1.5 text-[#c8d4cd] hover:text-[#b86b5a] transition-colors">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-[14px] text-[#b8c4be]">No tasks</div>
        )}
      </div>
    </div>
  );
}
