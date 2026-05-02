"use client";
import React from "react";
import { cn } from "@/lib/utils";

export const BackgroundBeams = ({ className }: { className?: string }) => {
  return (
    <div
      className={cn(
        "absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black)]",
        className
      )}
    >
      <svg
        className="absolute h-full w-full opacity-50"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern
            id="beams"
            width="40"
            height="40"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M0 40V.5H40"
              fill="none"
              stroke="white"
              strokeOpacity="0.1"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#beams)" />
      </svg>
      <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
    </div>
  );
};
