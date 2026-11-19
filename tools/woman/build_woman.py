#!/usr/bin/env python3
"""
Builds a realistic, rigged woman for the Agentium HQ rooftop as a .glb.

Source: the MakeHuman / MPFB2 base mesh, shape targets, game-engine rig and
skin weights (all CC0, https://github.com/makehumancommunity/mpfb2).
On top of that this script paints a skin + make-up texture, colours the eyes,
and generates a string bikini that follows the body surface.

    python3 tools/woman/build_woman.py --data <mpfb2>/src/mpfb/data --out public/models/woman.glb [--look look.json]
"""
import argparse, gzip, json, math, os, struct, sys
import numpy as np
from PIL import Image

# ----------------------------------------------------------------------------- look
DEFAULT_LOOK = {
    "ethnic": {"caucasian": 0.7, "african": 0.05, "asian": 0.25},
    "skin": [0.92, 0.74, 0.62],          # linear-ish sRGB 0..1
    "lips": [0.62, 0.18, 0.24],
    "brows": [0.20, 0.13, 0.09],
    "iris": [0.30, 0.42, 0.25],
    "bikini": [0.70, 0.08, 0.16],
    "hair": [0.16, 0.09, 0.05],
    "height": 0.35,                      # 0..1 towards max height
    "cup": 0.88, "firmness": 0.78,
    "targets": {
        # body: slim, long-legged, curvy hips and bottom, narrow waist
        "buttocks/buttocks-volume-incr": 0.75,
        "hip/hip-scale-horiz-incr": 0.25,
        "torso/measure-waist-circ-decr": 0.7,
        "torso/measure-hips-circ-incr": 0.35,
        "stomach/stomach-pregnant-decr": 0.45,
        "torso/torso-vshape-decr": 0.25,
        "torso/measure-shoulder-dist-decr": 0.35,
        "neck/measure-neck-circ-decr": 0.35,
        "neck/measure-neck-height-incr": 0.25,
        "legs/lowerlegs-height-incr": 0.25,
        "arms/lowerarm-scale-horiz-decr": 0.0,
        # face: oval, defined cheekbones, small nose, full lips, soft smile
        "head/head-oval": 0.5,
        "chin/chin-width-decr": 0.35,
        "chin/chin-prominent-incr": 0.15,
        "nose/nose-scale-horiz-decr": 0.35,
        "nose/nose-point-width-decr": 0.4,
        "nose/nose-volume-decr": 0.25,
        "nose/nose-point-up": 0.2,
        "mouth/mouth-lowerlip-volume-incr": 0.55,
        "mouth/mouth-upperlip-volume-incr": 0.45,
        "mouth/mouth-cupidsbow-incr": 0.4,
        "mouth/mouth-angles-up": 0.25,
        "cheek/l-cheek-bones-incr": 0.45, "cheek/r-cheek-bones-incr": 0.45,
        "cheek/l-cheek-volume-decr": 0.25, "cheek/r-cheek-volume-decr": 0.25,
        "eyes/l-eye-scale-incr": 0.15, "eyes/r-eye-scale-incr": 0.15,
        "eyes/l-eye-corner1-up": 0.2, "eyes/r-eye-corner1-up": 0.2,
        "eyebrows/eyebrows-angle-up": 0.2,
    },
}


# ----------------------------------------------------------------------------- loading
def load_obj(path):
    V, VT, F, FT = [], [], [], []
    for line in open(path):
        if line.startswith('v '):
            V.append([float(x) for x in line.split()[1:4]])
        elif line.startswith('vt '):
            VT.append([float(x) for x in line.split()[1:3]])
        elif line.startswith('f '):
            idx = [p.split('/') for p in line.split()[1:]]
            F.append([int(p[0]) - 1 for p in idx])
            FT.append([int(p[1]) - 1 for p in idx])
    return np.array(V), np.array(VT), F, FT


def load_target(path):
    with gzip.open(path, 'rt') as f:
        rows = [l.split() for l in f if l.strip() and not l.startswith('#')]
    idx = np.array([int(r[0]) for r in rows])
    d = np.array([[float(x) for x in r[1:4]] for r in rows])
    return idx, d


def group_range(groups, name):
    out = []
    for a, b in groups[name]:
        out.extend(range(a, b + 1))
    return np.array(out)


