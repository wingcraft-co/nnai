"""
Generate a GIF that matches the header globe implementation in ui/loading.py.
Output: earth_web.gif / earth_web.png
"""
import math
import os
from PIL import Image, ImageDraw

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

W = [
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0],
    [1, 1, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0],
    [0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 0, 0, 0, 1, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
]

LAND = ["#1B5E20", "#2E7D32", "#43A047", "#66BB6A"]
OCEAN = ["#0A1F6B", "#0D47A1", "#1565C0", "#1E88E5"]

WIDTH = 48
HEIGHT = 48
CX = 24
CY = 24
R = 22
PS = 3
MC = 24
MR = 12

# One full turn in one loop.
NUM_FRAMES = 48
FRAME_DURATION_MS = 140
OUTPUT_SIZE = 512


def hex_to_rgb(h):
    h = h.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), 255)


LAND_RGBA = [hex_to_rgb(c) for c in LAND]
OCEAN_RGBA = [hex_to_rgb(c) for c in OCEAN]


def shade(palette, light):
    idx = min(len(palette) - 1, int(light * len(palette)))
    return palette[idx]


def draw_block(im, x, y, color):
    for yy in range(y, y + PS):
        if yy < 0 or yy >= HEIGHT:
            continue
        for xx in range(x, x + PS):
            if 0 <= xx < WIDTH:
                im.putpixel((xx, yy), color)


def draw_globe_frame(angle):
    im = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))

    for py in range(-R, R, PS):
        for px in range(-R, R, PS):
            pc = px + PS / 2
            pcy = py + PS / 2
            d2 = pc * pc + pcy * pcy
            if d2 > R * R:
                continue

            z = math.sqrt(R * R - d2)
            lat = math.asin(-pcy / R)
            lon = (math.atan2(pc, z) - angle) % (2 * math.pi)
            mc = int(lon / (2 * math.pi) * MC) % MC
            mr = int((math.pi / 2 - lat) / math.pi * MR)
            mr = max(0, min(MR - 1, mr))
            light = z / R

            if W[mr][mc] == 1:
                col = shade(LAND_RGBA, light)
            else:
                col = shade(OCEAN_RGBA, light)

            sx = round(CX + px)
            sy = round(CY + py)
            draw_block(im, sx, sy, col)

    # Match the header's thin outline glow.
    draw = ImageDraw.Draw(im)
    draw.ellipse((CX - R, CY - R, CX + R, CY + R), outline=(120, 190, 255, 128), width=1)

    return im


def generate():
    frames = []
    for f in range(NUM_FRAMES):
        angle = -2 * math.pi * (f / NUM_FRAMES)
        base = draw_globe_frame(angle)
        frames.append(base.resize((OUTPUT_SIZE, OUTPUT_SIZE), Image.NEAREST))

    png_path = os.path.join(BASE_DIR, "earth_web.png")
    gif_path = os.path.join(BASE_DIR, "earth_web.gif")
    frames[0].save(png_path)
    frames[0].save(
        gif_path,
        save_all=True,
        append_images=frames[1:],
        duration=FRAME_DURATION_MS,
        loop=0,
        disposal=2,
    )
    print(f"[OK] {png_path}")
    print(f"[OK] {gif_path}")


if __name__ == "__main__":
    generate()
