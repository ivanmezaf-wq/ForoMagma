// Gestor de persistencia con IndexedDB y fallback local para ForoMagma

const DB_NAME = 'ForoMagmaDB';
const DB_VERSION = 1;
const STORE_POSTS = 'posts';
const STORE_CONFIG = 'config';

const StorageManager = {
  db: null,

  // Inicializa IndexedDB
  async init() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        console.warn('IndexedDB no soportado, usando memoria y localStorage');
        resolve(null);
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_POSTS)) {
          const postStore = db.createObjectStore(STORE_POSTS, { keyPath: 'id' });
          postStore.createIndex('createdAt', 'createdAt', { unique: false });
          postStore.createIndex('category', 'category', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_CONFIG)) {
          db.createObjectStore(STORE_CONFIG, { keyPath: 'key' });
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve(this.db);
      };

      request.onerror = (event) => {
        console.error('Error al abrir IndexedDB:', event.target.error);
        resolve(null);
      };
    });
  },

  // Obtener todas las publicaciones ordenadas por fecha (más reciente primero)
  async getPosts() {
    if (!this.db) {
      const raw = localStorage.getItem('foromagma_posts');
      return raw ? JSON.parse(raw) : this.getSeedData();
    }

    return new Promise((resolve) => {
      const transaction = this.db.transaction([STORE_POSTS], 'readonly');
      const store = transaction.objectStore(STORE_POSTS);
      const request = store.getAll();

      request.onsuccess = () => {
        let posts = request.result || [];
        if (posts.length === 0) {
          // Inicializar datos semilla para que el foro nunca esté vacío
          const seed = this.getSeedData();
          this.savePostsBulk(seed);
          posts = seed;
        }
        // Ordenar por fecha descendente (lo más nuevo arriba)
        posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        resolve(posts);
      };

      request.onerror = () => {
        resolve(this.getSeedData());
      };
    });
  },

  // Guardar o actualizar una publicación
  async savePost(post) {
    if (!this.db) {
      const posts = await this.getPosts();
      const idx = posts.findIndex(p => p.id === post.id);
      if (idx >= 0) posts[idx] = post;
      else posts.unshift(post);
      localStorage.setItem('foromagma_posts', JSON.stringify(posts));
      return post;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_POSTS], 'readwrite');
      const store = transaction.objectStore(STORE_POSTS);
      const request = store.put(post);

      request.onsuccess = () => resolve(post);
      request.onerror = (e) => reject(e.target.error);
    });
  },

  // Guardar múltiples posts (útil para semilla o importar backup)
  async savePostsBulk(posts) {
    if (!this.db) {
      localStorage.setItem('foromagma_posts', JSON.stringify(posts));
      return;
    }

    const transaction = this.db.transaction([STORE_POSTS], 'readwrite');
    const store = transaction.objectStore(STORE_POSTS);
    for (const post of posts) {
      store.put(post);
    }
  },

  // Agregar un comentario a un post específico
  async addComment(postId, comment) {
    const posts = await this.getPosts();
    const post = posts.find(p => p.id === postId);
    if (!post) throw new Error('Publicación no encontrada');

    if (!post.comments) post.comments = [];
    post.comments.push(comment);

    await this.savePost(post);
    return post;
  },

  // Incrementar reacción ("Me gusta" / "Interesante")
  async toggleLike(postId, userId) {
    const posts = await this.getPosts();
    const post = posts.find(p => p.id === postId);
    if (!post) return null;

    if (!post.likes) post.likes = [];
    const index = post.likes.indexOf(userId);
    if (index === -1) {
      post.likes.push(userId);
    } else {
      post.likes.splice(index, 1);
    }

    await this.savePost(post);
    return post;
  },

  // Procesa y lee un archivo (PDF, Word, Excel, PPT, imagen) para almacenamiento
  readFileAttachment(file) {
    return new Promise((resolve, reject) => {
      // Validar tipos permitidos
      const allowedExtensions = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv', 'png', 'jpg', 'jpeg', 'zip'];
      const extension = file.name.split('.').pop().toLowerCase();

      if (!allowedExtensions.includes(extension)) {
        return reject(new Error(`Tipo de archivo .${extension} no permitido. Sube PDF, Word, Excel o imágenes.`));
      }

      // Tamaño máximo recomendado para la versión web local (15 MB por archivo)
      const maxSizeMB = 15;
      if (file.size > maxSizeMB * 1024 * 1024) {
        return reject(new Error(`El archivo supera el límite de ${maxSizeMB} MB.`));
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        resolve({
          id: 'file_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
          name: file.name,
          size: file.size,
          type: file.type || 'application/octet-stream',
          extension: extension,
          data: e.target.result // Base64 Data URL para descarga inmediata
        });
      };
      reader.onerror = () => reject(new Error('Error al leer el archivo'));
      reader.readAsDataURL(file);
    });
  },

  // Obtiene los datos del usuario actual recordados en la sesión
  getCurrentUser() {
    const data = localStorage.getItem('foromagma_user');
    if (data) {
      try {
        return JSON.parse(data);
      } catch (e) {
        return null;
      }
    }
    return null;
  },

  // Guarda los datos del usuario actual (Nombre, Apellido, Avatar)
  saveCurrentUser(user) {
    localStorage.setItem('foromagma_user', JSON.stringify(user));
  },

  // Exportar todos los datos a JSON (backup completo)
  async exportDataJSON() {
    const posts = await this.getPosts();
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(posts, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `foromagma_backup_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  },

  // Importar datos desde JSON
  async importDataJSON(jsonString) {
    try {
      const posts = JSON.parse(jsonString);
      if (Array.isArray(posts)) {
        await this.savePostsBulk(posts);
        return true;
      }
      return false;
    } catch (e) {
      console.error(e);
      return false;
    }
  },

  // Datos semilla iniciales enfocados en Electrónica y Tesis
  getSeedData() {
    return [
      {
        id: 'post_seed_1',
        title: 'Avance Tesis: Selección del Microcontrolador para Adquisición de Señales (STM32F4 vs ESP32-S3)',
        author: {
          fullName: 'Iván Meza',
          avatarUrl: AvatarManager.generateSvgAvatar('Iván Meza', 'tech')
        },
        category: 'Sistemas Embebidos',
        content: `Hola a todos. Comparto el resumen de la comparativa técnica que estuvimos analizando para la etapa de procesamiento embebido de la tesis.\n\n` +
          `Puntos evaluados:\n` +
          `1. **Frecuencia y ADC:** El STM32F401 opera hasta 84 MHz con un ADC de 12 bits a 2.4 MSPS de alta fidelidad, mientras que el ESP32-S3 ofrece 240 MHz y conectividad WiFi/Bluetooth BLE integrada, pero su ADC presenta mayor no linealidad.\n` +
          `2. **Consumo de potencia:** Para mediciones de sensores analógicos piezoeléctricos, el ruido introducido por el transceptor del ESP32 requiere blindaje y planos de tierra separados (AGND y DGND).\n\n` +
          `Dejo adjunto el reporte de análisis comparativo y la tabla de consumo para que dejen sus observaciones.`,
        attachments: [
          {
            id: 'att_sample_1',
            name: 'Reporte_Comparativo_STM32_vs_ESP32.docx',
            extension: 'docx',
            size: 420000,
            data: '#' // Marcador
          },
          {
            id: 'att_sample_2',
            name: 'Esquematico_Etapa_Entrada_ADC.pdf',
            extension: 'pdf',
            size: 850000,
            data: '#'
          }
        ],
        likes: ['user_sample_1', 'user_sample_2'],
        comments: [
          {
            id: 'comm_1',
            author: {
              fullName: 'Carlos Ramos',
              avatarUrl: AvatarManager.generateSvgAvatar('Carlos Ramos', 'tech')
            },
            content: 'Excelente análisis Iván. Coincido con usar el STM32 para la adquisición directa si la precisión del ADC es crítica. Podríamos usar el ESP32 únicamente como pasarela de telemetría UART/WiFi.',
            createdAt: new Date(Date.now() - 3600000 * 4).toISOString(),
            attachments: []
          }
        ],
        createdAt: new Date(Date.now() - 3600000 * 24).toISOString()
      },
      {
        id: 'post_seed_2',
        title: 'Diseño de la Etapa de Potencia y Filtrado de Ruido EMI en PCB',
        author: {
          fullName: 'Carlos Ramos',
          avatarUrl: AvatarManager.generateSvgAvatar('Carlos Ramos', 'tech')
        },
        category: 'Circuitos y PCB',
        content: `Compañeros, ya terminé el primer ruteo del regulador conmutado reductor (Buck 12V a 3.3V). Para reducir la interferencia electromagnética (EMI):\n\n` +
          `• Mantuvimos el lazo de corriente de conmutación lo más estrecho posible.\n` +
          `• Colocamos condensadores cerámicos X7R de desacoplo de 100nF pegados a los pines VDD de los circuitos integrados.\n` +
          `• El inductor apantallado se ubicó alejado de las pistas analógicas sensibles.\n\n` +
          `Adjunto la hoja de especificaciones del regulador y la guía de diseño en PDF. ¡Espero sus comentarios sobre el grosor de las pistas para 2A!`,
        attachments: [
          {
            id: 'att_sample_3',
            name: 'Guia_Diseno_PCB_Potencia.pdf',
            extension: 'pdf',
            size: 1200000,
            data: '#'
          }
        ],
        likes: ['user_sample_3'],
        comments: [
          {
            id: 'comm_2',
            author: {
              fullName: 'Iván Meza',
              avatarUrl: AvatarManager.generateSvgAvatar('Iván Meza', 'tech')
            },
            content: 'Revisé el cálculo de corriente para 2A. Con cobre de 1 oz, una pista de 1.8mm en capa externa tendrá una elevación de temperatura menor a 10°C, lo cual es muy seguro.',
            createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
            attachments: []
          }
        ],
        createdAt: new Date(Date.now() - 3600000 * 12).toISOString()
      }
    ];
  }
};
