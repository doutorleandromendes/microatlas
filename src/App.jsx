import { useState, useEffect, useRef, useCallback } from "react";
import {
  Search, Plus, X, Camera, Upload, ChevronLeft,
  Tag, Calendar, Microscope, ZoomIn, AlertCircle, Loader,
} from "lucide-react";
import {
  supabase,
  fetchPathogens, insertPathogen,
  fetchEntries,   insertEntry,
  uploadImage,
} from "./lib/supabase.js";

// ─── Config ───────────────────────────────────────────────────────────────────

const CAT = {
  fungi:    { label: "Fungi",     color: "#34d399", bg: "rgba(52,211,153,0.10)",  border: "rgba(52,211,153,0.25)" },
  bacteria: { label: "Bactéria", color: "#fbbf24", bg: "rgba(251,191,36,0.10)",  border: "rgba(251,191,36,0.25)" },
  parasite: { label: "Parasito", color: "#a78bfa", bg: "rgba(167,139,250,0.10)", border: "rgba(167,139,250,0.25)" },
  virus:    { label: "Vírus",    color: "#f87171", bg: "rgba(248,113,113,0.10)", border: "rgba(248,113,113,0.25)" },
  other:    { label: "Outro",    color: "#94a3b8", bg: "rgba(148,163,184,0.10)", border: "rgba(148,163,184,0.25)" },
};

const METHOD_COLORS = {
  "GMS":                   "#34d399",
  "Giemsa":                "#818cf8",
  "ZN/Kinyoun":            "#f87171",
  "H&E":                   "#f472b6",
  "Wright-Giemsa":         "#a78bfa",
  "PAS":                   "#fb923c",
  "Gram":                  "#fbbf24",
  "Tinta da China":        "#94a3b8",
  "Calcoflúor branco":     "#7dd3fc",
  "Trichrome de Wheatley": "#c084fc",
  "Leishmann":             "#60a5fa",
  "Microscopia direta":    "#f0abfc",
};
const mCol = (m) => METHOD_COLORS[m] || "#c8a55e";

const ALL_METHODS = [
  "GMS", "Giemsa", "ZN/Kinyoun", "H&E", "Wright-Giemsa", "PAS", "Gram",
  "Trichrome de Wheatley", "Leishmann", "Tinta da China", "Calcoflúor branco",
  "Microscopia direta", "Cultura", "Outro",
];
const ALL_MATERIALS = [
  "Sangue periférico", "Biópsia cutânea", "LCR", "Escarro", "BAL",
  "Medula óssea", "Tecido hepático", "Tecido esplênico", "Swab",
  "Urina", "Fezes", "Secreção", "Aspirado", "Outro",
];
const ALL_MAGS = ["4x", "10x", "20x", "40x", "40x oil", "60x oil", "100x oil"];

// ─── Shared styles ────────────────────────────────────────────────────────────

const iS = {
  width: "100%", padding: "9px 12px",
  background: "#0a1018", border: "1px solid rgba(255,255,255,0.09)",
  borderRadius: "4px", color: "#e2e8f0", fontSize: "13px",
  fontFamily: "'Courier New',monospace", outline: "none", boxSizing: "border-box",
};
const lS = {
  display: "block", fontSize: "10px", color: "#5a7090",
  marginBottom: "5px", letterSpacing: "0.1em", textTransform: "uppercase",
  fontFamily: "'Courier New',monospace",
};
const btnPrimary = {
  background: "rgba(200,165,94,0.1)", border: "1px solid rgba(200,165,94,0.3)",
  color: "#c8a55e", borderRadius: "4px", padding: "10px", cursor: "pointer",
  fontSize: "11px", fontFamily: "'Courier New',monospace", letterSpacing: "0.1em",
  width: "100%",
};

// ─── SVG placeholder ──────────────────────────────────────────────────────────

