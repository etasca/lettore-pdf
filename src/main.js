import * as pdfjsLib from "./vendor/pdf.min.mjs";

import { initNotes, importAnnots, drawAnnots, renderNotes, save, updateAutoreLabel, updateSelMenuTexts } from "./note.js";
import { t, applyI18n, setLanguage, getLanguagePref, LINGUE } from "./i18n.js";

pdfjsLib.GlobalWorkerOptions.workerSrc = "./vendor/pdf.worker.min.mjs";

const $ = (id) => document.getElementById(id);
const viewer = $("viewer");
const pagesEl = $("pages");
const T = window.__TAURI__;
const invoke = (cmd, args) => T.core.invoke(cmd, args);

// ======================================================
// Stato: più documenti aperti (schede), uno attivo
// ======================================================
let docs = [];
let D = null;          // documento attivo
let slots = [];        // pagine del documento attivo nel visore
let observer = null;
let nextId = 1;

function newDoc(path, name, pdf, pages) {
  return {
    id: nextId++, path, name, pdf, pages,
    scale: 1, fitMode: "width", layout: "single", rotation: 0, lastPage: 1,
    textCache: new Map(), pageIndex: new Map(),
    annots: [], removedRefs: new Set(), dirty: false, bytes: null,
    query: "", matches: [], current: -1,
  };
}

// viewport con la rotazione del documento
const vpOf = (page, scale) => page.getViewport({ scale, rotation: (page.rotate + D.rotation) % 360 });

