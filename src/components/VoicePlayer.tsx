"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { Play, Pause } from "lucide-react";

export default function VoicePlayer({ url }: { url: string }) {
  const audioRef  = useRef<HTMLAudioElement | null>(null);
  const [playing,  setPlaying]  = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [curTime,  setCurTime]  = useState(0);
  const [bars]    = useState(() =>
    Array.from({ length: 40 }, () => Math.random() * 0.75 + 0.25)
  );

  useEffect(() => {
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.onloadedmetadata = () => setDuration(audio.duration);
    audio.ontimeupdate = () => {
      setCurTime(audio.currentTime);
      setProgress(audio.duration ? audio.currentTime / audio.duration : 0);
    };
    audio.onended = () => {
      setPlaying(false);
      setProgress(0);
      setCurTime(0);
    };
    return () => { audio.pause(); };
  }, [url]);

  const toggle = useCallback(() => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setPlaying((p) => !p);
  }, [playing]);

  const fmt = (s: number) => `0:${Math.floor(s).toString().padStart(2, "0")}`;

  return (
    <div
      className="mx-5 mb-5 rounded-2xl px-4 py-3 flex items-center gap-3"
      style={{
        background: "linear-gradient(135deg,rgba(255,20,147,0.12),rgba(255,107,0,0.08))",
        border: "1px solid rgba(255,20,147,0.3)",
      }}
    >
      <button
        onClick={toggle}
        className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 active:scale-95 transition-transform"
        style={{ background: "linear-gradient(135deg,#FF1493,#FF6B00)" }}
      >
        {playing ? (
          <Pause size={18} color="white" />
        ) : (
          <Play size={18} color="white" fill="white" />
        )}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-end gap-px h-8 mb-1">
          {bars.map((h, i) => (
            <div
              key={i}
              className="flex-1 rounded-full transition-colors duration-100"
              style={{
                height: `${h * 100}%`,
                background:
                  i / bars.length <= progress
                    ? "linear-gradient(to top,#FF1493,#FF6B00)"
                    : "rgba(255,20,147,0.2)",
              }}
            />
          ))}
        </div>
        <p className="text-xs" style={{ color: "rgba(255,20,147,0.8)" }}>
          {playing ? fmt(curTime) : fmt(duration)} · voice note 🎤
        </p>
      </div>
    </div>
  );
}
