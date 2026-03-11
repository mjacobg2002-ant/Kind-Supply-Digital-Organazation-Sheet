import { useState } from "react";
import {
  ChevronDown, ChevronUp, Clock, Users, CreditCard, Globe, Megaphone,
  BarChart3, PhoneCall, UserPlus, FileText, AlertTriangle, Settings,
  DollarSign, Search, CheckCircle2, ArrowRightLeft
} from "lucide-react";

interface SOPStep {
  text: string;
  detail?: string;
}

interface SOP {
  id: string;
  title: string;
  icon: typeof Clock;
  category: "Sales" | "Onboarding" | "Delivery" | "Operations" | "Finance";
  description: string;
  owner: string;
  frequency: string;
  timeEstimate: string;
  steps: SOPStep[];
  tools?: string[];
  tips?: string[];
}

const categoryColor: Record<string, string> = {
  Sales: "text-[#c8973e] bg-[#fdf6eb]",
  Onboarding: "text-[#4a7c6a] bg-[#eef5f0]",
  Delivery: "text-[#2d4a3e] bg-[#e2ede6]",
  Operations: "text-[#6b7f97] bg-[#eef2f7]",
  Finance: "text-[#b86b5a] bg-[#fdf0ec]",
};

const allCategories = ["All", "Sales", "Onboarding", "Delivery", "Operations", "Finance"];

