"""
Test UniversalConverter across all file types
"""
import os
import shutil
from pathlib import Path
from app.converter import UniversalConverter

def test_universal():
    out_dir = Path("c:/Pdf_converter/test_universal_output")
    out_dir.mkdir(exist_ok=True)

    # 1. Test DOCX -> PDF
    docx_p = Path("sample_pdfs/Sample_Document.docx")
    with open(docx_p, "rb") as f:
        docx_bytes = f.read()
    res_p, mime = UniversalConverter.convert_any(docx_bytes, docx_p.name, "pdf", str(out_dir))
    assert os.path.exists(res_p) and os.path.getsize(res_p) > 0
    print(f"1. DOCX -> PDF passed! {res_p} ({os.path.getsize(res_p)} bytes)")

    # 2. Test DOCX -> TXT
    res_p, mime = UniversalConverter.convert_any(docx_bytes, docx_p.name, "txt", str(out_dir))
    assert os.path.exists(res_p) and os.path.getsize(res_p) > 0
    print(f"2. DOCX -> TXT passed! {res_p}")

    # 3. Test XLSX -> PDF
    xlsx_p = Path("sample_pdfs/Sample_Spreadsheet.xlsx")
    with open(xlsx_p, "rb") as f:
        xlsx_bytes = f.read()
    res_p, mime = UniversalConverter.convert_any(xlsx_bytes, xlsx_p.name, "pdf", str(out_dir))
    assert os.path.exists(res_p) and os.path.getsize(res_p) > 0
    print(f"3. XLSX -> PDF passed! {res_p} ({os.path.getsize(res_p)} bytes)")

    # 4. Test XLSX -> JSON & CSV
    res_p, mime = UniversalConverter.convert_any(xlsx_bytes, xlsx_p.name, "json", str(out_dir))
    assert os.path.exists(res_p) and os.path.getsize(res_p) > 0
    print(f"4. XLSX -> JSON passed! {res_p}")

    # 5. Test Image -> PDF
    img_p = Path("sample_pdfs/Sample_Image.png")
    with open(img_p, "rb") as f:
        img_bytes = f.read()
    res_p, mime = UniversalConverter.convert_any(img_bytes, img_p.name, "pdf", str(out_dir))
    assert os.path.exists(res_p) and os.path.getsize(res_p) > 0
    print(f"5. Image -> PDF passed! {res_p}")

    # 6. Test Markdown -> PDF & DOCX
    md_p = Path("sample_pdfs/Sample_Notes.md")
    with open(md_p, "rb") as f:
        md_bytes = f.read()
    res_p, mime = UniversalConverter.convert_any(md_bytes, md_p.name, "pdf", str(out_dir))
    assert os.path.exists(res_p) and os.path.getsize(res_p) > 0
    print(f"6. MD -> PDF passed! {res_p}")

    res_p, mime = UniversalConverter.convert_any(md_bytes, md_p.name, "docx", str(out_dir))
    assert os.path.exists(res_p) and os.path.getsize(res_p) > 0
    print(f"7. MD -> DOCX passed! {res_p}")

    # Cleanup
    shutil.rmtree(out_dir, ignore_errors=True)
    print("\nALL UNIVERSAL CONVERSIONS PASSED! [OK]")

if __name__ == "__main__":
    test_universal()
