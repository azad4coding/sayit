import { Category, Template } from "./types";

export const CATEGORIES: Category[] = [
  {
    id: "romance",
    name: "Romance",
    slug: "romance",
    icon: "❤️",
    gradient_from: "#FF6B8A",
    gradient_to: "#FF8FA3",
    display_order: 1,
    is_hero: true,
    is_active: true,
    subcategories: [
      { id: "flowers",        category_id: "romance", name: "Flowers",         slug: "flowers",         icon: "🌹", display_order: 1 },
      { id: "miss-you",       category_id: "romance", name: "Miss You",        slug: "miss-you",        icon: "💌", display_order: 2 },
      { id: "thinking-of-you",category_id: "romance", name: "Thinking of You", slug: "thinking-of-you", icon: "💭", display_order: 3 },
      { id: "good-night",     category_id: "romance", name: "Good Night",      slug: "good-night",      icon: "🌙", display_order: 4 },
    ],
  },
  {
    id: "paw-moments",
    name: "Paw Moments",
    slug: "paw-moments",
    icon: "🐾",
    gradient_from: "#9B59B6",
    gradient_to: "#C39BD3",
    display_order: 2,
    is_hero: true,
    is_active: true,
  },
  {
    id: "morning-wishes",
    name: "Morning Wishes",
    slug: "morning-wishes",
    icon: "☀️",
    gradient_from: "#F39C12",
    gradient_to: "#F7DC6F",
    display_order: 3,
    is_hero: false,
    is_active: true,
    subcategories: [
      { id: "good-morning", category_id: "morning-wishes", name: "Good Morning",  slug: "good-morning", icon: "🌅", display_order: 1 },
      { id: "motivation",   category_id: "morning-wishes", name: "Motivation",    slug: "motivation",   icon: "🔥", display_order: 2 },
      { id: "weekend-vibes",category_id: "morning-wishes", name: "Weekend Vibes", slug: "weekend-vibes",icon: "🎉", display_order: 3 },
    ],
  },
  {
    id: "birthday",
    name: "Birthday",
    slug: "birthday",
    icon: "🎂",
    gradient_from: "#FF6B35",
    gradient_to: "#FFB347",
    display_order: 4,
    is_hero: false,
    is_active: true,
  },
  {
    id: "occasions",
    name: "Occasions",
    slug: "occasions",
    icon: "🎉",
    gradient_from: "#11998E",
    gradient_to: "#38EF7D",
    display_order: 5,
    is_hero: false,
    is_active: true,
  },
  {
    id: "holidays",
    name: "Holidays",
    slug: "holidays",
    icon: "🎁",
    gradient_from: "#C0392B",
    gradient_to: "#E74C3C",
    display_order: 6,
    is_hero: false,
    is_active: true,
  },
  // ── Thank You ──────────────────────────────────────────────────────────────
  {
    id: "thank-you", name: "Thank You", slug: "thank-you", icon: "🙏",
    gradient_from: "#F5A623", gradient_to: "#E8722A",
    display_order: 7, is_hero: false, is_active: true,
    subcategories: [
      { id: "general-thanks",   category_id: "thank-you", name: "General",     slug: "general-thanks",   icon: "🙏", display_order: 1 },
      { id: "thank-you-teacher",category_id: "thank-you", name: "Teacher",     slug: "thank-you-teacher",icon: "🍎", display_order: 2 },
      { id: "thank-you-friend", category_id: "thank-you", name: "Friend",      slug: "thank-you-friend", icon: "💛", display_order: 3 },
      { id: "thank-you-work",   category_id: "thank-you", name: "Professional",slug: "thank-you-work",   icon: "💼", display_order: 4 },
    ],
  },
  // ── Invitations ────────────────────────────────────────────────────────────
  {
    id: "invitations", name: "Invitations", slug: "invitations", icon: "💌",
    gradient_from: "#8E44AD", gradient_to: "#C0392B",
    display_order: 8, is_hero: false, is_active: true,
    subcategories: [
      { id: "inv-birthday",  category_id: "invitations", name: "Birthday",      slug: "inv-birthday",  icon: "🎂", display_order: 1 },
      { id: "inv-wedding",   category_id: "invitations", name: "Wedding",       slug: "inv-wedding",   icon: "💍", display_order: 2 },
      { id: "inv-baby",      category_id: "invitations", name: "Baby Shower",   slug: "inv-baby",      icon: "🍼", display_order: 3 },
      { id: "inv-graduation",category_id: "invitations", name: "Graduation",    slug: "inv-graduation",icon: "🎓", display_order: 4 },
      { id: "inv-teacher",   category_id: "invitations", name: "Teacher's Week",slug: "inv-teacher",   icon: "🍎", display_order: 5 },
    ],
  },


  // ── Vibes (GenZ Y2K) ──────────────────────────────────────────────────────
  {
    id: "vibes", name: "Vibes", slug: "vibes", icon: "✨",
    gradient_from: "#FF1493", gradient_to: "#FF6B00",
    display_order: 9, is_hero: true, is_active: true,
    subcategories: [
      { id: "no-cap",        category_id: "vibes", name: "No Cap",        slug: "no-cap",        icon: "🧢", display_order: 1 },
      { id: "its-giving",    category_id: "vibes", name: "It's Giving",   slug: "its-giving",    icon: "💅", display_order: 2 },
      { id: "lowkey",        category_id: "vibes", name: "Lowkey",        slug: "lowkey",        icon: "🤫", display_order: 3 },
      { id: "main-character",category_id: "vibes", name: "Main Character",slug: "main-character",icon: "🌟", display_order: 4 },
    ],
  },
];

