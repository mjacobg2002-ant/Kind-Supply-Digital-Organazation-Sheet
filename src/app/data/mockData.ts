export interface Client {
  id: string;
  name: string;
  industry: string;
  contact: string;
  email: string;
  phone: string;
  retainer: number;
  adMgmt: number;
  adSpend: number;
  websiteBuild: number;
  websiteStatus: string;
  paymentStatus: "Current" | "Pending" | "Overdue";
  status: "Active" | "Onboarding" | "Paused";
  googleAdsLink: string;
  googleAnalyticsLink: string;
  startDate: string;
  notes: string;
}

export const initialClients: Client[] = [
  {
    id: "1",
    name: "Divine Counseling LLC",
    industry: "Mental Health Counseling",
    contact: "Dr. Angela Rivera",
    email: "angela@divinecounseling.com",
    phone: "(443) 555-0172",
    retainer: 3500,
    adMgmt: 1500,
    adSpend: 12000,
    websiteBuild: 8000,
    websiteStatus: "Complete",
    paymentStatus: "Current",
    status: "Active",
    googleAdsLink: "https://ads.google.com/aw/campaigns?ocid=0000000000",
    googleAnalyticsLink: "https://analytics.google.com/analytics/web/#/report-home/a000000",
    startDate: "Jan 2025",
    notes: "Long-term client. Expanding to group therapy marketing Q2.",
  },
  {
    id: "2",
    name: "New Beginnings Recovery",
    industry: "Substance Abuse Treatment",
    contact: "Marcus Williams",
    email: "marcus@newbeginningsrecovery.org",
    phone: "(410) 555-0298",
    retainer: 3500,
    adMgmt: 1500,
    adSpend: 8000,
    websiteBuild: 8000,
    websiteStatus: "In Progress",
    paymentStatus: "Overdue",
    status: "Active",
    googleAdsLink: "https://ads.google.com/aw/campaigns?ocid=1111111111",
    googleAnalyticsLink: "https://analytics.google.com/analytics/web/#/report-home/a111111",
    startDate: "Mar 2025",
    notes: "Website build in progress. Payment overdue — follow up.",
  },
  {
    id: "3",
    name: "Hopkins House DDA Services",
    industry: "Developmental Disabilities (DDA)",
    contact: "Theresa Hopkins",
    email: "theresa@hopkinshouse.org",
    phone: "(301) 555-0134",
    retainer: 3500,
    adMgmt: 1500,
    adSpend: 20000,
    websiteBuild: 8000,
    websiteStatus: "Complete",
    paymentStatus: "Current",
    status: "Active",
    googleAdsLink: "https://ads.google.com/aw/campaigns?ocid=2222222222",
    googleAnalyticsLink: "https://analytics.google.com/analytics/web/#/report-home/a222222",
    startDate: "Sep 2024",
    notes: "Largest client. Expanding into caregiver referral campaigns.",
  },
  {
    id: "4",
    name: "Triumph Behavioral Health",
    industry: "Behavioral Health & Wellness",
    contact: "Dr. James Foster",
    email: "jfoster@triumphbh.com",
    phone: "(202) 555-0411",
    retainer: 3500,
    adMgmt: 1500,
    adSpend: 15000,
    websiteBuild: 8000,
    websiteStatus: "Complete",
    paymentStatus: "Pending",
    status: "Active",
    googleAdsLink: "https://ads.google.com/aw/campaigns?ocid=3333333333",
    googleAnalyticsLink: "https://analytics.google.com/analytics/web/#/report-home/a333333",
    startDate: "Jun 2025",
    notes: "Patient portal just launched. Discussing expanded scope.",
  },
];

export interface Prospect {
  id: string;
  company: string;
  contact: string;
  phone: string;
  email: string;
  industry: string;
  status: "New" | "Called" | "Interested" | "Proposal Sent" | "Won" | "Lost";
  estValue: number;
  lastContact: string;
  followUp: string;
  notes: string;
}

export const initialProspects: Prospect[] = [
  { id: "p1", company: "Greenfield Mental Health", contact: "Dr. Amy Chen", phone: "(443) 555-0299", email: "amy@greenfieldmh.com", industry: "Mental Health", status: "Called", estValue: 8500, lastContact: "Mar 8", followUp: "Mar 11", notes: "Interested in website + ads. Call back Tuesday." },
  { id: "p2", company: "Apex Counseling Group", contact: "Tom Bridges", phone: "(410) 555-0344", email: "tom@apexcounseling.com", industry: "Counseling", status: "Proposal Sent", estValue: 12000, lastContact: "Mar 7", followUp: "Mar 12", notes: "Sent proposal for full growth package." },
  { id: "p3", company: "Summit Recovery Center", contact: "Robert Kim", phone: "(202) 555-0477", email: "robert@summitrecovery.org", industry: "Substance Abuse", status: "Interested", estValue: 15000, lastContact: "Mar 6", followUp: "Mar 13", notes: "Wants to move forward. Scheduling onboarding call." },
  { id: "p4", company: "Atlas DDA Services", contact: "Chris Thompson", phone: "(240) 555-0844", email: "chris@atlasdda.org", industry: "DDA", status: "New", estValue: 22000, lastContact: "—", followUp: "Mar 10", notes: "Referral from Hopkins House. Need to call." },
  { id: "p5", company: "Coastal Behavioral Health", contact: "Dr. Sarah Mills", phone: "(443) 555-0511", email: "smills@coastalbh.com", industry: "Behavioral Health", status: "Won", estValue: 7000, lastContact: "Mar 5", followUp: "—", notes: "Signed! Moving to onboarding." },
];

