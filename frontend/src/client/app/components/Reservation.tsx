import { useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, Clock, Users, CheckCircle, RefreshCw, MapPin, LayoutGrid, Phone, User as UserIcon, XCircle, Search, ArrowLeft, ArrowRight } from 'lucide-react';
import type { User } from '@/client/app/App';
import {
  createReservation,
  deleteReservation,
  deleteWaitingQueueEntry,
  fetchReservationAvailability,
  fetchReservations,
  fetchTables,
  fetchWaitingQueueEntries,
  joinWaitingQueue,
} from '@/client/api/reservations';
import reservationBg from '@/client/assets/bc26fc098845bd66b4573c68aa0755232c104a7c.png';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import '@/styles/datepicker.css';
import '@/styles/reservation.css';

interface ReservationProps {
  user: User;
  onNavigate?: (module: any) => void;
}

type ReservationTab = 'check' | 'my-reservations';

// Database-like structure for individual tables
interface Table {
  tableId: string;
  tableName: string;
  location: string;
  segment: string;
  capacity: number;
}

// Database-like structure for table reservations
interface TableReservation {
  reservationId: string; // Primary Key
  userId: string; // Foreign Key (user email in this case)
  tableNumber: string;
  date: string;
  timeSlot: string;
  guests: number;
  location: string;
  segment: string;
  userName: string;
  userPhone: string;
  status: 'Confirmed' | 'Pending';
}

interface WaitingQueueEntry {
  queueId: string;
  userId: string; // Foreign Key
  date: string;
  timeSlot: string;
  guests: number;
  position: number;
  estimatedWait: string;
}

// Fixed time slots available for reservation
const TIME_SLOTS = [
  { label: '7:30 AM - 8:50 AM',   startTime: '07:30', endTime: '08:50' },
  { label: '9:10 AM - 10:30 AM',  startTime: '09:10', endTime: '10:30' },
  { label: '12:00 PM - 1:20 PM',  startTime: '12:00', endTime: '13:20' },
  { label: '1:40 PM - 3:00 PM',   startTime: '13:40', endTime: '15:00' },
  { label: '6:40 PM - 8:00 PM',   startTime: '18:40', endTime: '20:00' },
  { label: '8:20 PM - 9:40 PM',   startTime: '20:20', endTime: '21:40' },
];

// Tables and locations/segments are fetched dynamically from the backend
// (which reads from the same MongoDB collection managed by the admin panel).

// Sample reservations (kept in frontend; backend will override when available)
function getSampleReservations(user: User): TableReservation[] {
  return [
    {
      reservationId: 'RES001',
      userId: user.email,
      tableNumber: '5',
      date: '2026-02-10',
      timeSlot: '7:30 AM – 8:50 AM',
      guests: 4,
      location: 'Main Hall',
      segment: 'Window Seat',
      userName: user.name,
      userPhone: '9876543210',
      status: 'Confirmed',
    },
    {
      reservationId: 'RES002',
      userId: user.email,
      tableNumber: '8',
      date: '2026-02-15',
      timeSlot: '6:40 PM – 8:00 PM',
      guests: 2,
      location: 'VIP Hall',
      segment: 'Corner Table',
      userName: user.name,
      userPhone: '9876543210',
      status: 'Pending',
    },
  ];
}

// Sample waiting queue entries (kept in frontend; backend will override when available)
function getSampleWaitingQueue(user: User): WaitingQueueEntry[] {
  return [
    {
      queueId: 'QUEUE001',
      userId: user.email,
      date: '2026-02-08',
      timeSlot: '6:40 PM – 8:00 PM',
      guests: 3,
      position: 2,
      estimatedWait: '15-20 mins',
    },
  ];
}

