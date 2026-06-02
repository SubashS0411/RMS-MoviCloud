import { useState, useEffect, useRef } from "react";
import {
  Clock,
  Users,
  CheckCircle,
  Bell,
  Shield,
  Coffee,
  MapPin,
  ArrowRight,
  Home as HomeIcon,
  Calendar,
  LayoutGrid,
  Phone,
  User as UserIcon,
  Armchair,
} from "lucide-react";

import { cancelQueueEntry, fetchQueueEntries, joinQueue, updateQueueEntry } from "@/client/api/queue";

interface QueueProps {
  queueNumber: number | null;
  onJoinQueue: (number: number) => void;
}

interface QueueEntry {
  id: string;
  name: string;
  guests: number;
  notificationMethod: "sms" | "email";
  contact: string;
  hall: "AC" | "Main" | "VIP" | "Any";
  segment: "Front" | "Middle" | "Back" | "Any";
  position: number;
  estimatedWaitMinutes: number;
  joinedAt: Date;
  queueDate: string;
  timeSlot?: string;
  notifiedAt5Min: boolean;
  // Table-specific details from Reservation page
  tableName?: string;
  tableId?: string;
  tableLocation?: string;
  tableSegment?: string;
  tableCapacity?: string;
  joinedAtTimestamp?: number; // Unix ms — time when "Join Queue" was pressed
}

// Pending data passed from Reservation page via localStorage
interface PendingQueueData {
  queueDate?: string;
  timeSlot?: string;
  guests?: string;
  location?: string;
  segment?: string;
  tableName?: string;
  tableId?: string;
  tableLocation?: string;
  tableSegment?: string;
  tableCapacity?: string;
}

