// ======================================================
// Evidenziazioni e note — salvate dentro il PDF con pdf-lib
// ======================================================
import { t } from "./i18n.js";
import { PDFDocument, PDFName, PDFHexString, PDFString, PDFArray, PDFRef } from "./vendor/pdf-lib.esm.min.js";

export const COLORS = [
  { name: "Giallo", rgb: [1, 0.86, 0.2] },
  { name: "Verde", rgb: [0.55, 0.9, 0.45] },
  { name: "Azzurro", rgb: [0.45, 0.78, 1] },
  { name: "Rosa", rgb: [1, 0.55, 0.75] },
];
// Nome dell'autore scritto nei commenti del PDF (chiesto una volta e poi ricordato)
function getAutore(force = false) {
  let nome = "";
  try { nome = localStorage.getItem("autore") || ""; } catch {}
  if (!nome || force) {
    const r = prompt(t("notes.askAuthor"), nome);
    if (r !== null && r.trim()) nome = r.trim();
    try { if (nome) localStorage.setItem("autore", nome); } catch {}
  }
  return nome || t("app.name");
}
export function changeAutore() { getAutore(true); updateAutoreLabel(); }
export function updateAutoreLabel() {
  const el = document.getElementById("autore");
  if (!el) return;
  let nome = "";
  try { nome = localStorage.getItem("autore") || ""; } catch {}
  el.textContent = nome ? t("notes.author", { name: nome }) : t("notes.setAuthor");
}
const css = (rgb, a = 0.4) => `rgba(${rgb.map((v) => Math.round(v * 255)).join(",")},${a})`;

let app; // funzioni e stato di main.js
let uid = 1;

export function initNotes(api) {
  app = api;
  setupSelectionMenu();
  const $ = app.$;
  $("btn-notes").onclick = () => toggleNotes();
  $("autore").onclick = () => changeAutore();
  updateAutoreLabel();
}

// ---------- Lettura delle evidenziazioni già presenti nel PDF ----------
export async function importAnnots(doc) {
  doc.annots = [];
  doc.removedRefs = new Set();
  for (let n = 1; n <= doc.pages.length; n++) {
    let list = [];
    try { list = await doc.pages[n - 1].getAnnotations({ intent: "display" }); } catch {}
    for (const a of list) {
      if (a.subtype !== "Highlight") continue;
      const quads = [];
      const q = a.quadPoints;
      if (q && q.length >= 8) {
        // PDF.js restituisce un array piatto di 8 numeri per quadrilatero
        for (let i = 0; i + 7 < q.length; i += 8) quads.push(Array.from(q.slice(i, i + 8)));
      } else if (a.rect) {
        const [x1, y1, x2, y2] = a.rect;
        quads.push([x1, y2, x2, y2, x1, y1, x2, y1]);
      }
      const c = a.color ? Array.from(a.color).map((v) => v / 255) : COLORS[0].rgb;
      doc.annots.push({
        id: uid++, page: n, quads, color: c,
        note: a.contentsObj?.str || "", text: "",
        ref: a.id, saved: true, noteChanged: false,
      });
    }
  }
}

// ---------- Disegno delle evidenziazioni non ancora salvate ----------
export function drawAnnots(slot) {
  const D = app.D();
  const layer = slot.el.querySelector(".ann");
  if (!layer || !D) return;
  layer.innerHTML = "";
  const vp = app.vpOf(D.pages[slot.num - 1], D.scale);
  for (const a of D.annots) {
    if (a.page !== slot.num || a.saved) continue;
    for (const q of a.quads) {
      const r = app.toViewRect(vp, [Math.min(q[0], q[4]), Math.min(q[5], q[7]), Math.max(q[2], q[6]), Math.max(q[1], q[3])]);
      const d = document.createElement("div");
      Object.assign(d.style, {
        left: Math.min(r[0], r[2]) + "px", top: Math.min(r[1], r[3]) + "px",
        width: Math.abs(r[2] - r[0]) + "px", height: Math.abs(r[3] - r[1]) + "px",
        background: css(a.color, 0.45),
      });
      layer.appendChild(d);
    }
  }
}
const redraw = () => app.slots().forEach((s) => s.rendered && drawAnnots(s));

