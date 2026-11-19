// ======================================================
// Testi dell'interfaccia in italiano e inglese
// Per aggiungere una lingua: copia il blocco "en", traducilo e aggiungilo a LINGUE.
// ======================================================
export const IS_MAC = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

const STRINGS = {
  it: {
    "lang.name": "Italiano",
    "key.mod": "Ctrl", "key.shift": "Maiusc", "key.home": "Inizio", "key.end": "Fine", "key.enter": "Invio", "key.wheel": "rotella",
    "app.name": "Lettore PDF",

    // barra superiore
    "top.sidebar": "Miniature e indice",
    "top.file": "File",
    "top.search": "Cerca ({mod}+F)",
    "top.searchPrev": "Risultato precedente",
    "top.searchNext": "Risultato successivo",
    "top.notes": "Evidenziazioni e note",
    "top.print": "Stampa ({mod}+P)",
    "top.help": "Aiuto e informazioni (F1)",
    "top.theme": "Tema chiaro/scuro",
    "tab.open": "Apri PDF ({mod}+O)",
    "tab.close": "Chiudi {name}",

    // barra laterale
    "side.pages": "Pagine",
    "side.outline": "Indice",
    "side.noOutline": "Questo PDF non ha un indice.",
    "side.page": "Pagina {n}",

    // schermata iniziale
    "empty.title": "Trascina qui un PDF",
    "empty.or": "oppure",
    "empty.open": "Apri un file",
    "empty.hint": "{mod}+O apre · {mod}+F cerca · {mod}+P stampa · {mod}+W chiude · {mod}+R ruota",
    "recent.title": "Aperti di recente",
    "recent.remove": "Togli dai recenti",
    "recent.removeName": "Togli {name} dai recenti",

    // barra strumenti
    "tb.prev": "Pagina precedente",
    "tb.next": "Pagina successiva",
    "tb.page": "Pagina",
    "tb.zoomOut": "Riduci",
    "tb.zoomIn": "Ingrandisci",
    "tb.fitWidth": "Adatta alla larghezza ({mod}+0)",
    "tb.fitPage": "Adatta alla pagina intera ({mod}+0)",
    "tb.double": "Due pagine affiancate ({mod}+2)",
    "tb.single": "Una pagina ({mod}+2)",
    "tb.rotate": "Ruota ({mod}+R)",

    // menu File
    "menu.open": "Apri…",
    "menu.save": "Salva",
    "menu.saveAs": "Salva con nome…",
    "menu.print": "Stampa…",
    "menu.reveal": "Mostra nella cartella",
    "menu.close": "Chiudi scheda",
    "menu.help": "Aiuto e informazioni",

    // note
    "notes.title": "Evidenziazioni e note",
    "notes.hint": "{mod}+S salva nel PDF · {mod}+{shift}+S salva con nome",
    "notes.empty": "Nessuna evidenziazione.<br>Seleziona del testo nel PDF e scegli un colore.",
    "notes.page": "Pagina {n}",
    "notes.unsaved": "da salvare",
    "notes.delete": "Elimina evidenziazione",
    "notes.placeholder": "Scrivi un commento…",
    "notes.author": "Autore: {name}",
    "notes.setAuthor": "Imposta autore",
    "notes.askAuthor": "Con quale nome vuoi firmare le note nei PDF?",
    "color.0": "giallo", "color.1": "verde", "color.2": "azzurro", "color.3": "rosa",
    "sel.highlight": "Evidenzia in {color}",
    "sel.note": "Nota",
    "sel.noteTitle": "Evidenzia e aggiungi un commento",

    // messaggi
    "msg.saving": "Salvataggio…",
    "msg.updating": "Aggiorno il documento…",
    "msg.saved": "Salvato",
    "msg.noChanges": "Nessuna modifica da salvare",
    "msg.saveError": "Non sono riuscito a salvare:\n{err}\n\nSe il file è aperto in un altro programma, chiudilo e riprova.",
    "msg.readError": "Impossibile leggere il file:\n{err}",
    "msg.invalidPdf": "Questo file non sembra un PDF valido:\n{err}",
    "msg.openError": "Errore nella finestra Apri: {err}",
    "msg.revealError": "Non riesco ad aprire la cartella:\n{err}",
    "msg.closeUnsaved": "\"{name}\" ha modifiche non salvate.\nChiudere senza salvare?",
    "msg.quitUnsaved": "Ci sono modifiche non salvate.\nUscire senza salvare?",
    "msg.printing": "Preparo la stampa… {n}/{tot}",
    "msg.password": "\"{name}\" è protetto da password.\nInserisci la password:",
    "msg.passwordWrong": "Password errata. Riprova:",
    "msg.encryptedSave": "Questo PDF è protetto da password: per ora non è possibile salvarci dentro le note.",
    "msg.signedWarn": "Questo PDF contiene una firma digitale.\nSe salvi le note sopra l'originale, la firma non sarà più valida.\n\nPer lasciare intatto il documento firmato annulla e usa \"Salva con nome\".\nSalvare comunque sopra l'originale?",
    "annot.suffix": " - annotato",

    // aiuto
    "help.guide": "Guida",
    "help.info": "Informazioni",
    "help.close": "Chiudi",
    "help.guideHtml": `
      <h2 id="help-title">Come si usa</h2>
      <p><b>Aprire un PDF:</b> trascinalo nella finestra, usa <kbd>{mod}</kbd>+<kbd>O</kbd> o il pulsante <b>+</b>. Puoi tenere aperti più PDF in schede. Ogni file si riapre alla pagina dove l'avevi lasciato.</p>
      <p><b>Cercare:</b> <kbd>{mod}</kbd>+<kbd>F</kbd>, poi <kbd>Invio</kbd> per il risultato successivo e <kbd>{shift}</kbd>+<kbd>Invio</kbd> per il precedente.</p>
      <p><b>Evidenziare e commentare:</b> seleziona del testo e scegli un colore dal menu che compare, oppure <b>Nota</b> per aggiungere un commento. Le note sono nel pannello che si apre con l'icona del fumetto.</p>
      <p><b>Salvare:</b> le evidenziazioni vengono scritte dentro il PDF con <kbd>{mod}</kbd>+<kbd>S</kbd>, e sono visibili anche in Acrobat, Edge e negli altri lettori. Usa <b>Salva con nome</b> se vuoi lasciare intatto l'originale. Un pallino • sulla scheda indica modifiche non salvate.</p>
      <h2>Scorciatoie da tastiera</h2>
      <table class="keys">
        <tr><td><kbd>{mod}</kbd>+<kbd>O</kbd></td><td>Apri</td><td><kbd>{mod}</kbd>+<kbd>S</kbd></td><td>Salva</td></tr>
        <tr><td><kbd>{mod}</kbd>+<kbd>{shift}</kbd>+<kbd>S</kbd></td><td>Salva con nome</td><td><kbd>{mod}</kbd>+<kbd>P</kbd></td><td>Stampa</td></tr>
        <tr><td><kbd>{mod}</kbd>+<kbd>W</kbd></td><td>Chiudi scheda</td><td><kbd>Ctrl</kbd>+<kbd>Tab</kbd></td><td>Scheda successiva</td></tr>
        <tr><td><kbd>{mod}</kbd>+<kbd>F</kbd></td><td>Cerca</td><td><kbd>F3</kbd></td><td>Risultato successivo</td></tr>
        <tr><td><kbd>{mod}</kbd>+<kbd>+</kbd> / <kbd>−</kbd></td><td>Zoom</td><td><kbd>{mod}</kbd>+rotella</td><td>Zoom</td></tr>
        <tr><td><kbd>{mod}</kbd>+<kbd>0</kbd></td><td>Larghezza / pagina intera</td><td><kbd>{mod}</kbd>+<kbd>2</kbd></td><td>Una o due pagine</td></tr>
        <tr><td><kbd>{mod}</kbd>+<kbd>R</kbd></td><td>Ruota</td><td><kbd>←</kbd> <kbd>→</kbd></td><td>Pagina precedente / successiva</td></tr>
        <tr><td><kbd>Inizio</kbd> / <kbd>Fine</kbd></td><td>Prima / ultima pagina</td><td><kbd>F1</kbd></td><td>Questa guida</td></tr>
      </table>`,
    "help.version": "Versione",
    "help.tagline": "Un lettore PDF leggero, senza pubblicità e senza account, per Windows e Mac.",
    "help.licenseHtml": `Ideato e progettato da <b>{author}</b>.<br>Rilasciato con licenza <b>MIT</b>: gratuito, puoi usarlo, modificarlo e ridistribuirlo liberamente. Viene fornito così com'è, senza garanzie.`,
    "help.credits": "Crediti",
    "help.creditsIntro": "Lettore PDF esiste grazie a questi progetti open source:",
    "help.creditPdfjs": "di Mozilla, per la visualizzazione dei PDF (licenza Apache 2.0)",
    "help.creditPdflib": "per scrivere note ed evidenziazioni nei PDF (licenza MIT)",
    "help.creditTauri": "per l'applicazione desktop (licenze MIT / Apache 2.0)",
    "help.language": "Lingua",
    "help.langAuto": "Automatica (come il sistema)",
  },

  en: {
    "lang.name": "English",
    "key.mod": "Ctrl", "key.shift": "Shift", "key.home": "Home", "key.end": "End", "key.enter": "Enter", "key.wheel": "wheel",
    "app.name": "Lettore PDF",

    "top.sidebar": "Thumbnails and outline",
    "top.file": "File",
    "top.search": "Search ({mod}+F)",
    "top.searchPrev": "Previous result",
    "top.searchNext": "Next result",
    "top.notes": "Highlights and notes",
    "top.print": "Print ({mod}+P)",
    "top.help": "Help and about (F1)",
    "top.theme": "Light/dark theme",
    "tab.open": "Open PDF ({mod}+O)",
    "tab.close": "Close {name}",

    "side.pages": "Pages",
    "side.outline": "Outline",
    "side.noOutline": "This PDF has no outline.",
    "side.page": "Page {n}",

    "empty.title": "Drop a PDF here",
    "empty.or": "or",
    "empty.open": "Open a file",
    "empty.hint": "{mod}+O open · {mod}+F search · {mod}+P print · {mod}+W close · {mod}+R rotate",
    "recent.title": "Recently opened",
    "recent.remove": "Remove from recents",
    "recent.removeName": "Remove {name} from recents",

    "tb.prev": "Previous page",
    "tb.next": "Next page",
    "tb.page": "Page",
    "tb.zoomOut": "Zoom out",
    "tb.zoomIn": "Zoom in",
    "tb.fitWidth": "Fit width ({mod}+0)",
    "tb.fitPage": "Fit whole page ({mod}+0)",
    "tb.double": "Two pages side by side ({mod}+2)",
    "tb.single": "Single page ({mod}+2)",
    "tb.rotate": "Rotate ({mod}+R)",

    "menu.open": "Open…",
    "menu.save": "Save",
    "menu.saveAs": "Save as…",
    "menu.print": "Print…",
    "menu.reveal": "Show in folder",
    "menu.close": "Close tab",
    "menu.help": "Help and about",

    "notes.title": "Highlights and notes",
    "notes.hint": "{mod}+S save into the PDF · {mod}+{shift}+S save as",
    "notes.empty": "No highlights yet.<br>Select some text in the PDF and pick a color.",
    "notes.page": "Page {n}",
    "notes.unsaved": "unsaved",
    "notes.delete": "Delete highlight",
    "notes.placeholder": "Write a comment…",
    "notes.author": "Author: {name}",
    "notes.setAuthor": "Set author",
    "notes.askAuthor": "Which name do you want to sign your PDF notes with?",
    "color.0": "yellow", "color.1": "green", "color.2": "blue", "color.3": "pink",
    "sel.highlight": "Highlight in {color}",
    "sel.note": "Note",
    "sel.noteTitle": "Highlight and add a comment",

    "msg.saving": "Saving…",
    "msg.updating": "Updating the document…",
    "msg.saved": "Saved",
    "msg.noChanges": "No changes to save",
    "msg.saveError": "Could not save:\n{err}\n\nIf the file is open in another program, close it and try again.",
    "msg.readError": "Could not read the file:\n{err}",
    "msg.invalidPdf": "This file doesn't look like a valid PDF:\n{err}",
    "msg.openError": "Error in the Open dialog: {err}",
    "msg.revealError": "Could not open the folder:\n{err}",
    "msg.closeUnsaved": "\"{name}\" has unsaved changes.\nClose without saving?",
    "msg.quitUnsaved": "There are unsaved changes.\nQuit without saving?",
    "msg.printing": "Preparing to print… {n}/{tot}",
    "msg.password": "\"{name}\" is password protected.\nEnter the password:",
    "msg.passwordWrong": "Wrong password. Try again:",
    "msg.encryptedSave": "This PDF is password protected: saving notes into it is not supported yet.",
    "msg.signedWarn": "This PDF contains a digital signature.\nSaving notes over the original will invalidate the signature.\n\nTo keep the signed document intact, cancel and use \"Save as\".\nSave over the original anyway?",
    "annot.suffix": " - annotated",

    "help.guide": "Guide",
    "help.info": "About",
    "help.close": "Close",
    "help.guideHtml": `
      <h2 id="help-title">How to use it</h2>
      <p><b>Open a PDF:</b> drop it into the window, press <kbd>{mod}</kbd>+<kbd>O</kbd> or click <b>+</b>. You can keep several PDFs open in tabs. Each file reopens at the page where you left it.</p>
      <p><b>Search:</b> <kbd>{mod}</kbd>+<kbd>F</kbd>, then <kbd>Enter</kbd> for the next result and <kbd>{shift}</kbd>+<kbd>Enter</kbd> for the previous one.</p>
      <p><b>Highlight and comment:</b> select some text and pick a color from the menu that appears, or <b>Note</b> to add a comment. Your notes are in the panel that opens with the speech-bubble icon.</p>
      <p><b>Save:</b> highlights are written into the PDF with <kbd>{mod}</kbd>+<kbd>S</kbd>, and they show up in Acrobat, Edge and other readers too. Use <b>Save as</b> to keep the original untouched. A dot • on the tab means there are unsaved changes.</p>
      <h2>Keyboard shortcuts</h2>
      <table class="keys">
        <tr><td><kbd>{mod}</kbd>+<kbd>O</kbd></td><td>Open</td><td><kbd>{mod}</kbd>+<kbd>S</kbd></td><td>Save</td></tr>
        <tr><td><kbd>{mod}</kbd>+<kbd>{shift}</kbd>+<kbd>S</kbd></td><td>Save as</td><td><kbd>{mod}</kbd>+<kbd>P</kbd></td><td>Print</td></tr>
        <tr><td><kbd>{mod}</kbd>+<kbd>W</kbd></td><td>Close tab</td><td><kbd>Ctrl</kbd>+<kbd>Tab</kbd></td><td>Next tab</td></tr>
        <tr><td><kbd>{mod}</kbd>+<kbd>F</kbd></td><td>Search</td><td><kbd>F3</kbd></td><td>Next result</td></tr>
        <tr><td><kbd>{mod}</kbd>+<kbd>+</kbd> / <kbd>−</kbd></td><td>Zoom</td><td><kbd>{mod}</kbd>+wheel</td><td>Zoom</td></tr>
        <tr><td><kbd>{mod}</kbd>+<kbd>0</kbd></td><td>Fit width / whole page</td><td><kbd>{mod}</kbd>+<kbd>2</kbd></td><td>One or two pages</td></tr>
        <tr><td><kbd>{mod}</kbd>+<kbd>R</kbd></td><td>Rotate</td><td><kbd>←</kbd> <kbd>→</kbd></td><td>Previous / next page</td></tr>
        <tr><td><kbd>Home</kbd> / <kbd>End</kbd></td><td>First / last page</td><td><kbd>F1</kbd></td><td>This guide</td></tr>
      </table>`,
    "help.version": "Version",
    "help.tagline": "A lightweight PDF reader with no ads and no account, for Windows and Mac. (\"Lettore PDF\" is Italian for \"PDF reader\".)",
    "help.licenseHtml": `Conceived and designed by <b>{author}</b>.<br>Released under the <b>MIT</b> license: free to use, modify and redistribute. Provided as is, without warranty.`,
    "help.credits": "Credits",
    "help.creditsIntro": "Lettore PDF is built on these open-source projects:",
    "help.creditPdfjs": "by Mozilla, for rendering PDFs (Apache 2.0 license)",
    "help.creditPdflib": "for writing notes and highlights into PDFs (MIT license)",
    "help.creditTauri": "for the desktop application (MIT / Apache 2.0 licenses)",
    "help.language": "Language",
    "help.langAuto": "Automatic (same as the system)",
  },
};

