"""PickUp V4 laptop: parametric, licence-free (own work, CC0) aluminium laptop built in Blender.

Run headless (Blender 5.x):
  "/Applications/Blender.app/Contents/MacOS/Blender" -b --factory-startup \
      -P web/three-src/laptop/build_laptop.py -- [--glb PATH] [--renders DIR] [--poster PATH]
      [--screen IMAGE] [--samples N] [--scale PCT] [--only front,tq,...] [--no-render] [--blend PATH]

Every path is relative to the repo root (the script finds it from its own location).
Units: 1 Blender unit = 10 cm. Blender is Z-up; the glTF export is +Y up, so in three.js the
base is centred on x/z with its bottom at y = 0, and the front of the laptop faces +z.

Geometry is generated from code (rings of rounded rectangles) with analytic vertex normals, so
bevels shade smoothly with no modifier stack and no booleans.
"""
import math
import os
import sys

import bpy
from mathutils import Matrix, Vector
from mathutils.geometry import tessellate_polygon

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", "..", ".."))

# ---------------------------------------------------------------- arguments
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


def arg(name, default=None):
    if name in argv:
        i = argv.index(name)
        if i + 1 < len(argv) and not argv[i + 1].startswith("--"):
            return argv[i + 1]
        return True
    return default


def rp(p):
    return p if os.path.isabs(p) else os.path.join(REPO, p)


GLB = rp(arg("--glb", "web/three-src/laptop/out/laptop-raw.glb"))
RENDERS = rp(arg("--renders", "docs/v4/laptop"))
POSTER = rp(arg("--poster", "web/public/assets/laptop/laptop-poster.webp"))
SCREEN_IMG = rp(arg("--screen", "web/public/assets/shot-card.jpg"))
SAMPLES = int(arg("--samples", "160"))
SCALE = int(arg("--scale", "100"))
ONLY = arg("--only", None)
NO_RENDER = bool(arg("--no-render", False))
BLEND = arg("--blend", None)

# ---------------------------------------------------------------- dimensions (BU = 10 cm)
BASE_W, BASE_D, BASE_H = 3.12, 2.21, 0.15       # 312 x 221 x 15 mm
BASE_R = 0.11                                  # plan corner radius 11 mm
BASE_TOP_BEVEL, BASE_BOT_BEVEL = 0.010, 0.032  # 1 mm crisp top edge, soft 3.2 mm under-curve

LID_T = 0.055                                  # 5.5 mm
OPEN_DEG = 112.0
HINGE_R = 0.034                                # 6.8 mm barrel
HINGE_LEN = 2.62
HINGE_Y = BASE_D / 2 - 0.046                   # axis 4.6 mm in from the back edge
HINGE_Z = BASE_H + 0.030                       # barrel sits 0.4 mm into the deck
HINGE_GAP = 0.006                              # 0.6 mm visible gap between barrel and lid
LID_NEAR = -(HINGE_R + HINGE_GAP)              # lid edge nearest the hinge (lid-local y)
LID_D = (HINGE_Y + LID_NEAR) + BASE_D / 2      # closed lid front edge flush with base front
LID_FAR = LID_NEAR - LID_D
LID_CY = (LID_NEAR + LID_FAR) / 2

BEZEL_RIM = 0.020                              # aluminium rim around the black glass
BEZEL_SIDE = 0.050                             # 5 mm black border sides and top
SCREEN_W = BASE_W - 2 * BEZEL_RIM - 2 * BEZEL_SIDE
SCREEN_H = SCREEN_W / 1.6                      # 16:10

U = 0.184                                      # key pitch 18.4 mm
KEY_GAP = 0.027
KB_W = 15 * U
WELL_MARGIN = 0.020
WELL_DEPTH = 0.006                             # 0.6 mm recessed key well
WELL_BACK = 0.945                              # y of the well's back edge
KB_TOP = WELL_BACK - WELL_MARGIN
KB_D = 5.5 * U
WELL_W, WELL_D = KB_W + 2 * WELL_MARGIN, KB_D + 2 * WELL_MARGIN
WELL_CY = WELL_BACK - WELL_D / 2

TP_W, TP_D = 1.40, 0.80                        # trackpad 140 x 80 mm
TP_GROOVE = 0.003                              # 0.3 mm groove
TP_CY = -1.105 + 0.105 + TP_D / 2

