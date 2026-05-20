#!/usr/bin/env python3
"""
PDF Text Extractor v2 - Robust version that skips problematic PDFs
"""

import pdfplumber
import os
import warnings
from pathlib import Path

# Suppress font warnings
warnings.filterwarnings("ignore")

ARTICLES_DIR = Path("articles")
OUTPUT_DIR = Path("articles_text")
OUTPUT_DIR.mkdir(exist_ok=True)

pdf_files = sorted(ARTICLES_DIR.glob("*.pdf"))
already_done = set(f.stem for f in OUTPUT_DIR.glob("*.txt"))

print(f"Total PDFs: {len(pdf_files)}, Already extracted: {len(already_done)}")
print("=" * 80)

success = 0
failed = []

for pdf_file in pdf_files:
    if pdf_file.stem in already_done:
        print(f"⊘ {pdf_file.name} (already done)")
        success += 1
        continue
    
    output_file = OUTPUT_DIR / f"{pdf_file.stem}.txt"
    
    try:
        with pdfplumber.open(pdf_file, password="") as pdf:
            full_text = ""
            
            for page_num, page in enumerate(pdf.pages, 1):
                try:
                    text = page.extract_text()
                    if text:
                        full_text += f"\n\n--- PAGE {page_num} ---\n{text}"
                    
                    tables = page.extract_tables()
                    if tables:
                        for table in tables:
                            full_text += f"\n\n[TABLE on PAGE {page_num}]\n"
                            for row in table:
                                full_text += " | ".join(str(cell) if cell else "" for cell in row) + "\n"
                except Exception as e:
                    full_text += f"\n\n[ERROR on PAGE {page_num}: {str(e)[:50]}]"
            
            with open(output_file, "w", encoding="utf-8") as f:
                f.write(full_text)
            
            print(f"✓ {pdf_file.name} ({len(pdf.pages)} pages)")
            success += 1
    
    except Exception as e:
        print(f"✗ {pdf_file.name} - SKIP (ERROR: {str(e)[:40]})")
        failed.append(pdf_file.name)

print("=" * 80)
print(f"Success: {success}/{len(pdf_files)}")
if failed:
    print(f"Failed: {', '.join(failed)}")
