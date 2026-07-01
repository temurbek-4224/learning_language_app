import { UserStatus } from "@prisma/client";

import { cn } from "@/lib/utils";

const styles: Record<UserStatus, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  INACTIVE: "bg-slate-100 text-slate-600 ring-slate-200",
  BLOCKED: "bg-rose-50 text-rose-700 ring-rose-200",
  INVITED: "bg-blue-50 text-blue-700 ring-blue-200",
  SUSPENDED: "bg-amber-50 text-amber-700 ring-amber-200",
};

export function StatusBadge({ status }: { status: UserStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ring-1",
        styles[status],
      )}
    >
      {status}
    </span>
  );
}
