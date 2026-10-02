"""Extract text from the Virginia Driver's Manual PDF into per-page text files.

Usage: python tools/extract.py
Output: content/manual/pages/page-NNN.txt and content/manual/manual.txt
"""
from pathlib import Path
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parent.parent
PDF = ROOT / "content" / "manual" / "dmv39.pdf"
OUT = ROOT / "content" / "manual" / "pages"


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    reader = PdfReader(str(PDF))
    combined = []
    for i, page in enumerate(reader.pages, start=1):
        text = page.extract_text() or ""
        (OUT / f"page-{i:03d}.txt").write_text(text, encoding="utf-8")
        combined.append(f"\n\n===== PAGE {i} =====\n{text}")
    (ROOT / "content" / "manual" / "manual.txt").write_text("".join(combined), encoding="utf-8")
    print(f"Extracted {len(reader.pages)} pages")


if __name__ == "__main__":
    main()
