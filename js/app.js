// Lógica Integral de ForoMagma: Tablero Kanban + Muro de Avances + Matriz

const STATUSES = [
  { key: 'todo', label: 'Por hacer' },
  { key: 'doing', label: 'En proceso' },
  { key: 'blocked', label: 'Bloqueado' },
  { key: 'validated', label: 'Validado por asesor' },
  { key: 'done', label: 'Integrado' }
];

const PILLARS = {
  emb: { label: 'Embebidos & Firmware', color: 'var(--emb)' },
  pcb: { label: 'Circuitos & PCB', color: 'var(--pcb)' },
  ctl: { label: 'Control & Potencia', color: 'var(--ctl)' },
  doc: { label: 'Documentación & Tesis', color: 'var(--doc)' }
};

document.addEventListener('DOMContentLoaded', async () => {
  const state = {
    posts: [],
    kanbanCards: {},
    activePillarFilter: 'all',
    searchQuery: '',
    pendingFiles: [],
    viewerId: getOrCreateViewerId(),
    openComments: new Set()
  };

  // ==========================================================
  // GESTIÓN DE MODO OSCURO / CLARO
  // ==========================================================
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  const themeIcon = document.getElementById('themeIcon');
  const themeText = document.getElementById('themeText');

  function initTheme() {
    const saved = localStorage.getItem('foromagma_theme');
    if (saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
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
  // PESTAÑAS DE NAVEGACIÓN (TABS TIPO TAGANAZUL)
  // ==========================================================
  document.getElementById('tabs').addEventListener('click', (e) => {
    const btn = e.target.closest('.tab-btn');
    if (!btn) return;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    const targetPanel = document.querySelector(`.panel[data-panel="${btn.dataset.tab}"]`);
    if (targetPanel) targetPanel.classList.add('active');
  });

  // ==========================================================
  // HELPERS
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

  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.innerText = text;
    return div.innerHTML;
  }

  function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.getElementById('toastContainer').appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // ==========================================================
  // TABLERO KANBAN INTERACTIVO (TAGANAZUL)
  // ==========================================================
  const kanbanBoardEl = document.getElementById('kanbanBoard');
  const pillarFilterPills = document.getElementById('pillarFilterPills');

  // Filtro de pilares en Kanban
  if (pillarFilterPills) {
    pillarFilterPills.addEventListener('click', (e) => {
      const pill = e.target.closest('.pillar-pill');
      if (!pill) return;
      document.querySelectorAll('.pillar-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      state.activePillarFilter = pill.dataset.pillar;
      renderKanbanBoard();
    });
  }

  function renderKanbanBoard() {
    if (!kanbanBoardEl) return;
    kanbanBoardEl.innerHTML = '';

    const allCards = Object.values(state.kanbanCards);

    STATUSES.forEach(status => {
      let colCards = allCards.filter(c => c.status === status.key);
      if (state.activePillarFilter !== 'all') {
        colCards = colCards.filter(c => c.pillar === state.activePillarFilter);
      }

      const col = document.createElement('div');
      col.className = 'column';
      col.innerHTML = `
        <div class="column-head">
          <span>${status.label}</span>
          <span style="background:var(--sand-deep); padding:2px 7px; border-radius:10px; font-size:0.75rem;">${colCards.length}</span>
        </div>
        <div class="column-body" id="col-body-${status.key}"></div>
      `;

      kanbanBoardEl.appendChild(col);
      const body = col.querySelector('.column-body');

      colCards.forEach(c => {
        const cardEl = document.createElement('div');
        const pilar = PILLARS[c.pillar] || PILLARS.emb;
        const options = STATUSES.map(s => `<option value="${s.key}" ${s.key === c.status ? 'selected' : ''}>${s.label}</option>`).join('');

        cardEl.className = 'kanban-card';
        cardEl.style.borderLeftColor = pilar.color;
        cardEl.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:6px;">
            <div class="title">${escapeHtml(c.title)}</div>
            <button type="button" class="btn-delete-post" style="padding:0; font-size:0.7rem;" onclick="window.removeKanbanCard('${c.id}')" title="Eliminar tarea">✕</button>
          </div>
          ${c.desc ? `<div class="desc">${escapeHtml(c.desc)}</div>` : ''}
          <div class="meta">
            <span class="person">${escapeHtml(c.person || 'Equipo')}</span>
            <select onchange="window.moveKanbanCard('${c.id}', this.value)">${options}</select>
          </div>
        `;
        body.appendChild(cardEl);
      });

      // Botón añadir tarea en esta columna
      const addBtn = document.createElement('button');
      addBtn.className = 'add-card-btn';
      addBtn.textContent = '+ Añadir tarea';
      addBtn.onclick = () => showAddKanbanForm(status.key, body, addBtn);
      body.appendChild(addBtn);
    });
  }

  function showAddKanbanForm(statusKey, body, addBtn) {
    addBtn.style.display = 'none';
    const form = document.createElement('form');
    form.className = 'new-card';
    form.innerHTML = `
      <input type="text" placeholder="Título de la tarea..." required name="title">
      <textarea placeholder="Descripción o detalles técnicos..." name="desc"></textarea>
      <select name="pillar">
        <option value="emb">💻 Embebidos & Firmware</option>
        <option value="pcb">🔌 Circuitos & PCB</option>
        <option value="ctl">⚡ Control & Potencia</option>
        <option value="doc">🎓 Documentación & Tesis</option>
      </select>
      <input type="text" placeholder="Responsable (ej: Keiner, Iván...)" required name="person" value="${StorageManager.getLastAuthor()}">
      <div class="row">
        <button type="submit">Guardar</button>
        <button type="button" class="cancel">Cancelar</button>
      </div>
    `;

    body.insertBefore(form, addBtn);
    form.querySelector('.cancel').onclick = () => {
      form.remove();
      addBtn.style.display = 'block';
    };

    form.onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const title = safeTrim(fd.get('title'));
      const person = safeTrim(fd.get('person'));
      if (!title || !person) return;

      StorageManager.setLastAuthor(person);

      const id = 'task_' + Date.now();
      const newCard = {
        id,
        status: statusKey,
        title: title,
        desc: safeTrim(fd.get('desc')),
        pillar: fd.get('pillar') || 'emb',
        person: person,
        createdAt: new Date().toISOString()
      };

      await StorageManager.saveKanbanCard(newCard);
      flashSyncIndicator();
      showToast('Tarea añadida al tablero Kanban');
    };
  }

  // Funciones globales para eventos inline del Kanban
  window.moveKanbanCard = async function(id, newStatus) {
    await StorageManager.moveKanbanCard(id, newStatus);
    flashSyncIndicator();
  };

  window.removeKanbanCard = async function(id) {
    if (confirm('¿Eliminar esta tarea del tablero Kanban?')) {
      await StorageManager.deleteKanbanCard(id);
      flashSyncIndicator();
      showToast('Tarea eliminada');
    }
  };

  // ==========================================================
  // MURO DE AVANCES Y DISCUSIÓN (FORO)
  // ==========================================================
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
    btnSubmitPost: document.getElementById('btnSubmitPost')
  };

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
          <h3 style="font-family: var(--font-serif); font-size: 1.3rem; margin-bottom: 6px;">No hay publicaciones en el muro</h3>
          <p style="font-size: 0.88rem; color: var(--ink-soft); max-width: 440px; margin: 0 auto 16px;">
            Sé el primero en compartir un avance, esquema o reporte técnico con el equipo.
          </p>
          <button class="btn-new-main" onclick="document.getElementById('btnOpenNewPost').click()">
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
          <button class="btn-visto ${isVisto ? 'active' : ''}" data-post-id="${post.id}" title="Marcar como visto">
            <span>👁️</span>
            <span>Visto ${vistosCount > 0 ? `(${vistosCount})` : ''}</span>
          </button>

          <button class="btn-toggle-comments ${isCommentsOpen ? 'open' : ''}" data-post-id="${post.id}">
            <span>💬</span>
            <span class="comments-btn-label">${commentCount > 0 ? `Comentarios (${commentCount})` : 'Comentar'}</span>
            <span class="arrow">▼</span>
          </button>
        </div>

        <div class="comments-accordion ${isCommentsOpen ? 'open' : ''}" id="comments-${post.id}">
          <div style="font-size: 0.82rem; font-weight: 700; border-bottom: 1px solid var(--line); padding-bottom: 6px;">
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
    // Toggle comentarios
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

    // Eliminar post
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

        textInput.value = '';
        state.openComments.add(postId);

        await StorageManager.addComment(postId, newComment);
        flashSyncIndicator();
        showToast('Comentario añadido');
      });
    });
  }

  // ==========================================================
  // MODAL NUEVA PUBLICACIÓN
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
        <span style="display:inline-flex; align-items:center; gap:5px; background:var(--card-bg); border:1px solid var(--line); border-radius:var(--radius-sm); padding:4px 8px; font-size:0.78rem;">
          <strong>${f.name}</strong>
          <span>(${formatFileSize(f.size)})</span>
          <button type="button" style="background:none; border:none; color:var(--warn); cursor:pointer; font-weight:bold;" onclick="removePendingFile(${idx})">✕</button>
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

  // ==========================================================
  // INICIALIZACIÓN CON FIREBASE EN TIEMPO REAL
  // ==========================================================
  await StorageManager.init(
    // Callback cuando se actualiza el Foro
    (livePosts) => {
      state.posts = livePosts;
      renderPosts();
      renderLinksSidebar();
      flashSyncIndicator();
    },
    // Callback cuando se actualiza el Tablero Kanban
    (liveCards) => {
      state.kanbanCards = liveCards;
      renderKanbanBoard();
      flashSyncIndicator();
    }
  );
});