export default function Queue({
  queueNumber,
  onJoinQueue,
}: QueueProps) {
  const [showForm, setShowForm] = useState(false);
  const [showStatus, setShowStatus] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  // Reservation details pre-filled from Reservation page
  const [pendingData, setPendingData] = useState<PendingQueueData | null>(null);

  // Form state — only Name & Contact collected from user
  const [formData, setFormData] = useState({
    name: "",
    contact: "",
  });

  // Load pending data from reservation page on mount
  useEffect(() => {
    const pending = localStorage.getItem("pendingQueueData");
    if (pending) {
      try {
        const data: PendingQueueData = JSON.parse(pending);
        setPendingData(data);
        // Auto-scroll to form since user came from Reservation page
        setTimeout(() => {
          formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 400);
      } catch (e) {
        console.error("Failed to parse pendingQueueData", e);
      }
    }
  }, []);

  // Queue database – Load from localStorage
  const [queueDatabase, setQueueDatabase] = useState<QueueEntry[]>(() => {
    const saved = localStorage.getItem("queueDatabase");
    if (!saved) return [];
    try {
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed)
        ? parsed.map((e: any) => ({
          ...e,
          joinedAt: e?.joinedAt ? new Date(e.joinedAt) : new Date(),
        }))
        : [];
    } catch {
      return [];
    }
  });

  const [currentUserEntry, setCurrentUserEntry] = useState<QueueEntry | null>(() => {
    const saved = localStorage.getItem("currentUserEntry");
    if (saved) {
      const entry = JSON.parse(saved);
      entry.joinedAt = new Date(entry.joinedAt);
      return entry;
    }
    return null;
  });

  // Persist queue to localStorage
  useEffect(() => {
    localStorage.setItem("queueDatabase", JSON.stringify(queueDatabase));
  }, [queueDatabase]);

  // Load queue entries from backend for the selected date (best-effort)
  useEffect(() => {
    const dateStr = pendingData?.queueDate || new Date().toISOString().split("T")[0];
    let cancelled = false;
    (async () => {
      try {
        const entries = await fetchQueueEntries(dateStr);
        if (cancelled) return;
        setQueueDatabase(entries as any);
      } catch {
        // keep localStorage-backed behavior if backend is offline
      }
    })();
    return () => { cancelled = true; };
  }, [pendingData?.queueDate]);

  // Persist current user entry + show status
  useEffect(() => {
    if (currentUserEntry) {
      localStorage.setItem("currentUserEntry", JSON.stringify(currentUserEntry));
      setShowStatus(true);
      setShowForm(true);
    } else {
      localStorage.removeItem("currentUserEntry");
    }
  }, [currentUserEntry]);

  // Real-time EWT countdown (every second)
  useEffect(() => {
    if (!currentUserEntry) return;

    const interval = setInterval(() => {
      setCurrentUserEntry((prev) => {
        if (!prev) return null;

        let newEstimatedWaitMinutes = 0;

        if (prev.timeSlot && prev.queueDate) {
          // EWT = max(0, SlotStart − Now)
          const slots = parseSlotTimes(prev.queueDate, prev.timeSlot);
          if (slots) {
            const diffMs = slots.start.getTime() - Date.now();
            newEstimatedWaitMinutes = Math.max(0, diffMs / (1000 * 60));
          }
        } else {
          // Fallback: position-based (15 min per position)
          const timeElapsedMinutes = (Date.now() - prev.joinedAt.getTime()) / (1000 * 60);
          newEstimatedWaitMinutes = Math.max(0, prev.position * 15 - timeElapsedMinutes);
        }

        // 5-minute notification
        if (newEstimatedWaitMinutes <= 5 && newEstimatedWaitMinutes > 0 && !prev.notifiedAt5Min) {
          alert(
            `🔔 Your table will be ready shortly!\n\n${prev.tableName ? `Table: ${prev.tableName}` : ""}\nGuests: ${prev.guests}\n\nPlease head to the restaurant now.`
          );
          return { ...prev, estimatedWaitMinutes: newEstimatedWaitMinutes, notifiedAt5Min: true };
        }

        return { ...prev, estimatedWaitMinutes: newEstimatedWaitMinutes };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [currentUserEntry?.id]);

  // Sync 5-min notification flag to backend (best-effort)
  useEffect(() => {
    if (!currentUserEntry?.notifiedAt5Min) return;
    updateQueueEntry(currentUserEntry.id, { notifiedAt5Min: true }).catch(() => { });
  }, [currentUserEntry?.id, currentUserEntry?.notifiedAt5Min]);

  // Calculate position based on combination
  const calculatePosition = (guests: number, hall: string, segment: string): number => {
    const sameComboEntries = queueDatabase.filter(
      (entry) => entry.guests === guests && entry.hall === hall && entry.segment === segment
    );
    return sameComboEntries.length + 1;
  };

  const scrollToForm = () => {
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleJoinQueue = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      alert("Please enter your name");
      return;
    }
    if (!formData.contact.trim()) {
      alert("Please enter your contact details");
      return;
    }

    // Resolve details — prefer pendingData (from Reservation page), else defaults
    const queueDate = pendingData?.queueDate || new Date().toISOString().split("T")[0];
    const timeSlot = pendingData?.timeSlot || "";
    const guests = parseInt(pendingData?.guests || "2");
    const hall = (pendingData?.tableLocation || pendingData?.location || "Any") as "AC" | "Main" | "VIP" | "Any";
    const segment = (pendingData?.tableSegment || pendingData?.segment || "Any") as "Front" | "Middle" | "Back" | "Any";

    const optimisticPosition = calculatePosition(guests, hall, segment);

    // ✅ EWT = max(0, SlotStart − now) — captured at the exact moment of "Join Queue" press
    const joinPressTime = Date.now();
    let initialWaitMinutes = optimisticPosition * 15; // fallback
    if (timeSlot && queueDate) {
      const slots = parseSlotTimes(queueDate, timeSlot);
      if (slots) {
        const diffMs = slots.start.getTime() - joinPressTime;
        initialWaitMinutes = Math.max(0, diffMs / (1000 * 60));
      }
    }

    const newEntry: QueueEntry = {
      id: `QUEUE${Date.now()}`,
      name: formData.name,
      guests,
      notificationMethod: "sms",
      contact: formData.contact,
      hall,
      segment,
      position: optimisticPosition,
      estimatedWaitMinutes: initialWaitMinutes,
      joinedAt: new Date(joinPressTime),
      joinedAtTimestamp: joinPressTime,
      queueDate,
      timeSlot,
      notifiedAt5Min: false,
      // Table details from Reservation page
      tableName: pendingData?.tableName,
      tableId: pendingData?.tableId,
      tableLocation: pendingData?.tableLocation,
      tableSegment: pendingData?.tableSegment,
      tableCapacity: pendingData?.tableCapacity,
    };

    try {
      const created = await joinQueue(newEntry as any);
      setQueueDatabase((prev) => [...prev, created as any]);
      setCurrentUserEntry(created as any);
      onJoinQueue(created.position);
    } catch {
      setQueueDatabase([...queueDatabase, newEntry]);
      setCurrentUserEntry(newEntry);
      onJoinQueue(newEntry.position);
    }

    // Clear the pending data so it doesn't re-appear on next visit
    localStorage.removeItem("pendingQueueData");

    setShowStatus(true);
    setShowForm(true);
  };

  const handleCancelQueue = async () => {
    if (!currentUserEntry) return;

    if (confirm("Are you sure you want to cancel your queue position?")) {
      const dateStr = currentUserEntry.queueDate || new Date().toISOString().split("T")[0];
      try {
        await cancelQueueEntry(currentUserEntry.id);
        try {
          const refreshed = await fetchQueueEntries(dateStr);
          setQueueDatabase(refreshed as any);
        } catch {
          setQueueDatabase(queueDatabase.filter((e) => e.id !== currentUserEntry.id));
        }
      } catch {
        setQueueDatabase(queueDatabase.filter((entry) => entry.id !== currentUserEntry.id));
      }

      setCurrentUserEntry(null);
      setShowStatus(false);
      setShowForm(false);
      setFormData({ name: "", contact: "" });
      setPendingData(null);
    }
  };

  const handleBackToHero = () => {
    setShowForm(false);
    setShowStatus(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Format minutes into HH:MM:SS — always shows real-time countdown
  const formatWaitTime = (minutes: number): string => {
    if (minutes <= 0) return "00:00:00";
    const totalSeconds = Math.floor(minutes * 60);
    const hours = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const parseSlotTimes = (
    dateStr: string,
    timeSlot: string
  ): { start: Date; end: Date } | null => {
    if (!timeSlot) return null;
    const parts = timeSlot.split(/[–-]/).map((s) => s.trim());
    if (parts.length < 2) return null;

    const parsePart = (p: string) => {
      const m = p.match(/(\d+):(\d+)\s*(AM|PM)/i);
      if (!m) return null;
      let h = parseInt(m[1]);
      const min = parseInt(m[2]);
      const ampm = m[3].toUpperCase();
      if (ampm === "PM" && h < 12) h += 12;
      if (ampm === "AM" && h === 12) h = 0;
      const d = new Date(dateStr);
      d.setHours(h, min, 0, 0);
      return d;
    };

    const start = parsePart(parts[0]);
    const end = parsePart(parts[1]);
    if (!start || !end) return null;
    return { start, end };
  };

  // Format date string YYYY-MM-DD → readable
  const formatDate = (dateStr?: string): string => {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const hasTableDetails = Boolean(pendingData?.tableName || pendingData?.timeSlot);

  return (
    <div className="min-h-screen bg-[#FAF7F2]">
      {/* HERO SECTION */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0">
          <img
            src="https://images.unsplash.com/photo-1769773297747-bd00e31b33aa?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmaW5lJTIwZGluaW5nJTIwcmVzdGF1cmFudCUyMGludGVyaW9yJTIwZWxlZ2FudHxlbnwxfHx8fDE3NzAxMjIwNTV8MA&ixlib=rb-4.1.0&q=80&w=1080"
            alt="Fine Dining Restaurant"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#3E2723]/70 via-[#3E2723]/50 to-[#3E2723]/70" />
        </div>

        <div className="relative z-10 text-center px-6 max-w-4xl mx-auto">
          <h1
            className="text-5xl md:text-7xl mb-6 text-white"
           
          >
            "Good food is always worth the wait."
          </h1>
          <p className="text-xl md:text-2xl text-[#EADBC8] mb-12">
            Relax. Your table will be prepared with care.
          </p>
          {currentUserEntry ? (
            <button
              onClick={handleViewStatus}
              className="group bg-[#8B5A2B] text-white px-10 py-4 rounded-lg hover:bg-[#6D4C41] transition-all shadow-lg hover:shadow-xl flex items-center gap-3 mx-auto"
            >
              View My Queue Status
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
          ) : (
            <button
              onClick={scrollToForm}
              className="group bg-[#8B5A2B] text-white px-10 py-4 rounded-lg hover:bg-[#6D4C41] transition-all shadow-lg hover:shadow-xl flex items-center gap-3 mx-auto"
            >
              Join the Queue
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
          )}
        </div>
      </section>

      {/* FEATURES SECTION */}
      <section className="py-10 sm:py-20 px-4 sm:px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <h2
            className="text-2xl sm:text-4xl md:text-5xl text-center mb-4 text-[#8B5A2B]"
           
          >
            A Better Way to Wait
          </h2>
          <p className="text-center text-[#6D4C41] mb-16 text-lg">
            No standing. No confusion. Just comfort and trust.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="bg-[#FAF7F2] rounded-2xl p-8 text-center hover:shadow-lg transition-shadow border border-[#E8DED0]">
              <div className="w-16 h-16 bg-[#8B5A2B]/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <Clock className="w-8 h-8 text-[#8B5A2B]" />
              </div>
              <h3
                className="text-xl mb-3 text-[#3E2723]"
               
              >
                Live Queue Updates
              </h3>
              <p className="text-[#6D4C41]">
                Your wait time updates automatically in real-time
              </p>
            </div>

            <div className="bg-[#FAF7F2] rounded-2xl p-8 text-center hover:shadow-lg transition-shadow border border-[#E8DED0]">
              <div className="w-16 h-16 bg-[#8B5A2B]/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <Bell className="w-8 h-8 text-[#8B5A2B]" />
              </div>
              <h3
                className="text-xl mb-3 text-[#3E2723]"
               
              >
                Smart Notifications
              </h3>
              <p className="text-[#6D4C41]">
                We'll notify you when your table is almost ready
              </p>
            </div>

            <div className="bg-[#FAF7F2] rounded-2xl p-8 text-center hover:shadow-lg transition-shadow border border-[#E8DED0]">
              <div className="w-16 h-16 bg-[#8B5A2B]/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <Coffee className="w-8 h-8 text-[#8B5A2B]" />
              </div>
              <h3
                className="text-xl mb-3 text-[#3E2723]"
               
              >
                Comfortable Waiting
              </h3>
              <p className="text-[#6D4C41]">
                No standing in line. Relax anywhere you like
              </p>
            </div>

            <div className="bg-[#FAF7F2] rounded-2xl p-8 text-center hover:shadow-lg transition-shadow border border-[#E8DED0]">
              <div className="w-16 h-16 bg-[#8B5A2B]/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <Shield className="w-8 h-8 text-[#8B5A2B]" />
              </div>
              <h3
                className="text-xl mb-3 text-[#3E2723]"
               
              >
                Fair Queue System
              </h3>
              <p className="text-[#6D4C41]">
                Position based on your specific table needs
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* JOIN QUEUE FORM / STATUS */}
      <section ref={formRef} className="py-10 sm:py-20 px-4 sm:px-6 bg-[#FAF7F2]">
        <div className="max-w-4xl mx-auto">
          {!showStatus ? (
            /* ── JOIN QUEUE FORM ── */
            <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12 border border-[#E8DED0]">

              {/* Header */}
              <div className="mb-8">
                <h2
                  className="text-3xl text-[#3E2723] mb-2"
                 
                >
                  Join the Queue
                </h2>
                <p className="text-[#6D4C41]">
                  {hasTableDetails
                    ? "Your table details are pre-filled from your reservation search. Enter your name and phone to confirm your spot."
                    : "Enter your details below to join the waiting queue."}
                </p>
              </div>

              {/* ── RESERVATION DETAILS CARD (read-only, from Reservation page) ── */}
              {hasTableDetails && pendingData && (
                <div className="mb-8 bg-[#FAF7F2] border border-[#8B5A2B]/20 rounded-xl p-6">
                  <h3
                    className="text-lg text-[#8B5A2B] mb-4 flex items-center gap-2"
                   
                  >
                    <LayoutGrid className="w-5 h-5" />
                    Your Reservation Details
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    {pendingData.tableName && (
                      <div className="flex items-start gap-3">
                        <Armchair className="w-4 h-4 text-[#8B5A2B] mt-0.5 shrink-0" />
                        <div>
                          <p className="text-[#6D4C41] text-xs uppercase tracking-wide font-semibold mb-0.5">Table</p>
                          <p className="text-[#3E2723] font-medium">{pendingData.tableName}</p>
                        </div>
                      </div>
                    )}

                    {pendingData.tableLocation && (
                      <div className="flex items-start gap-3">
                        <MapPin className="w-4 h-4 text-[#8B5A2B] mt-0.5 shrink-0" />
                        <div>
                          <p className="text-[#6D4C41] text-xs uppercase tracking-wide font-semibold mb-0.5">Location</p>
                          <p className="text-[#3E2723] font-medium">{pendingData.tableLocation}</p>
                        </div>
                      </div>
                    )}

                    {pendingData.tableSegment && (
                      <div className="flex items-start gap-3">
                        <LayoutGrid className="w-4 h-4 text-[#8B5A2B] mt-0.5 shrink-0" />
                        <div>
                          <p className="text-[#6D4C41] text-xs uppercase tracking-wide font-semibold mb-0.5">Segment</p>
                          <p className="text-[#3E2723] font-medium">{pendingData.tableSegment}</p>
                        </div>
                      </div>
                    )}

                    {pendingData.tableCapacity && (
                      <div className="flex items-start gap-3">
                        <Users className="w-4 h-4 text-[#8B5A2B] mt-0.5 shrink-0" />
                        <div>
                          <p className="text-[#6D4C41] text-xs uppercase tracking-wide font-semibold mb-0.5">No. of Guests</p>
                          <p className="text-[#3E2723] font-medium">{pendingData.tableCapacity} people</p>
                        </div>
                      </div>
                    )}

                    {pendingData.queueDate && (
                      <div className="flex items-start gap-3">
                        <Calendar className="w-4 h-4 text-[#8B5A2B] mt-0.5 shrink-0" />
                        <div>
                          <p className="text-[#6D4C41] text-xs uppercase tracking-wide font-semibold mb-0.5">Date</p>
                          <p className="text-[#3E2723] font-medium">{formatDate(pendingData.queueDate)}</p>
                        </div>
                      </div>
                    )}

                    {pendingData.timeSlot && (
                      <div className="flex items-start gap-3">
                        <Clock className="w-4 h-4 text-[#8B5A2B] mt-0.5 shrink-0" />
                        <div>
                          <p className="text-[#6D4C41] text-xs uppercase tracking-wide font-semibold mb-0.5">Time Slot</p>
                          <p className="text-[#3E2723] font-medium">{pendingData.timeSlot}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  <p className="mt-4 text-xs text-[#8B5A2B]/70 italic">
                    ⏱ Your estimated wait time will be calculated from slot start: <strong>{pendingData.timeSlot}</strong>
                  </p>
                </div>
              )}

              {/* ── INPUT FORM ── */}
              <form onSubmit={handleJoinQueue} className="space-y-6">
                {/* Full Name */}
                <div>
                  <label className="block text-[#3E2723] mb-2 font-medium">
                    Full Name
                  </label>
                  <div className="relative">
                    <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Enter your full name"
                      className="w-full pl-10 pr-4 py-3 border border-[#E8DED0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B5A2B] bg-white"
                      required
                    />
                  </div>
                </div>

                {/* Mobile Number */}
                <div>
                  <label className="block text-[#3E2723] mb-2 font-medium">
                    Mobile Number
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="tel"
                      value={formData.contact}
                      onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                      placeholder="+91 (000) 000-0000"
                      className="w-full pl-10 pr-4 py-3 border border-[#E8DED0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B5A2B] bg-white"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-[#8B5A2B] text-white py-4 rounded-lg hover:bg-[#6D4C41] transition-colors shadow-lg hover:shadow-xl font-semibold text-lg"
                >
                  Confirm &amp; Join Queue
                </button>
              </form>
            </div>
          ) : (
            /* ── QUEUE STATUS PAGE ── */
            <div className="space-y-6">
              {/* Back button */}
              <button
                onClick={handleBackToHero}
                className="flex items-center gap-2 text-[#8B5A2B] hover:text-[#6D4C41] transition-colors mb-4"
              >
                <HomeIcon className="w-5 h-5" />
                Back to Queue Home
              </button>

              {/* Success Banner */}
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-2xl p-6 text-center">
                <div className="flex items-center justify-center gap-3 mb-2">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                  <h3
                    className="text-2xl text-green-800"
                   
                  >
                    Successfully Joined the Queue!
                  </h3>
                </div>
                <p className="text-green-700">
                  We'll notify you when your table is almost ready
                </p>
              </div>

              {/* Main Status Card */}
              {currentUserEntry && (
                <div className="bg-gradient-to-br from-[#8B5A2B] to-[#6D4C41] text-white rounded-2xl p-8 shadow-2xl">
                  <h3
                    className="text-3xl mb-6"
                   
                  >
                    Welcome, {currentUserEntry.name}!
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Current Position */}
                    <div className="bg-white/10 backdrop-blur rounded-xl p-6 text-center">
                      <p className="text-[#EADBC8] mb-2">Your Queue Position</p>
                      <p
                        className="text-6xl mb-2"
                       
                      >
                        #{currentUserEntry.position}
                      </p>
                      <p className="text-sm text-[#EADBC8]">in the waiting queue</p>
                    </div>

                    {/* Estimated Wait Time */}
                    <div className="bg-white/10 backdrop-blur rounded-xl p-6 text-center">
                      <p className="text-[#EADBC8] mb-2">Estimated Wait Time</p>
                      <p
                        className={`text-6xl mb-2 ${currentUserEntry.estimatedWaitMinutes <= 0 ? 'text-green-300' : currentUserEntry.estimatedWaitMinutes <= 5 ? 'text-yellow-300' : ''}`}
                       
                      >
                        {formatWaitTime(currentUserEntry.estimatedWaitMinutes)}
                      </p>
                      <p className="text-sm text-[#EADBC8]">
                        {currentUserEntry.estimatedWaitMinutes <= 0
                          ? "🍽️ Your table is ready! Please head to the restaurant."
                          : currentUserEntry.timeSlot
                            ? `⏱ Counting down to slot: ${currentUserEntry.timeSlot}`
                            : "⏱ Real-time countdown active"}
                      </p>
                    </div>
                  </div>

                  {/* Live indicator */}
                  <div className="mt-6 flex items-center justify-center gap-3 text-[#EADBC8]">
                    <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse" />
                    <span>Live updates active</span>
                  </div>
                </div>
              )}

              {/* Table & Reservation Details */}
              {currentUserEntry && (
                <div className="bg-white rounded-2xl p-8 border border-[#E8DED0] shadow-lg">
                  <h3
                    className="text-2xl mb-6 text-[#8B5A2B]"
                   
                  >
                    Queue Details
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                    {/* Customer Info */}
                    <div>
                      <p className="text-xs text-[#6D4C41] uppercase tracking-wide font-semibold mb-1">Customer Name</p>
                      <p className="text-[#3E2723] font-medium flex items-center gap-2">
                        <UserIcon className="w-4 h-4 text-[#8B5A2B]" />
                        {currentUserEntry.name}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-[#6D4C41] uppercase tracking-wide font-semibold mb-1">Mobile Number</p>
                      <p className="text-[#3E2723] font-medium flex items-center gap-2">
                        <Phone className="w-4 h-4 text-[#8B5A2B]" />
                        {currentUserEntry.contact}
                      </p>
                    </div>

                    {currentUserEntry.tableName && (
                      <div>
                        <p className="text-xs text-[#6D4C41] uppercase tracking-wide font-semibold mb-1">Table</p>
                        <p className="text-[#3E2723] font-medium flex items-center gap-2">
                          <Armchair className="w-4 h-4 text-[#8B5A2B]" />
                          {currentUserEntry.tableName}
                        </p>
                      </div>
                    )}

                    {currentUserEntry.tableLocation && (
                      <div>
                        <p className="text-xs text-[#6D4C41] uppercase tracking-wide font-semibold mb-1">Location</p>
                        <p className="text-[#3E2723] font-medium flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-[#8B5A2B]" />
                          {currentUserEntry.tableLocation}
                        </p>
                      </div>
                    )}

                    {currentUserEntry.tableSegment && (
                      <div>
                        <p className="text-xs text-[#6D4C41] uppercase tracking-wide font-semibold mb-1">Segment</p>
                        <p className="text-[#3E2723] font-medium flex items-center gap-2">
                          <LayoutGrid className="w-4 h-4 text-[#8B5A2B]" />
                          {currentUserEntry.tableSegment}
                        </p>
                      </div>
                    )}

                    {currentUserEntry.guests > 0 && (
                      <div>
                        <p className="text-xs text-[#6D4C41] uppercase tracking-wide font-semibold mb-1">No. of Guests</p>
                        <p className="text-[#3E2723] font-medium flex items-center gap-2">
                          <Users className="w-4 h-4 text-[#8B5A2B]" />
                          {currentUserEntry.guests} people
                        </p>
                      </div>
                    )}

                    {currentUserEntry.queueDate && (
                      <div>
                        <p className="text-xs text-[#6D4C41] uppercase tracking-wide font-semibold mb-1">Date</p>
                        <p className="text-[#3E2723] font-medium flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-[#8B5A2B]" />
                          {formatDate(currentUserEntry.queueDate)}
                        </p>
                      </div>
                    )}

                    {currentUserEntry.timeSlot && (
                      <div>
                        <p className="text-xs text-[#6D4C41] uppercase tracking-wide font-semibold mb-1">Time Slot</p>
                        <p className="text-[#3E2723] font-medium flex items-center gap-2">
                          <Clock className="w-4 h-4 text-[#8B5A2B]" />
                          {currentUserEntry.timeSlot}
                        </p>
                      </div>
                    )}

                    {currentUserEntry.joinedAt && (
                      <div>
                        <p className="text-xs text-[#6D4C41] uppercase tracking-wide font-semibold mb-1">Joined Queue At</p>
                        <p className="text-[#3E2723] font-medium flex items-center gap-2">
                          <Clock className="w-4 h-4 text-[#8B5A2B]" />
                          {currentUserEntry.joinedAt.toLocaleTimeString("en-IN", {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* EWT explanation */}
                  {currentUserEntry.timeSlot && (
                    <div className="mt-6 p-4 bg-[#FAF7F2] rounded-lg border border-[#8B5A2B]/10 text-sm text-[#6D4C41]">
                      <span className="font-semibold text-[#8B5A2B]">ⓘ How EWT is calculated:</span>{" "}
                      Estimated Wait = Slot Start Time (<strong>{currentUserEntry.timeSlot.split(/[–-]/)[0].trim()}</strong>) − Current Time (<strong>{new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</strong>).
                      The countdown updates every second in real-time.
                    </div>
                  )}
                </div>
              )}

              {/* Cancel Queue */}
              <div className="bg-white rounded-2xl p-6 border border-[#E8DED0]">
                <button
                  onClick={handleCancelQueue}
                  className="w-full bg-red-600 text-white py-3 rounded-lg hover:bg-red-700 transition-colors font-semibold"
                >
                  Cancel Queue Position
                </button>
                <p className="text-center text-sm text-[#6D4C41] mt-3">
                  You can rejoin anytime if you change your mind
                </p>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );

  function handleViewStatus() {
    setShowStatus(true);
    setShowForm(true);
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  }
}