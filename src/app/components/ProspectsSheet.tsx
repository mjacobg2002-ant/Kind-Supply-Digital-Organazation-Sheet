import { useState } from "react";
import { Plus, X, Phone, Mail, Pencil, Check, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Prospect } from "../data/mockData";
import type { Client } from "../data/mockData";

interface Props {
  prospects: Prospect[];
  setProspects: React.Dispatch<React.SetStateAction<Prospect[]>>;
  clients: Client[];
  setClients: React.Dispatch<React.SetStateAction<Client[]>>;
}

const statusColors: Record<string, string> = {
  New: "text-[#8a9e96] bg-[#f0f4f1]",
  Called: "text-[#2d4a3e] bg-[#e2ede6]",
  Interested: "text-[#4a7c6a] bg-[#eef5f0]",
  "Proposal Sent": "text-[#c8973e] bg-[#fdf6eb]",
  Won: "text-[#3d6858] bg-[#dceee3]",
  Lost: "text-[#b86b5a] bg-[#fdf0ec]",
};

const statuses: Prospect["status"][] = ["New", "Called", "Interested", "Proposal Sent", "Won", "Lost"];

const emptyProspect: Omit<Prospect, "id"> = {
  company: "", contact: "", phone: "", email: "", industry: "",
  status: "New", estValue: 0, lastContact: "—", followUp: "", notes: "",
};

const inputClass = "px-2.5 py-2 text-[13px] border border-[#e2e8e0] rounded-md bg-white focus:outline-none focus:border-[#4a7c6a] focus:ring-1 focus:ring-[#4a7c6a]/20 transition-colors";