// Curated Unsplash image IDs for each category/subcategory
// Format: https://images.unsplash.com/photo-{ID}?w=400&h=600&fit=crop&q=80
export const TEMPLATES: Template[] = [
  // ── Romance › Flowers ──────────────────────────────────────────────────────
  {
    id: "t-r-f-1", category_id: "romance", subcategory_id: "flowers",
    title: "Red Roses", color_accent: "#E74C3C",
    front_image_url: "https://picsum.photos/seed/roses/400/600?w=400&h=600&fit=crop&q=80",
    display_order: 1, is_active: true,
  },
  {
    id: "t-r-f-2", category_id: "romance", subcategory_id: "flowers",
    title: "Pink Blooms", color_accent: "#FF6B8A",
    front_image_url: "https://picsum.photos/seed/romantic/400/600?w=400&h=600&fit=crop&q=80",
    display_order: 2, is_active: true,
  },
  {
    id: "t-r-f-3", category_id: "romance", subcategory_id: "flowers",
    title: "Sunflower Love", color_accent: "#F39C12",
    front_image_url: "https://images.unsplash.com/photo-1470509037663-253afd7f0f51?w=400&h=600&fit=crop&q=80",
    display_order: 3, is_active: true,
  },
  {
    id: "t-r-f-4", category_id: "romance", subcategory_id: "flowers",
    title: "Garden Blooms", color_accent: "#9B59B6",
    front_image_url: "https://images.unsplash.com/photo-1455582916367-25f75bfc6710?w=400&h=600&fit=crop&q=80",
    display_order: 4, is_active: true,
  },
  // ── Romance › Miss You ─────────────────────────────────────────────────────
  {
    id: "t-r-m-1", category_id: "romance", subcategory_id: "miss-you",
    title: "Missing You", color_accent: "#FF6B8A",
    front_image_url: "https://images.unsplash.com/photo-1516589091380-5d8e87df6999?w=400&h=600&fit=crop&q=80",
    display_order: 1, is_active: true,
  },
  {
    id: "t-r-m-2", category_id: "romance", subcategory_id: "miss-you",
    title: "Lonely Heart", color_accent: "#E74C3C",
    front_image_url: "https://images.unsplash.com/photo-1474552226712-ac0f0961a954?w=400&h=600&fit=crop&q=80",
    display_order: 2, is_active: true,
  },
  // ── Romance › Thinking of You ──────────────────────────────────────────────
  {
    id: "t-r-t-1", category_id: "romance", subcategory_id: "thinking-of-you",
    title: "You're on My Mind", color_accent: "#9B59B6",
    front_image_url: "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=400&h=600&fit=crop&q=80",
    display_order: 1, is_active: true,
  },
  {
    id: "t-r-t-2", category_id: "romance", subcategory_id: "thinking-of-you",
    title: "Always Here", color_accent: "#8E44AD",
    front_image_url: "https://images.unsplash.com/photo-1534423861386-85a16f5d13fd?w=400&h=600&fit=crop&q=80",
    display_order: 2, is_active: true,
  },
  // ── Romance › Good Night ───────────────────────────────────────────────────
  {
    id: "t-r-g-1", category_id: "romance", subcategory_id: "good-night",
    title: "Starry Night", color_accent: "#1A1A4E",
    front_image_url: "https://picsum.photos/seed/flowers/400/600?w=400&h=600&fit=crop&q=80",
    display_order: 1, is_active: true,
  },
  {
    id: "t-r-g-2", category_id: "romance", subcategory_id: "good-night",
    title: "Sweet Dreams", color_accent: "#2C3E50",
    front_image_url: "https://images.unsplash.com/photo-1504333638930-c8787321eee0?w=400&h=600&fit=crop&q=80",
    display_order: 2, is_active: true,
  },
  // ── Morning Wishes ─────────────────────────────────────────────────────────
  {
    id: "t-mw-1", category_id: "morning-wishes", subcategory_id: "good-morning",
    title: "Golden Sunrise", color_accent: "#F39C12",
    front_image_url: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=600&fit=crop&q=80",
    display_order: 1, is_active: true,
  },
  {
    id: "t-mw-2", category_id: "morning-wishes", subcategory_id: "good-morning",
    title: "Morning Coffee", color_accent: "#795548",
    front_image_url: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&h=600&fit=crop&q=80",
    display_order: 2, is_active: true,
  },
  {
    id: "t-mw-3", category_id: "morning-wishes", subcategory_id: "motivation",
    title: "Rise & Shine", color_accent: "#E67E22",
    front_image_url: "https://images.unsplash.com/photo-1483058712412-4245e9b90334?w=400&h=600&fit=crop&q=80",
    display_order: 1, is_active: true,
  },
  {
    id: "t-mw-4", category_id: "morning-wishes", subcategory_id: "weekend-vibes",
    title: "Happy Weekend", color_accent: "#27AE60",
    front_image_url: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=400&h=600&fit=crop&q=80",
    display_order: 1, is_active: true,
  },
  // ── Birthday ───────────────────────────────────────────────────────────────
  {
    id: "t-b-1", category_id: "birthday",
    title: "Birthday Cake", color_accent: "#FF6B8A",
    front_image_url: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=600&fit=crop&q=80",
    display_order: 1, is_active: true,
  },
  {
    id: "t-b-2", category_id: "birthday",
    title: "Celebrate!", color_accent: "#9B59B6",
    front_image_url: "https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=400&h=600&fit=crop&q=80",
    display_order: 2, is_active: true,
  },
  {
    id: "t-b-3", category_id: "birthday",
    title: "Balloons & Joy", color_accent: "#3498DB",
    front_image_url: "https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=400&h=600&fit=crop&q=80",
    display_order: 3, is_active: true,
  },

  // ── Thank You › General ────────────────────────────────────────────────────
  {
    id: "t-ty-1", category_id: "thank-you", subcategory_id: "general-thanks",
    title: "From the Heart", color_accent: "#F5A623",
    front_image_url: "https://picsum.photos/seed/thankful/400/600",
    display_order: 1, is_active: true,
  },
  {
    id: "t-ty-2", category_id: "thank-you", subcategory_id: "general-thanks",
    title: "Gratitude Blooms", color_accent: "#E8722A",
    front_image_url: "https://picsum.photos/seed/gratitude/400/600",
    display_order: 2, is_active: true,
  },
  // ── Thank You › Teacher ────────────────────────────────────────────────────
  {
    id: "t-ty-3", category_id: "thank-you", subcategory_id: "thank-you-teacher",
    title: "Thanks, Teacher!", color_accent: "#E74C3C",
    front_image_url: "https://picsum.photos/seed/teacher/400/600",
    display_order: 1, is_active: true,
  },
  {
    id: "t-ty-4", category_id: "thank-you", subcategory_id: "thank-you-teacher",
    title: "You Inspire Me", color_accent: "#C0392B",
    front_image_url: "https://picsum.photos/seed/inspire/400/600",
    display_order: 2, is_active: true,
  },
  // ── Thank You › Friend ─────────────────────────────────────────────────────
  {
    id: "t-ty-5", category_id: "thank-you", subcategory_id: "thank-you-friend",
    title: "Lucky to Have You", color_accent: "#F39C12",
    front_image_url: "https://picsum.photos/seed/friendship/400/600",
    display_order: 1, is_active: true,
  },
  {
    id: "t-ty-6", category_id: "thank-you", subcategory_id: "thank-you-friend",
    title: "BFF Thanks", color_accent: "#E67E22",
    front_image_url: "https://picsum.photos/seed/bestfriend/400/600",
    display_order: 2, is_active: true,
  },
  // ── Thank You › Professional ───────────────────────────────────────────────
  {
    id: "t-ty-7", category_id: "thank-you", subcategory_id: "thank-you-work",
    title: "Professional Thanks", color_accent: "#2C3E50",
    front_image_url: "https://picsum.photos/seed/professional/400/600",
    display_order: 1, is_active: true,
  },
  {
    id: "t-ty-8", category_id: "thank-you", subcategory_id: "thank-you-work",
    title: "Great Teamwork", color_accent: "#34495E",
    front_image_url: "https://picsum.photos/seed/teamwork/400/600",
    display_order: 2, is_active: true,
  },
  // ── Invitations › Birthday ─────────────────────────────────────────────────
  {
    id: "t-inv-b1", category_id: "invitations", subcategory_id: "inv-birthday",
    title: "Birthday Bash", color_accent: "#FF6B8A",
    front_image_url: "https://picsum.photos/seed/birthdayparty/400/600",
    display_order: 1, is_active: true,
  },
  {
    id: "t-inv-b2", category_id: "invitations", subcategory_id: "inv-birthday",
    title: "You're Invited!", color_accent: "#E91E8C",
    front_image_url: "https://picsum.photos/seed/partyinvite/400/600",
    display_order: 2, is_active: true,
  },
  // ── Invitations › Wedding ──────────────────────────────────────────────────
  {
    id: "t-inv-w1", category_id: "invitations", subcategory_id: "inv-wedding",
    title: "Forever Begins", color_accent: "#C9A84C",
    front_image_url: "https://picsum.photos/seed/wedding/400/600",
    display_order: 1, is_active: true,
  },
  {
    id: "t-inv-w2", category_id: "invitations", subcategory_id: "inv-wedding",
    title: "Two Hearts Unite", color_accent: "#8E44AD",
    front_image_url: "https://picsum.photos/seed/weddingfloral/400/600",
    display_order: 2, is_active: true,
  },
  // ── Invitations › Baby Shower ──────────────────────────────────────────────
  {
    id: "t-inv-bs1", category_id: "invitations", subcategory_id: "inv-baby",
    title: "Baby on the Way", color_accent: "#85C1E9",
    front_image_url: "https://picsum.photos/seed/babyshower/400/600",
    display_order: 1, is_active: true,
  },
  {
    id: "t-inv-bs2", category_id: "invitations", subcategory_id: "inv-baby",
    title: "Little One Coming", color_accent: "#F1948A",
    front_image_url: "https://picsum.photos/seed/newborn/400/600",
    display_order: 2, is_active: true,
  },
  // ── Invitations › Graduation ───────────────────────────────────────────────
  {
    id: "t-inv-g1", category_id: "invitations", subcategory_id: "inv-graduation",
    title: "Cap & Gown", color_accent: "#2E86AB",
    front_image_url: "https://picsum.photos/seed/graduation/400/600",
    display_order: 1, is_active: true,
  },
  {
    id: "t-inv-g2", category_id: "invitations", subcategory_id: "inv-graduation",
    title: "Future is Bright", color_accent: "#F39C12",
    front_image_url: "https://picsum.photos/seed/graduationcap/400/600",
    display_order: 2, is_active: true,
  },
  // ── Invitations › Teacher's Week ──────────────────────────────────────────
  {
    id: "t-inv-t1", category_id: "invitations", subcategory_id: "inv-teacher",
    title: "Teacher Celebration", color_accent: "#E74C3C",
    front_image_url: "https://picsum.photos/seed/teacherweek/400/600",
    display_order: 1, is_active: true,
  },
  {
    id: "t-inv-t2", category_id: "invitations", subcategory_id: "inv-teacher",
    title: "Shaping Tomorrow", color_accent: "#27AE60",
    front_image_url: "https://picsum.photos/seed/teacherappreciation/400/600",
    display_order: 2, is_active: true,
  },

  // ── Vibes › No Cap ────────────────────────────────────────────────────────
  {
    id: "t-v-1", category_id: "vibes", subcategory_id: "no-cap",
    title: "No Cap, You're It", color_accent: "#FF1493",
    front_image_url: "https://picsum.photos/seed/neon1/400/600",
    display_order: 1, is_active: true,
  },
  {
    id: "t-v-2", category_id: "vibes", subcategory_id: "no-cap",
    title: "Facts Only 💯", color_accent: "#FF6B00",
    front_image_url: "https://picsum.photos/seed/neon2/400/600",
    display_order: 2, is_active: true,
  },
  // ── Vibes › It's Giving ───────────────────────────────────────────────────
  {
    id: "t-v-3", category_id: "vibes", subcategory_id: "its-giving",
    title: "It's Giving Love", color_accent: "#BF00FF",
    front_image_url: "https://picsum.photos/seed/purple1/400/600",
    display_order: 1, is_active: true,
  },
  {
    id: "t-v-4", category_id: "vibes", subcategory_id: "its-giving",
    title: "Serving Looks 💅", color_accent: "#FF1493",
    front_image_url: "https://picsum.photos/seed/glam1/400/600",
    display_order: 2, is_active: true,
  },
  // ── Vibes › Lowkey ────────────────────────────────────────────────────────
  {
    id: "t-v-5", category_id: "vibes", subcategory_id: "lowkey",
    title: "Lowkey Obsessed", color_accent: "#00CFFF",
    front_image_url: "https://picsum.photos/seed/cool1/400/600",
    display_order: 1, is_active: true,
  },
  {
    id: "t-v-6", category_id: "vibes", subcategory_id: "lowkey",
    title: "Quietly Iconic 🤫", color_accent: "#7B2FBE",
    front_image_url: "https://picsum.photos/seed/moody1/400/600",
    display_order: 2, is_active: true,
  },
  // ── Vibes › Main Character ────────────────────────────────────────────────
  {
    id: "t-v-7", category_id: "vibes", subcategory_id: "main-character",
    title: "Main Character Era", color_accent: "#FFD700",
    front_image_url: "https://picsum.photos/seed/star1/400/600",
    display_order: 1, is_active: true,
  },
  {
    id: "t-v-8", category_id: "vibes", subcategory_id: "main-character",
    title: "That Girl / That Guy", color_accent: "#FF1493",
    front_image_url: "https://picsum.photos/seed/icon1/400/600",
    display_order: 2, is_active: true,
  },

  // ── Vibes › No Cap ────────────────────────────────────────────────────────
  {
    id: "t-v-1", category_id: "vibes", subcategory_id: "no-cap",
    title: "No Cap, You're It", color_accent: "#FF1493",
    front_image_url: "https://picsum.photos/seed/neon1/400/600",
    display_order: 1, is_active: true,
  },
  {
    id: "t-v-2", category_id: "vibes", subcategory_id: "no-cap",
    title: "Facts Only 💯", color_accent: "#FF6B00",
    front_image_url: "https://picsum.photos/seed/neon2/400/600",
    display_order: 2, is_active: true,
  },
  // ── Vibes › It's Giving ───────────────────────────────────────────────────
  {
    id: "t-v-3", category_id: "vibes", subcategory_id: "its-giving",
    title: "It's Giving Love", color_accent: "#BF00FF",
    front_image_url: "https://picsum.photos/seed/purple1/400/600",
    display_order: 1, is_active: true,
  },
  {
    id: "t-v-4", category_id: "vibes", subcategory_id: "its-giving",
    title: "Serving Looks 💅", color_accent: "#FF1493",
    front_image_url: "https://picsum.photos/seed/glam1/400/600",
    display_order: 2, is_active: true,
  },
  // ── Vibes › Lowkey ────────────────────────────────────────────────────────
  {
    id: "t-v-5", category_id: "vibes", subcategory_id: "lowkey",
    title: "Lowkey Obsessed", color_accent: "#00CFFF",
    front_image_url: "https://picsum.photos/seed/cool1/400/600",
    display_order: 1, is_active: true,
  },
  {
    id: "t-v-6", category_id: "vibes", subcategory_id: "lowkey",
    title: "Quietly Iconic 🤫", color_accent: "#7B2FBE",
    front_image_url: "https://picsum.photos/seed/moody1/400/600",
    display_order: 2, is_active: true,
  },
  // ── Vibes › Main Character ────────────────────────────────────────────────
  {
    id: "t-v-7", category_id: "vibes", subcategory_id: "main-character",
    title: "Main Character Era", color_accent: "#FFD700",
    front_image_url: "https://picsum.photos/seed/star1/400/600",
    display_order: 1, is_active: true,
  },
  {
    id: "t-v-8", category_id: "vibes", subcategory_id: "main-character",
    title: "That Girl / That Guy", color_accent: "#FF1493",
    front_image_url: "https://picsum.photos/seed/icon1/400/600",
    display_order: 2, is_active: true,
  },
];


