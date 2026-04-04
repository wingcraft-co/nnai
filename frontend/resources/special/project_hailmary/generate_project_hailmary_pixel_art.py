"""
Generate Project Hail Mary themed pixel art.

Special style rule:
- Assets under resources/special use a more detailed base grid (32x32).

Outputs per character folder:
- <name>/<name>.png      (512x512)
- <name>/<name>.gif      (512x512, 4 frames)
- <name>/<name>_64.png   (64x64)
- <name>/<name>_64.gif   (64x64, 4 frames)
"""
from __future__ import annotations

import os
from typing import Iterable

from PIL import Image

CANVAS = 32
NUM_FRAMES = 4
FRAME_DURATION = 240
SCALE_BIG = 16
SCALE_SMALL = 2

BASE_DIR = os.path.dirname(os.path.abspath(__file__))


def new_img() -> Image.Image:
    return Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))


def px(im: Image.Image, x: int, y: int, c: tuple[int, int, int] | tuple[int, int, int, int]) -> None:
    if 0 <= x < CANVAS and 0 <= y < CANVAS:
        if len(c) == 3:
            im.putpixel((x, y), (*c, 255))
        else:
            im.putpixel((x, y), c)


def fill_rect(im: Image.Image, x0: int, y0: int, x1: int, y1: int, c: tuple[int, int, int]) -> None:
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            px(im, x, y, c)


PIXEL_FONT_3x5 = {
    "A": ["010", "101", "111", "101", "101"],
    "M": ["101", "111", "111", "101", "101"],
    "Z": ["111", "001", "010", "100", "111"],
    "E": ["111", "100", "110", "100", "111"],
}


def draw_text_3x5(im: Image.Image, text: str, x0: int, y0: int, c: tuple[int, int, int]) -> None:
    x = x0
    for ch in text:
        glyph = PIXEL_FONT_3x5.get(ch)
        if not glyph:
            x += 4
            continue
        for gy, row in enumerate(glyph):
            for gx, bit in enumerate(row):
                if bit == "1":
                    px(im, x + gx, y0 + gy, c)
        x += 4