export function ProspectsSheet({ prospects, setProspects, clients, setClients }: Props) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Omit<Prospect, "id">>(emptyProspect);
  const [editing, setEditing] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("All");

  const pipeline = prospects.filter((p) => !["Won", "Lost"].includes(p.status)).reduce((a, p) => a + (p.estValue ?? 0), 0);
  const filtered = filter === "All" ? prospects : prospects.filter((p) => p.status === filter);

  const addProspect = () => {
    if (!draft.company.trim()) return;
    const newP = { ...draft, id: Date.now().toString() };
    setProspects((prev) => [...prev, newP]);
    setDraft(emptyProspect);
    setAdding(false);
    toast.success(`${newP.company} added to prospects`);
  };

  const updateField = (id: string, field: keyof Prospect, value: string | number) => {
    setProspects((prev) => prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)));

    // When status changes to "Won", auto-create a client from this prospect
    if (field === "status" && value === "Won") {
      const prospect = prospects.find((p) => p.id === id);
      if (prospect) {
        // Check if client already exists (by company name) to prevent duplicates
        const alreadyExists = clients.some(
          (c) => c.name.toLowerCase().trim() === prospect.company.toLowerCase().trim()
        );
        if (!alreadyExists) {
          const newClient: Client = {
            id: Date.now().toString(),
            name: prospect.company,
            industry: prospect.industry,
            contact: prospect.contact,
            email: prospect.email,
            phone: prospect.phone,
            retainer: 3500,
            adMgmt: 1500,
            adSpend: 0,
            websiteBuild: 8000,
            websiteStatus: "Not Started",
            paymentStatus: "Current",
            status: "Onboarding",
            googleAdsLink: "",
            googleAnalyticsLink: "",
            startDate: new Date().toLocaleDateString("en-US", { month: "short", year: "numeric" }),
            notes: prospect.notes ? `From prospect: ${prospect.notes}` : "",
          };
          setClients((prev) => [...prev, newClient]);
          toast.success(`${prospect.company} moved to Clients as Onboarding!`);
        } else {
          toast.info(`${prospect.company} already exists in Clients`);
        }
      }
    }
  };

  const deleteProspect = (id: string) => {
    const p = prospects.find((pr) => pr.id === id);
    setProspects((prev) => prev.filter((pr) => pr.id !== id));
    if (editing === id) setEditing(null);
    if (p) toast.success(`${p.company} removed`);
  };

  return (
    <div>
      {/* Summary */}
      <div className="flex flex-wrap items-center gap-4 md:gap-8 mb-6 pb-5 border-b border-[#e2e8e0]">
        <div>
          <p className="text-[11px] text-[#8a9e96] tracking-widest uppercase">Prospects</p>
          <p className="text-[22px] text-[#2d4a3e] tracking-tight">{prospects.length}</p>
        </div>
        <div>
          <p className="text-[11px] text-[#8a9e96] tracking-widest uppercase">Pipeline Value</p>
          <p className="text-[22px] text-[#2d4a3e] tracking-tight">${pipeline.toLocaleString()}<span className="text-[13px] text-[#8a9e96]">/mo</span></p>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="ml-auto flex items-center gap-1.5 text-[13px] text-white bg-[#4a7c6a] px-4 py-2.5 rounded-md hover:bg-[#3d6858] transition-colors shadow-sm"
        >
          <Plus size={14} /> <span className="hidden sm:inline">Add</span> Prospect
        </button>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-1 mb-4 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
        {["All", ...statuses].map((s) => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-2.5 py-1.5 rounded-md text-[12px] transition-colors whitespace-nowrap shrink-0 ${filter === s ? "bg-[#2d4a3e] text-white" : "text-[#8a9e96] hover:bg-[#eef5f0] hover:text-[#4a7c6a]"}`}>
            {s}
          </button>
        ))}
      </div>

      {/* Add Form */}
      {adding && (
        <div className="border-2 border-[#4a7c6a]/30 rounded-xl p-4 md:p-5 mb-4 bg-white shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[14px] text-[#2d4a3e]">New Prospect</span>
            <button onClick={() => { setAdding(false); setDraft(emptyProspect); }} className="p-1 text-[#8a9e96] hover:text-[#2d4a3e] transition-colors"><X size={16} /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mb-3">
            <input placeholder="Company *" value={draft.company} onChange={(e) => setDraft({ ...draft, company: e.target.value })} className={inputClass} />
            <input placeholder="Contact Name" value={draft.contact} onChange={(e) => setDraft({ ...draft, contact: e.target.value })} className={inputClass} />
            <input placeholder="Industry" value={draft.industry} onChange={(e) => setDraft({ ...draft, industry: e.target.value })} className={inputClass} />
            <input placeholder="Phone" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} className={inputClass} />
            <input placeholder="Email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} className={inputClass} />
            <div>
              <label className="text-[10px] text-[#8a9e96] uppercase tracking-widest">Est. Value/mo</label>
              <input type="number" placeholder="0" value={draft.estValue || ""} onChange={(e) => setDraft({ ...draft, estValue: +e.target.value })} className={`w-full ${inputClass}`} />
            </div>
          </div>
          <input placeholder="Follow-up Date" value={draft.followUp} onChange={(e) => setDraft({ ...draft, followUp: e.target.value })} className={`w-full mb-3 ${inputClass}`} />
          <textarea placeholder="Notes" value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} rows={2} className={`w-full resize-none mb-3 ${inputClass}`} />
          <button onClick={addProspect} className="text-[13px] text-white bg-[#4a7c6a] px-5 py-2.5 rounded-md hover:bg-[#3d6858] transition-colors shadow-sm">Add Prospect</button>
        </div>
      )}

      {/* Prospect Rows */}
      {filtered.map((p, idx) => {
        const isEditing = editing === p.id;
        return (
          <div key={p.id ?? `prospect-${idx}`} className="border border-[#e2e8e0] rounded-xl mb-2 overflow-hidden bg-white shadow-[0_1px_3px_rgba(45,74,62,0.04)]">
            {/* Desktop row */}
            <div className="hidden md:flex items-center gap-3 px-5 py-3.5">
              <select
                value={p.status}
                onChange={(e) => updateField(p.id, "status", e.target.value)}
                className={`text-[11px] px-2 py-0.5 rounded-full border-0 cursor-pointer focus:outline-none ${statusColors[p.status]}`}
              >
                {statuses.map((s) => <option key={s}>{s}</option>)}
              </select>

              <div className="flex-1 min-w-0">
                {isEditing ? (
                  <input value={p.company} onChange={(e) => updateField(p.id, "company", e.target.value)} className="text-[14px] text-[#2d4a3e] border-b border-[#e2e8e0] focus:outline-none focus:border-[#4a7c6a] bg-transparent w-full" />
                ) : (
                  <p className="text-[14px] text-[#2d4a3e] truncate">{p.company}</p>
                )}
                <p className="text-[12px] text-[#8a9e96]">{p.contact} · {p.industry}</p>
              </div>

              {isEditing ? (
                <input type="number" value={p.estValue} onChange={(e) => updateField(p.id, "estValue", +e.target.value)} className="w-20 text-[13px] text-right border-b border-[#e2e8e0] focus:outline-none focus:border-[#4a7c6a] bg-transparent" />
              ) : (
                <span className="text-[13px] text-[#2d4a3e] shrink-0">${(p.estValue ?? 0).toLocaleString()}<span className="text-[11px] text-[#8a9e96]">/mo</span></span>
              )}

              <div className="shrink-0 text-right">
                <p className="text-[10px] text-[#8a9e96] uppercase">Follow Up</p>
                {isEditing ? (
                  <input value={p.followUp} onChange={(e) => updateField(p.id, "followUp", e.target.value)} className="text-[12px] text-right border-b border-[#e2e8e0] focus:outline-none focus:border-[#4a7c6a] bg-transparent w-16" />
                ) : (
                  <p className="text-[12px] text-[#2d4a3e]">{p.followUp || "—"}</p>
                )}
              </div>

              <div className="flex items-center gap-0.5 shrink-0">
                <a href={`tel:${p.phone}`} className="p-1.5 text-[#b8c4be] hover:text-[#4a7c6a] transition-colors" title={p.phone}><Phone size={13} /></a>
                <a href={`https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(p.email)}&su=${encodeURIComponent(`Kind Supply Digital – ${p.company}`)}`} target="_blank" rel="noopener noreferrer" className="p-1.5 text-[#b8c4be] hover:text-[#4a7c6a] transition-colors" title={`Email ${p.email} via Gmail`}><Mail size={13} /></a>
                <button onClick={() => setEditing(isEditing ? null : p.id)} className={`p-1.5 transition-colors ${isEditing ? "text-[#4a7c6a]" : "text-[#b8c4be] hover:text-[#4a7c6a]"}`}>
                  {isEditing ? <Check size={13} /> : <Pencil size={13} />}
                </button>
                <button onClick={() => deleteProspect(p.id)} className="p-1.5 text-[#b8c4be] hover:text-[#b86b5a] transition-colors"><Trash2 size={13} /></button>
              </div>
            </div>

            {/* Mobile card layout */}
            <div className="md:hidden px-4 py-3">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1 min-w-0">
                  {isEditing ? (
                    <input value={p.company} onChange={(e) => updateField(p.id, "company", e.target.value)} className="text-[14px] text-[#2d4a3e] border-b border-[#e2e8e0] focus:outline-none focus:border-[#4a7c6a] bg-transparent w-full" />
                  ) : (
                    <p className="text-[14px] text-[#2d4a3e]">{p.company}</p>
                  )}
                  <p className="text-[12px] text-[#8a9e96]">{p.contact} · {p.industry}</p>
                </div>
                {isEditing ? (
                  <input type="number" value={p.estValue} onChange={(e) => updateField(p.id, "estValue", +e.target.value)} className="w-20 text-[13px] text-right border-b border-[#e2e8e0] focus:outline-none focus:border-[#4a7c6a] bg-transparent shrink-0" />
                ) : (
                  <span className="text-[13px] text-[#2d4a3e] shrink-0">${(p.estValue ?? 0).toLocaleString()}<span className="text-[11px] text-[#8a9e96]">/mo</span></span>
                )}
              </div>

              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap min-w-0">
                  <select
                    value={p.status}
                    onChange={(e) => updateField(p.id, "status", e.target.value)}
                    className={`text-[11px] px-2 py-0.5 rounded-full border-0 cursor-pointer focus:outline-none ${statusColors[p.status]}`}
                  >
                    {statuses.map((s) => <option key={s}>{s}</option>)}
                  </select>
                  {!isEditing && p.followUp && p.followUp !== "—" && (
                    <span className="text-[11px] text-[#8a9e96]">Follow up: {p.followUp}</span>
                  )}
                  {isEditing && (
                    <input value={p.followUp} onChange={(e) => updateField(p.id, "followUp", e.target.value)} placeholder="Follow up" className="text-[12px] border-b border-[#e2e8e0] focus:outline-none focus:border-[#4a7c6a] bg-transparent w-20" />
                  )}
                </div>
                <div className="flex items-center shrink-0">
                  <a href={`tel:${p.phone}`} className="p-2 text-[#b8c4be] hover:text-[#4a7c6a] transition-colors"><Phone size={16} /></a>
                  <a href={`https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(p.email)}&su=${encodeURIComponent(`Kind Supply Digital – ${p.company}`)}`} target="_blank" rel="noopener noreferrer" className="p-2 text-[#b8c4be] hover:text-[#4a7c6a] transition-colors"><Mail size={16} /></a>
                  <button onClick={() => setEditing(isEditing ? null : p.id)} className={`p-2 transition-colors ${isEditing ? "text-[#4a7c6a]" : "text-[#b8c4be] hover:text-[#4a7c6a]"}`}>
                    {isEditing ? <Check size={16} /> : <Pencil size={16} />}
                  </button>
                  <button onClick={() => deleteProspect(p.id)} className="p-2 text-[#b8c4be] hover:text-[#b86b5a] transition-colors"><Trash2 size={16} /></button>
                </div>
              </div>
            </div>

            {/* Notes Row */}
            {(isEditing || p.notes) && (
              <div className="px-4 md:px-5 pb-3 -mt-1">
                {isEditing ? (
                  <textarea value={p.notes} onChange={(e) => updateField(p.id, "notes", e.target.value)} rows={1} className={`w-full resize-none ${inputClass}`} />
                ) : (
                  <p className="text-[12px] text-[#8a9e96] italic md:pl-[70px]">{p.notes}</p>
                )}
              </div>
            )}
          </div>
        );
      })}

      {filtered.length === 0 && (
        <div className="text-center py-12 text-[14px] text-[#b8c4be]">No prospects in this view</div>
      )}
    </div>
  );
}
