// Generador y gestor de avatares para ForoMagma

const AvatarManager = {
  // Paletas de azul y acentos tecnológicos
  colorPairs: [
    ['#1e40af', '#3b82f6'],
    ['#0369a1', '#0ea5e9'],
    ['#1d4ed8', '#60a5fa'],
    ['#0f766e', '#14b8a6'],
    ['#4338ca', '#818cf8'],
    ['#1e3a8a', '#2563eb'],
    ['#0c4a6e', '#0284c7']
  ],

  // Iconos temáticos de Electrónica en SVG
  circuitIcons: [
    // Microchip / IC
    `<path d="M4 4h16v16H4V4zm4 4h8v8H8V8zM1 7h3v2H1V7zm0 8h3v2H1v-2zm19-8h3v2h-3V7zm0 8h3v2h-3v-2zM7 1h2v3H7V1zm8 0h2v3h-2V1zM7 20h2v3H7v-3zm8 0h2v3h-2v-3z" fill="currentColor"/>`,
    // Resistor / Onda
    `<path d="M2 12h3l2.5-6 4 12 4-12 3 8 2.5-2H22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
    // Diodo / Transistor
    `<path d="M3 12h7m4 0h7M10 6v12l8-6-8-6zm8 0v12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
    // Capacitor / Batería
    `<path d="M2 12h8m4 0h8M10 5v14M14 8v8" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>`,
    // Rayo / Energía
    `<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="currentColor"/>`
  ],

  // Extrae iniciales de "Nombre Apellido"
  getInitials(fullName) {
    if (!fullName || typeof fullName !== 'string') return 'FM';
    const parts = fullName.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 1) {
      return parts[0].substring(0, 2).toUpperCase();
    }
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  },

  // Genera hash numérico determinista según el nombre
  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  },

  // Genera un avatar SVG automático único para el usuario
  generateSvgAvatar(name, type = 'tech') {
    const safeName = name && name.trim() ? name.trim() : 'Usuario ForoMagma';
    const initials = this.getInitials(safeName);
    const hash = this.hashString(safeName);
    const colors = this.colorPairs[hash % this.colorPairs.length];
    const icon = this.circuitIcons[hash % this.circuitIcons.length];

    if (type === 'tech') {
      return `data:image/svg+xml;utf8,${encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
          <defs>
            <linearGradient id="grad_${hash}" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="${colors[0]}" />
              <stop offset="100%" stop-color="${colors[1]}" />
            </linearGradient>
            <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
              <path d="M 10 0 L 0 0 0 10" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="0.8"/>
            </pattern>
          </defs>
          <rect width="100" height="100" rx="28" fill="url(#grad_${hash})" />
          <rect width="100" height="100" rx="28" fill="url(#grid)" />
          <!-- Circuito de fondo -->
          <circle cx="20" cy="20" r="3" fill="rgba(255,255,255,0.4)"/>
          <line x1="20" y1="20" x2="35" y2="20" stroke="rgba(255,255,255,0.4)" stroke-width="1.5"/>
          <circle cx="80" cy="80" r="3" fill="rgba(255,255,255,0.4)"/>
          <line x1="80" y1="80" x2="65" y2="80" stroke="rgba(255,255,255,0.4)" stroke-width="1.5"/>
          <!-- Iniciales y emblema -->
          <text x="50" y="58" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="700" font-size="34" fill="#ffffff" text-anchor="middle" dominant-baseline="middle" letter-spacing="1">
            ${initials}
          </text>
        </svg>
      `)}`;
    }

    // Estilo Monograma simple
    return `data:image/svg+xml;utf8,${encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
        <defs>
          <linearGradient id="grad_simple_${hash}" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="${colors[0]}" />
            <stop offset="100%" stop-color="${colors[1]}" />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="48" fill="url(#grad_simple_${hash})" />
        <text x="50" y="56" font-family="sans-serif" font-weight="700" font-size="36" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">
          ${initials}
        </text>
      </svg>
    `)}`;
  },

  // Procesa una imagen subida por el usuario (la comprime y convierte a Base64)
  readImageFile(file) {
    return new Promise((resolve, reject) => {
      if (!file || !file.type.startsWith('image/')) {
        return reject(new Error('El archivo no es una imagen válida'));
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          // Redimensionar para optimizar almacenamiento en avatar (180x180 px max)
          const canvas = document.createElement('canvas');
          const size = 180;
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext('2d');

          // Dibujar centrado y recortado cuadrado
          const minDim = Math.min(img.width, img.height);
          const sx = (img.width - minDim) / 2;
          const sy = (img.height - minDim) / 2;
          ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);

          resolve(canvas.toDataURL('image/jpeg', 0.85));
        };
        img.onerror = () => reject(new Error('Error al cargar la imagen'));
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error('Error al leer el archivo'));
      reader.readAsDataURL(file);
    });
  }
};
