"""
Test script for PDFConverter methods
"""
import os
import shutil
from pathlib import Path
from app.converter import PDFConverter

def test_all():
    sample_pdf_path = Path("sample_pdfs/Sample_Financial_Report.pdf")
    assert sample_pdf_path.exists(), "Sample PDF not found"
    
    with open(sample_pdf_path, "rb") as f:
        pdf_bytes = f.read()

    test_out = Path("test_output")
    test_out.mkdir(exist_ok=True)
    
    print("1. Testing inspect_pdf...")
    meta = PDFConverter.inspect_pdf(pdf_bytes)
    print(f"   Pages: {meta['page_count']}, has_thumb: {bool(meta['first_page_thumb'])}")
    assert meta["page_count"] == 1
    
    print("2. Testing to_docx...")
    docx_path = str(test_out / "output.docx")
    PDFConverter.to_docx(pdf_bytes, docx_path)
    assert os.path.exists(docx_path) and os.path.getsize(docx_path) > 0
    print(f"   DOCX created ({os.path.getsize(docx_path)} bytes)")

    print("3. Testing to_excel...")
    xlsx_path = str(test_out / "output.xlsx")
    PDFConverter.to_excel(pdf_bytes, xlsx_path)
    assert os.path.exists(xlsx_path) and os.path.getsize(xlsx_path) > 0
    print(f"   XLSX created ({os.path.getsize(xlsx_path)} bytes)")

    print("4. Testing to_text...")
    txt_path = str(test_out / "output.txt")
    PDFConverter.to_text(pdf_bytes, txt_path)
    assert os.path.exists(txt_path) and os.path.getsize(txt_path) > 0
    print(f"   TXT created ({os.path.getsize(txt_path)} bytes)")

    print("5. Testing to_markdown...")
    md_path = str(test_out / "output.md")
    PDFConverter.to_markdown(pdf_bytes, md_path)
    assert os.path.exists(md_path) and os.path.getsize(md_path) > 0
    print(f"   MD created ({os.path.getsize(md_path)} bytes)")

    print("6. Testing to_html...")
    html_path = str(test_out / "output.html")
    PDFConverter.to_html(pdf_bytes, html_path)
    assert os.path.exists(html_path) and os.path.getsize(html_path) > 0
    print(f"   HTML created ({os.path.getsize(html_path)} bytes)")

    print("7. Testing to_images...")
    img_out = PDFConverter.to_images(pdf_bytes, str(test_out), "test_doc")
    assert os.path.exists(img_out) and os.path.getsize(img_out) > 0
    print(f"   Image created: {img_out} ({os.path.getsize(img_out)} bytes)")

    print("8. Testing to_all_bundle...")
    zip_out = PDFConverter.to_all_bundle(pdf_bytes, str(test_out), "test_doc")
    assert os.path.exists(zip_out) and os.path.getsize(zip_out) > 0
    print(f"   Bundle created: {zip_out} ({os.path.getsize(zip_out)} bytes)")

    print("\nALL 8 CONVERSION TESTS PASSED SUCCESSFULLY! [OK]")

if __name__ == "__main__":
    test_all()