// ======================================================
// Memoria: file recenti e ultima posizione
// ======================================================
const store = {
  get(k, def) { try { return JSON.parse(localStorage.getItem(k)) ?? def; } catch { return def; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

function addRecent(path, name) {
  const list = store.get("recenti", []).filter((r) => r.path !== path);
  list.unshift({ path, name, when: Date.now() });
  store.set("recenti", list.slice(0, 12));
}
function removeRecent(path) {
  store.set("recenti", store.get("recenti", []).filter((r) => r.path !== path));
}
function savePosition(doc) {
  if (!doc) return;
  if (doc === D && slots.length) doc.lastPage = currentPage();
  const pos = store.get("posizioni", {});
  pos[doc.path] = { page: doc.lastPage, rotation: doc.rotation, layout: doc.layout, fitMode: doc.fitMode };
  const keys = Object.keys(pos);
  if (keys.length > 300) delete pos[keys[0]];
  store.set("posizioni", pos);
}

// ======================================================
// Apertura file
// ======================================================
// Errore visibile nella pagina (alert() può non mostrarsi su alcune versioni di macOS)
function problem(msg) {
  console.error(msg);
  (window.__lpdfShowError || alert)(String(msg));
}

const baseName = (p) => p.split(/[\\/]/).pop();

const IS_WIN = /Win/.test(navigator.platform || navigator.userAgent);
const samePath = (a, b) => (IS_WIN ? a.toLowerCase() === b.toLowerCase() : a === b);
const opening = new Map(); // file in fase di apertura → evita schede doppie

function openPath(path) {
  const existing = docs.find((d) => samePath(d.path, path));
  if (existing) return activate(existing);
  const key = IS_WIN ? path.toLowerCase() : path;
  if (opening.has(key)) return opening.get(key);
  const p = openPathNow(path).finally(() => opening.delete(key));
  opening.set(key, p);
  return p;
}

async function openPathNow(path) {
  let bytes;
  try {
    bytes = new Uint8Array(await invoke("read_pdf", { path }));
  } catch (err) {
    problem(t("msg.readError", { err }));
    removeRecent(path);
    renderRecents();
    return;
  }
  const original = bytes.slice();
  let pdf, password = null;
  try {
    ({ pdf, password } = await loadPdf(bytes, baseName(path)));
  } catch (err) {
    if (err?.name === "PasswordAbandoned") return; // l'utente ha annullato
    problem(t("msg.invalidPdf", { err: err?.message || err }));
    return;
  }
  const pages = [];
  try {
    for (let n = 1; n <= pdf.numPages; n++) pages.push(await pdf.getPage(n));
  } catch (err) {
    try { (pdf.loadingTask ?? pdf).destroy?.(); } catch {}
    problem(t("msg.invalidPdf", { err: err?.message || err }));
    return;
  }
  const doc = newDoc(path, baseName(path), pdf, pages);
  doc.bytes = original;
  doc.password = password;
  await importAnnots(doc);
  const pos = store.get("posizioni", {})[path];
  if (pos) { doc.lastPage = Math.min(pos.page || 1, pages.length); doc.rotation = pos.rotation || 0; doc.layout = pos.layout || "single"; if (pos.fitMode === "page") doc.fitMode = "page"; }
  docs.push(doc);
  addRecent(path, doc.name);
  activate(doc);
  // niente anteprima salvata per i PDF protetti: resterebbe leggibile sul disco
  if (!password) saveCover(path, pages[0]);
}

// Anteprima della prima pagina per la lista dei recenti
async function saveCover(path, page) {
  try {
    const base = page.getViewport({ scale: 1 });
    const vp = page.getViewport({ scale: 240 / base.width });
    const c = document.createElement("canvas");
    c.width = Math.floor(vp.width);
    c.height = Math.floor(vp.height);
    await page.render({ canvas: c, canvasContext: c.getContext("2d"), viewport: vp }).promise;
    const covers = store.get("anteprime", {});
    covers[path] = c.toDataURL("image/jpeg", 0.75);
    const keep = new Set(store.get("recenti", []).map((r) => r.path));
    for (const k of Object.keys(covers)) if (!keep.has(k)) delete covers[k];
    store.set("anteprime", covers);
  } catch (err) { console.error(err); }
}

// Carica un PDF con PDF.js; se è protetto chiede la password
function loadPdf(data, name, knownPassword = null) {
  return new Promise((resolve, reject) => {
    const task = pdfjsLib.getDocument({
      data,
      password: knownPassword ?? undefined,
      isEvalSupported: false,
      cMapUrl: "./vendor/cmaps/",
      cMapPacked: true,
      standardFontDataUrl: "./vendor/standard_fonts/",
    });
    let used = knownPassword;
    task.onPassword = (update, reason) => {
      const wrong = reason === pdfjsLib.PasswordResponses.INCORRECT_PASSWORD;
      const pw = prompt(wrong ? t("msg.passwordWrong") : t("msg.password", { name }));
      if (pw === null) {
        task.destroy();
        const e = new Error("cancelled");
        e.name = "PasswordAbandoned";
        reject(e);
      } else { used = pw; update(pw); }
    };
    task.promise.then((pdf) => resolve({ pdf, password: used }), reject);
  });
}

async function openDialog() {
  try {
    const res = await invoke("plugin:dialog|open", {
      options: { multiple: true, filters: [{ name: "PDF", extensions: ["pdf"] }] },
    });
    if (!res) return;
    for (const p of [].concat(res)) await openPath(typeof p === "string" ? p : p.path);
  } catch (err) { problem(t("msg.openError", { err })); }
}

$("btn-open-empty").onclick = openDialog;

// Trascina e rilascia (eventi nativi di Tauri: danno il percorso del file)
T.event.listen("tauri://drag-enter", () => document.body.classList.add("dragging"));
T.event.listen("tauri://drag-leave", () => document.body.classList.remove("dragging"));
T.event.listen("tauri://drag-drop", async (e) => {
  document.body.classList.remove("dragging");
  for (const p of (e.payload?.paths || [])) if (p.toLowerCase().endsWith(".pdf")) await openPath(p);
});

// Doppio clic su un PDF quando l'app è già aperta
T.event.listen("open-files", async (e) => { for (const p of e.payload || []) await openPath(p); });

// ======================================================
// Schede
// ======================================================
function renderTabs() {
  const box = $("tabs");
  box.innerHTML = "";
  for (const d of docs) {
    const tabEl = document.createElement("div");
    tabEl.className = "tab" + (d === D ? " active" : "");
    tabEl.title = d.path;
    const label = document.createElement("span");
    label.className = "tab-label";
    label.textContent = (d.dirty ? "• " : "") + d.name;
    const close = document.createElement("button");
    close.className = "tab-close";
    close.setAttribute("aria-label", t("tab.close", { name: d.name }));
    close.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';
    close.onclick = (e) => { e.stopPropagation(); closeDoc(d); };
    tabEl.onclick = () => activate(d);
    tabEl.onauxclick = (e) => { if (e.button === 1) closeDoc(d); };
    tabEl.append(label, close);
    box.appendChild(tabEl);
  }
  const plus = document.createElement("button");
  plus.className = "icon-btn";
  plus.title = t("tab.open");
  plus.setAttribute("aria-label", t("tab.open"));
  plus.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>';
  plus.onclick = openDialog;
  box.appendChild(plus);
}

function activate(doc) {
  if (doc === D && slots.length) return;
  if (D && D !== doc) {
    savePosition(D);
    D.query = $("search-input").value;
  }
  D = doc;
  renderTabs();
  document.title = doc.name + " — " + t("app.name");
  $("empty").classList.add("hidden");
  $("toolbar").hidden = false;
  $("page-count").textContent = doc.pages.length;
  if (store.get("sidebar", "aperta") !== "chiusa") $("sidebar").hidden = false;
  $("search-input").value = doc.query;
  updateSearchUI();
  buildThumbs();
  buildOutline();
  renderNotes();
  updateLayoutButtons();
  if (doc.fitMode) refit(doc.lastPage);
  else buildPages(doc.lastPage);
}

async function closeDoc(doc) {
  if (doc.dirty && !confirm(t("msg.closeUnsaved", { name: doc.name }))) return;
  savePosition(doc);
  const i = docs.indexOf(doc);
  docs.splice(i, 1);
  try { (doc.pdf.loadingTask ?? doc.pdf).destroy?.(); } catch (err) { console.error(err); }
  if (doc === D) {
    D = null;
    if (docs.length) activate(docs[Math.min(i, docs.length - 1)]);
    else showEmpty();
  } else renderTabs();
}

function showEmpty() {
  D = null;
  slots = [];
  if (observer) observer.disconnect();
  pagesEl.innerHTML = "";
  $("thumbs").innerHTML = "";
  $("outline").innerHTML = "";
  $("sidebar").hidden = true;
  $("toolbar").hidden = true;
  $("empty").classList.remove("hidden");
  $("search-input").value = "";
  updateSearchUI();
  document.title = t("app.name");
  renderTabs();
  renderRecents();
}

function renderRecents() {
  const box = $("recents");
  box.innerHTML = "";
  const list = store.get("recenti", []);
  if (!list.length) return;
  const h = document.createElement("p");
  h.className = "recents-title";
  h.textContent = t("recent.title");
  box.appendChild(h);
  const grid = document.createElement("div");
  grid.className = "recent-grid";
  box.appendChild(grid);
  const covers = store.get("anteprime", {});
  for (const r of list) {
    const b = document.createElement("button");
    b.className = "recent";
    b.title = r.path;
    const cov = document.createElement("span");
    cov.className = "recent-cover";
    if (covers[r.path]) {
      const img = document.createElement("img");
      img.src = covers[r.path];
      img.alt = "";
      cov.appendChild(img);
    } else cov.textContent = "PDF";
    b.appendChild(cov);
    const n = document.createElement("span");
    n.className = "recent-name";
    n.textContent = r.name;
    const p = document.createElement("span");
    p.className = "recent-path";
    p.textContent = r.path.replace(/[\\/][^\\/]*$/, "");
    b.append(n, p);
    b.onclick = () => openPath(r.path);
    const wrap = document.createElement("div");
    wrap.className = "recent-wrap";
    const x = document.createElement("button");
    x.className = "recent-remove";
    x.title = t("recent.remove");
    x.setAttribute("aria-label", t("recent.removeName", { name: r.name }));
    x.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';
    x.onclick = () => {
      removeRecent(r.path);
      const saved = store.get("anteprime", {});
      delete saved[r.path];
      store.set("anteprime", saved);
      renderRecents();
    };
    wrap.append(b, x);
    grid.appendChild(wrap);
  }
}

// ======================================================
// Pagine: costruzione e disegno (solo quelle visibili)
// ======================================================
let unloadObserver = null;
// Libera la memoria di una pagina molto lontana dalla vista (verrà ridisegnata se ci torni)
function unloadSlot(slot) {
  if (!slot || !slot.rendered) return;
  const c = slot.el.querySelector("canvas");
  if (c) { c.width = 0; c.height = 0; }
  slot.el.replaceChildren();
  slot.rendered = false;
}

function buildPages(target) {
  const keep = target ?? (slots.length ? currentPage() : 1);
  pagesEl.innerHTML = "";
  slots = [];
  if (observer) observer.disconnect();

  observer = new IntersectionObserver((entries) => {
    for (const en of entries) if (en.isIntersecting) renderSlot(slots[Number(en.target.dataset.num) - 1]);
  }, { root: viewer, rootMargin: "800px 0px" });
  if (unloadObserver) unloadObserver.disconnect();
  unloadObserver = new IntersectionObserver((entries) => {
    for (const en of entries) if (!en.isIntersecting) unloadSlot(slots[Number(en.target.dataset.num) - 1]);
  }, { root: viewer, rootMargin: "4000px 0px" });

  pagesEl.classList.toggle("double", D.layout === "double");
  let row = null;
  for (let n = 1; n <= D.pages.length; n++) {
    const vp = vpOf(D.pages[n - 1], D.scale);
    const el = document.createElement("div");
    el.className = "page";
    el.dataset.num = n;
    el.style.width = Math.floor(vp.width) + "px";
    el.style.height = Math.floor(vp.height) + "px";
    el.style.setProperty("--total-scale-factor", D.scale);
    if (D.layout === "double") {
      if (n % 2 === 1) { row = document.createElement("div"); row.className = "row"; pagesEl.appendChild(row); }
      row.appendChild(el);
    } else pagesEl.appendChild(el);
    slots.push({ el, num: n, rendered: false, doc: D });
    observer.observe(el);
    unloadObserver.observe(el);
  }
  goTo(keep, false);
  $("page-input").value = keep;
  $("zoom-label").textContent = Math.round(D.scale * 100) + "%";
}

async function renderSlot(slot) {
  if (!slot || slot.rendered || slot.doc !== D) return;
  slot.rendered = true;
  const doc = D, myScale = D.scale, myRot = D.rotation;
  const page = doc.pages[slot.num - 1];
  const cssVp = vpOf(page, myScale);
  // risoluzione: nitida sugli schermi ad alta densità, ma con un tetto (≈ 8 milioni di pixel per pagina)
  // per non rallentare i computer meno potenti e gli schermi Retina
  const MAX_PIXELS = 8e6;
  const dpr = Math.min(window.devicePixelRatio || 1, Math.sqrt(MAX_PIXELS / (cssVp.width * cssVp.height)));
  const vp = vpOf(page, myScale * Math.max(dpr, 0.5));

  const canvas = document.createElement("canvas");
  canvas.width = Math.floor(vp.width);
  canvas.height = Math.floor(vp.height);
  try {
    await page.render({ canvas, canvasContext: canvas.getContext("2d"), viewport: vp }).promise;
  } catch (err) {
    console.error(err);
    slot.rendered = false;
    // nella versione installata non c'è la console: mostro il motivo sulla pagina
    const msg = document.createElement("p");
    msg.className = "page-error";
    msg.textContent = "⚠ " + (err?.name || "Error") + ": " + (err?.message || err);
    slot.el.replaceChildren(msg);
    return;
  }
  if (doc !== D || myScale !== D.scale || myRot !== D.rotation || !slot.el.isConnected || !slot.rendered) return;

  const hl = document.createElement("div");
  hl.className = "hl";
  const tl = document.createElement("div");
  tl.className = "textLayer";
  const links = document.createElement("div");
  links.className = "links";
  const ann = document.createElement("div");
  ann.className = "ann";
  slot.el.replaceChildren(canvas, ann, hl, tl, links);
  drawAnnots(slot);

  try {
    const textLayer = new pdfjsLib.TextLayer({
      textContentSource: await getText(doc, slot.num),
      container: tl,
      viewport: cssVp,
    });
    await textLayer.render();
    slot.textDivs = textLayer.textDivs; // servono per evidenziare la ricerca con precisione
  } catch (err) { console.error(err); }
  drawHighlights(slot);

  try {
    const annots = await page.getAnnotations({ intent: "display" });
    for (const a of annots) {
      if (a.subtype !== "Link") continue;
      const url = a.url && SAFE_URL.test(a.url) ? a.url : null;
      if (!url && !a.dest) continue;
      const r = toViewRect(cssVp, a.rect);
      const link = document.createElement("a");
      link.style.left = Math.min(r[0], r[2]) + "px";
      link.style.top = Math.min(r[1], r[3]) + "px";
      link.style.width = Math.abs(r[2] - r[0]) + "px";
      link.style.height = Math.abs(r[3] - r[1]) + "px";
      if (url) {
        link.title = url;
        link.onclick = (e) => { e.preventDefault(); openExternal(url); };
      } else {
        link.onclick = async (e) => { e.preventDefault(); const p = await destToPage(a.dest); if (p) goTo(p); };
      }
      links.appendChild(link);
    }
  } catch (err) { console.error(err); }
}

// Converte un rettangolo PDF [x1,y1,x2,y2] in coordinate dello schermo
function toViewRect(vp, r) {
  const [a, b] = vp.convertToViewportPoint(r[0], r[1]);
  const [c, d] = vp.convertToViewportPoint(r[2], r[3]);
  return [a, b, c, d];
}

const SAFE_URL = /^(https?:|mailto:|tel:)/i;
function openExternal(url) {
  if (!url || !SAFE_URL.test(url)) return;
  const p = T?.opener?.openUrl ? T.opener.openUrl(url) : invoke("plugin:opener|open_url", { url });
  Promise.resolve(p).catch((err) => console.error(err));
}

async function destToPage(dest) {
  try {
    if (typeof dest === "string") dest = await D.pdf.getDestination(dest);
    if (!Array.isArray(dest)) return null;
    const ref = dest[0];
    const idx = typeof ref === "object" ? await D.pdf.getPageIndex(ref) : ref;
    return idx + 1;
  } catch { return null; }
}

// ======================================================
// Navigazione
// ======================================================
function currentPage() {
  if (!slots.length) return 1;
  const mid = viewer.scrollTop + viewer.clientHeight / 3;
  for (const s of slots) if (s.el.offsetTop + s.el.offsetHeight > mid) return s.num;
  return slots.length;
}

function goTo(n, smooth = true) {
  if (!slots.length) return;
  n = Math.max(1, Math.min(slots.length, n));
  viewer.scrollTo({ top: slots[n - 1].el.offsetTop - 24, behavior: smooth ? "smooth" : "auto" });
}

let lastPage = 0, posTimer;
viewer.addEventListener("scroll", () => {
  if (!D) return;
  const p = currentPage();
  if (document.activeElement !== $("page-input")) $("page-input").value = p;
  if (p !== lastPage) { lastPage = p; markThumb(p); }
  clearTimeout(posTimer);
  posTimer = setTimeout(() => savePosition(D), 800);
});
$("page-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter") { goTo(parseInt(e.target.value, 10) || 1); e.target.blur(); }
});
const stepSize = () => (D && D.layout === "double" ? 2 : 1);
$("btn-prev").onclick = () => goTo(currentPage() - stepSize());
$("btn-next").onclick = () => goTo(currentPage() + stepSize());

// ======================================================
// Zoom e rotazione
// ======================================================
function setScale(s, fromFit = false, target) {
  if (!D) return;
  D.fitMode = fromFit || false;
  setTimeout(updateLayoutButtons);
  D.scale = Math.max(0.25, Math.min(5, s));
  buildPages(target);
}
// larghezza e altezza massime delle pagine (a scala 1), per i PDF con pagine di formati diversi
function pageBox() {
  let w = 0, h = 0;
  for (const p of D.pages.slice(0, 50)) { const v = vpOf(p, 1); w = Math.max(w, v.width); h = Math.max(h, v.height); }
  return { w: D.layout === "double" ? w * 2 + 20 : w, h };
}
function fitWidth(target) {
  if (!D) return;
  const { w } = pageBox();
  setScale(Math.min(3, (viewer.clientWidth - 64) / w), "width", target);
}
function fitPage(target) {
  if (!D) return;
  const { w, h } = pageBox();
  setScale(Math.min((viewer.clientWidth - 64) / w, (viewer.clientHeight - 48) / h), "page", target);
}
function refit(target) {
  if (!D) return;
  if (D.fitMode === "page") fitPage(target); else fitWidth(target);
}
function toggleFit() {
  if (!D) return;
  if (D.fitMode === "width") fitPage(currentPage()); else fitWidth(currentPage());
  updateLayoutButtons();
}
function toggleLayout() {
  if (!D) return;
  const p = currentPage();
  D.layout = D.layout === "double" ? "single" : "double";
  // due pagine affiancate = una coppia intera sullo schermo, come un libro aperto
  D.fitMode = D.layout === "double" ? "page" : "width";
  updateLayoutButtons();
  refit(p);
  savePosition(D);
}
function updateLayoutButtons() {
  if (!D) return;
  $("btn-layout").classList.toggle("on", D.layout === "double");
  $("btn-layout").title = t(D.layout === "double" ? "tb.single" : "tb.double");
  $("btn-layout").setAttribute("aria-label", $("btn-layout").title);
  $("btn-fit").classList.toggle("on", D.fitMode === "page");
  $("btn-fit").title = t(D.fitMode === "page" ? "tb.fitWidth" : "tb.fitPage");
  $("btn-fit").setAttribute("aria-label", $("btn-fit").title);
}
function rotate() {
  if (!D) return;
  const p = currentPage();
  D.rotation = (D.rotation + 90) % 360;
  buildThumbs();
  if (D.fitMode) refit(p); else buildPages(p);
  savePosition(D);
}
$("btn-zoom-in").onclick = () => setScale(D.scale * 1.2);
$("btn-zoom-out").onclick = () => setScale(D.scale / 1.2);
$("btn-fit").onclick = toggleFit;
$("btn-layout").onclick = toggleLayout;
$("btn-rotate").onclick = rotate;

viewer.addEventListener("wheel", (e) => {
  if (!(e.ctrlKey || e.metaKey) || !D) return;
  e.preventDefault();
  setScale(D.scale * (e.deltaY < 0 ? 1.1 : 1 / 1.1));
}, { passive: false });

let resizeTimer;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => { if (D && D.fitMode) refit(); }, 200);
});

