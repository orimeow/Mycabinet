import { ImageResponse } from "next/og";

export const alt = "我的智囊团";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)",
          color: "#fff",
          padding: 60,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 80,
            height: 80,
            borderRadius: 20,
            background: "#fff",
            marginBottom: 40,
          }}
        >
          <span style={{ fontSize: 40, color: "#1a1a1a" }}>内</span>
        </div>
        <h1
          style={{
            fontSize: 72,
            fontWeight: 700,
            margin: 0,
            marginBottom: 20,
            letterSpacing: "-0.02em",
          }}
        >
          我的智囊团
        </h1>
        <p
          style={{
            fontSize: 28,
            color: "rgba(255,255,255,0.6)",
            margin: 0,
            textAlign: "center",
            maxWidth: 800,
            lineHeight: 1.5,
          }}
        >
          汇聚多元思维框架，为你的问题提供多角度深度分析
        </p>
        <div
          style={{
            position: "absolute",
            bottom: 40,
            display: "flex",
            gap: 12,
          }}
        >
          {["辩论", "对话", "决策"].map((tag) => (
            <span
              key={tag}
              style={{
                padding: "8px 20px",
                borderRadius: 100,
                background: "rgba(255,255,255,0.1)",
                fontSize: 16,
                color: "rgba(255,255,255,0.5)",
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    ),
    { ...size }
  );
}
