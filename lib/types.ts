// Database type definitions for Keyman Hotel

export interface Profile {
  id: string;
  full_name: string;
  role: 'ADMIN' | 'MANAGER' | 'STAFF' | 'CUSTOMER';
  created_at: string;
}

export interface Room {
  id: string;
  room_number: string;
  room_type: 'SINGLE' | 'DOUBLE' | 'TWIN';
  capacity: number;
  base_price: number;
  is_active: boolean;
  created_at: string;
}

export interface Booking {
  id: string;
  guest_id?: string;
  room_id: string;
  check_in: string;
  check_out: string;
  guests_count: number;
  breakfast: boolean;
  vehicle: boolean;
  status: 'PENDING' | 'CONFIRMED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED' | 'CLOSED';
  total_amount: number;
  created_by?: string;
  created_at: string;
}

export interface Payment {
  id: string;
  booking_id: string;
  amount_paid: number;
  method: 'MPESA' | 'CASH';
  receipt_url?: string;
  recorded_by: string;
  paid_at: string;
}

export interface Expense {
  id: string;
  category: string;
  description: string;
  amount: number;
  recorded_by: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  entity: string;
  entity_id: string;
  performed_by: string;
  created_at: string;
}

// Report types
export interface DailyRevenue {
  date: string;
  revenue: number;
  bookings_count: number;
}

export interface MonthlyRevenue {
  year: number;
  month: number;
  revenue: number;
  bookings_count: number;
}

export interface OccupancyRate {
  date: string;
  occupied_rooms: number;
  total_rooms: number;
  occupancy_rate: number;
}

export interface OutstandingBalance {
  id: string;
  guest_id?: string;
  total_amount: number;
  total_paid: number;
  balance: number;
}

export interface ExpensesSummary {
  category: string;
  total_amount: number;
  count: number;
}

export interface VehicleUsageReport {
  total_bookings_with_vehicle: number;
  total_vehicle_revenue: number;
  vehicle_booking_percentage: number;
}

export interface RoomPerformanceReport {
  room_type: string;
  total_bookings: number;
  total_revenue: number;
  average_revenue: number;
  occupancy_rate: number;
}

export interface StaffPerformanceReport {
  staff_id: string;
  staff_name: string;
  total_bookings_created: number;
  total_revenue: number;
  average_booking_value: number;
}

export interface RepeatCustomersReport {
  customer_id: string;
  customer_name: string;
  booking_count: number;
  is_repeat_customer: boolean;
}