// ======================================================
// Barra laterale: miniature e indice
// ======================================================
let thumbObserver = null;

function buildThumbs() {
  const box = $("thumbs");
  box.innerHTML = "";
  if (thumbObserver) thumbObserver.disconnect();
  const doc = D;
  thumbObserver = new IntersectionObserver((entries) => {
    for (const en of entries) {
      if (!en.isIntersecting || en.target.dataset.done || doc !== D) continue;
      en.target.dataset.done = "1";
      const page = doc.pages[Number(en.target.dataset.num) - 1];
      const vp = vpOf(page, (112 * (window.devicePixelRatio || 1)) / vpOf(page, 1).width);
      const c = document.createElement("canvas");
      c.width = Math.floor(vp.width);
      c.height = Math.floor(vp.height);
      page.render({ canvas: c, canvasContext: c.getContext("2d"), viewport: vp }).promise
        .then(() => en.target.querySelector(".tbox").replaceChildren(c))
        .catch(() => { delete en.target.dataset.done; });
    }
  }, { root: box, rootMargin: "400px 0px" });

  doc.pages.forEach((page, i) => {
    const base = vpOf(page, 1);
    const b = document.createElement("button");
    b.className = "thumb";
    b.dataset.num = i + 1;
    b.setAttribute("aria-label", t("side.page", { n: i + 1 }));
    const tbox = document.createElement("span");
    tbox.className = "tbox";
    tbox.style.height = Math.round(112 * base.height / base.width) + "px";
    b.append(tbox, document.createTextNode(String(i + 1)));
    b.onclick = () => goTo(i + 1);
    box.appendChild(b);
    thumbObserver.observe(b);
  });
  markThumb(doc.lastPage);
}

