import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from './supabaseClient';

const CategoryContext = createContext(null);

// Supabase / Postgres error → message an admin can act on. The category
// trigger's messages are written for people, so they pass through.
function describeCategoryError(error, fallback) {
  if (!error) return fallback;
  if (error.code === '23505') return 'A category with this id already exists.';
  if (['22023', '23503', '42501'].includes(error.code)) return error.message;
  return fallback;
}

function mapCategoryRow(row) {
  return {
    id: row.id,
    name: row.name || row.id,
    tagline: row.tagline || '',
    image: row.image || '',
    sortOrder: Number(row.sort_order) || 0,
  };
}

// Categories come from public.categories (see gearrent_categories_update.sql).
// `select('*')` keeps the list working even before that migration has added
// the tagline / image / sort_order columns.
export function CategoryProvider({ children }) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  const refreshCategories = useCallback(async () => {
    const { data, error } = await supabase.from('categories').select('*');
    if (error) {
      console.error('Failed to load categories', error);
    } else {
      setCategories((data || [])
        .map(mapCategoryRow)
        .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name)));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refreshCategories();
  }, [refreshCategories]);

  // Admin only (enforced by RLS). Returns { ok, error }.
  const saveCategory = useCallback(async (category, { isNew = false } = {}) => {
    const row = {
      name: category.name,
      tagline: category.tagline || null,
      image: category.image || null,
      sort_order: Number(category.sortOrder) || 0,
    };
    const { error } = isNew
      ? await supabase.from('categories').insert({ id: category.id, ...row })
      : await supabase.from('categories').update(row).eq('id', category.id);
    if (error) {
      console.error('saveCategory failed', error);
      return { ok: false, error: describeCategoryError(error, 'The category could not be saved.') };
    }
    await refreshCategories();
    return { ok: true, error: null };
  }, [refreshCategories]);

  const deleteCategory = useCallback(async (id) => {
    const { error } = await supabase.from('categories').delete().eq('id', id);
    if (error) {
      console.error('deleteCategory failed', error);
      return { ok: false, error: describeCategoryError(error, 'The category could not be deleted.') };
    }
    await refreshCategories();
    return { ok: true, error: null };
  }, [refreshCategories]);

  const value = useMemo(() => ({
    categories,
    loading,
    refreshCategories,
    saveCategory,
    deleteCategory,
    getCategoryName: (id, fallback = 'Gear') => categories.find((category) => category.id === id)?.name || fallback,
  }), [categories, loading, refreshCategories, saveCategory, deleteCategory]);

  return <CategoryContext.Provider value={value}>{children}</CategoryContext.Provider>;
}

export function useCategories() {
  const context = useContext(CategoryContext);
  if (!context) throw new Error('useCategories must be used within CategoryProvider');
  return context;
}
