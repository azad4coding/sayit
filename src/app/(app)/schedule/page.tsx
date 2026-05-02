"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase";
import { Clock, Plus, Trash2, ChevronRight, X, Check, ArrowLeft, ToggleLeft, ToggleRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// ── Types ─────────────────────────────────────────────────────────────────────
type Recurrence = "one-time" | "daily" | "weekly" | "monthly";
type CardMode   = "category" | "specific";

interface ScheduledCard {
  id:              string;
  user_id:         string;
  recipient_phone: string;
  recipient_name:  string | null;
  recipient_id:    string | null;
  category_id:     string | null;
  category_name:   string | null;
  category_icon:   string | null;
  template_id:     string | null;
  template_image:  string | null;
  message:         string | null;
  recurrence:      Recurrence;
  scheduled_time:  string;      // "HH:MM"
  scheduled_day:   number | null; // 0-6 for weekly, 1-31 for monthly
  scheduled_at:    string | null; // ISO for one-time
  next_run_at:     string;
  last_run_at:     string | null;
  is_active:       boolean;
  created_at:      string;
}

interface DBCategory { id: string; name: string; icon: string; slug: string; }
interface DBTemplate { id: string; category_id: string; front_image_url: string | null; title: string | null; }
interface FoundUser   { id: string; name: string; phone: string; }

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const RECURRENCE_OPTS: { value: Recurrence; label: string; icon: string }[] = [
  { value: "one-time", label: "One-time",  icon: "📅" },
  { value: "daily",    label: "Every day", icon: "🌅" },
  { value: "weekly",   label: "Weekly",    icon: "📆" },
  { value: "monthly",  label: "Monthly",   icon: "🗓️" },
];

function formatNextRun(isoStr: string | null): string {
  if (!isoStr) return "—";
  const d = new Date(isoStr);
  if (d.getFullYear() > 3000) return "Completed";
  const now = new Date();
  const diff = d.getTime() - now.getTime();
  if (diff < 0) return "Sending soon";
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 60)  return `in ${mins}m`;
  if (hours < 24) return `in ${hours}h`;
  return `in ${days}d · ${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}

function formatTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${m.toString().padStart(2, "0")} ${ampm}`;
}

function recurrenceLabel(s: ScheduledCard): string {
  if (s.recurrence === "daily")   return `Every day at ${formatTime(s.scheduled_time)}`;
  if (s.recurrence === "weekly")  return `Every ${DAYS[s.scheduled_day ?? 1]} at ${formatTime(s.scheduled_time)}`;
  if (s.recurrence === "monthly") return `Monthly on day ${s.scheduled_day} at ${formatTime(s.scheduled_time)}`;
  if (s.recurrence === "one-time" && s.scheduled_at) {
    return `${new Date(s.scheduled_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })} at ${formatTime(s.scheduled_time)}`;
  }
  return formatTime(s.scheduled_time);
}

// ── Compute next_run_at client-side (mirrors server logic) ────────────────────
function computeNextRun(recurrence: Recurrence, time: string, day: number | null, scheduledAt: string | null): string {
  const now = new Date();
  const [hours, minutes] = time.split(":").map(Number);

  if (recurrence === "one-time" && scheduledAt) {
    const d = new Date(scheduledAt);
    d.setHours(hours, minutes, 0, 0);
    return d.toISOString();
  }

  const next = new Date(now);
  next.setSeconds(0, 0);
  next.setHours(hours, minutes);

  if (recurrence === "daily") {
    if (next <= now) next.setDate(next.getDate() + 1);
  } else if (recurrence === "weekly") {
    const target = day ?? 1;
    const diff   = (target - next.getDay() + 7) % 7;
    next.setDate(next.getDate() + (diff === 0 && next <= now ? 7 : diff));
  } else if (recurrence === "monthly") {
    next.setDate(day ?? 1);
    if (next <= now) { next.setMonth(next.getMonth() + 1); next.setDate(day ?? 1); }
  }

  return next.toISOString();
}

