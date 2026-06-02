import React, { useMemo, useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/client/app/components/ui/button";
import { NotificationCard } from "@/client/components/NotificationCard";
import { NotificationFilters, type NotificationFilter } from "@/client/components/NotificationFilters";
import { useNotifications } from "@/client/context/NotificationsContext";

function matchesFilter(filter: NotificationFilter, n: { type: string; isRead: boolean }) {
  switch (filter) {
    case "all":
      return true;
    case "unread":
      return !n.isRead;
    case "success":
    case "pending":
    case "failed":
    case "info":
      return n.type === filter;
    default:
      return true;
  }
}

export default function NotificationsPage() {
  const { notifications, markAsRead, markAllAsRead, getUnreadCount } = useNotifications();
  const [filter, setFilter] = useState<NotificationFilter>("all");

  const unreadCount = getUnreadCount();

  const filtered = useMemo(() => {
    return [...notifications]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .filter((n) => matchesFilter(filter, n));
  }, [notifications, filter]);

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <div className="rounded-3xl border border-[#E8DED0] bg-white shadow-sm p-5 sm:p-7">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#F8F1E7] flex items-center justify-center border border-[#C8A47A]/30 shrink-0">
              <Bell className="w-5 h-5 text-[#8B5A2B]" />
            </div>
            <div>
              <h1 className="!text-2xl font-semibold text-[#2D1B10]">Notifications</h1>
              <p className="text-xs sm:text-sm text-[#6D4C41] mt-1">
                {unreadCount} new notification{unreadCount === 1 ? "" : "s"}
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="secondary"
            className="h-10 px-4 rounded-xl text-sm"
            onClick={markAllAsRead}
            disabled={unreadCount === 0}
          >
            Mark all as read
          </Button>
        </div>

        <div className="mt-6">
          <NotificationFilters value={filter} onChange={setFilter} />
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:gap-4">
          {filtered.length === 0 ? (
            <div className="border border-[#E8DED0] rounded-2xl bg-[#FFFDF9] p-8 text-center">
              <p className="text-base font-semibold text-[#2D1B10]">No notifications</p>
              <p className="text-sm text-[#6D4C41] mt-1">You are all caught up.</p>
            </div>
          ) : (
            filtered.map((n) => (
              <NotificationCard key={n.id} notification={n} onMarkAsRead={markAsRead} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
