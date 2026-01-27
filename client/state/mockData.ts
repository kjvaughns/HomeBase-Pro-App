export interface ServiceCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
}

export interface Provider {
  id: string;
  name: string;
  businessName: string;
  avatarUrl?: string;
  rating: number;
  reviewCount: number;
  services: string[];
  hourlyRate: number;
  verified: boolean;
}

export interface Booking {
  id: string;
  providerId: string;
  providerName: string;
  providerAvatar?: string;
  service: string;
  status: "pending" | "confirmed" | "in_progress" | "completed" | "cancelled";
  date: string;
  time: string;
  address: string;
  price: number;
}

export interface Message {
  id: string;
  recipientId: string;
  recipientName: string;
  recipientAvatar?: string;
  lastMessage: string;
  timestamp: string;
  unreadCount: number;
}

export interface Lead {
  id: string;
  customerName: string;
  customerAvatar?: string;
  service: string;
  description: string;
  address: string;
  budget: number;
  status: "new" | "contacted" | "quoted" | "won" | "lost";
  createdAt: string;
}

export interface Job {
  id: string;
  customerName: string;
  customerAvatar?: string;
  service: string;
  address: string;
  date: string;
  time: string;
  status: "scheduled" | "in_progress" | "completed";
  price: number;
}

export interface Earning {
  id: string;
  jobId: string;
  customerName: string;
  service: string;
  amount: number;
  date: string;
  status: "pending" | "paid" | "processing";
}

export const serviceCategories: ServiceCategory[] = [
  { id: "1", name: "Cleaning", icon: "home", color: "#38AE5F" },
  { id: "2", name: "Plumbing", icon: "droplet", color: "#38AE5F" },
  { id: "3", name: "Electrical", icon: "zap", color: "#38AE5F" },
  { id: "4", name: "Landscaping", icon: "sun", color: "#38AE5F" },
  { id: "5", name: "Painting", icon: "edit-3", color: "#38AE5F" },
  { id: "6", name: "HVAC", icon: "wind", color: "#38AE5F" },
  { id: "7", name: "Roofing", icon: "umbrella", color: "#38AE5F" },
  { id: "8", name: "Handyman", icon: "tool", color: "#38AE5F" },
];

export const featuredProviders: Provider[] = [
  {
    id: "1",
    name: "John Smith",
    businessName: "Smith's Plumbing",
    rating: 4.9,
    reviewCount: 127,
    services: ["Plumbing"],
    hourlyRate: 85,
    verified: true,
  },
  {
    id: "2",
    name: "Maria Garcia",
    businessName: "Sparkle Clean Co",
    rating: 4.8,
    reviewCount: 89,
    services: ["Cleaning"],
    hourlyRate: 45,
    verified: true,
  },
  {
    id: "3",
    name: "Mike Johnson",
    businessName: "Johnson Electric",
    rating: 4.7,
    reviewCount: 156,
    services: ["Electrical"],
    hourlyRate: 95,
    verified: true,
  },
];

export const mockBookings: Booking[] = [
  {
    id: "1",
    providerId: "1",
    providerName: "John Smith",
    service: "Plumbing Repair",
    status: "confirmed",
    date: "2026-01-30",
    time: "10:00 AM",
    address: "123 Main St, San Francisco, CA",
    price: 250,
  },
  {
    id: "2",
    providerId: "2",
    providerName: "Maria Garcia",
    service: "Deep Cleaning",
    status: "pending",
    date: "2026-02-02",
    time: "9:00 AM",
    address: "456 Oak Ave, San Francisco, CA",
    price: 180,
  },
  {
    id: "3",
    providerId: "3",
    providerName: "Mike Johnson",
    service: "Electrical Inspection",
    status: "completed",
    date: "2026-01-20",
    time: "2:00 PM",
    address: "789 Pine Blvd, San Francisco, CA",
    price: 150,
  },
];

export const mockMessages: Message[] = [
  {
    id: "1",
    recipientId: "1",
    recipientName: "John Smith",
    lastMessage: "I'll be there at 10 AM tomorrow!",
    timestamp: "2 min ago",
    unreadCount: 2,
  },
  {
    id: "2",
    recipientId: "2",
    recipientName: "Maria Garcia",
    lastMessage: "Thank you for the booking confirmation.",
    timestamp: "1 hour ago",
    unreadCount: 0,
  },
  {
    id: "3",
    recipientId: "3",
    recipientName: "Mike Johnson",
    lastMessage: "The job is complete. Please leave a review!",
    timestamp: "Yesterday",
    unreadCount: 0,
  },
];

export const mockLeads: Lead[] = [
  {
    id: "1",
    customerName: "Sarah Wilson",
    service: "Bathroom Renovation",
    description: "Need complete bathroom remodel including new fixtures and tiling.",
    address: "321 Elm St, San Francisco, CA",
    budget: 5000,
    status: "new",
    createdAt: "2 hours ago",
  },
  {
    id: "2",
    customerName: "David Brown",
    service: "Kitchen Plumbing",
    description: "Install new garbage disposal and fix leaky faucet.",
    address: "654 Maple Dr, San Francisco, CA",
    budget: 350,
    status: "contacted",
    createdAt: "1 day ago",
  },
  {
    id: "3",
    customerName: "Emily Chen",
    service: "Water Heater Replacement",
    description: "Replace old 40-gallon water heater with tankless system.",
    address: "987 Cedar Ln, San Francisco, CA",
    budget: 2500,
    status: "quoted",
    createdAt: "3 days ago",
  },
];

export const mockJobs: Job[] = [
  {
    id: "1",
    customerName: "Robert Taylor",
    service: "Pipe Repair",
    address: "111 First Ave, San Francisco, CA",
    date: "2026-01-28",
    time: "9:00 AM",
    status: "scheduled",
    price: 275,
  },
  {
    id: "2",
    customerName: "Jennifer Lee",
    service: "Drain Cleaning",
    address: "222 Second St, San Francisco, CA",
    date: "2026-01-29",
    time: "1:00 PM",
    status: "scheduled",
    price: 150,
  },
  {
    id: "3",
    customerName: "Michael White",
    service: "Faucet Installation",
    address: "333 Third Blvd, San Francisco, CA",
    date: "2026-01-27",
    time: "11:00 AM",
    status: "in_progress",
    price: 200,
  },
];

export const mockEarnings: Earning[] = [
  {
    id: "1",
    jobId: "j1",
    customerName: "Alice Johnson",
    service: "Emergency Plumbing",
    amount: 450,
    date: "2026-01-25",
    status: "paid",
  },
  {
    id: "2",
    jobId: "j2",
    customerName: "Bob Williams",
    service: "Bathroom Repair",
    amount: 320,
    date: "2026-01-23",
    status: "paid",
  },
  {
    id: "3",
    jobId: "j3",
    customerName: "Carol Davis",
    service: "Kitchen Plumbing",
    amount: 280,
    date: "2026-01-20",
    status: "processing",
  },
];

export const providerStats = {
  totalEarnings: 4850,
  pendingEarnings: 750,
  completedJobs: 23,
  rating: 4.9,
  reviewCount: 45,
  responseRate: 98,
  upcomingJobs: 5,
  newLeads: 3,
};
