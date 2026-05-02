"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  senderName: string;
  onComplete: () => void;
}

export default function EnvelopeReveal({ senderName, onComplete }: Props) {
  const [stage, setStage] = useState<"closed" | "opening" | "done">("closed");

  useEffect(() => {
    const t1 = setTimeout(() => setStage("opening"), 800);
    const t2 = setTimeout(() => setStage("done"), 2200);
    const t3 = setTimeout(() => onComplete(), 2600);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onComplete]);

  return (
    <AnimatePresence>
      {stage !== "done" && (
        <motion.div
          key="envelope-overlay"
          className="fixed inset-0 z-50 flex flex-col items-center justify-center"
          style={{ background: "linear-gradient(160deg,#FFF5F7,#F8F0FF)" }}
          exit={{ opacity: 0, scale: 1.05, transition: { duration: 0.4 } }}
        >
          {/* Sender label */}
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0, transition: { delay: 0.2 } }}
            className="text-sm font-semibold text-gray-400 mb-8 tracking-wide"
          >
            {senderName} sent you something 💌
          </motion.p>

          {/* Envelope */}
          <div className="relative w-64 h-44" style={{ perspective: 600 }}>
            {/* Envelope body */}
            <motion.div
              className="absolute inset-0 rounded-2xl shadow-2xl overflow-hidden"
              style={{ background: "linear-gradient(135deg,#FF6B8A,#9B59B6)" }}
              animate={stage === "opening" ? { scale: [1, 1.06, 1], transition: { duration: 0.5 } } : {}}
            >
              {/* Bottom fold lines */}
              <div className="absolute bottom-0 left-0 right-0 h-1/2"
                style={{ background: "rgba(255,255,255,0.08)" }} />
              {/* Center crease */}
              <div className="absolute inset-x-0 top-1/2 h-px bg-white/20" />
            </motion.div>

            {/* Flap */}
            <motion.div
              className="absolute top-0 left-0 right-0 h-1/2 origin-top rounded-t-2xl"
              style={{
                background: "linear-gradient(160deg,#FF8FA3,#C39BD3)",
                transformStyle: "preserve-3d",
                zIndex: 10,
              }}
              animate={
                stage === "opening"
                  ? { rotateX: -160, transition: { duration: 0.9, ease: [0.25, 0.46, 0.45, 0.94] } }
                  : { rotateX: 0 }
              }
            >
              {/* Flap V shape */}
              <div className="absolute bottom-0 left-0 right-0 flex justify-center">
                <div style={{
                  width: 0, height: 0,
                  borderLeft: "128px solid transparent",
                  borderRight: "128px solid transparent",
                  borderTop: "48px solid rgba(255,107,138,0.6)"
                }} />
              </div>
            </motion.div>

            {/* Heart rising out */}
            <motion.div
              className="absolute left-1/2 -translate-x-1/2 text-5xl z-20"
              initial={{ y: 60, opacity: 0 }}
              animate={
                stage === "opening"
                  ? { y: -20, opacity: 1, transition: { delay: 0.5, duration: 0.7, ease: "backOut" } }
                  : {}
              }
            >
              💌
            </motion.div>
          </div>

          {/* Tap hint */}
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { delay: 0.5 } }}
            onClick={() => { setStage("done"); setTimeout(onComplete, 400); }}
            className="mt-12 text-xs text-gray-300 underline underline-offset-2"
          >
            tap to skip
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
