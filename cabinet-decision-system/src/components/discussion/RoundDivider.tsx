import { motion } from "framer-motion";

interface Props {
  label: string;
  active: boolean;
  completed: boolean;
}

export default function RoundDivider({ label, active, completed }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex items-center gap-2.5 py-2"
    >
      <div
        className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white transition-all ${
          completed
            ? "bg-green-500"
            : active
              ? "bg-[#1a1a1a]"
              : "bg-gray-200 text-gray-400"
        }`}
      >
        {completed ? "✓" : active ? "" : "○"}
      </div>
      <span
        className={`text-xs font-medium whitespace-nowrap ${
          completed
            ? "text-green-600"
            : active
              ? "text-gray-900"
              : "text-gray-300"
        }`}
      >
        {label}
      </span>
      <div
        className="h-px flex-1"
        style={{
          background: completed
            ? 'linear-gradient(90deg, rgba(34,197,94,0.2), transparent)'
            : active
              ? 'linear-gradient(90deg, rgba(0,0,0,0.1), transparent)'
              : 'linear-gradient(90deg, rgba(0,0,0,0.04), transparent)',
        }}
      />
    </motion.div>
  );
}
