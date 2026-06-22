import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';
import { useState } from 'react';

async function exportWebPDF(filename: string) {
  const html2canvas = (await import('html2canvas')).default;

  // Scroll to top before capture
  window.scrollTo(0, 0);

  // Find the scrollable content div (React Native web renders ScrollView as
  // a div with overflow:scroll; its first child has the full content height)
  const outer = document.querySelector('[data-pdf-content]') as HTMLElement;
  const target = outer
    ? (outer.children[0] as HTMLElement) || outer
    : document.body;

  const fullH = Math.max(
    target.scrollHeight,
    target.offsetHeight,
    document.body.scrollHeight,
  );

  const canvas = await html2canvas(target, {
    scale: 1.5,
    useCORS: true,
    allowTaint: true,
    backgroundColor: '#0a0f1a',
    logging: false,
    height: fullH,
    windowHeight: fullH,
    y: 0,
    scrollY: 0,
  });

  const imgSrc = canvas.toDataURL('image/png', 0.95);

  if (!imgSrc || imgSrc === 'data:,') {
    // Fallback: save PNG directly
    const a = document.createElement('a');
    a.download = `${filename}.png`;
    a.href = canvas.toDataURL('image/png');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return;
  }

  // Open in new tab → auto print (Save as PDF)
  const win = window.open('', '_blank');
  if (!win) {
    // Popup blocked — download PNG instead
    const a = document.createElement('a');
    a.download = `${filename}.png`;
    a.href = imgSrc;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return;
  }

  win.document.write(`<!DOCTYPE html>
<html>
  <head>
    <title>${filename}</title>
    <style>
      @page { margin: 0; }
      body  { margin: 0; padding: 0; background: #fff; }
      img   { width: 100%; height: auto; display: block; }
    </style>
  </head>
  <body>
    <img src="${imgSrc}" />
    <script>
      document.querySelector('img').onload = function() {
        setTimeout(function() { window.print(); }, 400);
      };
    </script>
  </body>
</html>`);
  win.document.close();
}

interface Props { filename?: string; light?: boolean; }

export default function DownloadPDFButton({ filename = 'vocaflow', light }: Props) {
  const [loading, setLoading] = useState(false);

  const handlePress = async () => {
    if (loading) return;
    setLoading(true);
    try { await exportWebPDF(filename); }
    catch (e) { console.warn('[PDF web]', e); }
    finally { setLoading(false); }
  };

  const tint   = light ? '#fff' : Colors.light.tint;
  const bg     = light ? 'rgba(255,255,255,0.15)' : Colors.light.tint + '18';
  const border = light ? 'rgba(255,255,255,0.3)'  : Colors.light.tint + '40';

  return (
    <TouchableOpacity
      onPress={handlePress}
      style={[styles.btn, { backgroundColor: bg, borderColor: border, opacity: loading ? 0.6 : 1 }]}
      activeOpacity={0.7}
    >
      <Feather name={loading ? 'loader' : 'download'} size={13} color={tint} />
      <Text style={[styles.label, { color: tint }]}>{loading ? '...' : 'PDF'}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 8, borderWidth: 1,
  },
  label: { fontSize: 12, fontWeight: '600', letterSpacing: 0.3 },
});