export const TRENDING_IDS = ["t-v-1","t-v-3","t-r-f-1","t-b-1","t-v-7","t-mw-1","t-v-5","t-ty-1"];

export const REACTIONS = ["❤️", "😂", "🔥", "👏", "😍", "🥺"];
export const PRE_MADE_MESSAGES = ["Thank you!", "Love it!", "Made my day!", "So sweet! 😊", "You're the best!", "This is everything! 💕"];

export const GREETING_MESSAGES: Record<string, string[]> = {
  flowers:         ["These flowers are for you 🌹", "Just like these blooms, you brighten my world 🌸", "Sending you a garden of love 💐"],
  "miss-you":      ["Every moment without you feels incomplete 💌", "Counting the days until I see you again ✨", "Missing you more than words can say 💙"],
  "thinking-of-you": ["You crossed my mind and I smiled 😊", "Just wanted you to know I'm thinking of you 💭", "You're always on my mind 💫"],
  "good-night":    ["Sweet dreams, beautiful 🌙", "Sleep well, I'll be thinking of you ⭐", "Wishing you the softest night 🌛"],
  "good-morning":  ["Rise and shine! Hope your day is amazing ☀️", "Good morning! Today is going to be great 🌅", "Sending you sunshine to start your day 🌻"],
  motivation:      ["You've got this! Every step counts 💪", "Believe in yourself — I do! 🌟", "Chase your dreams fearlessly 🔥"],
  "weekend-vibes": ["Happy weekend! Make it a great one 🎉", "Enjoy every moment this weekend 😎", "Weekend mode: ON! Have the best time 🥳"],

  "thank-you":        ["Thank you from the bottom of my heart 🙏", "Your kindness means the world to me 💛", "I'm so grateful to have you in my life ✨"],
  "general-thanks":   ["Thank you so much! 🙏", "Your help made all the difference 💛", "Grateful beyond words ✨"],
  "thank-you-teacher":["Thank you for making learning a joy 🍎", "You've shaped who I am — thank you! 📚", "The best teacher deserves the best thanks 🌟"],
  "thank-you-friend": ["Thank you for always being there 💛", "Lucky to call you my friend 🤗", "Friends like you are rare gems 💎"],
  "thank-you-work":   ["Thank you for your professionalism and support 💼", "Your collaboration made this possible 🤝", "Grateful for the great teamwork 🙌"],
  "inv-birthday":     ["You're invited to celebrate! 🎂", "Join us for a birthday bash 🎉", "Let's make memories together 🎈"],
  "inv-wedding":      ["Please join us as we say 'I do' 💍", "Two hearts, one celebration — you're invited 💐", "Share in our joy on our special day 🥂"],
  "inv-baby":         ["Join us to welcome our little one 🍼", "A new star is arriving — celebrate with us ⭐", "Baby shower time! You're invited 👶"],
  "inv-graduation":   ["Join us to celebrate this milestone 🎓", "You're invited to our graduation party! 🏆", "The future is bright — let's celebrate 🌟"],
    "no-cap":         ["No cap, you literally mean everything to me 💯", "Facts: you\'re the best person I know 🧢", "Not even exaggerating — you\'re everything ✨"],
  "its-giving":     ["It\'s giving main character energy and I\'m here for it 💅", "The vibe you bring? Unmatched. Period. 🌟", "Bestie it\'s giving love and I\'m obsessed 💕"],
  "lowkey":         ["Lowkey you\'re my favourite person 🤫", "Not to be weird but you\'re lowkey everything 💫", "Quietly appreciating you every single day 🖤"],
  "main-character": ["You\'re literally in your main character era and we love to see it 🌟", "The universe wrote you as the lead. Obviously. ✨", "It\'s giving protagonist energy and I\'m your biggest fan 🎬"],
  "vibes":          ["Just vibing and thinking of you ✨", "The vibe check? You passed. Obviously. 💅", "You\'re literally that person everyone needs in their life 🌟"],
  "inv-teacher":      ["Join us to honour our amazing teachers 🍎", "Teacher Appreciation Week celebration — you're invited! 📚", "Help us say thank you to our educators 🌟"],
  birthday:        ["Wishing you all the happiness today and always! 🎂", "Hope your birthday is as amazing as you are 🎉", "Sending birthday love your way! 🎈"],
};
