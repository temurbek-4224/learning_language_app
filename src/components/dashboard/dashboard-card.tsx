import type { ComponentType } from "react";

type DashboardCardProps = {
  label: string;
  value: number | string;
  description?: string;
  icon?: ComponentType<{ className?: string }>;
};

export function DashboardCard({
  label,
  value,
  description,
  icon: Icon,
}: DashboardCardProps) {
  return (
    <div className="group overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/70 transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-indigo-100">
      <div className="h-1 bg-gradient-to-r from-indigo-500 via-blue-500 to-violet-500" />
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-slate-500">{label}</p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
              {value}
            </p>
          </div>
          {Icon ? (
            <div className="rounded-2xl bg-indigo-50 p-3 text-indigo-600 ring-1 ring-indigo-100">
              <Icon className="size-5" />
            </div>
          ) : null}
        </div>
        {description ? (
          <p className="mt-4 text-xs font-medium text-slate-500">
            {description}
          </p>
        ) : null}
      </div>
    </div>
  );
}