function markThumb(n) {
  const box = $("thumbs");
  box.querySelector(".thumb.active")?.classList.remove("active");
  const th = box.querySelector(`.thumb[data-num="${n}"]`);
  if (!th) return;
  th.classList.add("active");
  if (!$("sidebar").hidden && !box.hidden) th.scrollIntoView({ block: "nearest" });
}

async function buildOutline() {
  const box = $("outline");
  box.innerHTML = "";
  const doc = D;
  const outline = await doc.pdf.getOutline();
  if (doc !== D) return;
  if (!outline || !outline.length) {
    box.innerHTML = `<p class="outline-empty">${t("side.noOutline")}</p>`;
    return;
  }
  const makeList = (items) => {
    const ul = document.createElement("ul");
    for (const it of items) {
      const li = document.createElement("li");
      const b = document.createElement("button");
      b.textContent = it.title;
      b.onclick = async () => {
        if (it.url) return openExternal(it.url);
        const p = await destToPage(it.dest);
        if (p) goTo(p);
      };
      li.appendChild(b);
      if (it.items?.length) li.appendChild(makeList(it.items));
      ul.appendChild(li);
    }
    return ul;
  };
  box.appendChild(makeList(outline));
}

function showSideTab(which) {
  $("tab-thumbs").classList.toggle("active", which === "thumbs");
  $("tab-outline").classList.toggle("active", which === "outline");
  $("thumbs").hidden = which !== "thumbs";
  $("outline").hidden = which !== "outline";
  if (which === "thumbs" && D) markThumb(currentPage());
}
$("tab-thumbs").onclick = () => showSideTab("thumbs");
$("tab-outline").onclick = () => showSideTab("outline");
$("btn-sidebar").onclick = () => {
  if (!D) return;
  const sb = $("sidebar");
  sb.hidden = !sb.hidden;
  store.set("sidebar", sb.hidden ? "chiusa" : "aperta");
  if (!sb.hidden) markThumb(currentPage());
  if (D.fitMode) refit();
};

