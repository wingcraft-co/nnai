"""
Generate a 16x16 spinning earth pixel art.
Outputs 512px and 64px PNG/GIF assets in the same folder.
"""
from PIL import Image
import os
import math

CANVAS = 16
SCALE_BIG = 32
SCALE_SM = 4
NUM_FRAMES = 24
FRAME_DURATION = 170

BASE_DIR = os.path.dirname(os.path.abspath(__file__))


def new_img():
    return Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))


def px(im, x, y, c):
    if 0 <= x < CANVAS and 0 <= y < CANVAS:
        im.putpixel((x, y), (*c, 255))


def wrap_u_dist(a, b):
    d = abs(a - b)
    return min(d, 1.0 - d)


def is_land(u, v):
    # Stylized continent blobs on a wrapped longitude axis.
    blobs = [
        (0.12, 0.38, 0.12, 0.14),
        (0.18, 0.58, 0.10, 0.16),
        (0.30, 0.70, 0.08, 0.11),
        (0.62, 0.44, 0.10, 0.12),
        (0.72, 0.30, 0.07, 0.08),
        (0.86, 0.62, 0.09, 0.10),
    ]
    for cx, cy, rx, ry in blobs:
        dx = wrap_u_dist(u, cx) / rx
        dy = (v - cy) / ry
        if dx * dx + dy * dy <= 1.0:
            return True
    return False


def draw_earth(f=0):
    im = new_img()

    # Palette inspired by the provided reference.
    ocean = (52, 150, 240)
    ocean_d = (43, 106, 198)
    ocean_band = (35, 92, 182)
    ocean_edge = (38, 78, 165)
    land = (71, 178, 94)
    land_d = (53, 145, 80)
    rim = (135, 224, 214)

    cx, cy, r = 8, 8, 6
    phase = (f % NUM_FRAMES) / NUM_FRAMES
    roll = math.sin(phase * 2.0 * math.pi)

    # Globe body with hemisphere projection and longitudinal scrolling.
    for y in range(CANVAS):
        for x in range(CANVAS):
            dx, dy = x - cx, y - cy
            nx = dx / r
            ny = dy / r
            d2 = nx * nx + ny * ny
            if d2 <= 1.0:
                if d2 >= 0.82:
                    px(im, x, y, ocean_edge)
                else:
                    hemi_u = math.asin(max(-1.0, min(1.0, nx))) / math.pi + 0.5
                    globe_u = (phase + (hemi_u - 0.5) * 0.5) % 1.0
                    globe_v = ny * 0.5 + 0.5

                    if is_land(globe_u, globe_v):
                        px(im, x, y, land_d if nx > 0.25 else land)
                    else:
                        # Rotating ocean bands help read "rolling" motion.
                        band = abs((globe_u * 6.0) % 1.0 - 0.5) < 0.12 and abs(globe_v - 0.52) < 0.28
                        if band:
                            px(im, x, y, ocean_band if nx > 0.15 else ocean_d)
                        else:
                            px(im, x, y, ocean_d if nx > 0.20 else ocean)

    # Left-side bright rim.
    for y in (5, 6, 7, 8, 9):
        px(im, 3 + (1 if y in (5, 9) else 0), y, rim)

    # Bottom dark notch seen in the reference.
    px(im, 7, 14, ocean_edge)
    px(im, 8, 14, ocean_edge)
    px(im, 9, 14, ocean_edge)

    # Ground contact shadow with slight side shift for roll feeling.
    shadow = (24, 58, 120)
    sx = 8 + (1 if roll > 0.35 else -1 if roll < -0.35 else 0)
    px(im, sx - 2, 15, shadow)
    px(im, sx - 1, 15, shadow)
    px(im, sx, 15, shadow)
    px(im, sx + 1, 15, shadow)

    return im


def save_set(frames, folder, name, scale, suffix=""):
    scaled = [f.resize((f.width * scale, f.height * scale), Image.NEAREST) for f in frames]
    png = os.path.join(folder, f"{name}{suffix}.png")
    gif = os.path.join(folder, f"{name}{suffix}.gif")
    scaled[0].save(png)
    scaled[0].save(
        gif,
        save_all=True,
        append_images=scaled[1:],
        duration=FRAME_DURATION,
        loop=0,
        disposal=2,
    )
    return png, gif


def generate():
    frames = [draw_earth(f) for f in range(NUM_FRAMES)]
    p512, g512 = save_set(frames, BASE_DIR, "earth", SCALE_BIG)
    p64, g64 = save_set(frames, BASE_DIR, "earth", SCALE_SM, "_64")
    print(f"[OK] {p512}")
    print(f"[OK] {g512}")
    print(f"[OK] {p64}")
    print(f"[OK] {g64}")


if __name__ == "__main__":
    generate()
