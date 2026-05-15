import { CabinetMember } from "@/lib/types";
import { motion } from "framer-motion";

interface Props {
  member: CabinetMember;
}

export default function MemberCard({ member }: Props) {
  return (
    <motion.div
      className="group relative overflow-hidden rounded-md border p-5 transition-all duration-200"
      style={{
        backgroundColor: '#fff',
        borderColor: 'rgba(0,0,0,0.08)',
      }}
    >
      <div className="relative">
        {/* Avatar */}
        <div
          className="mb-4 flex h-14 w-14 items-center justify-center rounded-lg text-xl font-bold text-white"
          style={{ backgroundColor: member.color }}
        >
          {member.nameZh.charAt(0)}
        </div>

        {/* Name */}
        <h3 className="text-lg font-semibold tracking-tight">{member.nameZh}</h3>
        <p className="text-sm text-gray-400 mt-0.5">{member.nameEn}</p>
        <p className="mt-1.5 text-xs text-gray-400 leading-relaxed">{member.title}</p>

        {/* Core values tags */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {member.persona.coreValues.slice(0, 3).map((v, i) => (
            <span
              key={i}
              className="rounded-sm px-2 py-0.5 text-[11px]"
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
