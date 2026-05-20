import pdfplumber

pdf_files = [
    ('articles/RR-26-03.pdf', 'articles_text/RR-26-03.txt'),
    ('articles/s40468-020-00111-4.pdf', 'articles_text/s40468-020-00111-4.txt'),
    ('articles/MchiOana-Miruna_TheAcquisitionofEnglishPhonologybyRomanianandFrenchLearnersofEnglish.pdf', 'articles_text/MchiOana-Miruna.txt')
]

for pdf_path, output_path in pdf_files:
    print(f"Extracting: {pdf_path.split('/')[-1]}...")
    
    try:
        with pdfplumber.open(pdf_path) as doc:
            full_text = ""
            for i, page in enumerate(doc.pages):
                text = page.extract_text()
                if text:
                    full_text += f"\n--- PAGE {i+1} ---\n{text}"
            
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(full_text)
            
            print(f"✅ Saved to {output_path} ({len(doc.pages)} pages)")
    except Exception as e:
        print(f"❌ Error: {e}")

print("\n✅ All PDFs extracted!")
