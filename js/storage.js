// Gestor de persistencia con Firebase Cloud Firestore y Fallback Local para ForoMagma + Kanban

const DB_COLLECTION = 'posts';
const KANBAN_COLLECTION = 'kanban_tasks';

const StorageManager = {
  db: null,
  isFirebaseActive: false,
  onPostsUpdateCallback: null,
  onKanbanUpdateCallback: null,

  async init(onPostsUpdate, onKanbanUpdate) {
    this.onPostsUpdateCallback = onPostsUpdate;
    this.onKanbanUpdateCallback = onKanbanUpdate;

    if (typeof firestoreDb !== 'undefined' && firestoreDb) {
      this.isFirebaseActive = true;
      console.log('⚡ Conexión Firestore activa (Posts + Kanban)');

      // 1. Escuchar Publicaciones del Foro en tiempo real
      firestoreDb.collection(DB_COLLECTION)
        .orderBy('createdAt', 'desc')
        .onSnapshot((snapshot) => {
          const posts = [];
          snapshot.forEach((doc) => {
            const data = doc.data();
            posts.push({
              ...data,
              id: doc.id,
              author: this.normalizeAuthor(data.author)
            });
          });
          if (this.onPostsUpdateCallback) this.onPostsUpdateCallback(posts);
        }, (err) => console.warn('Error en snapshot posts:', err));

      // 2. Escuchar Tareas del Tablero Kanban en tiempo real
      firestoreDb.collection(KANBAN_COLLECTION)
        .onSnapshot((snapshot) => {
          const cards = {};
          snapshot.forEach((doc) => {
            cards[doc.id] = { ...doc.data(), id: doc.id };
          });
          if (this.onKanbanUpdateCallback) this.onKanbanUpdateCallback(cards);
        }, (err) => console.warn('Error en snapshot kanban:', err));

      return;
    }

    // Fallback local
    this.fallbackLocalInit();
  },

  async fallbackLocalInit() {
    const posts = await this.getLocalPosts();
    if (this.onPostsUpdateCallback) this.onPostsUpdateCallback(posts);

    const cards = await this.getLocalKanban();
    if (this.onKanbanUpdateCallback) this.onKanbanUpdateCallback(cards);
  },

  normalizeAuthor(rawAuthor) {
    if (!rawAuthor) return 'Autor';
    if (typeof rawAuthor === 'string') return rawAuthor.trim() || 'Autor';
    if (typeof rawAuthor === 'object') {
      if (rawAuthor.fullName && typeof rawAuthor.fullName === 'string') return rawAuthor.fullName.trim();
      if (rawAuthor.name && typeof rawAuthor.name === 'string') return rawAuthor.name.trim();
    }
    return String(rawAuthor).trim() || 'Autor';
  },

  // ==========================================================
  // OPERACIONES DE POSTS (FORO)
  // ==========================================================
  async getPosts() {
    if (this.isFirebaseActive && firestoreDb) {
      try {
        const snapshot = await firestoreDb.collection(DB_COLLECTION).orderBy('createdAt', 'desc').get();
        const posts = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          posts.push({ ...data, id: doc.id, author: this.normalizeAuthor(data.author) });
        });
        return posts;
      } catch (e) {
        console.warn(e);
      }
    }
    return this.getLocalPosts();
  },

  async savePost(post) {
    const cleanPost = {
      ...post,
      author: this.normalizeAuthor(post.author),
      comments: post.comments || [],
      vistos: post.vistos || [],
      attachments: post.attachments || [],
      createdAt: post.createdAt || new Date().toISOString()
    };

    if (cleanPost.attachments && cleanPost.attachments.length > 0) {
      for (const att of cleanPost.attachments) {
        if (att.rawFile && typeof firestoreStorage !== 'undefined' && firestoreStorage) {
          try {
            const fileRef = firestoreStorage.ref(`archivos_tesis/${cleanPost.id}_${att.name}`);
            await fileRef.put(att.rawFile);
            const downloadUrl = await fileRef.getDownloadURL();
            att.data = downloadUrl;
            delete att.rawFile;
          } catch (storageErr) {
            delete att.rawFile;
          }
        } else {
          delete att.rawFile;
        }
      }
    }

    if (this.isFirebaseActive && firestoreDb) {
      await firestoreDb.collection(DB_COLLECTION).doc(cleanPost.id).set(cleanPost);
      return cleanPost;
    }

    const local = await this.getLocalPosts();
    const idx = local.findIndex(p => p.id === cleanPost.id);
    if (idx >= 0) local[idx] = cleanPost;
    else local.unshift(cleanPost);
    localStorage.setItem('foromagma_cloud_cache', JSON.stringify(local));
    return cleanPost;
  },

  async deletePost(postId) {
    if (this.isFirebaseActive && firestoreDb) {
      await firestoreDb.collection(DB_COLLECTION).doc(postId).delete();
      return true;
    }
    let local = await this.getLocalPosts();
    local = local.filter(p => p.id !== postId);
    localStorage.setItem('foromagma_cloud_cache', JSON.stringify(local));
    return true;
  },

  async addComment(postId, comment) {
    const cleanComment = {
      ...comment,
      author: this.normalizeAuthor(comment.author),
      createdAt: comment.createdAt || new Date().toISOString()
    };

    if (this.isFirebaseActive && firestoreDb) {
      await firestoreDb.collection(DB_COLLECTION).doc(postId).update({
        comments: firebase.firestore.FieldValue.arrayUnion(cleanComment)
      });
      return cleanComment;
    }

    const posts = await this.getLocalPosts();
    const post = posts.find(p => p.id === postId);
    if (post) {
      if (!post.comments) post.comments = [];
      post.comments.push(cleanComment);
      localStorage.setItem('foromagma_cloud_cache', JSON.stringify(posts));
    }
    return cleanComment;
  },

  async toggleVisto(postId, viewerIdentifier) {
    if (this.isFirebaseActive && firestoreDb) {
      const docRef = firestoreDb.collection(DB_COLLECTION).doc(postId);
      const docSnap = await docRef.get();
      if (docSnap.exists) {
        const data = docSnap.data();
        const vistos = data.vistos || [];
        if (vistos.includes(viewerIdentifier)) {
          await docRef.update({ vistos: firebase.firestore.FieldValue.arrayRemove(viewerIdentifier) });
        } else {
          await docRef.update({ vistos: firebase.firestore.FieldValue.arrayUnion(viewerIdentifier) });
        }
      }
      return;
    }

    const posts = await this.getLocalPosts();
    const post = posts.find(p => p.id === postId);
    if (post) {
      if (!post.vistos) post.vistos = [];
      const idx = post.vistos.indexOf(viewerIdentifier);
      if (idx === -1) post.vistos.push(viewerIdentifier);
      else post.vistos.splice(idx, 1);
      localStorage.setItem('foromagma_cloud_cache', JSON.stringify(posts));
    }
  },

  // ==========================================================
  // OPERACIONES DEL TABLERO KANBAN (TAGANAZUL)
  // ==========================================================
  async saveKanbanCard(card) {
    if (this.isFirebaseActive && firestoreDb) {
      await firestoreDb.collection(KANBAN_COLLECTION).doc(card.id).set(card);
      return card;
    }
    const local = await this.getLocalKanban();
    local[card.id] = card;
    localStorage.setItem('foromagma_kanban_cache', JSON.stringify(local));
    return card;
  },

  async moveKanbanCard(cardId, newStatus) {
    if (this.isFirebaseActive && firestoreDb) {
      await firestoreDb.collection(KANBAN_COLLECTION).doc(cardId).update({ status: newStatus });
      return;
    }
    const local = await this.getLocalKanban();
    if (local[cardId]) {
      local[cardId].status = newStatus;
      localStorage.setItem('foromagma_kanban_cache', JSON.stringify(local));
    }
  },

  async deleteKanbanCard(cardId) {
    if (this.isFirebaseActive && firestoreDb) {
      await firestoreDb.collection(KANBAN_COLLECTION).doc(cardId).delete();
      return;
    }
    const local = await this.getLocalKanban();
    delete local[cardId];
    localStorage.setItem('foromagma_kanban_cache', JSON.stringify(local));
  },

  getLocalKanban() {
    const raw = localStorage.getItem('foromagma_kanban_cache');
    if (raw) {
      try { return JSON.parse(raw); } catch (e) { }
    }
    return this.getSeedKanbanCards();
  },

  // Tarjetas iniciales para el proyecto de tesis si está vacío
  getSeedKanbanCards() {
    return {
      'card_1': { id: 'card_1', pillar: 'emb', title: 'Selección de Microcontrolador y ADC', desc: 'Evaluar tiempos de muestreo y resolución para adquisición.', person: 'Iván', status: 'doing' },
      'card_2': { id: 'card_2', pillar: 'pcb', title: 'Diseño de Etapa de Alimentación Buck', desc: 'Ruteo de plano de masa y desacoplo de ruido de 12V a 3.3V.', person: 'Compañero', status: 'todo' },
      'card_3': { id: 'card_3', pillar: 'ctl', title: 'Simulación del algoritmo de control', desc: 'Modelado en MATLAB / Simulink antes de pruebas de hardware.', person: 'Equipo', status: 'todo' },
      'card_4': { id: 'card_4', pillar: 'doc', title: 'Capítulo 1: Marco Teórico y Antecedentes', desc: 'Revisión bibliográfica de publicaciones IEEE indexadas.', person: 'Iván', status: 'doing' }
    };
  },

  readFileAttachment(file) {
    return new Promise((resolve, reject) => {
      const allowedExtensions = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv', 'png', 'jpg', 'jpeg', 'zip'];
      const extension = file.name.split('.').pop().toLowerCase();

      if (!allowedExtensions.includes(extension)) {
        return reject(new Error(`Tipo .${extension} no permitido.`));
      }
      if (file.size > 20 * 1024 * 1024) {
        return reject(new Error('El archivo supera los 20MB permitidos.'));
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        resolve({
          id: 'file_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
          name: file.name,
          size: file.size,
          extension: extension,
          data: e.target.result,
          rawFile: file
        });
      };
      reader.onerror = () => reject(new Error('Error al leer el archivo'));
      reader.readAsDataURL(file);
    });
  },

  getLocalPosts() {
    const raw = localStorage.getItem('foromagma_cloud_cache') || localStorage.getItem('foromagma_posts_v3');
    return raw ? JSON.parse(raw) : [];
  },

  getLastAuthor() {
    return localStorage.getItem('foromagma_last_author') || '';
  },

  setLastAuthor(author) {
    if (author && typeof author === 'string') {
      localStorage.setItem('foromagma_last_author', author.trim());
    }
  },

  extractAllLinks(posts) {
    const linksList = [];
    const urlRegex = /(https?:\/\/[^\s]+)/g;

    posts.forEach(post => {
      const found = (post.content || '').match(urlRegex);
      if (found) {
        found.forEach(url => {
          const cleanUrl = url.replace(/[.,;:)\]]+$/, '');
          if (!linksList.some(l => l.url === cleanUrl)) {
            linksList.push({
              url: cleanUrl,
              postTitle: post.title,
              postId: post.id,
              author: this.normalizeAuthor(post.author),
              date: post.createdAt
            });
          }
        });
      }
    });

    return linksList;
  }
};
