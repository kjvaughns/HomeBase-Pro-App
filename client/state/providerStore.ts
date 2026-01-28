import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

// ============================================
// TYPES
// ============================================

export interface Lead {
  id: string;
  customerName: string;
  customerAvatar?: string;
  customerPhone?: string;
  service: string;
  description: string;
  address: string;
  distance?: string;
  budget: number;
  status: "new" | "contacted" | "quoted" | "won" | "lost";
  requestedDate?: string;
  createdAt: string;
  photos?: string[];
}

export interface JobChecklistItem {
  id: string;
  label: string;
  completed: boolean;
}

export interface JobIntakeData {
  problemDescription?: string;
  followUpAnswers?: { question: string; answer: string }[];
  photos?: string[];
  estimatedDuration?: string;
  priceBreakdown?: { label: string; amount: number }[];
}

export interface Job {
  id: string;
  clientId?: string;
  leadId?: string;
  customerName: string;
  customerEmail?: string;
  customerAvatar?: string;
  customerPhone?: string;
  service: string;
  description?: string;
  address: string;
  date: string;
  time: string;
  endTime?: string;
  status: "scheduled" | "confirmed" | "on_my_way" | "arrived" | "in_progress" | "completed" | "cancelled";
  price: number;
  laborCost?: number;
  materialsCost?: number;
  notes?: string;
  internalNotes?: string;
  completedAt?: string;
  startedAt?: string;
  checklist?: JobChecklistItem[];
  intakeData?: JobIntakeData;
  invoiceId?: string;
  paymentStatus?: "unpaid" | "partial" | "paid";
  amountPaid?: number;
}

export interface Quote {
  id: string;
  leadId: string;
  laborCost: number;
  materialsCost: number;
  total: number;
  notes?: string;
  validUntil: string;
  createdAt: string;
  status: "pending" | "accepted" | "declined" | "expired";
}

export interface ProviderMessage {
  id: string;
  conversationId: string;
  customerId: string;
  customerName: string;
  customerAvatar?: string;
  jobId?: string;
  lastMessage: string;
  timestamp: string;
  unreadCount: number;
  messages: ChatMessage[];
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderType: "provider" | "customer";
  content: string;
  timestamp: string;
  read: boolean;
}

export interface Invoice {
  id: string;
  jobId: string;
  customerName: string;
  service: string;
  amount: number;
  date: string;
  dueDate: string;
  status: "draft" | "sent" | "paid" | "overdue";
  paidAt?: string;
}

export interface Payout {
  id: string;
  amount: number;
  invoiceIds: string[];
  status: "pending" | "processing" | "completed" | "failed";
  requestedAt: string;
  completedAt?: string;
  bankLast4?: string;
}

export interface ClientHome {
  beds: number;
  baths: number;
  sqft: number;
  yearBuilt: number;
  propertyType: "single_family" | "condo" | "townhouse" | "multi_family";
  roofAge?: number;
  hvacType?: string;
  hvacAge?: number;
  waterHeaterAge?: number;
  healthScore?: number;
  healthScoreDate?: string;
  survivalKitEstimate?: { min: number; max: number };
  notableRisks?: string[];
  lastUpdatedByHomeowner?: string;
  accessNotes?: string;
  pets?: string;
  parking?: string;
  gateCode?: string;
  preferredWindows?: string[];
  photos?: string[];
}

export interface ClientJob {
  id: string;
  clientId: string;
  service: string;
  description?: string;
  date: string;
  status: "pending" | "confirmed" | "on_my_way" | "arrived" | "in_progress" | "completed" | "invoice_sent" | "paid";
  price: number;
  paidAmount?: number;
}

export interface ClientInvoice {
  id: string;
  clientId: string;
  jobId: string;
  amount: number;
  date: string;
  dueDate: string;
  status: "draft" | "sent" | "paid" | "overdue";
  paidAt?: string;
}

export interface ClientNote {
  id: string;
  clientId: string;
  content: string;
  isInternal: boolean;
  createdAt: string;
  createdBy: string;
}

export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatar?: string;
  status: "active" | "lead" | "inactive" | "archived";
  lastSeen: string;
  clientSince?: string;
  ltv: number;
  jobCount: number;
  address?: string;
  notes?: string;
  outstandingBalance?: number;
  avgTicket?: number;
  nextAppointment?: string;
  home?: ClientHome;
}

export interface ClientActivity {
  id: string;
  clientId: string;
  type: "job_completed" | "job_scheduled" | "invoice_sent" | "invoice_paid" | "message_sent" | "quote_sent";
  description: string;
  timestamp: string;
  jobId?: string;
  invoiceId?: string;
}

export interface ProviderStats {
  totalEarnings: number;
  pendingEarnings: number;
  availableBalance: number;
  completedJobs: number;
  rating: number;
  reviewCount: number;
  responseRate: number;
  upcomingJobs: number;
  newLeads: number;
  unreadMessages: number;
}

// ============================================
// INITIAL MOCK DATA - 25+ Leads
// ============================================

