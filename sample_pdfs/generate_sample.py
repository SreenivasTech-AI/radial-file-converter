"""
Generates a rich sample PDF containing headings, styled text, bullet points, and tables.
Used for testing and immediate user demonstration.
"""

import os
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

def generate_sample_pdf(output_path: str):
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    doc = SimpleDocTemplate(
        output_path,
        pagesize=letter,
        rightMargin=40, leftMargin=40,
        topMargin=40, bottomMargin=40
    )
    
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontSize=24,
        leading=28,
        textColor=colors.HexColor('#1E293B'),
        spaceAfter=12
    )
    subtitle_style = ParagraphStyle(
        'DocSubTitle',
        parent=styles['Normal'],
        fontSize=12,
        leading=16,
        textColor=colors.HexColor('#64748B'),
        spaceAfter=18
    )
    body_style = ParagraphStyle(
        'DocBody',
        parent=styles['Normal'],
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#334155'),
        spaceAfter=10
    )
    
    elements = []
    
    # Title & Header
    elements.append(Paragraph("Quarterly Performance & Financial Report", title_style))
    elements.append(Paragraph("Confidential Document &bull; Generated for Multi-Format Conversion Testing", subtitle_style))
    elements.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#E2E8F0'), spaceAfter=15))
    
    # Executive Summary Paragraph
    summary_text = (
        "<b>Executive Summary:</b> This document tests conversion fidelity across Word documents, "
        "Excel spreadsheets, clean plain text files, markdown documentation, and high-resolution images. "
        "The automated drag-and-drop radial converter processes this file locally with zero external network dependencies."
    )
    elements.append(Paragraph(summary_text, body_style))
    elements.append(Spacer(1, 10))
    
    # Financial Data Table
    table_data = [
        ["Department", "Q1 Budget ($)", "Q2 Budget ($)", "Growth (%)", "Audit Status"],
        ["Engineering", "1,250,000", "1,480,000", "+18.4%", "Verified"],
        ["Product Design", "420,000", "495,000", "+17.8%", "Verified"],
        ["Marketing & Sales", "890,000", "940,000", "+5.6%", "Approved"],
        ["Operations & Cloud", "610,000", "630,000", "+3.2%", "Pending"],
        ["Customer Success", "340,000", "390,000", "+14.7%", "Verified"],
        ["Total / Consolidated", "3,510,000", "3,935,000", "+12.1%", "Completed"]
    ]
    
    t = Table(table_data, colWidths=[130, 100, 100, 90, 100])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1E3A8A')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
        ('TOPPADDING', (0, 0), (-1, 0), 8),
        ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#F8FAFC')),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -2), [colors.HexColor('#FFFFFF'), colors.HexColor('#F1F5F9')]),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#E2E8F0')),
    ]))
    
    elements.append(t)
    elements.append(Spacer(1, 20))
    
    # Next steps
    elements.append(Paragraph("<b>Key Strategic Deliverables:</b>", body_style))
    deliverables = [
        "&bull; <b>Zero-Cloud Processing:</b> All PDF documents are converted directly on the user's local machine.",
        "&bull; <b>Multi-Format Radial Target:</b> Dragging to specific radial slots converts instantly without extra clicks.",
        "&bull; <b>Batch Extraction:</b> Tables are formatted into spreadsheets, layout into Word, and pages into crisp PNGs."
    ]
    for d in deliverables:
        elements.append(Paragraph(d, body_style))
        elements.append(Spacer(1, 4))
        
    doc.build(elements)
    print(f"Sample PDF created successfully at: {output_path}")

if __name__ == "__main__":
    generate_sample_pdf("c:/Pdf_converter/sample_pdfs/Sample_Financial_Report.pdf")
