"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import {
  LogOut, Edit2, Check, X, Trash2, Camera,
  Phone, Mail, ChevronRight, ShieldCheck,
  HelpCircle, Star,
} from "lucide-react";

export default function ProfilePage() {
  const router   = useRouter();
  const supabase = createClient();

  const [loading,        setLoading]        = useState(true);
  const [saving,         setSaving]         = useState(false);
  const [userId,         setUserId]         = useState("");
  const [name,           setName]           = useState("");
  const [editingName,    setEditingName]    = useState(false);
  const [draftName,      setDraftName]      = useState("");
  const [phone,          setPhone]          = useState("");
  const [email,          setEmail]          = useState("");
  const [avatarUrl,      setAvatarUrl]      = useState<string | null>(null);
  const [error,          setError]          = useState("");
  const [saved,          setSaved]          = useState(false);
  const [clearing,       setClearing]       = useState(false);
  const [confirmClear,   setConfirmClear]   = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const nameInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const titleBarRef  = useRef<HTMLDivElement>(null);

  const accent = "#FF6B8A";
  const purple = "#9B59B6";

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/login"); return; }
      setUserId(user.id);
      setEmail(user.email ?? "");
      const rawPhone = user.phone ?? "";
      setPhone(rawPhone);

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, phone, avatar_url")
        .eq("id", user.id)
        .single();

      setName(profile?.full_name ?? user.user_metadata?.full_name ?? "");
      if (!rawPhone && profile?.phone) setPhone(profile.phone);
      if (profile?.avatar_url) setAvatarUrl(profile.avatar_url);

      setLoading(false);
    }
    load();
  }, []);

  // Scroll listener — listens on main.page-content (the actual scroll container)
  useEffect(() => {
    const scroller = document.querySelector("main") as HTMLElement | null;
    if (!scroller) return;
    const handleScroll = () => {
      if (titleBarRef.current) {
        titleBarRef.current.classList.toggle("bar-visible", scroller.scrollTop > 80);
      }
    };
    scroller.addEventListener("scroll", handleScroll, { passive: true });
    return () => scroller.removeEventListener("scroll", handleScroll);
  }, []);

  function startEditName() {
    setDraftName(name);
    setEditingName(true);
    setTimeout(() => nameInputRef.current?.focus(), 50);
  }

  function cancelEditName() {
    setEditingName(false);
    setDraftName("");
    setError("");
  }

  async function saveName() {
    const trimmed = draftName.trim();
    if (!trimmed) { setError("Name can't be empty"); return; }
    setSaving(true); setError("");
    const { error: dbErr } = await supabase
      .from("profiles")
      .upsert({ id: userId, full_name: trimmed }, { onConflict: "id" });
    setSaving(false);
    if (dbErr) { setError(dbErr.message); return; }
    setName(trimmed);
    setEditingName(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !userId) return;
    setUploadingPhoto(true);
    const ext  = file.name.split(".").pop() ?? "jpg";
    const path = `avatars/${userId}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (!upErr) {
      const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
      await supabase.from("profiles").upsert({ id: userId, avatar_url: publicUrl }, { onConflict: "id" });
      setAvatarUrl(publicUrl + `?t=${Date.now()}`);
    }
    setUploadingPhoto(false);
  }

  async function clearHistory() {
    setClearing(true);
    const { data: { session } } = await supabase.auth.getSession();
    await fetch("/api/clear-history", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session?.access_token ?? ""}`,
      },
      body: JSON.stringify({ userId, phone }),
    });
    setClearing(false); setConfirmClear(false);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  const initials = name
    ? name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()
    : phone ? phone.slice(-2) : "?";

  const displayPhone = phone
    ? (phone.startsWith("+") ? phone : `+${phone}`)
    : null;

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center" style={{ background: "#f5f6f7" }}>
        <div className="w-8 h-8 border-4 border-pink-200 border-t-pink-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex flex-col pb-28" style={{ background: "#f5f6f7" }}>

      {/* ── Fixed compact title bar (WhatsApp-style) — hidden until scroll > 80px ── */}
      <div className="sticky-title-bar" ref={titleBarRef}>
        <span style={{ fontSize: 16, fontWeight: 700, color: "#111827", letterSpacing: "-0.2px" }}>Profile</span>
      </div>

      {/* ── Hero ── */}
      <div className="relative" style={{ background: "linear-gradient(to bottom,#FF6B8A 0%,#C050A0 55%,#9B59B6 100%)" }}>
        {/* Subtle decorative orbs */}
        <div style={{ position: "absolute", top: 24, left: 20, width: 80, height: 80, borderRadius: "50%", background: "rgba(255,255,255,0.08)" }} />
        <div style={{ position: "absolute", top: 10, right: 30, width: 50, height: 50, borderRadius: "50%", background: "rgba(255,255,255,0.06)" }} />

        {/* Avatar + name stacked in the hero */}
        <div className="flex flex-col items-center pb-8 px-6 relative z-10" style={{ paddingTop: "calc(env(safe-area-inset-top, 44px) + 12px)" }}>

          {/* Avatar */}
          <div className="relative mb-4">
            <div
              className="w-28 h-28 rounded-full border-4 border-white shadow-2xl overflow-hidden flex items-center justify-center"
              style={{ background: "linear-gradient(135deg,#FF6B8A,#9B59B6)" }}
            >
              {uploadingPhoto ? (
                <div className="w-7 h-7 border-4 border-white border-t-transparent rounded-full animate-spin" />
              ) : avatarUrl ? (
                <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-4xl font-bold text-white">{initials}</span>
              )}
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-1 right-1 w-8 h-8 rounded-full flex items-center justify-center border-2 border-white shadow-md"
              style={{ background: accent }}
            >
              <Camera className="w-3.5 h-3.5 text-white" />
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
          </div>

          {/* Name */}
          {editingName ? (
            <div className="flex items-center gap-2 w-full max-w-xs">
              <input
                ref={nameInputRef}
                value={draftName}
                onChange={e => setDraftName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") saveName(); if (e.key === "Escape") cancelEditName(); }}
                placeholder="Your name"
                className="flex-1 px-4 py-2.5 rounded-2xl border-0 text-sm font-semibold text-center focus:outline-none focus:ring-2 focus:ring-white/60 shadow"
                style={{ background: "rgba(255,255,255,0.25)", color: "white" }}
              />
              <button onClick={saveName} disabled={saving}
                className="w-9 h-9 rounded-full bg-white/25 flex items-center justify-center">
                {saving
                  ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <Check className="w-4 h-4 text-white" />}
              </button>
              <button onClick={cancelEditName}
                className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center">
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
          ) : (
            <button onClick={startEditName} className="flex items-center gap-2 group">
              <span className="text-2xl font-bold text-white drop-shadow">{name || "Add your name"}</span>
              <Edit2 className="w-4 h-4 text-white/60 group-hover:text-white transition-colors" />
            </button>
          )}

          {error && <p className="text-xs text-red-200 mt-1">{error}</p>}
          {saved && <p className="text-xs font-semibold text-white/80 mt-1">Saved ✓</p>}

          {displayPhone && !editingName && (
            <p className="text-sm text-white/70 mt-1 font-medium">{displayPhone}</p>
          )}

        </div>
      </div>

      {/* ── Account ── */}
      <div className="mt-6 mx-4">
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest px-1 mb-2">Account</p>
        <div className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>

          <div className="flex items-center gap-4 px-4 py-4 border-b border-gray-50">
            <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: `${accent}18` }}>
              <Phone className="w-4 h-4" style={{ color: accent }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Phone</p>
              <p className="text-sm font-semibold text-gray-800 truncate">{displayPhone ?? "Not added yet"}</p>
            </div>
            {!displayPhone && (
              <button onClick={() => router.push("/add-phone")}
                className="text-xs font-bold px-3 py-1.5 rounded-full text-white"
                style={{ background: `linear-gradient(135deg,${accent},${purple})` }}>
                Add
              </button>
            )}
          </div>

          <div className="flex items-center gap-4 px-4 py-4">
            <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: `${purple}18` }}>
              <Mail className="w-4 h-4" style={{ color: purple }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Email</p>
              <p className="text-sm font-semibold text-gray-800 truncate">{email || "—"}</p>
            </div>
          </div>
        </div>
      </div>


      {/* ── Support ── */}
      <div className="mt-5 mx-4">
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest px-1 mb-2">Support</p>
        <div className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>

          <a href="/privacy" className="w-full flex items-center gap-4 px-4 py-4 border-b border-gray-50 text-left active:bg-gray-50" style={{ textDecoration: "none" }}>
            <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: "#3498DB18" }}>
              <ShieldCheck className="w-4 h-4 text-blue-400" />
            </div>
            <span className="flex-1 text-sm font-semibold text-gray-800">Privacy Policy</span>
            <ChevronRight className="w-4 h-4 text-gray-300" />
          </a>

          <a href="/help" className="w-full flex items-center gap-4 px-4 py-4 border-b border-gray-50 text-left active:bg-gray-50" style={{ textDecoration: "none" }}>
            <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: "#F39C1218" }}>
              <HelpCircle className="w-4 h-4 text-amber-400" />
            </div>
            <span className="flex-1 text-sm font-semibold text-gray-800">Help & Support</span>
            <ChevronRight className="w-4 h-4 text-gray-300" />
          </a>

          <button className="w-full flex items-center gap-4 px-4 py-4 text-left active:bg-gray-50">
            <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: "#F1C40F18" }}>
              <Star className="w-4 h-4 text-yellow-400" />
            </div>
            <span className="flex-1 text-sm font-semibold text-gray-800">Rate SayIt</span>
            <ChevronRight className="w-4 h-4 text-gray-300" />
          </button>
        </div>
      </div>

      {/* ── Sign Out ── */}
      <div className="mt-5 mx-4">
        <button onClick={handleSignOut}
          className="w-full py-4 rounded-2xl bg-white text-sm font-bold text-red-400 flex items-center justify-center gap-2 active:bg-red-50"
          style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>

      {/* ── Clear history (danger zone) ── */}
      <div className="mt-3 mx-4">
        {!confirmClear ? (
          <button onClick={() => setConfirmClear(true)}
            className="w-full py-3 rounded-2xl bg-white text-xs font-semibold text-gray-300 flex items-center justify-center gap-2 active:bg-gray-50"
            style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
            <Trash2 className="w-3.5 h-3.5" />
            Clear All History
          </button>
        ) : (
          <div className="w-full rounded-2xl bg-white px-5 py-4 flex flex-col items-center gap-3"
            style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)", border: "1px solid #FF6B8A25" }}>
            <p className="text-xs text-gray-500 text-center leading-relaxed">
              This permanently deletes all your sent cards and reactions. This can&apos;t be undone.
            </p>
            <div className="flex gap-2 w-full">
              <button onClick={() => setConfirmClear(false)}
                className="flex-1 py-2.5 rounded-xl bg-gray-100 text-xs font-bold text-gray-500">
                Cancel
              </button>
              <button onClick={clearHistory} disabled={clearing}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-1"
                style={{ background: "linear-gradient(135deg,#FF6B8A,#E74C3C)" }}>
                {clearing
                  ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <><Trash2 className="w-3 h-3" /> Yes, clear it</>}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Version */}
      <p className="text-center text-[10px] text-gray-300 font-medium mt-6 mb-2">SayIt v1.0 · Made with 💌</p>
    </div>
  );
}
