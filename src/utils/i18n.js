const translations = {
  en: {
    loading: 'Loading humanoid...',
    ready: 'Ready',
    particles: 'Particles',
    fps: 'FPS',
    mood: 'Mood',
    audio: 'Audio',
    controls: 'Controls',
    pressS: 'Press S for screenshot',
    pressSpace: 'Press SPACE to reset',
    swipeMood: 'Swipe to change mood',
    neutral: 'Neutral',
    happy: 'Happy',
    sad: 'Sad',
    angry: 'Angry',
    excited: 'Excited',
    calm: 'Calm'
  },
  id: {
    loading: 'Memuat humanoid...',
    ready: 'Siap',
    particles: 'Partikel',
    fps: 'FPS',
    mood: 'Mood',
    audio: 'Audio',
    controls: 'Kontrol',
    pressS: 'Tekan S untuk screenshot',
    pressSpace: 'Tekan SPACE untuk reset',
    swipeMood: 'Geser untuk ganti mood',
    neutral: 'Netral',
    happy: 'Senang',
    sad: 'Sedih',
    angry: 'Marah',
    excited: 'Bersemangat',
    calm: 'Tenang'
  },
  zh: {
    loading: '加载中...',
    ready: '就绪',
    particles: '粒子',
    fps: '帧率',
    mood: '情绪',
    audio: '音频',
    controls: '控制',
    pressS: '按S键截图',
    pressSpace: '按空格键重置',
    swipeMood: '滑动切换情绪',
    neutral: '中性',
    happy: '快乐',
    sad: '悲伤',
    angry: '愤怒',
    excited: '兴奋',
    calm: '平静'
  }
};

let currentLang = 'en';

export function setLanguage(lang) {
  if (translations[lang]) {
    currentLang = lang;
  }
}

export function getLanguage() {
  return currentLang;
}

export function t(key) {
  return translations[currentLang]?.[key] || translations['en']?.[key] || key;
}

export function getAvailableLanguages() {
  return Object.keys(translations);
}
