"""
Streamlined Converter Engine
Supports:
- Document: PDF (.pdf), Word (.docx), Text (.txt)
- Images:
  - .png (images with transparency)
  - .jpg / .jpeg (compressed photos)
  - .gif (animated or low-color images)
"""

import os
import io
import re
import zipfile
import tempfile
import logging
from pathlib import Path
from typing import Dict, Any, List, Tuple
from PIL import Image

logger = logging.getLogger(__name__)

class UniversalConverter:

    @staticmethod
    def detect_category(filename: str) -> str:
        """Detects the category of input file by extension."""
        ext = Path(filename).suffix.lower()
        if ext in [".pdf"]:
            return "pdf"
        elif ext in [".docx", ".doc"]:
            return "docx"
        elif ext in [".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp"]:
            return "image"
        elif ext in [".txt", ".rtf", ".log"]:
            return "text"
        return "unknown"

    @staticmethod
    def get_format_options(source_category: str) -> List[Dict[str, Any]]:
        """
        Returns format options with explicit image distinctions:
        - PNG: images with transparency
        - JPG: compressed photos
        - GIF: animated or low-color images
        - PDF: PDF document
        - Word: Microsoft Word
        - Text: Clean plaintext
        """
        all_formats = {
            "pdf":  {"id": "pdf",  "label": "PDF",       "ext": ".pdf",  "sub": "PDF Document",            "icon": "file-down",      "color": "#ef4444", "strokeColor": "#f87171"},
            "docx": {"id": "docx", "label": "Word",      "ext": ".docx", "sub": "Microsoft Word",          "icon": "file-text",      "color": "#3b82f6", "strokeColor": "#60a5fa"},
            "png":  {"id": "png",  "label": "PNG",       "ext": ".png",  "sub": "Transparency / Crisp",    "icon": "image",          "color": "#a855f7", "strokeColor": "#c084fc"},
            "jpg":  {"id": "jpg",  "label": "JPG",       "ext": ".jpg",  "sub": "Compressed Photo",        "icon": "camera",         "color": "#10b981", "strokeColor": "#34d399"},
            "gif":  {"id": "gif",  "label": "GIF",       "ext": ".gif",  "sub": "Animated / Low-Color",    "icon": "film",           "color": "#ec4899", "strokeColor": "#f472b6"},
            "txt":  {"id": "txt",  "label": "Text",      "ext": ".txt",  "sub": "Clean Plaintext",         "icon": "file-code",      "color": "#f59e0b", "strokeColor": "#fbbf24"},
            "zip":  {"id": "zip",  "label": "All (ZIP)", "ext": ".zip",  "sub": "All-in-one ZIP Folder",   "icon": "archive",        "color": "#06b6d4", "strokeColor": "#22d3ee"},
        }

        if source_category == "docx":
            # Word -> PDF, PNG, JPG, GIF, Text, All (ZIP)
            return [all_formats["pdf"], all_formats["png"], all_formats["jpg"], all_formats["gif"], all_formats["txt"], all_formats["zip"]]
        elif source_category == "pdf":
            # PDF -> Word, PNG, JPG, GIF, Text, All (ZIP)
            return [all_formats["docx"], all_formats["png"], all_formats["jpg"], all_formats["gif"], all_formats["txt"], all_formats["zip"]]
        elif source_category == "image":
            # Image -> PDF, Word, PNG, JPG, GIF, Text, All (ZIP)
            return [all_formats["pdf"], all_formats["docx"], all_formats["png"], all_formats["jpg"], all_formats["gif"], all_formats["txt"], all_formats["zip"]]
        elif source_category == "text":
            # Text -> PDF, Word, PNG, JPG, GIF, All (ZIP)
            return [all_formats["pdf"], all_formats["docx"], all_formats["png"], all_formats["jpg"], all_formats["gif"], all_formats["zip"]]
        else:
            # Default idle state
            return [all_formats["pdf"], all_formats["docx"], all_formats["png"], all_formats["jpg"], all_formats["gif"], all_formats["txt"], all_formats["zip"]]

    @classmethod
    def convert_any(cls, file_bytes: bytes, filename: str, target_format: str, output_dir: str) -> Tuple[str, str]:
        """Universal conversion dispatcher for PDF, Word, PNG, JPG, GIF, Text, and All-in-One ZIP."""
        category = cls.detect_category(filename)
        clean_stem = "".join([c if c.isalnum() or c in ("-", "_") else "_" for c in Path(filename).stem]) or "document"
        target = target_format.lower().strip()

        # All-in-One ZIP bundle
        if target in ["zip", "all"]:
            return cls._convert_to_all_zip(file_bytes, filename, category, clean_stem, output_dir)

        # 1. PDF SOURCE
        if category == "pdf":
            return cls._convert_from_pdf(file_bytes, clean_stem, target, output_dir)

        # 2. WORD (DOCX) SOURCE
        elif category == "docx":
            return cls._convert_from_docx(file_bytes, clean_stem, target, output_dir)

        # 3. IMAGE (PNG/JPG/GIF) SOURCE
        elif category == "image":
            return cls._convert_from_image(file_bytes, clean_stem, target, output_dir)

        # 4. TEXT (TXT) SOURCE
        elif category == "text":
            return cls._convert_from_text(file_bytes, clean_stem, target, output_dir)

        else:
            try:
                return cls._convert_from_text(file_bytes, clean_stem, target, output_dir)
            except Exception:
                raise ValueError(f"Unsupported file type: {filename}")

    @classmethod
    def _convert_to_all_zip(cls, file_bytes: bytes, filename: str, category: str, clean_stem: str, output_dir: str) -> Tuple[str, str]:
        """Converts input file into all supported formats and packages them into a single ZIP folder."""
        if category == "docx":
            formats_to_build = ["pdf", "png", "jpg", "gif", "txt"]
        elif category == "pdf":
            formats_to_build = ["docx", "png", "jpg", "gif", "txt"]
        elif category == "image":
            ext = Path(filename).suffix.lower().lstrip(".")
            if ext in ["jpeg", "jpe"]:
                ext = "jpg"
            all_img_targets = ["pdf", "docx", "png", "jpg", "gif", "txt"]
            formats_to_build = [f for f in all_img_targets if f != ext]
        elif category == "text":
            formats_to_build = ["pdf", "docx", "png", "jpg", "gif"]
        else:
            formats_to_build = ["pdf", "docx", "png", "jpg", "gif", "txt"]

        bundle_stage_dir = os.path.join(output_dir, f"{clean_stem}_stage")
        os.makedirs(bundle_stage_dir, exist_ok=True)

        generated_files = []
        for fmt in formats_to_build:
            try:
                if category == "pdf":
                    out_path, _ = cls._convert_from_pdf(file_bytes, clean_stem, fmt, bundle_stage_dir)
                elif category == "docx":
                    out_path, _ = cls._convert_from_docx(file_bytes, clean_stem, fmt, bundle_stage_dir)
                elif category == "image":
                    out_path, _ = cls._convert_from_image(file_bytes, clean_stem, fmt, bundle_stage_dir)
                elif category == "text":
                    out_path, _ = cls._convert_from_text(file_bytes, clean_stem, fmt, bundle_stage_dir)
                else:
                    out_path, _ = cls._convert_from_text(file_bytes, clean_stem, fmt, bundle_stage_dir)

                if os.path.exists(out_path):
                    generated_files.append(out_path)
            except Exception as e:
                logger.warning(f"Could not convert {filename} to {fmt} for ZIP bundle: {e}")

        out_zip = os.path.join(output_dir, f"{clean_stem}_all_formats.zip")
        with zipfile.ZipFile(out_zip, "w", zipfile.ZIP_DEFLATED) as zf:
            for file_path in generated_files:
                if os.path.exists(file_path):
                    if file_path.endswith(".zip") and file_path != out_zip:
                        # Extract multi-page zips directly into subfolder inside the archive
                        with zipfile.ZipFile(file_path, "r") as sub_zf:
                            sub_folder = Path(file_path).stem
                            for member in sub_zf.namelist():
                                zf.writestr(f"{sub_folder}/{member}", sub_zf.read(member))
                    else:
                        zf.write(file_path, arcname=os.path.basename(file_path))

        return out_zip, "application/zip"

    # -------------------------------------------------------------
    # 1. CONVERT FROM PDF
    # -------------------------------------------------------------
    @classmethod
    def _convert_from_pdf(cls, pdf_bytes: bytes, base_name: str, target: str, output_dir: str) -> Tuple[str, str]:
        import pymupdf as fitz

        if target == "docx":
            out_p = os.path.join(output_dir, f"{base_name}.docx")
            PDFConverter.to_docx(pdf_bytes, out_p)
            return out_p, "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

        elif target == "png":
            doc = fitz.open(stream=pdf_bytes, filetype="pdf")
            if len(doc) == 1:
                out_p = os.path.join(output_dir, f"{base_name}.png")
                doc[0].get_pixmap(dpi=200).save(out_p)
                doc.close()
                return out_p, "image/png"
            else:
                out_zip = os.path.join(output_dir, f"{base_name}_png_images.zip")
                with zipfile.ZipFile(out_zip, "w", zipfile.ZIP_DEFLATED) as zf:
                    for i, page in enumerate(doc):
                        pix = page.get_pixmap(dpi=200)
                        img_path = os.path.join(output_dir, f"{base_name}_page_{i+1:02d}.png")
                        pix.save(img_path)
                        zf.write(img_path, arcname=os.path.basename(img_path))
                doc.close()
                return out_zip, "application/zip"

        elif target in ["jpg", "jpeg"]:
            doc = fitz.open(stream=pdf_bytes, filetype="pdf")
            if len(doc) == 1:
                out_p = os.path.join(output_dir, f"{base_name}.jpg")
                doc[0].get_pixmap(dpi=200).save(out_p)
                doc.close()
                return out_p, "image/jpeg"
            else:
                out_zip = os.path.join(output_dir, f"{base_name}_jpg_images.zip")
                with zipfile.ZipFile(out_zip, "w", zipfile.ZIP_DEFLATED) as zf:
                    for i, page in enumerate(doc):
                        pix = page.get_pixmap(dpi=200)
                        img_path = os.path.join(output_dir, f"{base_name}_page_{i+1:02d}.jpg")
                        pix.save(img_path)
                        zf.write(img_path, arcname=os.path.basename(img_path))
                doc.close()
                return out_zip, "application/zip"

        elif target == "gif":
            doc = fitz.open(stream=pdf_bytes, filetype="pdf")
            out_p = os.path.join(output_dir, f"{base_name}.gif")
            frames = []
            for page in doc:
                pix = page.get_pixmap(dpi=120)
                img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
                # Convert to palette adaptive for GIF
                frames.append(img.convert("P", palette=Image.ADAPTIVE))
            doc.close()

            if len(frames) == 1:
                frames[0].save(out_p, format="GIF")
            else:
                # Animated GIF flipping through pages!
                frames[0].save(out_p, save_all=True, append_images=frames[1:], duration=1000, loop=0)
            return out_p, "image/gif"

        elif target == "txt":
            out_p = os.path.join(output_dir, f"{base_name}.txt")
            PDFConverter.to_text(pdf_bytes, out_p)
            return out_p, "text/plain; charset=utf-8"

        else:
            raise ValueError(f"Unsupported format '{target}' for PDF")

    # -------------------------------------------------------------
    # 2. CONVERT FROM WORD (DOCX)
    # -------------------------------------------------------------
    @classmethod
    def _convert_from_docx(cls, docx_bytes: bytes, base_name: str, target: str, output_dir: str) -> Tuple[str, str]:
        import docx
        import pymupdf as fitz

        temp_docx = os.path.join(output_dir, f"temp_{base_name}.docx")
        with open(temp_docx, "wb") as f:
            f.write(docx_bytes)

        try:
            doc = docx.Document(temp_docx)

            if target in ["pdf", "png", "jpg", "jpeg", "gif"]:
                pdf_p = os.path.join(output_dir, f"{base_name}.pdf")
                # Try MS Word COM first
                try:
                    import win32com.client
                    w = win32com.client.Dispatch("Word.Application")
                    w.Visible = False
                    w_doc = w.Documents.Open(os.path.abspath(temp_docx))
                    w_doc.SaveAs(os.path.abspath(pdf_p), FileFormat=17) # wdFormatPDF
                    w_doc.Close()
                    w.Quit()
                except Exception as e:
                    logger.warning(f"Word COM failed ({e}), using ReportLab builder...")
                    cls._docx_to_pdf_reportlab(doc, pdf_p)

                if target == "pdf":
                    return pdf_p, "application/pdf"

                # Render to PNG, JPG, or GIF via PyMuPDF
                pdoc = fitz.open(pdf_p)
                if target == "gif":
                    out_p = os.path.join(output_dir, f"{base_name}.gif")
                    frames = []
                    for page in pdoc:
                        pix = page.get_pixmap(dpi=120)
                        im = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
                        frames.append(im.convert("P", palette=Image.ADAPTIVE))
                    pdoc.close()
                    if len(frames) == 1:
                        frames[0].save(out_p, format="GIF")
                    else:
                        frames[0].save(out_p, save_all=True, append_images=frames[1:], duration=1000, loop=0)
                    return out_p, "image/gif"
                else:
                    ext = "png" if target == "png" else "jpg"
                    if len(pdoc) == 1:
                        out_img = os.path.join(output_dir, f"{base_name}.{ext}")
                        pdoc[0].get_pixmap(dpi=200).save(out_img)
                        pdoc.close()
                        return out_img, f"image/{'png' if ext=='png' else 'jpeg'}"
                    else:
                        out_zip = os.path.join(output_dir, f"{base_name}_{ext}_images.zip")
                        with zipfile.ZipFile(out_zip, "w", zipfile.ZIP_DEFLATED) as zf:
                            for i, p in enumerate(pdoc):
                                img_path = os.path.join(output_dir, f"{base_name}_page_{i+1:02d}.{ext}")
                                p.get_pixmap(dpi=200).save(img_path)
                                zf.write(img_path, arcname=os.path.basename(img_path))
                        pdoc.close()
                        return out_zip, "application/zip"

            elif target == "txt":
                out_p = os.path.join(output_dir, f"{base_name}.txt")
                text_lines = [p.text for p in doc.paragraphs if p.text]
                for table in doc.tables:
                    text_lines.append("\n[TABLE]")
                    for row in table.rows:
                        text_lines.append("\t".join([c.text.strip() for c in row.cells]))
                with open(out_p, "w", encoding="utf-8") as f:
                    f.write("\n\n".join(text_lines))
                return out_p, "text/plain; charset=utf-8"

            else:
                raise ValueError(f"Unsupported format '{target}' for Word document")

        finally:
            if os.path.exists(temp_docx):
                try: os.remove(temp_docx)
                except OSError: pass

    @staticmethod
    def _docx_to_pdf_reportlab(doc, output_pdf: str):
        from reportlab.lib.pagesizes import letter
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
        from reportlab.lib.styles import getSampleStyleSheet
        pdf = SimpleDocTemplate(output_pdf, pagesize=letter)
        styles = getSampleStyleSheet()
        elements = []
        for p in doc.paragraphs:
            text = p.text.strip()
            if text:
                elements.append(Paragraph(text, styles["Normal"]))
                elements.append(Spacer(1, 8))
        if not elements:
            elements.append(Paragraph("Empty Document", styles["Normal"]))
        pdf.build(elements)

    # -------------------------------------------------------------
    # 3. CONVERT FROM IMAGE (PNG, JPG, GIF)
    # -------------------------------------------------------------
    @classmethod
    def _convert_from_image(cls, img_bytes: bytes, base_name: str, target: str, output_dir: str) -> Tuple[str, str]:
        import docx
        from docx.shared import Inches

        img = Image.open(io.BytesIO(img_bytes))

        if target == "pdf":
            out_p = os.path.join(output_dir, f"{base_name}.pdf")
            rgb_img = img.convert("RGB")
            rgb_img.save(out_p, format="PDF")
            return out_p, "application/pdf"

        elif target == "docx":
            out_p = os.path.join(output_dir, f"{base_name}.docx")
            temp_img = os.path.join(output_dir, f"temp_{base_name}.png")
            img.save(temp_img, format="PNG")
            try:
                word_doc = docx.Document()
                word_doc.add_heading(base_name.replace("_", " "), 0)
                word_doc.add_picture(temp_img, width=Inches(5.5))
                word_doc.save(out_p)
            finally:
                if os.path.exists(temp_img):
                    try: os.remove(temp_img)
                    except OSError: pass
            return out_p, "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

        elif target == "png":
            # Images with transparency
            out_p = os.path.join(output_dir, f"{base_name}.png")
            img.save(out_p, format="PNG")
            return out_p, "image/png"

        elif target in ["jpg", "jpeg"]:
            # Compressed photos
            out_p = os.path.join(output_dir, f"{base_name}.jpg")
            img.convert("RGB").save(out_p, format="JPEG", quality=92)
            return out_p, "image/jpeg"

        elif target == "gif":
            # Animated or low-color images
            out_p = os.path.join(output_dir, f"{base_name}.gif")
            # If input is already an animated GIF with multiple frames, preserve all frames
            if getattr(img, "is_animated", False):
                frames = []
                for frame_idx in range(img.n_frames):
                    img.seek(frame_idx)
                    frames.append(img.copy())
                frames[0].save(out_p, save_all=True, append_images=frames[1:], loop=0, duration=img.info.get("duration", 100))
            else:
                img.convert("P", palette=Image.ADAPTIVE).save(out_p, format="GIF")
            return out_p, "image/gif"

        elif target == "txt":
            out_p = os.path.join(output_dir, f"{base_name}.txt")
            info_text = (
                f"Image Name: {base_name}\n"
                f"Format: {img.format or 'Image'}\n"
                f"Dimensions: {img.width} x {img.height} px\n"
                f"Color Mode: {img.mode}\n"
                f"Animated: {getattr(img, 'is_animated', False)}\n"
            )
            with open(out_p, "w", encoding="utf-8") as f:
                f.write(info_text)
            return out_p, "text/plain; charset=utf-8"

        else:
            raise ValueError(f"Unsupported format '{target}' for Image")

    # -------------------------------------------------------------
    # 4. CONVERT FROM TEXT (TXT)
    # -------------------------------------------------------------
    @classmethod
    def _convert_from_text(cls, text_bytes: bytes, base_name: str, target: str, output_dir: str) -> Tuple[str, str]:
        text_content = text_bytes.decode("utf-8", errors="replace")

        if target == "pdf":
            out_p = os.path.join(output_dir, f"{base_name}.pdf")
            from reportlab.lib.pagesizes import letter
            from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
            from reportlab.lib.styles import getSampleStyleSheet
            pdf = SimpleDocTemplate(out_p, pagesize=letter)
            styles = getSampleStyleSheet()
            elements = []
            for line in text_content.split("\n"):
                clean = line.strip()
                if clean:
                    elements.append(Paragraph(clean.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"), styles["Normal"]))
                    elements.append(Spacer(1, 4))
            if not elements:
                elements.append(Paragraph("Empty Text File", styles["Normal"]))
            pdf.build(elements)
            return out_p, "application/pdf"

        elif target == "docx":
            out_p = os.path.join(output_dir, f"{base_name}.docx")
            import docx
            doc = docx.Document()
            for line in text_content.split("\n"):
                if line.strip():
                    doc.add_paragraph(line.strip())
            doc.save(out_p)
            return out_p, "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

        elif target in ["png", "jpg", "jpeg", "gif"]:
            pdf_p, _ = cls._convert_from_text(text_bytes, base_name, "pdf", output_dir)
            import pymupdf as fitz
            doc = fitz.open(pdf_p)
            pix = doc[0].get_pixmap(dpi=150)
            doc.close()

            if target == "gif":
                out_img = os.path.join(output_dir, f"{base_name}.gif")
                im = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
                im.convert("P", palette=Image.ADAPTIVE).save(out_img, format="GIF")
                return out_img, "image/gif"
            else:
                ext = "png" if target == "png" else "jpg"
                out_img = os.path.join(output_dir, f"{base_name}.{ext}")
                pix.save(out_img)
                return out_img, f"image/{'png' if ext=='png' else 'jpeg'}"

        elif target == "txt":
            out_p = os.path.join(output_dir, f"{base_name}.txt")
            with open(out_p, "w", encoding="utf-8") as f:
                f.write(text_content)
            return out_p, "text/plain; charset=utf-8"

        else:
            raise ValueError(f"Unsupported format '{target}' for Text")


# -------------------------------------------------------------
# PDF CONVERTER UTILITIES
# -------------------------------------------------------------
class PDFConverter:
    @staticmethod
    def to_docx(pdf_bytes: bytes, output_path: str) -> str:
        temp_pdf = None
        try:
            from pdf2docx import Converter
            with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
                f.write(pdf_bytes)
                temp_pdf = f.name
            cv = Converter(temp_pdf)
            cv.convert(output_path, start=0, end=None)
            cv.close()
            return output_path
        except Exception:
            return PDFConverter._fallback_to_docx(pdf_bytes, output_path)
        finally:
            if temp_pdf and os.path.exists(temp_pdf):
                try: os.remove(temp_pdf)
                except OSError: pass

    @staticmethod
    def _fallback_to_docx(pdf_bytes: bytes, output_path: str) -> str:
        import pymupdf as fitz
        from docx import Document
        from docx.shared import Pt
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        word_doc = Document()
        for idx, page in enumerate(doc):
            if idx > 0: word_doc.add_page_break()
            for block in page.get_text("blocks"):
                if len(block) >= 5 and block[4].strip():
                    p = word_doc.add_paragraph(block[4].strip())
                    p.paragraph_format.space_after = Pt(6)
        word_doc.save(output_path)
        doc.close()
        return output_path

    @staticmethod
    def to_text(pdf_bytes: bytes, output_path: str) -> str:
        import pymupdf as fitz
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        all_text = []
        for idx, page in enumerate(doc):
            all_text.append(f"--- [ PAGE {idx + 1} ] ---\n\n{page.get_text('text').strip()}\n")
        doc.close()
        with open(output_path, "w", encoding="utf-8") as f:
            f.write("\n".join(all_text))
        return output_path