# Six rows, every row 15 u so both edges are flush. (width in u, height in u)
ROWS = [
    (0.5, [15 / 14] * 14),                                   # esc + F1-F12 + power, half height
    (1.0, [1] * 13 + [2]),                                   # number row + delete
    (1.0, [1.5] + [1] * 12 + [1.5]),                         # tab row
    (1.0, [1.75] + [1] * 11 + [2.25]),                       # caps row + return
    (1.0, [2.25] + [1] * 10 + [2.75]),                       # shift 2.25 / 2.75
    (1.0, [1, 1, 1.25, 1.75, 5, 2, "ARROWS"]),               # bottom row, 5 u space centred
]

# ---------------------------------------------------------------- scene reset
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.system = "METRIC"


# ---------------------------------------------------------------- mesh builder
class MB:
    """Accumulates vertices with explicit normals and faces, then becomes one object."""

    def __init__(self):
        self.v, self.n, self.f, self.uv = [], [], [], None

    def add(self, p, n):
        self.v.append(tuple(p))
        nn = Vector(n).normalized()
        self.n.append(tuple(nn))
        return len(self.v) - 1

    def build(self, name, mat, parent=None):
        me = bpy.data.meshes.new(name)
        me.from_pydata(self.v, [], self.f)
        me.update()
        for poly in me.polygons:
            poly.use_smooth = True
        me.normals_split_custom_set_from_vertices(self.n)
        if self.uv is not None:
            layer = me.uv_layers.new(name="UVMap")
            for loop in me.loops:
                layer.data[loop.index].uv = self.uv[loop.vertex_index]
        me.materials.append(mat)
        ob = bpy.data.objects.new(name, me)
        bpy.context.collection.objects.link(ob)
        if parent is not None:
            ob.parent = parent
            ob.matrix_parent_inverse = Matrix.Identity(4)
        return ob


def rrect(hw, hd, r, cs):
    """Rounded-rect ring, CCW from +z, starting at the +x side. Returns [(x, y, nx, ny)]."""
    pts = []
    cx, cy = hw - r, hd - r
    for (sx, sy, a0) in ((1, 1, 0), (-1, 1, 90), (-1, -1, 180), (1, -1, 270)):
        for i in range(cs + 1):
            a = math.radians(a0 + 90.0 * i / cs)
            pts.append((sx * cx + r * math.cos(a), sy * cy + r * math.sin(a), math.cos(a), math.sin(a)))
    out = []
    for p in pts:
        if out and abs(out[-1][0] - p[0]) < 1e-7 and abs(out[-1][1] - p[1]) < 1e-7:
            continue
        out.append(p)
    if abs(out[0][0] - out[-1][0]) < 1e-7 and abs(out[0][1] - out[-1][1]) < 1e-7:
        out.pop()
    return out


def arc(r, z_center, o_center, phi0, phi1, segs):
    pts = []
    for j in range(segs + 1):
        phi = math.radians(phi0 + (phi1 - phi0) * j / segs)
        pts.append((o_center - r * math.cos(phi), z_center + r * math.sin(phi), math.cos(phi), math.sin(phi)))
    return pts


def slab(mb, w, d, z0, h, r, rt, rb, cs=12, bs=4, cx=0.0, cy=0.0, top=True, bottom=True, top_cap=None):
    """Rounded slab with quarter-round top/bottom edge bevels and exact normals.
    top_cap: optional callable(mb, outer_ring_pts, z) that builds the top face itself (holes)."""
    prof = arc(rb, z0 + rb, rb, -90, 0, bs) if rb > 0 else [(0.0, z0, 1.0, 0.0)]
    prof += arc(rt, z0 + h - rt, rt, 0, 90, bs) if rt > 0 else [(0.0, z0 + h, 1.0, 0.0)]
    rings = []
    for (o, z, no, nz) in prof:
        ring = rrect(w / 2 - o, d / 2 - o, r - o, cs)
        rings.append([mb.add((cx + x, cy + y, z), (no * nx, no * ny, nz)) for (x, y, nx, ny) in ring])
    for a, b in zip(rings, rings[1:]):
        n = len(a)
        for i in range(n):
            j = (i + 1) % n
            mb.f.append((a[i], a[j], b[j], b[i]))
    if bottom:
        o, z = prof[0][0], prof[0][1]
        ring = rrect(w / 2 - o, d / 2 - o, r - o, cs)
        ids = [mb.add((cx + x, cy + y, z), (0, 0, -1)) for (x, y, _, _) in ring]
        mb.f.append(tuple(reversed(ids)))
    if top:
        o, z = prof[-1][0], prof[-1][1]
        ring = rrect(w / 2 - o, d / 2 - o, r - o, cs)
        if top_cap:
            top_cap(mb, [(cx + x, cy + y) for (x, y, _, _) in ring], z)
        else:
            mb.f.append(tuple(mb.add((cx + x, cy + y, z), (0, 0, 1)) for (x, y, _, _) in ring))


