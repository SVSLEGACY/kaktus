"use client";

import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-screen bg-transparent">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2 }}
        className="flex flex-col items-center gap-4 p-8 rounded-2xl bg-black/40 backdrop-blur-md border border-white/10 shadow-2xl"
      >
        <Loader2 className="w-10 h-10 text-emerald-400 animate-spin" />
        <h2 className="text-xl font-medium text-white tracking-wide">Loading workspace...</h2>
        <p className="text-sm text-neutral-400">Initializing Kaktus AI Studio</p>
      </motion.div>
    </div>
  );
}