const initialLeads: Lead[] = [
  // NEW leads (8)
  { id: "l1", customerName: "Sarah Wilson", service: "Bathroom Renovation", description: "Need complete bathroom remodel including new fixtures and tiling.", address: "321 Elm St, San Francisco", distance: "2.3 mi", budget: 5000, status: "new", requestedDate: "Next week", createdAt: "2 hours ago" },
  { id: "l2", customerName: "David Brown", service: "Kitchen Plumbing", description: "Install new garbage disposal and fix leaky faucet.", address: "654 Maple Dr, Oakland", distance: "4.1 mi", budget: 350, status: "new", requestedDate: "This week", createdAt: "4 hours ago" },
  { id: "l3", customerName: "Emma Rodriguez", service: "Water Heater", description: "40-gallon tank making strange noises, may need replacement.", address: "892 Pine Ave, Berkeley", distance: "5.2 mi", budget: 1200, status: "new", requestedDate: "ASAP", createdAt: "5 hours ago" },
  { id: "l4", customerName: "James Mitchell", service: "Drain Cleaning", description: "Kitchen sink draining very slowly, tried Drano with no luck.", address: "445 Oak Blvd, San Francisco", distance: "1.8 mi", budget: 200, status: "new", requestedDate: "Tomorrow", createdAt: "6 hours ago" },
  { id: "l5", customerName: "Lisa Chen", service: "Toilet Repair", description: "Toilet running constantly, wasting water.", address: "778 Cedar Ln, Daly City", distance: "3.5 mi", budget: 150, status: "new", requestedDate: "This week", createdAt: "8 hours ago" },
  { id: "l6", customerName: "Michael Park", service: "Pipe Leak", description: "Noticed water stain on ceiling, possibly pipe leak above.", address: "123 Walnut St, San Mateo", distance: "8.2 mi", budget: 400, status: "new", requestedDate: "ASAP", createdAt: "12 hours ago" },
  { id: "l7", customerName: "Amanda Foster", service: "Shower Installation", description: "Want to convert tub to walk-in shower.", address: "567 Birch Rd, San Francisco", distance: "2.1 mi", budget: 3500, status: "new", requestedDate: "Flexible", createdAt: "1 day ago" },
  { id: "l8", customerName: "Kevin Wright", service: "Sump Pump", description: "Basement floods during heavy rain, need sump pump installed.", address: "234 Spruce Way, Oakland", distance: "4.8 mi", budget: 800, status: "new", requestedDate: "Before rainy season", createdAt: "1 day ago" },
  
  // CONTACTED leads (6)
  { id: "l9", customerName: "Jennifer Lee", service: "Bathroom Faucet", description: "Replace old bathroom faucet with modern touchless.", address: "890 Ash Dr, San Francisco", distance: "1.2 mi", budget: 300, status: "contacted", requestedDate: "Next week", createdAt: "2 days ago" },
  { id: "l10", customerName: "Robert Taylor", service: "Garbage Disposal", description: "Disposal jammed and won't turn on anymore.", address: "111 First Ave, Berkeley", distance: "5.5 mi", budget: 250, status: "contacted", requestedDate: "This week", createdAt: "2 days ago" },
  { id: "l11", customerName: "Maria Santos", service: "Water Softener", description: "Hard water damaging appliances, need softener system.", address: "222 Second St, Oakland", distance: "4.3 mi", budget: 1500, status: "contacted", requestedDate: "This month", createdAt: "3 days ago" },
  { id: "l12", customerName: "Thomas Anderson", service: "Outdoor Faucet", description: "Outdoor spigot leaking, need replacement before winter.", address: "333 Third Blvd, Alameda", distance: "6.1 mi", budget: 200, status: "contacted", requestedDate: "This week", createdAt: "3 days ago" },
  { id: "l13", customerName: "Patricia Moore", service: "Dishwasher Hook-up", description: "New dishwasher needs plumbing connection.", address: "444 Fourth Pl, San Francisco", distance: "0.8 mi", budget: 250, status: "contacted", requestedDate: "When convenient", createdAt: "4 days ago" },
  { id: "l14", customerName: "Daniel Kim", service: "Whole House Repipe", description: "Old galvanized pipes, want to repipe entire house.", address: "555 Fifth Ct, Daly City", distance: "3.9 mi", budget: 8000, status: "contacted", requestedDate: "Next month", createdAt: "4 days ago" },
  
  // QUOTED leads (5)
  { id: "l15", customerName: "Emily Chen", service: "Tankless Water Heater", description: "Replace old 40-gallon tank with tankless system.", address: "987 Cedar Ln, San Francisco", distance: "2.4 mi", budget: 2500, status: "quoted", requestedDate: "Flexible", createdAt: "5 days ago" },
  { id: "l16", customerName: "Christopher Davis", service: "Main Line Repair", description: "Roots causing main sewer line backup.", address: "666 Sixth Ave, Oakland", distance: "5.0 mi", budget: 4000, status: "quoted", requestedDate: "ASAP", createdAt: "5 days ago" },
  { id: "l17", customerName: "Ashley Thompson", service: "Bathroom Addition", description: "Adding half bath to basement.", address: "777 Seventh Rd, Berkeley", distance: "5.8 mi", budget: 6500, status: "quoted", requestedDate: "Next month", createdAt: "6 days ago" },
  { id: "l18", customerName: "Matthew White", service: "Gas Line Install", description: "Run gas line to outdoor BBQ area.", address: "888 Eighth St, San Mateo", distance: "9.1 mi", budget: 1200, status: "quoted", requestedDate: "Spring", createdAt: "1 week ago" },
  { id: "l19", customerName: "Nicole Brown", service: "Shower Pan Replace", description: "Shower pan cracked and leaking into floor.", address: "999 Ninth Ln, San Francisco", distance: "1.5 mi", budget: 1800, status: "quoted", requestedDate: "ASAP", createdAt: "1 week ago" },
  
  // WON leads (4)
  { id: "l20", customerName: "William Johnson", service: "Pipe Repair", description: "Burst pipe in wall, emergency repair.", address: "100 Tenth Ave, San Francisco", distance: "0.5 mi", budget: 600, status: "won", requestedDate: "Done", createdAt: "2 weeks ago" },
  { id: "l21", customerName: "Elizabeth Harris", service: "Water Heater Install", description: "New 50-gallon water heater installation.", address: "200 Eleventh St, Oakland", distance: "4.6 mi", budget: 1400, status: "won", requestedDate: "Done", createdAt: "2 weeks ago" },
  { id: "l22", customerName: "Andrew Martinez", service: "Drain Unclog", description: "Multiple drains clogged throughout house.", address: "300 Twelfth Blvd, Berkeley", distance: "5.3 mi", budget: 350, status: "won", requestedDate: "Done", createdAt: "3 weeks ago" },
  { id: "l23", customerName: "Stephanie Clark", service: "Faucet Install", description: "Replace kitchen and bathroom faucets.", address: "400 Thirteenth Pl, Alameda", distance: "6.8 mi", budget: 500, status: "won", requestedDate: "Done", createdAt: "3 weeks ago" },
  
  // LOST leads (3)
  { id: "l24", customerName: "Joshua Lewis", service: "Full Repipe", description: "Wanted full house repipe.", address: "500 Fourteenth Ct, Daly City", distance: "4.2 mi", budget: 12000, status: "lost", requestedDate: "N/A", createdAt: "1 month ago" },
  { id: "l25", customerName: "Rachel Walker", service: "Pool Plumbing", description: "Pool plumbing repairs.", address: "600 Fifteenth Way, San Mateo", distance: "10.5 mi", budget: 2000, status: "lost", requestedDate: "N/A", createdAt: "1 month ago" },
  { id: "l26", customerName: "Brandon Hall", service: "Sprinkler System", description: "Underground sprinkler installation.", address: "700 Sixteenth Dr, Oakland", distance: "5.9 mi", budget: 3500, status: "lost", requestedDate: "N/A", createdAt: "1 month ago" },
];

// ============================================
// INITIAL MOCK DATA - 12+ Scheduled + 10+ Completed Jobs
// ============================================

