// Lógica Principal de ForoMagma — Estilo TaganAzul con Modo Oscuro y Comentarios Desplegables

document.addEventListener('DOMContentLoaded', async () => {
  const state = {
    posts: [],
    searchQuery: '',
    pendingFiles: [],
    viewerId: getOrCreateViewerId(),
    openComments: new Set() // Guarda qué posts tienen los comentarios desplegados
  };

  // ==========================================================
  // GESTIÓN DE MODO OSCURO / CLARO
  // ==========================================================
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  const themeIcon = document.getElementById('themeIcon');
  const themeText = document.getElementById('themeText');

  function initTheme() {
    const savedTheme = localStorage.getItem('foromagma_theme');
    if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      setTheme('dark');
    } else {
      setTheme('light');
    }
  }

  function setTheme(theme) {
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
      if (themeIcon) themeIcon.textContent = '☀️';
      if (themeText) themeText.textContent = 'Modo Claro';
      localStorage.setItem('foromagma_theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
      if (themeIcon) themeIcon.textContent = '🌙';
      if (themeText) themeText.textContent = 'Modo Oscuro';
      localStorage.setItem('foromagma_theme', 'light');
    }
  }

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      setTheme(isDark ? 'light' : 'dark');
    });
  }

  initTheme();

  // ==========================================================
  // HELPERS Y PERSISTENCIA
  // ==========================================================
  function getOrCreateViewerId() {
    let id = localStorage.getItem('foromagma_viewer_id');
    if (!id) {
      id = 'viewer_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('foromagma_viewer_id', id);
    }
    return id;
  }

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

  function flashSyncIndicator() {
    const el = document.getElementById('sync-indicator');
    if (!el) return;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 1800);
  }

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

    return `${day} ${month} ${year} — ${hoursStr}:${minutes} ${ampm}`;
  }

  function linkifyText(text) {
    if (!text) return '';
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.replace(urlRegex, (url) => {
      const cleanUrl = url.replace(/[.,;:)\]]+$/, '');
      return `<a href="${cleanUrl}" target="_blank" rel="noopener noreferrer">${cleanUrl}</a>`;
    });
  }

  function formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 KB';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  function getFileMeta(extension) {
    const ext = safeTrim(extension).toLowerCase();
    if (ext === 'pdf') return { label: 'PDF', cssClass: 'pdf' };
    if (['doc', 'docx'].includes(ext)) return { label: 'WORD', cssClass: 'doc' };
    if (['xls', 'xlsx', 'csv'].includes(ext)) return { label: 'EXCEL', cssClass: 'xls' };
    if (['ppt', 'pptx'].includes(ext)) return { label: 'PPT', cssClass: 'ppt' };
    return { label: ext.toUpperCase() || 'DOC', cssClass: 'other' };
  }

  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    dom.toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }

  const dom = {
    postsContainer: document.getElementById('postsContainer'),
    linksContainer: document.getElementById('linksContainer'),
    linksCountBadge: document.getElementById('linksCountBadge'),
    searchInput: document.getElementById('searchInput'),

    modalNewPost: document.getElementById('modalNewPost'),
    btnOpenNewPost: document.getElementById('btnOpenNewPost'),
    btnCloseNewPost: document.getElementById('btnCloseNewPost'),
    formNewPost: document.getElementById('formNewPost'),
    postAuthorInput: document.getElementById('postAuthorInput'),
    postTitleInput: document.getElementById('postTitleInput'),
    postContentInput: document.getElementById('postContentInput'),

    btnAttachDirect: document.getElementById('btnAttachDirect'),
    hiddenFileInput: document.getElementById('hiddenFileInput'),
    attachedBadgesContainer: document.getElementById('attachedBadgesContainer'),
    btnSubmitPost: document.getElementById('btnSubmitPost'),

    toastContainer: document.getElementById('toastContainer')
  };

  // Renderizar columna izquierda de enlaces
  function renderLinksSidebar() {
    if (!dom.linksContainer) return;
    const links = StorageManager.extractAllLinks(state.posts);

    if (dom.linksCountBadge) {
      dom.linksCountBadge.textContent = links.length;
    }

    if (links.length === 0) {
      dom.linksContainer.innerHTML = `
        <div style="font-size: 0.78rem; color: var(--ink-soft); font-style: italic; padding: 4px 0;">
          No hay enlaces compartidos todavía.
        </div>
      `;
      return;
    }

    dom.linksContainer.innerHTML = links.map(item => {
      let hostname = '';
      try {
        hostname = new URL(item.url).hostname;
      } catch (e) {
        hostname = 'Enlace';
      }

      return `
        <a href="${item.url}" target="_blank" rel="noopener noreferrer" class="link-item-card" title="${item.url}">
          <span class="link-domain">${hostname}</span>
          <span class="link-url">${item.url}</span>
          <span class="link-author-ref">De: ${escapeHtml(item.postTitle || 'Avance')} (${escapeHtml(getAuthorName(item.author))})</span>
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
        <div class="box-panel" style="text-align: center; padding: 40px 20px;">
          <h3 style="font-family: var(--font-serif); font-size: 1.3rem; margin-bottom: 6px;">No hay publicaciones en el tablero</h3>
          <p style="font-size: 0.88rem; color: var(--ink-soft); max-width: 440px; margin: 0 auto 16px;">
            Sé el primero en compartir un avance, esquema o reporte técnico con el equipo.
          </p>
          <button class="btn-new-post" onclick="document.getElementById('btnOpenNewPost').click()">
            + Redactar Primer Avance
          </button>
        </div>
      `;
      return;
    }

    dom.postsContainer.innerHTML = filtered.map(post => renderPostCard(post)).join('');
    attachPostInteractions();
  }

  function renderPostCard(post) {
    const vistos = post.vistos || [];
    const isVisto = vistos.includes(state.viewerId);
    const vistosCount = vistos.length;
    const comments = post.comments || [];
    const commentCount = comments.length;
    const authorName = getAuthorName(post.author);
    const isCommentsOpen = state.openComments.has(post.id);

    // Adjuntos
    let attachmentsHtml = '';
    if (post.attachments && post.attachments.length > 0) {
      attachmentsHtml = `
        <div class="attachments-wrapper">
          <div class="attachments-label">Documentos (${post.attachments.length})</div>
          <div class="attachments-grid">
            ${post.attachments.map(att => {
              const meta = getFileMeta(att.extension);
              return `
                <div class="att-chip" data-file-id="${att.id}" data-file-name="${att.name}" data-post-id="${post.id}" title="Clic para descargar">
                  <span class="att-tag ${meta.cssClass}">${meta.label}</span>
                  <strong>${att.name}</strong>
                  <span style="color: var(--ink-soft); font-size: 0.72rem;">(${formatFileSize(att.size)})</span>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }

    // Comentarios
    const commentsListHtml = comments.map(c => `
      <div class="comment-row">
        <div class="comment-meta">
          <span class="comment-author">${escapeHtml(getAuthorName(c.author))}</span>
          <span class="comment-time">${formatExactDateTime(c.createdAt)}</span>
        </div>
        <div class="comment-text">${linkifyText(escapeHtml(c.content))}</div>
      </div>
    `).join('');

    return `
      <article class="post-card" id="card-${post.id}">
        <div class="post-header">
          <div class="post-author-row">
            <span class="person-badge">${escapeHtml(authorName)}</span>
            <span class="post-datetime">${formatExactDateTime(post.createdAt)}</span>
          </div>

          <button class="btn-delete-post" data-post-id="${post.id}" data-post-title="${escapeHtml(post.title)}" title="Eliminar publicación">
            ✕ Eliminar
          </button>
        </div>

        <h2 class="post-title">${escapeHtml(post.title)}</h2>

        <div class="post-content">${linkifyText(escapeHtml(post.content))}</div>

        ${attachmentsHtml}

        <div class="post-actions">
          <!-- Botón Visto (Ojo 👁️) -->
          <button class="btn-visto ${isVisto ? 'active' : ''}" data-post-id="${post.id}" title="Marcar como visto">
            <span>👁️</span>
            <span>Visto ${vistosCount > 0 ? `(${vistosCount})` : ''}</span>
          </button>

          <!-- Botón Desplegable de Comentarios -->
          <button class="btn-toggle-comments ${isCommentsOpen ? 'open' : ''}" data-post-id="${post.id}">
            <span>💬</span>
            <span class="comments-btn-label">${commentCount > 0 ? `Comentarios (${commentCount})` : 'Comentar'}</span>
            <span class="arrow">▼</span>
          </button>
        </div>

        <!-- SECCIÓN DE COMENTARIOS DESPLEGABLE -->
        <div class="comments-accordion ${isCommentsOpen ? 'open' : ''}" id="comments-${post.id}">
          <div class="comments-accordion-title">
            Comentarios y Discusión (${commentCount})
          </div>

          <div class="comments-list">
            ${commentsListHtml || '<div style="font-size: 0.78rem; color: var(--ink-soft); font-style: italic;">No hay comentarios aún. Deja tu observación a continuación:</div>'}
          </div>

          <form class="comment-form form-add-comment" data-post-id="${post.id}">
            <input type="text" class="comment-author-input input-comment-author" placeholder="Tu nombre..." value="${StorageManager.getLastAuthor()}" required>
            <textarea class="comment-body-textarea input-comment-text" placeholder="Escribe un comentario o respuesta..." required></textarea>
            <button type="submit" class="comment-submit-btn">Comentar</button>
          </form>
        </div>
      </article>
    `;
  }

  function attachPostInteractions() {
    // Toggle de comentarios desplegables
    document.querySelectorAll('.btn-toggle-comments').forEach(btn => {
      btn.addEventListener('click', () => {
        const postId = btn.getAttribute('data-post-id');
        const accordion = document.getElementById('comments-' + postId);
        if (!accordion) return;

        if (state.openComments.has(postId)) {
          state.openComments.delete(postId);
          accordion.classList.remove('open');
          btn.classList.remove('open');
        } else {
          state.openComments.add(postId);
          accordion.classList.add('open');
          btn.classList.add('open');
        }
      });
    });

    // Eliminar publicación
    document.querySelectorAll('.btn-delete-post').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const postId = btn.getAttribute('data-post-id');
        const postTitle = btn.getAttribute('data-post-title') || 'esta publicación';

        if (confirm(`¿Estás seguro de que deseas eliminar la publicación "${postTitle}"?`)) {
          await StorageManager.deletePost(postId);
          flashSyncIndicator();
          showToast('Publicación eliminada');
        }
      });
    });

    // Visto
    document.querySelectorAll('.btn-visto').forEach(btn => {
      btn.addEventListener('click', async () => {
        const postId = btn.getAttribute('data-post-id');
        await StorageManager.toggleVisto(postId, state.viewerId);
        flashSyncIndicator();
      });
    });

    // Descarga de archivos
    document.querySelectorAll('.att-chip').forEach(chip => {
      chip.addEventListener('click', (e) => {
        e.preventDefault();
        const postId = chip.getAttribute('data-post-id');
        const fileId = chip.getAttribute('data-file-id');
        const fileName = chip.getAttribute('data-file-name');

        const post = state.posts.find(p => p.id === postId);
        if (!post) return;
        const att = (post.attachments || []).find(a => a.id === fileId);
        if (!att || !att.data) return;

        showToast(`Descargando ${fileName}...`);

        if (att.data.startsWith('http')) {
          window.open(att.data, '_blank');
        } else {
          const link = document.createElement('a');
          link.href = att.data;
          link.download = fileName;
          document.body.appendChild(link);
          link.click();
          link.remove();
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

        textInput.value = '';
        state.openComments.add(postId); // Asegurar que permanezca desplegado para ver el nuevo comentario

        await StorageManager.addComment(postId, newComment);
        flashSyncIndicator();
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
  // MODAL 90% ESTILO TAGANAZUL
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
  dom.btnCloseNewPost.addEventListener('click', closeNewPostModal);

  dom.modalNewPost.addEventListener('click', (e) => {
    if (e.target === dom.modalNewPost) closeNewPostModal();
  });

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
        showToast(`Adjunto: ${file.name}`);
      } catch (err) {
        showToast(err.message);
      }
    }
    dom.hiddenFileInput.value = '';
  });

  function renderAttachedBadges() {
    if (!dom.attachedBadgesContainer) return;
    dom.attachedBadgesContainer.innerHTML = state.pendingFiles.map((f, idx) => {
      const meta = getFileMeta(f.extension);
      return `
        <span class="attached-badge-tagan">
          <strong>${f.name}</strong>
          <span>(${formatFileSize(f.size)})</span>
          <button type="button" onclick="removePendingFile(${idx})">✕</button>
        </span>
      `;
    }).join('');
  }

  window.removePendingFile = function(index) {
    state.pendingFiles.splice(index, 1);
    renderAttachedBadges();
  };

  dom.formNewPost.addEventListener('submit', async (e) => {
    e.preventDefault();

    const author = safeTrim(dom.postAuthorInput.value);
    const title = safeTrim(dom.postTitleInput.value);
    const content = safeTrim(dom.postContentInput.value);

    if (!author) {
      showToast('Por favor escribe el Nombre o Autor');
      return;
    }
    if (!title || !content) {
      showToast('Por favor completa el título y la descripción');
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
    dom.btnSubmitPost.textContent = state.pendingFiles.length > 0 ? 'Subiendo archivos...' : 'Publicando...';

    try {
      await StorageManager.savePost(newPost);
      closeNewPostModal();
      flashSyncIndicator();
      showToast('Avance publicado con éxito');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      console.error(err);
      showToast('Error al publicar: ' + (err.message || err));
    } finally {
      dom.btnSubmitPost.disabled = false;
      dom.btnSubmitPost.textContent = 'Publicar Avance';
    }
  });

  dom.searchInput.addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    renderPosts();
  });

  // Inicialización y escucha en tiempo real
  await StorageManager.init((livePosts) => {
    state.posts = livePosts;
    renderPosts();
    renderLinksSidebar();
    flashSyncIndicator();
  });
});