def draw_grace(frame: int = 0) -> Image.Image:
    """Grace: detailed EVA suit with helmet lamp and chest modules."""
    im = new_img()

    skin = (242, 205, 169)
    skin_s = (213, 173, 139)
    hair = (214, 176, 108)
    hair_h = (238, 206, 144)
    visor = (107, 188, 212)
    visor_h = (168, 233, 243)
    suit = (169, 48, 39)
    suit_h = (217, 87, 62)
    suit_d = (111, 30, 24)
    trim = (227, 224, 214)
    strap = (66, 48, 38)
    boot = (72, 63, 66)
    light = (255, 243, 195)
    light_h = (255, 255, 228)
    patch = (204, 201, 191)
    patch_d = (130, 126, 121)

    arm_dy = [0, -1, 0, 1][frame % 4]

    # Backpack and harness.
    fill_rect(im, 7, 11, 10, 20, suit_d)
    fill_rect(im, 10, 11, 12, 20, suit)
    fill_rect(im, 8, 14, 11, 15, patch_d)
    fill_rect(im, 9, 14, 10, 15, patch)
    px(im, 8, 11, strap)
    px(im, 8, 20, patch_d)
    px(im, 11, 20, patch)
    px(im, 12, 14, trim)
    px(im, 12, 16, trim)

    # Helmet rim and shell.
    fill_rect(im, 13, 8, 21, 8, hair)
    px(im, 13, 9, trim)
    px(im, 21, 9, trim)

    # Hair: side-swept blond quiff silhouette.
    fill_rect(im, 14, 7, 20, 7, hair)
    fill_rect(im, 15, 6, 20, 6, hair_h)
    fill_rect(im, 17, 5, 20, 5, hair_h)
    px(im, 20, 4, hair_h)
    px(im, 19, 4, hair)
    px(im, 15, 6, hair)  # darker back side for depth

    # Face block.
    fill_rect(im, 14, 8, 19, 12, skin)
    px(im, 14, 8, skin_s)
    px(im, 14, 9, skin_s)
    fill_rect(im, 20, 9, 20, 12, skin)
    px(im, 19, 10, (0, 0, 0))  # eye
    px(im, 20, 12, (191, 132, 114))  # mouth

    # No cyan marks above eye.

    # Torso and chest modules.
    fill_rect(im, 14, 13, 20, 20, suit)
    fill_rect(im, 14, 13, 15, 19, suit_d)
    fill_rect(im, 18, 13, 20, 14, trim)
    fill_rect(im, 16, 15, 18, 17, suit_h)
    fill_rect(im, 16, 13, 17, 14, patch)
    px(im, 18, 14, patch_d)
    px(im, 16, 16, patch)
    px(im, 18, 16, patch_d)
    fill_rect(im, 17, 18, 18, 19, patch)
    px(im, 19, 19, patch_d)
    # Harness straps.
    px(im, 15, 14, strap)
    px(im, 15, 15, strap)
    px(im, 19, 14, strap)
    px(im, 19, 15, strap)

    # Shoulder plates.
    fill_rect(im, 12, 12, 13, 13, patch_d)
    fill_rect(im, 20, 12, 21, 13, patch)
    px(im, 13, 12, trim)
    px(im, 20, 12, trim)

    # Arms.
    fill_rect(im, 12, 14, 13, 16, suit_d)  # back arm suit
    fill_rect(im, 13, 17, 13, 18, trim)    # back glove

    # Front arm stays below face line.
    fill_rect(im, 21, 16 + arm_dy, 22, 18 + arm_dy, suit)
    fill_rect(im, 21, 19 + arm_dy, 22, 20 + arm_dy, trim)
    fill_rect(im, 23, 19 + arm_dy, 24, 20 + arm_dy, trim)
    # Small handheld badge/wrist tool pulse.
    if frame in (0, 2):
        px(im, 24, 18 + arm_dy, patch)
    else:
        px(im, 24, 19 + arm_dy, patch_d)

    # Helmet lamp removed by request.

    # Legs + boots: articulated EVA walk cycle.
    if frame == 0:
        # Left leg back, right leg forward
        left_leg = [(15, 21), (15, 22), (15, 23), (14, 24), (14, 25)]
        right_leg = [(19, 21), (19, 22), (20, 23), (20, 24), (21, 25)]
    elif frame == 1:
        # Passing
        left_leg = [(16, 21), (16, 22), (16, 23), (16, 24), (16, 25)]
        right_leg = [(18, 21), (18, 22), (18, 23), (18, 24), (18, 25)]
    elif frame == 2:
        # Swap
        left_leg = [(19, 21), (19, 22), (20, 23), (20, 24), (21, 25)]
        right_leg = [(15, 21), (15, 22), (15, 23), (14, 24), (14, 25)]
    else:
        # Passing opposite
        left_leg = [(17, 21), (17, 22), (17, 23), (17, 24), (17, 25)]
        right_leg = [(19, 21), (19, 22), (19, 23), (19, 24), (19, 25)]

    for x, y in left_leg:
        px(im, x, y, suit_d)
        px(im, x + 1, y, suit_d)
    for x, y in right_leg:
        px(im, x, y, suit)
        px(im, x + 1, y, suit)

    # Knee pads
    px(im, left_leg[1][0], left_leg[1][1], patch)
    px(im, right_leg[1][0], right_leg[1][1], patch)

    # Boots (thicker contact).
    for x, y in [left_leg[-2], left_leg[-1], right_leg[-2], right_leg[-1]]:
        px(im, x, y, boot)
    # Sole highlights.
    px(im, left_leg[-1][0], left_leg[-1][1], patch_d)
    px(im, right_leg[-1][0], right_leg[-1][1], patch_d)

    return im


