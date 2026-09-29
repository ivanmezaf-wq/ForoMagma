// Gestor de persistencia con Firebase Cloud Firestore y Fallback Local para ForoMagma

const DB_COLLECTION = 'posts';

const StorageManager = {
  db: null,
  isFirebaseActive: false,
  onRealtimeCallback: null,

  async init(onUpdateCallback) {
    this.onRealtimeCallback = onUpdateCallback;

    // Verificar si Firebase está cargado y listo
    if (typeof firestoreDb !== 'undefined' && firestoreDb) {
      this.isFirebaseActive = true;
      console.log('⚡ Sincronización en la nube (Firestore) ACTIVADA');

      // Escuchar cambios en TIEMPO REAL desde cualquier dispositivo
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
          // Notificar a la interfaz en vivo
          if (this.onRealtimeCallback) {
            this.onRealtimeCallback(posts);
          }
        }, (error) => {
          console.warn('Aviso de conexión Firestore:', error);
          this.fallbackLocalInit();
        });

      return;
    }

    // Fallback local si no hay Firebase
    this.fallbackLocalInit();
  },

  async fallbackLocalInit() {
    console.log('Usando almacenamiento local de respaldo');
    const posts = await this.getLocalPosts();
    if (this.onRealtimeCallback) {
      this.onRealtimeCallback(posts);
    }
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

  // Obtener publicaciones actuales
  async getPosts() {
    if (this.isFirebaseActive && firestoreDb) {
      try {
        const snapshot = await firestoreDb.collection(DB_COLLECTION).orderBy('createdAt', 'desc').get();
        const posts = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          posts.push({
            ...data,
            id: doc.id,
            author: this.normalizeAuthor(data.author)
          });
        });
        return posts;
      } catch (e) {
        console.warn('Error al leer de Firestore, usando caché local:', e);
      }
    }
    return this.getLocalPosts();
  },

  // Guardar publicación en la nube (accesible desde cualquier celular o PC)
  async savePost(post) {
    const cleanPost = {
      ...post,
      author: this.normalizeAuthor(post.author),
      comments: post.comments || [],
      vistos: post.vistos || [],
      attachments: post.attachments || [],
      createdAt: post.createdAt || new Date().toISOString()
    };

    // Subir archivos a Firebase Storage si está disponible
    if (cleanPost.attachments && cleanPost.attachments.length > 0) {
      for (const att of cleanPost.attachments) {
        if (att.rawFile && typeof firestoreStorage !== 'undefined' && firestoreStorage) {
          try {
            const fileRef = firestoreStorage.ref(`archivos_tesis/${cleanPost.id}_${att.name}`);
            await fileRef.put(att.rawFile);
            const downloadUrl = await fileRef.getDownloadURL();
            att.data = downloadUrl; // URL en la nube accesible desde cualquier lugar
            delete att.rawFile;
          } catch (storageErr) {
            console.warn('Aviso al subir a Storage, guardando dataURL como respaldo:', storageErr);
            delete att.rawFile;
          }
        } else {
          delete att.rawFile;
        }
      }
    }

    if (this.isFirebaseActive && firestoreDb) {
      try {
        await firestoreDb.collection(DB_COLLECTION).doc(cleanPost.id).set(cleanPost);
        return cleanPost;
      } catch (e) {
        console.error('Error al guardar en Firestore:', e);
      }
    }

    // Respaldo local
    const local = await this.getLocalPosts();
    const idx = local.findIndex(p => p.id === cleanPost.id);
    if (idx >= 0) local[idx] = cleanPost;
    else local.unshift(cleanPost);
    localStorage.setItem('foromagma_cloud_cache', JSON.stringify(local));
    return cleanPost;
  },

  // Eliminar publicación en la nube
  async deletePost(postId) {
    if (this.isFirebaseActive && firestoreDb) {
      try {
        await firestoreDb.collection(DB_COLLECTION).doc(postId).delete();
        return true;
      } catch (e) {
        console.error('Error al borrar de Firestore:', e);
      }
    }

    let local = await this.getLocalPosts();
    local = local.filter(p => p.id !== postId);
    localStorage.setItem('foromagma_cloud_cache', JSON.stringify(local));
    return true;
  },

  // Agregar comentario en la nube
  async addComment(postId, comment) {
    const cleanComment = {
      ...comment,
      author: this.normalizeAuthor(comment.author),
      createdAt: comment.createdAt || new Date().toISOString()
    };

    if (this.isFirebaseActive && firestoreDb) {
      try {
        await firestoreDb.collection(DB_COLLECTION).doc(postId).update({
          comments: firebase.firestore.FieldValue.arrayUnion(cleanComment)
        });
        return cleanComment;
      } catch (e) {
        console.warn('Error al comentar en Firestore:', e);
      }
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

  // Alternar "Visto" en la nube
  async toggleVisto(postId, viewerIdentifier) {
    if (this.isFirebaseActive && firestoreDb) {
      try {
        const docRef = firestoreDb.collection(DB_COLLECTION).doc(postId);
        const docSnap = await docRef.get();
        if (docSnap.exists) {
          const data = docSnap.data();
          const vistos = data.vistos || [];
          if (vistos.includes(viewerIdentifier)) {
            await docRef.update({
              vistos: firebase.firestore.FieldValue.arrayRemove(viewerIdentifier)
            });
          } else {
            await docRef.update({
              vistos: firebase.firestore.FieldValue.arrayUnion(viewerIdentifier)
            });
          }
        }
        return;
      } catch (e) {
        console.warn('Error al actualizar Visto en Firestore:', e);
      }
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

  // Procesar archivo adjunto
  readFileAttachment(file) {
    return new Promise((resolve, reject) => {
      const allowedExtensions = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv', 'png', 'jpg', 'jpeg', 'zip'];
      const extension = file.name.split('.').pop().toLowerCase();

      if (!allowedExtensions.includes(extension)) {
        return reject(new Error(`Tipo .${extension} no permitido. Sube PDF, Word, Excel o imágenes.`));
      }

      // Máximo 20MB para subir a la nube
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
          data: e.target.result, // Fallback en base64
          rawFile: file // Objeto File original para Storage
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
