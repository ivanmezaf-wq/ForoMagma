// Gestor de persistencia con IndexedDB y localStorage para ForoMagma

const DB_NAME = 'ForoMagmaDB';
const DB_VERSION = 3;
const STORE_POSTS = 'posts';

const StorageManager = {
  db: null,

  async init() {
    return new Promise((resolve) => {
      if (!window.indexedDB) {
        console.warn('IndexedDB no disponible, usando localStorage');
        resolve(null);
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_POSTS)) {
          const postStore = db.createObjectStore(STORE_POSTS, { keyPath: 'id' });
          postStore.createIndex('createdAt', 'createdAt', { unique: false });
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

  // Normaliza el autor para evitar errores si viene como string u objeto
  normalizeAuthor(rawAuthor) {
    if (!rawAuthor) return 'Autor';
    if (typeof rawAuthor === 'string') return rawAuthor.trim() || 'Autor';
    if (typeof rawAuthor === 'object') {
      if (rawAuthor.fullName && typeof rawAuthor.fullName === 'string') return rawAuthor.fullName.trim();
      if (rawAuthor.name && typeof rawAuthor.name === 'string') return rawAuthor.name.trim();
    }
    return String(rawAuthor).trim() || 'Autor';
  },

  // Obtener publicaciones ordenadas por fecha
  async getPosts() {
    if (!this.db) {
      const raw = localStorage.getItem('foromagma_posts_v3');
      const posts = raw ? JSON.parse(raw) : [];
      return posts.map(p => ({ ...p, author: this.normalizeAuthor(p.author) }));
    }

    return new Promise((resolve) => {
      const transaction = this.db.transaction([STORE_POSTS], 'readonly');
      const store = transaction.objectStore(STORE_POSTS);
      const request = store.getAll();

      request.onsuccess = () => {
        let posts = request.result || [];
        posts = posts.map(p => ({
          ...p,
          author: this.normalizeAuthor(p.author)
        }));
        posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        resolve(posts);
      };

      request.onerror = () => {
        resolve([]);
      };
    });
  },

  // Guardar publicación
  async savePost(post) {
    const cleanPost = {
      ...post,
      author: this.normalizeAuthor(post.author)
    };

    if (!this.db) {
      const posts = await this.getPosts();
      const idx = posts.findIndex(p => p.id === cleanPost.id);
      if (idx >= 0) posts[idx] = cleanPost;
      else posts.unshift(cleanPost);
      localStorage.setItem('foromagma_posts_v3', JSON.stringify(posts));
      return cleanPost;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_POSTS], 'readwrite');
      const store = transaction.objectStore(STORE_POSTS);
      const request = store.put(cleanPost);

      request.onsuccess = () => resolve(cleanPost);
      request.onerror = (e) => reject(e.target.error);
    });
  },

  // Eliminar publicación
  async deletePost(postId) {
    if (!this.db) {
      let posts = await this.getPosts();
      posts = posts.filter(p => p.id !== postId);
      localStorage.setItem('foromagma_posts_v3', JSON.stringify(posts));
      return true;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_POSTS], 'readwrite');
      const store = transaction.objectStore(STORE_POSTS);
      const request = store.delete(postId);

      request.onsuccess = () => resolve(true);
      request.onerror = (e) => reject(e.target.error);
    });
  },

  // Agregar comentario a un post
  async addComment(postId, comment) {
    const posts = await this.getPosts();
    const post = posts.find(p => p.id === postId);
    if (!post) throw new Error('Publicación no encontrada');

    if (!post.comments) post.comments = [];
    post.comments.push({
      ...comment,
      author: this.normalizeAuthor(comment.author)
    });

    await this.savePost(post);
    return post;
  },

  // Alternar reacción "Visto" 👁️
  async toggleVisto(postId, viewerIdentifier) {
    const posts = await this.getPosts();
    const post = posts.find(p => p.id === postId);
    if (!post) return null;

    if (!post.vistos) post.vistos = [];
    const index = post.vistos.indexOf(viewerIdentifier);
    if (index === -1) {
      post.vistos.push(viewerIdentifier);
    } else {
      post.vistos.splice(index, 1);
    }

    await this.savePost(post);
    return post;
  },

  // Lectura de archivos adjuntos (Word, PDF, Excel, etc.)
  readFileAttachment(file) {
    return new Promise((resolve, reject) => {
      const allowedExtensions = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv', 'png', 'jpg', 'jpeg', 'zip'];
      const extension = file.name.split('.').pop().toLowerCase();

      if (!allowedExtensions.includes(extension)) {
        return reject(new Error(`Tipo .${extension} no permitido. Sube PDF, Word, Excel o imágenes.`));
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        resolve({
          id: 'file_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
          name: file.name,
          size: file.size,
          extension: extension,
          data: e.target.result
        });
      };
      reader.onerror = () => reject(new Error('Error al leer el archivo'));
      reader.readAsDataURL(file);
    });
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