def flat_rrect(mb, w, d, z, r, cs, cx=0.0, cy=0.0, normal=1):
    ring = rrect(w / 2, d / 2, r, cs)
    ids = [mb.add((cx + x, cy + y, z), (0, 0, normal)) for (x, y, _, _) in ring]
    mb.f.append(tuple(ids) if normal > 0 else tuple(reversed(ids)))


def wall_down(mb, w, d, r, cs, cx, cy, z_top, z_bot):
    """Inward-facing wall of a rounded-rect recess."""
    ring = rrect(w / 2, d / 2, r, cs)
    t = [mb.add((cx + x, cy + y, z_top), (-nx, -ny, 0)) for (x, y, nx, ny) in ring]
    b = [mb.add((cx + x, cy + y, z_bot), (-nx, -ny, 0)) for (x, y, nx, ny) in ring]
    n = len(t)
    for i in range(n):
        j = (i + 1) % n
        mb.f.append((t[i], t[j], b[j], b[i]))


# ---------------------------------------------------------------- materials
def srgb(h):
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple((x / 12.92) if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c) + (1.0,)


def principled(name, color, metallic=0.0, rough=0.5, **kw):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = color
    b.inputs["Metallic"].default_value = metallic
    b.inputs["Roughness"].default_value = rough
    for k, v in kw.items():
        b.inputs[k].default_value = v
    m.diffuse_color = color
    m.metallic = metallic
    m.roughness = rough
    return m


M = {
    "alu": principled("M_Aluminium", srgb("#d9dade"), 1.0, 0.34),
    "hinge": principled("M_Hinge", srgb("#a9aab0"), 1.0, 0.40),
    "bezel": principled("M_Bezel", srgb("#050507"), 0.0, 0.18),
    "screen": principled("M_Screen", srgb("#0b0b10"), 0.0, 0.5),
    "glass": principled("M_Glass", (1, 1, 1, 1), 0.0, 0.05, Alpha=0.10),
    "keys": principled("M_Keys", srgb("#1e1e22"), 0.0, 0.6, **{"Specular IOR Level": 0.35}),
    "well": principled("M_Well", srgb("#8c8d93"), 1.0, 0.46),
    "pad": principled("M_Trackpad", srgb("#cfd0d5"), 1.0, 0.22),
    "rubber": principled("M_Rubber", srgb("#26262b"), 0.0, 0.8),
}
M["glass"].blend_method = "BLEND" if hasattr(M["glass"], "blend_method") else None
try:
    M["glass"].surface_render_method = "BLENDED"
except Exception:
    pass

# ---------------------------------------------------------------- base
TOP = BASE_H
WELL_R = 0.030
TP_R = 0.060
TPO_W, TPO_D = TP_W + 2 * TP_GROOVE, TP_D + 2 * TP_GROOVE   # trackpad opening


def base_top(mb, outer, z):
    """Top deck with two holes (key well, trackpad opening), triangulated with holes."""
    holes = []
    for (w, d, r, cy) in ((WELL_W, WELL_D, WELL_R, WELL_CY), (TPO_W, TPO_D, TP_R + TP_GROOVE, TP_CY)):
        holes.append([(x, cy + y) for (x, y, _, _) in rrect(w / 2, d / 2, r, 16)])
    loops = [outer] + holes
    flat = [p for loop in loops for p in loop]
    tris = tessellate_polygon([[Vector((x, y, z)) for (x, y) in loop] for loop in loops])
    ids = [mb.add((x, y, z), (0, 0, 1)) for (x, y) in flat]
    for t in tris:
        a, b, c = (Vector(flat[i]) for i in t)
        cross = (b - a).x * (c - a).y - (b - a).y * (c - a).x
        mb.f.append((ids[t[0]], ids[t[1]], ids[t[2]]) if cross > 0 else (ids[t[0]], ids[t[2]], ids[t[1]]))