const initialJobs: Job[] = [
  // SCHEDULED jobs (8)
  { id: "j1", leadId: "l20", customerName: "Robert Taylor", service: "Pipe Repair", address: "111 First Ave, San Francisco", date: "2026-01-28", time: "9:00 AM", status: "scheduled", price: 275, description: "Fix leaking pipe under kitchen sink" },
  { id: "j2", leadId: "l21", customerName: "Jennifer Lee", service: "Drain Cleaning", address: "222 Second St, Oakland", date: "2026-01-28", time: "11:30 AM", status: "scheduled", price: 150, description: "Clear kitchen drain blockage" },
  { id: "j3", customerName: "Susan Miller", service: "Faucet Installation", address: "333 Third Blvd, Berkeley", date: "2026-01-29", time: "10:00 AM", status: "scheduled", price: 200, description: "Install new kitchen faucet" },
  { id: "j4", customerName: "Richard Garcia", service: "Toilet Repair", address: "444 Fourth St, Alameda", date: "2026-01-29", time: "2:00 PM", status: "scheduled", price: 175, description: "Fix running toilet, replace flapper" },
  { id: "j5", customerName: "Barbara Wilson", service: "Water Heater Flush", address: "555 Fifth Ave, San Francisco", date: "2026-01-30", time: "9:00 AM", status: "scheduled", price: 150, description: "Annual water heater maintenance" },
  { id: "j6", customerName: "Joseph Martinez", service: "Garbage Disposal", address: "666 Sixth Blvd, Daly City", date: "2026-01-30", time: "1:00 PM", status: "scheduled", price: 280, description: "Replace garbage disposal unit" },
  { id: "j7", customerName: "Margaret Anderson", service: "Shower Valve", address: "777 Seventh Dr, Oakland", date: "2026-01-31", time: "10:30 AM", status: "scheduled", price: 350, description: "Replace shower valve and trim" },
  { id: "j8", customerName: "Charles Thompson", service: "Sump Pump Check", address: "888 Eighth Ln, San Mateo", date: "2026-02-01", time: "11:00 AM", status: "scheduled", price: 125, description: "Annual sump pump inspection" },
  
  // IN_PROGRESS jobs (4)
  { id: "j9", customerName: "Michael White", service: "Bathroom Remodel", address: "999 Ninth Ave, San Francisco", date: "2026-01-27", time: "8:00 AM", status: "in_progress", price: 4500, description: "Full bathroom renovation - day 3 of 5" },
  { id: "j10", customerName: "Patricia Brown", service: "Main Line Repair", address: "100 Tenth St, Berkeley", date: "2026-01-27", time: "9:00 AM", status: "in_progress", price: 2800, description: "Sewer line replacement in progress" },
  { id: "j11", customerName: "Linda Davis", service: "Water Heater Install", address: "200 Eleventh Blvd, Oakland", date: "2026-01-27", time: "10:00 AM", status: "in_progress", price: 1400, description: "Installing new 50-gallon tank" },
  { id: "j12", customerName: "James Rodriguez", service: "Kitchen Plumbing", address: "300 Twelfth Dr, Alameda", date: "2026-01-27", time: "1:00 PM", status: "in_progress", price: 650, description: "Replumbing under kitchen island" },
  
  // COMPLETED jobs (12)
  { id: "j13", customerName: "Alice Johnson", service: "Emergency Plumbing", address: "400 Thirteenth Ave, San Francisco", date: "2026-01-25", time: "7:00 PM", status: "completed", price: 450, completedAt: "2026-01-25", description: "Emergency burst pipe repair" },
  { id: "j14", customerName: "Bob Williams", service: "Bathroom Repair", address: "500 Fourteenth St, Oakland", date: "2026-01-23", time: "10:00 AM", status: "completed", price: 320, completedAt: "2026-01-23", description: "Fixed leaking bathroom sink" },
  { id: "j15", customerName: "Carol Davis", service: "Kitchen Plumbing", address: "600 Fifteenth Blvd, Berkeley", date: "2026-01-20", time: "9:00 AM", status: "completed", price: 280, completedAt: "2026-01-20", description: "Replaced kitchen drain pipes" },
  { id: "j16", customerName: "Dennis Martinez", service: "Water Heater", address: "700 Sixteenth Dr, Daly City", date: "2026-01-18", time: "11:00 AM", status: "completed", price: 1350, completedAt: "2026-01-18", description: "Installed new tankless water heater" },
  { id: "j17", customerName: "Eva Thompson", service: "Drain Cleaning", address: "800 Seventeenth Ln, San Mateo", date: "2026-01-15", time: "2:00 PM", status: "completed", price: 175, completedAt: "2026-01-15", description: "Cleared main drain blockage" },
  { id: "j18", customerName: "Frank Wilson", service: "Toilet Install", address: "900 Eighteenth Ave, Alameda", date: "2026-01-12", time: "10:00 AM", status: "completed", price: 400, completedAt: "2026-01-12", description: "Installed new low-flow toilet" },
  { id: "j19", customerName: "Grace Lee", service: "Pipe Insulation", address: "110 Nineteenth St, San Francisco", date: "2026-01-10", time: "9:00 AM", status: "completed", price: 225, completedAt: "2026-01-10", description: "Insulated exposed pipes" },
  { id: "j20", customerName: "Henry Clark", service: "Faucet Repair", address: "120 Twentieth Blvd, Oakland", date: "2026-01-08", time: "1:00 PM", status: "completed", price: 150, completedAt: "2026-01-08", description: "Fixed dripping faucet" },
  { id: "j21", customerName: "Irene Baker", service: "Shower Repair", address: "130 Twenty-First Dr, Berkeley", date: "2026-01-05", time: "11:00 AM", status: "completed", price: 275, completedAt: "2026-01-05", description: "Repaired shower valve" },
  { id: "j22", customerName: "Jack Foster", service: "Garbage Disposal", address: "140 Twenty-Second Ln, Daly City", date: "2026-01-03", time: "10:00 AM", status: "completed", price: 290, completedAt: "2026-01-03", description: "Replaced jammed disposal" },
  { id: "j23", customerName: "Karen Gray", service: "Water Line", address: "150 Twenty-Third Ave, San Mateo", date: "2025-12-28", time: "9:00 AM", status: "completed", price: 550, completedAt: "2025-12-28", description: "Repaired outdoor water line" },
  { id: "j24", customerName: "Larry Hill", service: "Sewer Repair", address: "160 Twenty-Fourth St, Alameda", date: "2025-12-20", time: "8:00 AM", status: "completed", price: 1800, completedAt: "2025-12-20", description: "Sewer line spot repair" },
];

// ============================================
// INITIAL MOCK DATA - Messages
// ============================================

