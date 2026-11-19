# Rooftop guest builder (preview)

Builds a realistic, rigged woman as `public/models/woman-preview.glb` and
shows her at `/preview/woman.html` (local preview only, not part of the HQ yet).

Base body, shape targets, skeleton and skin weights: MakeHuman / MPFB2 (CC0).
Get the data once:

    git clone --depth 1 --filter=blob:none --sparse https://github.com/makehumancommunity/mpfb2.git
    cd mpfb2 && git sparse-checkout set src/mpfb/data/3dobjs src/mpfb/data/targets src/mpfb/data/rigs/standard src/mpfb/data/mesh_metadata

Build (Python 3 + numpy + Pillow):

    python3 tools/woman/build_woman.py --data mpfb2/src/mpfb/data --out public/models/woman-preview.glb [--look look.json]

The script shapes the body and face with targets, rigs it with the game-engine
skeleton, paints skin and make-up into a texture, colours the eyes and
generates a string bikini that follows the body. Hair, eyebrows and lashes are
grown as strands at runtime (`public/js/scene/woman.js`).

`--look` overrides any of the values in `DEFAULT_LOOK` (skin, lips, iris,
bikini and hair colours, cup size, height, and any shape target).
