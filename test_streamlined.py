"""
Test streamlined conversions: Word, PDF, PNG, JPG, Text
"""
import os
import shutil
from pathlib import Path
from app.converter import UniversalConverter

def test_streamlined():
    out_dir = Path("c:/Pdf_converter/test_streamlined_out")
    out_dir.mkdir(exist_ok=True)

    # 1. Test Word (.docx) -> PDF, PNG, JPG, TXT
    docx_p = Path("sample_pdfs/Sample_Document.docx")
    with open(docx_p, "rb") as f:
        docx_bytes = f.read()

    for target in ["pdf", "png", "jpg", "txt"]:
        res_p, mime = UniversalConverter.convert_any(docx_bytes, docx_p.name, target, str(out_dir))
        assert os.path.exists(res_p) and os.path.getsize(res_p) > 0
        print(f"Word -> {target.upper()} [OK] ({os.path.getsize(res_p)} bytes, {mime})")

    # 2. Test PDF (.pdf) -> Word, PNG, JPG, TXT
    pdf_p = Path("sample_pdfs/Sample_Financial_Report.pdf")
    with open(pdf_p, "rb") as f:
        pdf_bytes = f.read()

    for target in ["docx", "png", "jpg", "txt"]:
        res_p, mime = UniversalConverter.convert_any(pdf_bytes, pdf_p.name, target, str(out_dir))
        assert os.path.exists(res_p) and os.path.getsize(res_p) > 0
        print(f"PDF -> {target.upper()} [OK] ({os.path.getsize(res_p)} bytes, {mime})")

    # 3. Test Text (.txt) -> PDF, Word, PNG, JPG
    txt_p = Path("sample_pdfs/Sample_Document.txt")
    with open(txt_p, "rb") as f:
        txt_bytes = f.read()

    for target in ["pdf", "docx", "png", "jpg"]:
        res_p, mime = UniversalConverter.convert_any(txt_bytes, txt_p.name, target, str(out_dir))
        assert os.path.exists(res_p) and os.path.getsize(res_p) > 0
        print(f"Text -> {target.upper()} [OK] ({os.path.getsize(res_p)} bytes, {mime})")

    shutil.rmtree(out_dir, ignore_errors=True)
    print("\nALL STREAMLINED CONVERSIONS PASSED SUCCESSFULLY! [OK]")

if __name__ == "__main__":
    test_streamlined()
