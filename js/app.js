// Lógica Principal de ForoMagma

document.addEventListener('DOMContentLoaded', async () => {
  await StorageManager.init();

  const state = {
    posts: [],
    searchQuery: '',
    pendingFiles: [],
    viewerId: getOrCreateViewerId()
  };

  function getOrCreateViewerId() {
    let id = localStorage.getItem('foromagma_viewer_id');
    if (!id) {
      id = 'viewer_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('foromagma_viewer_id', id);
    }
    return id;
  }

  // Funciones seguras para evitar cualquier error de tipo
  function safeTrim(value, fallback = '') {
    if (value === null || value === undefined) return fallback;
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'object') {
      if (value.fullName && typeof value.fullName === 'string') return value.fullName.trim();
      if (value.name && typeof value.name === 'string') return value.name.trim();
    }
    return String(value).trim() || fallback;
  }

  function getAuthorName(author) {
    return safeTrim(author, 'Autor');
  }

  function getInitials(author) {
    const safe = getAuthorName(author);
    const parts = safe.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return 'FM';
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  // Elementos del DOM
  const dom = {
    postsContainer: document.getElementById('postsContainer'),
    linksContainer: document.getElementById('linksContainer'),
    linksCountBadge: document.getElementById('linksCountBadge'),
    searchInput: document.getElementById('searchInput'),
    
    // Modal 90%
    modalNewPost: document.getElementById('modalNewPost'),
    btnOpenNewPost: document.getElementById('btnOpenNewPost'),
    btnQuickOpenPost: document.getElementById('btnQuickOpenPost'),
    btnCloseNewPost: document.getElementById('btnCloseNewPost'),
    formNewPost: document.getElementById('formNewPost'),
    postAuthorInput: document.getElementById('postAuthorInput'),
    postTitleInput: document.getElementById('postTitleInput'),
    postContentInput: document.getElementById('postContentInput'),
    
    // Subida directa de archivos
    btnAttachDirect: document.getElementById('btnAttachDirect'),
    hiddenFileInput: document.getElementById('hiddenFileInput'),
    attachedBadgesContainer: document.getElementById('attachedBadgesContainer'),
    btnSubmitPost: document.getElementById('btnSubmitPost'),

    toastContainer: document.getElementById('toastContainer')
  };

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

  // Formato exacto de fecha y hora
  function formatExactDateTime(isoString) {
    if (!isoString) return '';
    const date = new Date(isoString);
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const day = date.getDate().toString().padStart(2, '0');
    const month = months[date.getMonth()];
    const year = date.getFullYear();

    let hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const hoursStr = hours.toString().padStart(2, '0');

    return `${day} ${month} ${year} • ${hoursStr}:${minutes} ${ampm}`;
  }

  // Convertir enlaces en texto a tags <a>
  function linkifyText(text) {
    if (!text) return '';
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.replace(urlRegex, (url) => {
      const cleanUrl = url.replace(/[.,;:)\]]+$/, '');
      return `<a href="${cleanUrl}" target="_blank" rel="noopener noreferrer">${cleanUrl}</a>`;
    });
  }

  // Formato de tamaño de archivo
  function formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 KB';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  function getFileMeta(extension) {
    const ext = safeTrim(extension).toLowerCase();
    if (ext === 'pdf') return { label: 'PDF', cssClass: 'type-pdf' };
    if (['doc', 'docx'].includes(ext)) return { label: 'WORD', cssClass: 'type-doc' };
    if (['xls', 'xlsx', 'csv'].includes(ext)) return { label: 'EXCEL', cssClass: 'type-xls' };
    if (['ppt', 'pptx'].includes(ext)) return { label: 'PPT', cssClass: 'type-ppt' };
    return { label: ext.toUpperCase() || 'DOC', cssClass: 'type-other' };
  }

  // Cargar datos
  async function loadData() {
    state.posts = await StorageManager.getPosts();
    renderPosts();
    renderLinksSidebar();
  }

  // Renderizar enlaces de la columna izquierda
  function renderLinksSidebar() {
    if (!dom.linksContainer) return;
    const links = StorageManager.extractAllLinks(state.posts);

    if (dom.linksCountBadge) {
      dom.linksCountBadge.textContent = links.length;
    }

    if (links.length === 0) {
      dom.linksContainer.innerHTML = `
        <div class="empty-links-state">
          Aún no se han compartido enlaces en las publicaciones.
        </div>
      `;
      return;
    }

    dom.linksContainer.innerHTML = links.map(item => {
      let hostname = '';
      try {
        hostname = new URL(item.url).hostname;
      } catch (e) {
        hostname = 'Enlace externo';
      }

      return `
        <a href="${item.url}" target="_blank" rel="noopener noreferrer" class="link-card-item" title="${item.url}">
          <div class="link-domain">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
            </svg>
            ${hostname}
          </div>
          <div class="link-full-url">${item.url}</div>
          <div class="link-source-post">De: ${escapeHtml(item.postTitle || 'Publicación')} (${escapeHtml(getAuthorName(item.author))})</div>
        </a>
      `;
    }).join('');
  }

  // Renderizar publicaciones
  function renderPosts() {
    if (!dom.postsContainer) return;

    let filtered = [...state.posts];
    if (state.searchQuery.trim()) {
      const q = state.searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        (p.title || '').toLowerCase().includes(q) ||
        (p.content || '').toLowerCase().includes(q) ||
        getAuthorName(p.author).toLowerCase().includes(q)
      );
    }

    if (filtered.length === 0) {
      dom.postsContainer.innerHTML = `
        <div class="card" style="text-align: center; padding: 3.5rem 1.5rem;">
          <div style="font-size: 2.8rem; margin-bottom: 0.75rem;">⚡</div>
          <h3 style="font-size: 1.25rem; color: var(--primary-dark); margin-bottom: 0.5rem;">ForoMagma está listo</h3>
          <p style="color: var(--text-muted); font-size: 0.92rem; max-width: 440px; margin: 0 auto 1.5rem;">
            No hay publicaciones aún. Haz clic en el botón de abajo para redactar el primer avance de la tesis o compartir documentos.
          </p>
          <button class="btn btn-primary" onclick="document.getElementById('btnOpenNewPost').click()">
            + Crear Primera Publicación
          </button>
        </div>
      `;
      return;
    }

    dom.postsContainer.innerHTML = filtered.map(post => renderPostCard(post)).join('');
    attachPostInteractions();
  }

  // Renderizar tarjeta individual
  function renderPostCard(post) {
    const vistos = post.vistos || [];
    const isVisto = vistos.includes(state.viewerId);
    const vistosCount = vistos.length;
    const commentCount = (post.comments || []).length;
    const authorName = getAuthorName(post.author);

    // Adjuntos
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
                  <div title="Descargar archivo">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2">
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

    // Comentarios
    const commentsListHtml = (post.comments || []).map(c => `
      <div class="comment-card">
        <div class="comment-author-circle">${getInitials(c.author)}</div>
        <div class="comment-bubble">
          <div class="comment-author-row">
            <span class="comment-author-name">${escapeHtml(getAuthorName(c.author))}</span>
            <span class="comment-date">${formatExactDateTime(c.createdAt)}</span>
          </div>
          <div class="comment-body">${linkifyText(escapeHtml(c.content))}</div>
        </div>
      </div>
    `).join('');

    return `
      <article class="post-card" id="card-${post.id}">
        <div class="post-header">
          <div class="post-author-box">
            <div class="author-circle">${getInitials(authorName)}</div>
            <div>
              <div class="post-author-name">${escapeHtml(authorName)}</div>
              <div class="post-datetime">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 6 12 12 16 14"/>
                </svg>
                ${formatExactDateTime(post.createdAt)}
              </div>
            </div>
          </div>
        </div>

        <h2 class="post-title">${escapeHtml(post.title)}</h2>

        <div class="post-content">${linkifyText(escapeHtml(post.content))}</div>

        ${attachmentsHtml}

        <div class="post-actions-bar">
          <!-- Botón Visto (Ojo 👁️) -->
          <button class="btn-visto ${isVisto ? 'active' : ''}" data-post-id="${post.id}" title="Marcar como visto">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
            <span>Visto ${vistosCount > 0 ? `(${vistosCount})` : ''}</span>
          </button>

          <button class="action-btn btn-toggle-comments" data-post-id="${post.id}">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            <span>${commentCount} Comentarios</span>
          </button>

          <button class="action-btn btn-share" data-post-id="${post.id}" title="Copiar enlace">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
            </svg>
            <span>Compartir</span>
          </button>
        </div>

        <div class="comments-section" id="comments-${post.id}">
          <div class="comments-header">Comentarios (${commentCount})</div>
          
          <div class="comments-list">
            ${commentsListHtml || '<div style="font-size: 0.85rem; color: var(--text-muted); font-style: italic;">No hay comentarios todavía. Deja tu observación.</div>'}
          </div>

          <form class="add-comment-box form-add-comment" data-post-id="${post.id}">
            <div class="comment-inputs-row">
              <input type="text" class="comment-author-input input-comment-author" placeholder="Tu Nombre o Autor..." value="${StorageManager.getLastAuthor()}" required>
            </div>
            <textarea class="comment-textarea input-comment-text" placeholder="Escribe tu comentario o respuesta..." required></textarea>
            <div style="display: flex; justify-content: flex-end;">
              <button type="submit" class="btn btn-primary" style="padding: 0.45rem 1rem; font-size: 0.82rem;">Comentar</button>
            </div>
          </form>
        </div>
      </article>
    `;
  }

  // Listeners de interacción
  function attachPostInteractions() {
    // Botón Visto
    document.querySelectorAll('.btn-visto').forEach(btn => {
      btn.addEventListener('click', async () => {
        const postId = btn.getAttribute('data-post-id');
        await StorageManager.toggleVisto(postId, state.viewerId);
        state.posts = await StorageManager.getPosts();
        renderPosts();
      });
    });

    // Compartir
    document.querySelectorAll('.btn-share').forEach(btn => {
      btn.addEventListener('click', () => {
        const postId = btn.getAttribute('data-post-id');
        const url = window.location.origin + window.location.pathname + '#card-' + postId;
        navigator.clipboard.writeText(url).then(() => {
          showToast('Enlace directo copiado al portapapeles');
        }).catch(() => {
          prompt('Copia este enlace directo:', url);
        });
      });
    });

    // Descarga de archivos
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
          const link = document.createElement('a');
          link.href = att.data;
          link.download = fileName;
          document.body.appendChild(link);
          link.click();
          link.remove();
          showToast(`Descargando ${fileName}...`);
        }
      });
    });

    // Comentar
    document.querySelectorAll('.form-add-comment').forEach(form => {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const postId = form.getAttribute('data-post-id');
        const authorInput = form.querySelector('.input-comment-author');
        const textInput = form.querySelector('.input-comment-text');

        const authorName = safeTrim(authorInput.value);
        const commentText = safeTrim(textInput.value);

        if (!authorName || !commentText) return;

        StorageManager.setLastAuthor(authorName);

        const newComment = {
          id: 'comm_' + Date.now(),
          author: authorName,
          content: commentText,
          createdAt: new Date().toISOString()
        };

        await StorageManager.addComment(postId, newComment);
        state.posts = await StorageManager.getPosts();
        renderPosts();
        renderLinksSidebar();
        showToast('Comentario añadido');
      });
    });
  }

  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.innerText = text;
    return div.innerHTML;
  }

  // ==========================================================
  // VENTANA 90% (MODAL MINIMALISTA)
  // ==========================================================
  function openNewPostModal() {
    state.pendingFiles = [];
    renderAttachedBadges();
    dom.postAuthorInput.value = StorageManager.getLastAuthor();
    dom.modalNewPost.classList.add('active');
    dom.postTitleInput.focus();
  }

  function closeNewPostModal() {
    dom.modalNewPost.classList.remove('active');
    dom.formNewPost.reset();
    state.pendingFiles = [];
    renderAttachedBadges();
  }

  dom.btnOpenNewPost.addEventListener('click', openNewPostModal);
  if (dom.btnQuickOpenPost) dom.btnQuickOpenPost.addEventListener('click', openNewPostModal);
  dom.btnCloseNewPost.addEventListener('click', closeNewPostModal);

  dom.modalNewPost.addEventListener('click', (e) => {
    if (e.target === dom.modalNewPost) closeNewPostModal();
  });

  // Botón directo para examinar el PC
  dom.btnAttachDirect.addEventListener('click', () => {
    dom.hiddenFileInput.click();
  });

  dom.hiddenFileInput.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    for (const file of files) {
      try {
        const fileObj = await StorageManager.readFileAttachment(file);
        state.pendingFiles.push(fileObj);
        renderAttachedBadges();
        showToast(`Archivo adjunto: ${file.name}`);
      } catch (err) {
        showToast(err.message, 'error');
      }
    }
    dom.hiddenFileInput.value = '';
  });

  function renderAttachedBadges() {
    if (!dom.attachedBadgesContainer) return;
    dom.attachedBadgesContainer.innerHTML = state.pendingFiles.map((f, idx) => {
      const meta = getFileMeta(f.extension);
      return `
        <span class="attached-badge-chip">
          <span>${meta.label}</span>
          <strong title="${f.name}">${f.name}</strong>
          <span style="color: var(--text-muted); font-size: 0.72rem;">(${formatFileSize(f.size)})</span>
          <button type="button" class="attached-remove-x" onclick="removePendingFile(${idx})" title="Quitar archivo">✕</button>
        </span>
      `;
    }).join('');
  }

  window.removePendingFile = function(index) {
    state.pendingFiles.splice(index, 1);
    renderAttachedBadges();
  };

  // Enviar publicación
  dom.formNewPost.addEventListener('submit', async (e) => {
    e.preventDefault();

    const author = safeTrim(dom.postAuthorInput.value);
    const title = safeTrim(dom.postTitleInput.value);
    const content = safeTrim(dom.postContentInput.value);

    if (!author) {
      showToast('Por favor escribe el Nombre o Autor', 'error');
      return;
    }
    if (!title || !content) {
      showToast('Por favor completa el título y la descripción', 'error');
      return;
    }

    StorageManager.setLastAuthor(author);

    const newPost = {
      id: 'post_' + Date.now(),
      title: title,
      author: author,
      content: content,
      attachments: [...state.pendingFiles],
      vistos: [state.viewerId],
      comments: [],
      createdAt: new Date().toISOString()
    };

    dom.btnSubmitPost.disabled = true;
    dom.btnSubmitPost.textContent = 'Publicando...';

    try {
      await StorageManager.savePost(newPost);
      state.posts = await StorageManager.getPosts();
      renderPosts();
      renderLinksSidebar();
      closeNewPostModal();
      showToast('¡Publicación creada exitosamente!');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      console.error(err);
      showToast('Error al publicar: ' + (err.message || err), 'error');
    } finally {
      dom.btnSubmitPost.disabled = false;
      dom.btnSubmitPost.textContent = 'Publicar Avance';
    }
  });

  // Búsqueda en vivo
  dom.searchInput.addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    renderPosts();
  });

  // Inicializar
  await loadData();
});
