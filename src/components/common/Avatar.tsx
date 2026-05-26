"use client";

import { useState } from "react";

interface Props {
  src?: string;
  name: string;
  color?: string;
  size?: number;
  className?: string;
}

export default function Avatar({ src, name, color = "#6B7280", size = 28, className = "" }: Props) {
  const [failed, setFailed] = useState(false);
  const showImg = src && !failed;

  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full border text-xs ${className}`}
      style={{
        width: size,
        height: size,
        borderColor: "rgba(0,0,0,0.15)",
        backgroundColor: showImg ? "transparent" : `${color}10`,
      }}
    >
      {showImg ? (
        <img
          src={src}
          alt={name}
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <span
          className="flex h-full w-full items-center justify-center font-bold text-white"
          style={{ backgroundColor: color }}
        >
          {name.charAt(0)}
        </span>
      )}
    </div>
  );
}