const sops: SOP[] = [
  // ── SALES ──
  {
    id: "sop-1",
    title: "Inbound Lead Response",
    icon: PhoneCall,
    category: "Sales",
    description: "How to handle new inbound leads from website forms, referrals, or cold inquiries within 24 hours.",
    owner: "You (Founder)",
    frequency: "As leads come in",
    timeEstimate: "15–30 min per lead",
    steps: [
      { text: "Lead comes in via website form, referral, or direct inquiry" },
      { text: "Add to Prospects tab immediately with status \"New\"", detail: "Include company name, contact, phone, email, industry, and source of lead." },
      { text: "Research the prospect (10 min max)", detail: "Check their website, Google presence, current ads, and reviews. Note 2-3 pain points you can solve." },
      { text: "Make initial contact within 4 hours", detail: "Call first, then email if no answer. Text is acceptable for referrals." },
      { text: "Update prospect status to \"Called\" and log notes", detail: "Record what was discussed, their pain points, budget expectations, and timeline." },
      { text: "If interested, schedule a discovery call within 48 hours" },
      { text: "Send calendar invite + pre-call questionnaire", detail: "Ask about current marketing, goals, target audience, and budget range." },
      { text: "Set follow-up date in Prospects tab" },
    ],
    tools: ["Prospects Tab", "Google (research)", "Phone", "Calendar"],
    tips: [
      "Speed to lead matters — respond within 4 hours for 10x better conversion",
      "Mental health providers value trust — lead with empathy, not sales tactics",
      "Always ask 'How did you hear about us?' for referral tracking",
    ],
  },
  {
    id: "sop-2",
    title: "Discovery Call & Proposal",
    icon: Users,
    category: "Sales",
    description: "Running the discovery call, qualifying the prospect, and sending a proposal within 48 hours.",
    owner: "You (Founder)",
    frequency: "Per qualified lead",
    timeEstimate: "1–2 hours total",
    steps: [
      { text: "Review prospect research notes before the call" },
      { text: "Discovery call structure (30–45 min):", detail: "1) Build rapport (5 min)\n2) Understand their current situation (10 min)\n3) Identify pain points & goals (10 min)\n4) Present Kind Supply's approach (10 min)\n5) Discuss pricing & timeline (5 min)\n6) Agree on next steps (5 min)" },
      { text: "Qualify the prospect", detail: "Do they have budget ($4,500+/mo minimum)? Decision-making authority? Realistic timeline? Genuine need for digital marketing?" },
      { text: "Update prospect status to \"Interested\" if qualified" },
      { text: "Build custom proposal within 48 hours", detail: "Include: their specific pain points, your recommended strategy, deliverables breakdown, pricing (website build ~$8K one-time, retainer $4,500–$5,000/mo, ad mgmt $1,500–$2,000/mo + their ad spend), timeline, and 2-3 case study references." },
      { text: "Send proposal via email with a personal video walkthrough", detail: "Record a 3-5 min Loom walking through the proposal. This dramatically increases close rates." },
      { text: "Update status to \"Proposal Sent\" and set follow-up for 3 days" },
      { text: "Follow up: Day 3 (email), Day 5 (call), Day 10 (final check-in)" },
    ],
    tools: ["Zoom/Google Meet", "Proposal template", "Loom", "Calendar"],
    tips: [
      "Listen 70%, talk 30% on discovery calls",
      "Never discount — add value instead (extra month of reporting, audit, etc.)",
      "DDA and substance abuse clients often need compliance-aware messaging — mention this as a differentiator",
    ],
  },
  {
    id: "sop-3",
    title: "Prospect → Client Conversion",
    icon: ArrowRightLeft,
    category: "Sales",
    description: "What happens when a prospect says yes — contract, payment, and transition to onboarding.",
    owner: "You (Founder)",
    frequency: "Per closed deal",
    timeEstimate: "1–2 hours",
    steps: [
      { text: "Verbal agreement received — send contract same day", detail: "Include: scope of work, deliverables, pricing, payment terms (Net 15), cancellation policy (30-day notice), and compliance disclaimers for healthcare marketing." },
      { text: "Collect signed contract via DocuSign or PandaDoc" },
      { text: "Send first invoice: website build deposit (50%) + first month retainer", detail: "Use QuickBooks or Stripe invoicing. Payment due within 7 days before work begins." },
      { text: "Update Prospects tab: change status to \"Won\"" },
      { text: "Create new entry in Clients tab with all details", detail: "Transfer: company, contact, email, phone, industry, pricing, start date, and any notes from the sales process." },
      { text: "Create onboarding tasks in Tasks tab", detail: "See 'New Client Onboarding' SOP for the full task list." },
      { text: "Send welcome email with onboarding timeline and what to expect" },
      { text: "Schedule kickoff call within 5 business days" },
    ],
    tools: ["Contract/DocuSign", "QuickBooks/Stripe", "Clients Tab", "Tasks Tab", "Email"],
    tips: [
      "Get payment before starting ANY work — no exceptions",
      "Set expectations early: 'The first 30 days are about building the foundation'",
      "Celebrate the win internally — track your close rate over time",
    ],
  },

  // ── ONBOARDING ──
  {
    id: "sop-4",
    title: "New Client Onboarding",
    icon: UserPlus,
    category: "Onboarding",
    description: "The complete 14-day onboarding checklist from signed contract to active delivery.",
    owner: "You (Founder)",
    frequency: "Per new client",
    timeEstimate: "~8 hours over 14 days",
    steps: [
      { text: "Day 1: Send welcome packet", detail: "Includes: welcome letter, onboarding timeline, brand questionnaire, access request list (Google accounts, social media, hosting), and communication expectations." },
      { text: "Day 1: Create client folder in Google Drive", detail: "Subfolders: /Brand Assets, /Website, /Ads, /Reports, /Contracts & Invoices" },
      { text: "Day 1-2: Collect all access credentials", detail: "Google Ads account access, Google Analytics access, Google Business Profile, website hosting/CMS login, social media accounts, any existing brand assets (logos, fonts, colors)." },
      { text: "Day 2-3: Kickoff call (60 min)", detail: "Agenda: introductions, review goals & KPIs, discuss target audience personas, review competitive landscape, align on messaging/tone, set communication cadence (weekly email + bi-weekly call)." },
      { text: "Day 3-5: Complete marketing audit", detail: "Audit their current website (UX, speed, SEO), Google Ads history, Google Business Profile, online reviews, competitor presence, and local SEO standings." },
      { text: "Day 5-7: Present audit findings + strategy roadmap", detail: "Share a simple deck: where they are → where they need to be → how we'll get there. Include 30/60/90 day milestones." },
      { text: "Day 7-10: Begin website build or ad setup", detail: "If website: start wireframes. If ads only: build campaign structure, keyword research, ad copy drafts." },
      { text: "Day 10-14: First deliverable review with client", detail: "Present wireframes or initial ad drafts. Get feedback. Set revision timeline." },
      { text: "Day 14: Update client status from \"Onboarding\" to \"Active\"" },
      { text: "Day 14: Schedule recurring check-in cadence" },
    ],
    tools: ["Google Drive", "Brand Questionnaire Template", "Audit Template", "Zoom", "Clients Tab"],
    tips: [
      "Over-communicate in the first 2 weeks — it builds massive trust",
      "For mental health clients, be extra sensitive about patient privacy in all marketing materials",
      "DDA providers often have specific Medicaid/state compliance requirements — ask about these early",
    ],
  },
  {
    id: "sop-5",
    title: "Google Ads Account Setup",
    icon: Megaphone,
    category: "Onboarding",
    description: "Setting up a new Google Ads account or restructuring an existing one for a new client.",
    owner: "You (Founder)",
    frequency: "Per new client",
    timeEstimate: "3–5 hours",
    steps: [
      { text: "Get Manager Account (MCC) access to their Google Ads", detail: "Send invite from your MCC. If they don't have an account, create one under their business email." },
      { text: "Set up conversion tracking", detail: "Install Google Tag via GTM or direct. Track: form submissions, phone calls (use call tracking number), appointment bookings, and direction requests." },
      { text: "Link Google Analytics 4 property" },
      { text: "Keyword research (1-2 hours)", detail: "Use Google Keyword Planner + SEMrush. Focus on: service-specific terms (e.g., 'substance abuse treatment near me'), location modifiers, insurance-related queries, and long-tail questions." },
      { text: "Build campaign structure", detail: "Recommended structure:\n• Campaign 1: Brand (low budget, high intent)\n• Campaign 2: Core Services (main budget)\n• Campaign 3: Location-based\n• Campaign 4: Competitor (if applicable)" },
      { text: "Write ad copy (3-5 responsive search ads per ad group)", detail: "Include: unique value props, call-to-action, location, insurance accepted, accreditations. For healthcare: avoid guarantees, use 'may help' language." },
      { text: "Set up ad extensions", detail: "Sitelinks, callouts, structured snippets, call extension, location extension, and review extension." },
      { text: "Configure bidding strategy", detail: "Start with Maximize Clicks for 2-4 weeks to gather data, then switch to Target CPA or Maximize Conversions." },
      { text: "Set geographic targeting and ad schedule", detail: "Target service area radius. Schedule ads during business hours + 1 hour buffer." },
      { text: "Add negative keywords", detail: "Block: 'free', 'DIY', 'jobs', 'salary', 'training', 'certification', and irrelevant conditions." },
      { text: "Launch campaigns and monitor daily for first week" },
      { text: "Save Google Ads link in Clients tab" },
    ],
    tools: ["Google Ads", "Google Tag Manager", "Google Keyword Planner", "SEMrush", "Clients Tab"],
    tips: [
      "Healthcare ads require LegitScript certification in some cases — verify before launching",
      "Substance abuse treatment ads have strict Google policies — review their healthcare advertising policy",
      "Always start with a conservative budget and scale up based on conversion data",
    ],
  },

  // ── DELIVERY ──
  {
    id: "sop-6",
    title: "Website Build Process",
    icon: Globe,
    category: "Delivery",
    description: "End-to-end website build from wireframe to launch, typically ~$8K projects.",
    owner: "You (Founder)",
    frequency: "Per website project",
    timeEstimate: "4–6 weeks",
    steps: [
      { text: "Week 1: Discovery & wireframing", detail: "Review brand questionnaire, create sitemap, wireframe key pages (Home, About, Services, Contact, Blog). Get client approval on wireframes before design." },
      { text: "Week 1-2: Content collection", detail: "Request from client: team photos/bios, service descriptions, insurance accepted, accreditations, testimonials (with consent), FAQs. Write copy if included in scope." },
      { text: "Week 2-3: Design mockups", detail: "Design Home + 1 interior page. Present to client for feedback. Allow 1 round of design revisions." },
      { text: "Week 3-4: Development", detail: "Build in WordPress/Webflow. Implement: responsive design, ADA accessibility basics, HIPAA-appropriate contact forms (no PHI collection), speed optimization, SSL." },
      { text: "Week 4-5: Content population & SEO setup", detail: "Add all content, optimize meta titles/descriptions, set up XML sitemap, configure Google Search Console, install analytics tracking." },
      { text: "Week 5: Internal QA", detail: "Test: all links, forms, mobile responsiveness, page speed (target <3s), cross-browser, accessibility, contact form deliverability." },
      { text: "Week 5-6: Client review", detail: "Send staging link. Allow 1 round of revisions. Get written approval to launch." },
      { text: "Week 6: Launch", detail: "Go live, verify DNS, test everything again, submit to Google Search Console, set up uptime monitoring." },
      { text: "Post-launch: Update Clients tab website status to \"Complete\"" },
      { text: "Post-launch: Send final invoice (remaining 50% of website build)" },
    ],
    tools: ["Figma/Design Tool", "WordPress/Webflow", "Google Search Console", "PageSpeed Insights", "Clients Tab"],
    tips: [
      "Mental health websites must feel safe and welcoming — soft colors, real photos, clear CTAs",
      "NEVER collect protected health information (PHI) through website forms",
      "Always include crisis hotline numbers on substance abuse treatment sites",
    ],
  },
  {
    id: "sop-7",
    title: "Monthly Ad Management",
    icon: Megaphone,
    category: "Delivery",
    description: "Recurring monthly tasks for managing each client's Google Ads campaigns.",
    owner: "You (Founder)",
    frequency: "Monthly per client",
    timeEstimate: "3–4 hours per client",
    steps: [
      { text: "Week 1: Performance review", detail: "Pull last month's data: impressions, clicks, CTR, CPC, conversions, cost per conversion, ROAS. Compare to previous month and benchmarks." },
      { text: "Week 1: Search term review", detail: "Review search terms report. Add high-performing terms as keywords. Add irrelevant terms as negative keywords. Do this weekly for the first 3 months, then bi-weekly." },
      { text: "Week 2: Ad copy optimization", detail: "Pause underperforming ads (CTR below 3%). Write new ad variations. Test new headlines, descriptions, and CTAs." },
      { text: "Week 2: Bid adjustments", detail: "Adjust bids by device, location, time of day, and audience based on conversion data." },
      { text: "Week 3: Landing page review", detail: "Check landing page speed, conversion rate, bounce rate. Suggest improvements if conversion rate is below 5%." },
      { text: "Week 3: Budget pacing check", detail: "Ensure monthly budget is pacing correctly. Reallocate between campaigns if needed." },
      { text: "Week 4: Compile monthly report", detail: "See 'Monthly Client Reporting' SOP for details." },
      { text: "Week 4: Client check-in call", detail: "Present results, discuss strategy for next month, get feedback on lead quality." },
    ],
    tools: ["Google Ads", "Google Analytics", "Google Looker Studio", "Clients Tab"],
    tips: [
      "Track lead quality, not just volume — 10 good leads > 50 bad ones",
      "Healthcare CPCs are expensive ($5-15+). Focus on conversion rate optimization to maximize ROI",
      "Seasonal trends matter: January is big for 'new year' therapy searches, summer for substance abuse",
    ],
  },
  {
    id: "sop-8",
    title: "Monthly Client Reporting",
    icon: BarChart3,
    category: "Delivery",
    description: "Creating and delivering the monthly performance report to each client.",
    owner: "You (Founder)",
    frequency: "Monthly per client (by 5th of month)",
    timeEstimate: "1–2 hours per client",
    steps: [
      { text: "Pull data by the 2nd of each month", detail: "Sources: Google Ads, Google Analytics, Google Search Console, Google Business Profile, call tracking platform." },
      { text: "Populate the report template", detail: "Sections: Executive Summary (3-4 sentences), Key Metrics (traffic, leads, cost per lead, top campaigns), Website Performance (if applicable), Insights & Recommendations, Next Month's Plan." },
      { text: "Write the executive summary in plain language", detail: "Avoid jargon. Example: 'You received 47 new patient inquiries this month, up 23% from last month. Your cost per inquiry dropped to $38, which means your ad budget is working harder for you.'" },
      { text: "Include visual charts (trends, comparisons)" },
      { text: "Add 2-3 specific recommendations for next month" },
      { text: "Review report for accuracy — double-check all numbers" },
      { text: "Send report via email by the 5th with a brief personal note", detail: "Offer to schedule a call if they have questions." },
      { text: "Log in Tasks tab: \"[Client] March report sent\"" },
    ],
    tools: ["Google Looker Studio", "Google Ads", "Google Analytics", "Report Template", "Tasks Tab"],
    tips: [
      "Clients don't care about impressions — they care about phone calls and new patients",
      "Always frame results in terms of their business impact, not marketing metrics",
      "If results are down, lead with what you're doing about it — never just report bad news",
    ],
  },

  // ── OPERATIONS ──
  {
    id: "sop-9",
    title: "Weekly Planning Ritual",
    icon: Settings,
    category: "Operations",
    description: "Your weekly planning session to stay on top of all clients, prospects, and tasks.",
    owner: "You (Founder)",
    frequency: "Every Monday morning",
    timeEstimate: "30–45 minutes",
    steps: [
      { text: "Review all open Tasks — re-prioritize and update due dates" },
      { text: "Check Clients tab for any payment issues", detail: "Follow up immediately on any \"Overdue\" payments." },
      { text: "Review Prospects tab — who needs follow-up this week?", detail: "Sort by follow-up date. Make sure no prospect goes more than 7 days without contact." },
      { text: "Check each client's Google Ads for anomalies", detail: "Quick 5-min scan per client: any budget issues? Disapproved ads? Sudden drops in performance?" },
      { text: "Plan the week: block time for each client's work" , detail: "Suggested weekly time blocks:\n• Mon AM: Planning + prospect follow-ups\n• Mon PM - Tue: Client 1 & 2 work\n• Wed - Thu AM: Client 3 & 4 work\n• Thu PM: Internal/business development\n• Fri: Reporting, invoicing, admin" },
      { text: "Update the OS — make sure everything is current" },
    ],
    tools: ["Kind Supply Digital OS (all tabs)", "Google Ads accounts", "Calendar"],
    tips: [
      "Do this before checking email — set the agenda, don't react to everyone else's",
      "If you're over capacity, this is where you'll see it first — plan to hire or trim scope",
      "Track how long each client takes weekly — this is how you know if pricing is right",
    ],
  },
  {
    id: "sop-10",
    title: "Client Communication Standards",
    icon: FileText,
    category: "Operations",
    description: "Response times, communication channels, and expectations for all client interactions.",
    owner: "You (Founder)",
    frequency: "Ongoing",
    timeEstimate: "N/A",
    steps: [
      { text: "Email: respond within 24 hours (same business day preferred)", detail: "Even if you don't have an answer yet, acknowledge the email: 'Got it — I'll look into this and follow up by [date].'" },
      { text: "Phone/text: respond within 4 hours during business hours" },
      { text: "Scheduled check-ins: bi-weekly 30-min calls per client", detail: "Use a consistent agenda: wins, concerns, upcoming work, questions. Send recap notes after every call." },
      { text: "Monthly reports: delivered by the 5th of each month" },
      { text: "Emergency/urgent issues: respond within 1 hour", detail: "Emergencies: site down, ad account suspended, major budget issue, PR crisis. Set up phone alerts for these." },
      { text: "Set boundaries: communicate your working hours", detail: "Suggested: Mon-Fri 9am-6pm. Weekend messages will be addressed Monday. Include this in your welcome packet." },
      { text: "Proactive communication > reactive", detail: "Don't wait for clients to ask about performance. If something noteworthy happens (good or bad), reach out first." },
    ],
    tips: [
      "Over-communication builds trust. Under-communication kills relationships.",
      "Mental health providers are often overwhelmed — be the easy, reliable part of their day",
      "Document everything. If it's not written down, it didn't happen.",
    ],
  },
  {
    id: "sop-11",
    title: "Emergency Response",
    icon: AlertTriangle,
    category: "Operations",
    description: "How to handle urgent issues: site down, ad suspension, budget overruns, or compliance problems.",
    owner: "You (Founder)",
    frequency: "As needed",
    timeEstimate: "Varies",
    steps: [
      { text: "SITE DOWN: Check hosting status → clear cache → contact host → notify client with ETA", detail: "Target resolution: under 2 hours. If longer, set up a temporary redirect or maintenance page." },
      { text: "AD ACCOUNT SUSPENDED: Review Google's notification → identify policy violation → fix the issue → submit appeal", detail: "Common in healthcare: LegitScript certification issues, misleading claims, missing disclaimers. Keep appeal templates ready." },
      { text: "BUDGET OVERRUN: Pause campaigns immediately → investigate cause → adjust settings → notify client", detail: "Check for: bid strategy changes, broad match expansion, new competitor bidding, click fraud." },
      { text: "COMPLIANCE ISSUE: Pause affected content immediately → consult with client → get legal review if needed", detail: "Healthcare marketing compliance: no guaranteed outcomes, no PHI in ads, proper disclaimers, LegitScript for rehab." },
      { text: "BAD REVIEWS / PR ISSUE: Do NOT respond without client approval → draft professional response → get sign-off → post response", detail: "Never get defensive. Template: acknowledge → empathize → take it offline ('Please contact us at...')" },
      { text: "After resolution: document what happened, what was done, and how to prevent it" },
      { text: "Create a Task in the OS to follow up in 48 hours" },
    ],
    tips: [
      "Stay calm. Your clients are in high-stress industries — they need you to be the steady hand.",
      "Always have a backup contact for hosting and ad support",
      "Keep a log of all incidents — patterns reveal systemic issues",
    ],
  },

  // ── FINANCE ──
  {
    id: "sop-12",
    title: "Invoicing & Payment Collection",
    icon: DollarSign,
    category: "Finance",
    description: "Monthly invoicing schedule, payment terms, and overdue payment follow-up process.",
    owner: "You (Founder)",
    frequency: "1st of every month",
    timeEstimate: "1 hour total",
    steps: [
      { text: "1st of month: Generate invoices for all active clients", detail: "Each invoice includes:\n• Growth optimization retainer: $4,500–$5,000\n• Ad management fee: $1,500–$2,000\n• Any additional one-time charges (website milestones, etc.)\nPayment terms: Net 15" },
      { text: "Send invoices via QuickBooks/Stripe with a brief personal note" },
      { text: "Update Clients tab payment status to \"Pending\"" },
      { text: "Day 7: Friendly reminder if not paid", detail: "Email: 'Hi [Name], just a quick reminder that your [Month] invoice is outstanding. Let me know if you have any questions!'" },
      { text: "Day 15 (due date): Update to \"Overdue\" if unpaid" },
      { text: "Day 16: Send formal past-due notice", detail: "Email: professional tone, reference contract terms, offer to discuss payment plan if needed." },
      { text: "Day 20: Phone call follow-up", detail: "Direct conversation. Be empathetic but firm. Offer a 1-week extension max." },
      { text: "Day 30+: Pause services if still unpaid", detail: "Email notification: 'Per our agreement, services will be paused until the account is current.' Pause ad campaigns. Do NOT delete anything." },
      { text: "When paid: Update Clients tab to \"Current\" immediately" },
      { text: "Create Task for any follow-up actions needed" },
    ],
    tools: ["QuickBooks/Stripe", "Clients Tab", "Tasks Tab", "Email"],
    tips: [
      "Never feel guilty about collecting payment — you deliver real value",
      "Offer autopay setup during onboarding to avoid chasing payments",
      "Track payment patterns — consistently late payers may not be worth the stress",
    ],
  },
  {
    id: "sop-13",
    title: "Monthly Financial Review",
    icon: CreditCard,
    category: "Finance",
    description: "End-of-month review of revenue, expenses, profitability, and financial health.",
    owner: "You (Founder)",
    frequency: "Last day of each month",
    timeEstimate: "1 hour",
    steps: [
      { text: "Calculate total monthly revenue", detail: "Sum all retainers + ad management fees + any one-time project payments received." },
      { text: "Review expenses", detail: "Software/tools, contractors (if any), advertising for own business, insurance, and other overhead." },
      { text: "Calculate profit margin per client", detail: "Revenue from client ÷ hours spent on client = effective hourly rate. Target: $150+/hour." },
      { text: "Review outstanding invoices — total AR" },
      { text: "Check client ad spend vs. budget", detail: "Make sure you're managing ad spend efficiently. Flag any clients where CPA is trending up." },
      { text: "Update financial projections", detail: "Current MRR × 12 = annual run rate. Factor in pipeline (Prospects tab) for growth projections." },
      { text: "Set aside taxes (25-30% of profit)", detail: "Transfer to a separate tax savings account. Quarterly estimated payments if applicable." },
      { text: "Review: Are you priced correctly?", detail: "If any client's effective rate is below $100/hr, consider scope adjustment or price increase at renewal." },
    ],
    tools: ["QuickBooks/Stripe", "Clients Tab", "Prospects Tab", "Spreadsheet/calculator"],
    tips: [
      "Revenue is vanity, profit is sanity, cash flow is reality",
      "With 4 clients at $6K-$7K/mo each, you should be at $24K-$28K/mo MRR — track this",
      "Plan to hire help when you consistently exceed 50 billable hours/week",
    ],
  },
];

