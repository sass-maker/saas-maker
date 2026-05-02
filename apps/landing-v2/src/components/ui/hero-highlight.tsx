"use client";
import { motion } from "framer-motion";
import React from "react";

import { cn } from "@/lib/utils";

export const HeroHighlight = ({
  children,
  className,
  containerClassName,
}: {
  children: React.ReactNode;
  className?: string;
  containerClassName?: string;
}) => {
  return (
    <div
      className={cn(
        "relative h-[40rem] flex items-center bg-black justify-center w-full group",
        containerClassName
      )}
    >
      <div className="absolute inset-0 bg-dot-thick-neutral-800  pointer-events-none" />
      <motion.div
        className="absolute inset-0 bg-dot-thick-blue-500   pointer-events-none opacity-0 group-hover:opacity-100 transition duration-300"
        style={{
          WebkitMaskImage: `radial-gradient(
            200px circle at center,
            white,
            transparent
          )`,
          maskImage: `radial-gradient(
            200px circle at center,
            white,
            transparent
          )`,
        }}
      />
      <div className={cn("relative z-20", className)}>{children}</div>
    </div>
  );
};

export const Highlight = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  return (
    <motion.span
      initial={{
        backgroundSize: "0% 100%",
      }}
      animate={{
        backgroundSize: "100% 100%",
      }}
      transition={{
        duration: 2,
        ease: "linear",
        delay: 0.5,
      }}
      style={{
        backgroundRepeat: "no-repeat",
        backgroundPosition: "left center",
        display: "inline",
      }}
      className={cn(
        `relative inline-block pb-1 px-1 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-500`,
        className
      )}
    >
      {children}
    </motion.span>
  );
};
