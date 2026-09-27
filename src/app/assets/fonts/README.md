# Render fonts

Font buffers read off disk at request time by `src/services/render-fonts.service.ts`
and handed to satori. **Nothing imports these files**, so `next.config.ts` traces the
folder wholesale — a new face here needs no build-config change.

satori reads **TTF, OTF and WOFF. It does not read WOFF2.** Never substitute a `.woff2`
here; it fails silently, falling back to the one Regular face next/og bundles, and
every weight then rasterises identically.

| File | Family | Licence | Source |
|---|---|---|---|
| `Geist-400.woff`, `Geist-700.woff` | Geist | OFL 1.1 | vercel/geist-font |
| `Marker-400.ttf` | Permanent Marker | OFL 1.1 | Google Fonts |
| `Caveat-400.ttf`, `Caveat-700.ttf` | Caveat | OFL 1.1 | Google Fonts |

All are licensed under the SIL Open Font License 1.1, which permits bundling and
redistribution inside an application. The licence requires that the fonts not be sold
on their own and that any derivative font keep the same licence — neither of which
this repo does. Full text: <https://openfontlicense.org>.

Registered in `RENDER_FONT_FAMILIES`. A layout names a family; it never names a file.
