# Image assets to export from Figma

Everything in the design that is *text, colour, layout, buttons, icons, the
footer, the testimonial cards and the brand-logo row* has been rebuilt as real
HTML/CSS — no image needed.

What's left below is genuine photography and UI screenshots. Each one has a
placeholder slot in `index.html` marked with the `asset-slot` class. Export the
file, drop it in this folder under the exact name given, then delete
`asset-slot` (or `asset-slot-dark`) from that element's class list so the dashed
placeholder styling disappears.

Source file: <https://www.figma.com/design/RQIzpIKvNRsXHkme7ejbcO/Untitled>

| Filename                | Figma layer                                    | Node   | Export size   |
| ----------------------- | ---------------------------------------------- | ------ | ------------- |
| `hero-collage.png`      | `upscalemedia-transformed`                     | `5:22` | 754 × 562 @2x |
| `creator-overview.png`  | `creator overview`                             | `5:54` | 753 × 371 @2x |
| `brands-dashboard.png`  | `Layer 1`                                      | `5:92` | 797 × 325 @2x |
| `cta-creator.png`       | `For Creators`                                 | `5:97` | 596 × 180 @2x |
| `cta-brand.png`         | `Layer 1 copy 2`                               | `5:99` | 211 × 186 @2x |
| `avatar-1.png` … `-4`   | crops from `profiles`                          | `5:32` | 88 × 88       |
| `testimonial-1.png` … `-3` | faces inside `Gemini_Generated_Image_…`     | `5:82` | 96 × 96       |

## How to export

1. Open the file in Figma and select the layer by name (⌘/Ctrl + F searches layers).
2. In the right sidebar, **Export** → `+` → PNG, `2x`.
3. Save into this folder using the filename from the table.

## Already sourced from `zaumu-beta/public`

These are done — no action needed:

- `/logo-black.png` — nav wordmark. Cropped from `logo_dark.png` (a 2209 × 2209
  canvas that was mostly empty) and downscaled to 440 × 214, 52 KB → 26 KB.
- `/logo-white.png` — footer wordmark, from `logo.png`.
- `/favicon.ico`, `/icon-192x192.png`, `/icon-512x512.png`,
  `/apple-icon-180x180.png` — the ZA monogram.
- `/icons/socials/*.svg` — the six brand social icons, copied as-is.

Heads up: in the beta app the logo naming is inverted from what you'd expect —
`logo.png` is the **white** mark and `logo_dark.png` is the **black** one. The
copies here are named by ink colour instead. Also, `logo.svg` / `logo_dark.svg`
are not real vectors: each is a `<rect>` filled with a base64-embedded bitmap,
which is why they weigh ~750 KB. The PNGs are smaller and identical in quality.

## Notes

- **Avatars and testimonial faces are baked into larger flattened PNGs** in the
  design (`profiles`, `Gemini_Generated_Image_…`), so they need cropping out —
  or better, swap in the real headshots of the people being quoted.
- **Feature-card and step icons** are currently hand-drawn inline SVGs that
  approximate the design. If the originals matter, export nodes `5:37`, `5:41`,
  `5:45`, `5:49` (feature cards) and `5:62`, `5:65`, `5:68`, `5:71` (steps) as
  SVG and swap them in.
- **Brand logos** (Nike, Safaricom, Absa, Tusker, Bolt, Showmax) are set as
  styled text placeholders. Replace them with properly licensed logo SVGs before
  going live — these are third-party trademarks and the versions in the design
  are a flattened screenshot.