export interface Task {
  id: string;
  title: string;
  category: "Client" | "Prospect" | "Internal" | "Finance";
  related: string;
  due: string;
  done: boolean;
  priority: "High" | "Medium" | "Low";
}

export const initialTasks: Task[] = [
  { id: "t1", title: "Follow up on overdue payment", category: "Finance", related: "New Beginnings Recovery", due: "Mar 9", done: false, priority: "High" },
  { id: "t2", title: "Call Atlas DDA Services", category: "Prospect", related: "Atlas DDA Services", due: "Mar 10", done: false, priority: "High" },
  { id: "t3", title: "Send onboarding docs", category: "Client", related: "Coastal Behavioral Health", due: "Mar 10", done: false, priority: "High" },
  { id: "t4", title: "Review ad performance", category: "Client", related: "Divine Counseling LLC", due: "Mar 11", done: false, priority: "Medium" },
  { id: "t5", title: "Call back Dr. Amy Chen", category: "Prospect", related: "Greenfield Mental Health", due: "Mar 11", done: false, priority: "Medium" },
  { id: "t6", title: "Follow up on proposal", category: "Prospect", related: "Apex Counseling Group", due: "Mar 12", done: false, priority: "Medium" },
  { id: "t7", title: "Website QA check", category: "Client", related: "New Beginnings Recovery", due: "Mar 14", done: false, priority: "Low" },
  { id: "t8", title: "Send March invoices", category: "Finance", related: "All Clients", due: "Mar 15", done: false, priority: "Medium" },
  { id: "t9", title: "Caregiver campaign review", category: "Client", related: "Hopkins House DDA Services", due: "Mar 12", done: false, priority: "Medium" },
  { id: "t10", title: "Schedule onboarding call", category: "Prospect", related: "Summit Recovery Center", due: "Mar 13", done: false, priority: "High" },
];

// ── FINANCE ──

export interface Expense {
  id: string;
  description: string;
  category: "Software" | "Advertising" | "Contractor" | "Insurance" | "Office" | "Tax" | "Other";
  amount: number;
  month: string; // "YYYY-MM"
  recurring: boolean;
  notes: string;
}

export interface MonthlyRevenue {
  clientId: string;
  clientName: string;
  month: string; // "YYYY-MM"
  retainer: number;
  adMgmt: number;
  oneTime: number; // website builds, etc.
  oneTimeLabel: string;
  paid: boolean;
}

export const MONTHS = [
  "2024-09", "2024-10", "2024-11", "2024-12",
  "2025-01", "2025-02", "2025-03", "2025-04", "2025-05", "2025-06",
  "2025-07", "2025-08", "2025-09", "2025-10", "2025-11", "2025-12",
  "2026-01", "2026-02", "2026-03",
];