const initialMessages: ProviderMessage[] = [
  {
    id: "m1", conversationId: "conv1", customerId: "c1", customerName: "Robert Taylor", jobId: "j1",
    lastMessage: "Great, see you tomorrow at 9!", timestamp: "10 min ago", unreadCount: 2,
    messages: [
      { id: "msg1", senderId: "c1", senderType: "customer", content: "Hi, is it possible to come earlier tomorrow?", timestamp: "15 min ago", read: true },
      { id: "msg2", senderId: "provider", senderType: "provider", content: "I can be there at 9 AM, would that work?", timestamp: "12 min ago", read: true },
      { id: "msg3", senderId: "c1", senderType: "customer", content: "Perfect! That works great.", timestamp: "11 min ago", read: false },
      { id: "msg4", senderId: "c1", senderType: "customer", content: "Great, see you tomorrow at 9!", timestamp: "10 min ago", read: false },
    ]
  },
  {
    id: "m2", conversationId: "conv2", customerId: "c2", customerName: "Jennifer Lee", jobId: "j2",
    lastMessage: "The drain is still slow, can you take another look?", timestamp: "1 hour ago", unreadCount: 1,
    messages: [
      { id: "msg5", senderId: "provider", senderType: "provider", content: "Just finished the initial clearing!", timestamp: "2 hours ago", read: true },
      { id: "msg6", senderId: "c2", senderType: "customer", content: "Thanks! How does it look?", timestamp: "1.5 hours ago", read: true },
      { id: "msg7", senderId: "c2", senderType: "customer", content: "The drain is still slow, can you take another look?", timestamp: "1 hour ago", read: false },
    ]
  },
  {
    id: "m3", conversationId: "conv3", customerId: "c3", customerName: "Sarah Wilson", jobId: undefined,
    lastMessage: "Thank you for the quote! We will review and get back to you.", timestamp: "3 hours ago", unreadCount: 0,
    messages: [
      { id: "msg8", senderId: "provider", senderType: "provider", content: "I've sent over the detailed quote for the bathroom renovation.", timestamp: "4 hours ago", read: true },
      { id: "msg9", senderId: "c3", senderType: "customer", content: "Thank you for the quote! We will review and get back to you.", timestamp: "3 hours ago", read: true },
    ]
  },
  {
    id: "m4", conversationId: "conv4", customerId: "c4", customerName: "Michael White", jobId: "j9",
    lastMessage: "Day 3 going smoothly. Tile work starts tomorrow.", timestamp: "Yesterday", unreadCount: 0,
    messages: [
      { id: "msg10", senderId: "provider", senderType: "provider", content: "Day 3 going smoothly. Tile work starts tomorrow.", timestamp: "Yesterday", read: true },
      { id: "msg11", senderId: "c4", senderType: "customer", content: "Great progress! Looking forward to seeing it.", timestamp: "Yesterday", read: true },
    ]
  },
  {
    id: "m5", conversationId: "conv5", customerId: "c5", customerName: "Alice Johnson", jobId: "j13",
    lastMessage: "Thank you so much for coming out so quickly!", timestamp: "2 days ago", unreadCount: 0,
    messages: [
      { id: "msg12", senderId: "provider", senderType: "provider", content: "Pipe repair is complete. Everything is sealed and tested.", timestamp: "2 days ago", read: true },
      { id: "msg13", senderId: "c5", senderType: "customer", content: "Thank you so much for coming out so quickly!", timestamp: "2 days ago", read: true },
    ]
  },
];

// ============================================
// INITIAL MOCK DATA - Invoices & Payouts
// ============================================

const initialInvoices: Invoice[] = [
  { id: "inv1", jobId: "j13", customerName: "Alice Johnson", service: "Emergency Plumbing", amount: 450, date: "2026-01-25", dueDate: "2026-02-10", status: "paid", paidAt: "2026-01-26" },
  { id: "inv2", jobId: "j14", customerName: "Bob Williams", service: "Bathroom Repair", amount: 320, date: "2026-01-23", dueDate: "2026-02-07", status: "paid", paidAt: "2026-01-25" },
  { id: "inv3", jobId: "j15", customerName: "Carol Davis", service: "Kitchen Plumbing", amount: 280, date: "2026-01-20", dueDate: "2026-02-05", status: "paid", paidAt: "2026-01-22" },
  { id: "inv4", jobId: "j16", customerName: "Dennis Martinez", service: "Water Heater", amount: 1350, date: "2026-01-18", dueDate: "2026-02-02", status: "paid", paidAt: "2026-01-20" },
  { id: "inv5", jobId: "j17", customerName: "Eva Thompson", service: "Drain Cleaning", amount: 175, date: "2026-01-15", dueDate: "2026-01-30", status: "paid", paidAt: "2026-01-17" },
  { id: "inv6", jobId: "j18", customerName: "Frank Wilson", service: "Toilet Install", amount: 400, date: "2026-01-12", dueDate: "2026-01-27", status: "paid", paidAt: "2026-01-15" },
  { id: "inv7", jobId: "j19", customerName: "Grace Lee", service: "Pipe Insulation", amount: 225, date: "2026-01-10", dueDate: "2026-01-25", status: "paid", paidAt: "2026-01-12" },
  { id: "inv8", jobId: "j20", customerName: "Henry Clark", service: "Faucet Repair", amount: 150, date: "2026-01-08", dueDate: "2026-01-23", status: "paid", paidAt: "2026-01-10" },
  { id: "inv9", jobId: "j21", customerName: "Irene Baker", service: "Shower Repair", amount: 275, date: "2026-01-05", dueDate: "2026-01-20", status: "paid", paidAt: "2026-01-08" },
  { id: "inv10", jobId: "j22", customerName: "Jack Foster", service: "Garbage Disposal", amount: 290, date: "2026-01-03", dueDate: "2026-01-18", status: "paid", paidAt: "2026-01-06" },
  { id: "inv11", jobId: "j9", customerName: "Michael White", service: "Bathroom Remodel", amount: 4500, date: "2026-01-27", dueDate: "2026-02-15", status: "sent" },
  { id: "inv12", jobId: "j10", customerName: "Patricia Brown", service: "Main Line Repair", amount: 2800, date: "2026-01-27", dueDate: "2026-02-12", status: "sent" },
];

const initialPayouts: Payout[] = [
  { id: "p1", amount: 2575, invoiceIds: ["inv1", "inv2", "inv3", "inv4"], status: "completed", requestedAt: "2026-01-22", completedAt: "2026-01-24", bankLast4: "4521" },
  { id: "p2", amount: 1225, invoiceIds: ["inv5", "inv6", "inv7", "inv8"], status: "completed", requestedAt: "2026-01-15", completedAt: "2026-01-17", bankLast4: "4521" },
  { id: "p3", amount: 565, invoiceIds: ["inv9", "inv10"], status: "processing", requestedAt: "2026-01-25", bankLast4: "4521" },
];

// ============================================
// INITIAL MOCK DATA - Clients
// ============================================