def draw_rocky(frame: int = 0) -> Image.Image:
    """Rocky: short and chubby tripod with raised pincers."""
    im = new_img()

    shell = (146, 115, 82)
    shell_d = (100, 75, 52)
    shell_h = (190, 157, 121)
    seam = (70, 51, 35)
    dust = (216, 192, 163)
    glow = (91, 232, 214)
    glow_d = (53, 176, 164)

    sway = [0, -1, 0, 1][frame % 4]

    # Central body (taller than wide, gently tapering downward).
    body = [
        (13, 10), (14, 10), (15, 10), (16, 10), (17, 10), (18, 10),
        (12, 11), (13, 11), (14, 11), (15, 11), (16, 11), (17, 11), (18, 11), (19, 11),
        (12, 12), (13, 12), (14, 12), (15, 12), (16, 12), (17, 12), (18, 12), (19, 12),
        (13, 13), (14, 13), (15, 13), (16, 13), (17, 13), (18, 13),
        (13, 14), (14, 14), (15, 14), (16, 14), (17, 14), (18, 14),
        (14, 15), (15, 15), (16, 15), (17, 15),
        (14, 16), (15, 16), (16, 16), (17, 16),
        (15, 17), (16, 17),
        (15, 18),
    ]
    for x, y in body:
        px(im, x, y, shell)
    # Left dark-brown side in a clear staircase taper.
    for x, y in [(12, 12), (12, 13), (13, 14), (13, 15), (14, 16), (15, 17)]:
        px(im, x, y, shell_d)
    for x, y in [(18, 10), (19, 11), (19, 12), (18, 13), (18, 14), (17, 15), (17, 16), (16, 17)]:
        px(im, x, y, shell_h)
    # Keep body clean: no dark center seam.

    # Raised pincer arms (barbell-lift pose, lower shoulder anchors).
    left_arm = [
        (13, 16), (12, 15), (12, 14), (12, 13), (12, 12), (12, 11),  # upper arm from lower shoulder
        (11, 11), (10, 11), (10, 10), (10, 9), (9, 9),  # bent forearm up
    ]
    right_arm = [
        (17, 16), (18, 15), (19, 14), (19, 13), (19, 12), (19, 11),  # upper arm from lower shoulder
        (20, 11), (21, 11), (21, 10), (21, 9), (22, 9),  # bent forearm up
    ]
    for x, y in left_arm:
        px(im, x, y, shell_d)
    for x, y in right_arm:
        px(im, x, y, shell_h)
    # Arm thickness (pads around shoulder + elbow corners).
    for x, y in [(13, 15), (13, 14), (13, 13), (11, 12), (11, 11)]:
        px(im, x, y, shell_d)
    for x, y in [(18, 15), (18, 14), (18, 13), (20, 12), (20, 11)]:
        px(im, x, y, shell_h)

    # Pincer tips with open/close animation.
    if frame in (0, 2):  # open
        left_pincer = [(8, 8), (9, 8), (8, 10)]
        right_pincer = [(22, 8), (23, 8), (22, 10)]
    else:  # close
        left_pincer = [(8, 9), (9, 9), (8, 10)]
        right_pincer = [(22, 9), (23, 9), (22, 10)]
    for x, y in left_pincer:
        px(im, x, y, dust)
    for x, y in right_pincer:
        px(im, x, y, dust)

    # Teal elbow marker (one pixel each arm).
    px(im, 11, 13, glow)
    px(im, 20, 13, glow)

    # Face/sensor: narrower but longer vertical diamond.
    face = (235, 226, 208)
    face_d = (210, 198, 178)
    for x, y in [
        (18, 10),
        (18, 11),
        (17, 12), (18, 12),
        (17, 13), (18, 13),
        (17, 14), (18, 14),
        (17, 15), (18, 15),
        (17, 16), (18, 16),
        (18, 17),
        (18, 18),
    ]:
        px(im, x, y, face)
    for x, y in [(17, 12), (17, 13), (17, 14), (17, 15), (17, 16), (18, 17), (18, 18)]:
        px(im, x, y, face_d)
    px(im, 18, 14, (42, 35, 30))

    # Tripod legs (3 total) with clear right-angle bends.
    center_bend = [0, 1, 0, -1][frame % 4]
    left_leg = [
        (15, 15), (14, 15), (13, 15),      # attach from torso (shifted +1 right, -1 up)
        (13, 16), (13, 17), (13, 18 + sway),  # vertical segment
        (12, 18 + sway),  # bend point
        (11, 19 + sway),
        (10, 20 + sway),
    ]
    center_leg = [
        (15, 16), (16, 16),
        (16, 17), (16, 18), (16, 19),  # vertical segment
        (17 + center_bend, 19),         # bend point
        (17 + center_bend, 20), (17 + center_bend, 21),  # lower segment
    ]
    right_leg = [
        (17, 16), (18, 16), (19, 16),      # attach from torso
        (19, 17), (19, 18), (19, 19 - sway),  # vertical segment
        (20, 19 - sway), (21, 19 - sway), (22, 19 - sway),  # horizontal segment
        (22, 20 - sway),
    ]
    for x, y in left_leg:
        px(im, x, y, shell_d)
    for x, y in center_leg:
        px(im, x, y, seam)
    for x, y in right_leg:
        px(im, x, y, shell_h)

    # Keep legs visually connected across all bend frames.
    px(im, 14, 17, shell_d)  # left root bridge
    px(im, 17, 17, shell_h)  # right root bridge
    if center_bend == 1:
        px(im, 17, 19, seam)  # center knee bridge (prevents 1px gap)

    # Thicken side legs near body exit.
    px(im, 12, 17, shell_d)
    px(im, 18, 17, shell_h)

    # Teal 1px markers only at leg joints.
    for x, y in [
        (13, 18 + sway),  # left knee
        (17 + center_bend, 19),  # center knee (animated)
        (19, 19 - sway),  # right knee
    ]:
        px(im, x, y, glow)

    # Contact points.
    for x, y in [(10, 21 + sway), (17 + center_bend, 22), (22, 21 - sway)]:
        px(im, x, y, seam)

    # Stone texture.
    for x, y in [(13, 11), (15, 10), (17, 11), (14, 13), (18, 14), (15, 16)]:
        px(im, x, y, dust)

    return im


