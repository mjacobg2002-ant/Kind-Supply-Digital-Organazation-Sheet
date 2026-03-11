import { useState } from "react";
import { ExternalLink, Plus, X, ChevronDown, ChevronUp, Pencil, Check, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import type { Client } from "../data/mockData";

interface Props {
  clients: Client[];
  setClients: React.Dispatch<React.SetStateAction<Client[]>>;
}

const emptyClient: Omit<Client, "id"> = {
  name: "", industry: "", contact: "", email: "", phone: "",
  retainer: 3500, adMgmt: 1500, adSpend: 0, websiteBuild: 8000,
  websiteStatus: "Not Started", paymentStatus: "Current", status: "Onboarding",
  googleAdsLink: "", googleAnalyticsLink: "", startDate: "", notes: "",
};

const n = (v: any): number => (typeof v === "number" && !isNaN(v) ? v : 0);

export function ClientsSheet({ clients, setClients }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Omit<Client, "id">>(emptyClient);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const totalMRR = clients.reduce((a, c) => a + n(c.retainer) + n(c.adMgmt), 0);
  const totalAdSpend = clients.reduce((a, c) => a + n(c.adSpend), 0);

  const updateField = (id: string, field: keyof Client, value: string | number) => {
    setClients((prev) => prev.map((c) => (c.id === id ? { ...c, [field]: value } : c)));
  };

  const addClient = () => {
    if (!draft.name.trim()) return;
    const newClient: Client = { ...draft, id: Date.now().toString() };
    setClients((prev) => [...prev, newClient]);
    setDraft(emptyClient);
    setAdding(false);
    toast.success(`${newClient.name} added`);
  };

  const deleteClient = (id: string) => {
    const client = clients.find((c) => c.id === id);
    setClients((prev) => prev.filter((c) => c.id !== id));
    if (expanded === id) setExpanded(null);
    if (editing === id) setEditing(null);
    setConfirmDelete(null);
    if (client) toast.success(`${client.name} removed`);
  };

  const inputClass = "px-2.5 py-2 text-[13px] border border-[#e2e8e0] rounded-md bg-white focus:outline-none focus:border-[#4a7c6a] focus:ring-1 focus:ring-[#4a7c6a]/20 transition-colors";

  return (
    <div>
      {/* Summary */}
      <div className="flex flex-wrap items-center gap-4 md:gap-8 mb-6 pb-5 border-b border-[#e2e8e0]">
        <div>
          <p className="text-[11px] text-[#8a9e96] tracking-widest uppercase">Clients</p>
          <p className="text-[22px] text-[#2d4a3e] tracking-tight">{clients.length}</p>
        </div>
        <div>
          <p className="text-[11px] text-[#8a9e96] tracking-widest uppercase">Monthly Revenue</p>
          <p className="text-[22px] text-[#2d4a3e] tracking-tight">${totalMRR.toLocaleString()}</p>
        </div>
        <div className="hidden sm:block">
          <p className="text-[11px] text-[#8a9e96] tracking-widest uppercase">Ad Spend Managed</p>
          <p className="text-[22px] text-[#2d4a3e] tracking-tight">${totalAdSpend.toLocaleString()}</p>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="ml-auto flex items-center gap-1.5 text-[13px] text-white bg-[#4a7c6a] px-4 py-2.5 rounded-md hover:bg-[#3d6858] transition-colors shadow-sm"
        >
          <Plus size={14} /> <span className="hidden sm:inline">Add</span> Client
        </button>
      </div>

      {/* Add Client Form */}
      {adding && (
        <div className="border-2 border-[#4a7c6a]/30 rounded-xl p-4 md:p-5 mb-4 bg-white shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[14px] text-[#2d4a3e]">New Client</span>
            <button onClick={() => { setAdding(false); setDraft(emptyClient); }} className="p-1 text-[#8a9e96] hover:text-[#2d4a3e] transition-colors"><X size={16} /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mb-3">
            <input placeholder="Company Name *" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={inputClass} />
            <input placeholder="Industry" value={draft.industry} onChange={(e) => setDraft({ ...draft, industry: e.target.value })} className={inputClass} />
            <input placeholder="Contact Name" value={draft.contact} onChange={(e) => setDraft({ ...draft, contact: e.target.value })} className={inputClass} />
            <input placeholder="Email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} className={inputClass} />
            <input placeholder="Phone" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} className={inputClass} />
            <input placeholder="Start Date" value={draft.startDate} onChange={(e) => setDraft({ ...draft, startDate: e.target.value })} className={inputClass} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            <div>
              <label className="text-[10px] text-[#8a9e96] uppercase tracking-widest">Retainer/mo</label>
              <input type="number" value={draft.retainer} onChange={(e) => setDraft({ ...draft, retainer: +e.target.value })} className={`w-full ${inputClass}`} />
            </div>
            <div>
              <label className="text-[10px] text-[#8a9e96] uppercase tracking-widest">Ad Mgmt/mo</label>
              <input type="number" value={draft.adMgmt} onChange={(e) => setDraft({ ...draft, adMgmt: +e.target.value })} className={`w-full ${inputClass}`} />
            </div>
            <div>
              <label className="text-[10px] text-[#8a9e96] uppercase tracking-widest">Ad Spend/mo</label>
              <input type="number" value={draft.adSpend} onChange={(e) => setDraft({ ...draft, adSpend: +e.target.value })} className={`w-full ${inputClass}`} />
            </div>
            <div>
              <label className="text-[10px] text-[#8a9e96] uppercase tracking-widest">Website Build</label>
              <input type="number" value={draft.websiteBuild} onChange={(e) => setDraft({ ...draft, websiteBuild: +e.target.value })} className={`w-full ${inputClass}`} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <input placeholder="Google Ads Link" value={draft.googleAdsLink} onChange={(e) => setDraft({ ...draft, googleAdsLink: e.target.value })} className={inputClass} />
            <input placeholder="Google Analytics Link" value={draft.googleAnalyticsLink} onChange={(e) => setDraft({ ...draft, googleAnalyticsLink: e.target.value })} className={inputClass} />
          </div>
          <textarea placeholder="Notes" value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} rows={2} className={`w-full resize-none mb-3 ${inputClass}`} />
          <button onClick={addClient} className="text-[13px] text-white bg-[#4a7c6a] px-5 py-2.5 rounded-md hover:bg-[#3d6858] transition-colors shadow-sm">Add Client</button>
        </div>
      )}

      {/* Client Rows */}
      {clients.map((c) => {
        const isExpanded = expanded === c.id;
        const isEditing = editing === c.id;
        const monthly = n(c.retainer) + n(c.adMgmt);
        const isConfirmingDelete = confirmDelete === c.id;

        return (
          <div key={c.id} className="border border-[#e2e8e0] rounded-xl mb-2 overflow-hidden bg-white shadow-[0_1px_3px_rgba(45,74,62,0.04)]">
            {/* Row Header */}
            <div
              className="flex items-center gap-3 md:gap-4 px-4 md:px-5 py-3.5 cursor-pointer hover:bg-[#f5f8f5] transition-colors"
              onClick={() => setExpanded(isExpanded ? null : c.id)}
            >
              <div className={`w-2 h-2 rounded-full shrink-0 ${
                c.status === "Active" ? "bg-[#4a7c6a]" : c.status === "Onboarding" ? "bg-[#c8973e]" : "bg-[#b8c4be]"
              }`} />
              <div className="flex-1 min-w-0">
                <p className="text-[14px] text-[#2d4a3e] truncate">{c.name}</p>
                <p className="text-[12px] text-[#8a9e96]">{c.industry}</p>
              </div>
              <span className="text-[13px] text-[#2d4a3e] shrink-0">${monthly.toLocaleString()}<span className="text-[11px] text-[#8a9e96]">/mo</span></span>
              <span className={`text-[11px] px-2 py-0.5 rounded-full shrink-0 hidden sm:inline ${
                c.paymentStatus === "Current" ? "text-[#4a7c6a] bg-[#eef5f0]" :
                c.paymentStatus === "Pending" ? "text-[#c8973e] bg-[#fdf6eb]" : "text-[#b86b5a] bg-[#fdf0ec]"
              }`}>{c.paymentStatus}</span>
              <span className="text-[11px] text-[#8a9e96] shrink-0 hidden md:inline">{c.status}</span>
              <div className="flex items-center gap-1 shrink-0">
                {c.googleAdsLink && (
                  <a href={c.googleAdsLink} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-[#b8c4be] hover:text-[#4a7c6a] p-1 transition-colors hidden sm:block" title="Google Ads">
                    <ExternalLink size={12} />
                  </a>
                )}
                {isExpanded ? <ChevronUp size={14} className="text-[#8a9e96]" /> : <ChevronDown size={14} className="text-[#8a9e96]" />}
              </div>
            </div>

            {/* Expanded Detail */}
            {isExpanded && (
              <div className="px-4 md:px-5 pb-4 pt-1 border-t border-[#e2e8e0] bg-[#f9fbf9]">
                {/* Mobile badges */}
                <div className="flex sm:hidden items-center gap-2 mb-2 mt-1">
                  <span className={`text-[11px] px-2 py-0.5 rounded-full ${
                    c.paymentStatus === "Current" ? "text-[#4a7c6a] bg-[#eef5f0]" :
                    c.paymentStatus === "Pending" ? "text-[#c8973e] bg-[#fdf6eb]" : "text-[#b86b5a] bg-[#fdf0ec]"
                  }`}>{c.paymentStatus}</span>
                  <span className="text-[11px] text-[#8a9e96] bg-[#f0f4f1] px-2 py-0.5 rounded-full">{c.status}</span>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <button
                    onClick={() => setEditing(isEditing ? null : c.id)}
                    className={`flex items-center gap-1 text-[12px] px-3 py-1.5 rounded-md transition-colors ${isEditing ? "bg-[#4a7c6a] text-white" : "text-[#8a9e96] hover:bg-[#eef5f0] hover:text-[#4a7c6a]"}`}
                  >
                    {isEditing ? <><Check size={11} /> Done</> : <><Pencil size={11} /> Edit</>}
                  </button>
                  <button onClick={() => setConfirmDelete(isConfirmingDelete ? null : c.id)} className="flex items-center gap-1 text-[12px] text-[#b86b5a] hover:bg-[#fdf0ec] px-3 py-1.5 rounded-md transition-colors">
                    <Trash2 size={11} /> Delete
                  </button>
                  {c.googleAdsLink && (
                    <a href={c.googleAdsLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[12px] text-[#8a9e96] hover:text-[#4a7c6a] px-3 py-1.5 rounded-md hover:bg-[#eef5f0] transition-colors sm:ml-auto">
                      <ExternalLink size={11} /> Google Ads
                    </a>
                  )}
                  {c.googleAnalyticsLink && (
                    <a href={c.googleAnalyticsLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[12px] text-[#8a9e96] hover:text-[#4a7c6a] px-3 py-1.5 rounded-md hover:bg-[#eef5f0] transition-colors">
                      <ExternalLink size={11} /> Analytics
                    </a>
                  )}
                </div>

                {/* Delete Confirmation */}
                {isConfirmingDelete && (
                  <div className="flex items-center gap-3 bg-[#fdf0ec] border border-[#b86b5a]/20 rounded-lg px-4 py-3 mb-3">
                    <AlertTriangle size={16} className="text-[#b86b5a] shrink-0" />
                    <p className="text-[13px] text-[#2d4a3e] flex-1">Delete <strong>{c.name}</strong>? This will also remove their revenue records.</p>
                    <button onClick={() => deleteClient(c.id)} className="text-[12px] text-white bg-[#b86b5a] px-3 py-1.5 rounded-md hover:bg-[#a55a4a] transition-colors shrink-0">Delete</button>
                    <button onClick={() => setConfirmDelete(null)} className="text-[12px] text-[#8a9e96] hover:text-[#2d4a3e] px-2 py-1.5 transition-colors shrink-0">Cancel</button>
                  </div>
                )}

                {/* Detail Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-4 md:gap-x-8 gap-y-2 text-[13px]">
                  {([
                    ["Contact", "contact"],
                    ["Email", "email"],
                    ["Phone", "phone"],
                    ["Start Date", "startDate"],
                    ["Retainer/mo", "retainer"],
                    ["Ad Mgmt/mo", "adMgmt"],
                    ["Client Ad Spend/mo", "adSpend"],
                    ["Website Build", "websiteBuild"],
                    ["Website Status", "websiteStatus"],
                    ["Payment Status", "paymentStatus"],
                    ["Status", "status"],
                    ["Google Ads Link", "googleAdsLink"],
                  ] as const).map(([label, field]) => (
                    <div key={field} className="flex flex-col py-1">
                      <span className="text-[10px] text-[#8a9e96] uppercase tracking-widest mb-0.5">{label}</span>
                      {isEditing ? (
                        field === "paymentStatus" ? (
                          <select
                            value={c[field]}
                            onChange={(e) => updateField(c.id, field, e.target.value)}
                            className={`${inputClass} bg-white`}
                          >
                            <option>Current</option><option>Pending</option><option>Overdue</option>
                          </select>
                        ) : field === "status" ? (
                          <select
                            value={c[field]}
                            onChange={(e) => updateField(c.id, field, e.target.value)}
                            className={`${inputClass} bg-white`}
                          >
                            <option>Active</option><option>Onboarding</option><option>Paused</option>
                          </select>
                        ) : (
                          <input
                            type={typeof c[field] === "number" ? "number" : "text"}
                            value={c[field]}
                            onChange={(e) => updateField(c.id, field, typeof c[field] === "number" ? +e.target.value : e.target.value)}
                            className={inputClass}
                          />
                        )
                      ) : (
                        <span className="text-[#2d4a3e] break-all">
                          {typeof c[field] === "number" ? `$${(c[field] as number).toLocaleString()}` : c[field] || "—"}
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                <div className="mt-3 pt-2 border-t border-[#e2e8e0]">
                  <span className="text-[10px] text-[#8a9e96] uppercase tracking-widest">Notes</span>
                  {isEditing ? (
                    <textarea value={c.notes} onChange={(e) => updateField(c.id, "notes", e.target.value)} rows={2} className={`w-full mt-1 resize-none ${inputClass}`} />
                  ) : (
                    <p className="text-[13px] text-[#5a7a6e] mt-0.5">{c.notes || "—"}</p>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {clients.length === 0 && (
        <div className="text-center py-16">
          <p className="text-[14px] text-[#b8c4be] mb-2">No clients yet</p>
          <button onClick={() => setAdding(true)} className="text-[13px] text-[#4a7c6a] hover:underline">Add your first client</button>
        </div>
      )}
    </div>
  );
}