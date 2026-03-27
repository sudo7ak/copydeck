from PIL import Image, ImageEnhance


def make_disabled(src: str, dst: str, *, alpha: float = 0.65, brighten: float = 1.05) -> None:
    im = Image.open(src).convert("RGBA")

    r, g, b, a = im.split()

    gray = Image.merge("RGB", (r, g, b)).convert("L")
    rgb = Image.merge("RGB", (gray, gray, gray))
    out = Image.merge("RGBA", (*rgb.split(), a))

    out = ImageEnhance.Brightness(out).enhance(brighten)

    r2, g2, b2, a2 = out.split()
    a2 = a2.point(lambda p: int(p * alpha))
    out = Image.merge("RGBA", (r2, g2, b2, a2))

    out.save(dst)


if __name__ == "__main__":
    for size in (16, 48, 128):
        make_disabled(
            f"icons/icon{size}.png",
            f"icons/icon{size}_disabled.png",
        )
    print("ok")
