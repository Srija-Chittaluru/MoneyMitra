"""
OCR for photographed or scanned documents (PAN card images, scanned PDFs).

Runs Tesseract locally — no document leaves the server. Pages of scanned
PDFs are rendered with pdfium. If Tesseract isn't installed, OCR is reported
as unavailable and the caller treats the document as unreadable.
"""

import re
import shutil
from io import BytesIO

from PIL import Image, ImageOps

MAX_OCR_PAGES = 10
_RENDER_SCALE = 300 / 72  # 300 dpi


def ocr_available() -> bool:
    return shutil.which("tesseract") is not None


def _prepare(image: Image.Image) -> Image.Image:
    image = ImageOps.exif_transpose(image).convert("L")
    # Small phone crops OCR much better when upscaled.
    if image.width < 1600:
        factor = 1600 / image.width
        image = image.resize((int(image.width * factor), int(image.height * factor)), Image.LANCZOS)
    return ImageOps.autocontrast(image)


def _lines(text: str) -> list[str]:
    text = text.replace("’", "'").replace("‘", "'")
    lines = [re.sub(r"\s+", " ", line).strip(" |") for line in text.splitlines()]
    return [line for line in lines if line]


def ocr_image(data: bytes) -> list[str]:
    import pytesseract

    image = _prepare(Image.open(BytesIO(data)))
    return _lines(pytesseract.image_to_string(image, config="--psm 3"))


def ocr_pdf(data: bytes) -> list[str]:
    import pypdfium2 as pdfium
    import pytesseract

    pdf = pdfium.PdfDocument(data)
    lines: list[str] = []
    for index in range(min(len(pdf), MAX_OCR_PAGES)):
        image = pdf[index].render(scale=_RENDER_SCALE).to_pil()
        lines += _lines(pytesseract.image_to_string(_prepare(image), config="--psm 3"))
    return lines