export const LINGUE = Object.keys(STRINGS);
export const AUTHOR = "Ermanno Tasca";

function detect() {
  let pref = "auto";
  try { pref = localStorage.getItem("lingua") || "auto"; } catch {}
  if (pref !== "auto" && STRINGS[pref]) return pref;
  const sys = (navigator.languages?.[0] || navigator.language || "en").slice(0, 2).toLowerCase();
  return STRINGS[sys] ? sys : "en";
}

export let LANG = detect();

export function setLanguage(pref) {
  try { localStorage.setItem("lingua", pref); } catch {}
  LANG = detect();
  applyI18n();
}

export function getLanguagePref() {
  try { return localStorage.getItem("lingua") || "auto"; } catch { return "auto"; }
}

export function t(key, vars = {}) {
  const dict = STRINGS[LANG] || STRINGS.en;
  let s = dict[key] ?? STRINGS.en[key] ?? key;
  const all = {
    mod: IS_MAC ? "⌘" : "Ctrl",
    shift: IS_MAC ? "⇧" : dict["key.shift"],
    author: AUTHOR,
    ...vars,
  };
  return s.replace(/\{(\w+)\}/g, (m, k) => (k in all ? all[k] : m));
}

// Applica i testi agli elementi con attributi data-i18n
export function applyI18n(root = document) {
  document.documentElement.lang = LANG;
  root.querySelectorAll("[data-i18n]").forEach((el) => (el.textContent = t(el.dataset.i18n)));
  root.querySelectorAll("[data-i18n-html]").forEach((el) => (el.innerHTML = t(el.dataset.i18nHtml)));
  root.querySelectorAll("[data-i18n-title]").forEach((el) => (el.title = t(el.dataset.i18nTitle)));
  root.querySelectorAll("[data-i18n-aria]").forEach((el) => el.setAttribute("aria-label", t(el.dataset.i18nAria)));
  root.querySelectorAll("[data-i18n-placeholder]").forEach((el) => (el.placeholder = t(el.dataset.i18nPlaceholder)));
}
