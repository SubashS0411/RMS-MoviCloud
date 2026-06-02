import { apiRequest } from "./client";

export interface Table {
  tableId: string;
  tableName: string;
  location: string;
  segment: string;
  capacity: number;
  /** Normalised lowercase from backend: 'available' | 'occupied' | 'reserved' | 'cleaning' */
  status?: string;
  isAvailable?: boolean;
}

export interface TableReservation {
  reservationId: string;
  userId: string;
  tableNumber: string;
  date: string;
  timeSlot: string;
  guests: number;
  location: string;
  segment: string;
  userName: string;
  userPhone: string;
  status: "Confirmed" | "Pending" | "Active";
}

export interface WaitingQueueEntry {
  queueId: string;
  userId: string;
  date: string;
  timeSlot: string;
  guests: number;
  position: number;
  estimatedWait: string;
}

export interface TimeSlot {
  id: string;
  label: string;
  startTime: string;  // "HH:mm" 24h format
  endTime: string;    // "HH:mm" 24h format
}

export async function fetchTimeSlots(): Promise<TimeSlot[]> {
  const res = await apiRequest<{ timeSlots: TimeSlot[] }>("/time-slots");
  return res.timeSlots;
}

export async function fetchTables(): Promise<Table[]> {
  const res = await apiRequest<{ tables: Table[] }>("/tables");
  return res.tables;
}

export async function fetchReservations(userId?: string): Promise<TableReservation[]> {
  const qs = userId ? `?userId=${encodeURIComponent(userId)}` : "";
  const res = await apiRequest<{ reservations: TableReservation[] }>(`/reservations${qs}`);
  return res.reservations;
}

export async function createReservation(reservation: TableReservation): Promise<TableReservation> {
  return apiRequest<TableReservation>("/reservations", { method: "POST", body: reservation });
}

export async function deleteReservation(reservationId: string): Promise<void> {
  await apiRequest<{ ok: true }>(`/reservations/${encodeURIComponent(reservationId)}`, { method: "DELETE" });
}

export async function fetchActiveReservation(userId: string): Promise<{
  active: boolean;
  reservation: TableReservation | null;
}> {
  return apiRequest<{ active: boolean; reservation: TableReservation | null }>(
    `/reservations/active?userId=${encodeURIComponent(userId)}`
  );
}

export async function activateReservation(reservationId: string): Promise<{
  ok: boolean;
  waiterId: string | null;
  waiterName: string;
  reservation: TableReservation;
}> {
  return apiRequest<{ ok: boolean; waiterId: string | null; waiterName: string; reservation: TableReservation }>(
    `/reservations/${encodeURIComponent(reservationId)}/activate`,
    { method: "POST" }
  );
}

export async function fetchReservationAvailability(params: {
  date: string;
  timeSlot: string;
  guests: number;
  location?: string;
  segment?: string;
}): Promise<{ tables: Table[]; showWaitingQueueOption: boolean }> {
  const qs = new URLSearchParams({
    date: params.date,
    timeSlot: params.timeSlot,
    guests: String(params.guests),
    location: params.location ?? "any",
    segment: params.segment ?? "any",
  });

  return apiRequest<{ tables: Table[]; showWaitingQueueOption: boolean }>(`/reservations/availability?${qs.toString()}`);
}

export async function fetchWaitingQueueEntries(userId?: string): Promise<WaitingQueueEntry[]> {
  const qs = userId ? `?userId=${encodeURIComponent(userId)}` : "";
  const res = await apiRequest<{ entries: WaitingQueueEntry[] }>(`/reservation-waiting-queue${qs}`);
  return res.entries;
}

export async function joinWaitingQueue(entry: {
  queueId: string;
  userId: string;
  date: string;
  timeSlot: string;
  guests: number;
}): Promise<WaitingQueueEntry> {
  return apiRequest<WaitingQueueEntry>("/reservation-waiting-queue", { method: "POST", body: entry });
}

export async function deleteWaitingQueueEntry(queueId: string): Promise<void> {
  await apiRequest<{ ok: true }>(`/reservation-waiting-queue/${encodeURIComponent(queueId)}`, { method: "DELETE" });
}