def draw_rocky_amaze(frame: int = 0) -> Image.Image:
    """Rocky with speech bubble: AMAZE x3."""
    im = draw_rocky(frame)

    bubble = (246, 242, 228)
    outline = (96, 76, 57)
    text_c = (42, 35, 30)

    # Bubble box.
    fill_rect(im, 1, 0, 22, 17, bubble)
    for x in range(1, 23):
        px(im, x, 0, outline)
        px(im, x, 17, outline)
    for y in range(0, 18):
        px(im, 1, y, outline)
        px(im, 22, y, outline)

    # Bubble tail toward Rocky.
    px(im, 20, 18, outline)
    px(im, 21, 19, outline)
    px(im, 19, 18, bubble)
    px(im, 20, 19, bubble)

    # AMAZE x3.
    draw_text_3x5(im, "AMAZE", 2, 2, text_c)
    draw_text_3x5(im, "AMAZE", 2, 7, text_c)
    draw_text_3x5(im, "AMAZE", 2, 12, text_c)
    return im


def save_set(frames: Iterable[Image.Image], out_dir: str, name: str, scale: int, suffix: str = "") -> None:
    scaled = [f.resize((f.width * scale, f.height * scale), Image.NEAREST) for f in frames]
    png_path = os.path.join(out_dir, f"{name}{suffix}.png")
    gif_path = os.path.join(out_dir, f"{name}{suffix}.gif")
    scaled[0].save(png_path)
    scaled[0].save(
        gif_path,
        save_all=True,
        append_images=scaled[1:],
        duration=FRAME_DURATION,
        loop=0,
        disposal=2,
    )
    print(f"[OK] {png_path}")
    print(f"[OK] {gif_path}")


def generate_character(name: str, draw_fn) -> None:
    out_dir = os.path.join(BASE_DIR, name)
    os.makedirs(out_dir, exist_ok=True)
    frames = [draw_fn(f) for f in range(NUM_FRAMES)]
    save_set(frames, out_dir, name, SCALE_BIG)
    save_set(frames, out_dir, name, SCALE_SMALL, "_64")


def cleanup_legacy_flat_files() -> None:
    legacy = [
        "grace.png",
        "grace.gif",
        "grace_64.png",
        "grace_64.gif",
        "rocky.png",
        "rocky.gif",
        "rocky_64.png",
        "rocky_64.gif",
    ]
    for n in legacy:
        p = os.path.join(BASE_DIR, n)
        if os.path.exists(p):
            os.remove(p)
            print(f"[RM] {p}")


def generate_all() -> None:
    generate_character("grace", draw_grace)
    generate_character("rocky", draw_rocky)
    generate_character("rocky_amaze", draw_rocky_amaze)
    cleanup_legacy_flat_files()


if __name__ == "__main__":
    generate_all()
    print("Done!")