mb = MB()
slab(mb, BASE_W, BASE_D, 0.0, BASE_H, BASE_R, BASE_TOP_BEVEL, BASE_BOT_BEVEL, cs=16, bs=6, top_cap=base_top)
wall_down(mb, WELL_W, WELL_D, WELL_R, 16, 0, WELL_CY, TOP, TOP - WELL_DEPTH)
wall_down(mb, TPO_W, TPO_D, TP_R + TP_GROOVE, 16, 0, TP_CY, TOP, TOP - WELL_DEPTH)
base = mb.build("Base", M["alu"])

mb = MB()  # key-well floor + the floor of the trackpad groove (dark, so the 0.3 mm groove reads)
flat_rrect(mb, WELL_W, WELL_D, TOP - WELL_DEPTH, WELL_R, 16, 0, WELL_CY)
flat_rrect(mb, TPO_W, TPO_D, TOP - WELL_DEPTH, TP_R + TP_GROOVE, 16, 0, TP_CY)
mb.build("KeyWell", M["well"])

mb = MB()
slab(mb, TP_W, TP_D, TOP - WELL_DEPTH + 0.0005, WELL_DEPTH - 0.0005, TP_R, 0.0008, 0.0, cs=16, bs=2,
     cy=TP_CY, bottom=False)
mb.build("Trackpad", M["pad"])

# ---------------------------------------------------------------- keys (one mesh)
KEY_H = 0.0085
KEY_Z0 = TOP - WELL_DEPTH - 0.0005
mb = MB()


def key(x0, y_top, wu, hu):
    w, d = wu * U - KEY_GAP, hu * U - KEY_GAP
    cx, cy = x0 + wu * U / 2, y_top - hu * U / 2
    slab(mb, w, d, KEY_Z0, KEY_H, min(0.016, d / 2 - 0.001), 0.0022, 0.0, cs=4, bs=2, cx=cx, cy=cy, bottom=False)


y = KB_TOP
for (hu, keys) in ROWS:
    x = -KB_W / 2
    for k in keys:
        if k == "ARROWS":
            # inverted T: left / right / down on the lower half, up on the upper half
            key(x, y - 0.5 * U, 1, 0.5)
            key(x + U, y - 0.5 * U, 1, 0.5)
            key(x + U, y, 1, 0.5)
            key(x + 2 * U, y - 0.5 * U, 1, 0.5)
            x += 3 * U
        else:
            key(x, y, k, hu)
            x += k * U
    assert abs(x - KB_W / 2) < 1e-6, ("row not flush", x)
    y -= hu * U
mb.build("Keys", M["keys"])

# ---------------------------------------------------------------- feet
mb = MB()
for sx in (-1, 1):
    for sy in (-1, 1):
        slab(mb, 0.12, 0.12, -0.010, 0.014, 0.06, 0.0, 0.004, cs=6, bs=2,
             cx=sx * (BASE_W / 2 - 0.30), cy=sy * (BASE_D / 2 - 0.26), top=False)
mb.build("Feet", M["rubber"])

# ---------------------------------------------------------------- hinge barrel (along X)
mb = MB()
slab(mb, 2 * HINGE_R, 2 * HINGE_R, -HINGE_LEN / 2, HINGE_LEN, HINGE_R, 0.012, 0.012, cs=10, bs=4)
hinge = mb.build("Hinge", M["hinge"])
rot = Matrix.Rotation(math.radians(90), 4, "Y")   # local z -> world x
hinge.data.transform(rot)
hinge.data.update()
hinge.location = (0, HINGE_Y, HINGE_Z)

# ---------------------------------------------------------------- lid (origin on hinge axis)
mb = MB()
slab(mb, BASE_W, LID_D, -LID_T / 2, LID_T, BASE_R, 0.012, 0.006, cs=16, bs=5, cy=LID_CY)
lid = mb.build("Lid", M["alu"])
lid.location = (0, HINGE_Y, HINGE_Z)
lid.rotation_euler = (math.radians(-OPEN_DEG), 0, 0)

# Inner face is local -z. Bezel slab protrudes 1.2 mm, embedded 0.8 mm into the lid.
Z_IN = -LID_T / 2
BZ_W, BZ_D = BASE_W - 2 * BEZEL_RIM, LID_D - 2 * BEZEL_RIM
mb = MB()
slab(mb, BZ_W, BZ_D, Z_IN - 0.0012, 0.0020, BASE_R - BEZEL_RIM, 0.0, 0.0006, cs=16, bs=2, cy=LID_CY, top=False)
mb.build("Bezel", M["bezel"], lid)
Z_BZ = Z_IN - 0.0012

