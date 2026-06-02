import React, { useMemo } from "react";
import { CheckCircle2, Clock3, Info, XCircle } from "lucide-react";
import { formatDistance } from "date-fns";
import { Badge } from "@/client/app/components/ui/badge";
import { Card } from "@/client/app/components/ui/card";
import { cn } from "@/client/app/components/ui/utils";
import type { AppNotification, NotificationType } from "@/client/context/NotificationsContext";

function typeLabel(type: NotificationType) {
  switch (type) {
    case "success":
      return "Success";
    case "pending":
      return "Pending";
    case "failed":
      return "Failed";
    case "info":
    default:
      return "Info";
  }
}

function typeIcon(type: NotificationType) {
  switch (type) {
    case "success":
      return <CheckCircle2 className="w-5 h-5 text-emerald-600" />;
    case "pending":
      return <Clock3 className="w-5 h-5 text-amber-600" />;
    case "failed":
      return <XCircle className="w-5 h-5 text-destructive" />;
    case "info":
    default:
      return <Info className="w-5 h-5 text-muted-foreground" />;
  }
}

function typeBadgeClass(type: NotificationType) {
  switch (type) {
    case "success":
      return "bg-emerald-600 text-white border-transparent";
    case "pending":
      return "bg-amber-500 text-white border-transparent";
    case "failed":
      return "bg-destructive text-white border-transparent";
    case "info":
    default:
      return "bg-secondary text-foreground border-transparent";
  }
}

export function NotificationCard({
  notification,
  onMarkAsRead,
}: {
  notification: AppNotification;
  onMarkAsRead: (id: string) => void;
}) {
  const timeAgo = useMemo(() => {
    try {
      return formatDistance(notification.createdAt, new Date(), { addSuffix: true });
    } catch {
      return "";
    }
  }, [notification.createdAt]);

  const handleClick = () => {
    if (!notification.isRead) onMarkAsRead(notification.id);
  };

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick();
        }
      }}
      className={cn(
        "p-4 sm:p-5 transition-all cursor-pointer rounded-3xl border shadow-sm hover:shadow-md",
        notification.isRead ? "bg-card" : "bg-[#FFFDF9] border-[#C8A47A]/35",
      )}
    >
      <div className="flex items-start gap-3 sm:gap-4">
        <div className="relative mt-0.5">
          <div className={cn(
            "w-9 h-9 sm:w-10 sm:h-10 rounded-2xl flex items-center justify-center",
            notification.type === "success" && "bg-emerald-600/10",
            notification.type === "pending" && "bg-amber-500/10",
            notification.type === "failed" && "bg-destructive/10",
            notification.type === "info" && "bg-secondary",
          )}>
            {typeIcon(notification.type)}
          </div>
          {!notification.isRead && (
            <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-primary ring-2 ring-background" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className={cn("text-xs sm:text-sm font-semibold truncate leading-snug", notification.isRead ? "text-foreground" : "text-foreground") }>
                {notification.title}
              </p>
              <p className={cn("text-[11px] sm:text-xs mt-1 leading-relaxed", notification.isRead ? "text-muted-foreground" : "text-foreground/80") }>
                {notification.message}
              </p>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <Badge className={cn("rounded-full px-2.5 py-0.5 text-[10px] sm:text-xs", typeBadgeClass(notification.type))}>
                {typeLabel(notification.type)}
              </Badge>
            </div>
          </div>

          <div className="mt-2.5 flex items-center justify-between gap-3">
            <div className="text-[11px] sm:text-xs text-muted-foreground truncate">
              {notification.referenceId ? (
                <span className="truncate">{notification.referenceId}</span>
              ) : (
                <span className="truncate">&nbsp;</span>
              )}
            </div>
            <div className="text-[10px] sm:text-[11px] text-muted-foreground flex-shrink-0">{timeAgo}</div>
          </div>
        </div>
      </div>
    </Card>
  );
}