// ---------- Menu che compare quando selezioni il testo ----------
function setupSelectionMenu() {
  const $ = app.$;
  const menu = $("sel-menu");
  COLORS.forEach((c, i) => {
    const b = document.createElement("button");
    b.className = "sel-color";
    b.dataset.color = i;
    b.style.background = css(c.rgb, 1);
    b.onmousedown = (e) => e.preventDefault();
    b.onclick = () => createHighlight(i, false);
    menu.appendChild(b);
  });
  const nb = document.createElement("button");
  nb.className = "sel-note";
  nb.onmousedown = (e) => e.preventDefault();
  nb.onclick = () => createHighlight(0, true);
  menu.appendChild(nb);
  updateSelMenuTexts();

  const viewer = $("viewer");
  viewer.addEventListener("mouseup", () => setTimeout(showMenuIfSelection, 10));
  viewer.addEventListener("scroll", () => (menu.hidden = true));
  document.addEventListener("mousedown", (e) => { if (!menu.contains(e.target)) menu.hidden = true; });
}

export function updateSelMenuTexts() {
  const menu = app.$("sel-menu");
  menu.querySelectorAll(".sel-color").forEach((b) => {
    b.title = t("sel.highlight", { color: t("color." + b.dataset.color) });
    b.setAttribute("aria-label", b.title);
  });
  const nb = menu.querySelector(".sel-note");
  if (nb) { nb.textContent = t("sel.note"); nb.title = t("sel.noteTitle"); }
}

function showMenuIfSelection() {
  const menu = app.$("sel-menu");
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || !sel.toString().trim()) { menu.hidden = true; return; }
  const node = sel.anchorNode?.parentElement;
  if (!node || !node.closest(".textLayer")) { menu.hidden = true; return; }
  const rects = sel.getRangeAt(0).getClientRects();
  const last = rects[rects.length - 1];
  if (!last) return;
  menu.hidden = false;
  const w = menu.offsetWidth;
  menu.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, last.right - w / 2)) + "px";
  menu.style.top = Math.min(window.innerHeight - 60, last.bottom + 8) + "px";
}

function createHighlight(colorIdx, withNote) {
  const D = app.D();
  const sel = window.getSelection();
  if (!D || !sel || sel.isCollapsed) return;
  if (D.saving) { app.toast(t("msg.saving")); return; }
  const text = sel.toString().trim();
  const clientRects = [...sel.getRangeAt(0).getClientRects()].filter((r) => r.width > 1 && r.height > 1);
  sel.removeAllRanges();
  app.$("sel-menu").hidden = true;

  // raggruppa i rettangoli per pagina
  const byPage = new Map();
  for (const slot of app.slots()) {
    const pr = slot.el.getBoundingClientRect();
    for (const r of clientRects) {
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      if (cx < pr.left || cx > pr.right || cy < pr.top || cy > pr.bottom) continue;
      if (!byPage.has(slot.num)) byPage.set(slot.num, []);
      byPage.get(slot.num).push({ l: r.left - pr.left, t: r.top - pr.top, r: r.right - pr.left, b: r.bottom - pr.top });
    }
  }
  let created = null;
  for (const [num, rs] of byPage) {
    const vp = app.vpOf(D.pages[num - 1], D.scale);
    const quads = mergeLines(rs).map((r) => {
      const pts = [[r.l, r.t], [r.r, r.t], [r.l, r.b], [r.r, r.b]].map(([x, y]) => vp.convertToPdfPoint(x, y));
      const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
      const x1 = Math.min(...xs), x2 = Math.max(...xs), y1 = Math.min(...ys), y2 = Math.max(...ys);
      return [x1, y2, x2, y2, x1, y1, x2, y1];
    });
    const a = { id: uid++, page: num, quads, color: COLORS[colorIdx].rgb, note: "", text, saved: false, noteChanged: false };
    D.annots.push(a);
    created = created || a;
  }
  if (!created) return;
  D.annots.sort((a, b) => a.page - b.page);
  app.setDirty(D, true);
  redraw();
  renderNotes();
  if (withNote) {
    openNotes();
    setTimeout(() => app.$("notes").querySelector(`[data-id="${created.id}"] textarea`)?.focus(), 50);
  }
}

