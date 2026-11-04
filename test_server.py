"""
Integration test for FastAPI endpoints
"""
from fastapi.testclient import TestClient
from pathlib import Path
from app.server import app

client = TestClient(app)

def test_api():
    print("1. Testing GET /api/health...")
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"
    print("   Health check passed!")

    print("2. Testing POST /api/inspect...")
    sample_pdf = Path("sample_pdfs/Sample_Financial_Report.pdf")
    with open(sample_pdf, "rb") as f:
        file_bytes = f.read()

    res = client.post(
        "/api/inspect",
        files={"file": ("sample.pdf", file_bytes, "application/pdf")}
    )
    assert res.status_code == 200
    data = res.json()
    assert data["page_count"] == 1
    assert "first_page_thumb" in data
    print(f"   Inspect passed! (Pages: {data['page_count']})")

    print("3. Testing POST /api/convert (format=docx)...")
    res = client.post(
        "/api/convert",
        files={"file": ("sample.pdf", file_bytes, "application/pdf")},
        data={"format": "docx"}
    )
    assert res.status_code == 200
    conv_data = res.json()
    assert conv_data["success"] is True
    assert conv_data["filename"].endswith(".docx")
    task_id = conv_data["task_id"]
    print(f"   Converted to docx successfully: {conv_data['filename']}")

    print("4. Testing GET /api/download/{task_id}...")
    dl_res = client.get(f"/api/download/{task_id}")
    assert dl_res.status_code == 200
    assert len(dl_res.content) > 0
    print(f"   Download verified! Received {len(dl_res.content)} bytes.")

    print("5. Testing GET /api/history...")
    hist_res = client.get("/api/history")
    assert hist_res.status_code == 200
    hist = hist_res.json()
    assert len(hist) >= 1
    print(f"   History returned {len(hist)} entries.")

    print("\nALL SERVER INTEGRATION TESTS PASSED SUCCESSFULLY! [OK]")

if __name__ == "__main__":
    test_api()
