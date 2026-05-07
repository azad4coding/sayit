"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import {
  LogOut, Edit2, Check, X, Trash2, Camera,
  Phone, Mail, ChevronRight, Send, Heart,
  Share2, ShieldCheck, HelpCircle, Bell,
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
  const [sentCount,      setSentCount]      = useState(0);
  const [receivedCount,  setReceivedCount]  = useState(0);
  const [error,          setError]          = useState("");
  const [saved,          setSaved]          = useState(false);
  const [clearing,       setClearing]       = useState(false);
  const [confirmClear,   setConfirmClear]   = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const nameInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const accent  = "#FF6B8A";
  const purple  = "#9B59B6";

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

      // Sent count
      const { count: sc } = await supabase
        .from("sent_cards")
        .select("id", { count: "exact", head: true })
        .eq("sender_id", user.id);
      setSentCount(sc ?? 0);

      // Received count
      const queryPhone = rawPhone || profile?.phone;
      let receivedQ = supabase
        .from("sent_cards")
        .select("id", { count: "exact", head: true });
      if (queryPhone) {
        receivedQ = receivedQ.or(`recipient_id.eq.${user.id},recipient_phone.eq.${queryPhone}`);
      } else {
        receivedQ = receivedQ.eq("recipient_id", user.id);
      }
      const { count: rc } = await receivedQ;
      setReceivedCount(rc ?? 0);

      setLoading(false);
    }
    load();
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

    // Use server-side API so service role key bypasses RLS for recipient deletes
    const { data: { session } } = await supabase.auth.getSession();
    await fetch("/api/clear-history", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session?.access_token ?? ""}`,
      },
      body: JSON.stringify({ userId, phone }),
    });

    setSentCount(0); setReceivedCount(0);
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
      <div className="min-h-dvh flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-pink-200 border-t-pink-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex flex-col pb-28 bg-gray-50">

      {/* ── Hero Banner ── */}
      <div className="relative mb-16">
        {/* Gradient banner */}
        <div className="h-44 w-full"
          style={{ background: "linear-gradient(135deg,#FF6B8A 0%,#C050A0 50%,#9B59B6 100%)" }}>
          {/* Back button */}
          <button onClick={() => router.push("/home")}
            style={{ position: "absolute", top: 52, left: 20, width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.2)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.3)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          </button>
          {/* Decorative bubbles */}
          <div className="absolute top-6 left-8 w-16 h-16 rounded-full opacity-20 bg-white" />
          <div className="absolute top-3 right-12 w-10 h-10 rounded-full opacity-15 bg-white" />
          <div className="absolute top-14 right-6 w-6 h-6 rounded-full opacity-20 bg-white" />
        </div>

        {/* Avatar anchored to bottom of banner */}
        <div className="absolute left-1/2 -translate-x-1/2 -bottom-14">
          <div className="relative">
            <div className="w-28 h-28 rounded-full border-4 border-white shadow-xl overflow-hidden flex items-center justify-center"
              style={{ background: "linear-gradient(135deg,#FF6B8A,#9B59B6)" }}>
              {uploadingPhoto ? (
                <div className="w-7 h-7 border-4 border-white border-t-transparent rounded-full animate-spin" />
              ) : avatarUrl ? (
                <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-4xl font-bold text-white">{initials}</span>
              )}
            </div>
            {/* Camera overlay */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-0.5 right-0.5 w-8 h-8 rounded-full flex items-center justify-center shadow-md border-2 border-white"
              style={{ background: accent }}>
              <Camera className="w-4 h-4 text-white" />
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
          </div>
        </div>
      </div>

      {/* ── Name & handle ── */}
      <div className="flex flex-col items-center px-6 mb-6">
        {editingName ? (
          <div className="flex items-center gap-2 w-full max-w-xs">
            <input
              ref={nameInputRef}
              value={draftName}
              onChange={e => setDraftName(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") saveName(); if (e.key === "Escape") cancelEditName(); }}
              placeholder="Your name"
              className="flex-1 px-4 py-2.5 rounded-2xl border border-gray-200 bg-white text-sm font-semibold text-center focus:outline-none focus:ring-2 focus:ring-pink-200 shadow-sm"
            />
            <button onClick={saveName} disabled={saving}
              className="w-9 h-9 rounded-full flex items-center justify-center text-white shadow"
              style={{ background: "linear-gradient(135deg,#FF6B8A,#9B59B6)" }}>
              {saving
                ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <Check className="w-4 h-4" />}
            </button>
            <button onClick={cancelEditName}
              className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>
        ) : (
          <button onClick={startEditName}
            className="flex items-center gap-2 group">
            <span className="text-2xl font-bold text-gray-800">{name || "Add your name"}</span>
            <Edit2 className="w-4 h-4 text-gray-300 group-hover:text-pink-400 transition-colors" />
          </button>
        )}
        {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
        {saved && <p className="text-xs font-semibold mt-1" style={{ color: accent }}>Saved ✓</p>}
        {displayPhone && !editingName && (
          <p className="text-sm text-gray-400 mt-1">{displayPhone}</p>
        )}
      </div>

      {/* ── Stats row ── */}
      <div className="mx-5 mb-5 rounded-2xl bg-white shadow-sm overflow-hidden flex divide-x divide-gray-100"
        style={{ border: "1px solid rgba(0,0,0,0.05)" }}>
        <div className="flex-1 flex flex-col items-center py-4 gap-0.5">
          <span className="text-2xl font-bold" style={{ color: accent }}>{sentCount}</span>
          <span className="text-[11px] font-semibold text-gray-400">Cards Sent</span>
        </div>
        <div className="flex-1 flex flex-col items-center py-4 gap-0.5">
          <span className="text-2xl font-bold" style={{ color: purple }}>{receivedCount}</span>
          <span className="text-[11px] font-semibold text-gray-400">Cards Received</span>
        </div>
        <div className="flex-1 flex flex-col items-center py-4 gap-0.5">
          <span className="text-2xl font-bold text-gray-700">{sentCount + receivedCount}</span>
          <span className="text-[11px] font-semibold text-gray-400">Total Cards</span>
        </div>
      </div>

      {/* ── Quick actions ── */}
      <div className="mx-5 mb-5 flex gap-3">
        <button onClick={() => router.push("/home")}
          className="flex-1 flex flex-col items-center gap-1.5 py-4 rounded-2xl bg-white shadow-sm"
          style={{ border: "1px solid rgba(0,0,0,0.05)" }}>
          <div className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ background: `${accent}18` }}>
            <Send className="w-4 h-4" style={{ color: accent }} />
          </div>
          <span className="text-[11px] font-semibold text-gray-500">Send Card</span>
        </button>
        <button onClick={() => router.push("/history")}
          className="flex-1 flex flex-col items-center gap-1.5 py-4 rounded-2xl bg-white shadow-sm"
          style={{ border: "1px solid rgba(0,0,0,0.05)" }}>
          <div className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ background: `${purple}18` }}>
            <Heart className="w-4 h-4" style={{ color: purple }} />
          </div>
          <span className="text-[11px] font-semibold text-gray-500">History</span>
        </button>
        <button onClick={() => router.push("/wishes")}
          className="flex-1 flex flex-col items-center gap-1.5 py-4 rounded-2xl bg-white shadow-sm"
          style={{ border: "1px solid rgba(0,0,0,0.05)" }}>
          <div className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ background: "#F39C1218" }}>
            <Bell className="w-4 h-4 text-amber-400" />
          </div>
          <span className="text-[11px] font-semibold text-gray-500">Notifications</span>
        </button>
      </div>

      {/* ── Account section ── */}
      <div className="mx-5 mb-4">
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest px-1 mb-2">Account</p>
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: "1px solid rgba(0,0,0,0.05)" }}>

          {/* Phone */}
          <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-50">
            <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: `${accent}18` }}>
              <Phone className="w-4 h-4" style={{ color: accent }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Phone</p>
              <p className="text-sm font-semibold text-gray-700 truncate">
                {displayPhone ?? "Not added yet"}
              </p>
            </div>
            {!displayPhone && (
              <button onClick={() => router.push("/add-phone")}
                className="text-xs font-semibold px-3 py-1.5 rounded-full text-white"
                style={{ background: "linear-gradient(135deg,#FF6B8A,#9B59B6)" }}>
                Add
              </button>
            )}
          </div>

          {/* Email */}
          <div className="flex items-center gap-3 px-4 py-3.5">
            <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: `${purple}18` }}>
              <Mail className="w-4 h-4" style={{ color: purple }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Email</p>
              <p className="text-sm font-semibold text-gray-700 truncate">{email || "—"}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── More section ── */}
      <div className="mx-5 mb-4">
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest px-1 mb-2">More</p>
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: "1px solid rgba(0,0,0,0.05)" }}>

          <button className="w-full flex items-center gap-3 px-4 py-3.5 border-b border-gray-50 text-left"
            onClick={() => {
              if (navigator.share) {
                navigator.share({ title: "SayIt", text: "Send heartfelt greeting cards with SayIt 💌", url: "https://sayit.app" });
              }
            }}>
            <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "#27AE6018" }}>
              <Share2 className="w-4 h-4 text-green-500" />
            </div>
            <span className="flex-1 text-sm font-semibold text-gray-700">Invite Friends</span>
            <ChevronRight className="w-4 h-4 text-gray-300" />
          </button>

          <button className="w-full flex items-center gap-3 px-4 py-3.5 border-b border-gray-50 text-left">
            <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "#3498DB18" }}>
              <ShieldCheck className="w-4 h-4 text-blue-400" />
            </div>
            <span className="flex-1 text-sm font-semibold text-gray-700">Privacy Policy</span>
            <ChevronRight className="w-4 h-4 text-gray-300" />
          </button>

          <button className="w-full flex items-center gap-3 px-4 py-3.5 text-left">
            <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "#F39C1218" }}>
              <HelpCircle className="w-4 h-4 text-amber-400" />
            </div>
            <span className="flex-1 text-sm font-semibold text-gray-700">Help & Support</span>
            <ChevronRight className="w-4 h-4 text-gray-300" />
          </button>
        </div>
      </div>

      {/* ── Sign Out ── */}
      <div className="mx-5 mb-3">
        <button onClick={handleSignOut}
          className="w-full py-4 rounded-2xl bg-white shadow-sm text-sm font-semibold text-red-400 flex items-center justify-center gap-2"
          style={{ border: "1px solid rgba(0,0,0,0.05)" }}>
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>

      {/* ── Clear history (danger) ── */}
      <div className="mx-5 mb-4">
        {!confirmClear ? (
          <button onClick={() => setConfirmClear(true)}
            className="w-full py-3 rounded-2xl bg-white shadow-sm text-xs font-semibold text-gray-400 flex items-center justify-center gap-2"
            style={{ border: "1px solid rgba(0,0,0,0.05)" }}>
            <Trash2 className="w-3.5 h-3.5" />
            Clear All History
          </button>
        ) : (
          <div className="w-full rounded-2xl bg-white shadow-sm px-5 py-4 flex flex-col items-center gap-3"
            style={{ border: "1px solid #FF6B8A30" }}>
            <p className="text-xs text-gray-500 text-center">This deletes all your sent cards and reactions. Can't be undone.</p>
            <div className="flex gap-2 w-full">
              <button onClick={() => setConfirmClear(false)}
                className="flex-1 py-2.5 rounded-xl bg-gray-100 text-xs font-semibold text-gray-500">
                Cancel
              </button>
              <button onClick={clearHistory} disabled={clearing}
                className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-white flex items-center justify-center gap-1"
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
      <p className="text-center text-[10px] text-gray-300 font-medium mt-1">SayIt v1.0 · Made with 💌</p>
    </div>
  );
}