// unisce i rettangolini di una stessa riga in un unico rettangolo
function mergeLines(rs) {
  rs.sort((a, b) => a.t - b.t || a.l - b.l);
  const out = [];
  for (const r of rs) {
    const prev = out[out.length - 1];
    const sameLine = prev && Math.abs(prev.t - r.t) < (r.b - r.t) * 0.5 && r.l - prev.r < 20;
    if (sameLine) { prev.l = Math.min(prev.l, r.l); prev.r = Math.max(prev.r, r.r); prev.t = Math.min(prev.t, r.t); prev.b = Math.max(prev.b, r.b); }
    else out.push({ ...r });
  }
  return out;
}

// ---------- Pannello note ----------
function openNotes() { app.$("notes").hidden = false; app.$("btn-notes").classList.add("on"); renderNotes(); }
function toggleNotes() {
  const p = app.$("notes");
  if (p.hidden) openNotes(); else { p.hidden = true; app.$("btn-notes").classList.remove("on"); }
  const D = app.D();
  if (D && D.fitMode) app.refit();
}

export function renderNotes() {
  const $ = app.$;
  const D = app.D();
  const count = D ? D.annots.filter((a) => !D.removedRefs.has(a.ref)).length : 0;
  $("notes-count").textContent = count || "";
  const box = $("notes-list");
  if (!box || $("notes").hidden) return;
  box.innerHTML = "";
  if (!D || !count) {
    box.innerHTML = `<p class="notes-empty">${t("notes.empty")}</p>`;
    return;
  }
  for (const a of D.annots) {
    const item = document.createElement("div");
    item.className = "note-item";
    item.dataset.id = a.id;
    const head = document.createElement("button");
    head.className = "note-head";
    head.innerHTML = `<span class="note-dot" style="background:${css(a.color, 1)}"></span>${t("notes.page", { n: a.page })}${a.saved ? "" : ` <span class="note-new">${t("notes.unsaved")}</span>`}`;
    head.onclick = () => app.goToPdfPoint(a.page, a.quads[0]?.[1]);
    const del = document.createElement("button");
    del.className = "note-del";
    del.title = t("notes.delete");
    del.setAttribute("aria-label", t("notes.delete"));
    del.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';
    del.onclick = () => deleteAnnot(a);
    const top = document.createElement("div");
    top.className = "note-top";
    top.append(head, del);
    item.appendChild(top);
    if (a.text) {
      const q = document.createElement("p");
      q.className = "note-quote";
      q.textContent = a.text;
      item.appendChild(q);
    }
    const ta = document.createElement("textarea");
    ta.placeholder = t("notes.placeholder");
    ta.value = a.note;
    ta.rows = 2;
    ta.disabled = !!D.saving;
    ta.oninput = () => { a.note = ta.value; a.noteChanged = true; app.setDirty(D, true); };
    item.appendChild(ta);
    box.appendChild(item);
  }
}

async function deleteAnnot(a) {
  const D = app.D();
  if (D.saving) return;
  if (a.saved && D.password) { alert(t("msg.encryptedSave")); return; }
  D.annots = D.annots.filter((x) => x !== a);
  app.setDirty(D, true);
  if (a.saved) {
    // è già scritta nel PDF: la tolgo dal documento in memoria e ridisegno
    D.removedRefs.add(a.ref);
    await rebuild(D, false);
  } else {
    redraw();
    renderNotes();
  }
}

// ---------- Scrittura nel PDF ----------
function refOf(id) {
  const m = /^(\d+)R(\d*)$/.exec(id || "");
  return m ? PDFRef.of(Number(m[1]), Number(m[2] || 0)) : null;
}

