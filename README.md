# 2013 Elantra maintenance guide

This is a static, local-first guide for the 2013 U.S. Hyundai Elantra 1.8L. It includes:

- 28 source-linked guide entries and four supplied SVG vehicle views;
- an accessible HTML reader with 24 maintenance entries from owner’s manual sections 7 and 8;
- a built-in PDF viewer for the original 386-page 2013 U.S. owner’s manual;
- links to the supplied Operation CHARM workshop archive.

The reader is a concise companion to the source manual, not a full transcription. Use each entry’s PDF page button to check the complete procedure, schedule, warning, or table. Equipment can vary by vehicle.

## Run locally

From this folder, run:

```sh
python3 -m http.server 8765
```

Then open `http://localhost:8765/`. A local server is needed for JavaScript modules, the PDF worker, and the PDF file. The app’s own assets work without an internet connection.

## Sources

- `2013 Hyundai Elantra (UD) Owners Manual.pdf` — U.S. owner’s manual, section 7 maintenance and section 8 specifications.
- `2013 Hyundai Elantra L4-1.8L/` — supplied Operation CHARM workshop archive. Direct procedure links are used when a guide specification was verified there.
- `SVG/Side.svg`, `SVG/Front.svg`, `SVG/Back.svg`, and `SVG/Elantra.svg` — supplied illustrations used by the vehicle map.

PDF.js 6.3.289 is bundled in `vendor/pdfjs/` with its license. The unrelated 2019 Hyundai Motor India PDF was removed as requested.