# Screen: 16:10, even 5 mm border on sides and top, the remainder is the chin.
SCR_FAR = LID_FAR + BEZEL_RIM + BEZEL_SIDE
SCR_NEAR = SCR_FAR + SCREEN_H
CHIN = (LID_NEAR - BEZEL_RIM) - SCR_NEAR
mb = MB()
Z_SCR = Z_BZ - 0.0004
corners = [(-SCREEN_W / 2, SCR_NEAR), (SCREEN_W / 2, SCR_NEAR), (SCREEN_W / 2, SCR_FAR), (-SCREEN_W / 2, SCR_FAR)]
# Blender UV v is flipped here on purpose: the glTF exporter writes v' = 1 - v, so in three.js the
# screen's bottom-left is uv (0,0) and a CanvasTexture (flipY = true) maps upright.
uvs = [(0, 1), (1, 1), (1, 0), (0, 0)]
ids = [mb.add((x, yy, Z_SCR), (0, 0, -1)) for (x, yy) in corners]
mb.f.append(tuple(ids))
mb.uv = uvs
screen = mb.build("Screen", M["screen"], lid)

mb = MB()
flat_rrect(mb, BZ_W, BZ_D, Z_SCR - 0.0004, BASE_R - BEZEL_RIM, 16, 0, LID_CY, normal=-1)
mb.build("ScreenGlass", M["glass"], lid)

LAPTOP = ["Base", "KeyWell", "Trackpad", "Keys", "Feet", "Hinge", "Lid", "Bezel", "Screen", "ScreenGlass"]
print("DIMS screen %.1f x %.1f mm, chin %.1f mm, lid depth %.1f mm" % (SCREEN_W * 100, SCREEN_H * 100, CHIN * 100, LID_D * 100))

# ---------------------------------------------------------------- export
os.makedirs(os.path.dirname(GLB), exist_ok=True)
bpy.ops.object.select_all(action="DESELECT")
for n in LAPTOP:
    bpy.data.objects[n].select_set(True)
bpy.ops.export_scene.gltf(
    filepath=GLB, export_format="GLB", use_selection=True, export_yup=True, export_apply=False,
    export_normals=True, export_texcoords=True, export_materials="EXPORT", export_cameras=False,
    export_lights=False, export_animations=False,
)
print("EXPORTED", GLB)
tris = sum(sum(len(p.vertices) - 2 for p in bpy.data.objects[n].data.polygons) for n in LAPTOP)
print("TRIS", tris)

if BLEND:
    bpy.ops.wm.save_as_mainfile(filepath=rp(BLEND))
if NO_RENDER:
    sys.exit(0)

# ---------------------------------------------------------------- render-only screen material
sm = M["screen"]
nt = sm.node_tree
bsdf = nt.nodes.get("Principled BSDF")
img = bpy.data.images.load(SCREEN_IMG)
tex = nt.nodes.new("ShaderNodeTexImage")
tex.image = img
tc = nt.nodes.new("ShaderNodeTexCoord")
mp = nt.nodes.new("ShaderNodeMapping")
mp.inputs["Location"].default_value = (0, 1, 0)
mp.inputs["Scale"].default_value = (1, -1, 1)
nt.links.new(tc.outputs["UV"], mp.inputs["Vector"])
nt.links.new(mp.outputs["Vector"], tex.inputs["Vector"])
nt.links.new(tex.outputs["Color"], bsdf.inputs["Emission Color"])
bsdf.inputs["Emission Strength"].default_value = 1.5
# Render-only key caps: the near-black albedo alone reads mid-grey under the big softbox, so the
# Blender studio uses a deeper charcoal and a weaker sheen (the web material stays #1e1e22).
kb = M["keys"].node_tree.nodes.get("Principled BSDF")
kb.inputs["Base Color"].default_value = srgb("#151519")
kb.inputs["Specular IOR Level"].default_value = 0.12
kb.inputs["Roughness"].default_value = 0.72
bsdf.inputs["Base Color"].default_value = (0, 0, 0, 1)
bsdf.inputs["Roughness"].default_value = 0.6