export function SOPSheet() {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");

  const filtered = sops.filter((sop) => {
    const matchesCategory = filter === "All" || sop.category === filter;
    const matchesSearch = search === "" ||
      sop.title.toLowerCase().includes(search.toLowerCase()) ||
      sop.description.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const grouped: Record<string, SOP[]> = {};
  filtered.forEach((sop) => {
    if (!grouped[sop.category]) grouped[sop.category] = [];
    grouped[sop.category].push(sop);
  });

  const categoryOrder = ["Sales", "Onboarding", "Delivery", "Operations", "Finance"];

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-center gap-4 md:gap-8 mb-6 pb-5 border-b border-[#e2e8e0]">
        <div>
          <p className="text-[11px] text-[#8a9e96] tracking-widest uppercase">Standard Operating Procedures</p>
          <p className="text-[22px] text-[#2d4a3e] tracking-tight">{sops.length} SOPs</p>
        </div>
        <div className="hidden sm:block">
          <p className="text-[11px] text-[#8a9e96] tracking-widest uppercase">Categories</p>
          <p className="text-[22px] text-[#2d4a3e] tracking-tight">5</p>
        </div>
        <div className="w-full sm:w-auto sm:ml-auto relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#b8c4be]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search SOPs..."
            className="pl-8 pr-4 py-2 text-[13px] border border-[#e2e8e0] rounded-md bg-white focus:outline-none focus:border-[#4a7c6a] focus:ring-1 focus:ring-[#4a7c6a]/20 transition-colors w-full sm:w-[220px]"
          />
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-1 mb-6 overflow-x-auto pb-1 -mx-1 px-1">
        {allCategories.map((c) => (
          <button
            key={c}
            onClick={() => setFilter(c)}
            className={`px-2.5 py-1 rounded-md text-[12px] transition-colors ${
              filter === c ? "bg-[#2d4a3e] text-white" : "text-[#8a9e96] hover:bg-[#eef5f0] hover:text-[#4a7c6a]"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {/* SOP Groups */}
      {categoryOrder.map((cat) => {
        const catSOPs = grouped[cat];
        if (!catSOPs || catSOPs.length === 0) return null;

        return (
          <div key={cat} className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <span className={`text-[11px] px-2.5 py-0.5 rounded-full ${categoryColor[cat]}`}>{cat}</span>
              <span className="text-[11px] text-[#b8c4be]">{catSOPs.length} procedures</span>
            </div>

            {catSOPs.map((sop) => {
              const isExpanded = expanded === sop.id;
              const Icon = sop.icon;

              return (
                <div
                  key={sop.id}
                  className="border border-[#e2e8e0] rounded-xl mb-2 overflow-hidden bg-white shadow-[0_1px_3px_rgba(45,74,62,0.04)]"
                >
                  {/* SOP Header */}
                  <div
                    className="flex items-center gap-3 md:gap-4 px-4 md:px-5 py-3 md:py-4 cursor-pointer hover:bg-[#f5f8f5] transition-colors"
                    onClick={() => setExpanded(isExpanded ? null : sop.id)}
                  >
                    <div className="w-8 h-8 rounded-lg bg-[#eef5f0] flex items-center justify-center shrink-0">
                      <Icon size={16} className="text-[#4a7c6a]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] text-[#2d4a3e]">{sop.title}</p>
                      <p className="text-[12px] text-[#8a9e96] truncate">{sop.description}</p>
                    </div>
                    <div className="hidden sm:flex items-center gap-4 shrink-0 text-[11px] text-[#8a9e96]">
                      <span className="flex items-center gap-1"><Clock size={10} /> {sop.timeEstimate}</span>
                      <span>{sop.frequency}</span>
                    </div>
                    {isExpanded ? (
                      <ChevronUp size={14} className="text-[#8a9e96] shrink-0" />
                    ) : (
                      <ChevronDown size={14} className="text-[#8a9e96] shrink-0" />
                    )}
                  </div>

                  {/* SOP Detail */}
                  {isExpanded && (
                    <div className="px-4 md:px-5 pb-5 pt-1 border-t border-[#e2e8e0] bg-[#f9fbf9]">
                      {/* Meta */}
                      <div className="grid grid-cols-2 sm:flex sm:items-center gap-3 sm:gap-6 mb-4 py-2">
                        <div>
                          <span className="text-[10px] text-[#8a9e96] uppercase tracking-widest">Owner</span>
                          <p className="text-[13px] text-[#2d4a3e]">{sop.owner}</p>
                        </div>
                        <div>
                          <span className="text-[10px] text-[#8a9e96] uppercase tracking-widest">Frequency</span>
                          <p className="text-[13px] text-[#2d4a3e]">{sop.frequency}</p>
                        </div>
                        <div>
                          <span className="text-[10px] text-[#8a9e96] uppercase tracking-widest">Time</span>
                          <p className="text-[13px] text-[#2d4a3e]">{sop.timeEstimate}</p>
                        </div>
                        {sop.tools && (
                          <div className="col-span-2 sm:col-span-1">
                            <span className="text-[10px] text-[#8a9e96] uppercase tracking-widest">Tools</span>
                            <p className="text-[13px] text-[#2d4a3e]">{sop.tools.join(" · ")}</p>
                          </div>
                        )}
                      </div>

                      {/* Steps */}
                      <div className="mb-4">
                        <p className="text-[10px] text-[#8a9e96] uppercase tracking-widest mb-2">Steps</p>
                        <div className="space-y-1">
                          {sop.steps.map((step, i) => (
                            <div key={i} className="flex gap-2 md:gap-3 py-2 px-2 md:px-3 rounded-lg hover:bg-white transition-colors">
                              <div className="flex items-start gap-2 shrink-0 pt-0.5">
                                <div className="w-5 h-5 rounded-full border-[1.5px] border-[#c8d4cd] flex items-center justify-center text-[10px] text-[#8a9e96]">
                                  {i + 1}
                                </div>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[13px] text-[#2d4a3e]">{step.text}</p>
                                {step.detail && (
                                  <p className="text-[12px] text-[#8a9e96] mt-1 whitespace-pre-line leading-relaxed">
                                    {step.detail}
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Tips */}
                      {sop.tips && sop.tips.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-[#e2e8e0]">
                          <p className="text-[10px] text-[#c8973e] uppercase tracking-widest mb-2 flex items-center gap-1">
                            <CheckCircle2 size={10} /> Pro Tips
                          </p>
                          <div className="space-y-1.5">
                            {sop.tips.map((tip, i) => (
                              <div key={i} className="flex items-start gap-2 py-1 px-3">
                                <span className="text-[#c8973e] text-[10px] mt-0.5 shrink-0">●</span>
                                <p className="text-[12px] text-[#5a7a6e] italic">{tip}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}

      {filtered.length === 0 && (
        <div className="text-center py-12 text-[14px] text-[#b8c4be]">No SOPs match your search</div>
      )}
    </div>
  );
}