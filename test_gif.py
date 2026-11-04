"""
Test GIF conversions: Image -> GIF, Word -> GIF, PDF -> GIF, GIF -> PDF/PNG/JPG
"""
import os
import shutil
from pathlib import Path
from app.converter import UniversalConverter

def test_gif():
    out_dir = Path("c:/Pdf_converter/test_gif_out")
    out_dir.mkdir(exist_ok=True)

    # 1. Image -> GIF
    img_p = Path("sample_pdfs/Sample_Image.png")
    with open(img_p, "rb") as f:
        img_bytes = f.read()
    res_p, mime = UniversalConverter.convert_any(img_bytes, img_p.name, "gif", str(out_dir))
    assert os.path.exists(res_p) and os.path.getsize(res_p) > 0 and mime == "image/gif"
    print(f"1. Image -> GIF [OK] ({os.path.getsize(res_p)} bytes)")

    # 2. PDF -> GIF
    pdf_p = Path("sample_pdfs/Sample_Financial_Report.pdf")
    with open(pdf_p, "rb") as f:
        pdf_bytes = f.read()
    res_p, mime = UniversalConverter.convert_any(pdf_bytes, pdf_p.name, "gif", str(out_dir))
    assert os.path.exists(res_p) and os.path.getsize(res_p) > 0 and mime == "image/gif"
    print(f"2. PDF -> GIF [OK] ({os.path.getsize(res_p)} bytes)")

    # 3. GIF -> PDF, PNG, JPG
    gif_p = Path("sample_pdfs/Sample_Graphic.gif")
    with open(gif_p, "rb") as f:
        gif_bytes = f.read()

    for target in ["pdf", "png", "jpg", "docx"]:
        res_p, mime = UniversalConverter.convert_any(gif_bytes, gif_p.name, target, str(out_dir))
        assert os.path.exists(res_p) and os.path.getsize(res_p) > 0
        print(f"3. GIF -> {target.upper()} [OK] ({os.path.getsize(res_p)} bytes, {mime})")

    shutil.rmtree(out_dir, ignore_errors=True)
    print("\nALL IMAGE & GIF CONVERSIONS PASSED SUCCESSFULLY! [OK]")

if __name__ == "__main__":
    test_gif()