# Render-only glass: clear, with a Fresnel-weighted mirror reflection (no diffuse haze over the panel).
gm = M["glass"]
gt = gm.node_tree
for nd in list(gt.nodes):
    if nd.type != "OUTPUT_MATERIAL":
        gt.nodes.remove(nd)
out = next(nd for nd in gt.nodes if nd.type == "OUTPUT_MATERIAL")
tr = gt.nodes.new("ShaderNodeBsdfTransparent")
gl = gt.nodes.new("ShaderNodeBsdfGlossy")
gl.inputs["Roughness"].default_value = 0.04
lw = gt.nodes.new("ShaderNodeLayerWeight")
lw.inputs["Blend"].default_value = 0.12
mx = gt.nodes.new("ShaderNodeMixShader")
gt.links.new(lw.outputs["Fresnel"], mx.inputs["Fac"])
gt.links.new(tr.outputs["BSDF"], mx.inputs[1])
gt.links.new(gl.outputs["BSDF"], mx.inputs[2])
gt.links.new(mx.outputs["Shader"], out.inputs["Surface"])

# ---------------------------------------------------------------- studio
scene.render.engine = "CYCLES"
prefs = bpy.context.preferences.addons["cycles"].preferences
try:
    prefs.compute_device_type = "METAL"
    prefs.get_devices()
    for dv in prefs.devices:
        dv.use = dv.type == "METAL"
    scene.cycles.device = "GPU"
except Exception as e:  # CPU fallback
    print("GPU unavailable:", e)
scene.cycles.samples = SAMPLES
scene.cycles.use_denoising = True
scene.cycles.use_adaptive_sampling = True
scene.cycles.max_bounces = 8
scene.cycles.glossy_bounces = 6
scene.cycles.transparent_max_bounces = 8
scene.view_settings.view_transform = "AgX"
try:
    scene.view_settings.look = "AgX - Medium High Contrast"
except Exception:
    pass
scene.view_settings.exposure = -0.35
scene.render.film_transparent = True

world = bpy.data.worlds.new("Studio")
scene.world = world
world.use_nodes = True
wn = world.node_tree
bg = wn.nodes.get("Background")
# Soft studio dome: bright white overhead, lavender horizon, deeper plum-lavender below.
geo = wn.nodes.new("ShaderNodeNewGeometry")
sep = wn.nodes.new("ShaderNodeSeparateXYZ")
ramp = wn.nodes.new("ShaderNodeValToRGB")
mapr = wn.nodes.new("ShaderNodeMapRange")
wn.links.new(geo.outputs["Incoming"], sep.inputs["Vector"])
wn.links.new(sep.outputs["Z"], mapr.inputs["Value"])
mapr.inputs["From Min"].default_value = 1.0      # Incoming points from the surface to the camera,
mapr.inputs["From Max"].default_value = -1.0     # so flip it to get "world direction z"
wn.links.new(mapr.outputs["Result"], ramp.inputs["Fac"])
cr = ramp.color_ramp
cr.elements[0].position = 0.42
cr.elements[0].color = srgb("#1c1824")
cr.elements[1].position = 0.56
cr.elements[1].color = srgb("#8a8199")
e = cr.elements.new(0.95)
e.color = (1, 1, 1, 1)
wn.links.new(ramp.outputs["Color"], bg.inputs["Color"])
bg.inputs["Strength"].default_value = 0.6


def look_at(ob, target):
    d = Vector(target) - ob.location
    ob.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()


def area(name, loc, target, size, size_y, energy, color, glossy=True, shadow=False):
    ld = bpy.data.lights.new(name, "AREA")
    ld.shape = "RECTANGLE"
    ld.size, ld.size_y = size, size_y
    ld.energy = energy
    ld.color = color[:3]
    for attr in ("use_shadow",):
        if hasattr(ld, attr):
            setattr(ld, attr, shadow)
    if hasattr(ld, "cycles") and hasattr(ld.cycles, "cast_shadow"):
        ld.cycles.cast_shadow = shadow
    ob = bpy.data.objects.new(name, ld)
    scene.collection.objects.link(ob)
    ob.location = loc
    look_at(ob, target)
    try:
        ob.visible_glossy = glossy
    except Exception:
        pass
    return ob