// ======================================================
// Ricerca nel testo
// ======================================================
async function getText(doc, n) {
  if (!doc.textCache.has(n)) doc.textCache.set(n, await doc.pages[n - 1].getTextContent());
  return doc.textCache.get(n);
}

async function getIndex(doc, n) {
  if (doc.pageIndex.has(n)) return doc.pageIndex.get(n);
  const tc = await getText(doc, n);
  let str = "";
  const starts = [];
  // solo gli elementi di testo: sono nello stesso ordine degli <span> del livello testo
  const items = tc.items.filter((it) => it.str !== undefined);
  items.forEach((it) => {
    starts.push(str.length);
    str += it.str;
    if (it.hasEOL) str += " ";
  });
  const idx = { str: str.toLowerCase(), starts, items };
  doc.pageIndex.set(n, idx);
  return idx;
}

let searchToken = 0;
async function runSearch(query) {
  if (!D) return;
  const doc = D;
  const token = ++searchToken;
  const q = query.trim().toLowerCase();
  if (!q) { doc.matches = []; doc.current = -1; updateSearchUI(); redrawAllHighlights(); return; }
  const found = [];
  $("search-count").textContent = "…";
  for (let n = 1; n <= doc.pages.length; n++) {
    const idx = await getIndex(doc, n);
    if (token !== searchToken || doc !== D) return;
    let pos = idx.str.indexOf(q);
    while (pos !== -1) {
      found.push({ page: n, start: pos, end: pos + q.length });
      pos = idx.str.indexOf(q, pos + q.length);
    }
  }
  doc.matches = found;
  const cp = currentPage();
  doc.current = doc.matches.length ? Math.max(0, doc.matches.findIndex((m) => m.page >= cp)) : -1;
  updateSearchUI();
  redrawAllHighlights();
  if (doc.current >= 0) scrollToMatch();
}

