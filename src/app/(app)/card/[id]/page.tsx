'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { getTemplateById, getCategoryById, type DBTemplate, type DBCategory } from '@/lib/supabase-data';

// ── Emoji reactions (view mode only) ──────────────────────────────────────────
const REACTION_EMOJIS = ['❤️', '😭', '😍', '🔥', '🤗'];

function CardReactionsInline({
  cardId, userId, onReact, onLoad,
}: {
  cardId: string;
  userId: string | null;
  onReact?: (emoji: string | null) => void;
  onLoad?: (myEmoji: string | null, counts: Record<string, number>) => void;
}) {
  const supabase = createClient();
  const [reactions, setReactions]   = useState<Record<string, number>>({});
  const [myReaction, setMyReaction] = useState<string | null>(null);
  const [popping, setPopping]       = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('card_reactions')
      .select('emoji, user_id')
      .eq('card_id', cardId)
      .then(({ data }) => {
        if (!data) return;
        const counts: Record<string, number> = {};
        let mine: string | null = null;
        for (const r of data) {
          counts[r.emoji] = (counts[r.emoji] || 0) + 1;
          if (r.user_id === userId) mine = r.emoji;
        }
        setReactions(counts);
        setMyReaction(mine);
        onLoad?.(mine, counts);
      });
  }, [cardId]);

  async function handleReact(emoji: string) {
    if (!userId) return;
    setPopping(emoji);
    setTimeout(() => setPopping(null), 300);
    if (myReaction === emoji) {
      setMyReaction(null);
      setReactions(prev => ({ ...prev, [emoji]: Math.max(0, (prev[emoji] || 0) - 1) }));
      onReact?.(null);
      await supabase.from('card_reactions').delete().eq('card_id', cardId).eq('user_id', userId);
    } else {
      const prev = myReaction;
      setMyReaction(emoji);
      setReactions(r => ({
        ...r,
        ...(prev ? { [prev]: Math.max(0, (r[prev] || 0) - 1) } : {}),
        [emoji]: (r[emoji] || 0) + 1,
      }));
      onReact?.(emoji);
      await supabase.from('card_reactions').delete().eq('card_id', cardId).eq('user_id', userId);
      await supabase.from('card_reactions').insert({ card_id: cardId, user_id: userId, emoji });
    }
  }

  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
      {REACTION_EMOJIS.map(emoji => {
        const count  = reactions[emoji] || 0;
        const isMine = myReaction === emoji;
        const isPop  = popping === emoji;
        return (
          <button key={emoji} onClick={() => handleReact(emoji)}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '8px 14px', borderRadius: 999,
              background: isMine ? 'linear-gradient(135deg,#FF6B8A20,#9B59B620)' : 'rgba(255,255,255,0.7)',
              border: isMine ? '1.5px solid #FF6B8A60' : '1.5px solid rgba(0,0,0,0.08)',
              cursor: userId ? 'pointer' : 'default',
              transform: isPop ? 'scale(1.28)' : isMine ? 'scale(1.1)' : 'scale(1)',
              transition: 'transform 0.2s cubic-bezier(.34,1.56,.64,1), background 0.2s',
              backdropFilter: 'blur(8px)',
            }}>
            <span style={{ fontSize: 20, lineHeight: 1 }}>{emoji}</span>
            {count > 0 && (
              <span style={{ fontSize: 11, fontWeight: 700, color: isMine ? '#FF6B8A' : '#9ca3af' }}>{count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── Large quote pools per category — 3 are picked randomly each render ────────
const QUOTE_POOL: Record<string, string[]> = {
  romance: [
    "You are my favorite notification. 💌",
    "In a world full of temporary things, you are a perpetual feeling.",
    "My heart skips a beat every time I think of you.",
    "You are the reason I look forward to every single day.",
    "Loving you is the easiest thing I have ever done.",
    "Distance means nothing when someone means everything.",
    "You are the poem I never knew how to write.",
    "Every love story is beautiful, but ours is my favourite.",
    "You make ordinary moments feel like magic.",
    "I fell in love with the way you fall asleep. Slowly, then all at once.",
  ],
  "paw-moments": [
    "Not all angels have wings — some have paws. 🐾",
    "Life is short. Love your pet fiercely, every single day.",
    "A dog is proof that love doesn't need words.",
    "The world would be a nicer place if everyone had the ability to love as unconditionally as a dog.",
    "Home is where the paw prints are. 🐾",
    "A pet is not just an animal — it's a heartbeat at your feet.",
    "Dogs leave paw prints on your heart forever.",
    "Cats choose us; we don't own them. And that makes all the difference.",
    "The bond with an animal is as lasting as the ties of this earth can ever be.",
    "Whoever said diamonds are a girl's best friend never owned a dog.",
  ],
  birthday: [
    "Another year of being absolutely wonderful. Happy Birthday! 🎂",
    "May your birthday be as bright as you make every room you walk into.",
    "Growing older is mandatory — growing fabulous is your superpower!",
    "Today is your day to shine extra bright. ✨",
    "May this birthday bring you everything your heart has been quietly wishing for.",
    "Another year wiser, another year more you. Celebrate every bit of it.",
    "Birthdays are nature's way of telling us to eat more cake. 🎂",
    "You deserve a day as special as the joy you bring to everyone around you.",
    "Here's to the next chapter — may it be your best one yet.",
    "Age is just a number. Your awesomeness, however, is off the charts.",
  ],
  occasions: [
    "Gratitude is the fairest blossom that springs from the soul. 🌸",
    "Thank you for being you — the world is richer for it.",
    "Your kindness planted a seed of joy that blooms every day.",
    "Small acts of kindness echo in the heart forever.",
    "You showed up when it mattered most. That means everything.",
    "A simple thank you feels too small, but it carries the biggest heart.",
    "The kindness you share always finds its way back to you.",
    "You are the kind of person that makes good things happen.",
    "Congratulations — you earned every bit of this moment.",
    "What you did changed things for the better. Thank you.",
  ],
  holidays: [
    "May the magic of this season wrap you in warmth and wonder. ✨",
    "Life's most precious gifts come without price tags.",
    "Wishing you moments of joy that linger long after the day fades.",
    "May your home be filled with laughter and your heart with peace.",
    "The best gift you can give is your presence — and love.",
    "Seasons change, but the warmth of good company never does.",
    "Here's to the moments that become the memories we cherish forever.",
    "May this season bring you everything you have been hoping for.",
    "Holidays are better when you have someone to share them with.",
    "Wishing you a season as bright and beautiful as you are.",
  ],
  vibes: [
    "Good vibes. Good life. Good you. ✌️",
    "Today is a perfect day to have a perfect day.",
    "You radiate the kind of energy that makes people smile.",
    "Keep going. The view from the top is always worth it.",
    "You are doing better than you think. Keep shining. ✨",
    "Your energy is contagious — in the very best way.",
    "Big things are coming. Stay ready.",
    "You were made for more than you can imagine.",
    "The right people always notice the right things about you.",
    "Be the energy you want to attract.",
  ],
};

function pickRandom(arr: string[], n = 3): string[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

// ── Short mood quotes shown on the LEFT panel above the image ─────────────────
const LEFT_PANEL_QUOTES: Record<string, string[]> = {
  "miss you": [
    "Some distances feel\nlonger than miles. 🌙",
    "Far away,\nbut never forgotten. 💌",
    "Missing you\nin the quiet moments.",
  ],
  "thinking of you": [
    "You crossed my mind\nand made me smile. 💭",
    "Quietly thinking of you\ntoday and always. 🌸",
    "A little thought,\nsent with love. 💌",
  ],
  "good night": [
    "Rest well.\nYou deserve it. 🌙",
    "Sweet dreams\nand softer mornings. ✨",
    "Let the night\nhold you gently. 🌙",
  ],
  "good morning": [
    "A new day,\njust for you. ☀️",
    "Rise softly.\nThis day is yours. 🌅",
    "Morning sunshine,\nsent with love. ☀️",
  ],
  "flowers": [
    "Blooming,\njust like you. 🌸",
    "Some beauty deserves\nto be shared. 💐",
    "A little colour\nfor your day. 🌹",
  ],
  "birthday": [
    "Another year\nof being wonderful. 🎂",
    "Today belongs\nentirely to you. 🎉",
    "Celebrating you,\nnow and always. ✨",
  ],
  "baby shower": [
    "A tiny miracle\nis on their way. 🍼",
    "The sweetest chapter\nis just beginning. 💕",
    "New love,\nabout to arrive. 👶",
  ],
  "friend": [
    "Good friends\nare everything. 💛",
    "Lucky to have\nsomeone like you. 🌟",
    "You make life\nso much better. 💛",
  ],
  "general": [
    "Thinking of you,\nwith warmth. 💌",
    "Just a little love,\nsent your way. 🌸",
    "Because you matter\nmore than you know. ✨",
  ],
  "graduation": [
    "The world is ready\nfor you. 🎓",
    "All that work.\nAll worth it. 🌟",
    "The best chapter\nstarts now. 🎓",
  ],
  "it's giving": [
    "The vibe.\nThe moment.\nYou. ✨",
    "Serving looks\nand living it. 💅",
    "It's giving\nexactly that. 💫",
  ],
  "lowkey": [
    "Quietly,\nbut sincerely. 🤍",
    "No fuss.\nJust love. 💛",
    "A little note,\nfrom the heart. 🤍",
  ],
  "main character": [
    "This is your story.\nOwn it. 👑",
    "The spotlight\nbelongs to you. 🌟",
    "Main character.\nAlways. 💫",
  ],
  "motivation": [
    "You are closer\nthan you think. 💪",
    "Keep going.\nIt's worth it. ✨",
    "Stronger than\nyou know. 🌟",
  ],
  "no cap": [
    "Real talk —\nyou're amazing. 💯",
    "No cap,\nyou showed up. 🔥",
    "Genuinely,\ntruly, you. 💯",
  ],
  "professional": [
    "With respect\nand admiration. 🌟",
    "Your work speaks\nfor itself. ✨",
    "Wishing you\neverything ahead. 🤝",
  ],
  "teacher": [
    "The best ones\nstay with you forever. 🍎",
    "More than lessons —\nyou gave us belief. ✨",
    "Thank you\nfor everything. 🍎",
  ],
  "teacher's week": [
    "This week\nis all yours. 🍎",
    "Celebrated,\napreciated, loved. 🌟",
    "For every lesson\ngiven with heart. 🍎",
  ],
  "wedding": [
    "Two hearts.\nOne beautiful yes. 💍",
    "Here's to love\nthat only grows. 🥂",
    "Today, forever\nbegins. 💕",
  ],
  "weekend vibes": [
    "Unplug.\nBreathe.\nEnjoy. ✌️",
    "Good vibes,\ngood times. 🌅",
    "The weekend\nis yours. ☀️",
  ],

  // ── Category-level fallbacks (cards with no subcategory) ─────────────────
  "romance": [
    "Some feelings\ndefy all words. 💕",
    "You are\nmy favourite thought. ❤️",
    "Love, quietly\nand completely. 🌹",
  ],
  "occasions": [
    "Thinking of you,\nwith warmth. 💌",
    "A little love,\nsent your way. 🌸",
    "Because you matter\nmore than you know. ✨",
  ],
  "holidays": [
    "Wishing you warmth\nand wonder. ✨",
    "The best moments\nare shared ones. 🌟",
    "Joy to you\nand all you love. 💌",
  ],
  "thank you": [
    "Gratitude is\nthe warmest feeling. 🙏",
    "Thank you,\nfrom the heart. 💛",
    "What you did\nmeant everything. 🌸",
  ],
  "vibes": [
    "Good energy,\nalways. ✨",
    "This one's\nfor you. 💫",
    "You are\nthe vibe. 🌟",
  ],
  "morning wishes": [
    "A new day,\njust for you. ☀️",
    "Rise softly.\nThis day is yours. 🌅",
    "Morning sunshine,\nsent with love. ☀️",
  ],
  "invitations": [
    "Something special\nis happening. 🎉",
    "You're invited\nto a moment. ✨",
    "Come celebrate\nwith us. 💌",
  ],

  // ── Global Holidays ───────────────────────────────────────────────────────

  "christmas": [
    "Joy to you\nand all you love. 🎄",
    "The warmest season\nis here. ✨",
    "Peace, love,\nand a little magic. 🎁",
  ],
  "new year": [
    "A fresh page.\nMake it beautiful. 🥂",
    "New chapter.\nNew light.\nNew you. ✨",
    "Here's to everything\nyou're becoming. 🎆",
  ],
  "valentine's day": [
    "Love, simply\nand completely. ❤️",
    "Some feelings\ndefy all words. 💕",
    "For the one\nwho makes it all worthwhile. 🌹",
  ],
  "easter": [
    "New beginnings\nin every season. 🌸",
    "Hope blooms\nagain. 🐣",
    "Light, renewal,\nand warmth. ✨",
  ],
  "halloween": [
    "A little spooky.\nA lot of fun. 🎃",
    "Boo!\nHope you smiled. 👻",
    "The most spirited\nnight of the year. 🕯️",
  ],
  "thanksgiving": [
    "Grateful for you,\ntoday and always. 🍂",
    "The best things\naren't things. 🌾",
    "Thankful for\nthis moment. 🍁",
  ],
  "diwali": [
    "Light over darkness,\nalways. 🪔",
    "May this festival\nfill your home with joy. ✨",
    "Wishing you\nthe brightest Diwali. 🪔",
  ],
  "holi": [
    "Colour, joy,\nand new beginnings. 🌈",
    "May your life be\nas vivid as today. 🎨",
    "Celebrate every colour\nof this beautiful life. 🌸",
  ],
  "eid": [
    "Warmth, peace,\nand Eid blessings. 🌙",
    "May this Eid bring\njoy to your heart. ✨",
    "Eid Mubarak —\nwith love. 🌙",
  ],
  "eid al-fitr": [
    "A month of patience,\nnow a day of joy. 🌙",
    "Eid Mubarak.\nMay your blessings\nbe plenty. ✨",
    "Peace and happiness\nthis Eid. 🌙",
  ],
  "eid al-adha": [
    "In the spirit\nof sacrifice and gratitude. 🌙",
    "Eid Mubarak —\nwishing you peace\nand blessings. ✨",
    "May this day bring\nyou closer to all you love. 🌙",
  ],
  "ramadan": [
    "A blessed month\nof reflection. 🌙",
    "Ramadan Mubarak —\nwishing you peace. ✨",
    "May this month\nbring light within. 🌙",
  ],
  "hanukkah": [
    "Eight nights\nof light and love. 🕎",
    "May the light\nnever dim. ✨",
    "Happy Hanukkah —\nwarm and bright. 🕎",
  ],
  "lunar new year": [
    "Prosperity, joy,\nand new beginnings. 🧧",
    "May this year bring\neverything you deserve. 🌸",
    "New year.\nNew luck.\nNew blessings. 🧧",
  ],
  "chinese new year": [
    "Wishing you\nluck and prosperity. 🧧",
    "A new year full\nof golden moments. ✨",
    "May fortune follow\nyou all year. 🌸",
  ],
  "mother's day": [
    "For the one\nwho gave you everything. 🌸",
    "No words are\nenough. Thank you, Mum. 💕",
    "The original\nsuperpower. 🌺",
  ],
  "mothers day": [
    "For the one\nwho gave you everything. 🌸",
    "No words are\nenough. Thank you, Mum. 💕",
    "The original\nsuperpower. 🌺",
  ],
  "father's day": [
    "The quiet strength\nbehind everything. 💙",
    "For the one\nwho showed up, always. 👔",
    "Hero. Guide.\nDad. 💙",
  ],
  "fathers day": [
    "The quiet strength\nbehind everything. 💙",
    "For the one\nwho showed up, always. 👔",
    "Hero. Guide.\nDad. 💙",
  ],
  "international women's day": [
    "Here's to the women\nwho lead the way. 🌸",
    "Strength, grace,\nand everything in between. 💜",
    "Celebrating you\ntoday and every day. 🌺",
  ],
  "international womens day": [
    "Here's to the women\nwho lead the way. 🌸",
    "Strength, grace,\nand everything in between. 💜",
    "Celebrating you\ntoday and every day. 🌺",
  ],
  "raksha bandhan": [
    "The bond that\nnever breaks. 🪢",
    "A thread of love\nbetween forever friends. ✨",
    "Brothers and sisters —\na bond unlike any other. 🪢",
  ],
  "navratri": [
    "Nine nights\nof devotion and joy. 🪔",
    "Dance, celebrate,\nand shine. ✨",
    "Navratri blessings\nto you and yours. 🌸",
  ],
  "dussehra": [
    "Good always\nfinds its way. ✨",
    "Victory of light\nover darkness. 🪔",
    "May good always\nwin in your story. ✨",
  ],
  "rosh hashanah": [
    "A sweet new year\nawaits. 🍎",
    "Shana Tova —\nwishing you a year of joy. ✨",
    "New year,\nnew blessings. 🍯",
  ],
  "passover": [
    "Freedom, gratitude,\nand togetherness. 🌿",
    "Chag Sameach —\nwishing you peace. ✨",
    "From darkness\nto light. 🕯️",
  ],
  "independence day": [
    "Freedom is worth\ncelebrating. 🎆",
    "Here's to the land\nyou call home. 🌟",
    "Pride, gratitude,\nand joy today. 🎇",
  ],
  "friendship day": [
    "The best people\nbecame family. 💛",
    "Here's to you,\nmy favourite human. 🌟",
    "Friends like you\nare rare. 💛",
  ],
};

function normaliseKey(s: string): string {
  return s.toLowerCase().replace(/[‘’’]/g, "’").trim();
}

function getLeftPanelQuote(subcategoryName: string | null, categoryName?: string | null): string {
  // Try subcategory first, fall back to category name
  for (const name of [subcategoryName, categoryName]) {
    if (!name) continue;
    const quotes = LEFT_PANEL_QUOTES[normaliseKey(name)];
    if (quotes) return quotes[Math.floor(Math.random() * quotes.length)];
  }
  return "";
}

const CARD_W = 340;
const CARD_H = 476;
const OPEN_W = 340;   // same as CARD_W — stays portrait, no horizontal stretch
const OPEN_H = 476;

function WoodenFrame({ photo, index, onUpload }: { photo: string | null; index: number; onUpload: (index: number, file: File) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const tilts = [-2, 1.5, -1, 2.5];
  const tilt = tilts[index] ?? 0;
  return (
    <div onClick={() => inputRef.current?.click()} style={{ position: 'relative', width: '100%', height: '100%', cursor: 'pointer', transform: `rotate(${tilt}deg)` }}>
      <div style={{ position: 'absolute', inset: 0, borderRadius: 4, background: 'linear-gradient(135deg, #6B3F1F 0%, #8B5E3C 20%, #5C3317 40%, #7A4F2D 60%, #6B3F1F 80%, #9B6B4A 100%)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.15), inset 0 -1px 0 rgba(0,0,0,0.3), 2px 3px 8px rgba(0,0,0,0.4)', padding: 5 }}>
        <div style={{ width: '100%', height: '100%', borderRadius: 2, background: '#3D1F0A', boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.6)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {photo ? (
            <img src={photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'sepia(20%) contrast(1.05)' }} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, color: '#8B6347' }}>
              <span style={{ fontSize: 20 }}>🐾</span>
              <span style={{ fontSize: 8, textAlign: 'center' }}>Tap to add photo</span>
            </div>
          )}
        </div>
      </div>
      <div style={{ position: 'absolute', inset: 0, borderRadius: 4, background: 'repeating-linear-gradient(92deg, transparent 0px, transparent 3px, rgba(0,0,0,0.04) 3px, rgba(0,0,0,0.04) 4px)', pointerEvents: 'none' }} />
      {[{ top: 4, left: 4 }, { top: 4, right: 4 }, { bottom: 4, left: 4 }, { bottom: 4, right: 4 }].map((pos, i) => (
        <div key={i} style={{ position: 'absolute', ...pos, width: 5, height: 5, borderRadius: '50%', background: 'radial-gradient(circle at 35% 35%, #C8A97A, #7A5230)', boxShadow: '0 1px 2px rgba(0,0,0,0.5)', zIndex: 2 }} />
      ))}
      <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(index, f); }} />
    </div>
  );
}

function PawBorder() {
  return (
    <svg viewBox="0 0 175 480" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} xmlns="http://www.w3.org/2000/svg">
      {[{ x: 12, y: 12, r: 0 }, { x: 163, y: 12, r: 45 }, { x: 12, y: 468, r: -30 }, { x: 163, y: 468, r: 15 }].map((p, i) => (
        <g key={i} transform={`translate(${p.x},${p.y}) rotate(${p.r})`} opacity="0.25">
          <ellipse cx="0" cy="3" rx="4" ry="4.5" fill="#6B3F1F" />
          <ellipse cx="-4" cy="-2" rx="2" ry="2.5" fill="#6B3F1F" />
          <ellipse cx="-1.5" cy="-4.5" rx="2" ry="2.5" fill="#6B3F1F" />
          <ellipse cx="1.5" cy="-4.5" rx="2" ry="2.5" fill="#6B3F1F" />
          <ellipse cx="4" cy="-2" rx="2" ry="2.5" fill="#6B3F1F" />
        </g>
      ))}
      <rect x="6" y="6" width="163" height="468" rx="6" fill="none" stroke="#8B5E3C" strokeWidth="0.8" opacity="0.3" strokeDasharray="4 3" />
    </svg>
  );
}

function FloralBorder({ color1 = '#7C9E7A', color2 = '#C9A84C' }: { color1?: string; color2?: string }) {
  return (
    <svg viewBox="0 0 175 480" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} xmlns="http://www.w3.org/2000/svg">
      <g opacity="0.7">
        <path d="M8,8 Q20,14 14,26 Q8,14 8,8Z" fill={color1} />
        <path d="M8,8 Q14,20 26,14 Q14,8 8,8Z" fill={color1} />
        <circle cx="8" cy="8" r="2.5" fill={color2} opacity="0.8" />
        <circle cx="16" cy="30" r="3" fill={color2} opacity="0.5" />
        <circle cx="30" cy="16" r="3" fill={color2} opacity="0.5" />
      </g>
      <g opacity="0.7" transform="rotate(180 87.5 240)">
        <path d="M8,8 Q20,14 14,26 Q8,14 8,8Z" fill={color1} />
        <path d="M8,8 Q14,20 26,14 Q14,8 8,8Z" fill={color1} />
        <circle cx="8" cy="8" r="2.5" fill={color2} opacity="0.8" />
      </g>
    </svg>
  );
}

function OrnamentLine({ color = '#C9A84C' }: { color?: string }) {
  return (
    <svg viewBox="0 0 140 12" style={{ width: 140, height: 12 }} xmlns="http://www.w3.org/2000/svg">
      <line x1="0" y1="6" x2="60" y2="6" stroke={color} strokeWidth="0.8" opacity="0.6" />
      <polygon points="70,2 74,6 70,10 66,6" fill={color} opacity="0.8" />
      <line x1="80" y1="6" x2="140" y2="6" stroke={color} strokeWidth="0.8" opacity="0.6" />
    </svg>
  );
}

import { Suspense } from 'react';

function CardPageInner() {
  const params       = useParams();
  const router       = useRouter();
  const searchParams = useSearchParams();
  const id           = params.id as string;

  // ── View mode — read-only card opened from history ────────────────────────
  const isViewMode   = searchParams.get('view') === 'true';
  const viewCardId   = searchParams.get('cardId') ?? '';
  const viewMessage  = searchParams.get('message') ?? '';
  const viewSender   = searchParams.get('sender') ?? '';
  const backUrl      = searchParams.get('back') ?? '';
  const cardDirection  = searchParams.get('direction') ?? 'sent'; // "sent" | "received"
  const isReceived     = cardDirection === 'received';
  const startEnvelope  = searchParams.get('startEnvelope') === 'true';
  // browseMode — always show envelope when tapping a template from the category browser
  const browseMode     = searchParams.get('browseMode') === 'true';

  const [userId, setUserId] = useState<string | null>(null);
  const [myCardReaction, setMyCardReaction]     = useState<string | null>(null);
  const [reactionCounts, setReactionCounts]     = useState<Record<string, number>>({});
  const [reactionTrayOpen, setReactionTrayOpen] = useState(false);
  const [reactionLoaded,   setReactionLoaded]   = useState(false);

  // ── Recipient display name (for sender viewing their own sent card) ───────
  const [recipientDisplayName, setRecipientDisplayName] = useState<string | null>(null);

  useEffect(() => {
    if (!isViewMode || isReceived || !viewCardId) return;
    const sb = createClient();
    sb.from('sent_cards')
      .select('recipient_name, recipient_id')
      .eq('id', viewCardId)
      .single()
      .then(async ({ data }) => {
        if (!data) { setRecipientDisplayName('your friend'); return; }
        // Priority 1: contact name saved by sender
        if (data.recipient_name?.trim()) {
          setRecipientDisplayName(data.recipient_name.trim());
          return;
        }
        // Priority 2: registered SayIt user's profile name
        if (data.recipient_id) {
          const { data: profile } = await sb
            .from('profiles')
            .select('full_name')
            .eq('id', data.recipient_id)
            .single();
          if (profile?.full_name?.trim()) {
            setRecipientDisplayName(profile.full_name.trim());
            return;
          }
        }
        // Fallback
        setRecipientDisplayName('your friend');
      });
  }, [isViewMode, isReceived, viewCardId]);

  useEffect(() => {
    if (!isViewMode && !startEnvelope) return;
    createClient().auth.getUser().then(({ data }) => {
      const uid = data.user?.id ?? null;
      setUserId(uid);
      if (startEnvelope) {
        // Registered users skip envelope; non-registered see it
        setStage(uid ? 'card' : 'envelope');
      }
    });
  }, [isViewMode, startEnvelope]);

  // Fetch reactions only after userId is resolved — avoids race where userId=null
  // makes mine=null every time, causing badge to disappear on back-navigation.
  useEffect(() => {
    if (!isViewMode || !viewCardId || userId === null) return;
    setReactionLoaded(false);
    createClient()
      .from('card_reactions')
      .select('emoji, user_id')
      .eq('card_id', viewCardId)
      .then(({ data }) => {
        const counts: Record<string, number> = {};
        let mine: string | null = null;
        for (const r of data ?? []) {
          counts[r.emoji] = (counts[r.emoji] || 0) + 1;
          if (r.user_id === userId) mine = r.emoji;
        }
        setReactionCounts(counts);
        setMyCardReaction(mine);
        setReactionLoaded(true);
      });
  }, [isViewMode, viewCardId, userId]);

  async function reactToCard(emoji: string) {
    if (!userId || !viewCardId) return;
    const sb = createClient();
    if (myCardReaction === emoji) {
      // un-react
      setMyCardReaction(null);
      setReactionCounts(prev => ({ ...prev, [emoji]: Math.max(0, (prev[emoji] ?? 0) - 1) }));
      setReactionTrayOpen(false);
      await sb.from('card_reactions').delete().eq('card_id', viewCardId).eq('user_id', userId);
    } else {
      const prev = myCardReaction;
      setMyCardReaction(emoji);
      setReactionCounts(c => ({
        ...c,
        ...(prev ? { [prev]: Math.max(0, (c[prev] ?? 0) - 1) } : {}),
        [emoji]: (c[emoji] ?? 0) + 1,
      }));
      setReactionTrayOpen(false);
      await sb.from('card_reactions').delete().eq('card_id', viewCardId).eq('user_id', userId);
      await sb.from('card_reactions').insert({ card_id: viewCardId, user_id: userId, emoji });
    }
  }

  // ── Template + category fetched from Supabase ────────────────────────────
  const [template, setTemplate]           = useState<DBTemplate | null>(null);
  const [category, setCategory]           = useState<DBCategory | null>(null);
  const [templateLoading, setTemplateLoading] = useState(true);
  const [coverImgLoaded, setCoverImgLoaded]   = useState(false);

  useEffect(() => {
    getTemplateById(id).then(async tmpl => {
      if (tmpl) {
        setTemplate(tmpl);
        getCategoryById(tmpl.category_id).then(cat => {
          setCategory(cat);
          // Set the left-panel mood quote — subcategory first, category name as fallback
          setMoodQuote(getLeftPanelQuote(tmpl.subcategory_name, cat?.name));
          setTemplateLoading(false);
        });
      } else {
        // Template ID not found in Supabase — likely a legacy card sent before the Supabase
        // migration (old IDs like "t-r-f-1"). Fall back to the front_image_url stored in the
        // sent_cards row itself, which was saved at send-time.
        if (viewCardId) {
          const { data: cardRow } = await createClient()
            .from('sent_cards')
            .select('front_image_url')
            .eq('id', viewCardId)
            .single();
          if (cardRow?.front_image_url) {
            setTemplate({
              id,
              category_id: '',
              subcategory_id: null,
              subcategory_name: null,
              title: 'Card',
              front_image_url: cardRow.front_image_url,
              inside_image_url: null,
              color_accent: '#c9a87c',
              display_order: 0,
              is_active: true,
            });
          }
        }
        setTemplateLoading(false);
      }
    });
  }, [id, viewCardId]);

  const isPawMoments = category?.name?.toLowerCase().includes('paw') ?? false;

  // "Say it Back" — birthday/invitations/thank-you → thank-you; everything else → its own category
  const sayitBackUrl = new Set(["birthday", "invitations", "thank-you"]).has(category?.slug ?? "")
    ? "/category/thank-you"
    : `/category/${category?.slug ?? "romance"}`;
  const sayitBackIcon = category?.icon ?? "💌";

  // First-time received cards start at the envelope stage (if not logged in); all others open directly to the closed card
  // browseMode always shows the envelope regardless of auth (category browser → card preview experience)
  // 'loading' = waiting to know if user is registered before deciding envelope vs card
  const [stage, setStage] = useState<'loading' | 'envelope' | 'card'>(
    browseMode ? 'envelope' : (startEnvelope ? 'loading' : 'card')
  );
  type CardView = 'front' | 'open' | 'back';
  const [view, setView] = useState<CardView>('front');

  const [message, setMessage] = useState('');
  const [sender, setSender] = useState('');
  const [moodQuote, setMoodQuote] = useState('');
  const [petPhotos, setPetPhotos] = useState<(string | null)[]>([null, null, null, null]);

  const handlePhotoUpload = (index: number, file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const url = e.target?.result as string;
      setPetPhotos((prev) => { const next = [...prev]; next[index] = url; return next; });
    };
    reader.readAsDataURL(file);
  };

  const pawAccent = '#8B5E3C';
  const pawAccentLight = '#C4956A';
  const goldAccent = '#C9A84C';

  // Loading state — waiting for template/category to load from Supabase
  if (templateLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(160deg,#FDF6EE,#F7EBE0,#F0DDD0)' }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid #C9A84C', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // Template not found fallback
  if (!template) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, background: 'linear-gradient(160deg,#FDF6EE,#F7EBE0)', fontFamily: 'Georgia,serif' }}>
        <span style={{ fontSize: 40 }}>💌</span>
        <p style={{ color: '#8B6040', fontSize: 16 }}>Card not found</p>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: '#C9A84C', cursor: 'pointer', fontSize: 13 }}>← Go back</button>
      </div>
    );
  }

  // Loading state — waiting to resolve auth before deciding envelope vs card
  if (stage === 'loading') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(160deg,#FDF6EE,#F7EBE0,#F0DDD0)' }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid #C9A84C', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (stage === 'envelope') {
    return (
      <div style={{ minHeight: '100vh', background: isPawMoments ? 'linear-gradient(160deg,#F5EDE0,#EDD9C0,#E8CFA8)' : 'linear-gradient(160deg,#FDF6EE,#F7EBE0,#F0DDD0)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, fontFamily: 'Georgia,serif', position: 'relative' }}>
        {/* Back arrow — all modes */}
        <button
          onClick={() => backUrl ? router.push(backUrl) : router.back()}
          style={{ position: 'absolute', top: 'calc(env(safe-area-inset-top, 44px) + 10px)', left: 16, width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(8px)', border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', WebkitTapHighlightColor: 'transparent', zIndex: 30 }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#6b7280' }}><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
        </button>
        {/* Sender label for received cards */}
        {isViewMode && isReceived && viewSender && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
            style={{ color: '#9ca3af', fontSize: 14, margin: 0 }}>
            <span style={{ fontWeight: 700, color: '#1f2937' }}>{viewSender}</span> sent you something special ✨
          </motion.p>
        )}
        <motion.div initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 80, damping: 16 }} style={{ width: 220, height: 150, position: 'relative', cursor: 'pointer', filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.15))' }} onClick={() => setStage('card')} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
          <div style={{ position: 'absolute', inset: 0, background: isPawMoments ? 'linear-gradient(160deg,#F0E0C8,#E8D0B0)' : 'linear-gradient(160deg,#FBF6EE,#F5EAD8)', borderRadius: 6, border: isPawMoments ? '1px solid #C4956A' : '1px solid #D4B896' }} />
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 80, background: isPawMoments ? 'linear-gradient(160deg,#E8D0B0,#D4B896)' : 'linear-gradient(160deg,#F5EAD8,#EAD9C0)', clipPath: 'polygon(0 0,50% 60%,100% 0)' }} />
          <div style={{ position: 'absolute', top: 38, left: '50%', transform: 'translateX(-50%)', width: 32, height: 32, borderRadius: '50%', background: isPawMoments ? 'radial-gradient(circle,#8B5E3C,#6B3F1F)' : 'radial-gradient(circle,#D4A853,#B8892A)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, boxShadow: '0 2px 6px rgba(0,0,0,0.3)', zIndex: 2 }}>
            {isPawMoments ? '🐾' : '✦'}
          </div>
        </motion.div>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} onClick={() => setStage('card')} style={{ color: isPawMoments ? pawAccent : goldAccent, fontSize: 13, letterSpacing: 2, textTransform: 'uppercase', cursor: 'pointer' }}>Tap to open</motion.p>
      </div>
    );
  }

  if (stage === 'card') {
    return (
      <div style={{ minHeight: '100vh', position: 'relative', background: isPawMoments ? 'radial-gradient(ellipse at 50% 40%,#F0E4D0,#E8D5BA,#DFC8A8)' : 'radial-gradient(ellipse at 50% 40%,#FDF6EE,#F7EBE0,#F0DDD0)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 8px', fontFamily: 'Georgia,serif' }}>

        {/* ── Top-left back arrow ──
             • view='back'  → close SayIt panel, go to open card
             • view='open'  → close card, stay on page (front)
             • view='front' → navigate back to chat history             ── */}
        <button
          onClick={() => {
            if (view === 'back')  { setView('open');  return; }
            if (view === 'open')  { setView('front'); return; }
            backUrl ? router.push(backUrl) : router.back();
          }}
          style={{
            position: 'absolute', top: 'calc(env(safe-area-inset-top, 44px) + 10px)', left: 16,
            width: 36, height: 36, borderRadius: '50%',
            background: 'rgba(255,255,255,0.8)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(0,0,0,0.08)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
            zIndex: 30,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#6b7280' }}>
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>

        {/* ── "Received from" — just above the card image, received cards only ── */}
        {isViewMode && isReceived && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            style={{
              fontSize: 13, color: '#9ca3af', textAlign: 'center',
              margin: '0 0 10px 0', padding: '0 16px',
            }}
          >
            Received from{' '}
            <span style={{ fontWeight: 700, color: '#5C3D2E' }}>
              {viewSender?.trim() || 'a friend'}
            </span>
          </motion.p>
        )}

        {/* ── "Sent to" — just above the card image, sent cards only ── */}
        {isViewMode && !isReceived && recipientDisplayName && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            style={{
              fontSize: 13, color: '#9ca3af', textAlign: 'center',
              margin: '0 0 10px 0', padding: '0 16px',
            }}
          >
            Sent to{' '}
            <span style={{ fontWeight: 700, color: '#5C3D2E' }}>{recipientDisplayName}</span>
          </motion.p>
        )}

        {/* ── Full-width single card ── */}
        <div style={{ position: 'relative', paddingBottom: isViewMode ? 14 : 0 }}>
        <motion.div
          initial={{ width: CARD_W, height: CARD_H }}
          animate={{
            width:  view === 'open' ? OPEN_W : CARD_W,
            height: view === 'open' ? OPEN_H : CARD_H,
          }}
          transition={{ type: 'spring', stiffness: 220, damping: 28 }}
          style={{ position: 'relative', boxShadow: '0 16px 48px rgba(0,0,0,0.22)', borderRadius: 20, overflow: 'hidden', perspective: 1200 }}
        >

          {/* INSIDE — two panels side by side (left: art, right: message) */}
          <div style={{ position: 'absolute', inset: 0, display: 'flex', borderRadius: 20, overflow: 'hidden' }}>

            {/* LEFT PANEL — art */}
            <div style={{ width: '50%', height: '100%', flexShrink: 0, position: 'relative', overflow: 'hidden', background: isPawMoments ? 'radial-gradient(ellipse at 50% 30%,#FBF5EC,#F5EDE0,#EDD9C4)' : 'radial-gradient(ellipse at 50% 30%,#FFFDF9,#FBF7F0,#F5EDDF)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '16px 12px', gap: 8 }}>
              {isPawMoments ? (
                <>
                  <PawBorder />
                  <p style={{ fontSize: 8, letterSpacing: 2.5, textTransform: 'uppercase', color: pawAccent, opacity: 0.7 }}>Our Moments</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: 6, width: '100%', flex: 1 }} onClick={e => e.stopPropagation()}>
                    {petPhotos.map((photo, i) => <WoodenFrame key={i} photo={photo} index={i} onUpload={handlePhotoUpload} />)}
                  </div>
                </>
              ) : (
                <>
                  <p style={{ fontSize: view === 'open' ? 11 : 8, letterSpacing: 2.5, color: goldAccent, opacity: 0.7, textTransform: 'uppercase', textAlign: 'center', transition: 'font-size 0.3s' }}>{category?.name ?? 'With Love'}</p>
                  {/* Mood quote — shown above the image when a subcategory match exists */}
                  {moodQuote && (
                    <p style={{
                      fontFamily: "'Georgia', 'Times New Roman', serif",
                      fontStyle: 'italic',
                      fontSize: view === 'open' ? 10 : 8,
                      lineHeight: 1.65,
                      color: '#8B6347',
                      textAlign: 'center',
                      whiteSpace: 'pre-line',
                      opacity: 0.82,
                      margin: '2px 4px',
                      transition: 'font-size 0.3s',
                    }}>
                      {moodQuote}
                    </p>
                  )}
                  <OrnamentLine color={goldAccent} />
                  <div style={{ width: view === 'open' ? 152 : 110, height: view === 'open' ? 152 : 110, borderRadius: '50%', overflow: 'hidden', border: `3px solid ${goldAccent}`, boxShadow: `0 0 0 5px rgba(201,168,76,0.12),0 6px 20px rgba(0,0,0,0.14)`, transition: 'width 0.3s, height 0.3s', flexShrink: 0, background: template.color_accent ?? '#c9a87c' }}>
                    <img src={template.front_image_url ?? `https://picsum.photos/seed/${template.id}/220/220`} alt={template.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                  <OrnamentLine color={goldAccent} />
                </>
              )}
            </div>

            {/* Vertical divider */}
            <div style={{ width: 1, background: `linear-gradient(180deg,transparent,${isPawMoments ? pawAccentLight : goldAccent},transparent)`, opacity: 0.35, flexShrink: 0 }} />

            {/* RIGHT PANEL — message */}
            <div style={{ flex: 1, height: '100%', position: 'relative', background: isPawMoments ? 'linear-gradient(170deg,#FBF5EC,#F5EDE0)' : 'linear-gradient(170deg,#FFFCF8,#FDF8F2)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {/* lined paper — line height matches textarea */}
              <div style={{ position: 'absolute', inset: 0, backgroundImage: `repeating-linear-gradient(transparent,transparent ${view === 'open' ? 27 : 23}px,${isPawMoments ? 'rgba(139,94,60,0.07)' : 'rgba(201,168,76,0.07)'} ${view === 'open' ? 28 : 24}px)`, backgroundSize: `100% ${view === 'open' ? 28 : 24}px`, backgroundPosition: '0 38px', pointerEvents: 'none', transition: 'background-size 0.3s' }} />
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', padding: '0 0 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px 6px', flexShrink: 0 }}>
                  <p style={{ fontSize: view === 'open' ? 9 : 7, letterSpacing: 1.5, textTransform: 'uppercase', color: isPawMoments ? pawAccentLight : goldAccent, margin: 0, transition: 'font-size 0.3s' }}>{isPawMoments ? '🐾 A little note' : '✦ A personal note'}</p>
                  <span onClick={() => setView('back')} style={{ fontSize: 10, color: isPawMoments ? pawAccentLight : goldAccent, opacity: 0.6, cursor: 'pointer', padding: '4px 6px', WebkitTapHighlightColor: 'transparent' }}>›</span>
                </div>
                {isViewMode ? (
                  <div style={{ flex: 1, padding: '4px 14px', overflowY: 'auto' }}>
                    <p style={{ fontFamily: 'Georgia,serif', fontSize: view === 'open' ? 14 : 11, lineHeight: view === 'open' ? '28px' : '24px', color: '#5C3D2E', fontStyle: 'italic', margin: 0, transition: 'font-size 0.3s, line-height 0.3s' }}>
                      {viewMessage ? <>&ldquo;{viewMessage}&rdquo;</> : <span style={{ opacity: 0.5 }}>No message added</span>}
                    </p>
                  </div>
                ) : (
                  <textarea value={message} onChange={e => setMessage(e.target.value.slice(0, 300))} maxLength={300} placeholder={isPawMoments ? 'Write something sweet...' : 'Write your heartfelt message here...'} style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', resize: 'none', fontFamily: 'Georgia,serif', fontSize: view === 'open' ? 14 : 11, lineHeight: view === 'open' ? '28px' : '24px', color: '#5C3D2E', padding: '4px 14px', transition: 'font-size 0.3s, line-height 0.3s' }} />
                )}
                <div style={{ borderTop: `1px solid ${isPawMoments ? pawAccentLight : goldAccent}`, paddingTop: 8, opacity: 0.7, margin: '0 14px', flexShrink: 0 }}>
                  {isViewMode
                    ? <p style={{ fontFamily: 'Georgia,serif', fontStyle: 'italic', fontSize: view === 'open' ? 13 : 11, color: '#7A5240', margin: 0, transition: 'font-size 0.3s' }}>— {viewSender || 'With love'}</p>
                    : <input value={sender} onChange={e => setSender(e.target.value.slice(0, 50))} maxLength={50} placeholder="— Your Name" style={{ background: 'transparent', border: 'none', outline: 'none', fontFamily: 'Georgia,serif', fontStyle: 'italic', fontSize: view === 'open' ? 13 : 11, color: '#7A5240', width: '100%', transition: 'font-size 0.3s' }} />
                  }
                </div>
              </div>
            </div>

          </div>

          {/* Click-to-close overlay — view mode only (compose mode needs free access to textarea/input) */}
          {view === 'open' && isViewMode && (
            <div
              style={{ position: 'absolute', inset: 0, zIndex: 9, cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}
              onClick={() => setView('back')}
            />
          )}

          {/* SAYIT BACK PANEL */}
          <AnimatePresence>
            {view === 'back' && (
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg,#FF6B8A,#9B59B6)', borderRadius: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24, cursor: 'pointer', WebkitTapHighlightColor: 'transparent', zIndex: 20 }}
                onClick={() => setView('open')}
              >
                <div style={{ position: 'absolute', top: -30, right: -30, width: 140, height: 140, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
                <div style={{ position: 'absolute', bottom: -20, left: -20, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
                <img src="/Sayit.png" alt="SayIt" style={{ width: 80, height: 80, borderRadius: 20, boxShadow: '0 6px 24px rgba(0,0,0,0.25)' }} />
                <div style={{ width: 40, height: 1.5, background: 'rgba(255,255,255,0.4)', borderRadius: 2 }} />
                <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 10, textAlign: 'center', letterSpacing: 1.5, textTransform: 'uppercase', margin: 0, lineHeight: 1.7, padding: '0 12px' }}>Some moments deserve more than a text</p>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 9, letterSpacing: 1, margin: 0 }}>sayit.app</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* FRONT COVER — full card width, flips to reveal inside */}
          <motion.div
            style={{ position: 'absolute', inset: 0, transformOrigin: 'left center', transformStyle: 'preserve-3d', zIndex: 10, cursor: view === 'front' ? 'pointer' : 'default', WebkitTapHighlightColor: 'transparent', pointerEvents: view === 'front' ? 'auto' : 'none', borderRadius: 20 }}
            initial={{ rotateY: 0 }}
            animate={{ rotateY: view === 'front' ? 0 : -180 }}
            transition={{ type: 'spring', stiffness: 62, damping: 14, mass: 1.3 }}
            onClick={() => setView('open')}
          >
            <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', borderRadius: 20, overflow: 'hidden', background: template.color_accent ?? '#c9a87c' }}>
              {/* Shimmer skeleton shown until image loads */}
              {!coverImgLoaded && (
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(110deg, rgba(255,255,255,0.08) 25%, rgba(255,255,255,0.22) 50%, rgba(255,255,255,0.08) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite' }} />
              )}
              <img
                src={template.front_image_url ?? `https://picsum.photos/seed/${template.id}/640/900`}
                alt={template.title}
                onLoad={() => setCoverImgLoaded(true)}
                style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: coverImgLoaded ? 1 : 0, transition: 'opacity 0.3s ease' }}
              />
              <div style={{ position: 'absolute', inset: 0, background: isPawMoments ? 'linear-gradient(180deg,rgba(0,0,0,0) 50%,rgba(60,30,10,0.35) 100%)' : 'linear-gradient(180deg,rgba(0,0,0,0) 50%,rgba(40,15,5,0.30) 100%)' }} />
            </div>
          </motion.div>

        </motion.div>

        </div>{/* end relative wrapper */}

        {/* ── Reaction badge — below closed card, touching bottom border ── */}
        <AnimatePresence>
          {isViewMode && isReceived && reactionLoaded && myCardReaction && !reactionTrayOpen && view === 'front' && (
            <motion.div
              key="card-rx-badge-wrap"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 24 }}
              style={{ width: CARD_W, display: 'flex', justifyContent: 'flex-end', marginTop: -18, paddingRight: 16, zIndex: 20, position: 'relative' }}
            >
              <button
                onClick={() => setReactionTrayOpen(true)}
                style={{
                  background: 'white',
                  borderRadius: 20,
                  padding: '5px 10px 5px 7px',
                  border: '1.5px solid rgba(0,0,0,0.07)',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.16)',
                  display: 'flex', alignItems: 'center', gap: 4,
                  cursor: 'pointer',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                <span style={{ fontSize: 20, lineHeight: 1 }}>{myCardReaction}</span>
                {(reactionCounts[myCardReaction] ?? 0) > 0 && (
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#FF6B8A', lineHeight: 1 }}>
                    {reactionCounts[myCardReaction]}
                  </span>
                )}
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Reaction badge — sender viewing sent card (read-only, same style as received badge) ── */}
        <AnimatePresence>
          {isViewMode && !isReceived && reactionLoaded && view === 'front' && Object.values(reactionCounts).some(c => c > 0) && (() => {
            // Pick the most-reacted emoji to show in the badge
            const topEmoji = REACTION_EMOJIS.find(e => (reactionCounts[e] ?? 0) > 0) ?? '';
            const totalCount = Object.values(reactionCounts).reduce((s, c) => s + c, 0);
            return (
              <motion.div
                key="card-rx-sent-badge"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 24 }}
                style={{ width: CARD_W, display: 'flex', justifyContent: 'flex-end', marginTop: -18, paddingRight: 16, zIndex: 20, position: 'relative' }}
              >
                <div style={{
                  background: 'white',
                  borderRadius: 20,
                  padding: '5px 10px 5px 7px',
                  border: '1.5px solid rgba(0,0,0,0.07)',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.16)',
                  display: 'flex', alignItems: 'center', gap: 4,
                }}>
                  <span style={{ fontSize: 20, lineHeight: 1 }}>{topEmoji}</span>
                  {totalCount > 1 && (
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#FF6B8A', lineHeight: 1 }}>
                      {totalCount}
                    </span>
                  )}
                </div>
              </motion.div>
            );
          })()}
        </AnimatePresence>

        {/* ── WhatsApp-style floating emoji picker pill ── */}
        <AnimatePresence>
          {isViewMode && isReceived && reactionLoaded && view === 'front' && (reactionTrayOpen || !myCardReaction) && (
            <motion.div
              key="card-rx-picker"
              initial={{ opacity: 0, y: 10, scale: 0.88 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.88 }}
              transition={{ type: 'spring', stiffness: 380, damping: 26 }}
              style={{ display: 'flex', justifyContent: 'center', marginTop: 16, marginBottom: 4 }}
            >
              <div style={{
                background: 'white',
                borderRadius: 40,
                padding: '6px 10px',
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                boxShadow: '0 4px 24px rgba(0,0,0,0.13), 0 1px 4px rgba(0,0,0,0.07)',
                border: '1px solid rgba(0,0,0,0.06)',
              }}>
                {/* Close button — only visible when re-opening from badge tap */}
                {reactionTrayOpen && (
                  <button
                    onClick={() => setReactionTrayOpen(false)}
                    style={{
                      width: 32, height: 32, borderRadius: '50%',
                      background: '#f3f4f6', border: 'none', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      marginRight: 2, WebkitTapHighlightColor: 'transparent',
                    }}
                  >
                    <span style={{ fontSize: 12, color: '#6b7280' }}>✕</span>
                  </button>
                )}
                {REACTION_EMOJIS.map(emoji => {
                  const isMine = myCardReaction === emoji;
                  return (
                    <motion.button
                      key={emoji}
                      onClick={() => reactToCard(emoji)}
                      whileTap={{ scale: 0.82 }}
                      animate={{ scale: isMine ? 1.18 : 1 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                      style={{
                        width: 46, height: 46, borderRadius: '50%',
                        background: isMine ? 'rgba(255,107,138,0.1)' : 'transparent',
                        border: isMine ? '2px solid rgba(255,107,138,0.35)' : '2px solid transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: userId ? 'pointer' : 'default',
                        WebkitTapHighlightColor: 'transparent',
                        transition: 'background 0.15s, border 0.15s',
                      }}
                    >
                      <span style={{ fontSize: 26, lineHeight: 1 }}>{emoji}</span>
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Close card button (compose mode, open state) — sits between card and Sayit ── */}
        <AnimatePresence>
          {view === 'open' && !isViewMode && (
            <motion.button
              key="close-card-compose"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.2 }}
              onClick={() => setView('front')}
              style={{
                marginTop: 14,
                padding: '10px 28px',
                borderRadius: 30,
                border: `1.5px solid ${isPawMoments ? 'rgba(139,94,60,0.3)' : 'rgba(201,168,76,0.35)'}`,
                background: 'rgba(255,255,255,0.65)',
                backdropFilter: 'blur(8px)',
                color: isPawMoments ? '#8B5E3C' : '#9B7A40',
                fontSize: 13,
                fontWeight: 600,
                letterSpacing: 0.5,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                boxShadow: '0 2px 10px rgba(0,0,0,0.08)',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              Close card
            </motion.button>
          )}
        </AnimatePresence>

        {/* ── Send button (compose mode only) ──────────────────── */}
        <AnimatePresence>
          {view === 'open' && !isViewMode && (
            <motion.button initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} transition={{ delay: 0.2 }} onClick={() => {
                if (isPawMoments) {
                  const validPhotos = petPhotos.filter(Boolean) as string[];
                  if (validPhotos.length === 0) { alert("Add at least one photo first! 🐾"); return; }
                  try {
                    sessionStorage.setItem("paw_photos", JSON.stringify(validPhotos));
                    sessionStorage.setItem("paw_message", message);
                    if (sender.trim()) sessionStorage.setItem("card_signature", sender.trim());
                    else sessionStorage.removeItem("card_signature");
                  } catch {}
                  router.push("/send?type=paw-moments");
                } else {
                  const sigParam = sender.trim() ? `&signature=${encodeURIComponent(sender.trim())}` : "";
                  router.push(`/send?templateId=${encodeURIComponent(template.id)}&message=${encodeURIComponent(message)}${sigParam}`);
                }
              }} style={{ marginTop: 16, padding: '14px 48px', borderRadius: 30, border: 'none', background: isPawMoments ? 'linear-gradient(135deg,#8B5E3C,#6B3F1F)' : 'linear-gradient(135deg,#C9A84C,#B8892A)', color: '#FFF8EC', fontSize: 15, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', fontFamily: 'Georgia,serif', cursor: 'pointer', boxShadow: '0 6px 20px rgba(0,0,0,0.22)', minWidth: 180 }}>
              {isPawMoments ? '🐾 Sayit' : '✦ Sayit'}
            </motion.button>
          )}
        </AnimatePresence>

        {/* ── Close-card button — always on back panel; on open panel for view/received modes (compose has its own) ── */}
        <AnimatePresence>
          {(view === 'back' || (view === 'open' && (isViewMode || startEnvelope || browseMode))) && (
            <motion.button
              key="close-card-btn"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.2 }}
              onClick={() => setView('front')}
              style={{
                marginTop: 14,
                padding: '10px 28px',
                borderRadius: 30,
                border: `1.5px solid ${isPawMoments ? 'rgba(139,94,60,0.3)' : 'rgba(201,168,76,0.35)'}`,
                background: 'rgba(255,255,255,0.65)',
                backdropFilter: 'blur(8px)',
                color: isPawMoments ? '#8B5E3C' : '#9B7A40',
                fontSize: 13,
                fontWeight: 600,
                letterSpacing: 0.5,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                boxShadow: '0 2px 10px rgba(0,0,0,0.08)',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              Close card
            </motion.button>
          )}
        </AnimatePresence>

        {/* ── Closed-card CTAs — only visible when card is in front/closed state ── */}
        <AnimatePresence>
          {view === 'front' && (
            <motion.div
              key="front-ctas"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.2 }}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}
            >
              {/* Tap to open pill — always visible when card is closed */}
              <motion.button
                onClick={() => setView('open')}
                style={{
                  marginTop: 14,
                  padding: '10px 28px',
                  borderRadius: 20,
                  background: 'rgba(255,255,255,0.7)',
                  border: '1px solid rgba(255,255,255,0.5)',
                  backdropFilter: 'blur(4px)',
                  color: isPawMoments ? '#6B3F1F' : '#5C3317',
                  fontSize: 12,
                  letterSpacing: 2,
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  fontFamily: 'Georgia,serif',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                Tap to open
              </motion.button>

              {isViewMode && isReceived && (
                <motion.button
                  onClick={() => router.push(sayitBackUrl)}
                  style={{
                    marginTop: 10,
                    padding: '13px 32px',
                    borderRadius: 30,
                    border: 'none',
                    background: 'linear-gradient(135deg,#FF6B8A,#9B59B6)',
                    color: 'white',
                    fontSize: 14,
                    fontWeight: 700,
                    letterSpacing: 0.5,
                    cursor: 'pointer',
                    boxShadow: '0 4px 18px rgba(255,107,138,0.35)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    WebkitTapHighlightColor: 'transparent',
                  }}
                >
                  ✨ Say it Back
                </motion.button>
              )}
              {isViewMode && !isReceived && (
                <motion.button
                  onClick={() => router.push(sayitBackUrl)}
                  style={{
                    marginTop: 10,
                    padding: '13px 32px',
                    borderRadius: 30,
                    border: 'none',
                    background: 'linear-gradient(135deg,#FF6B8A,#9B59B6)',
                    color: 'white',
                    fontSize: 14,
                    fontWeight: 700,
                    letterSpacing: 0.5,
                    cursor: 'pointer',
                    boxShadow: '0 4px 18px rgba(255,107,138,0.35)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    WebkitTapHighlightColor: 'transparent',
                  }}
                >
                  ✨ Say it Again
                </motion.button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: isPawMoments ? 'linear-gradient(160deg,#F5EDE0,#EDD9C0)' : 'linear-gradient(160deg,#FDF6EE,#F5EAD8)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, fontFamily: 'Georgia,serif' }}>
      <motion.div initial={{ rotateY: 90, opacity: 0 }} animate={{ rotateY: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 70, damping: 16 }} style={{ width: CARD_W, height: CARD_H, background: isPawMoments ? '#FAF3E8' : '#FAF6F0', borderRadius: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.12)', border: `1px solid ${isPawMoments ? '#D4B896' : '#E8DDD0'}` }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: isPawMoments ? 'radial-gradient(circle,#F5EDE0,#EDD9C0)' : 'radial-gradient(circle,#FDF6EE,#F5EAD8)', border: `2px solid ${isPawMoments ? '#8B5E3C' : '#C9A84C'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
          {isPawMoments ? '🐾' : '💌'}
        </div>
        <p style={{ fontSize: 16, color: isPawMoments ? '#6B3F1F' : '#8B6040', letterSpacing: 1 }}>SayIt</p>
        <p style={{ fontSize: 9, color: isPawMoments ? '#A07850' : '#B09070', letterSpacing: 2, opacity: 0.7 }}>{isPawMoments ? 'PAW MOMENTS' : 'GREETING CARDS'}</p>
        <p style={{ fontSize: 9, color: '#B09070', opacity: 0.6, textAlign: 'center', padding: '0 20px', lineHeight: 1.6 }}>Made with love at {(process.env.NEXT_PUBLIC_BASE_URL ?? "https://sayit-gamma.vercel.app").replace(/https?:\/\//, "")}</p>
      </motion.div>
      <button onClick={() => setStage('card')} style={{ background: 'none', border: 'none', color: isPawMoments ? '#8B6347' : '#9B7A5A', fontSize: 12, cursor: 'pointer', opacity: 0.6 }}>← Back to card</button>
    </div>
  );
}

export default function CardPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ width: 32, height: 32, borderRadius: '50%', border: '4px solid #FFD4DF', borderTopColor: '#FF6B8A', animation: 'spin 0.8s linear infinite' }} /></div>}>
      <CardPageInner />
    </Suspense>
  );
}
