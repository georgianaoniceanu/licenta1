import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';
import { useState } from 'react';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { captureScreen } from 'react-native-view-shot';

async function exportMobilePDF(filename: string) {
  const uri = await captureScreen({ format: 'png', quality: 1 });
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
    <style>body{margin:0;padding:0;}img{width:100%;display:block;}</style>
    </head><body><img src="${uri}"/></body></html>`;
  const { uri: pdfUri } = await Print.printToFileAsync({ html });
  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(pdfUri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
  }
}

interface Props { filename?: string; light?: boolean; }

export default function DownloadPDFButton({ filename = 'vocaflow', light }: Props) {
  const [loading, setLoading] = useState(false);

  const handlePress = async () => {
    if (loading) return;
    setLoading(true);
    try { await exportMobilePDF(filename); }
    catch (e) { console.warn('[PDF mobile]', e); }
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
