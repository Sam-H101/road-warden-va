"""Extract text from a state's driver manual PDF into per-page text files.

Usage: python tools/extract.py [state] [pdf]
  state  two-letter code, default "va"
  pdf    path to the manual PDF, default content/states/<state>/manual/manual.pdf
         (Virginia's is content/states/va/manual/dmv39.pdf)
Output: content/states/<state>/manual/pages/page-NNN.txt and .../manual/manual.txt
"""
import sys
from pathlib import Path
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parent.parent


def main() -> None:
    state = sys.argv[1] if len(sys.argv) > 1 else "va"
    manual = ROOT / "content" / "states" / state / "manual"
    default_pdf = manual / ("dmv39.pdf" if state == "va" else "manual.pdf")
    pdf = Path(sys.argv[2]) if len(sys.argv) > 2 else default_pdf
    out = manual / "pages"
    out.mkdir(parents=True, exist_ok=True)
    reader = PdfReader(str(pdf))
    combined = []
    for i, page in enumerate(reader.pages, start=1):
        text = page.extract_text() or ""
        (out / f"page-{i:03d}.txt").write_text(text, encoding="utf-8")
        combined.append(f"\n\n===== PAGE {i} =====\n{text}")
    (manual / "manual.txt").write_text("".join(combined), encoding="utf-8")
    print(f"Extracted {len(reader.pages)} pages to {manual.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
