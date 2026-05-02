"use client";
import { useState, useRef } from "react";
import { Mic, Square, RotateCcw } from "lucide-react";

interface Props {
  onRecorded: (blob: Blob) => void;
  onCleared: () => void;
}

export default function VoiceRecorder({ onRecorded, onCleared }: Props) {
  const [state, setState] = useState<"idle" | "recording" | "done">("idle");
  const [seconds, setSeconds] = useState(0);
  const [bars, setBars] = useState<number[]>(Array(32).fill(4));

  const mediaRef   = useRef<MediaRecorder | null>(null);
  const chunksRef  = useRef<Blob[]>([]);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animRef    = useRef<number>(0);
  const timerRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const secondsRef = useRef(0);

  const fmt = (s: number) => `0:${s.toString().padStart(2, "0")}`;

  const stopRecording = () => {
    if (mediaRef.current?.state === "recording") {
      mediaRef.current.stop();
      mediaRef.current.stream.getTracks().forEach((t) => t.stop());
    }
    cancelAnimationFrame(animRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      analyserRef.current = analyser;

      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => chunksRef.current.push(e.data);
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        onRecorded(blob);
        setState("done");
      };
      mr.start();
      mediaRef.current = mr;
      secondsRef.current = 0;
      setSeconds(0);
      setState("recording");

      timerRef.current = setInterval(() => {
        secondsRef.current += 1;
        setSeconds(secondsRef.current);
        if (secondsRef.current >= 30) stopRecording();
      }, 1000);

      const animate = () => {
        const data = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(data);
        setBars(
          Array.from({ length: 32 }, (_, i) => {
            const v = data[Math.floor((i * data.length) / 32)] / 255;
            return Math.max(4, Math.floor(v * 44));
          })
        );
        animRef.current = requestAnimationFrame(animate);
      };
      animate();
    } catch {
      alert("Microphone access denied. Please allow mic access to record.");
    }
  };

  const reset = () => {
    setBars(Array(32).fill(4));
    setSeconds(0);
    setState("idle");
    onCleared();
  };

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: "rgba(255,20,147,0.06)",
        border: "1px solid rgba(255,20,147,0.25)",
      }}
    >
      <div className="px-4 py-3 flex items-center gap-3">
        {/* Button */}
        {state === "idle" && (
          <button
            onClick={startRecording}
            className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 active:scale-95 transition-transform"
            style={{ background: "linear-gradient(135deg,#FF1493,#FF6B00)" }}
          >
            <Mic size={20} color="white" />
          </button>
        )}
        {state === "recording" && (
          <button
            onClick={stopRecording}
            className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 animate-pulse"
            style={{ background: "#FF1493" }}
          >
            <Square size={16} color="white" fill="white" />
          </button>
        )}
        {state === "done" && (
          <button
            onClick={reset}
            className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(255,20,147,0.15)" }}
          >
            <RotateCcw size={18} style={{ color: "#FF1493" }} />
          </button>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          {state === "idle" && (
            <div>
              <p className="text-sm font-bold text-gray-800">Add a voice note 🎤</p>
              <p className="text-xs text-gray-400 mt-0.5">Up to 30 sec · hits different</p>
            </div>
          )}
          {state === "recording" && (
            <div>
              <div className="flex items-end gap-px h-10">
                {bars.map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-full transition-all duration-75"
                    style={{
                      height: h,
                      background: "linear-gradient(to top,#FF1493,#FF6B00)",
                      minWidth: 2,
                    }}
                  />
                ))}
              </div>
              <p className="text-xs font-bold mt-1" style={{ color: "#FF1493" }}>
                🔴 {fmt(seconds)} / 0:30
              </p>
            </div>
          )}
          {state === "done" && (
            <div>
              <p className="text-sm font-black" style={{ color: "#FF1493" }}>
                ✅ Voice note locked in
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {fmt(seconds)} · tap ↺ to redo
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