export default function Reservation({ user, onNavigate }: ReservationProps) {
  const reservationSectionRef = useRef<HTMLElement>(null);
  const [activeTab, setActiveTab] = useState<ReservationTab>('check');
  const [step, setStep] = useState<'form' | 'success'>('form');
  const [uiMode, setUiMode] = useState<'search' | 'results' | 'all'>('search');
  const [isLoading, setIsLoading] = useState(false);

  const [reservePopup, setReservePopup] = useState<{
    show: boolean;
    table: Table | null;
    name: string;
    phone: string;
  }>({
    show: false,
    table: null,
    name: user.name,
    phone: ''
  });

  // Confirmation Dialog State
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmDialogData, setConfirmDialogData] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const [tableReservations, setTableReservations] = useState<TableReservation[]>(() => getSampleReservations(user));
  const [waitingQueue, setWaitingQueue] = useState<WaitingQueueEntry[]>(() => getSampleWaitingQueue(user));

  const [bookingData, setBookingData] = useState({
    date: null as Date | null,
    startTime: '',
    endTime: '',
    guests: 'any',
    location: 'any',
    segment: 'any',
    name: user.name,
    phone: ''
  });

  const [checkData, setCheckData] = useState({
    date: null as Date | null,
    startTime: '',
    endTime: '',
    guests: 'any',
    location: 'any',
    segment: 'any'
  });

  const [availabilityResults, setAvailabilityResults] = useState<any[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [viewingAllTables, setViewingAllTables] = useState(false);
  const [showWaitingQueueOption, setShowWaitingQueueOption] = useState(false);
  const [selectedFullSlot, setSelectedFullSlot] = useState<string>('');

  // All tables fetched from backend (admin-managed)
  const [allTables, setAllTables] = useState<Table[]>([]);
  const totalTables = allTables.length;

  // ── Helper: format 24h "HH:mm" → "h:mm AM/PM" ──
  const formatTime12h = (time24: string): string => {
    if (!time24) return '';
    const [h, m] = time24.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
  };

  // Helper for consistent local date string (YYYY-MM-DD)
  const getLocalDateString = (date: Date | null) => {
    if (!date) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Check if a reservation has expired
  const isReservationExpired = (reservationDate: string, timeSlot: string): boolean => {
    try {
      // Parse the reservation date (YYYY-MM-DD)
      const parts = reservationDate.split('-');
      if (parts.length !== 3) return false;
      
      const resDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      const today = new Date();
      
      // Reset time to midnight for date comparison
      resDate.setHours(0, 0, 0, 0);
      today.setHours(0, 0, 0, 0);
      
      // If reservation date is in the past, it's expired
      if (resDate < today) {
        return true;
      }
      
      // If reservation date is today, check the time slot end time
      if (resDate.getTime() === today.getTime()) {
        // Extract end time from timeSlot (e.g., "7:30 AM – 8:50 AM")
        const timeMatch = timeSlot.match(/(\d{1,2}):(\d{2})\s*(AM|PM).*?–.*?(\d{1,2}):(\d{2})\s*(AM|PM)/i);
        if (timeMatch) {
          const endHour = parseInt(timeMatch[4]);
          const endMin = parseInt(timeMatch[5]);
          const endAmPm = timeMatch[6].toUpperCase();
          
          let endTime = endHour;
          if (endAmPm === 'PM' && endHour !== 12) endTime += 12;
          if (endAmPm === 'AM' && endHour === 12) endTime = 0;
          
          const now = new Date();
          const currentHour = now.getHours();
          const currentMin = now.getMinutes();
          
          // Check if current time is past the end time
          if (currentHour > endTime || (currentHour === endTime && currentMin >= endMin)) {
            return true;
          }
        }
      }
      
      return false;
    } catch (error) {
      console.error('Error checking reservation expiry:', error);
      return false;
    }
  };

  // Wrap derived data in useMemo for performance
  const guestOptions = useMemo(() => [1, 2, 3, 4, 5, 6, 7, 8], []);
  // Derive locations & segments from the actual tables in the database
  const locations = useMemo(() => {
    const locs = [...new Set(allTables.map(t => t.location).filter(Boolean))];
    return locs.length > 0 ? locs : ['VIP Hall', 'AC Hall', 'Main Hall'];
  }, [allTables]);
  const segments = useMemo(() => {
    const segs = [...new Set(allTables.map(t => t.segment).filter(Boolean))];
    return segs.length > 0 ? segs : ['Front', 'Back'];
  }, [allTables]);

  const scrollToReservationSection = () => {
    reservationSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Build a readable time slot label from start/end
  const buildTimeSlot = (startTime: string, endTime: string): string => {
    if (!startTime || !endTime) return '';
    return `${formatTime12h(startTime)} – ${formatTime12h(endTime)}`;
  };

  // Computed time slot labels
  const checkTimeSlot = buildTimeSlot(checkData.startTime, checkData.endTime);
  const bookingTimeSlot = buildTimeSlot(bookingData.startTime, bookingData.endTime);

  // Get my reservations from table reservations with computed display status
  const myReservations = useMemo(() =>
    tableReservations
      .filter(res => res.userId === user.email)
      .map(res => ({
        ...res,
        displayStatus: isReservationExpired(res.date, res.timeSlot) ? 'Closed' : res.status
      }))
    , [tableReservations, user.email]);

  const parseAndFormatDisplayDate = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      return date.toLocaleDateString('en-IN', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    }
    return new Date(dateStr).toLocaleDateString('en-IN', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Get my waiting queue entries
  const myWaitingQueue = useMemo(() =>
    waitingQueue.filter(entry => entry.userId === user.email)
    , [waitingQueue, user.email]);

  // Local fallback helpers (when backend is offline)
  const getReservedTableNumbers = (date: Date | null, timeSlot: string): string[] => {
    if (!date) return [];
    const dateStr = getLocalDateString(date);
    return tableReservations
      .filter(res => res.date === dateStr && res.timeSlot === timeSlot && !isReservationExpired(res.date, res.timeSlot))
      .map(res => String(res.tableNumber));
  };

  const getNextAvailableTable = (date: Date | null, timeSlot: string): string | null => {
    if (!date) return null;
    const reservedTables = getReservedTableNumbers(date, timeSlot);
    for (const t of allTables) {
      if (!reservedTables.includes(t.tableId)) {
        return t.tableId;
      }
    }
    return null;
  };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [reservations, entries, tablesRes] = await Promise.all([
          fetchReservations(user.email),
          fetchWaitingQueueEntries(user.email),
          fetchTables(),
        ]);
        if (cancelled) return;
        setTableReservations(reservations as any);
        setWaitingQueue(entries as any);
        setAllTables(tablesRes);
      } catch {
        // Keep UI usable if backend is offline (sample data stays)
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user.email]);

  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!bookingData.date || !bookingData.startTime || !bookingData.endTime) {
      alert('Please select date, start time and end time');
      return;
    }

    const newReservation: TableReservation = {
      reservationId: `RES${Date.now()}`,
      userId: user.email,
      tableNumber: '',
      date: getLocalDateString(bookingData.date),
      timeSlot: bookingTimeSlot,
      guests: parseInt(bookingData.guests),
      location: bookingData.location,
      segment: bookingData.segment,
      userName: bookingData.name,
      userPhone: bookingData.phone,
      status: 'Confirmed',
    };

    try {
      const created = await createReservation(newReservation as any);
      setTableReservations((prev) => [...prev, created as any]);
      setStep('success');
    } catch (err: any) {
      // Offline fallback (keep sample/local logic)
      if (String(err?.message || '').includes('no_tables_available')) {
        alert('No tables available for this time slot. Please check availability or join the waiting queue.');
        return;
      }

      const tableNumber = getNextAvailableTable(bookingData.date, bookingTimeSlot);
      if (tableNumber === null) {
        alert('No tables available for this time slot. Please check availability or join the waiting queue.');
        return;
      }

      const localReservation: TableReservation = {
        ...newReservation,
        tableNumber,
      };

      setTableReservations((prev) => [...prev, localReservation]);
      setStep('success');
    }
  };

  const handleCheckAvailability = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!checkData.date || !checkData.startTime) {
      alert('Please select a date and time slot');
      return;
    }

    setIsLoading(true);
    try {
      const dateStr = getLocalDateString(checkData.date);
      const res = await fetchReservationAvailability({
        date: dateStr,
        timeSlot: checkTimeSlot,
        guests: checkData.guests === 'any' ? 0 : parseInt(checkData.guests),
        location: checkData.location,
        segment: checkData.segment,
      });

      // Fetch all reservations for this slot to calculate overall availability
      const totalReservedInSlot = tableReservations.filter(r => r.date === dateStr && r.timeSlot === checkTimeSlot && !isReservationExpired(r.date, r.timeSlot)).length;

      setAvailabilityResults(res.tables.map((t: any) => ({
        ...t,
        totalReservedInSlot,
        totalAvailableInSlot: totalTables - totalReservedInSlot
      })) as any);
      setUiMode('results');
      setShowResults(true);
      setViewingAllTables(false);
      setShowWaitingQueueOption(Boolean(res.showWaitingQueueOption));
      setSelectedFullSlot(res.showWaitingQueueOption ? checkTimeSlot : '');
    } catch {
      // Offline fallback: compute availability from sample tables + current local reservations
      const dateStr = getLocalDateString(checkData.date);

      const reservedTableIds = tableReservations
        .filter(res => res.date === dateStr && res.timeSlot === checkTimeSlot && !isReservationExpired(res.date, res.timeSlot))
        .map(res => String(res.tableNumber));

      const totalReservedInSlot = tableReservations.filter(r => r.date === dateStr && r.timeSlot === checkTimeSlot && !isReservationExpired(r.date, r.timeSlot)).length;

      const filteredTables = allTables.filter(table => {
        const locationMatch = checkData.location === 'any' || table.location.toLowerCase() === checkData.location.toLowerCase();
        const segmentMatch = checkData.segment === 'any' || table.segment.toLowerCase().includes(checkData.segment.split(' ')[0].toLowerCase());
        const capacityMatch = checkData.guests === 'any' || table.capacity >= parseInt(checkData.guests);
        return locationMatch && segmentMatch && capacityMatch;
      });

      const tablesWithStatus = filteredTables.map(table => ({
        ...table,
        isAvailable: !reservedTableIds.includes(table.tableId),
        totalReservedInSlot,
        totalAvailableInSlot: totalTables - totalReservedInSlot
      }));

      setAvailabilityResults(tablesWithStatus as any);
      setUiMode('results');
      setShowResults(true);
      setViewingAllTables(false);

      const allBooked = tablesWithStatus.every((t: any) => !t.isAvailable);
      if (allBooked && tablesWithStatus.length > 0) {
        setShowWaitingQueueOption(true);
        setSelectedFullSlot(checkTimeSlot);
      } else {
        setShowWaitingQueueOption(false);
        setSelectedFullSlot('');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleReserveClick = (table: Table) => {
    setReservePopup({
      ...reservePopup,
      show: true,
      table,
      phone: ''
    });
  };

  const handleConfirmReservation = async () => {
    if (!reservePopup.table) return;
    if (!checkData.date) {
      alert('Please select a date before reserving.');
      return;
    }
    if (!checkData.startTime) {
      alert('Please select a time slot before reserving.');
      return;
    }

    if (reservePopup.phone.length !== 10 || !/^\d+$/.test(reservePopup.phone)) {
      alert('Please enter a valid 10-digit phone number');
      return;
    }

    // Determine the correct guest count: use selected value if numeric, otherwise use table capacity
    const resolvedGuests = checkData.guests !== 'any' ? parseInt(checkData.guests) : reservePopup.table.capacity;

    const newReservation: TableReservation = {
      reservationId: `RES${Date.now()}`,
      userId: user.email,
      tableNumber: reservePopup.table.tableId,
      date: getLocalDateString(checkData.date),
      timeSlot: checkTimeSlot,
      guests: resolvedGuests,
      location: reservePopup.table.location,
      segment: reservePopup.table.segment,
      userName: reservePopup.name,
      userPhone: reservePopup.phone,
      status: 'Confirmed',
    };

    const updatedBookingData = {
      ...bookingData,
      date: checkData.date,
      startTime: checkData.startTime,
      endTime: checkData.endTime,
      guests: String(resolvedGuests),
      name: reservePopup.name,
      phone: reservePopup.phone,
      segment: reservePopup.table?.segment || '',
      location: reservePopup.table?.location || ''
    };

    try {
      const created = await createReservation(newReservation as any);
      setTableReservations((prev) => [...prev, created as any]);
      setBookingData(updatedBookingData);
      setStep('success');
      setReservePopup({ ...reservePopup, show: false });
    } catch (err: any) {
      console.error('[Reservation] createReservation failed:', err);
      // Offline fallback
      setTableReservations((prev) => [...prev, newReservation]);
      setBookingData(updatedBookingData);
      setStep('success');
      setReservePopup({ ...reservePopup, show: false });
    }
  };

  const handleRefresh = async () => {
    // Re-run the check instead of clearing results for better UX
    if (checkData.date && checkData.startTime && checkData.endTime) {
      const mockEvent = { preventDefault: () => { } } as React.FormEvent;
      await handleCheckAvailability(mockEvent);
    } else {
      setShowResults(false);
      setAvailabilityResults([]);
    }

    // Visual feedback for refresh
    const refreshBtn = document.querySelector('.refresh-btn');
    refreshBtn?.classList.add('animate-spin');
    setTimeout(() => {
      refreshBtn?.classList.remove('animate-spin');
    }, 500);
  };

  const handleNewReservation = () => {
    setBookingData({
      date: null,
      startTime: '',
      endTime: '',
      guests: 'any',
      location: 'any',
      segment: 'any',
      name: user.name,
      phone: ''
    });
    setStep('form');
    setActiveTab('check');
  };

  const handleCancelReservation = (reservationId: string) => {
    setConfirmDialogData({
      title: 'Cancel Reservation',
      message: 'Are you sure you want to cancel this reservation?',
      onConfirm: async () => {
        // Optimistic update
        setTableReservations(prev => prev.filter(reservation => reservation.reservationId !== reservationId));
        setShowConfirmDialog(false);

        try {
          const success = await deleteReservation(reservationId);
        } catch {
          // Refresh list from server on failure to sync
          const serverRes = await fetchReservations(user.email);
          setTableReservations(serverRes as any);
          alert('Failed to cancel reservation. Please try again.');
        }
      },
    });
    setShowConfirmDialog(true);
  };

  const handleLeaveQueue = (queueId: string) => {
    setConfirmDialogData({
      title: 'Leave Queue',
      message: 'Are you sure you want to leave this queue?',
      onConfirm: async () => {
        // Optimistic update
        const previousQueue = [...waitingQueue];
        setWaitingQueue(waitingQueue.filter(item => item.queueId !== queueId));
        setShowConfirmDialog(false);

        try {
          await deleteWaitingQueueEntry(queueId);
        } catch {
          // Revert if failed
          setWaitingQueue(previousQueue);
          alert('Failed to leave queue. Please try again.');
        }
      },
    });
    setShowConfirmDialog(true);
  };

  const handleJoinWaitingQueue = (table?: Table) => {
    // Build the data to pass to the Queue page
    const queueData: Record<string, string> = {
      queueDate: getLocalDateString(checkData.date),
      timeSlot: checkTimeSlot,
      guests: checkData.guests === 'any' ? '2' : checkData.guests,
      location: checkData.location === 'any' ? 'Any' : checkData.location,
      segment: checkData.segment === 'any' ? 'Any' : checkData.segment,
    };

    // If coming from a specific table row, include table details
    if (table) {
      queueData.tableName = table.tableName;
      queueData.tableId = table.tableId;
      queueData.tableLocation = table.location;
      queueData.tableSegment = table.segment;
      queueData.tableCapacity = String(table.capacity);
      // Use table's actual location/segment
      queueData.location = table.location;
      queueData.segment = table.segment;
    }

    localStorage.setItem('pendingQueueData', JSON.stringify(queueData));

    if (onNavigate) {
      onNavigate('queue');
    } else {
      alert('Redirecting to the waiting queue page...');
    }
  };

  if (step === 'success') {
    return (
      <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center py-12 px-6">
        <div className="max-w-lg w-full bg-white rounded-xl border border-[#8B5A2B]/20 shadow-xl p-8">
          <div className="text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-12 h-12 text-green-600" />
            </div>
            <h2 className="text-3xl font-bold mb-2 text-[#8B5A2B]">Reservation Confirmed!</h2>
            <p className="text-gray-700 mb-8">
              Your table has been reserved successfully
            </p>

            <div className="bg-[#FAF7F2] rounded-lg p-6 mb-6 text-left border border-[#8B5A2B]/10">
              <h3 className="font-semibold mb-4 text-[#8B5A2B]">Reservation Details</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Name:</span>
                  <span className="font-medium text-[#3E2723]">{bookingData.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Date:</span>
                  <span className="font-medium text-[#3E2723]">{bookingData.date ? new Date(bookingData.date).toLocaleDateString('en-IN', { dateStyle: 'long' }) : ''}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Time:</span>
                  <span className="font-medium text-[#3E2723]">{buildTimeSlot(bookingData.startTime, bookingData.endTime)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Guests:</span>
                  <span className="font-medium text-[#3E2723]">{bookingData.guests && bookingData.guests !== 'any' ? bookingData.guests : '—'} people</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Location:</span>
                  <span className="font-medium capitalize text-[#3E2723]">{bookingData.location}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Segment:</span>
                  <span className="font-medium text-[#3E2723]">{bookingData.segment}</span>
                </div>
              </div>
            </div>

            <button
              onClick={handleNewReservation}
              className="w-full bg-[#8B5A2B] text-white py-3 rounded-lg font-semibold hover:bg-[#6D4822] transition-colors shadow-md"
            >
              Make Another Reservation
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF7F2]">
      {/* SECTION 1 — HERO HEADER (First Slide) */}
      {uiMode === 'search' && (
        <section className="relative w-full h-screen flex items-center justify-center overflow-hidden">
          {/* Background Image with Animation */}
          <div className="absolute inset-0">
            <img
              src={reservationBg}
              alt="Restaurant Reservation"
              className="reservation-hero-bg w-full h-full object-cover object-center"
            />
            {/* Dark Overlay for better text readability */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/70"></div>
          </div>

          {/* Content - Positioned in the center with animations */}
          <div className="relative z-10 max-w-4xl mx-auto text-center px-6">
            <h1
              className="reservation-hero-title text-3xl sm:text-5xl md:text-7xl font-bold mb-4 sm:mb-6 text-white drop-shadow-2xl"
             
            >
              Table Reservation
            </h1>
            <p className="reservation-hero-subtitle text-base sm:text-xl md:text-2xl text-white/90 font-light leading-relaxed">
              No waiting, No worries - just great dining.<br />
              Reserve your table and enjoy every moment.
            </p>
            <button
              onClick={scrollToReservationSection}
              className="group mt-8 bg-[#8B5A2B] text-white px-10 py-4 rounded-lg hover:bg-[#6D4C41] transition-all shadow-lg hover:shadow-xl flex items-center gap-3 mx-auto"
            >
              Reserve Table
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </section>
      )}

      {/* SECTION 2 — RESERVATION OPERATIONS (Second Slide - Scrollable) */}
      <section ref={reservationSectionRef} className="relative py-10 sm:py-20 px-4 sm:px-6 min-h-screen">
        <div className="max-w-6xl mx-auto">
          {/* Tab Navigation */}
          {uiMode === 'search' && (
            <div className="bg-white/95 backdrop-blur-sm rounded-t-2xl border-t border-x border-[#8B5A2B]/20 p-2 flex flex-wrap gap-2">
              <button
                onClick={() => setActiveTab('check')}
                className={`flex-1 min-w-[140px] px-4 sm:px-6 py-3 sm:py-4 rounded-lg font-bold transition-all flex items-center justify-center gap-2 text-sm sm:text-base ${activeTab === 'check'
                  ? 'bg-[#8B5A2B] text-white shadow-lg scale-[1.02]'
                  : 'bg-transparent text-[#8B5A2B] hover:bg-[#8B5A2B]/10'
                  }`}
              >
                <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
                Check Availability
              </button>
              <button
                onClick={() => setActiveTab('my-reservations')}
                className={`flex-1 min-w-[140px] px-4 sm:px-6 py-3 sm:py-4 rounded-lg font-bold transition-all flex items-center justify-center gap-2 text-sm sm:text-base ${activeTab === 'my-reservations'
                  ? 'bg-[#8B5A2B] text-white shadow-lg scale-[1.02]'
                  : 'bg-transparent text-[#8B5A2B] hover:bg-[#8B5A2B]/10'
                  }`}
              >
                <LayoutGrid className="w-4 h-4 sm:w-5 sm:h-5" />
                My Reservations
              </button>
            </div>
          )}

          {/* Tab Content */}
          <div className={`bg-white/95 backdrop-blur-sm rounded-2xl ${uiMode === 'search' ? 'rounded-t-none' : ''} border border-[#8B5A2B]/20 shadow-xl p-4 sm:p-8`}>

            {/* Check Availability Tab */}
            {activeTab === 'check' && uiMode === 'search' && (
              <div>
                <div className="flex justify-between items-center mb-8">
                  <h2 className="text-3xl font-bold text-[#8B5A2B]">
                    Check Table Availability
                  </h2>
                  <button
                    onClick={() => {
                      if (!checkData.date) {
                        setCheckData({ ...checkData, date: new Date() });
                      }
                      setViewingAllTables(true);
                      setUiMode('all');
                    }}
                    className="flex items-center gap-2 px-6 py-3 bg-white border-2 border-[#8B5A2B] text-[#8B5A2B] rounded-lg hover:bg-[#8B5A2B]/10 transition-all font-bold"
                  >
                    <LayoutGrid className="w-5 h-5" />
                    View All Tables
                  </button>
                </div>

                <form onSubmit={handleCheckAvailability} className="space-y-6 mb-8">
                  <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
                    {/* Date */}
                    <div>
                      <label className="block text-sm font-semibold mb-2 text-gray-800">Date</label>
                      <DatePicker
                        selected={checkData.date}
                        onChange={(date: Date | null) => {
                          setCheckData({ ...checkData, date });
                        }}
                        minDate={new Date()}
                        dateFormat="dd/MM/yyyy"
                        placeholderText="Select a date"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-[#8B5A2B] focus:ring-2 focus:ring-[#8B5A2B]/20"
                        required
                      />
                    </div>

                    {/* Time Slot */}
                    <div>
                      <label className="block text-sm font-semibold mb-2 text-gray-800">Time Slot</label>
                      <select
                        value={checkData.startTime}
                        onChange={(e) => {
                          const slot = TIME_SLOTS.find(s => s.startTime === e.target.value);
                          setCheckData({ ...checkData, startTime: slot?.startTime ?? '', endTime: slot?.endTime ?? '' });
                        }}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-[#8B5A2B] focus:ring-2 focus:ring-[#8B5A2B]/20"
                        required
                      >
                        <option value="">Select a slot</option>
                        {TIME_SLOTS.map((slot) => (
                          <option key={slot.startTime} value={slot.startTime}>{slot.label}</option>
                        ))}
                      </select>
                    </div>

                    {/* Guests */}
                    <div>
                      <label className="block text-sm font-semibold mb-2 text-gray-800">Guests</label>
                      <select
                        value={checkData.guests}
                        onChange={(e) => setCheckData({ ...checkData, guests: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-[#8B5A2B] focus:ring-2 focus:ring-[#8B5A2B]/20"
                      >
                        <option value="any">Number of guest</option>
                        {guestOptions.map((num) => (
                          <option key={num} value={num}>{num}</option>
                        ))}
                      </select>
                    </div>

                    {/* Location */}
                    <div>
                      <label className="block text-sm font-semibold mb-2 text-gray-800">Location</label>
                      <select
                        value={checkData.location}
                        onChange={(e) => setCheckData({ ...checkData, location: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-[#8B5A2B] focus:ring-2 focus:ring-[#8B5A2B]/20"
                      >
                        <option value="any">Any Location</option>
                        {locations.map((loc) => (
                          <option key={loc} value={loc.toLowerCase()}>{loc}</option>
                        ))}
                      </select>
                    </div>

                    {/* Segment */}
                    <div>
                      <label className="block text-sm font-semibold mb-2 text-gray-800">Segment</label>
                      <select
                        value={checkData.segment}
                        onChange={(e) => setCheckData({ ...checkData, segment: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-[#8B5A2B] focus:ring-2 focus:ring-[#8B5A2B]/20"
                      >
                        <option value="any">Any Segment</option>
                        {segments.map((seg) => (
                          <option key={seg} value={seg.toLowerCase()}>{seg}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={!checkData.date || !checkData.startTime || isLoading}
                    className="w-full bg-[#8B5A2B] text-white py-4 rounded-lg font-bold text-lg hover:bg-[#6D4822] transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed shadow-md flex items-center justify-center gap-3"
                  >
                    {isLoading ? (
                      <>
                        <RefreshCw className="w-5 h-5 animate-spin" />
                        Checking Availability...
                      </>
                    ) : (
                      'Check Availability'
                    )}
                  </button>
                </form>
              </div>
            )}

            {/* Availability Results / All Tables Alone */}
            {(uiMode === 'results' || uiMode === 'all') && (
              <div className="space-y-6">
                <div className="flex justify-between items-center bg-[#FAF7F2] p-6 rounded-2xl border border-[#8B5A2B]/10">
                  <div>
                    <h2 className="text-3xl font-bold text-[#8B5A2B]">
                      {uiMode === 'all' ? 'All Restaurant Tables' : 'Availability Results'}
                    </h2>
                    <p className="text-gray-600 mt-1">
                      {uiMode === 'all'
                        ? `Showing all ${totalTables} tables in the restaurant.`
                        : `Showing matches for ${checkData.date?.toLocaleDateString()} at ${checkTimeSlot || 'all times'}.`}
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={handleRefresh}
                      className="refresh-btn flex items-center gap-2 px-4 py-2 bg-white border border-[#8B5A2B]/30 text-[#8B5A2B] rounded-lg hover:bg-[#8B5A2B]/5 transition-all font-semibold"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Refresh
                    </button>
                    <button
                      onClick={() => {
                        setUiMode('search');
                        setShowResults(false);
                      }}
                      className="flex items-center gap-2 px-6 py-2 bg-white border-2 border-[#8B5A2B] text-[#8B5A2B] rounded-lg hover:bg-[#8B5A2B]/10 transition-all font-bold shadow-sm"
                    >
                      <ArrowLeft className="w-5 h-5" />
                      Back
                    </button>
                  </div>
                </div>

                {/* Policy Note */}
                <div className="bg-[#FFF8E1] border border-[#FFE082] rounded-lg p-4 text-center">
                  <p className="text-[#856404] font-medium">
                    <span className="font-bold underline">Note:</span> Arrive Before 5 Mins. If you not arrive it will be available or Allocated to queue members
                  </p>
                </div>

                {/* Overall Availability Card - Only in Results mode */}
                {uiMode === 'results' && availabilityResults.length > 0 && (
                  <div className="bg-[#FAF7F2] border border-[#8B5A2B]/10 rounded-2xl p-6">
                    <div className="flex justify-between items-center mb-6">
                      <div>
                        <h3 className="text-2xl font-bold text-[#3E2723] flex items-center gap-2">
                          <LayoutGrid className="w-6 h-6 text-[#8B5A2B]" />
                          Overall Restaurant Availability
                        </h3>
                        <p className="text-gray-600">
                          For {checkData.date?.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })} at {checkTimeSlot || 'All times'}
                        </p>
                      </div>
                    </div>

                    {(() => {
                      const dateStr = getLocalDateString(checkData.date);
                      const currentReservedCount = tableReservations.filter(
                        r => r.date === dateStr && r.timeSlot === checkTimeSlot
                      ).length;
                      const currentAvailableCount = totalTables - currentReservedCount;

                      return (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="bg-white border border-green-100 rounded-xl p-6 flex justify-between items-center">
                            <div>
                              <p className="text-green-600 text-xs font-bold uppercase tracking-wider mb-2">Total Available</p>
                              <span className="text-5xl font-bold text-green-700">
                                {currentAvailableCount}
                              </span>
                            </div>
                            <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center">
                              <CheckCircle className="w-6 h-6 text-green-500" />
                            </div>
                          </div>

                          <div className="bg-white border border-red-100 rounded-xl p-6 flex justify-between items-center">
                            <div>
                              <p className="text-red-600 text-xs font-bold uppercase tracking-wider mb-2">Total Reserved</p>
                              <span className="text-5xl font-bold text-red-700">
                                {currentReservedCount}
                              </span>
                            </div>
                            <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center">
                              <XCircle className="w-6 h-6 text-red-500" />
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Search Results Table */}
                <div className="mt-8">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-[#FAF7F2] rounded-full flex items-center justify-center">
                      {uiMode === 'all' ? <LayoutGrid className="w-5 h-5 text-[#8B5A2B]" /> : <Search className="w-5 h-5 text-[#8B5A2B]" />}
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-[#3E2723]">
                        {uiMode === 'all' ? 'All Restaurant Tables' : 'Matching Tables'}
                      </h3>
                      <p className="text-gray-500 text-sm">
                        {uiMode === 'all'
                          ? `Viewing all ${totalTables} tables for the selected slot`
                          : `Matching criteria: ${checkData.location} / ${checkData.segment} / ${checkData.guests === 'any' ? 'Any' : checkData.guests} guests`}
                      </p>
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-sm">
                    <table className="w-full min-w-[640px]">
                      <thead>
                        <tr className="bg-[#FAF7F2]/50 border-b border-gray-100">
                          <th className="text-left py-4 px-6 font-bold text-xs text-gray-500 uppercase tracking-wider">TABLE</th>
                          <th className="text-left py-4 px-6 font-bold text-xs text-gray-500 uppercase tracking-wider">LOCATION</th>
                          <th className="text-left py-4 px-6 font-bold text-xs text-gray-500 uppercase tracking-wider">SEGMENT</th>
                          <th className="text-left py-4 px-6 font-bold text-xs text-gray-500 uppercase tracking-wider">NO. OF GUESTS</th>
                          <th className="text-left py-4 px-6 font-bold text-xs text-gray-500 uppercase tracking-wider">STATUS</th>
                          <th className="text-left py-4 px-6 font-bold text-xs text-gray-500 uppercase tracking-wider">ACTION</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {(() => {
                          const dateStr = getLocalDateString(checkData.date);
                          const tablesToDisplay = uiMode === 'all' ? allTables : availabilityResults;

                          return tablesToDisplay.map((t: any) => {
                            // Cross-reference with current reservations to ensure real-time status
                            const isCurrentlyReserved = tableReservations.some(
                              r => r.date === dateStr &&
                                r.timeSlot === checkTimeSlot &&
                                String(r.tableNumber) === String(t.tableId)
                            );

                            return {
                              ...t,
                              isAvailable: !isCurrentlyReserved
                            };
                          });
                        })().map((table, index) => (
                          <tr key={table.tableId} className="hover:bg-gray-50/50 transition-colors">
                            <td className="py-5 px-6 font-medium text-gray-800">{table.tableName}</td>
                            <td className="py-5 px-6">
                              <span className="inline-block px-3 py-1 rounded-full text-xs font-bold border border-orange-200 text-orange-600 bg-orange-50/30">
                                {table.location.toUpperCase()}
                              </span>
                            </td>
                            <td className="py-5 px-6 text-gray-600">{table.segment}</td>
                            <td className="py-5 px-6 text-gray-700 font-medium">{table.capacity}</td>
                            <td className="py-5 px-6">
                              <span className={`inline-block px-4 py-1 rounded-full text-xs font-bold ${table.isAvailable
                                ? 'bg-green-100 text-green-700'
                                : 'bg-red-50 text-red-600'
                                }`}>
                                {table.isAvailable ? 'AVAILABLE' : 'RESERVED'}
                              </span>
                            </td>
                            <td className="py-5 px-6">
                              {table.isAvailable ? (
                                <button
                                  onClick={() => handleReserveClick(table)}
                                  className="bg-[#8B5A2B] text-white px-6 py-2 rounded-lg text-sm font-bold hover:bg-[#6D4822] transition-all shadow-sm active:scale-95"
                                >
                                  Reserve
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleJoinWaitingQueue(table)}
                                  className="bg-[#3E2723] text-white px-6 py-2 rounded-lg text-sm font-bold hover:bg-black transition-all shadow-sm active:scale-95"
                                >
                                  Join Queue
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Waiting Queue Option */}
                {showWaitingQueueOption && (
                  <div className="mt-6 p-6 bg-amber-50 border-2 border-amber-400 rounded-lg">
                    <h4 className="font-bold text-amber-800 mb-2">All Tables Booked</h4>
                    <p className="text-amber-700 mb-4">
                      The selected time slot ({selectedFullSlot}) has no available tables. Would you like to join the waiting queue?
                    </p>
                    <button
                      onClick={() => handleJoinWaitingQueue()}
                      className="bg-[#8B5A2B] text-white px-6 py-3 rounded-lg font-semibold hover:bg-[#6D4822] transition-colors shadow-md"
                    >
                      Join Queue
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* My Reservations Tab */}
            {activeTab === 'my-reservations' && (
              <div>
                <h2 className="text-3xl font-bold mb-8 text-[#8B5A2B]">
                  My Reservations
                </h2>

                {myReservations.length === 0 ? (
                  <div className="text-center py-12">
                    <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500 text-lg">No reservations found</p>
                    <button
                      onClick={() => setActiveTab('check')}
                      className="mt-4 bg-[#8B5A2B] text-white px-6 py-3 rounded-lg font-semibold hover:bg-[#6D4822] transition-colors"
                    >
                      Check Availability
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {myReservations.map((reservation) => (
                      <div
                        key={reservation.reservationId}
                        className="bg-[#FAF7F2] border border-[#8B5A2B]/20 rounded-xl p-6 hover:shadow-lg transition-shadow"
                      >
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h3 className="text-xl font-bold text-[#8B5A2B] mb-1">
                              {allTables.find(t => t.tableId === String(reservation.tableNumber))?.tableName || `Table ${reservation.tableNumber}`}
                            </h3>
                            <span
                              className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                                reservation.displayStatus === 'Closed'
                                  ? 'bg-gray-300 text-gray-700'
                                  : reservation.displayStatus === 'Confirmed'
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-yellow-100 text-yellow-700'
                                }`}
                            >
                              {reservation.displayStatus}
                            </span>
                          </div>
                          <button
                            onClick={() => handleCancelReservation(reservation.reservationId)}
                            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium"
                          >
                            Cancel
                          </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-[#8B5A2B]" />
                            <span className="text-gray-700">
                              {parseAndFormatDisplayDate(reservation.date)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-[#8B5A2B]" />
                            <span className="text-gray-700">{reservation.timeSlot}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-[#8B5A2B]" />
                            <span className="text-gray-700">{reservation.guests} Guests</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-[#8B5A2B]" />
                            <span className="text-gray-700 capitalize">{reservation.location}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <UserIcon className="w-4 h-4 text-[#8B5A2B]" />
                            <span className="text-gray-700">{reservation.userName}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Phone className="w-4 h-4 text-[#8B5A2B]" />
                            <span className="text-gray-700">{reservation.userPhone}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Confirmation Dialog */}
      {showConfirmDialog && confirmDialogData && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-[#8B5A2B]/20 overflow-hidden">
            {/* Header with brown background */}
            <div className="bg-[#8B5A2B] px-8 py-6">
              <h3 className="text-white text-2xl font-bold">
                {confirmDialogData.title}
              </h3>
            </div>

            {/* Content */}
            <div className="px-8 py-6">
              <p className="text-gray-700 text-lg mb-6">{confirmDialogData.message}</p>

              <div className="flex justify-end gap-3">
                <button
                  className="px-8 py-3 rounded-lg border-2 border-[#8B5A2B] text-[#8B5A2B] hover:bg-[#8B5A2B]/10 transition-colors font-semibold"
                  onClick={() => setShowConfirmDialog(false)}
                >
                  Cancel
                </button>
                <button
                  className="px-8 py-3 rounded-lg bg-[#8B5A2B] text-white hover:bg-[#6D4822] transition-colors font-semibold shadow-md"
                  onClick={confirmDialogData.onConfirm}
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reserve Table Popup */}
      {reservePopup.show && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-[#8B5A2B]/20 overflow-hidden transform transition-all scale-100">
            <div className="bg-[#8B5A2B] px-8 py-6 flex justify-between items-center">
              <h3 className="text-white text-2xl font-bold">
                Reserve Table
              </h3>
              <button
                onClick={() => setReservePopup({ ...reservePopup, show: false })}
                className="text-white/80 hover:text-white transition-colors"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <div className="p-8">
              <div className="mb-6 p-4 bg-[#FAF7F2] rounded-lg border border-[#8B5A2B]/10">
                <p className="text-[#8B5A2B] font-bold text-lg mb-1">{reservePopup.table?.tableName}</p>
                <div className="flex gap-4 text-sm text-gray-600">
                  <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {reservePopup.table?.location}</span>
                  <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {reservePopup.table?.capacity} Guests</span>
                </div>
              </div>

              <div className="space-y-4">
                {/* Time pickers — shown when user came via "View All Tables" without picking a time */}
                {(!checkData.startTime || !checkData.endTime) && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">Start Time</label>
                      <div className="relative">
                        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          type="time"
                          value={checkData.startTime}
                          onChange={(e) => setCheckData({ ...checkData, startTime: e.target.value })}
                          className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#8B5A2B]/20 focus:border-[#8B5A2B] outline-none transition-all"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">End Time</label>
                      <div className="relative">
                        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          type="time"
                          value={checkData.endTime}
                          min={checkData.startTime || undefined}
                          onChange={(e) => setCheckData({ ...checkData, endTime: e.target.value })}
                          className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#8B5A2B]/20 focus:border-[#8B5A2B] outline-none transition-all"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Enter Name</label>
                  <div className="relative">
                    <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      value={reservePopup.name}
                      onChange={(e) => setReservePopup({ ...reservePopup, name: e.target.value })}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#8B5A2B]/20 focus:border-[#8B5A2B] outline-none transition-all"
                      placeholder="Your Name"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Enter 10 Digits Phone Number</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="tel"
                      maxLength={10}
                      value={reservePopup.phone}
                      onChange={(e) => setReservePopup({ ...reservePopup, phone: e.target.value.replace(/\D/g, '') })}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#8B5A2B]/20 focus:border-[#8B5A2B] outline-none transition-all"
                      placeholder="e.g. 9876543210"
                    />
                  </div>
                </div>

                <div className="pt-4">
                  <button
                    onClick={handleConfirmReservation}
                    disabled={!reservePopup.name || reservePopup.phone.length !== 10}
                    className="w-full bg-[#8B5A2B] text-white py-4 rounded-xl font-bold text-lg hover:bg-[#6D4822] transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Confirm & Reserve
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}