C = Vector((0, 0.2, 0.7))
area("Key", (-5.5, -3.5, 8.0), C, 7.0, 5.0, 2600, (1, 1, 1), shadow=True)
area("Fill", (6.0, -6.5, 1.4), C, 5.0, 3.0, 420, srgb("#eadfff"))
area("Rim", (5.2, 6.0, 3.2), (0, 0.6, 0.9), 0.35, 8.0, 900, (1, 1, 1))
area("Mint", (-5.0, -3.0, -0.6), (0, 0, 0.4), 5.0, 2.0, 260, srgb("#ddfbea"))
area("Blush", (6.5, 0.5, 0.8), C, 2.5, 3.5, 300, srgb("#ffd8e8"))

bpy.ops.mesh.primitive_plane_add(size=60, location=(0, 0, -0.010))
floor = bpy.context.active_object
floor.name = "Floor"
floor.is_shadow_catcher = True

cam_d = bpy.data.cameras.new("Cam")
cam = bpy.data.objects.new("Cam", cam_d)
scene.collection.objects.link(cam)
scene.camera = cam
bpy.context.view_layer.update()

scr_c = screen.matrix_world @ Vector((0, (SCR_NEAR + SCR_FAR) / 2, Z_SCR))
lid_m = lid.matrix_world
hinge_end = Vector((-HINGE_LEN / 2 + 0.25, HINGE_Y, HINGE_Z))

VIEWS = {
    # name: (location, target, focal mm)
    "front": ((0, -13.0, 2.6), (0, 0.15, 0.95), 82),
    "tq": ((-7.6, -9.4, 4.1), (0.05, 0.25, 0.80), 74),
    "poster": ((-7.6, -9.4, 4.1), (0.02, 0.20, 0.98), 64),
    "side": ((-14.0, 0.15, 0.55), (0, 0.15, 0.85), 80),
    "keys": ((-1.55, -2.35, 1.85), (-0.55, 0.42, 0.10), 50),
    "screen": ((0.0, -5.6, 2.2), tuple(scr_c), 60),
    "hinge": ((-3.1, 2.9, 0.55), tuple(hinge_end + Vector((0.15, 0, 0.0))), 75),
}
BG = [int(srgb_c * 255) for srgb_c in (0xF4 / 255, 0xEF / 255, 0xFF / 255)]


def composite_over_bg(src, dst):
    """Flatten an RGBA render over #F4EFFF in display space (shadow-catcher alpha becomes soft shade)."""
    import numpy as np
    im = bpy.data.images.load(src)
    w, h = im.size
    px = np.array(im.pixels[:], dtype=np.float32).reshape(h, w, 4)
    a = px[..., 3:4]
    bgc = np.array([0xF4, 0xEF, 0xFF], dtype=np.float32) / 255.0
    rgb = px[..., :3] * a + bgc * (1 - a) if not im.alpha_mode == "PREMUL" else px[..., :3] + bgc * (1 - a)
    out = np.concatenate([rgb, np.ones_like(a)], axis=2)
    o = bpy.data.images.new("flat", w, h, alpha=False)
    o.pixels[:] = out.ravel()
    o.filepath_raw = dst
    o.file_format = "PNG"
    o.save()
    bpy.data.images.remove(o)
    bpy.data.images.remove(im)


def render(view, path, rx, ry):
    loc, tgt, focal = VIEWS[view]
    cam.location = loc
    look_at(cam, tgt)
    cam_d.lens = focal
    scene.render.resolution_x, scene.render.resolution_y = rx, ry
    scene.render.resolution_percentage = SCALE
    s = scene.render.image_settings
    s.file_format, s.color_mode, s.color_depth = "PNG", "RGBA", "8"
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    print("RENDERED", path)


os.makedirs(RENDERS, exist_ok=True)
tmp = os.path.join(RENDERS, "_tmp_rgba.png")
views = ONLY.split(",") if isinstance(ONLY, str) else list(VIEWS)
for v in views:
    if v == "poster":
        render("poster", os.path.join(RENDERS, "laptop-poster.png"), 2560, 1600)
        s = scene.render.image_settings
        s.file_format, s.color_mode, s.quality = "WEBP", "RGBA", 90
        os.makedirs(os.path.dirname(POSTER), exist_ok=True)
        bpy.data.images["Render Result"].save_render(POSTER)
        print("POSTER", POSTER)
    else:
        render(v, tmp, 1600, 1000)
        composite_over_bg(tmp, os.path.join(RENDERS, "blender-%s.png" % v))
if os.path.exists(tmp):
    os.remove(tmp)