function MicroPlaceholder({ method = "GMS", seed = 42 }) {
  const col = mCol(method);
  const pts = Array.from({ length: 14 }, (_, i) => ({
    cx: 10 + ((seed * 37 * (i + 1)) % 180),
    cy: 8  + ((seed * 53 * (i + 1)) % 134),
    r:  2  + ((seed * 17 * (i + 1)) % 9),
    op: 0.12 + (i % 4) * 0.09,
  }));
  return (
    <svg viewBox="0 0 200 150" xmlns="http://www.w3.org/2000/svg"
      style={{ width: "100%", height: "100%", display: "block" }}>
      <rect width="200" height="150" fill="#070c12" />
      {pts.map((p, i) => <circle key={i} cx={p.cx} cy={p.cy} r={p.r} fill={col} opacity={p.op} />)}
      {pts.slice(0, 5).map((p, i) => (
        <circle key={`o${i}`} cx={p.cx} cy={p.cy} r={p.r + 5}
          fill="none" stroke={col} strokeWidth="0.5" opacity={p.op * 0.5} />
      ))}
      <text x="100" y="145" textAnchor="middle" fill={col} opacity="0.4"
        fontSize="8" fontFamily="'Courier New',monospace" letterSpacing="1.5">
        {method}
      </text>
    </svg>
  );
}

// ─── Small components ─────────────────────────────────────────────────────────

function CatBadge({ cat }) {
  const c = CAT[cat] || CAT.other;
  return (
    <span style={{
      display: "inline-block", padding: "2px 8px", borderRadius: "2px",
      fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase",
      fontFamily: "'Courier New',monospace",
      color: c.color, background: c.bg, border: `1px solid ${c.border}`,
    }}>{c.label}</span>
  );
}

function MethodPill({ method, small }) {
  const col = mCol(method);
  return (
    <span style={{
      display: "inline-block",
      padding: small ? "1px 5px" : "3px 9px",
      borderRadius: "2px", fontSize: small ? "8px" : "10px",
      letterSpacing: "0.06em", fontFamily: "'Courier New',monospace",
      color: col, background: `${col}15`, border: `1px solid ${col}35`,
    }}>{method}</span>
  );
}

function Spinner() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center",
      padding: "60px 20px", color: "#4a6080" }}>
      <Loader size={20} style={{ animation: "spin 1s linear infinite" }} />
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function ErrorMsg({ msg }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "8px",
      padding: "12px 16px", background: "rgba(248,113,113,0.08)",
      border: "1px solid rgba(248,113,113,0.2)", borderRadius: "4px",
      color: "#f87171", fontSize: "12px", fontFamily: "'Courier New',monospace",
      margin: "16px 0",
    }}>
      <AlertCircle size={14} /> {msg}
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }) {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 500,
      background: "rgba(0,0,0,0.75)", backdropFilter: "blur(3px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: "16px",
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: "#0f1621", border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: "8px", width: "100%", maxWidth: "500px",
        maxHeight: "90vh", overflowY: "auto",
        boxShadow: "0 24px 64px rgba(0,0,0,0.7)",
      }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "18px 22px 14px", borderBottom: "1px solid rgba(255,255,255,0.05)",
        }}>
          <h3 style={{ margin: 0, fontSize: "14px", color: "#c8c5be",
            fontFamily: "Georgia,serif", fontWeight: "normal" }}>{title}</h3>
          <button onClick={onClose} style={{
            background: "none", border: "none", color: "#5a7090",
            cursor: "pointer", padding: "4px", display: "flex", borderRadius: "4px",
          }}><X size={16} /></button>
        </div>
        <div style={{ padding: "20px 22px 24px" }}>{children}</div>
      </div>
    </div>
  );
}

// ─── Add Pathogen Modal ───────────────────────────────────────────────────────

function AddPathogenModal({ onClose, onSaved }) {
  const [form, setForm] = useState({ name: "", commonName: "", category: "fungi", description: "" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true); setErr(null);
    try {
      const created = await insertPathogen(form);
      onSaved({ ...created, entries: [] });
      onClose();
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Novo verbete · Patógeno" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        {err && <ErrorMsg msg={err} />}
        <div>
          <label style={lS}>Nome científico *</label>
          <input value={form.name} onChange={set("name")}
            placeholder="ex: Aspergillus fumigatus"
            style={{ ...iS, fontStyle: "italic" }} />
        </div>
        <div>
          <label style={lS}>Nome da doença / comum</label>
          <input value={form.commonName} onChange={set("commonName")}
            placeholder="ex: Aspergilose invasiva" style={iS} />
        </div>
        <div>
          <label style={lS}>Categoria *</label>
          <select value={form.category} onChange={set("category")} style={{ ...iS, cursor: "pointer" }}>
            {Object.entries(CAT).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <div>
          <label style={lS}>Descrição</label>
          <textarea value={form.description} onChange={set("description")} rows={3}
            placeholder="Características gerais, relevância clínica, epidemiologia…"
            style={{ ...iS, resize: "vertical", lineHeight: 1.65 }} />
        </div>
        <button onClick={handleSave} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.6 : 1 }}>
          {saving ? "SALVANDO…" : "CRIAR VERBETE"}
        </button>
      </div>
    </Modal>
  );
}