# ----------------------------------------------------------------------------- main build
def build(data, look, out_path):
    V, VT, F, FT = load_obj(os.path.join(data, '3dobjs/base.obj'))
    groups = json.load(open(os.path.join(data, 'mesh_metadata/basemesh_vertex_groups.json')))
    T = os.path.join(data, 'targets')
    applied = []

    def apply(rel, w):
        if abs(w) < 1e-4:
            return
        p = os.path.join(T, rel + '.target.gz')
        if not os.path.exists(p):
            print('  (missing target)', rel, file=sys.stderr)
            return
        i, d = load_target(p)
        if len(i) == 0:
            return
        V[i] += d * w
        applied.append((rel, round(w, 3)))

    # macro: adult woman (young = ~25 years), average muscle, slightly slim
    apply('macrodetails/universal-female-young-averagemuscle-averageweight', 0.8)
    apply('macrodetails/universal-female-young-averagemuscle-minweight', 0.2)
    for eth, w in look['ethnic'].items():
        apply(f'macrodetails/{eth}-female-young', w)
    apply('macrodetails/proportions/female-young-averagemuscle-averageweight-idealproportions', 1.0)
    apply('macrodetails/height/female-young-averagemuscle-averageweight-maxheight', look['height'])
    # bust: bilinear mix of cup size and firmness
    t, f = look['cup'], look['firmness']
    pre = 'breast/female-young-averagemuscle-averageweight-'
    tc, tf = max(0, (t - 0.5) * 2), max(0, (f - 0.5) * 2)
    apply(pre + 'averagecup-maxfirmness', (1 - tc) * tf)
    apply(pre + 'maxcup-averagefirmness', tc * (1 - tf))
    apply(pre + 'maxcup-maxfirmness', tc * tf)
    for rel, w in look['targets'].items():
        apply(rel, w)

    V = V * 0.1  # decimetres -> metres

    body_n = 13380
    # faces of the skin only
    body_faces = [(f, ft) for f, ft in zip(F, FT) if max(f) < body_n]
    eye_idx = set(group_range(groups, 'helper-l-eye')) | set(group_range(groups, 'helper-r-eye'))
    eye_faces = [(f, ft) for f, ft in zip(F, FT) if all(v in eye_idx for v in f)]
    lash_idx = set()
    for g in ['helper-l-eyelashes-1', 'helper-l-eyelashes-2', 'helper-r-eyelashes-1', 'helper-r-eyelashes-2']:
        lash_idx |= set(group_range(groups, g))
    lash_faces = []  # the helper lash shells read as thick black rings; lashes are painted instead
    # the hair helper also has long hanging strips for long-hair proxies: keep only the part on the skull
    eyes_mid = (V[group_range(groups, 'joint-l-eye')].mean(0) + V[group_range(groups, 'joint-r-eye')].mean(0)) / 2
    skull = eyes_mid + np.array([0, 0.022, -0.072])
    hair_all = group_range(groups, 'helper-hair')
    dist = np.linalg.norm(V[hair_all] - skull, axis=1)
    r_med = np.median(dist)
    keep = (dist < r_med * 1.12) & (V[hair_all, 1] > eyes_mid[1] - 0.075)
    keep &= ~((V[hair_all, 2] > skull[2] + 0.02) & (V[hair_all, 1] < eyes_mid[1] + 0.045))
    hair_idx = hair_all[keep]
    hair_set = set(hair_idx.tolist())
    scalp_faces = [(f, ft) for f, ft in zip(F, FT) if all(v in hair_set for v in f)]
    print(f'  scalp: {len(hair_idx)}/{len(hair_all)} helper verts on the skull, {len(scalp_faces)} faces')

    def joint(name):
        return V[group_range(groups, name)].mean(0)

    # ------------------------------------------------------------- rig
    rig = json.load(open(os.path.join(data, 'rigs/standard/rig.game_engine.json')))
    wts = json.load(open(os.path.join(data, 'rigs/standard/weights.game_engine.json')))['weights']

    def point(spec):
        s = spec['strategy']
        if s == 'CUBE':
            return joint(spec['cube_name'])
        if s == 'MEAN':
            return V[spec['vertex_indices']].mean(0)
        if s == 'VERTEX':
            return V[spec['vertex_index']]
        return np.array(spec['default_position'])

    bones = list(rig.keys())
    head = {b: point(rig[b]['head']) for b in bones}
    tail = {b: point(rig[b]['tail']) for b in bones}
    parent = {b: rig[b]['parent'] or None for b in bones}
    order = []
    def visit(b):
        if b in order:
            return
        if parent[b]:
            visit(parent[b])
        order.append(b)
    for b in bones:
        visit(b)
    bidx = {b: i for i, b in enumerate(order)}

    nverts = len(V)
    J = np.zeros((nverts, 4), np.uint16)
    W = np.zeros((nverts, 4), np.float32)
    per = [[] for _ in range(nverts)]
    for b, lst in wts.items():
        if b not in bidx:
            continue
        for vi, w in lst:
            if vi < nverts:
                per[vi].append((w, bidx[b]))
    head_bone = bidx.get('head', 0)
    for vi in range(nverts):
        lst = sorted(per[vi], reverse=True)[:4]
        if not lst:
            lst = [(1.0, head_bone)]
        s = sum(w for w, _ in lst)
        for k, (w, b) in enumerate(lst):
            J[vi, k] = b
            W[vi, k] = w / s
    # eyes and lashes follow the head
    for vi in eye_idx | lash_idx | hair_set:
        J[vi] = [head_bone, 0, 0, 0]
        W[vi] = [1, 0, 0, 0]

    # ------------------------------------------------------------- normals
    def normals(P, faces):
        N = np.zeros_like(P)
        for f in faces:
            for k in range(1, len(f) - 1):
                a, b, c = P[f[0]], P[f[k]], P[f[k + 1]]
                n = np.cross(b - a, c - a)
                N[f[0]] += n; N[f[k]] += n; N[f[k + 1]] += n
        l = np.linalg.norm(N, axis=1, keepdims=True)
        return N / np.maximum(l, 1e-9)

    N = normals(V, [f for f, _ in body_faces] + [f for f, _ in eye_faces])

    # ------------------------------------------------------------- geometry helpers for the bikini
    body_tris = []
    for f, _ in body_faces:
        for k in range(1, len(f) - 1):
            body_tris.append([f[0], f[k], f[k + 1]])
    body_tris = np.array(body_tris)
    TA, TB, TC = V[body_tris[:, 0]], V[body_tris[:, 1]], V[body_tris[:, 2]]
    TN = np.cross(TB - TA, TC - TA)
    TN /= np.maximum(np.linalg.norm(TN, axis=1, keepdims=True), 1e-12)
    body_v = V[:body_n]
    body_vn = N[:body_n]
    limb = ('arm', 'hand', 'thumb', 'index', 'middle', 'ring', 'pinky', 'clavicle')
    dom = [order[J[v, 0]] for v in range(body_n)]
    torso_mask = np.array([not any(k in d for k in limb) for d in dom])

    def project(points_xy, direction, bbox=None):
        """Project (x, y) points onto the body along +z (direction=1) or -z (-1).
        Returns positions and normals; picks the outermost surface."""
        sel = (TN[:, 2] * direction) > 0.05
        if bbox is not None:
            (x0, x1, y0, y1) = bbox
            cx = (TA[:, 0] + TB[:, 0] + TC[:, 0]) / 3
            cy = (TA[:, 1] + TB[:, 1] + TC[:, 1]) / 3
            sel &= (cx > x0) & (cx < x1) & (cy > y0) & (cy < y1)
        a, b, c = TA[sel], TB[sel], TC[sel]
        tri = body_tris[sel]
        out_p, out_n = [], []
        for (px, py) in points_xy:
            v0 = c[:, :2] - a[:, :2]; v1 = b[:, :2] - a[:, :2]; v2 = np.array([px, py]) - a[:, :2]
            d00 = (v0 * v0).sum(1); d01 = (v0 * v1).sum(1); d11 = (v1 * v1).sum(1)
            d20 = (v2 * v0).sum(1); d21 = (v2 * v1).sum(1)
            den = d00 * d11 - d01 * d01
            den[np.abs(den) < 1e-14] = 1e-14
            u = (d11 * d20 - d01 * d21) / den
            v = (d00 * d21 - d01 * d20) / den
            inside = (u >= -1e-6) & (v >= -1e-6) & (u + v <= 1 + 1e-6)
            if not inside.any():
                out_p.append(None); out_n.append(None); continue
            z = a[:, 2] + u * (c[:, 2] - a[:, 2]) + v * (b[:, 2] - a[:, 2])
            z = np.where(inside, z, -1e9 if direction > 0 else 1e9)
            k = int(np.argmax(z) if direction > 0 else np.argmin(z))
            p = np.array([px, py, z[k]])
            ti = tri[k]
            n = body_vn[ti[0]] * (1 - u[k] - v[k]) + body_vn[ti[2]] * u[k] + body_vn[ti[1]] * v[k]
            out_p.append(p); out_n.append(n / np.linalg.norm(n))
        return out_p, out_n

    torso_idx = np.where(torso_mask)[0]
    def nearest_vertex(p):
        d = ((body_v[torso_idx] - p) ** 2).sum(1)
        return int(torso_idx[np.argmin(d)])

    def radial_ring(y, angles, center_xz, band=0.012, lift=None):
        """Points on the body surface at height y for the given angles (around the vertical axis)."""
        cx, cz = center_xz
        sel = (np.abs(body_v[:, 1] - y) < band) & torso_mask & (np.abs(body_v[:, 0] - cx) < 0.24) & (np.abs(body_v[:, 2] - cz) < 0.2)
        pts = body_v[sel]
        ang = np.arctan2(pts[:, 0] - cx, pts[:, 2] - cz)
        rad = np.hypot(pts[:, 0] - cx, pts[:, 2] - cz)
        out = []
        for i, a in enumerate(angles):
            yy = y + (lift[i] if lift is not None else 0)
            m = np.abs(((ang - a + np.pi) % (2 * np.pi)) - np.pi) < 0.06
            r = rad[m].max() if m.any() else (out[-1][1] if out else 0.1)
            out.append((a, r, yy))
        # smooth the radius
        rs = np.array([o[1] for o in out])
        if len(rs) > 4:
            rs = np.convolve(np.pad(rs, 2, mode='edge'), np.ones(5) / 5, mode='valid')
        return [np.array([cx + math.sin(a) * (r + 0.0035), yy, cz + math.cos(a) * (r + 0.0035)]) for (a, _, yy), r in zip(out, rs)]

    bik_pos, bik_idx = [], []

    def add_patch(tri_xy, direction, bbox, n=16, lift=0.0028):
        """A smooth triangle of fabric projected onto the body."""
        A, B, C = [np.array(p) for p in tri_xy]
        grid, ids = [], {}
        for i in range(n + 1):
            for j in range(n + 1 - i):
                u, v = i / n, j / n
                grid.append(A + (B - A) * u + (C - A) * v)
                ids[(i, j)] = len(grid) - 1
        P, Nn = project([(g[0], g[1]) for g in grid], direction, bbox)
        base = len(bik_pos)
        remap = {}
        for k, (p, nn) in enumerate(zip(P, Nn)):
            if p is None:
                continue
            remap[k] = len(bik_pos)
            bik_pos.append(p + nn * lift)
        for i in range(n):
            for j in range(n - i):
                a, b, c = ids[(i, j)], ids[(i + 1, j)], ids[(i, j + 1)]
                if all(x in remap for x in (a, b, c)):
                    tri = [remap[a], remap[b], remap[c]]
                    bik_idx.append(tri if direction > 0 else tri[::-1])
                if j < n - i - 1:
                    a, b, c = ids[(i + 1, j)], ids[(i + 1, j + 1)], ids[(i, j + 1)]
                    if all(x in remap for x in (a, b, c)):
                        tri = [remap[a], remap[b], remap[c]]
                        bik_idx.append(tri if direction > 0 else tri[::-1])
        return base

    def add_tube(points, radius=0.0022, sides=6):
        pts = []
        for p in points:
            if p is not None and np.isfinite(p).all() and (not pts or np.linalg.norm(p - pts[-1]) > 1e-4):
                pts.append(p)
        if os.environ.get('DBG') and pts:
            arr = np.array(pts)
            print('  tube', len(arr), 'zmax', arr[:, 2].max().round(3), 'first', arr[0].round(3), 'last', arr[-1].round(3))
        if len(pts) < 2:
            return
        base = len(bik_pos)
        for k, p in enumerate(pts):
            tdir = pts[min(k + 1, len(pts) - 1)] - pts[max(k - 1, 0)]
            tdir /= np.linalg.norm(tdir) + 1e-12
            up = np.array([0, 1, 0]) if abs(tdir[1]) < 0.9 else np.array([1, 0, 0])
            s1 = np.cross(tdir, up)
            if not np.isfinite(s1).all() or np.linalg.norm(s1) < 1e-9:
                s1 = np.array([1.0, 0, 0])
            s1 /= np.linalg.norm(s1)
            s2 = np.cross(tdir, s1)
            for s in range(sides):
                a = 2 * math.pi * s / sides
                bik_pos.append(p + (s1 * math.cos(a) + s2 * math.sin(a)) * radius)
        for k in range(len(pts) - 1):
            for s in range(sides):
                a = base + k * sides + s
                b = base + k * sides + (s + 1) % sides
                c = base + (k + 1) * sides + s
                d = base + (k + 1) * sides + (s + 1) % sides
                bik_idx.append([a, c, b]); bik_idx.append([b, c, d])

    def surface_path(ctrl, steps=40, lift=0.0028):
        """Sample a polyline through control points and snap it to the body surface."""
        out = []
        for k in range(len(ctrl) - 1):
            for s in range(steps):
                p = ctrl[k] + (ctrl[k + 1] - ctrl[k]) * (s / steps)
                vi = nearest_vertex(p)
                out.append(body_v[vi] + body_vn[vi] * lift)
        vi = nearest_vertex(ctrl[-1])
        out.append(body_v[vi] + body_vn[vi] * lift)
        arr = np.array(out)
        for _ in range(40):  # smooth
            arr[1:-1] = (arr[:-2] + arr[1:-1] * 2 + arr[2:]) / 4
        return list(arr)

    # landmarks
    L_hip = head['thigh_l']; R_hip = head['thigh_r']
    pelvis = head['pelvis']
    neck = head['neck_01']; nape_y = neck[1]
    # nipples: the front-most body vertex on each breast
    nip = {}
    for side, s in (('l', 1), ('r', -1)):
        m = (body_v[:, 0] * s > 0.04) & (body_v[:, 0] * s < 0.16) & (body_v[:, 1] > pelvis[1] + 0.25) & (body_v[:, 1] < neck[1] - 0.08)
        cand = np.where(m)[0]
        nip[side] = body_v[cand[np.argmax(body_v[cand, 2])]]
    chest_y = (nip['l'][1] + nip['r'][1]) / 2

    # ----- top: triangles on strings
    apex = {}
    for side, s in (('l', 1), ('r', -1)):
        n = nip[side]
        A = (n[0] - s * 0.012, n[1] + 0.088)
        B = (n[0] - s * 0.062, n[1] - 0.05)
        C = (n[0] + s * 0.066, n[1] - 0.045)
        add_patch([A, B, C], 1, (min(A[0], B[0], C[0]) - 0.03, max(A[0], B[0], C[0]) + 0.03, n[1] - 0.09, n[1] + 0.12), n=18)
        apex[side] = project([A], 1, None)[0][0]
    # halter strings: from each apex over the neck to the nape
    for side, s in (('l', 1), ('r', -1)):
        a = apex[side]
        if a is None:
            continue
        ctrl = [a, np.array([s * 0.055, neck[1] - 0.03, neck[2] + 0.05]), np.array([s * 0.05, nape_y + 0.01, neck[2] - 0.02]), np.array([s * 0.012, nape_y + 0.0, neck[2] - 0.055])]
        add_tube(surface_path(ctrl, steps=24))
    # back band under the bust, from one cup round the back to the other
    band_y = chest_y - 0.05
    tm = torso_mask & (np.abs(body_v[:, 0]) < 0.2)
    cz = (body_v[(np.abs(body_v[:, 1] - band_y) < 0.01) & tm, 2]).mean()
    ang = np.linspace(math.radians(55), math.radians(305), 90)
    add_tube(radial_ring(band_y, ang, (0.0, cz)))

    # ----- bottom: small front triangle, high-cut side strings, thong back
    y_top = pelvis[1] + 0.035
    crotch_y = min(L_hip[1], R_hip[1]) - 0.085
    add_patch([(-0.075, y_top), (0.075, y_top), (0.0, crotch_y - 0.01)], 1, (-0.12, 0.12, crotch_y - 0.05, y_top + 0.04), n=18)
    # tip of the front piece narrows: add a little bridge strip under the body
    add_patch([(-0.032, y_top - 0.005), (0.032, y_top - 0.005), (0.0, crotch_y - 0.07)], -1, (-0.08, 0.08, crotch_y - 0.12, y_top + 0.02), n=14)
    czh = (body_v[(np.abs(body_v[:, 1] - y_top) < 0.01) & tm, 2]).mean()
    for s in (1, -1):
        ang = np.linspace(s * math.radians(20), s * math.radians(160), 70)
        lift = [0.035 * math.sin(math.pi * (i / (len(ang) - 1))) for i in range(len(ang))]
        add_tube(radial_ring(y_top, ang, (0.0, czh), lift=lift))

    # ------------------------------------------------------------- skin texture with make-up
    head_v = body_v[body_v[:, 1] > head['neck_01'][1] + 0.03]
    nose_tip = head_v[np.argmax(head_v[:, 2])]
    tex = paint_skin(V, VT, body_faces, look, joint, N, nose_tip)

    # ------------------------------------------------------------- eye colours (vertex colours)
    eye_col = np.ones((nverts, 3), np.float32)
    for side in ('l', 'r'):
        c = joint(f'joint-{side}-eye')
        ids = [i for i in eye_idx if (V[i][0] > 0) == (side == 'l')]
        for i in ids:
            d = V[i] - c
            d /= np.linalg.norm(d) + 1e-12
            ang = math.acos(max(-1, min(1, d[2])))
            if ang < 0.2:
                col = [0.02, 0.02, 0.02]
            elif ang < 0.48:
                k = (ang - 0.2) / 0.28
                col = [x * (0.55 + 0.6 * k) for x in look['iris']]
            elif ang < 0.52:
                col = [0.15, 0.13, 0.12]
            else:
                col = [0.93, 0.92, 0.9]
            eye_col[i] = col

    # ------------------------------------------------------------- bikini skinning: nearest body vertex
    bik_pos = np.array(bik_pos, np.float32)
    bik_idx = np.array(bik_idx, np.uint32)
    bJ = np.zeros((len(bik_pos), 4), np.uint16)
    bW = np.zeros((len(bik_pos), 4), np.float32)
    for k in range(0, len(bik_pos), 512):
        chunk = bik_pos[k:k + 512]
        d = ((chunk[:, None, :] - body_v[torso_idx][None, :, :]) ** 2).sum(2)
        nn = torso_idx[d.argmin(1)]
        bJ[k:k + 512] = J[nn]
        bW[k:k + 512] = W[nn]

    # ------------------------------------------------------------- hair roots (scalp helper)
    hair_roots = V[hair_idx]
    hc = joint('joint-head')

    meta = {
        'bones': order,
        'heights': {'total': float(V[:body_n, 1].max() - V[:body_n, 1].min()), 'hip': float(pelvis[1])},
        'head': hc.tolist(),
        'hairColor': look['hair'],
        'eyes': [joint('joint-l-eye').tolist(), joint('joint-r-eye').tolist()],
        'neck': head['neck_01'].tolist(),
        'shoulders': [head['upperarm_l'].tolist(), head['upperarm_r'].tolist()],
        'targets': applied,
    }
    N = normals(V, [f for f, _ in body_faces] + [f for f, _ in eye_faces] + [f for f, _ in scalp_faces])
    write_glb(out_path, V, VT, N, body_faces, eye_faces, lash_faces + [('SCALP', scalp_faces)], J, W, eye_col, bik_pos, bik_idx, bJ, bW,
              order, head, parent, tex, look, hair_roots, meta)


