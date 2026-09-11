import type { Locale } from '@guide/contracts';
export type VoiceCommand = 'repeat' | 'slower' | 'stop-sharing' | 'approve-image' | 'end' | 'stop';
const phrases: Record<VoiceCommand, string[]> = {
  stop: ['stop','stop speaking','रुको','रुकिए','बोलना बंद करो','থামুন','থামো','थांबा','ఆపు','ఆపండి'],
  repeat: ['repeat','say that again','दोहराएँ','दोहराएं','फिर से बताएं','दुबारा बताओ','আবার বলুন','পুনরায় বলুন','पुन्हा सांगा','మళ్లీ చెప్పండి','மீண்டும் சொல்','دوبارہ کہیں'],
  slower: ['speak slower','धीरे बोलें','धीरे बोलो','ধীরে বলুন','हळू बोला','నెమ్మదిగా మాట్లాడండి','மெதுவாகப் பேசு','آہستہ بولیں'],
  'stop-sharing': ['stop sharing','stop screen sharing','स्क्रीन साझा करना बंद करें','स्क्रीन शेयर बंद करो','স্ক্রিন শেয়ার বন্ধ করুন','स्क्रीन शेअर करणे बंद करा','స్క్రీన్ షేరింగ్ ఆపండి','திரைப் பகிர்வை நிறுத்து','اسکرین شیئر بند کریں'],
  'approve-image': ['approve this image','इस तस्वीर को मंज़ूरी दें','इस तस्वीर को मंजूरी दें','এই ছবি অনুমোদন করুন','या चित्राला मंजुरी द्या','ఈ చిత్రాన్ని ఆమోదించండి','இந்தப் படத்தை ஒப்புதல் செய்','اس تصویر کو منظور کریں'],
  end: ['end assistance','end assistant','सहायता समाप्त करें','सहायता बंद करो','সহায়তা শেষ করুন','मदत समाप्त करा','సహాయం ముగించండి','உதவியை முடி','مدد ختم کریں']
};
export function voiceCommand(text: string, _locale: Locale): VoiceCommand | undefined {
  const clean = (value: string) => value.normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{M}\p{N}\s]/gu, '').replace(/\s+/g, ' ').trim();
  const normalized = clean(text);
  return (Object.keys(phrases) as VoiceCommand[]).find(command => phrases[command].some(phrase => clean(phrase) === normalized));
}