function rectsFor(match, viewport, slot) {
  const idx = D.pageIndex.get(match.page);
  if (!idx) return [];
  // Metodo preciso: misura le lettere vere nel livello testo della pagina
  if (slot?.textDivs?.length && slot.el.isConnected) {
    const pr = slot.el.getBoundingClientRect();
    const out = [];
    for (let i = 0; i < idx.items.length; i++) {
      const s0 = idx.starts[i];
      const len = idx.items[i].str.length;
      if (!len || s0 + len <= match.start || s0 >= match.end) continue;
      const node = slot.textDivs[i]?.firstChild;
      if (!node || node.nodeType !== 3) continue;
      const range = document.createRange();
      range.setStart(node, Math.min(Math.max(match.start, s0) - s0, node.length));
      range.setEnd(node, Math.min(Math.min(match.end, s0 + len) - s0, node.length));
      for (const r of range.getClientRects()) {
        out.push({ left: r.left - pr.left, top: r.top - pr.top, width: r.width, height: r.height });
      }
    }
    if (out.length) return out;
  }
  // Metodo approssimato (pagina non ancora disegnata)
  const rects = [];
  for (let i = 0; i < idx.items.length; i++) {
    const it = idx.items[i];
    const s = idx.starts[i];
    const len = (it.str || "").length;
    if (!len || s + len <= match.start || s >= match.end) continue;
    const a = Math.max(match.start, s) - s;
    const b = Math.min(match.end, s + len) - s;
    const [, , c, d, x, y] = it.transform;
    const h = it.height || Math.hypot(c, d);
    const x0 = x + (it.width * a) / len;
    const x1 = x + (it.width * b) / len;
    const r = toViewRect(viewport, [x0, y - h * 0.2, x1, y + h * 0.95]);
    rects.push({
      left: Math.min(r[0], r[2]), top: Math.min(r[1], r[3]),
      width: Math.abs(r[2] - r[0]), height: Math.abs(r[3] - r[1]),
    });
  }
  return rects;
}

function drawHighlights(slot) {
  const hl = slot.el.querySelector(".hl");
  if (!hl) return;
  hl.innerHTML = "";
  if (!D.matches.length) return;
  const vp = vpOf(D.pages[slot.num - 1], D.scale);
  D.matches.forEach((m, i) => {
    if (m.page !== slot.num) return;
    for (const r of rectsFor(m, vp, slot)) {
      const d = document.createElement("div");
      if (i === D.current) d.className = "current";
      Object.assign(d.style, { left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px" });
      hl.appendChild(d);
    }
  });
}

function redrawAllHighlights() { slots.forEach((s) => s.rendered && drawHighlights(s)); }

function updateSearchUI() {
  const has = $("search-input").value.trim();
  const m = D ? D.matches : [];
  $("search-count").textContent = !has || !D ? "" : m.length ? `${D.current + 1}/${m.length}` : "0";
}

function scrollToMatch() {
  const m = D.matches[D.current];
  if (!m) return;
  const slot = slots[m.page - 1];
  const r = rectsFor(m, vpOf(D.pages[m.page - 1], D.scale), slot)[0];
  viewer.scrollTo({ top: slot.el.offsetTop + (r ? r.top : 0) - viewer.clientHeight / 3, behavior: "auto" });
}

function step(dir) {
  if (!D || !D.matches.length) return;
  D.current = (D.current + dir + D.matches.length) % D.matches.length;
  updateSearchUI();
  redrawAllHighlights();
  scrollToMatch();
}

let searchTimer;
$("search-input").addEventListener("input", (e) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => runSearch(e.target.value), 250);
});
$("search-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter") { e.preventDefault(); step(e.shiftKey ? -1 : 1); }
  if (e.key === "Escape") { $("search-input").value = ""; runSearch(""); e.target.blur(); }
});
$("search-next").onclick = (e) => { e.preventDefault(); step(1); };
$("search-prev").onclick = (e) => { e.preventDefault(); step(-1); };

