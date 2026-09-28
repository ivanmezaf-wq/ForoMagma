// Aplicación Principal de ForoMagma

document.addEventListener('DOMContentLoaded', async () => {
  // Inicializar almacenamiento
  await StorageManager.init();

  // Estado de la aplicación
  const state = {
    posts: [],
    filteredPosts: [],
    activeCategory: 'Todos',
    searchQuery: '',
    sortBy: 'newest',
    currentUser: StorageManager.getCurrentUser() || {
      fullName: '',
      avatarUrl: ''
    },
    // Archivos pendientes en el modal de nueva publicación
    pendingFiles: [],
    // Foto temporal para el modal de publicación
    tempAvatarUrl: null
  };

  // Elementos del DOM
  const dom = {
    postsContainer: document.getElementById('postsContainer'),
    postsCountBadge: document.getElementById('postsCountBadge'),
    thesisPostsCount: document.getElementById('thesisPostsCount'),
    thesisCommentsCount: document.getElementById('thesisCommentsCount'),
    thesisFilesCount: document.getElementById('thesisFilesCount'),
    searchInput: document.getElementById('searchInput'),
    sortSelect: document.getElementById('sortSelect'),
    categoryItems: document.querySelectorAll('.category-filter-btn'),
    mobileCategoryChips: document.getElementById('mobileCategoryChips'),
    navUserAvatar: document.getElementById('navUserAvatar'),
    navUserName: document.getElementById('navUserName'),
    
    // Modal Nueva Publicación
    modalNewPost: document.getElementById('modalNewPost'),
    btnOpenNewPost: document.getElementById('btnOpenNewPost'),
    btnQuickOpenPost: document.getElementById('btnQuickOpenPost'),
    btnCloseNewPost: document.getElementById('btnCloseNewPost'),
    formNewPost: document.getElementById('formNewPost'),
    authorNameInput: document.getElementById('authorNameInput'),
    postTitleInput: document.getElementById('postTitleInput'),
    postCategorySelect: document.getElementById('postCategorySelect'),
    postContentInput: document.getElementById('postContentInput'),
    modalAvatarPreview: document.getElementById('modalAvatarPreview'),
    btnRegenAvatar: document.getElementById('btnRegenAvatar'),
    avatarFileInput: document.getElementById('avatarFileInput'),
    btnUploadAvatar: document.getElementById('btnUploadAvatar'),
    fileDropzone: document.getElementById('fileDropzone'),
    postAttachmentInput: document.getElementById('postAttachmentInput'),
    pendingFilesList: document.getElementById('pendingFilesList'),
    btnSubmitPost: document.getElementById('btnSubmitPost'),

    // Toast
    toastContainer: document.getElementById('toastContainer')
  };

  // Cargar datos iniciales
  async function loadData() {
    state.posts = await StorageManager.getPosts();
    updateThesisStats();
    applyFilters();
    updateUserNavBadge();
  }

  // Notificación Toast
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = 'toast';
    let icon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>`;
    if (type === 'error') {
      icon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
    }
    toast.innerHTML = `${icon} <span>${message}</span>`;
    dom.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  // Actualizar estadísticas del sidebar
  function updateThesisStats() {
    let totalComments = 0;
    let totalFiles = 0;

    state.posts.forEach(p => {
      if (p.comments) totalComments += p.comments.length;
      if (p.attachments) totalFiles += p.attachments.length;
    });

    if (dom.postsCountBadge) dom.postsCountBadge.textContent = state.posts.length;
    if (dom.thesisPostsCount) dom.thesisPostsCount.textContent = state.posts.length;
    if (dom.thesisCommentsCount) dom.thesisCommentsCount.textContent = totalComments;
    if (dom.thesisFilesCount) dom.thesisFilesCount.textContent = totalFiles;
  }

  // Actualizar el perfil en la barra superior
  function updateUserNavBadge() {
    if (state.currentUser.fullName) {
      dom.navUserName.textContent = state.currentUser.fullName;
      dom.navUserAvatar.src = state.currentUser.avatarUrl || AvatarManager.generateSvgAvatar(state.currentUser.fullName);
    } else {
      dom.navUserName.textContent = 'Mi Perfil';
      dom.navUserAvatar.src = AvatarManager.generateSvgAvatar('Electrónica');
    }
  }

  // Filtrado y ordenamiento de publicaciones
  function applyFilters() {
    let filtered = [...state.posts];

    // Filtro por categoría
    if (state.activeCategory && state.activeCategory !== 'Todos') {
      filtered = filtered.filter(p => p.category === state.activeCategory);
    }

    // Filtro por búsqueda
    if (state.searchQuery.trim()) {
      const q = state.searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        p.title.toLowerCase().includes(q) ||
        p.content.toLowerCase().includes(q) ||
        (p.author && p.author.fullName.toLowerCase().includes(q))
      );
    }

    // Ordenamiento
    if (state.sortBy === 'newest') {
      filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } else if (state.sortBy === 'most_comments') {
      filtered.sort((a, b) => (b.comments ? b.comments.length : 0) - (a.comments ? a.comments.length : 0));
    } else if (state.sortBy === 'most_likes') {
      filtered.sort((a, b) => (b.likes ? b.likes.length : 0) - (a.likes ? a.likes.length : 0));
    }

    state.filteredPosts = filtered;
    renderPosts();
  }

  // Renderizar la lista de publicaciones en la columna central
  function renderPosts() {
    if (!dom.postsContainer) return;

    if (state.filteredPosts.length === 0) {
      dom.postsContainer.innerHTML = `
        <div class="card" style="text-align: center; padding: 3rem 1.5rem;">
          <div style="font-size: 2.5rem; margin-bottom: 0.75rem;">⚡</div>
          <h3 style="font-size: 1.2rem; color: var(--primary-dark); margin-bottom: 0.5rem;">No se encontraron publicaciones</h3>
          <p style="color: var(--text-muted); font-size: 0.9rem; max-width: 400px; margin: 0 auto 1.5rem;">
            Sé el primero en compartir un avance, circuito, documento o duda en esta sección.
          </p>
          <button class="btn btn-primary" onclick="document.getElementById('btnOpenNewPost').click()">
            + Crear Nueva Publicación
          </button>
        </div>
      `;
      return;
    }

    dom.postsContainer.innerHTML = state.filteredPosts.map(post => renderPostCard(post)).join('');
    attachPostInteractions();
  }

  // Formato de fecha relativa o legible
  function formatRelativeDate(isoDate) {
    if (!isoDate) return 'Reciente';
    const date = new Date(isoDate);
    const now = new Date();
    const diffSec = Math.floor((now - date) / 1000);

    if (diffSec < 60) return 'Hace un momento';
    if (diffSec < 3600) return `Hace ${Math.floor(diffSec / 60)} min`;
    if (diffSec < 86400) return `Hace ${Math.floor(diffSec / 3600)} h`;
    if (diffSec < 604800) return `Hace ${Math.floor(diffSec / 86400)} d`;

    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  // Formato de tamaño de archivo (KB / MB)
  function formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 KB';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  // Icono y clase según tipo de archivo
  function getFileMeta(extension) {
    const ext = (extension || '').toLowerCase();
    if (ext === 'pdf') {
      return { label: 'PDF', cssClass: 'type-pdf', icon: '📄' };
    }
    if (['doc', 'docx'].includes(ext)) {
      return { label: 'WORD', cssClass: 'type-doc', icon: '📝' };
    }
    if (['xls', 'xlsx', 'csv'].includes(ext)) {
      return { label: 'EXCEL', cssClass: 'type-xls', icon: '📊' };
    }
    if (['ppt', 'pptx'].includes(ext)) {
      return { label: 'PPT', cssClass: 'type-ppt', icon: '📽️' };
    }
    return { label: ext.toUpperCase() || 'DOC', cssClass: 'type-other', icon: '📎' };
  }

  // Renderizar HTML de un Post
  function renderPostCard(post) {
    const isLiked = state.currentUser.fullName && (post.likes || []).includes(state.currentUser.fullName);
    const likeCount = (post.likes || []).length;
    const commentCount = (post.comments || []).length;

    // Renderizar adjuntos
    let attachmentsHtml = '';
    if (post.attachments && post.attachments.length > 0) {
      attachmentsHtml = `
        <div class="post-attachments-section">
          <div class="attachments-title">Documentos Adjuntos (${post.attachments.length})</div>
          <div class="attachments-grid">
            ${post.attachments.map(att => {
              const meta = getFileMeta(att.extension);
              return `
                <div class="attachment-chip" data-file-id="${att.id}" data-file-name="${att.name}" data-post-id="${post.id}">
                  <div class="attachment-icon-box ${meta.cssClass}">
                    ${meta.label}
                  </div>
                  <div class="attachment-info">
                    <span class="attachment-filename" title="${att.name}">${att.name}</span>
                    <span class="attachment-filesize">${formatFileSize(att.size)}</span>
                  </div>
                  <div class="attachment-download-btn" title="Descargar archivo">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="7 10 12 15 17 10"/>
                      <line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }

    // Renderizar comentarios
    const commentsListHtml = (post.comments || []).map(c => `
      <div class="comment-card">
        <img class="comment-avatar" src="${c.author.avatarUrl || AvatarManager.generateSvgAvatar(c.author.fullName)}" alt="${c.author.fullName}">
        <div class="comment-bubble">
          <div class="comment-author-row">
            <span class="comment-author-name">${c.author.fullName}</span>
            <span class="comment-date">${formatRelativeDate(c.createdAt)}</span>
          </div>
          <div class="comment-body">${escapeHtml(c.content)}</div>
        </div>
      </div>
    `).join('');

    return `
      <article class="post-card" id="card-${post.id}">
        <div class="post-header">
          <div class="post-author-wrap">
            <img class="post-avatar" src="${post.author.avatarUrl || AvatarManager.generateSvgAvatar(post.author.fullName)}" alt="${post.author.fullName}">
            <div class="post-meta">
              <span class="post-author-name">${escapeHtml(post.author.fullName)}</span>
              <div class="post-date-row">
                <span>${formatRelativeDate(post.createdAt)}</span>
                <span>•</span>
                <span class="post-category-tag">⚡ ${post.category || 'General'}</span>
              </div>
            </div>
          </div>
        </div>

        <h2 class="post-title">${escapeHtml(post.title)}</h2>
        
        <div class="post-content">${escapeHtml(post.content)}</div>

        ${attachmentsHtml}

        <div class="post-actions-bar">
          <button class="action-btn btn-like ${isLiked ? 'liked' : ''}" data-post-id="${post.id}">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="${isLiked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
              <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
            </svg>
            <span>${likeCount > 0 ? likeCount : ''} Útil</span>
          </button>

          <button class="action-btn btn-toggle-comments" data-post-id="${post.id}">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            <span>${commentCount} Comentarios</span>
          </button>

          <button class="action-btn btn-share" data-post-id="${post.id}" title="Copiar enlace de publicación">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
            </svg>
            <span>Compartir</span>
          </button>
        </div>

        <!-- Sección de Comentarios desplegada -->
        <div class="comments-section" id="comments-${post.id}">
          <div class="comments-header">Comentarios y Discusión (${commentCount})</div>
          
          <div class="comments-list">
            ${commentsListHtml || '<div style="font-size: 0.85rem; color: var(--text-muted); font-style: italic;">No hay comentarios aún. ¡Escribe el primero!</div>'}
          </div>

          <!-- Formulario para comentar -->
          <form class="add-comment-box form-add-comment" data-post-id="${post.id}">
            <div class="comment-user-inputs">
              <input type="text" class="comment-user-name-input input-comment-author" placeholder="Tu Nombre y Apellido (ej. Juan Pérez)" value="${state.currentUser.fullName || ''}" required>
            </div>
            <textarea class="comment-textarea input-comment-text" placeholder="Escribe tu observación o comentario técnico..." required></textarea>
            <div class="comment-submit-row">
              <span style="font-size: 0.74rem; color: var(--text-light);">Cualquiera que entre al link puede comentar</span>
              <button type="submit" class="btn btn-primary btn-sm">Publicar Comentario</button>
            </div>
          </form>
        </div>
      </article>
    `;
  }

  // Asignar listeners a los botones de posts y comentarios
  function attachPostInteractions() {
    // Likes
    document.querySelectorAll('.btn-like').forEach(btn => {
      btn.addEventListener('click', async () => {
        const postId = btn.getAttribute('data-post-id');
        let userName = state.currentUser.fullName;
        if (!userName) {
          userName = prompt('Ingresa tu Nombre y Apellido para registrar tu reacción:');
          if (!userName || !userName.trim()) return;
          userName = userName.trim();
          state.currentUser.fullName = userName;
          state.currentUser.avatarUrl = AvatarManager.generateSvgAvatar(userName);
          StorageManager.saveCurrentUser(state.currentUser);
          updateUserNavBadge();
        }

        await StorageManager.toggleLike(postId, userName);
        state.posts = await StorageManager.getPosts();
        applyFilters();
      });
    });

    // Compartir link
    document.querySelectorAll('.btn-share').forEach(btn => {
      btn.addEventListener('click', () => {
        const postId = btn.getAttribute('data-post-id');
        const url = window.location.origin + window.location.pathname + '#card-' + postId;
        navigator.clipboard.writeText(url).then(() => {
          showToast('¡Enlace de la publicación copiado al portapapeles!');
        }).catch(() => {
          prompt('Copia este enlace directo a la publicación:', url);
        });
      });
    });

    // Descarga de archivos adjuntos
    document.querySelectorAll('.attachment-chip').forEach(chip => {
      chip.addEventListener('click', (e) => {
        e.preventDefault();
        const postId = chip.getAttribute('data-post-id');
        const fileId = chip.getAttribute('data-file-id');
        const fileName = chip.getAttribute('data-file-name');

        const post = state.posts.find(p => p.id === postId);
        if (!post) return;
        const att = (post.attachments || []).find(a => a.id === fileId);
        if (!att) return;

        if (att.data && att.data.startsWith('data:')) {
          // Descargar directamente dataURL
          const link = document.createElement('a');
          link.href = att.data;
          link.download = fileName;
          document.body.appendChild(link);
          link.click();
          link.remove();
          showToast(`Descargando ${fileName}...`);
        } else {
          // Archivo demostrativo
          showToast(`Generando descarga de ${fileName}...`);
          const blob = new Blob([`Contenido de demostración de ForoMagma para: ${fileName}\n\nDocumento adjunto para la tesis de Electrónica.`], { type: 'text/plain;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = fileName;
          link.click();
          URL.revokeObjectURL(url);
        }
      });
    });

    // Enviar comentario
    document.querySelectorAll('.form-add-comment').forEach(form => {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const postId = form.getAttribute('data-post-id');
        const authorInput = form.querySelector('.input-comment-author');
        const textInput = form.querySelector('.input-comment-text');

        const authorName = authorInput.value.trim();
        const commentText = textInput.value.trim();

        if (!authorName || !commentText) return;

        // Recordar usuario si no estaba guardado
        if (!state.currentUser.fullName) {
          state.currentUser.fullName = authorName;
          state.currentUser.avatarUrl = AvatarManager.generateSvgAvatar(authorName);
          StorageManager.saveCurrentUser(state.currentUser);
          updateUserNavBadge();
        }

        const newComment = {
          id: 'comm_' + Date.now(),
          author: {
            fullName: authorName,
            avatarUrl: (state.currentUser.fullName === authorName && state.currentUser.avatarUrl) ? state.currentUser.avatarUrl : AvatarManager.generateSvgAvatar(authorName)
          },
          content: commentText,
          createdAt: new Date().toISOString()
        };

        await StorageManager.addComment(postId, newComment);
        state.posts = await StorageManager.getPosts();
        updateThesisStats();
        applyFilters();
        showToast('Comentario publicado correctamente');
      });
    });
  }

  // Prevenir inyección HTML básica
  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.innerText = text;
    return div.innerHTML;
  }

  // ==========================================================
  // MANEJO DEL MODAL DE NUEVA PUBLICACIÓN
  // ==========================================================
  function openNewPostModal() {
    state.pendingFiles = [];
    state.tempAvatarUrl = null;
    dom.pendingFilesList.innerHTML = '';

    if (state.currentUser.fullName) {
      dom.authorNameInput.value = state.currentUser.fullName;
      dom.modalAvatarPreview.src = state.currentUser.avatarUrl || AvatarManager.generateSvgAvatar(state.currentUser.fullName);
    } else {
      dom.authorNameInput.value = '';
      dom.modalAvatarPreview.src = AvatarManager.generateSvgAvatar('Usuario');
    }

    dom.modalNewPost.classList.add('active');
    dom.postTitleInput.focus();
  }

  function closeNewPostModal() {
    dom.modalNewPost.classList.remove('active');
    dom.formNewPost.reset();
    state.pendingFiles = [];
    dom.pendingFilesList.innerHTML = '';
  }

  // Eventos de apertura/cierre de modal
  dom.btnOpenNewPost.addEventListener('click', openNewPostModal);
  if (dom.btnQuickOpenPost) dom.btnQuickOpenPost.addEventListener('click', openNewPostModal);
  dom.btnCloseNewPost.addEventListener('click', closeNewPostModal);

  dom.modalNewPost.addEventListener('click', (e) => {
    if (e.target === dom.modalNewPost) closeNewPostModal();
  });

  // Actualizar avatar dinámico cuando escribe su Nombre y Apellido
  dom.authorNameInput.addEventListener('input', () => {
    const val = dom.authorNameInput.value.trim();
    if (!state.tempAvatarUrl) {
      dom.modalAvatarPreview.src = AvatarManager.generateSvgAvatar(val || 'Usuario', 'tech');
    }
  });

  // Regenerar avatar técnico
  dom.btnRegenAvatar.addEventListener('click', () => {
    state.tempAvatarUrl = null;
    const val = dom.authorNameInput.value.trim() || 'ForoMagma';
    const randomSuffix = ' ' + Math.floor(Math.random() * 99);
    dom.modalAvatarPreview.src = AvatarManager.generateSvgAvatar(val + randomSuffix, 'tech');
  });

  // Subir foto propia
  dom.btnUploadAvatar.addEventListener('click', () => dom.avatarFileInput.click());
  dom.avatarFileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        const base64 = await AvatarManager.readImageFile(file);
        state.tempAvatarUrl = base64;
        dom.modalAvatarPreview.src = base64;
        showToast('Foto cargada exitosamente');
      } catch (err) {
        showToast(err.message, 'error');
      }
    }
  });

  // Subida de archivos (PDF, Word, Office)
  dom.fileDropzone.addEventListener('click', () => dom.postAttachmentInput.click());
  dom.postAttachmentInput.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    for (const file of files) {
      try {
        const fileObj = await StorageManager.readFileAttachment(file);
        state.pendingFiles.push(fileObj);
        renderPendingFiles();
        showToast(`Documento adjuntado: ${file.name}`);
      } catch (err) {
        showToast(err.message, 'error');
      }
    }
    dom.postAttachmentInput.value = '';
  });

  // Renderizar archivos pendientes en el modal
  function renderPendingFiles() {
    dom.pendingFilesList.innerHTML = state.pendingFiles.map((f, idx) => {
      const meta = getFileMeta(f.extension);
      return `
        <div class="pending-file-item">
          <span>${meta.icon} <strong>${f.name}</strong> (${formatFileSize(f.size)})</span>
          <button type="button" class="pending-file-remove" onclick="removePendingFile(${idx})">✕</button>
        </div>
      `;
    }).join('');
  }

  window.removePendingFile = function(index) {
    state.pendingFiles.splice(index, 1);
    renderPendingFiles();
  };

  // Enviar y publicar el post
  dom.formNewPost.addEventListener('submit', async (e) => {
    e.preventDefault();

    const fullName = dom.authorNameInput.value.trim();
    const title = dom.postTitleInput.value.trim();
    const category = dom.postCategorySelect.value;
    const content = dom.postContentInput.value.trim();

    if (!fullName) {
      showToast('Por favor escribe tu Nombre y Apellido', 'error');
      return;
    }
    if (!title || !content) {
      showToast('Por favor completa el título y contenido', 'error');
      return;
    }

    const finalAvatar = state.tempAvatarUrl || dom.modalAvatarPreview.src;

    // Guardar usuario para futuras publicaciones
    state.currentUser = {
      fullName: fullName,
      avatarUrl: finalAvatar
    };
    StorageManager.saveCurrentUser(state.currentUser);
    updateUserNavBadge();

    const newPost = {
      id: 'post_' + Date.now(),
      title: title,
      author: {
        fullName: fullName,
        avatarUrl: finalAvatar
      },
      category: category,
      content: content,
      attachments: [...state.pendingFiles],
      likes: [],
      comments: [],
      createdAt: new Date().toISOString()
    };

    dom.btnSubmitPost.disabled = true;
    dom.btnSubmitPost.textContent = 'Publicando...';

    try {
      await StorageManager.savePost(newPost);
      state.posts = await StorageManager.getPosts();
      updateThesisStats();
      applyFilters();
      closeNewPostModal();
      showToast('¡Publicación creada con éxito!');

      // Scroll a la nueva publicación
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      showToast('Error al guardar la publicación: ' + err.message, 'error');
    } finally {
      dom.btnSubmitPost.disabled = false;
      dom.btnSubmitPost.textContent = 'Publicar en el Foro';
    }
  });

  // ==========================================================
  // FILTROS Y EVENTOS
  // ==========================================================
  // Búsqueda en vivo
  dom.searchInput.addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    applyFilters();
  });

  // Ordenamiento
  dom.sortSelect.addEventListener('change', (e) => {
    state.sortBy = e.target.value;
    applyFilters();
  });

  // Filtro por categorías (Sidebar Izquierdo y Chips Móviles)
  dom.categoryItems.forEach(btn => {
    btn.addEventListener('click', () => {
      dom.categoryItems.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.activeCategory = btn.getAttribute('data-category');
      applyFilters();
    });
  });

  // Inicializar carga de datos
  await loadData();
});
