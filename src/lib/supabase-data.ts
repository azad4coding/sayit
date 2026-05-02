/**
 * supabase-data.ts
 * Central data-fetching layer — replaces the hardcoded data.ts imports.
 * All functions use the Supabase client and return typed data.
 */

import { createClient } from "@/lib/supabase";

// ── Types matching Supabase schema ───────────────────────────────────────────
export type DBSubCategory = {
  id: string;
  category_id: string;
  name: string;
  slug: string;
  icon: string;
  display_order: number;
};

export type DBCategory = {
  id: string;
  name: string;
  slug: string;
  icon: string;
  gradient_from: string;
  gradient_to: string;
  display_order: number;
  is_hero: boolean;
  is_active: boolean;
  subcategories: DBSubCategory[];
};

export type DBTemplate = {
  id: string;
  category_id: string;
  subcategory_id: string | null;
  title: string;
  front_image_url: string;
  inside_image_url: string | null;
  color_accent: string;
  display_order: number;
  is_active: boolean;
};

// ── Fetch all active categories with subcategories ───────────────────────────
export async function getCategories(): Promise<DBCategory[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("*, subcategories(*)")
    .eq("is_active", true)
    .order("display_order");

  if (error) { console.error("getCategories:", error.message); return []; }
  return (data ?? []).map(c => ({
    ...c,
    subcategories: (c.subcategories ?? []).sort(
      (a: DBSubCategory, b: DBSubCategory) => a.display_order - b.display_order
    ),
  }));
}

// ── Fetch a single category by slug (with subcategories) ────────────────────
export async function getCategoryBySlug(slug: string): Promise<DBCategory | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("*, subcategories(*)")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();

  if (error) { console.error("getCategoryBySlug:", error.message); return null; }
  return {
    ...data,
    subcategories: (data.subcategories ?? []).sort(
      (a: DBSubCategory, b: DBSubCategory) => a.display_order - b.display_order
    ),
  };
}

// ── Fetch templates for a category ──────────────────────────────────────────
export async function getTemplatesByCategory(categoryId: string): Promise<DBTemplate[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("templates")
    .select("*")
    .eq("category_id", categoryId)
    .eq("is_active", true)
    .order("display_order");

  if (error) { console.error("getTemplatesByCategory:", error.message); return []; }
  return data ?? [];
}

// ── Fetch a single template by ID ────────────────────────────────────────────
export async function getTemplateById(id: string): Promise<DBTemplate | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("templates")
    .select("*")
    .eq("id", id)
    .single();

  if (error) { console.error("getTemplateById:", error.message); return null; }
  return data;
}

// ── Fetch a single category by ID (with subcategories) ─────────────────────
export async function getCategoryById(id: string): Promise<DBCategory | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("*, subcategories(*)")
    .eq("id", id)
    .eq("is_active", true)
    .single();

  if (error) { console.error("getCategoryById:", error.message); return null; }
  return {
    ...data,
    subcategories: (data.subcategories ?? []).sort(
      (a: DBSubCategory, b: DBSubCategory) => a.display_order - b.display_order
    ),
  };
}

// ── Fetch trending templates (first N by display_order) ──────────────────────
export async function getTrendingTemplates(limit = 8): Promise<DBTemplate[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("templates")
    .select("*")
    .eq("is_active", true)
    .order("display_order")
    .limit(limit);

  if (error) { console.error("getTrendingTemplates:", error.message); return []; }
  return data ?? [];
}
