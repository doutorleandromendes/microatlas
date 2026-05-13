import { createClient } from "@supabase/supabase-js";

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey  = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY não definidas. " +
    "Crie um arquivo .env na raiz do projeto."
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey);

// ─── Pathogens ────────────────────────────────────────────────────────────────

export async function fetchPathogens() {
  const { data, error } = await supabase
    .from("pathogens")
    .select("*")
    .order("name");
  if (error) throw error;
  return data;
}

export async function insertPathogen({ name, commonName, category, description }) {
  const { data, error } = await supabase
    .from("pathogens")
    .insert({ name, common_name: commonName, category, description })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ─── Entries ──────────────────────────────────────────────────────────────────

export async function fetchEntries(pathogenId) {
  const { data, error } = await supabase
    .from("entries")
    .select("*")
    .eq("pathogen_id", pathogenId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function insertEntry({ pathogenId, method, material, magnification, date, notes, imageUrl }) {
  const { data, error } = await supabase
    .from("entries")
    .insert({
      pathogen_id:   pathogenId,
      method,
      material,
      magnification,
      date,
      notes,
      image_url: imageUrl,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateEntry(id, { method, material, magnification, date, notes, imageUrl }) {
  const { data, error } = await supabase
    .from("entries")
    .update({ method, material, magnification, date, notes, image_url: imageUrl })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteEntry(id) {
  const { error } = await supabase.from("entries").delete().eq("id", id);
  if (error) throw error;
}

// ─── Storage ──────────────────────────────────────────────────────────────────

export async function deleteImage(imageUrl) {
  // Extract storage path from public URL
  // URL format: .../storage/v1/object/public/microscopy-images/PATH
  const marker = "/microscopy-images/";
  const idx = imageUrl.indexOf(marker);
  if (idx === -1) return; // not a storage URL, skip
  const path = imageUrl.slice(idx + marker.length);
  const { error } = await supabase.storage.from("microscopy-images").remove([path]);
  if (error) console.warn("Storage delete failed (non-critical):", error.message);
}

export async function uploadImage(pathogenId, file) {
  const ext  = file.name.split(".").pop();
  const path = `${pathogenId}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from("microscopy-images")
    .upload(path, file, { cacheControl: "3600", upsert: false });

  if (error) throw error;

  const { data } = supabase.storage
    .from("microscopy-images")
    .getPublicUrl(path);

  return data.publicUrl;
}
