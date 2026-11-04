"""
Generates sample files across different formats (PDF, DOCX, XLSX, PNG, MD)
for testing the universal converter.
"""

import os
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import docx
import openpyxl

SAMPLE_DIR = Path("c:/Pdf_converter/sample_pdfs")
SAMPLE_DIR.mkdir(parents=True, exist_ok=True)

def generate_samples():
    # 1. Word DOCX Sample
    docx_path = SAMPLE_DIR / "Sample_Document.docx"
    doc = docx.Document()
    doc.add_heading("Annual Project Proposal", 0)
    p = doc.add_paragraph("This is a sample Microsoft Word document designed to test converting Word files into ")
    p.add_run("PDF, Clean Text, Markdown, HTML, and Images.").bold = True
    doc.add_heading("Key Project Milestones", level=1)
    doc.add_paragraph("1. System Architecture Design - Q1\n2. Core Engine Implementation - Q2\n3. Universal Format Integration - Q3")
    table = doc.add_table(rows=3, cols=3)
    table.style = 'Table Grid'
    hdr = table.rows[0].cells
    hdr[0].text = "Phase"
    hdr[1].text = "Lead Team"
    hdr[2].text = "Status"
    row1 = table.rows[1].cells
    row1[0].text = "Phase 1: Prototyping"
    row1[1].text = "Engineering"
    row1[2].text = "Completed"
    row2 = table.rows[2].cells
    row2[0].text = "Phase 2: Radial UI"
    row2[1].text = "Product Design"
    row2[2].text = "Active"
    doc.save(str(docx_path))
    print(f"Created: {docx_path}")

    # 2. Excel XLSX Sample
    xlsx_path = SAMPLE_DIR / "Sample_Spreadsheet.xlsx"
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Sales Summary"
    ws.append(["Region", "Product Category", "Units Sold", "Total Revenue ($)", "Status"])
    ws.append(["North America", "Software Licenses", 1450, 725000, "Finalized"])
    ws.append(["Europe", "Cloud Compute", 920, 460000, "Finalized"])
    ws.append(["Asia Pacific", "Developer Tools", 2100, 525000, "Reviewing"])
    ws.append(["Latin America", "Enterprise Support", 380, 190000, "Approved"])
    wb.save(str(xlsx_path))
    print(f"Created: {xlsx_path}")

    # 3. Image PNG Sample
    png_path = SAMPLE_DIR / "Sample_Image.png"
    img = Image.new("RGB", (600, 340), color=(79, 70, 229)) # Indigo background
    draw = ImageDraw.Draw(img)
    # Draw geometric shapes & text
    draw.rectangle([20, 20, 580, 320], outline=(255, 255, 255), width=3)
    draw.text((60, 80), "ORBITAL UNIVERSAL CONVERTER", fill=(255, 255, 255))
    draw.text((60, 130), "Sample High-Resolution Image File", fill=(224, 231, 255))
    draw.text((60, 180), "Convert this image into PDF, WebP, JPG, or Grayscale!", fill=(199, 210, 254))
    draw.ellipse([460, 80, 530, 150], fill=(236, 72, 153))
    draw.rectangle([450, 180, 540, 270], fill=(16, 185, 129))
    img.save(str(png_path), format="PNG")
    print(f"Created: {png_path}")

    # 4. Markdown MD Sample
    md_path = SAMPLE_DIR / "Sample_Notes.md"
    md_content = """# Executive Briefing & Technical Notes

Welcome to the **Universal Orbital Converter**!

## System Capabilities
- **Any-to-Any Conversion:** Drop Word, Excel, Images, Text, or PDFs.
- **Dynamic Radial UI:** The options circle automatically reconfigures to match your file format.
- **High Performance:** Instant processing done locally on your machine.

### Target Formats for Markdown:
1. `PDF Document` (Letter, formatted typography)
2. `Microsoft Word` (.docx document)
3. `HTML Webpage` (Styled HTML5)
4. `Plain Text` (.txt format)

*Generated for universal file conversion testing.*
"""
    with open(md_path, "w", encoding="utf-8") as f:
        f.write(md_content)
    print(f"Created: {md_path}")

if __name__ == "__main__":
    generate_samples()