# ----------------------------------------------------------------------------- skin painting
def paint_skin(V, VT, body_faces, look, joint, N, nose, size=2048):
    skin = np.array(look['skin'], np.float32)
    lips = np.array(look['lips'], np.float32)
    brows = np.array(look['brows'], np.float32)
    col = np.tile(skin, (len(V), 1))
    eyeL, eyeR = joint('joint-l-eye'), joint('joint-r-eye')
    head_y = eyeL[1] - 0.12
    front = (V[:, 2] > eyeL[2] - 0.03) & (V[:, 1] > head_y) & (np.arange(len(V)) < 13380)
    mouth = np.array([0.0, nose[1] - 0.0285, nose[2]])

    def smooth(x, a, b):
        t = np.clip((x - a) / (b - a), 0, 1)
        return t * t * (3 - 2 * t)

    # lips: upper lip with a cupid's bow, fuller lower lip (from the nose tip down)
    dx = (V[:, 0] - mouth[0]) / 0.0232
    dy = (V[:, 1] - mouth[1])
    shape = np.sqrt(np.maximum(1 - dx ** 2, 0))
    bow = 1 - 0.18 * np.exp(-(dx / 0.18) ** 2) + 0.08 * np.exp(-((np.abs(dx) - 0.35) / 0.2) ** 2)
    up_h = 0.0112 * shape * bow
    lo_h = 0.0185 * shape
    lipmask = np.where(dy >= 0, smooth(up_h - dy, 0, 0.0009), smooth(lo_h + dy, 0, 0.0012))
    lipmask = lipmask * (np.abs(dx) < 1) * (V[:, 2] > nose[2] - 0.03) * front
    lipmask = lipmask.astype(np.float32)
    col = col * (1 - lipmask[:, None]) + lips * lipmask[:, None]

    for eye, s in ((eyeL, 1), (eyeR, -1)):
        ex = (V[:, 0] - eye[0]) * s  # outward
        ey = V[:, 1] - eye[1]
        near = front & (np.abs(ex) < 0.05) & (ey > -0.03) & (ey < 0.04)
        # brows: one clean, defined arch, fuller at the inner end and tapering out
        t = np.clip((ex + 0.014) / 0.046, 0, 1)
        centre = 0.0215 + 0.0052 * np.sin(np.pi * np.clip(t * 1.12, 0, 1)) - 0.002 * t
        half = 0.00155 * (1 - t) + 0.00055
        bm = near & (ex > -0.014) & (ex < 0.032)
        browmask = bm * smooth(half - np.abs(ey - centre), -0.0002, 0.0006) * smooth(t, 0, 0.08)
        col = col * (1 - browmask[:, None] * 0.25) + brows * (browmask[:, None] * 0.25)  # light base; hairs are geometry
        # lash line right on the upper lid edge, with a small flick
        edge = 0.0068 * np.cos(np.clip(ex / 0.018, -1.3, 1.3))
        flick = np.where(ex > 0.012, (ex - 0.012) * 0.55, 0)
        lm = near & (ex > -0.011) & (ex < 0.021)
        liner = lm * smooth(0.0009 - np.abs(ey - (edge + flick)), 0, 0.0006)
        col = col * (1 - liner[:, None] * 0.9) + np.array([0.05, 0.04, 0.04]) * liner[:, None] * 0.9
        # soft warm eyeshadow on the lid
        shadow = near * (ey > 0.006) * smooth(0.0135 - ey, 0, 0.004) * smooth(0.02 - np.abs(ex - 0.004), 0, 0.009) * 0.3
        col = col * (1 - shadow[:, None]) + np.array([0.6, 0.42, 0.36]) * shadow[:, None]
        # blush on the cheekbones
        cheek = eye + np.array([s * 0.012, -0.03, 0])
        d = np.linalg.norm((V - cheek)[:, :2], axis=1)
        blush = front * smooth(0.028 - d, 0, 0.02) * 0.18
        col = col * (1 - blush[:, None]) + np.array([0.86, 0.5, 0.48]) * blush[:, None]

    # a touch of bronzer under the cheekbones and along the jaw
    for s_ in (1, -1):
        hol = np.array([s_ * 0.058, nose[1] - 0.012, nose[2] - 0.05])
        d = np.linalg.norm((V - hol) * np.array([1, 1.6, 0.6]), axis=1)
        bz = front * smooth(0.03 - d, 0, 0.022) * 0.22
        col = col * (1 - bz[:, None]) + col * np.array([0.82, 0.7, 0.62]) * bz[:, None]
    # very subtle shading in creases (ambient-occlusion-ish from normals facing down)
    shade = np.clip(-N[:, 1], 0, 1) * 0.06
    col *= (1 - shade[:, None])

    # rasterise per-vertex colours into UV space
    img = np.zeros((size, size, 3), np.float32)
    wsum = np.zeros((size, size), np.float32)
    uv = VT.copy()
    for f, ft in body_faces:
        for k in range(1, len(f) - 1):
            vi = [f[0], f[k], f[k + 1]]
            ti = [ft[0], ft[k], ft[k + 1]]
            P = uv[ti] * (size - 1)
            P[:, 1] = (size - 1) - P[:, 1]
            x0, y0 = np.floor(P.min(0)).astype(int)
            x1, y1 = np.ceil(P.max(0)).astype(int)
            x0 = max(x0 - 1, 0); y0 = max(y0 - 1, 0); x1 = min(x1 + 1, size - 1); y1 = min(y1 + 1, size - 1)
            if x1 < x0 or y1 < y0:
                continue
            xs, ys = np.meshgrid(np.arange(x0, x1 + 1), np.arange(y0, y1 + 1))
            a, b, c = P
            den = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1])
            if abs(den) < 1e-9:
                continue
            l1 = ((b[1] - c[1]) * (xs - c[0]) + (c[0] - b[0]) * (ys - c[1])) / den
            l2 = ((c[1] - a[1]) * (xs - c[0]) + (a[0] - c[0]) * (ys - c[1])) / den
            l3 = 1 - l1 - l2
            m = (l1 >= -0.02) & (l2 >= -0.02) & (l3 >= -0.02)
            if not m.any():
                continue
            C = col[vi]
            pix = l1[..., None] * C[0] + l2[..., None] * C[1] + l3[..., None] * C[2]
            img[ys[m], xs[m]] = pix[m]
            wsum[ys[m], xs[m]] = 1
    # grow painted pixels into the empty space so UV seams never show
    filled = wsum > 0
    for _ in range(12):
        if filled.all():
            break
        acc = np.zeros_like(img); cnt = np.zeros(filled.shape, np.float32)
        for dy_, dx_ in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            sh_f = np.roll(filled, (dy_, dx_), (0, 1))
            sh_i = np.roll(img, (dy_, dx_), (0, 1))
            acc += sh_i * sh_f[..., None]; cnt += sh_f
        grow = (~filled) & (cnt > 0)
        img[grow] = acc[grow] / cnt[grow][:, None]
        filled = filled | grow
    img[~filled] = np.array(look['skin'], np.float32)
    rng = np.random.default_rng(3)
    img *= (1 + rng.normal(0, 0.012, (size, size, 1))).astype(np.float32)
    return Image.fromarray(np.clip(img * 255, 0, 255).astype(np.uint8))