// ─── Add Entry Modal ──────────────────────────────────────────────────────────

function AddEntryModal({ pathogen, onClose, onSaved }) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    method: "", material: "", magnification: "100x oil", date: today, notes: "",
  });
  const [file, setFile]     = useState(null);
  const [preview, setPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState(null);
  const fileRef = useRef();
  const camRef  = useRef();
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const handleFile = e => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    const r = new FileReader();
    r.onload = ev => setPreview(ev.target.result);
    r.readAsDataURL(f);
  };

  const handleSave = async () => {
    if (!form.method || !form.material) {
      setErr("Coloração/método e material são obrigatórios."); return;
    }
    setSaving(true); setErr(null);
    try {
      let imageUrl = null;
      if (file) {
        imageUrl = await uploadImage(pathogen.id, file);
      }
      const created = await insertEntry({ pathogenId: pathogen.id, ...form, imageUrl });
      // Normalize snake_case → camelCase for local state
      onSaved({
        ...created,
        imgUrl: created.image_url,
        commonName: created.common_name,
      });
      onClose();
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={`Novo registro · ${pathogen.name}`} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        {err && <ErrorMsg msg={err} />}

        {/* Image */}
        <div>
          <label style={lS}>Fotomicrografia</label>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: "none" }} />
          <input ref={camRef}  type="file" accept="image/*" capture="environment" onChange={handleFile} style={{ display: "none" }} />
          {preview ? (
            <div style={{ position: "relative" }}>
              <img src={preview} alt="" style={{ width: "100%", height: "150px", objectFit: "cover", borderRadius: "4px" }} />
              <button onClick={() => { setFile(null); setPreview(null); }} style={{
                position: "absolute", top: "8px", right: "8px",
                background: "rgba(0,0,0,0.65)", border: "none", borderRadius: "50%",
                color: "#e2e8f0", cursor: "pointer",
                width: "26px", height: "26px", display: "flex",
                alignItems: "center", justifyContent: "center",
              }}><X size={13} /></button>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              {[
                { icon: <Camera size={15} />, label: "Câmera",  ref: camRef },
                { icon: <Upload size={15} />, label: "Arquivo", ref: fileRef },
              ].map(b => (
                <button key={b.label} onClick={() => b.ref.current.click()} style={{
                  padding: "11px", background: "rgba(255,255,255,0.02)",
                  border: "1px dashed rgba(255,255,255,0.1)", borderRadius: "4px",
                  color: "#5a7090", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "7px",
                  fontSize: "11px", fontFamily: "'Courier New',monospace",
                }}>{b.icon} {b.label}</button>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
          <div>
            <label style={lS}>Coloração / Método *</label>
            <select value={form.method} onChange={set("method")} style={{ ...iS, cursor: "pointer" }}>
              <option value="">Selecionar…</option>
              {ALL_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label style={lS}>Material *</label>
            <select value={form.material} onChange={set("material")} style={{ ...iS, cursor: "pointer" }}>
              <option value="">Selecionar…</option>
              {ALL_MATERIALS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
          <div>
            <label style={lS}>Objetiva</label>
            <select value={form.magnification} onChange={set("magnification")} style={{ ...iS, cursor: "pointer" }}>
              {ALL_MAGS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label style={lS}>Data</label>
            <input type="date" value={form.date} onChange={set("date")} style={iS} />
          </div>
        </div>

        <div>
          <label style={lS}>Observações morfológicas</label>
          <textarea value={form.notes} onChange={set("notes")} rows={4}
            placeholder="Características morfológicas, achados relevantes, contexto clínico…"
            style={{ ...iS, resize: "vertical", lineHeight: 1.65 }} />
        </div>

        <button onClick={handleSave} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.6 : 1 }}>
          {saving ? (file ? "ENVIANDO IMAGEM…" : "SALVANDO…") : "SALVAR REGISTRO"}
        </button>
      </div>
    </Modal>
  );
}

// ─── Entry card ───────────────────────────────────────────────────────────────

function EntryCard({ entry, onZoom }) {
  const seed = (entry.id || "x").charCodeAt(0) + ((entry.id || "x").charCodeAt(1) || 0);
  const imgUrl = entry.image_url || entry.imgUrl;
  return (
    <div style={{
      background: "#0d1521", border: "1px solid rgba(255,255,255,0.055)",
      borderRadius: "6px", overflow: "hidden",
    }}>
      <div style={{ height: "155px", background: "#060c12", position: "relative",
        cursor: imgUrl ? "zoom-in" : "default" }}
        onClick={() => imgUrl && onZoom(entry)}>
        {imgUrl
          ? <img src={imgUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <MicroPlaceholder method={entry.method} seed={seed} />
        }
        <div style={{ position: "absolute", top: "8px", left: "8px" }}>
          <MethodPill method={entry.method} small />
        </div>
      </div>
      <div style={{ padding: "12px 14px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginBottom: "9px" }}>
          {[
            { icon: <Tag size={9} />, val: entry.material },
            { icon: <Microscope size={9} />, val: entry.magnification },
            { icon: <Calendar size={9} />, val: entry.date },
          ].filter(x => x.val).map((x, i) => (
            <span key={i} style={{
              display: "flex", alignItems: "center", gap: "3px",
              fontSize: "10px", color: "#5a7090", fontFamily: "'Courier New',monospace",
            }}>{x.icon} {x.val}</span>
          ))}
        </div>
        {entry.notes && (
          <p style={{
            margin: 0, fontSize: "11.5px", color: "#8a9ab0", lineHeight: 1.65,
            borderTop: "1px solid rgba(255,255,255,0.04)", paddingTop: "9px",
            fontFamily: "Georgia,serif",
          }}>{entry.notes}</p>
        )}
      </div>
    </div>
  );
}

// ─── Pathogen card ────────────────────────────────────────────────────────────

function PathogenCard({ p, entryCount, methods, onClick }) {
  const seed = (p.id || "0").charCodeAt(0) * 13;
  return (
    <div onClick={onClick} style={{
      background: "#0d1521", border: "1px solid rgba(255,255,255,0.055)",
      borderRadius: "6px", overflow: "hidden", cursor: "pointer",
      transition: "border-color 0.2s, transform 0.15s",
    }}
    onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(200,165,94,0.2)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
    onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.055)"; e.currentTarget.style.transform = "translateY(0)"; }}>
      <div style={{ height: "120px", background: "#060c12", position: "relative", overflow: "hidden" }}>
        <MicroPlaceholder method={methods[0] || "GMS"} seed={seed} />
        <div style={{ position: "absolute", top: "8px", right: "8px" }}>
          <CatBadge cat={p.category} />
        </div>
        <div style={{
          position: "absolute", bottom: "7px", left: "8px",
          background: "rgba(0,0,0,0.65)", borderRadius: "2px",
          padding: "2px 7px", fontSize: "9px", color: "#7a8ea8",
          fontFamily: "'Courier New',monospace",
        }}>
          {entryCount} {entryCount === 1 ? "registro" : "registros"}
        </div>
      </div>
      <div style={{ padding: "11px 13px" }}>
        <p style={{ margin: "0 0 2px", fontSize: "13px", fontStyle: "italic",
          color: "#dde4f0", fontFamily: "Georgia,serif", lineHeight: 1.3 }}>{p.name}</p>
        <p style={{ margin: "0 0 9px", fontSize: "10px", color: "#5a7090",
          fontFamily: "'Courier New',monospace" }}>{p.common_name}</p>
        <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
          {methods.slice(0, 3).map(m => <MethodPill key={m} method={m} small />)}
          {methods.length > 3 && (
            <span style={{ fontSize: "8px", color: "#5a7090",
              fontFamily: "'Courier New',monospace", alignSelf: "center" }}>
              +{methods.length - 3}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Home view ────────────────────────────────────────────────────────────────

function HomeView({ pathogens, entriesMap, onOpen }) {
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState("all");

  const shown = pathogens.filter(p => {
    const q = search.toLowerCase();
    const matchQ = !q || p.name.toLowerCase().includes(q) || (p.common_name || "").toLowerCase().includes(q);
    return matchQ && (cat === "all" || p.category === cat);
  });

  const totalEntries = Object.values(entriesMap).reduce((a, e) => a + e.length, 0);

  return (
    <div style={{ maxWidth: "960px", margin: "0 auto", padding: "28px 20px" }}>
      {/* Search */}
      <div style={{ position: "relative", marginBottom: "18px" }}>
        <Search size={15} color="#4a6080" style={{ position: "absolute", left: "13px", top: "50%", transform: "translateY(-50%)" }} />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar patógeno, doença…"
          style={{ ...iS, paddingLeft: "38px", fontSize: "13.5px",
            fontFamily: "Georgia,serif", border: "1px solid rgba(255,255,255,0.07)" }} />
      </div>

      {/* Category pills */}
      <div style={{ display: "flex", gap: "7px", flexWrap: "wrap", marginBottom: "20px" }}>
        {[["all", "Todos"], ...Object.entries(CAT).map(([k, v]) => [k, v.label])].map(([k, label]) => {
          const c = CAT[k];
          const active = cat === k;
          return (
            <button key={k} onClick={() => setCat(k)} style={{
              padding: "4px 12px", borderRadius: "2px", cursor: "pointer",
              fontSize: "10px", letterSpacing: "0.08em", textTransform: "uppercase",
              fontFamily: "'Courier New',monospace",
              background: active ? (c?.bg || "rgba(200,165,94,0.12)") : "transparent",
              color: active ? (c?.color || "#c8a55e") : "#4a6080",
              border: active ? `1px solid ${c?.border || "rgba(200,165,94,0.28)"}` : "1px solid rgba(255,255,255,0.06)",
              transition: "all 0.12s",
            }}>{label}</button>
          );
        })}
      </div>

      {/* Stats */}
      <div style={{
        display: "flex", gap: "20px", padding: "10px 14px", marginBottom: "22px",
        background: "rgba(255,255,255,0.02)", borderRadius: "4px",
        border: "1px solid rgba(255,255,255,0.04)",
      }}>
        {[
          ["Patógenos", pathogens.length],
          ["Registros", totalEntries],
          ["Fungos", pathogens.filter(p => p.category === "fungi").length],
          ["Parasitos", pathogens.filter(p => p.category === "parasite").length],
        ].map(([label, val]) => (
          <div key={label}>
            <span style={{ fontSize: "18px", color: "#c8a55e", fontFamily: "'Courier New',monospace" }}>{val}</span>
            <span style={{ fontSize: "10px", color: "#4a6080", fontFamily: "'Courier New',monospace", marginLeft: "5px" }}>{label.toLowerCase()}</span>
          </div>
        ))}
      </div>

      {/* Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: "14px" }}>
        {shown.map(p => {
          const entries = entriesMap[p.id] || [];
          const methods = [...new Set(entries.map(e => e.method))];
          return (
            <PathogenCard key={p.id} p={p} entryCount={entries.length}
              methods={methods} onClick={() => onOpen(p.id)} />
          );
        })}
        {shown.length === 0 && (
          <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "56px 20px", color: "#2a3a50" }}>
            <Microscope size={36} strokeWidth={1} style={{ marginBottom: "10px", opacity: 0.4 }} />
            <p style={{ fontFamily: "'Courier New',monospace", fontSize: "12px" }}>Nenhum resultado</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Pathogen detail view ─────────────────────────────────────────────────────

function PathogenView({ pathogen, entries, loading, onAddEntry }) {
  const [mFilter, setMFilter] = useState("all");
  const [lightbox, setLightbox] = useState(null);
  const methods = [...new Set(entries.map(e => e.method))];
  const shown = entries.filter(e => mFilter === "all" || e.method === mFilter);

  return (
    <div style={{ maxWidth: "960px", margin: "0 auto", padding: "28px 20px" }}>
      {/* Header */}
      <div style={{
        background: "#0d1521", border: "1px solid rgba(255,255,255,0.055)",
        borderRadius: "6px", padding: "22px", marginBottom: "20px",
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
          <div>
            <div style={{ marginBottom: "8px" }}><CatBadge cat={pathogen.category} /></div>
            <h1 style={{ margin: "0 0 3px", fontSize: "22px", fontStyle: "italic",
              fontWeight: "normal", color: "#e0e8f5", fontFamily: "Georgia,serif" }}>
              {pathogen.name}
            </h1>
            <p style={{ margin: "0 0 12px", fontSize: "11px", color: "#4a6080",
              fontFamily: "'Courier New',monospace" }}>{pathogen.common_name}</p>
            <p style={{ margin: 0, fontSize: "13px", color: "#7a8ea8", lineHeight: 1.7,
              maxWidth: "580px", fontFamily: "Georgia,serif" }}>{pathogen.description}</p>
          </div>
          <div style={{
            background: "rgba(255,255,255,0.02)", borderRadius: "4px",
            padding: "12px 18px", textAlign: "center", border: "1px solid rgba(255,255,255,0.04)",
          }}>
            <div style={{ fontSize: "26px", color: "#c8a55e", fontFamily: "'Courier New',monospace" }}>
              {entries.length}
            </div>
            <div style={{ fontSize: "9px", color: "#4a6080", fontFamily: "'Courier New',monospace", letterSpacing: "0.08em" }}>
              REGISTROS
            </div>
          </div>
        </div>
      </div>

      {/* Method filter */}
      {methods.length > 1 && (
        <div style={{ display: "flex", gap: "7px", flexWrap: "wrap", marginBottom: "18px" }}>
          {["all", ...methods].map(m => {
            const col = m === "all" ? "#c8a55e" : mCol(m);
            const active = mFilter === m;
            return (
              <button key={m} onClick={() => setMFilter(m)} style={{
                padding: "3px 11px", borderRadius: "2px", cursor: "pointer",
                fontSize: "10px", letterSpacing: "0.06em", fontFamily: "'Courier New',monospace",
                background: active ? `${col}15` : "transparent",
                color: active ? col : "#4a6080",
                border: active ? `1px solid ${col}40` : "1px solid rgba(255,255,255,0.06)",
                transition: "all 0.12s",
              }}>{m === "all" ? "Todos" : m}</button>
            );
          })}
        </div>
      )}

      {loading
        ? <Spinner />
        : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(270px,1fr))", gap: "14px" }}>
            {shown.map(e => <EntryCard key={e.id} entry={e} onZoom={setLightbox} />)}
            {shown.length === 0 && (
              <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "48px 20px", color: "#2a3a50" }}>
                <p style={{ fontFamily: "'Courier New',monospace", fontSize: "12px" }}>
                  {entries.length === 0 ? "Nenhum registro ainda — clique em + REGISTRO" : "Sem registros para esta coloração"}
                </p>
              </div>
            )}
          </div>
        )
      }

      {/* Lightbox */}
      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{
          position: "fixed", inset: 0, zIndex: 800,
          background: "rgba(0,0,0,0.92)", display: "flex",
          alignItems: "center", justifyContent: "center", cursor: "zoom-out",
        }}>
          <img src={lightbox.image_url || lightbox.imgUrl} alt="" style={{
            maxWidth: "90vw", maxHeight: "85vh", objectFit: "contain", borderRadius: "4px",
          }} />
          <div style={{
            position: "absolute", bottom: "20px", left: "50%", transform: "translateX(-50%)",
            background: "rgba(0,0,0,0.7)", padding: "7px 16px", borderRadius: "3px",
            color: "#7a8ea8", fontSize: "11px", fontFamily: "'Courier New',monospace",
            textAlign: "center", whiteSpace: "nowrap",
          }}>
            {lightbox.method} · {lightbox.material}
            {lightbox.magnification ? ` · ${lightbox.magnification}` : ""}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Root App ─────────────────────────────────────────────────────────────────

export default function App() {
  // State
  const [pathogens, setPathogens] = useState([]);
  const [entriesMap, setEntriesMap] = useState({});    // { pathogenId: entry[] }
  const [loading, setLoading] = useState(true);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [globalErr, setGlobalErr] = useState(null);

  const [view, setView]           = useState("home");  // "home" | "pathogen"
  const [selectedId, setSelectedId] = useState(null);
  const [showAddP, setShowAddP]   = useState(false);
  const [showAddE, setShowAddE]   = useState(false);

  const selected = pathogens.find(p => p.id === selectedId);

  // ── Initial load ─────────────────────────────────────────────────────────
  useEffect(() => {
    fetchPathogens()
      .then(data => setPathogens(data))
      .catch(e => setGlobalErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  // ── Load entries when opening a pathogen ──────────────────────────────────
  const openPathogen = useCallback(async (id) => {
    setSelectedId(id);
    setView("pathogen");
    if (entriesMap[id]) return;         // already loaded
    setLoadingEntries(true);
    try {
      const data = await fetchEntries(id);
      setEntriesMap(prev => ({ ...prev, [id]: data }));
    } catch (e) {
      setGlobalErr(e.message);
    } finally {
      setLoadingEntries(false);
    }
  }, [entriesMap]);

  const goHome = () => { setView("home"); setSelectedId(null); };

  // ── Callbacks ─────────────────────────────────────────────────────────────
  const handlePathogenSaved = (p) => {
    setPathogens(prev => [...prev, p].sort((a, b) => a.name.localeCompare(b.name)));
    setEntriesMap(prev => ({ ...prev, [p.id]: [] }));
  };

  const handleEntrySaved = (entry) => {
    setEntriesMap(prev => ({
      ...prev,
      [selectedId]: [entry, ...(prev[selectedId] || [])],
    }));
  };

  const entries = entriesMap[selectedId] || [];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: "#070c12", color: "#e2e8f0",
      fontFamily: "Georgia,'Times New Roman',serif" }}>

      {/* Header */}
      <header style={{
        background: "#090e17", borderBottom: "1px solid rgba(255,255,255,0.045)",
        padding: "0 20px", display: "flex", alignItems: "center", height: "52px",
        gap: "10px", position: "sticky", top: 0, zIndex: 200,
      }}>
        {view === "pathogen" && (
          <button onClick={goHome} style={{
            background: "none", border: "none", color: "#4a6080", cursor: "pointer",
            display: "flex", alignItems: "center", gap: "4px", padding: "6px 8px",
            fontSize: "11px", fontFamily: "'Courier New',monospace", letterSpacing: "0.05em",
          }}>
            <ChevronLeft size={14} /> Atlas
          </button>
        )}

        <Microscope size={18} color="#c8a55e" strokeWidth={1.5} />

        <span style={{ flex: 1, fontSize: "14px", color: "#c8a55e" }}>
          {view === "home"
            ? "Atlas Microscópico"
            : <>
                <span style={{ color: "#3a5070", fontSize: "12px", fontFamily: "'Courier New',monospace" }}>
                  {CAT[selected?.category]?.label} · </span>
                <em>{selected?.name}</em>
              </>
          }
        </span>

        <button onClick={() => view === "home" ? setShowAddP(true) : setShowAddE(true)} style={{
          display: "flex", alignItems: "center", gap: "5px",
          background: "rgba(200,165,94,0.09)", border: "1px solid rgba(200,165,94,0.22)",
          color: "#c8a55e", borderRadius: "3px", padding: "5px 13px",
          cursor: "pointer", fontSize: "10px",
          fontFamily: "'Courier New',monospace", letterSpacing: "0.08em",
        }}>
          <Plus size={12} />
          {view === "home" ? "PATÓGENO" : "REGISTRO"}
        </button>
      </header>

      {/* Global error */}
      {globalErr && (
        <div style={{ maxWidth: "960px", margin: "0 auto", padding: "0 20px" }}>
          <ErrorMsg msg={globalErr} />
        </div>
      )}

      {/* Views */}
      {loading
        ? <Spinner />
        : view === "home"
          ? <HomeView pathogens={pathogens} entriesMap={entriesMap} onOpen={openPathogen} />
          : selected && (
              <PathogenView
                pathogen={selected}
                entries={entries}
                loading={loadingEntries}
                onAddEntry={() => setShowAddE(true)}
              />
            )
      }

      {/* Modals */}
      {showAddP && (
        <AddPathogenModal onClose={() => setShowAddP(false)} onSaved={handlePathogenSaved} />
      )}
      {showAddE && selected && (
        <AddEntryModal
          pathogen={selected}
          onClose={() => setShowAddE(false)}
          onSaved={handleEntrySaved}
        />
      )}
    </div>
  );
}
