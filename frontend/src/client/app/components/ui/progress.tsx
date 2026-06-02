"use client";

import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";

import { cn } from "./utils";

const toPercentClass = (value?: number) => {
  const clamped = Math.max(0, Math.min(100, Math.round(value ?? 0)));
  return `ds-w-pct-${clamped}`;
};

function Progress({
  className,
  value,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root>) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn(
        "bg-primary/20 relative h-2 w-full overflow-hidden rounded-full",
        className,
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className={cn("bg-primary h-full transition-all", toPercentClass(value))}
      />
    </ProgressPrimitive.Root>
  );
}

export { Progress };
