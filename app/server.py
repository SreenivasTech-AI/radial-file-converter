"""
FastAPI Server for Universal Radial Converter
Supports Any-to-Any Conversions:
PDF, Word (DOCX), Excel (XLSX/CSV), Images (PNG/JPG/WEBP), Text/Markdown (TXT/MD), HTML.
"""

import os
import uuid
import time
import shutil
import logging
from pathlib import Path
from typing import Dict, Any, List, Optional

logger = logging.getLogger(__name__)

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks, Query
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from app.converter import UniversalConverter, PDFConverter

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
OUTPUT_DIR = BASE_DIR / "converted_output"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
SAMPLE_DIR = BASE_DIR.parent / "sample_pdfs"
SAMPLE_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(
    title="Universal Radial Converter",
    description="Drag-and-Drop Any-to-Any File Converter into PDF, Word, Excel, Images, Text, and more.",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory storage for conversion tasks
conversions_db: Dict[str, Dict[str, Any]] = {}

def cleanup_old_files():
    """Removes output files older than 2 hours."""
    now = time.time()
    cutoff = now - 7200
    to_delete = []
    for task_id, data in conversions_db.items():
        if data.get("created_at", 0) < cutoff:
            p = data.get("filepath")
            if p and os.path.exists(p):
                try:
                    if os.path.isdir(p):
                        shutil.rmtree(p, ignore_errors=True)
                    else:
                        os.remove(p)
                except OSError:
                    pass
            to_delete.append(task_id)
    for tid in to_delete:
        conversions_db.pop(tid, None)

@app.get("/api/formats")
async def get_formats(filename: Optional[str] = Query(None)):
    """
    Returns the dynamic available conversion targets based on the input file extension.
    """
    if not filename:
        category = "pdf"
    else:
        category = UniversalConverter.detect_category(filename)
    formats = UniversalConverter.get_format_options(category)
    return JSONResponse(content={
        "category": category,
        "filename": filename or "",
        "formats": formats
    })

@app.get("/api/samples")
async def get_samples():
    """Returns sample files for immediate one-click testing."""
    samples = [
        {"name": "Sample_Document.docx", "type": "Word", "label": "Word Document (to PDF, PNG, JPG, GIF, Text)", "url": "/sample_pdfs/Sample_Document.docx"},
        {"name": "Sample_Financial_Report.pdf", "type": "PDF", "label": "PDF File (to Word, PNG, JPG, GIF, Text)", "url": "/sample_pdfs/Sample_Financial_Report.pdf"},
        {"name": "Sample_Image.png", "type": "Image", "label": "PNG Image (Transparency)", "url": "/sample_pdfs/Sample_Image.png"},
        {"name": "Sample_Graphic.gif", "type": "Image", "label": "GIF Graphic (Animated / Low-Color)", "url": "/sample_pdfs/Sample_Graphic.gif"},
        {"name": "Sample_Document.txt", "type": "Text", "label": "Text File (to PDF, Word, PNG, JPG, GIF)", "url": "/sample_pdfs/Sample_Document.txt"},
    ]
    return JSONResponse(content=samples)

@app.post("/api/convert")
async def convert_file(
    file: UploadFile = File(...),
    target_format: str = Form(..., alias="format"),
    background_tasks: BackgroundTasks = BackgroundTasks()
):
    """
    Converts ANY uploaded file into the chosen target format.
    """
    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    task_id = str(uuid.uuid4())
    task_dir = OUTPUT_DIR / task_id
    task_dir.mkdir(parents=True, exist_ok=True)

    start_time = time.time()
    try:
        converted_path, mime_type = UniversalConverter.convert_any(
            file_bytes=file_bytes,
            filename=file.filename,
            target_format=target_format,
            output_dir=str(task_dir)
        )

        if not converted_path or not os.path.exists(converted_path):
            raise HTTPException(status_code=500, detail="Conversion completed but output file not found.")

        duration = round(time.time() - start_time, 2)
        size_bytes = os.path.getsize(converted_path)
        out_name = os.path.basename(converted_path)

        conversions_db[task_id] = {
            "task_id": task_id,
            "filepath": converted_path,
            "filename": out_name,
            "original_filename": file.filename,
            "format": target_format.lower(),
            "mime_type": mime_type,
            "size_bytes": size_bytes,
            "duration_sec": duration,
            "created_at": time.time()
        }

        background_tasks.add_task(cleanup_old_files)

        return JSONResponse(content={
            "success": True,
            "task_id": task_id,
            "filename": out_name,
            "format": target_format.lower(),
            "size_kb": round(size_bytes / 1024, 1),
            "duration_sec": duration,
            "download_url": f"/api/download/{task_id}"
        })

    except Exception as e:
        logger.exception(f"Conversion error: {e}")
        raise HTTPException(status_code=500, detail=f"Conversion error: {str(e)}")

@app.api_route("/api/download/{task_id}", methods=["GET", "HEAD"])
async def download_file(task_id: str):
    """Streams the converted file for direct download."""
    record = conversions_db.get(task_id)
    if not record or not os.path.exists(record["filepath"]):
        raise HTTPException(status_code=404, detail="File not found or has expired.")

    return FileResponse(
        path=record["filepath"],
        filename=record["filename"],
        media_type=record.get("mime_type", "application/octet-stream"),
        headers={"Content-Disposition": f'attachment; filename="{record["filename"]}"'}
    )

@app.get("/api/history")
async def get_history():
    """Returns recent conversions."""
    items = sorted(
        conversions_db.values(),
        key=lambda x: x.get("created_at", 0),
        reverse=True
    )[:10]
    return JSONResponse(content=[
        {
            "task_id": item["task_id"],
            "filename": item["filename"],
            "original_filename": item["original_filename"],
            "format": item["format"],
            "size_kb": round(item["size_bytes"] / 1024, 1),
            "duration_sec": item.get("duration_sec", 0),
            "download_url": f"/api/download/{item['task_id']}"
        }
        for item in items
    ])

@app.get("/api/health")
async def health():
    return {"status": "ok", "app": "Universal Radial Converter"}

# Mount sample files
if SAMPLE_DIR.exists():
    app.mount("/sample_pdfs", StaticFiles(directory=str(SAMPLE_DIR)), name="sample_pdfs")

# Mount frontend
if STATIC_DIR.exists():
    app.mount("/", StaticFiles(directory=str(STATIC_DIR), html=True), name="static")
