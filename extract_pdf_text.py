#!/usr/bin/env python3
"""
PDF Text Extractor - Extract text from all PDFs in articles folder
Saves individual .txt files for each PDF
"""

import pdfplumber
import os
from pathlib import Path

# Paths
ARTICLES_DIR = Path("articles")
OUTPUT_DIR = Path("articles_text")

# Create output directory
OUTPUT_DIR.mkdir(exist_ok=True)

# Get all PDF files
pdf_files = sorted(ARTICLES_DIR.glob("*.pdf"))

print(f"Found {len(pdf_files)} PDF files")
print("=" * 80)

# Extract text from each PDF
for pdf_file in pdf_files:
    output_file = OUTPUT_DIR / f"{pdf_file.stem}.txt"
    
    try:
        with pdfplumber.open(pdf_file) as pdf:
            full_text = ""
            table_count = 0
            
            # Extract text from all pages
            for page_num, page in enumerate(pdf.pages, 1):
                # Extract regular text
                text = page.extract_text()
                if text:
                    full_text += f"\n\n--- PAGE {page_num} ---\n{text}"
                
                # Try to extract tables
                tables = page.extract_tables()
                if tables:
                    for table in tables:
                        full_text += f"\n\n[TABLE on PAGE {page_num}]\n"
                        for row in table:
                            full_text += " | ".join(str(cell) if cell else "" for cell in row) + "\n"
                        table_count += 1
            
            # Save to file
            with open(output_file, "w", encoding="utf-8") as f:
                f.write(full_text)
            
            print(f"✓ {pdf_file.name}")
            print(f"  → Pages: {len(pdf.pages)}, Tables: {table_count}")
            print(f"  → Saved to: {output_file}")
    
    except Exception as e:
        print(f"✗ {pdf_file.name} - ERROR: {e}")

print("=" * 80)
print(f"Extraction complete! Check {OUTPUT_DIR}/ folder")