const initialClients: Client[] = [
  { 
    id: "cl1", name: "Sarah Miller", email: "sarah.miller@example.com", phone: "(555) 123-4567", 
    status: "active", lastSeen: "2 days ago", clientSince: "2023", ltv: 4500, jobCount: 8, 
    address: "123 Pine St, San Francisco, CA", avgTicket: 562, outstandingBalance: 0, nextAppointment: "2026-02-03",
    home: {
      beds: 3, baths: 2, sqft: 1850, yearBuilt: 1985, propertyType: "single_family",
      roofAge: 12, hvacType: "Central AC/Furnace", hvacAge: 8, waterHeaterAge: 6,
      healthScore: 72, healthScoreDate: "2026-01-15",
      survivalKitEstimate: { min: 2800, max: 4200 },
      notableRisks: ["Roof nearing end of life", "Water heater maintenance due"],
      lastUpdatedByHomeowner: "2026-01-20",
      accessNotes: "Side gate code: 1234. Ring doorbell before entering.",
      pets: "Golden Retriever named Max - friendly",
      parking: "Driveway available",
      preferredWindows: ["Morning (8-12)", "Weekdays only"]
    }
  },
  { 
    id: "cl2", name: "John Doe", email: "john.doe@example.com", phone: "(555) 234-5678", 
    status: "lead", lastSeen: "N/A", clientSince: undefined, ltv: 0, jobCount: 0, 
    address: "456 Oak Ave, Oakland, CA"
  },
  { 
    id: "cl3", name: "Emily Clark", email: "emily.clark@example.com", phone: "(555) 345-6789", 
    status: "inactive", lastSeen: "3 months ago", clientSince: "2024", ltv: 850, jobCount: 2, 
    address: "789 Elm St, Berkeley, CA", avgTicket: 425, outstandingBalance: 275,
    home: {
      beds: 2, baths: 1, sqft: 1100, yearBuilt: 1962, propertyType: "condo",
      hvacType: "Wall unit", hvacAge: 15, waterHeaterAge: 10,
      healthScore: 58, healthScoreDate: "2025-10-01",
      notableRisks: ["HVAC needs replacement", "Old plumbing"],
      lastUpdatedByHomeowner: "2025-09-15"
    }
  },
  { 
    id: "cl4", name: "Michael Brown", email: "michael.brown@example.com", phone: "(555) 456-7890", 
    status: "active", lastSeen: "1 week ago", clientSince: "2022", ltv: 12500, jobCount: 15, 
    address: "321 Maple Dr, San Mateo, CA", avgTicket: 833, outstandingBalance: 0, nextAppointment: "2026-01-30",
    home: {
      beds: 4, baths: 3, sqft: 2400, yearBuilt: 2005, propertyType: "single_family",
      roofAge: 5, hvacType: "Central AC/Heat Pump", hvacAge: 3, waterHeaterAge: 2,
      healthScore: 89, healthScoreDate: "2026-01-10",
      survivalKitEstimate: { min: 1800, max: 2600 },
      notableRisks: [],
      lastUpdatedByHomeowner: "2026-01-18",
      accessNotes: "Keypad entry: use code provided day of service",
      pets: "2 indoor cats - keep doors closed",
      parking: "Street parking, no driveway",
      gateCode: "4521",
      preferredWindows: ["Afternoon (12-5)", "Flexible"]
    }
  },
  { 
    id: "cl5", name: "Jessica Taylor", email: "jessica.taylor@example.com", phone: "(555) 567-8901", 
    status: "active", lastSeen: "Yesterday", clientSince: "2024", ltv: 2200, jobCount: 4, 
    address: "654 Cedar Ln, Alameda, CA", avgTicket: 550, outstandingBalance: 450, nextAppointment: "2026-01-29",
    home: {
      beds: 3, baths: 2.5, sqft: 1650, yearBuilt: 1998, propertyType: "townhouse",
      roofAge: 8, hvacType: "Central AC/Furnace", hvacAge: 10, waterHeaterAge: 8,
      healthScore: 75, healthScoreDate: "2025-12-20",
      survivalKitEstimate: { min: 2200, max: 3400 },
      notableRisks: ["HVAC service due"],
      lastUpdatedByHomeowner: "2025-12-18",
      pets: "Small dog - will be crated during service"
    }
  },
  { 
    id: "cl6", name: "David Wilson", email: "david.wilson@example.com", phone: "(555) 678-9012", 
    status: "lead", lastSeen: "N/A", clientSince: undefined, ltv: 0, jobCount: 0, 
    address: "987 Birch Rd, Daly City, CA"
  },
  { 
    id: "cl7", name: "Amanda Foster", email: "amanda.foster@example.com", phone: "(555) 789-0123", 
    status: "active", lastSeen: "4 days ago", clientSince: "2023", ltv: 7800, jobCount: 11, 
    address: "567 Birch Rd, San Francisco, CA", avgTicket: 709, outstandingBalance: 1200, nextAppointment: "2026-02-01",
    home: {
      beds: 4, baths: 2, sqft: 2100, yearBuilt: 1978, propertyType: "single_family",
      roofAge: 18, hvacType: "Central AC/Furnace", hvacAge: 12, waterHeaterAge: 4,
      healthScore: 64, healthScoreDate: "2026-01-05",
      survivalKitEstimate: { min: 4500, max: 6800 },
      notableRisks: ["Roof replacement recommended", "HVAC nearing end of life"],
      lastUpdatedByHomeowner: "2026-01-08",
      accessNotes: "Lockbox on front door - combination provided",
      pets: "No pets",
      parking: "Garage available for parking",
      gateCode: "8876",
      preferredWindows: ["Morning (8-12)"]
    }
  },
  { 
    id: "cl8", name: "Robert Taylor", email: "robert.taylor@example.com", phone: "(555) 890-1234", 
    status: "active", lastSeen: "Today", clientSince: "2024", ltv: 1500, jobCount: 3, 
    address: "111 First Ave, San Francisco, CA", avgTicket: 500, outstandingBalance: 0, nextAppointment: "2026-01-28",
    home: {
      beds: 2, baths: 2, sqft: 1200, yearBuilt: 2018, propertyType: "condo",
      hvacType: "Mini-split", hvacAge: 2, waterHeaterAge: 6,
      healthScore: 92, healthScoreDate: "2026-01-22",
      survivalKitEstimate: { min: 800, max: 1400 },
      lastUpdatedByHomeowner: "2026-01-25",
      accessNotes: "Concierge will let you in - call when arriving",
      parking: "Visitor parking in garage - Level P1"
    }
  },
  { 
    id: "cl9", name: "Jennifer Lee", email: "jennifer.lee@example.com", phone: "(555) 901-2345", 
    status: "active", lastSeen: "Today", clientSince: "2023", ltv: 3200, jobCount: 6, 
    address: "890 Ash Dr, San Francisco, CA", avgTicket: 533, outstandingBalance: 175, nextAppointment: "2026-01-28",
    home: {
      beds: 3, baths: 2, sqft: 1550, yearBuilt: 1992, propertyType: "single_family",
      roofAge: 10, hvacType: "Central AC/Furnace", hvacAge: 7, waterHeaterAge: 5,
      healthScore: 78, healthScoreDate: "2025-11-30",
      survivalKitEstimate: { min: 2000, max: 3200 },
      notableRisks: ["Gutter cleaning needed"],
      lastUpdatedByHomeowner: "2025-11-28",
      pets: "1 cat - indoor only",
      preferredWindows: ["Afternoon (12-5)"]
    }
  },
  { 
    id: "cl10", name: "Christopher Davis", email: "chris.davis@example.com", phone: "(555) 012-3456", 
    status: "archived", lastSeen: "1 year ago", clientSince: "2021", ltv: 5600, jobCount: 9, 
    address: "666 Sixth Ave, Oakland, CA", avgTicket: 622
  },
  { 
    id: "cl11", name: "Michelle Wong", email: "michelle.wong@example.com", phone: "(555) 111-2222", 
    status: "active", lastSeen: "3 days ago", clientSince: "2024", ltv: 1850, jobCount: 3, 
    address: "222 Second St, Oakland, CA", avgTicket: 617, outstandingBalance: 0,
    home: {
      beds: 2, baths: 1, sqft: 950, yearBuilt: 2010, propertyType: "condo",
      hvacType: "Central AC", hvacAge: 4, waterHeaterAge: 8,
      healthScore: 85, healthScoreDate: "2026-01-12",
      survivalKitEstimate: { min: 900, max: 1500 },
      lastUpdatedByHomeowner: "2026-01-14"
    }
  },
  { 
    id: "cl12", name: "Kevin Wright", email: "kevin.wright@example.com", phone: "(555) 222-3333", 
    status: "lead", lastSeen: "N/A", clientSince: undefined, ltv: 0, jobCount: 0, 
    address: "234 Spruce Way, Oakland, CA"
  },
  { 
    id: "cl13", name: "Patricia Moore", email: "patricia.moore@example.com", phone: "(555) 333-4444", 
    status: "active", lastSeen: "1 week ago", clientSince: "2023", ltv: 4100, jobCount: 7, 
    address: "444 Fourth Pl, San Francisco, CA", avgTicket: 586, outstandingBalance: 890,
    home: {
      beds: 3, baths: 2, sqft: 1700, yearBuilt: 1988, propertyType: "single_family",
      roofAge: 15, hvacType: "Central AC/Furnace", hvacAge: 9, waterHeaterAge: 7,
      healthScore: 70, healthScoreDate: "2025-12-01",
      survivalKitEstimate: { min: 2600, max: 4000 },
      notableRisks: ["Roof inspection recommended"],
      lastUpdatedByHomeowner: "2025-11-28",
      pets: "2 dogs - will be in backyard during service",
      parking: "Street parking only"
    }
  },
  { 
    id: "cl14", name: "Daniel Kim", email: "daniel.kim@example.com", phone: "(555) 444-5555", 
    status: "inactive", lastSeen: "2 months ago", clientSince: "2024", ltv: 650, jobCount: 1, 
    address: "555 Fifth Ct, Daly City, CA", avgTicket: 650, outstandingBalance: 650
  },
  { 
    id: "cl15", name: "Lisa Chen", email: "lisa.chen@example.com", phone: "(555) 555-6666", 
    status: "active", lastSeen: "5 days ago", clientSince: "2024", ltv: 950, jobCount: 2, 
    address: "778 Cedar Ln, Daly City, CA", avgTicket: 475, outstandingBalance: 0,
    home: {
      beds: 3, baths: 2, sqft: 1400, yearBuilt: 2002, propertyType: "townhouse",
      roofAge: 6, hvacType: "Central AC/Heat Pump", hvacAge: 5, waterHeaterAge: 4,
      healthScore: 82, healthScoreDate: "2026-01-08",
      survivalKitEstimate: { min: 1400, max: 2200 },
      lastUpdatedByHomeowner: "2026-01-10",
      pets: "No pets",
      preferredWindows: ["Weekday mornings"]
    }
  },
];

