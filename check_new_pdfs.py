import pdfplumber

pdf_files = [
    'articles/RR-26-03.pdf',
    'articles/s40468-020-00111-4.pdf',
    'articles/MchiOana-Miruna_TheAcquisitionofEnglishPhonologybyRomanianandFrenchLearnersofEnglish.pdf'
]

for pdf_path in pdf_files:
    print(f"\n{'='*80}")
    print(f"FILE: {pdf_path.split('/')[-1]}")
    print(f"{'='*80}")
    
    try:
        with pdfplumber.open(pdf_path) as doc:
            print(f"📄 Total pages: {len(doc.pages)}")
            
            # Extract first 3 pages
            for i in range(min(3, len(doc.pages))):
                text = doc.pages[i].extract_text()
                if text:
                    print(f"\n--- PAGE {i+1} ---")
                    print(text[:800])
                    print("...")
    except Exception as e:
        print(f"❌ Error: {e}")

print("\n" + "="*80)
print("✅ Analysis complete")