export function formatMonth(m: string) {
  const [y, mo] = m.split("-");
  const names = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${names[parseInt(mo) - 1]} ${y}`;
}

export function getMonthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function stepMonth(m: string, dir: -1 | 1): string {
  const [y, mo] = m.split("-").map(Number);
  let newMo = mo + dir;
  let newY = y;
  if (newMo > 12) { newMo = 1; newY++; }
  if (newMo < 1) { newMo = 12; newY--; }
  return getMonthKey(newY, newMo);
}

export function getMonthRange(start: string, end: string): string[] {
  const months: string[] = [];
  let current = start;
  while (current <= end) {
    months.push(current);
    current = stepMonth(current, 1);
  }
  return months;
}

// Start of data & earliest month we track
export const EARLIEST_MONTH = "2024-09";

// Pre-closed months (everything before current month Mar 2026)
export const initialClosedMonths: string[] = getMonthRange("2024-09", "2026-02");

// Recurring software presets for quick-add
export interface RecurringPreset {
  description: string;
  category: Expense["category"];
  amount: number;
  notes: string;
}

export const recurringPresets: RecurringPreset[] = [
  { description: "QuickBooks", category: "Software", amount: 57.50, notes: "" },
  { description: "PandaDoc", category: "Software", amount: 49, notes: "" },
  { description: "Gusto", category: "Software", amount: 55, notes: "" },
  { description: "Vercel", category: "Software", amount: 20, notes: "" },
  { description: "Figma", category: "Software", amount: 16, notes: "" },
  { description: "Ahrefs", category: "Software", amount: 129, notes: "" },
  { description: "Notion", category: "Software", amount: 20, notes: "" },
  { description: "ChatGPT", category: "Software", amount: 20, notes: "" },
];

// Pre-populated revenue records based on client start dates
export const initialRevenue: MonthlyRevenue[] = [
  // Hopkins House — started Sep 2024
  ...["2024-09","2024-10","2024-11","2024-12","2025-01","2025-02","2025-03","2025-04","2025-05","2025-06","2025-07","2025-08","2025-09","2025-10","2025-11","2025-12","2026-01","2026-02","2026-03"].map((m, i) => ({
    clientId: "3", clientName: "Hopkins House DDA Services", month: m,
    retainer: 3500, adMgmt: 1500,
    oneTime: m === "2024-09" ? 4000 : m === "2024-10" ? 4000 : m === "2026-03" ? 3000 : 0,
    oneTimeLabel: m === "2024-09" ? "Website deposit" : m === "2024-10" ? "Website final" : m === "2026-03" ? "Landing pages project" : "",
    paid: true,
  })),
  // Divine Counseling — started Jan 2025
  ...["2025-01","2025-02","2025-03","2025-04","2025-05","2025-06","2025-07","2025-08","2025-09","2025-10","2025-11","2025-12","2026-01","2026-02","2026-03"].map((m) => ({
    clientId: "1", clientName: "Divine Counseling LLC", month: m,
    retainer: 3500, adMgmt: 1500,
    oneTime: m === "2025-01" ? 4000 : m === "2025-02" ? 4000 : m === "2026-03" ? 3000 : 0,
    oneTimeLabel: m === "2025-01" ? "Website deposit" : m === "2025-02" ? "Website final" : m === "2026-03" ? "Q2 strategy package" : "",
    paid: true,
  })),
  // New Beginnings — started Mar 2025
  ...["2025-03","2025-04","2025-05","2025-06","2025-07","2025-08","2025-09","2025-10","2025-11","2025-12","2026-01","2026-02","2026-03"].map((m) => ({
    clientId: "2", clientName: "New Beginnings Recovery", month: m,
    retainer: 3500, adMgmt: 1500,
    oneTime: m === "2025-03" ? 4000 : m === "2025-04" ? 4000 : m === "2026-03" ? 3000 : 0,
    oneTimeLabel: m === "2025-03" ? "Website deposit" : m === "2025-04" ? "Website final" : m === "2026-03" ? "Website phase 2" : "",
    paid: true,
  })),
  // Triumph — started Jun 2025
  ...["2025-06","2025-07","2025-08","2025-09","2025-10","2025-11","2025-12","2026-01","2026-02","2026-03"].map((m) => ({
    clientId: "4", clientName: "Triumph Behavioral Health", month: m,
    retainer: 3500, adMgmt: 1500,
    oneTime: m === "2025-06" ? 4000 : m === "2025-07" ? 4000 : m === "2026-03" ? 3000 : 0,
    oneTimeLabel: m === "2025-06" ? "Website deposit" : m === "2025-07" ? "Website final" : m === "2026-03" ? "Campaign launch package" : "",
    paid: true,
  })),
];

export const initialExpenses: Expense[] = [
  // Recurring monthly expenses
  { id: "e1", description: "QuickBooks", category: "Software", amount: 57.50, month: "2026-03", recurring: true, notes: "" },
  { id: "e2", description: "PandaDoc", category: "Software", amount: 49, month: "2026-03", recurring: true, notes: "" },
  { id: "e3", description: "Gusto", category: "Software", amount: 55, month: "2026-03", recurring: true, notes: "" },
  { id: "e4", description: "Vercel", category: "Software", amount: 20, month: "2026-03", recurring: true, notes: "" },
  { id: "e5", description: "Figma", category: "Software", amount: 16, month: "2026-03", recurring: true, notes: "" },
  { id: "e6", description: "Ahrefs", category: "Software", amount: 129, month: "2026-03", recurring: true, notes: "" },
  { id: "e7", description: "Notion", category: "Software", amount: 20, month: "2026-03", recurring: true, notes: "" },
  { id: "e8", description: "ChatGPT", category: "Software", amount: 20, month: "2026-03", recurring: true, notes: "" },
  // Some non-recurring
  { id: "e9", description: "Facebook Ads (own biz)", category: "Advertising", amount: 500, month: "2026-02", recurring: false, notes: "Lead gen campaign" },
  { id: "e10", description: "Google Ads (own biz)", category: "Advertising", amount: 300, month: "2026-02", recurring: false, notes: "Brand awareness" },
  { id: "e11", description: "Contract copywriter", category: "Contractor", amount: 750, month: "2026-01", recurring: false, notes: "Blog content for 2 clients" },
  { id: "e12", description: "Q4 2025 estimated tax", category: "Tax", amount: 4500, month: "2025-12", recurring: false, notes: "" },
  { id: "e13", description: "Domain renewals (4 clients)", category: "Software", amount: 60, month: "2025-12", recurring: false, notes: "" },
];