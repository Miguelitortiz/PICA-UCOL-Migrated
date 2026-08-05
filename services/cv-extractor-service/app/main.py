import os
import shutil
import uuid
import subprocess
import json
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="PICA CV Extractor Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

TEMP_DIR = "/tmp/cv_extractor"
os.makedirs(TEMP_DIR, exist_ok=True)

@app.get("/health")
def health():
    return {"status": "healthy", "service": "cv-extractor-service"}

@app.post("/extract")
async def extract_cv(pdf: UploadFile = File(...)):
    if not pdf.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed.")
    
    task_id = str(uuid.uuid4())
    temp_pdf_path = os.path.join(TEMP_DIR, f"{task_id}.pdf")
    temp_json_path = os.path.join(TEMP_DIR, f"{task_id}.json")
    
    try:
        # Save uploaded PDF
        with open(temp_pdf_path, "wb") as buffer:
            shutil.copyfileobj(pdf.file, buffer)
        
        # Run cv_scraper.py script
        script_path = os.path.join(os.path.dirname(__file__), "cv_scraper.py")
        cmd = ["python", script_path, temp_pdf_path, temp_json_path]
        
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            raise HTTPException(status_code=500, detail=f"Scraper failed: {result.stderr}")
        
        # Read the output JSON
        if not os.path.exists(temp_json_path):
            raise HTTPException(status_code=500, detail="Scraper did not produce JSON output.")
            
        with open(temp_json_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            
        return data
        
    finally:
        # Clean up
        if os.path.exists(temp_pdf_path):
            os.remove(temp_pdf_path)
        if os.path.exists(temp_json_path):
            os.remove(temp_json_path)

@app.post("/format")
async def format_cv(raw_data: dict):
    task_id = str(uuid.uuid4())
    temp_raw_path = os.path.join(TEMP_DIR, f"raw_{task_id}.json")
    temp_out_dir = os.path.join(TEMP_DIR, f"out_{task_id}")
    os.makedirs(temp_out_dir, exist_ok=True)
    
    try:
        # Save raw JSON
        with open(temp_raw_path, "w", encoding="utf-8") as f:
            json.dump(raw_data, f, indent=2, ensure_ascii=False)
            
        # Run format_cv.py script
        script_path = os.path.join(os.path.dirname(__file__), "format_cv.py")
        cmd = ["python", script_path, temp_raw_path, temp_out_dir]
        
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            raise HTTPException(status_code=500, detail=f"Formatter failed: {result.stderr}")
            
        # Read the formatted JSON file
        files = os.listdir(temp_out_dir)
        formatted_file = next((f for f in files if f.endswith('.json')), None)
        if not formatted_file:
            raise HTTPException(status_code=500, detail="Formatter did not produce any JSON output.")
            
        formatted_path = os.path.join(temp_out_dir, formatted_file)
        with open(formatted_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            
        return data
        
    finally:
        # Clean up
        if os.path.exists(temp_raw_path):
            os.remove(temp_raw_path)
        if os.path.exists(temp_out_dir):
            shutil.rmtree(temp_out_dir)