async function applyChanges(doc) {
  const autore = doc.annots.some((a) => !a.saved) ? getAutore() : "";
  const pdf = await PDFDocument.load(doc.bytes, { ignoreEncryption: true, updateMetadata: false });
  const ctx = pdf.context;
  const pages = pdf.getPages();

  // 1. elimina le evidenziazioni rimosse
  if (doc.removedRefs.size) {
    const removed = new Set([...doc.removedRefs].map((id) => refOf(id)?.toString()));
    for (const p of pages) {
      const annots = p.node.lookup(PDFName.of("Annots"));
      if (!(annots instanceof PDFArray)) continue;
      for (let i = annots.size() - 1; i >= 0; i--) {
        const r = annots.get(i);
        if (r instanceof PDFRef && removed.has(r.toString())) annots.remove(i);
      }
    }
  }
  // 2. aggiorna i commenti modificati
  for (const a of doc.annots) {
    if (!a.saved || !a.noteChanged) continue;
    const dict = ctx.lookup(refOf(a.ref));
    if (!dict) continue;
    dict.set(PDFName.of("Contents"), PDFHexString.fromText(a.note));
    dict.set(PDFName.of("M"), PDFString.fromDate(new Date()));
  }
  // 3. aggiunge le nuove evidenziazioni
  for (const a of doc.annots) {
    if (a.saved) continue;
    const xs = a.quads.flatMap((q) => [q[0], q[2], q[4], q[6]]);
    const ys = a.quads.flatMap((q) => [q[1], q[3], q[5], q[7]]);
    const rect = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
    const [r, g, b] = a.color.map((v) => v.toFixed(3));
    let ops = `/GS0 gs ${r} ${g} ${b} rg\n`;
    for (const q of a.quads) {
      const x1 = Math.min(q[0], q[4]), x2 = Math.max(q[2], q[6]), y1 = Math.min(q[5], q[7]), y2 = Math.max(q[1], q[3]);
      ops += `${x1.toFixed(2)} ${y1.toFixed(2)} ${(x2 - x1).toFixed(2)} ${(y2 - y1).toFixed(2)} re f\n`;
    }
    const ap = ctx.flateStream(ops, {
      Type: "XObject", Subtype: "Form", BBox: rect,
      Resources: { ExtGState: { GS0: { Type: "ExtGState", BM: "Multiply" } } },
    });
    const annot = ctx.obj({
      Type: "Annot", Subtype: "Highlight", Rect: rect,
      QuadPoints: a.quads.flat(), C: a.color, F: 4,
      Contents: PDFHexString.fromText(a.note || ""),
      T: PDFHexString.fromText(autore),
      M: PDFString.fromDate(new Date()),
      AP: { N: ctx.register(ap) },
    });
    pages[a.page - 1].node.addAnnot(ctx.register(annot));
  }
  return await pdf.save({ useObjectStreams: false });
}

// ricrea il PDF in memoria e lo ricarica nel visore
async function rebuild(doc, toDisk, newPath) {
  if (doc.saving) return;
  doc.saving = true;
  renderNotes(); // blocca le note durante il salvataggio
  const status = app.$("status");
  status.textContent = t(toDisk ? "msg.saving" : "msg.updating");
  status.hidden = false;
  try {
    const bytes = await applyChanges(doc);
    // controlla che il nuovo PDF si apra e abbia le stesse pagine PRIMA di sovrascrivere l'originale
    const check = await app.validatePdf(bytes.slice(), doc.name, doc.password);
    const ok = check.pdf.numPages === doc.pages.length;
    try { (check.pdf.loadingTask ?? check.pdf).destroy?.(); } catch {}
    if (!ok) throw new Error("il PDF ricreato non è corretto / rebuilt PDF failed validation");
    if (toDisk) {
      await app.invokeRaw("write_pdf", bytes, newPath || doc.path);
      if (newPath) app.renameDoc(doc, newPath);
    }
    await app.reloadDoc(doc, bytes);
    if (toDisk) { app.setDirty(doc, false); app.toast(t("msg.saved")); }
  } catch (err) {
    console.error(err);
    alert(t("msg.saveError", { err: err?.message || err }));
  } finally {
    doc.saving = false;
    status.hidden = true;
    renderNotes();
  }
}

async function hasSignature(doc) {
  try {
    const fields = await doc.pdf.getFieldObjects();
    if (!fields) return false;
    return Object.values(fields).some((list) => list.some((f) => f.type === "signature" || f.fieldType === "Sig"));
  } catch { return false; }
}

export async function save(asNew = false) {
  const D = app.D();
  if (!D) return;
  if (D.password) { alert(t("msg.encryptedSave")); return; }
  if (D.saving) return;
  // PDF firmato digitalmente: salvare sopra l'originale invalida la firma
  if (!asNew && (await hasSignature(D)) && !confirm(t("msg.signedWarn"))) return;
  let target = null;
  if (asNew) {
    target = await app.invoke("plugin:dialog|save", {
      options: { defaultPath: D.path.replace(/\.pdf$/i, t("annot.suffix") + ".pdf"), filters: [{ name: "PDF", extensions: ["pdf"] }] },
    }).catch(() => null);
    if (!target) return;
    if (!/\.pdf$/i.test(target)) target += ".pdf";
  } else if (!D.dirty) { app.toast(t("msg.noChanges")); return; }
  await rebuild(D, true, target);
}