// ======================================================
// Stampa
// ======================================================
let printing = false;
async function printPdf() {
  if (!D || printing) return;
  printing = true;
  const doc = D;
  const area = $("print-area");
  area.innerHTML = "";
  const status = $("status");
  status.hidden = false;
  const urls = [];
  try {
    for (let n = 1; n <= doc.pages.length; n++) {
      status.textContent = t("msg.printing", { n, tot: doc.pages.length });
      const pg = doc.pages[n - 1];
      const vp = pg.getViewport({ scale: 150 / 72, rotation: (pg.rotate + doc.rotation) % 360 });
      const c = document.createElement("canvas");
      c.width = Math.floor(vp.width);
      c.height = Math.floor(vp.height);
      await pg.render({ canvas: c, canvasContext: c.getContext("2d"), viewport: vp }).promise;
      const blob = await new Promise((res) => c.toBlob(res, "image/jpeg", 0.92));
      const url = URL.createObjectURL(blob);
      urls.push(url);
      const img = document.createElement("img");
      img.src = url;
      area.appendChild(img);
    }
    await Promise.all([...area.querySelectorAll("img")].map((i) => i.decode().catch(() => {})));
    status.hidden = true;
    window.print();
  } finally {
    status.hidden = true;
    printing = false;
    setTimeout(() => { area.innerHTML = ""; urls.forEach(URL.revokeObjectURL); }, 1000);
  }
}
$("btn-print").onclick = printPdf;

// ======================================================
// Tastiera
// ======================================================
window.addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
  if ((e.ctrlKey || e.metaKey) && k === "o") { e.preventDefault(); openDialog(); return; }
  if ((e.ctrlKey || e.metaKey) && k === "f") { e.preventDefault(); $("search-input").focus(); $("search-input").select(); return; }
  if ((e.ctrlKey || e.metaKey) && k === "p") { e.preventDefault(); printPdf(); return; }
  if ((e.ctrlKey || e.metaKey) && k === "w") { e.preventDefault(); if (D) closeDoc(D); return; }
  if (e.ctrlKey && e.key === "Tab" && docs.length > 1) {
    e.preventDefault();
    const i = docs.indexOf(D);
    activate(docs[(i + (e.shiftKey ? -1 : 1) + docs.length) % docs.length]);
    return;
  }
  if ((e.ctrlKey || e.metaKey) && k === "s") { e.preventDefault(); save(e.shiftKey); return; }
  if (!D || e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
  if (e.key === "F3") { e.preventDefault(); step(e.shiftKey ? -1 : 1); }
  else if ((e.ctrlKey || e.metaKey) && k === "r") { e.preventDefault(); rotate(); }
  else if ((e.ctrlKey || e.metaKey) && (e.key === "+" || e.key === "=")) { e.preventDefault(); setScale(D.scale * 1.2); }
  else if ((e.ctrlKey || e.metaKey) && e.key === "-") { e.preventDefault(); setScale(D.scale / 1.2); }
  else if ((e.ctrlKey || e.metaKey) && e.key === "0") { e.preventDefault(); toggleFit(); }
  else if ((e.ctrlKey || e.metaKey) && e.key === "2") { e.preventDefault(); toggleLayout(); }
  else if (e.key === "ArrowRight" || e.key === "PageDown") { e.preventDefault(); goTo(currentPage() + stepSize()); }
  else if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); goTo(currentPage() - stepSize()); }
  else if (e.key === "Home") goTo(1);
  else if (e.key === "End") goTo(D.pages.length);
});

window.addEventListener("beforeunload", () => savePosition(D));

// ======================================================
// Tema
// ======================================================
if (store.get("tema", "chiaro") === "scuro") document.body.classList.add("dark");
$("btn-theme").onclick = () => {
  const dark = document.body.classList.toggle("dark");
  store.set("tema", dark ? "scuro" : "chiaro");
};


// ======================================================
// Collegamento con le note (note.js)
// ======================================================
function setDirty(doc, v) { doc.dirty = v; renderTabs(); }

function renameDoc(doc, path) {
  doc.path = path;
  doc.name = baseName(path);
  addRecent(path, doc.name);
  if (doc === D) document.title = doc.name + " — " + t("app.name");
  renderTabs();
}

async function reloadDoc(doc, bytes) {
  if (!docs.includes(doc)) return; // scheda chiusa durante il salvataggio
  const keep = doc === D ? currentPage() : doc.lastPage;
  const { pdf } = await loadPdf(bytes.slice(), doc.name, doc.password);
  try { (doc.pdf.loadingTask ?? doc.pdf).destroy?.(); } catch {}
  const pages = [];
  for (let n = 1; n <= pdf.numPages; n++) pages.push(await pdf.getPage(n));
  Object.assign(doc, { pdf, pages, bytes, textCache: new Map(), pageIndex: new Map(), matches: [], current: -1 });
  await importAnnots(doc);
  if (doc === D) {
    doc.lastPage = keep;
    buildThumbs();
    buildPages(keep);
    renderNotes();
    if ($("search-input").value.trim()) runSearch($("search-input").value);
    else updateSearchUI();
  }
}

