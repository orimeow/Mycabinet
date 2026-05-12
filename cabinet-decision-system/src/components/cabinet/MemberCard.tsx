import { CabinetMember } from "@/lib/types";
import { motion } from "framer-motion";

interface Props {
  member: CabinetMember;
}

export default function MemberCard({ member }: Props) {
  return (
    <motion.div
      whileHover={{ y: -4, scale: 1.01 }}
      transition={{ duration: 0.2 }}
      className="group relative overflow-hidden rounded-3xl border p-6 transition-all duration-300"
      style={{
        backgroundColor: 'rgba(255,255,255,0.8)',
        borderColor: 'rgba(0,0,0,0.06)',
        backdropFilter: 'blur(10px)',
      }}
    >
      {/* Decorative circle */}
      <div
        className="absolute -right-8 -top-8 h-32 w-32 rounded-full opacity-10 blur-2xl transition-transform duration-500 group-hover:scale-150"
        style={{ backgroundColor: member.color }}
      />

      <div className="relative">
        {/* Avatar */}
        <div
          className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl text-2xl font-bold text-white shadow-lg"
          style={{ backgroundColor: member.color }}
        >
          {member.nameZh.charAt(0)}
        </div>

        {/* Name */}
        <h3 className="text-xl font-bold tracking-tight">{member.nameZh}</h3>
        <p className="text-sm text-gray-400 mt-0.5">{member.nameEn}</p>
        <p className="mt-2 text-xs text-gray-400 leading-relaxed">{member.title}</p>

        {/* Core values tags */}
        <div className="mt-4 flex flex-wrap gap-1.5">
          {member.persona.coreValues.slice(0, 3).map((v, i) => (
            <span
              key={i}
              className="rounded-lg px-2.5 py-1 text-xs"
              style={{
                backgroundColor: `${member.color}12`,
                color: member.color,
              }}
            >
              {v.split("——")[0].split("—")[0]}
            </span>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
