import pdfplumber
import os
import warnings

warnings.filterwarnings("ignore")

pdf_files = [
    "articles/1-s2.0-S0346251X21001172-main.pdf",
    "articles/Ha2022.pdf",
    "articles/AsiaTEFL_V17_N3_Autumn_2020_Genre_based_Analysis_of_Syntactic_Complexity_in_L2_College_Students_Writing_Pedagogic_Scope_and_Directions.pdf"
]

success = []
failed = []

for pdf_file in pdf_files:
    if not os.path.exists(pdf_file):
        print(f"❌ Not found: {pdf_file}")
        failed.append(pdf_file)
        continue
    
    # Create output filename
    base_name = os.path.basename(pdf_file).replace('.pdf', '.txt')
    output_file = f"articles_text/{base_name}"
    
    try:
        with pdfplumber.open(pdf_file) as pdf:
            text = ""
            for i, page in enumerate(pdf.pages[:10], 1):  # First 10 pages
                page_text = page.extract_text()
                if page_text:
                    text += f"\n--- PAGE {i} ---\n{page_text}"
            
            with open(output_file, 'w', encoding='utf-8') as f:
                f.write(text)
            
            print(f"✓ {base_name}")
            success.append(base_name)
    except Exception as e:
        print(f"✗ {pdf_file}: {str(e)[:50]}")
        failed.append(pdf_file)

print(f"\nSuccess: {len(success)}/{len(pdf_files)}")
for s in success:
    print(f"  ✓ {s}")
