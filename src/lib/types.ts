export type Category = {
  id: string;
  name: string;
  slug: string;
  icon: string;
  gradient_from: string;
  gradient_to: string;
  display_order: number;
  is_hero: boolean;       // Romance and Paw Moments are hero cards
  is_active: boolean;
  template_count?: number;
  subcategories?: SubCategory[];
};

export type SubCategory = {
  id: string;
  category_id: string;
  name: string;
  slug: string;
  icon: string;
  display_order: number;
};

export type Template = {
  id: string;
  category_id: string;
  subcategory_id?: string;
  title: string;
  front_image_url: string;
  inside_image_url?: string;
  color_accent: string;
  display_order: number;
  is_active: boolean;
};

export type Profile = {
  id: string;
  full_name: string;
  phone?: string;
  avatar_url?: string;
  created_at: string;
};

export type SentCard = {
  id: string;
  sender_id: string;
  recipient_phone: string;
  recipient_id?: string;
  template_id: string;
  message: string;
  short_code: string;
  viewed_at?: string;
  created_at: string;
  template?: Template;
  sender?: Profile;
};

export type Reaction = {
  id: string;
  card_id: string;
  reactor_id: string;
  emoji: string;
  pre_made_message?: string;
  created_at: string;
};

export type HistoryContact = {
  profile: Profile;
  last_card: SentCard;
  unread_count: number;
};