const initialClientActivities: ClientActivity[] = [
  { id: "ca1", clientId: "cl1", type: "job_completed", description: "Job Completed: Deep Clean", timestamp: "Yesterday at 4:00 PM", jobId: "j13" },
  { id: "ca2", clientId: "cl1", type: "invoice_paid", description: "Invoice Paid: $450", timestamp: "2 days ago", invoiceId: "inv1" },
  { id: "ca3", clientId: "cl1", type: "job_scheduled", description: "Job Scheduled: Water Heater Service", timestamp: "3 days ago", jobId: "j5" },
  { id: "ca4", clientId: "cl4", type: "invoice_paid", description: "Invoice Paid: $1,350", timestamp: "3 days ago", invoiceId: "inv4" },
  { id: "ca5", clientId: "cl4", type: "job_completed", description: "Job Completed: Water Heater Install", timestamp: "5 days ago", jobId: "j16" },
  { id: "ca6", clientId: "cl5", type: "job_scheduled", description: "Job Scheduled: Pipe Repair", timestamp: "2 days ago", jobId: "j1" },
  { id: "ca7", clientId: "cl7", type: "invoice_sent", description: "Invoice Sent: $1,200", timestamp: "4 days ago", invoiceId: "inv11" },
  { id: "ca8", clientId: "cl8", type: "message_sent", description: "Message: Great, see you tomorrow at 9!", timestamp: "10 min ago" },
  { id: "ca9", clientId: "cl9", type: "quote_sent", description: "Quote Sent: $2,500", timestamp: "1 week ago" },
  { id: "ca10", clientId: "cl13", type: "invoice_sent", description: "Invoice Sent: $890", timestamp: "1 week ago", invoiceId: "inv12" },
];