function goToPdfPoint(page, y) {
  if (!slots[page - 1]) return;
  if (y == null) return goTo(page);
  const [, vy] = vpOf(D.pages[page - 1], D.scale).convertToViewportPoint(0, y);
  viewer.scrollTo({ top: slots[page - 1].el.offsetTop + vy - viewer.clientHeight / 3, behavior: "smooth" });
}

// ======================================================
// Aiuto e informazioni
// ======================================================
function showHelp(which = "guide") {
  $("help").hidden = false;
  $("help-tab-guide").classList.toggle("active", which === "guide");
  $("help-tab-info").classList.toggle("active", which === "info");
  $("help-guide").hidden = which !== "guide";
  $("help-info").hidden = which !== "info";
}
const hideHelp = () => ($("help").hidden = true);
$("btn-help").onclick = () => showHelp();
$("help-close").onclick = hideHelp;
$("help-tab-guide").onclick = () => showHelp("guide");
$("help-tab-info").onclick = () => showHelp("info");
$("help").addEventListener("mousedown", (e) => { if (e.target === $("help")) hideHelp(); });
$("help").querySelectorAll("a[data-ext]").forEach((a) => (a.onclick = (e) => { e.preventDefault(); openExternal(a.href); }));
try { T.app.getVersion().then((v) => ($("app-version").textContent = v)); } catch {}
window.addEventListener("keydown", (e) => {
  if (e.key === "F1") { e.preventDefault(); showHelp(); }
  else if (e.key === "Escape" && !$("help").hidden) hideHelp();
});

// ======================================================
// Menu File e messaggi brevi
// ======================================================
let toastTimer;
function toast(msg) {
  const st = $("status");
  st.textContent = msg;
  st.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (st.hidden = true), 1600);
}

function closeFileMenu() {
  $("file-menu").hidden = true;
  $("btn-file").setAttribute("aria-expanded", "false");
}
$("btn-file").onclick = (e) => {
  e.stopPropagation();
  const menu = $("file-menu");
  if (!menu.hidden) return closeFileMenu();
  menu.querySelectorAll("[data-doc]").forEach((b) => (b.disabled = !D));
  const r = $("btn-file").getBoundingClientRect();
  menu.style.left = r.left + "px";
  menu.style.top = r.bottom + 6 + "px";
  menu.hidden = false;
  $("btn-file").setAttribute("aria-expanded", "true");
};
document.addEventListener("mousedown", (e) => {
  if (!$("file-menu").hidden && !$("file-menu").contains(e.target) && e.target !== $("btn-file")) closeFileMenu();
});
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeFileMenu(); });
$("file-menu").onclick = (e) => {
  const b = e.target.closest("button[data-act]");
  if (!b || b.disabled) return;
  closeFileMenu();
  const act = b.dataset.act;
  if (act === "open") openDialog();
  else if (act === "save") save(false);
  else if (act === "saveas") save(true);
  else if (act === "print") printPdf();
  else if (act === "close" && D) closeDoc(D);
  else if (act === "help") showHelp();
  else if (act === "reveal" && D) {
    const p = T?.opener?.revealItemInDir ? T.opener.revealItemInDir(D.path) : invoke("plugin:opener|reveal_item_in_dir", { paths: [D.path] });
    Promise.resolve(p).catch((err) => alert(t("msg.revealError", { err })));
  }
};

initNotes({
  $, D: () => D, slots: () => slots, vpOf, toViewRect, refit: () => refit(),
  setDirty, renameDoc, reloadDoc, goToPdfPoint, invoke, toast, validatePdf: (bytes, name, pw) => loadPdf(bytes, name, pw),
  invokeRaw: (cmd, bytes, path) => T.core.invoke(cmd, bytes, { headers: { "x-path": encodeURIComponent(path) } }),
});

// Avviso alla chiusura della finestra se ci sono modifiche non salvate
try {
  T.window.getCurrentWindow().onCloseRequested((e) => {
    savePosition(D);
    if (docs.some((d) => d.dirty) && !confirm(t("msg.quitUnsaved"))) e.preventDefault();
  });
} catch (err) { console.error(err); }

// ======================================================
// Lingua
// ======================================================
function refreshTexts() {
  applyI18n();
  updateSelMenuTexts();
  updateAutoreLabel();
  renderTabs();
  if (D) {
    updateLayoutButtons();
    buildOutline();
    renderNotes();
    document.title = D.name + " — " + t("app.name");
  } else {
    renderRecents();
    document.title = t("app.name");
  }
}
function setupLanguageSelect() {
  const sel = $("lang-select");
  sel.innerHTML = "";
  const auto = document.createElement("option");
  auto.value = "auto";
  auto.textContent = t("help.langAuto");
  sel.appendChild(auto);
  for (const code of LINGUE) {
    const o = document.createElement("option");
    o.value = code;
    o.textContent = { it: "Italiano", en: "English" }[code] || code;
    sel.appendChild(o);
  }
  sel.value = getLanguagePref();
  sel.onchange = () => { setLanguage(sel.value); refreshTexts(); setupLanguageSelect(); };
}
applyI18n();
setupLanguageSelect();

// ======================================================
// Avvio
// ======================================================
showEmpty();
window.__LPDF_READY = true;
invoke("startup_files").then(async (files) => { for (const f of files) await openPath(f); }).catch((err) => problem("startup_files: " + err));
