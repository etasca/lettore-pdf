// Diagnostica: rende visibili gli errori che altrimenti passerebbero in silenzio
// (script che non parte, apertura che fallisce). Script classico, caricato prima di main.js.
(function () {
  function banner(msg) {
    try {
      let b = document.getElementById("lpdf-diag");
      if (!b) {
        b = document.createElement("div");
        b.id = "lpdf-diag";
        b.style.cssText = "position:fixed;left:12px;right:12px;bottom:12px;z-index:99999;max-height:45vh;overflow:auto;" +
          "background:#3b1114;color:#ffd9d9;border:1px solid #b3262e;border-radius:10px;padding:12px 14px;" +
          "font:12px/1.5 ui-monospace,Menlo,monospace;white-space:pre-wrap;user-select:text;-webkit-user-select:text";
        const x = document.createElement("button");
        x.textContent = "×";
        x.style.cssText = "position:absolute;top:4px;right:8px;background:none;border:0;color:inherit;font-size:18px;cursor:pointer";
        x.onclick = () => b.remove();
        b.appendChild(x);
        b.appendChild(document.createElement("div"));
        (document.body || document.documentElement).appendChild(b);
      }
      const line = document.createElement("div");
      line.textContent = msg;
      b.lastChild.appendChild(line);
    } catch (_) {}
  }
  window.__lpdfShowError = banner;
  const env = () => "[" + (navigator.platform || "?") + " · " + navigator.userAgent + "]";
  window.addEventListener("error", (e) => banner("Errore: " + (e.message || "script") + (e.filename ? " (" + e.filename.split("/").pop() + ":" + e.lineno + ")" : "") + "\n" + env()));
  window.addEventListener("unhandledrejection", (e) => banner("Errore (promessa): " + (e.reason && (e.reason.stack || e.reason.message) || e.reason) + "\n" + env()));
  // Se main.js non arriva a fine avvio, i pulsanti non funzionano: dillo.
  setTimeout(() => {
    if (!window.__LPDF_READY) banner("L'app non si è avviata correttamente (main.js non è partito).\n" + env());
  }, 4000);
})();