const initialClientNotes: ClientNote[] = [
  { id: "cn1", clientId: "cl1", content: "Prefers morning appointments before 11am. Very responsive via text.", isInternal: true, createdAt: "2025-06-15", createdBy: "Demo Pro" },
  { id: "cn2", clientId: "cl1", content: "Has annual service agreement - next HVAC check due March 2026.", isInternal: true, createdAt: "2025-12-01", createdBy: "Demo Pro" },
  { id: "cn3", clientId: "cl4", content: "High-value client. Always pays on time. Prefers detailed invoices with photos.", isInternal: true, createdAt: "2024-08-20", createdBy: "Demo Pro" },
  { id: "cn4", clientId: "cl4", content: "Interested in smart home water leak detection system - follow up in Q1.", isInternal: true, createdAt: "2026-01-10", createdBy: "Demo Pro" },
  { id: "cn5", clientId: "cl5", content: "Thank you for the excellent service! The repairs were handled professionally.", isInternal: false, createdAt: "2025-11-15", createdBy: "Jessica Taylor" },
  { id: "cn6", clientId: "cl7", content: "Roof replacement quote provided - decision pending HOA approval.", isInternal: true, createdAt: "2026-01-08", createdBy: "Demo Pro" },
  { id: "cn7", clientId: "cl7", content: "Key in lockbox - remember to reset after each visit.", isInternal: true, createdAt: "2025-03-22", createdBy: "Demo Pro" },
  { id: "cn8", clientId: "cl8", content: "Building requires 24hr advance notice for all visits - contact concierge.", isInternal: true, createdAt: "2024-09-01", createdBy: "Demo Pro" },
  { id: "cn9", clientId: "cl9", content: "Cat is shy but friendly. Keep bathroom door closed during service.", isInternal: true, createdAt: "2024-11-10", createdBy: "Demo Pro" },
  { id: "cn10", clientId: "cl13", content: "Dogs are loud but harmless. Owner will put them in backyard.", isInternal: true, createdAt: "2023-05-15", createdBy: "Demo Pro" },
];

// ============================================
// STORE INTERFACE
// ============================================

export interface BookingPolicies {
  requireDeposit: boolean;
  depositPercent: number;
  cancellationHours: number;
  cancellationFeePercent: number;
  rescheduleHours: number;
  maxReschedules: number;
}

interface ProviderState {
  // Data
  leads: Lead[];
  jobs: Job[];
  quotes: Quote[];
  messages: ProviderMessage[];
  invoices: Invoice[];
  payouts: Payout[];
  clients: Client[];
  clientActivities: ClientActivity[];
  clientNotes: ClientNote[];
  
  // Settings
  availableForWork: boolean;
  notificationsEnabled: boolean;
  bookingPolicies: BookingPolicies | null;
  
  // Computed stats (cached)
  _statsCache: ProviderStats | null;
  
  // Lead actions
  contactLead: (leadId: string) => void;
  declineLead: (leadId: string) => void;
  sendQuote: (leadId: string, quote: Omit<Quote, "id" | "leadId" | "createdAt" | "status">) => void;
  acceptLead: (leadId: string) => void;
  
  // Job actions
  scheduleJob: (leadId: string, date: string, time: string, price: number) => void;
  startJob: (jobId: string) => void;
  completeJob: (jobId: string) => void;
  cancelJob: (jobId: string) => void;
  
  // Invoice actions
  createInvoice: (jobId: string) => void;
  markInvoicePaid: (invoiceId: string) => void;
  
  // Payout actions
  requestPayout: (invoiceIds: string[]) => void;
  
  // Message actions
  sendMessage: (conversationId: string, content: string) => void;
  markConversationRead: (conversationId: string) => void;
  
  // Settings actions
  setAvailableForWork: (value: boolean) => void;
  setNotificationsEnabled: (value: boolean) => void;
  setBookingPolicies: (policies: BookingPolicies) => void;
  
  // Client actions
  addClientNote: (clientId: string, content: string, isInternal: boolean) => void;
  
  // Computed getters
  getStats: () => ProviderStats;
  getLeadsByStatus: (status: Lead["status"]) => Lead[];
  getJobsByStatus: (status: Job["status"]) => Job[];
  getUnreadMessageCount: () => number;
  getNextJob: () => Job | undefined;
  getRecentEarnings: () => number;
  getClientActivities: (clientId: string) => ClientActivity[];
  getClientNotes: (clientId: string) => ClientNote[];
  getClientJobHistory: (clientId: string) => Job[];
  getClientInvoices: (clientId: string) => Invoice[];
  
  // Initialization
  initializeWithMockData: () => void;
}

// ============================================
// STORE IMPLEMENTATION
// ============================================

