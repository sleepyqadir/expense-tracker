"use client"

import type React from "react"
import Image from "next/image"

type LoadingScreenProps = {
  message?: string
  gradientClass?: string
}

// PKR note images served from Next.js public folder
const NOTE_IMAGES = ["/note_5000.jpg", "/note_1000.jpeg", "/note_500.jpg", "/note_100.jpeg"]

export function LoadingScreen({
  message = "Loading...",
  gradientClass = "bg-gradient-neon",
}: LoadingScreenProps) {
  return (
    <div
      className={`min-h-screen flex items-center justify-center overflow-hidden relative ${gradientClass}`}
    >
      {/* Falling PKR notes */}
      <div className="absolute inset-0 pointer-events-none">
        {Array.from({ length: 40 }).map((_, i) => {
          const src = NOTE_IMAGES[i % NOTE_IMAGES.length]
          const rotation = (i % 2 === 0 ? 1 : -1) * (6 + (i % 5) * 4)
          const duration = 6 + (i % 4)
          // Deterministic pseudo-random phase using index to avoid SSR/CSR hydration mismatch
          const phase = ((i * 2.618033988749895) % 1) * duration
          const left = 2 + (i * 4.3) % 96
          const scale = 0.55 + (i % 4) * 0.08
          return (
            <div
              key={i}
              className="absolute animate-note-rain"
              style={
                {
                  left: `${left}%`,
                  animationDelay: `-${phase}s`,
                  animationDuration: `${duration}s`,
                  "--note-rotation": `${rotation}deg`,
                  transformOrigin: "center",
                } as React.CSSProperties
              }
            >
              <Image
                src={src}
                alt="PKR note"
                width={160 * scale}
                height={60 * scale}
                className="opacity-85"
              />
            </div>
          )
        })}
      </div>

      <div className="text-center relative z-10">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-t-2 border-white/50 border-b-white mx-auto mb-4" />
        <p className="text-white text-lg">{message}</p>
      </div>
    </div>
  )
}