# ----------------------------------------------------------------------------- GLB writer
def write_glb(path, V, VT, N, body_faces, eye_faces, lash_faces, J, W, eye_col, bik_pos, bik_idx, bJ, bW,
              order, head, parent, tex, look, hair_roots, meta):
    import io
    buf = bytearray()
    views, accessors = [], []

    def add_view(data, target=None):
        while len(buf) % 4:
            buf.append(0)
        off = len(buf)
        buf.extend(data)
        v = {'buffer': 0, 'byteOffset': off, 'byteLength': len(data)}
        if target:
            v['target'] = target
        views.append(v)
        return len(views) - 1

    def add_acc(arr, ctype, typ, target=None, minmax=False):
        arr = np.ascontiguousarray(arr)
        vi = add_view(arr.tobytes(), target)
        acc = {'bufferView': vi, 'componentType': ctype, 'count': int(arr.shape[0]), 'type': typ}
        if minmax:
            acc['min'] = arr.min(0).tolist(); acc['max'] = arr.max(0).tolist()
        accessors.append(acc)
        return len(accessors) - 1

    # unweld: one vertex per (v, vt) pair so UV seams are clean
    def unweld(faces, with_uv=True):
        key, P, U, Nn, JJ, WW, C, idx = {}, [], [], [], [], [], [], []
        for f, ft in faces:
            ids = []
            for v, t in zip(f, ft):
                k = (v, t if with_uv else 0)
                if k not in key:
                    key[k] = len(P)
                    P.append(V[v]); U.append(VT[t] if with_uv else [0, 0]); Nn.append(N[v])
                    JJ.append(J[v]); WW.append(W[v]); C.append(eye_col[v])
                ids.append(key[k])
            for kk in range(1, len(ids) - 1):
                idx.append([ids[0], ids[kk], ids[kk + 1]])
        U = np.array(U, np.float32); U[:, 1] = 1 - U[:, 1]
        return (np.array(P, np.float32), U, np.array(Nn, np.float32), np.array(JJ, np.uint16), np.array(WW, np.float32), np.array(C, np.float32), np.array(idx, np.uint32))

    meshes, materials, textures, images, samplers = [], [], [], [], [{'magFilter': 9729, 'minFilter': 9987, 'wrapS': 33071, 'wrapT': 33071}]
    # texture
    png = io.BytesIO(); tex.save(png, 'PNG')
    iv = add_view(png.getvalue())
    images.append({'bufferView': iv, 'mimeType': 'image/png'})
    textures.append({'sampler': 0, 'source': 0})
    materials.append({'name': 'skin', 'pbrMetallicRoughness': {'baseColorTexture': {'index': 0}, 'metallicFactor': 0, 'roughnessFactor': 0.55}})
    materials.append({'name': 'eyes', 'pbrMetallicRoughness': {'baseColorFactor': [1, 1, 1, 1], 'metallicFactor': 0, 'roughnessFactor': 0.08}})
    materials.append({'name': 'lashes', 'pbrMetallicRoughness': {'baseColorFactor': [0.03, 0.025, 0.025, 1], 'metallicFactor': 0, 'roughnessFactor': 0.6}, 'doubleSided': True})
    bc = look['bikini'] + [1]
    materials.append({'name': 'bikini', 'pbrMetallicRoughness': {'baseColorFactor': bc, 'metallicFactor': 0, 'roughnessFactor': 0.45}, 'doubleSided': True})
    materials.append({'name': 'hair', 'pbrMetallicRoughness': {'baseColorFactor': look['hair'] + [1], 'metallicFactor': 0, 'roughnessFactor': 0.5}})

    def prim(P, U, Nn, JJ, WW, idx, mat, colors=None):
        a = {'POSITION': add_acc(P, 5126, 'VEC3', 34962, True), 'NORMAL': add_acc(Nn, 5126, 'VEC3', 34962),
             'TEXCOORD_0': add_acc(U, 5126, 'VEC2', 34962), 'JOINTS_0': add_acc(JJ, 5123, 'VEC4', 34962),
             'WEIGHTS_0': add_acc(WW, 5126, 'VEC4', 34962)}
        if colors is not None:
            a['COLOR_0'] = add_acc(colors, 5126, 'VEC3', 34962)
        return {'attributes': a, 'indices': add_acc(idx.reshape(-1), 5125, 'SCALAR', 34963), 'material': mat}

    P, U, Nn, JJ, WW, C, idx = unweld(body_faces)
    meshes.append({'name': 'body', 'primitives': [prim(P, U, Nn, JJ, WW, idx, 0)]})
    P, U, Nn, JJ, WW, C, idx = unweld(eye_faces)
    meshes.append({'name': 'eyes', 'primitives': [prim(P, U, Nn, JJ, WW, idx, 1, C)]})
    scalp = [x for x in lash_faces if x[0] == 'SCALP']
    lash_faces = [x for x in lash_faces if x[0] != 'SCALP']
    if lash_faces:
        P, U, Nn, JJ, WW, C, idx = unweld(lash_faces)
        meshes.append({'name': 'lashes', 'primitives': [prim(P, U, Nn, JJ, WW, idx, 2)]})
    if scalp and scalp[0][1]:
        P, U, Nn, JJ, WW, C, idx = unweld(scalp[0][1])
        meshes.append({'name': 'scalp', 'primitives': [prim(P, U, Nn, JJ, WW, idx, 4)]})
    # bikini normals
    bn = np.zeros_like(bik_pos)
    for a, b, c in bik_idx:
        n = np.cross(bik_pos[b] - bik_pos[a], bik_pos[c] - bik_pos[a])
        bn[a] += n; bn[b] += n; bn[c] += n
    bn /= np.maximum(np.linalg.norm(bn, axis=1, keepdims=True), 1e-9)
    meshes.append({'name': 'bikini', 'primitives': [prim(bik_pos, np.zeros((len(bik_pos), 2), np.float32), bn.astype(np.float32), bJ, bW, bik_idx, 3)]})

    # skeleton: joint nodes with identity rotation; translation relative to the parent head
    nodes = []
    jnode = {}
    for b in order:
        p = parent[b]
        t = head[b] - (head[p] if p else 0)
        jnode[b] = len(nodes)
        nodes.append({'name': b, 'translation': [float(x) for x in t]})
    for b in order:
        kids = [jnode[c] for c in order if parent[c] == b]
        if kids:
            nodes[jnode[b]]['children'] = kids
    ibm = np.zeros((len(order), 16), np.float32)
    for i, b in enumerate(order):
        m = np.eye(4, dtype=np.float32)
        m[:3, 3] = -head[b]
        ibm[i] = m.T.reshape(-1)  # column-major
    ibm_acc = add_acc(ibm, 5126, 'MAT4')
    root_joint = jnode[order[0]]
    skin = {'joints': [jnode[b] for b in order], 'inverseBindMatrices': ibm_acc, 'skeleton': root_joint}
    mesh_nodes = []
    for mi, m in enumerate(meshes):
        mesh_nodes.append(len(nodes))
        nodes.append({'name': m['name'], 'mesh': mi, 'skin': 0})
    nodes.append({'name': 'Woman', 'children': [root_joint] + mesh_nodes, 'extras': {'hairRoots': hair_roots.round(5).tolist(), **meta}})
    scene_root = len(nodes) - 1

    gltf = {'asset': {'version': '2.0', 'generator': 'agentium-hq build_woman.py (MakeHuman CC0 base)'},
            'scene': 0, 'scenes': [{'nodes': [scene_root]}], 'nodes': nodes, 'meshes': meshes, 'skins': [skin],
            'materials': materials, 'textures': textures, 'images': images, 'samplers': samplers,
            'accessors': accessors, 'bufferViews': views, 'buffers': [{'byteLength': len(buf)}]}
    js = json.dumps(gltf, separators=(',', ':')).encode()
    while len(js) % 4:
        js += b' '
    while len(buf) % 4:
        buf.append(0)
    total = 12 + 8 + len(js) + 8 + len(buf)
    with open(path, 'wb') as f:
        f.write(struct.pack('<III', 0x46546C67, 2, total))
        f.write(struct.pack('<II', len(js), 0x4E4F534A)); f.write(js)
        f.write(struct.pack('<II', len(buf), 0x004E4942)); f.write(buf)
    print(f'  wrote {path} ({total / 1e6:.1f} MB, {len(order)} bones, {len(bik_pos)} bikini verts)')


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--data', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--look')
    a = ap.parse_args()
    look = dict(DEFAULT_LOOK)
    if a.look:
        user = json.load(open(a.look))
        look.update({k: v for k, v in user.items() if k != 'targets'})
        look['targets'] = {**DEFAULT_LOOK['targets'], **user.get('targets', {})}
    build(a.data, look, a.out)
