// components/chat/Status.tsx

type StatusLevel = "info" | "success" | "warning" | "error";

interface StatusProps {
  label: string;
  detail?: string;
  level: StatusLevel;
}

const statusToneMap: Record<StatusLevel, string> = {
  info: "bg-slate-100 text-slate-700",
  success: "bg-emerald-100 text-emerald-800",
  warning: "bg-amber-100 text-amber-900",
  error: "bg-red-100 text-red-800",
};

export const Status = ({ label, detail, level }: StatusProps) => {
  const tone = statusToneMap[level];

  return (
    <div className="flex justify-center">
      <div className={`rounded-full px-4 py-2 text-xs font-medium ${tone}`}>
        {label}
        {detail ? ` • ${detail}` : ""}
      </div>
    </div>
  );
};