// ═══════════════════════════════════════════════════════════════════════════════
export default function SchedulePage() {
  const router  = useRouter();
  const [schedules,    setSchedules]    = useState<ScheduledCard[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [showForm,     setShowForm]     = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [categories,   setCategories]   = useState<DBCategory[]>([]);
  const [templates,    setTemplates]    = useState<DBTemplate[]>([]);
  const [loadingTmpls, setLoadingTmpls] = useState(false);
  const [suggestions,  setSuggestions]  = useState<FoundUser[]>([]);

  // Form state
  const [recipientSearch,  setRecipientSearch]  = useState("");
  const [selectedContact,  setSelectedContact]  = useState<FoundUser | null>(null);
  const [cardMode,         setCardMode]         = useState<CardMode>("category");
  const [selectedCategory, setSelectedCategory] = useState<DBCategory | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<DBTemplate | null>(null);
  const [message,          setMessage]          = useState("");
  const [recurrence,       setRecurrence]       = useState<Recurrence>("daily");
  const [time,             setTime]             = useState("08:00");
  const [weekDay,          setWeekDay]          = useState(1); // Mon
  const [monthDay,         setMonthDay]         = useState(1);
  const [oneTimeDate,      setOneTimeDate]       = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });

  const supabase = createClient();

  // ── Load schedules ──────────────────────────────────────────────────────────
  async function load() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }

    const { data } = await supabase
      .from("scheduled_cards")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    setSchedules((data ?? []) as ScheduledCard[]);
    setLoading(false);
  }

  // ── Load categories ─────────────────────────────────────────────────────────
  async function loadCategories() {
    const { data } = await supabase
      .from("categories")
      .select("id, name, icon, slug")
      .order("name");
    setCategories((data ?? []) as DBCategory[]);
  }

  // ── Load templates for a category ──────────────────────────────────────────
  async function loadTemplates(categoryId: string) {
    setLoadingTmpls(true);
    const { data } = await supabase
      .from("templates")
      .select("id, category_id, front_image_url, title")
      .eq("category_id", categoryId)
      .limit(20);
    setTemplates((data ?? []) as DBTemplate[]);
    setLoadingTmpls(false);
  }

  useEffect(() => { load(); loadCategories(); }, []);

  // ── Contact search ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!recipientSearch.trim() || selectedContact) { setSuggestions([]); return; }
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, phone")
        .ilike("full_name", `%${recipientSearch}%`)
        .not("phone", "is", null)
        .limit(5);
      setSuggestions((data ?? []).map((p: any) => ({
        id: p.id, name: p.full_name ?? "SayIt User", phone: p.phone,
      })));
    }, 300);
    return () => clearTimeout(t);
  }, [recipientSearch, selectedContact]);

  // ── When category changes in specific mode, load templates ─────────────────
  useEffect(() => {
    if (cardMode === "specific" && selectedCategory) {
      loadTemplates(selectedCategory.id);
      setSelectedTemplate(null);
    }
  }, [selectedCategory, cardMode]);

  // ── Toggle active ───────────────────────────────────────────────────────────
  async function toggleActive(id: string, current: boolean) {
    await supabase.from("scheduled_cards").update({ is_active: !current }).eq("id", id);
    setSchedules(prev => prev.map(s => s.id === id ? { ...s, is_active: !current } : s));
  }

  // ── Delete schedule ─────────────────────────────────────────────────────────
  async function deleteSchedule(id: string) {
    await supabase.from("scheduled_cards").delete().eq("id", id);
    setSchedules(prev => prev.filter(s => s.id !== id));
  }

  // ── Save schedule ───────────────────────────────────────────────────────────
  async function saveSchedule() {
    if (!selectedContact && !recipientSearch.trim()) return;
    if (!selectedCategory) return;
    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const phone = selectedContact?.phone ?? recipientSearch.trim();
    const nextRun = computeNextRun(
      recurrence, time,
      recurrence === "weekly" ? weekDay : recurrence === "monthly" ? monthDay : null,
      recurrence === "one-time" ? oneTimeDate : null,
    );

    const row: any = {
      user_id:         user.id,
      recipient_phone: phone,
      recipient_name:  selectedContact?.name ?? null,
      recipient_id:    selectedContact?.id ?? null,
      category_id:     selectedCategory.id,
      category_name:   selectedCategory.name,
      category_icon:   selectedCategory.icon,
      template_id:     cardMode === "specific" ? (selectedTemplate?.id ?? null) : null,
      template_image:  cardMode === "specific" ? (selectedTemplate?.front_image_url ?? null) : null,
      message:         message.trim() || null,
      recurrence,
      scheduled_time:  time,
      scheduled_day:   recurrence === "weekly" ? weekDay : recurrence === "monthly" ? monthDay : null,
      scheduled_at:    recurrence === "one-time" ? new Date(oneTimeDate).toISOString() : null,
      next_run_at:     nextRun,
      last_run_at:     null,
      is_active:       true,
    };

    const { error } = await supabase.from("scheduled_cards").insert(row);
    if (!error) {
      setShowForm(false);
      resetForm();
      load();
    }
    setSaving(false);
  }

  function resetForm() {
    setRecipientSearch(""); setSelectedContact(null); setSuggestions([]);
    setCardMode("category"); setSelectedCategory(null); setSelectedTemplate(null);
    setMessage(""); setRecurrence("daily"); setTime("08:00");
    setWeekDay(1); setMonthDay(1);
    const d = new Date(); d.setDate(d.getDate() + 1);
    setOneTimeDate(d.toISOString().slice(0, 10));
  }

  const canSave = (selectedContact || recipientSearch.trim().length > 6) && selectedCategory;

  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="flex flex-col min-h-dvh pb-28"
      style={{ background: "linear-gradient(180deg,#FFF5F7 0%,#f9f9f9 40%)" }}>

      {/* Header */}
      <div className="px-5 pt-14 pb-4 bg-white shadow-sm border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5" style={{ color: "#9B59B6" }} />
              <h1 className="text-xl font-black text-gray-900">Scheduled Cards</h1>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">Auto-send cards at the perfect moment</p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="w-10 h-10 rounded-full flex items-center justify-center text-white shadow-md"
            style={{ background: "linear-gradient(135deg,#FF6B8A,#9B59B6)" }}>
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Schedule list */}
      <div className="flex-1 px-4 py-5">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-pink-200 border-t-pink-500 rounded-full animate-spin" />
          </div>
        ) : schedules.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-20 text-center px-8">
            <div className="w-20 h-20 rounded-3xl flex items-center justify-center text-4xl mb-4 shadow-lg"
              style={{ background: "linear-gradient(135deg,#FFF5F7,#F8F0FF)", border: "1px solid #F9A8D4" }}>
              🕐
            </div>
            <h3 className="text-lg font-bold text-gray-800 mb-2">No schedules yet</h3>
            <p className="text-sm text-gray-400 leading-relaxed mb-6">
              Send a morning romance card every day, or a birthday card at exactly the right moment.
            </p>
            <button
              onClick={() => setShowForm(true)}
              className="px-6 py-3 rounded-2xl text-white font-bold text-sm shadow-md"
              style={{ background: "linear-gradient(135deg,#FF6B8A,#9B59B6)" }}>
              + Create your first schedule
            </button>
          </motion.div>
        ) : (
          <div className="flex flex-col gap-3">
            {schedules.map((s, i) => (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
                {/* Top accent */}
                <div className="h-1" style={{
                  background: s.is_active
                    ? "linear-gradient(90deg,#FF6B8A,#9B59B6)"
                    : "linear-gradient(90deg,#d1d5db,#9ca3af)",
                }} />

                <div className="px-4 py-4 flex items-start gap-3">
                  {/* Card thumbnail or category icon */}
                  <div className="w-12 h-16 rounded-xl flex-shrink-0 overflow-hidden flex items-center justify-center text-2xl"
                    style={{ background: s.template_image ? "transparent" : "linear-gradient(135deg,#FFF5F7,#F8F0FF)", border: "1px solid #F9A8D4" }}>
                    {s.template_image
                      ? <Image src={s.template_image} alt="" width={48} height={64} className="object-cover w-full h-full" />
                      : <span>{s.category_icon ?? "💌"}</span>
                    }
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
                        style={{ background: s.is_active ? "linear-gradient(135deg,#FF6B8A,#9B59B6)" : "#9ca3af" }}>
                        {s.recurrence.toUpperCase()}
                      </span>
                      {!s.is_active && (
                        <span className="text-[10px] font-medium text-gray-400">Paused</span>
                      )}
                    </div>
                    <p className="font-bold text-gray-900 text-sm truncate">
                      To: {s.recipient_name ?? s.recipient_phone}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">
                      {s.category_icon} {s.category_name}
                      {s.template_id ? " · Specific card" : " · Random card"}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">{recurrenceLabel(s)}</p>
                    <p className="text-[11px] mt-1" style={{ color: s.is_active ? "#9B59B6" : "#9ca3af" }}>
                      Next: {formatNextRun(s.next_run_at)}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <button onClick={() => toggleActive(s.id, s.is_active)}>
                      {s.is_active
                        ? <ToggleRight className="w-7 h-7" style={{ color: "#9B59B6" }} />
                        : <ToggleLeft  className="w-7 h-7 text-gray-300" />
                      }
                    </button>
                    <button onClick={() => deleteSchedule(s.id)}
                      className="w-7 h-7 rounded-full bg-gray-50 flex items-center justify-center">
                      <Trash2 className="w-3.5 h-3.5 text-gray-400" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* ── CREATE FORM MODAL ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showForm && (
          <div className="fixed inset-0 z-50 flex justify-center">
          <motion.div
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 32 }}
            className="flex flex-col w-full"
            style={{
              maxWidth: "var(--app-max-width)",
              background: "linear-gradient(180deg,#FFF5F7 0%,#f9f9f9 100%)",
            }}>

            {/* Form header */}
            <div className="px-5 pt-14 pb-4 bg-white shadow-sm flex items-center gap-3">
              <button onClick={() => { setShowForm(false); resetForm(); }}
                className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
                <X className="w-4 h-4 text-gray-600" />
              </button>
              <div className="flex-1">
                <h2 className="font-bold text-gray-900">New Scheduled Card</h2>
                <p className="text-xs text-gray-400">Set it once, SayIt handles the rest</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-5">

              {/* ── RECIPIENT ─────────────────────────────────────────────── */}
              <section>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 block">
                  Send To
                </label>
                {selectedContact ? (
                  <div className="flex items-center gap-3 px-4 py-3 rounded-2xl border"
                    style={{ background: "linear-gradient(135deg,#FF6B8A10,#9B59B610)", borderColor: "#FF6B8A30" }}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                      style={{ background: "linear-gradient(135deg,#FF6B8A,#9B59B6)" }}>
                      {selectedContact.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-800">{selectedContact.name}</p>
                      <p className="text-[11px] text-green-600">✓ On SayIt</p>
                    </div>
                    <button onClick={() => { setSelectedContact(null); setRecipientSearch(""); }}
                      className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 text-xs">✕</button>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search by name or enter phone"
                      value={recipientSearch}
                      onChange={e => setRecipientSearch(e.target.value)}
                      className="w-full px-4 py-3.5 rounded-2xl border border-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-pink-200 bg-white shadow-sm"
                    />
                    {suggestions.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-20">
                        {suggestions.map(s => (
                          <button key={s.id}
                            onClick={() => { setSelectedContact(s); setRecipientSearch(s.name); setSuggestions([]); }}
                            className="w-full flex items-center gap-3 px-4 py-3 text-left border-b border-gray-50 last:border-0">
                            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                              style={{ background: "linear-gradient(135deg,#FF6B8A,#9B59B6)" }}>
                              {s.name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-gray-800">{s.name}</p>
                              <p className="text-[11px] text-green-600">✓ On SayIt</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </section>

              {/* ── CARD MODE ─────────────────────────────────────────────── */}
              <section>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 block">Card Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {([["category", "🎲 Random from category", "App picks a fresh card each time"],
                     ["specific", "📌 Specific card", "Same card every time"]] as const).map(([val, title, sub]) => (
                    <button key={val} onClick={() => setCardMode(val as CardMode)}
                      className="p-3.5 rounded-2xl text-left transition-all"
                      style={{
                        background: cardMode === val ? "linear-gradient(135deg,#FF6B8A15,#9B59B615)" : "white",
                        border: `2px solid ${cardMode === val ? "#FF6B8A" : "#e5e7eb"}`,
                      }}>
                      <p className="font-bold text-gray-800 text-xs">{title}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>
                    </button>
                  ))}
                </div>
              </section>

              {/* ── CATEGORY ──────────────────────────────────────────────── */}
              <section>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 block">Category</label>
                <div className="flex gap-2 flex-wrap">
                  {categories.map(cat => (
                    <button key={cat.id}
                      onClick={() => setSelectedCategory(cat)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold transition-all"
                      style={{
                        background: selectedCategory?.id === cat.id
                          ? "linear-gradient(135deg,#FF6B8A,#9B59B6)" : "white",
                        color: selectedCategory?.id === cat.id ? "white" : "#374151",
                        border: `1.5px solid ${selectedCategory?.id === cat.id ? "transparent" : "#e5e7eb"}`,
                        boxShadow: selectedCategory?.id === cat.id ? "0 2px 8px rgba(255,107,138,0.3)" : "none",
                      }}>
                      {cat.icon} {cat.name}
                    </button>
                  ))}
                </div>
              </section>

              {/* ── SPECIFIC TEMPLATE PICKER ───────────────────────────────── */}
              <AnimatePresence>
                {cardMode === "specific" && selectedCategory && (
                  <motion.section
                    initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 block">
                      Pick a card
                    </label>
                    {loadingTmpls ? (
                      <div className="flex justify-center py-6">
                        <div className="w-6 h-6 border-4 border-pink-200 border-t-pink-500 rounded-full animate-spin" />
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-2">
                        {templates.map(t => (
                          <button key={t.id} onClick={() => setSelectedTemplate(t)}
                            className="relative rounded-xl overflow-hidden aspect-[3/4] border-2 transition-all"
                            style={{ borderColor: selectedTemplate?.id === t.id ? "#FF6B8A" : "transparent" }}>
                            {t.front_image_url
                              ? <Image src={t.front_image_url} alt="" fill className="object-cover" sizes="100px" />
                              : <div className="w-full h-full bg-pink-100 flex items-center justify-center text-2xl">💌</div>
                            }
                            {selectedTemplate?.id === t.id && (
                              <div className="absolute inset-0 flex items-center justify-center"
                                style={{ background: "rgba(255,107,138,0.4)" }}>
                                <Check className="w-6 h-6 text-white" />
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </motion.section>
                )}
              </AnimatePresence>

              {/* ── MESSAGE ───────────────────────────────────────────────── */}
              <section>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 block">
                  Personal note <span className="text-gray-300 normal-case font-normal">(optional)</span>
                </label>
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder="Add a heartfelt message…"
                  rows={2}
                  className="w-full rounded-2xl border border-gray-100 bg-white px-4 py-3.5 text-sm text-gray-700 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-pink-200 shadow-sm resize-none"
                />
              </section>

              {/* ── RECURRENCE ────────────────────────────────────────────── */}
              <section>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 block">Repeat</label>
                <div className="grid grid-cols-2 gap-2">
                  {RECURRENCE_OPTS.map(opt => (
                    <button key={opt.value} onClick={() => setRecurrence(opt.value)}
                      className="flex items-center gap-2 px-4 py-3 rounded-2xl text-sm font-semibold transition-all"
                      style={{
                        background: recurrence === opt.value ? "linear-gradient(135deg,#FF6B8A15,#9B59B615)" : "white",
                        border: `2px solid ${recurrence === opt.value ? "#FF6B8A" : "#e5e7eb"}`,
                        color: recurrence === opt.value ? "#9B59B6" : "#374151",
                      }}>
                      <span>{opt.icon}</span> {opt.label}
                    </button>
                  ))}
                </div>

                {/* Weekly day picker */}
                <AnimatePresence>
                  {recurrence === "weekly" && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-3">
                      <p className="text-xs text-gray-400 mb-2">Day of week</p>
                      <div className="flex gap-1.5">
                        {DAYS.map((d, i) => (
                          <button key={i} onClick={() => setWeekDay(i)}
                            className="flex-1 py-2 rounded-xl text-xs font-bold transition-all"
                            style={{
                              background: weekDay === i ? "linear-gradient(135deg,#FF6B8A,#9B59B6)" : "#f3f4f6",
                              color: weekDay === i ? "white" : "#374151",
                            }}>{d}</button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Monthly day picker */}
                <AnimatePresence>
                  {recurrence === "monthly" && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-3">
                      <p className="text-xs text-gray-400 mb-2">Day of month</p>
                      <input type="number" min={1} max={28} value={monthDay}
                        onChange={e => setMonthDay(Number(e.target.value))}
                        className="w-full px-4 py-3 rounded-2xl border border-gray-100 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-pink-200" />
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* One-time date picker */}
                <AnimatePresence>
                  {recurrence === "one-time" && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-3">
                      <p className="text-xs text-gray-400 mb-2">Date</p>
                      <input type="date" value={oneTimeDate}
                        min={new Date().toISOString().slice(0, 10)}
                        onChange={e => setOneTimeDate(e.target.value)}
                        className="w-full px-4 py-3 rounded-2xl border border-gray-100 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-pink-200" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </section>

              {/* ── TIME ──────────────────────────────────────────────────── */}
              <section>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 block">
                  Time to send
                </label>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3.5 flex items-center gap-3">
                  <Clock className="w-4 h-4 text-pink-400" />
                  <input type="time" value={time} onChange={e => setTime(e.target.value)}
                    className="flex-1 text-sm font-semibold text-gray-800 focus:outline-none bg-transparent" />
                  <span className="text-xs text-gray-400">local time</span>
                </div>
                {time && (
                  <p className="text-xs text-gray-400 mt-1.5 px-1">
                    🔔 Card will be sent at {formatTime(time)}
                  </p>
                )}
              </section>

              {/* Save button */}
              <button
                onClick={saveSchedule}
                disabled={!canSave || saving}
                className="w-full py-4 text-white font-bold text-base disabled:opacity-40 flex items-center justify-center gap-2"
                style={{
                  background: "linear-gradient(135deg,#FF6B8A,#9B59B6)",
                  borderRadius: 30,
                  boxShadow: "0 4px 18px rgba(255,107,138,0.35)",
                }}>
                {saving
                  ? <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  : <><Clock className="w-4 h-4" /> Schedule Card</>
                }
              </button>

              <div className="h-8" />
            </div>
          </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