export const useProviderStore = create<ProviderState>()(
  persist(
    (set, get) => ({
      // Initial data - empty arrays for new providers (no mock data)
      leads: [],
      jobs: [],
      quotes: [],
      messages: [],
      invoices: [],
      payouts: [],
      clients: [],
      clientActivities: [],
      clientNotes: [],
      
      availableForWork: true,
      notificationsEnabled: true,
      bookingPolicies: null,
      
      _statsCache: null,
      
      // Lead actions
      contactLead: (leadId) => {
        set((state) => ({
          leads: state.leads.map((l) =>
            l.id === leadId ? { ...l, status: "contacted" as const } : l
          ),
          _statsCache: null,
        }));
      },
      
      declineLead: (leadId) => {
        set((state) => ({
          leads: state.leads.map((l) =>
            l.id === leadId ? { ...l, status: "lost" as const } : l
          ),
          _statsCache: null,
        }));
      },
      
      sendQuote: (leadId, quoteData) => {
        const quote: Quote = {
          id: `q${Date.now()}`,
          leadId,
          ...quoteData,
          createdAt: new Date().toISOString(),
          status: "pending",
        };
        set((state) => ({
          quotes: [...state.quotes, quote],
          leads: state.leads.map((l) =>
            l.id === leadId ? { ...l, status: "quoted" as const } : l
          ),
          _statsCache: null,
        }));
      },
      
      acceptLead: (leadId) => {
        set((state) => ({
          leads: state.leads.map((l) =>
            l.id === leadId ? { ...l, status: "won" as const } : l
          ),
          _statsCache: null,
        }));
      },
      
      // Job actions
      scheduleJob: (leadId, date, time, price) => {
        const lead = get().leads.find((l) => l.id === leadId);
        if (!lead) return;
        
        const job: Job = {
          id: `j${Date.now()}`,
          leadId,
          customerName: lead.customerName,
          customerAvatar: lead.customerAvatar,
          service: lead.service,
          description: lead.description,
          address: lead.address,
          date,
          time,
          status: "scheduled",
          price,
        };
        
        set((state) => ({
          jobs: [...state.jobs, job],
          leads: state.leads.map((l) =>
            l.id === leadId ? { ...l, status: "won" as const } : l
          ),
          _statsCache: null,
        }));
      },
      
      startJob: (jobId) => {
        set((state) => ({
          jobs: state.jobs.map((j) =>
            j.id === jobId ? { ...j, status: "in_progress" as const } : j
          ),
          _statsCache: null,
        }));
      },
      
      completeJob: (jobId) => {
        set((state) => ({
          jobs: state.jobs.map((j) =>
            j.id === jobId
              ? { ...j, status: "completed" as const, completedAt: new Date().toISOString().split("T")[0] }
              : j
          ),
          _statsCache: null,
        }));
      },
      
      cancelJob: (jobId) => {
        set((state) => ({
          jobs: state.jobs.map((j) =>
            j.id === jobId ? { ...j, status: "cancelled" as const } : j
          ),
          _statsCache: null,
        }));
      },
      
      // Invoice actions
      createInvoice: (jobId) => {
        const job = get().jobs.find((j) => j.id === jobId);
        if (!job) return;
        
        const invoice: Invoice = {
          id: `inv${Date.now()}`,
          jobId,
          customerName: job.customerName,
          service: job.service,
          amount: job.price,
          date: new Date().toISOString().split("T")[0],
          dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
          status: "sent",
        };
        
        set((state) => ({
          invoices: [...state.invoices, invoice],
          _statsCache: null,
        }));
      },
      
      markInvoicePaid: (invoiceId) => {
        set((state) => ({
          invoices: state.invoices.map((inv) =>
            inv.id === invoiceId
              ? { ...inv, status: "paid" as const, paidAt: new Date().toISOString().split("T")[0] }
              : inv
          ),
          _statsCache: null,
        }));
      },
      
      // Payout actions
      requestPayout: (invoiceIds) => {
        const invoices = get().invoices.filter((inv) => invoiceIds.includes(inv.id));
        const total = invoices.reduce((sum, inv) => sum + inv.amount, 0);
        
        const payout: Payout = {
          id: `p${Date.now()}`,
          amount: total,
          invoiceIds,
          status: "pending",
          requestedAt: new Date().toISOString(),
          bankLast4: "4521",
        };
        
        set((state) => ({
          payouts: [...state.payouts, payout],
          _statsCache: null,
        }));
      },
      
      // Message actions
      sendMessage: (conversationId, content) => {
        const message: ChatMessage = {
          id: `msg${Date.now()}`,
          senderId: "provider",
          senderType: "provider",
          content,
          timestamp: "Just now",
          read: true,
        };
        
        set((state) => ({
          messages: state.messages.map((m) =>
            m.conversationId === conversationId
              ? {
                  ...m,
                  messages: [...m.messages, message],
                  lastMessage: content,
                  timestamp: "Just now",
                }
              : m
          ),
        }));
      },
      
      markConversationRead: (conversationId) => {
        set((state) => ({
          messages: state.messages.map((m) =>
            m.conversationId === conversationId
              ? {
                  ...m,
                  unreadCount: 0,
                  messages: m.messages.map((msg) => ({ ...msg, read: true })),
                }
              : m
          ),
          _statsCache: null,
        }));
      },
      
      // Settings actions
      setAvailableForWork: (value) => set({ availableForWork: value }),
      setNotificationsEnabled: (value) => set({ notificationsEnabled: value }),
      setBookingPolicies: (policies) => set({ bookingPolicies: policies }),
      
      // Computed getters
      getStats: () => {
        const state = get();
        
        const paidInvoices = state.invoices.filter((i) => i.status === "paid");
        const pendingInvoices = state.invoices.filter((i) => i.status === "sent");
        const totalEarnings = paidInvoices.reduce((sum, i) => sum + i.amount, 0);
        const pendingEarnings = pendingInvoices.reduce((sum, i) => sum + i.amount, 0);
        
        const completedPayouts = state.payouts.filter((p) => p.status === "completed");
        const paidOut = completedPayouts.reduce((sum, p) => sum + p.amount, 0);
        const availableBalance = totalEarnings - paidOut;
        
        return {
          totalEarnings,
          pendingEarnings,
          availableBalance,
          completedJobs: state.jobs.filter((j) => j.status === "completed").length,
          rating: 4.9,
          reviewCount: 45,
          responseRate: 98,
          upcomingJobs: state.jobs.filter((j) => j.status === "scheduled").length,
          newLeads: state.leads.filter((l) => l.status === "new").length,
          unreadMessages: state.messages.reduce((sum, m) => sum + m.unreadCount, 0),
        };
      },
      
      getLeadsByStatus: (status) => get().leads.filter((l) => l.status === status),
      getJobsByStatus: (status) => get().jobs.filter((j) => j.status === status),
      getUnreadMessageCount: () => get().messages.reduce((sum, m) => sum + m.unreadCount, 0),
      
      getNextJob: () => {
        const scheduledJobs = get().jobs
          .filter((j) => j.status === "scheduled")
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        return scheduledJobs[0];
      },
      
      getRecentEarnings: () => {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        return get()
          .invoices.filter(
            (i) => i.status === "paid" && new Date(i.paidAt || i.date) >= thirtyDaysAgo
          )
          .reduce((sum, i) => sum + i.amount, 0);
      },
      
      getClientActivities: (clientId) => {
        return get().clientActivities.filter((a) => a.clientId === clientId);
      },
      
      getClientNotes: (clientId) => {
        return get().clientNotes.filter((n) => n.clientId === clientId);
      },
      
      getClientJobHistory: (clientId) => {
        const client = get().clients.find((c) => c.id === clientId);
        if (!client) return [];
        return get().jobs.filter((j) => 
          j.customerName === client.name || 
          j.address === client.address
        );
      },
      
      getClientInvoices: (clientId) => {
        const client = get().clients.find((c) => c.id === clientId);
        if (!client) return [];
        return get().invoices.filter((i) => i.customerName === client.name);
      },
      
      // Client actions
      addClientNote: (clientId, content, isInternal) => {
        const note: ClientNote = {
          id: `cn${Date.now()}`,
          clientId,
          content,
          isInternal,
          createdAt: new Date().toISOString().split("T")[0],
          createdBy: "Demo Pro",
        };
        set((state) => ({
          clientNotes: [...state.clientNotes, note],
        }));
      },
      
      // Initialize with mock data (called when switching to provider mode)
      initializeWithMockData: () => {
        const state = get();
        if (state.clients.length === 0) {
          set({
            leads: initialLeads,
            jobs: initialJobs,
            messages: initialMessages,
            invoices: initialInvoices,
            payouts: initialPayouts,
            clients: initialClients,
            clientActivities: initialClientActivities,
            clientNotes: initialClientNotes,
          });
        }
      },
    }),
    {
      name: "provider-store",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        leads: state.leads,
        jobs: state.jobs,
        quotes: state.quotes,
        messages: state.messages,
        invoices: state.invoices,
        payouts: state.payouts,
        clients: state.clients,
        clientActivities: state.clientActivities,
        clientNotes: state.clientNotes,
        availableForWork: state.availableForWork,
        notificationsEnabled: state.notificationsEnabled,
      }),
    }
  )
);
