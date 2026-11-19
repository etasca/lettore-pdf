# Componenti di terze parti / Third-party components

Lettore PDF include o usa questi progetti open source. / Lettore PDF includes or uses these open-source projects.

| Componente | Uso | Licenza | Testo della licenza |
|---|---|---|---|
| [PDF.js](https://github.com/mozilla/pdf.js) (Mozilla) | Visualizzazione dei PDF | Apache License 2.0 | `src/vendor/LICENSE-pdfjs.txt` |
| [pdf-lib](https://github.com/Hopding/pdf-lib) | Scrittura di note ed evidenziazioni nei PDF | MIT | `src/vendor/LICENSE-pdf-lib.md` |
| [Tauri](https://github.com/tauri-apps/tauri) e plugin ufficiali | Applicazione desktop | MIT / Apache License 2.0 | https://github.com/tauri-apps/tauri |

I file di PDF.js in `src/vendor/` (pdf.min.mjs, pdf.worker.min.mjs, cmaps, standard_fonts, textlayer.css) non sono stati modificati, tranne `textlayer.css`, estratto da `pdf_viewer.css`.
