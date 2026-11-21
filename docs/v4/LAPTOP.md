# V4 laptop model

The hero laptop for the V4 site ("Soft Liquid Future"). It replaces the procedural
`web/src/three/Laptop.tsx` primitives with a parametric model built in Blender.

## Source and licence

- Built from scratch in Blender 5.3 by a Python script: `web/three-src/laptop/build_laptop.py`.
  No downloaded model, texture, HDRI or font is used. Own work, released CC0 with the repo.
- Modern thin-and-light silhouette. No logo, no trademark, no brand name anywhere on the model.
- Every mesh is generated from code: rings of rounded rectangles with quarter-round edge bevels and
  analytic (exact) vertex normals. No modifier stack, no booleans, so the shading has no smoothing
  artefacts and the build is fully reproducible.

## Geometry (1 unit = 10 cm)

glTF axes: +Y up, the laptop front faces +Z. The base is centred on x/z and its bottom is at y = 0.
The rubber feet stick out 1 mm below (bounding box min y = -0.0099).

| Part | Size |
| --- | --- |
| Base | 312 x 221 x 15 mm, 11 mm plan corner radius, 1 mm top edge round, 3.2 mm under-curve |
| Lid | 312 x 212.4 x 5.5 mm, open angle 112 deg (as exported) |
| Hinge barrel | 6.8 mm diameter, 262 mm long, rounded ends; 0.6 mm visible gap to the lid edge |
| Bezel | black glass panel inset 2 mm from the lid edge; 5 mm border on the sides and top, 17.2 mm chin |
| Screen | 298 x 186.2 mm (exactly 16:10), 0.4 mm in front of the bezel |
| ScreenGlass | one plane over the whole bezel, 0.4 mm in front of the screen |
| Keyboard | 15 u wide at 18.4 mm pitch (276 mm), 2.7 mm gaps, keys rise 0.2 mm above the deck |
| Key well | recessed 0.6 mm, 2 mm margin around the keys |
| Trackpad | 140 x 80 mm, flush with the deck, 0.3 mm groove all round, centred under the spacebar |
| Feet | four 12 mm discs |

Keyboard rows (every row is exactly 15 u, so both edges are flush; the script asserts it):

1. Function row, half height: 14 equal keys.
2. Number row: 13 x 1 u + delete 2 u.
3. Tab 1.5 u + 12 x 1 u + 1.5 u.
4. Caps 1.75 u + 11 x 1 u + return 2.25 u.
5. Shift 2.25 u + 10 x 1 u + shift 2.75 u.
6. Bottom: 1, 1, 1.25, 1.75, spacebar 5 u (centred on the laptop), 2 u, then an inverted-T arrow
   cluster (left, down, right on the lower half; up on the upper half).

Keys have no legends.

### Node tree (the names the loader relies on)

```
Base         M_Aluminium
KeyWell      M_Well       (key-well floor + the floor of the trackpad groove)
Trackpad     M_Trackpad
Keys         M_Keys       (all 77 caps merged into one mesh, one draw call)
Feet         M_Rubber
Hinge        M_Hinge
Lid          M_Aluminium  origin exactly on the hinge axis
  Bezel        M_Bezel
  Screen       M_Screen   UV 0..1, (0,0) = bottom-left of the visible image in three.js
  ScreenGlass  M_Glass
```

The lid is modelled closed in its local space and exported at -112 deg about local X. Setting
`lid.rotation.x = -angle` opens it (0 = closed). After optimisation the Lid node keeps its name and
transform; gltf-transform moved its own mesh into an unnamed child node that carries the
quantisation transform, which does not affect rotating the Lid.

The `Screen` UVs are written so that in three.js uv (0,0) is the bottom-left of the panel. A
`CanvasTexture` or `TextureLoader` texture with the default `flipY = true` maps upright. Checked in
the exported file: bottom edge v = 0, top edge v = 1, left u = 0.

The GLB carries no textures (the render-only screenshot is not exported).

## Materials

Materials are placeholders in the GLB; `web/src/three/LaptopModel.tsx` replaces them by name:

| Material | three.js |
| --- | --- |
| M_Aluminium | MeshPhysicalMaterial, metalness 1, roughness 0.34, #d6d7dc |
| M_Hinge | MeshPhysicalMaterial, metalness 1, roughness 0.40, #a7a8ae |
| M_Bezel | MeshBasicMaterial #050507 (unlit, never lifts to grey) |
| M_Screen | MeshBasicMaterial, `map` = the `screen` prop, `toneMapped = false` |
| M_Glass | MeshPhysicalMaterial, transparent, opacity 0.1, clearcoat 1, roughness 0.05, no depth write |
| M_Keys | MeshStandardMaterial #1e1e22, roughness 0.6 |
| M_Well | MeshPhysicalMaterial, metalness 1, roughness 0.46, #8c8d93 |
| M_Trackpad | MeshPhysicalMaterial, metalness 1, roughness 0.22, #cfd0d5 |
| M_Rubber | MeshStandardMaterial #26262b, roughness 0.85 |

Metal needs an environment map to read as aluminium (drei `<Environment>` or a `RoomEnvironment`
PMREM); without one it renders dark.

## Budget (measured)

Measured with `npx @gltf-transform/cli inspect web/public/assets/laptop/laptop.glb`:

| | Budget | Measured |
| --- | --- | --- |
| File size | 1.5 MB | 80,064 bytes (80.06 KB) |
| Triangles | 150k | 17,174 |
| Draw calls | 25 | 10 (10 meshes, one primitive each) |
| Textures | 2048 px | none |

The raw Blender export is 399.93 KB. The optimised file uses `EXT_meshopt_compression` and
`KHR_mesh_quantization` (both required by the file).

## Rebuild

From the repo root:

```sh
# 1. Build, export the raw GLB, render the six inspection images and the poster (about 3 min on an M5 Pro GPU)
"/Applications/Blender.app/Contents/MacOS/Blender" -b --factory-startup \
  -P web/three-src/laptop/build_laptop.py -- --samples 256

# Export only (no renders):
"/Applications/Blender.app/Contents/MacOS/Blender" -b --factory-startup \
  -P web/three-src/laptop/build_laptop.py -- --no-render

# 2. Optimise (the flags matter, see below)
npx --yes @gltf-transform/cli optimize web/three-src/laptop/out/laptop-raw.glb \
  web/public/assets/laptop/laptop.glb --compress meshopt --texture-compress webp \
  --flatten false --join false --simplify false --instance false --palette false \
  --prune-attributes false
```

Other script options: `--only front,tq,side,keys,screen,hinge,poster`, `--scale 50` (quick
low-resolution previews), `--glb`, `--renders`, `--poster`, `--screen` (image on the display),
`--blend PATH` (save the .blend). The raw export (`web/three-src/laptop/out/`) is a build
intermediate and is not committed.

Why the extra optimise flags: the defaults would `join` Base and Lid (both aluminium) into one
mesh and `flatten` the tree, which destroys the hinge pivot and the Lid children; `palette` merges
materials and renames them; `simplify` degrades the bevels; and `prune-attributes` drops the
screen's UVs because no exported material uses a texture.

## Renders

Cycles (Metal GPU), 256 samples with OpenImageDenoise, AgX view transform with the "Medium High
Contrast" look, exposure -0.35. Studio: 7 x 5 m soft white key top-left (the only light that
casts shadows), low lavender #EADFFF fill front-right, a 0.35 m wide white rim strip back-right,
a mint #DDFBEA bounce card bottom-left, a blush #FFD8E8 accent right, a dim plum-to-white dome for
reflections, and a shadow-catcher floor. Inspection images are rendered with a transparent film and
flattened over #F4EFFF in display space, so the background is exactly the brand colour and the
contact shadow fades out softly. The display shows `web/public/assets/shot-card.jpg` as an emission
texture (render only). In the Blender renders the key caps use a deeper charcoal and a weaker sheen
(#151519, roughness 0.72) because the screen's light reflected off #1e1e22 caps made them read
mid-grey; the web material is unchanged.

- `docs/v4/laptop/blender-front.png` (1600 x 1000)
- `docs/v4/laptop/blender-tq.png` (three-quarter)
- `docs/v4/laptop/blender-side.png` (side profile)
- `docs/v4/laptop/blender-keys.png` (keyboard close-up)
- `docs/v4/laptop/blender-screen.png` (screen close-up)
- `docs/v4/laptop/blender-hinge.png` (hinge close-up, from behind)
- `docs/v4/laptop/laptop-poster.png` (2560 x 1600, transparent, the hero poster source)
- `web/public/assets/laptop/laptop-poster.webp` (same, saved by Blender's own WebP writer at
  quality 90, alpha kept, 172,672 bytes; no sharp-cli or cwebp involved)

## Loader

`web/src/three/LaptopModel.tsx`:

```tsx
<LaptopModel screen={canvasTexture} open={0.8} position={[0, -0.5, 0]} />
// or drive the lid without React renders:
const openRef = useRef(0);
<LaptopModel screen={tex} openRef={openRef} />
```

- `useGLTF('assets/laptop/laptop.glb', false, true)`. drei 10.7.9 passes three-stdlib's
  `MeshoptDecoder` (the wasm is embedded in the JS), so nothing is fetched from a CDN and Draco is
  not used.
- `preloadLaptop()` calls `useGLTF.preload` with the same arguments.
- Exports `LAPTOP_OPEN_ANGLE` (112 deg in radians) and `LAPTOP_SIZE` for camera framing.
- Materials are created per instance and disposed on unmount; geometry stays in the GLTF cache.
- Checked in the browser with a throwaway Vite page (not committed): the GLB decodes, the
  screenshot texture maps upright, and `openRef` values 1 and 0.45 pose the lid correctly. It has
  not been checked inside the real site scene (`Story.tsx` / `LaptopScene.tsx`).

## Known issues

- No keycap legends, no camera dot, no speaker grilles or ports. The model reads as premium
  hardware at hero size, but close-ups look clean rather than detailed.
- No baked AO (skipped for time). The key well and trackpad groove rely on the dark `M_Well` floor
  and real-time shadows; in the browser a contact-shadow or SSAO pass will help.
- The hinge is a free-standing barrel above the back of the deck (the lid wraps it with a 0.6 mm
  gap). From straight on it reads as a separate bar between the lid and the base.
- The chin is 17.2 mm. That follows from a 16:10 panel with 5 mm side/top borders on a 221 mm deep
  lid; a thinner chin needs a deeper screen than 16:10 or wider side borders.
- The glass is a single plane over the bezel; at grazing angles (side view) its Fresnel reflection
  washes the screen out in the Blender render.
