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

    const linkRatings = state.linkRatings || {};

    dom.linksContainer.innerHTML = links.map(item => {
      let hostname = '';
      try {
        hostname = new URL(item.url).hostname;
      } catch (e) {
        hostname = 'Enlace';
      }
      const linkKey = 'lnk_' + hashString((item.url || '').toLowerCase().trim());
      const currentRating = linkRatings[linkKey] || '';

      return `
        <div class="link-item-row ${currentRating ? 'rated-' + currentRating : ''}">
          <a href="${item.url}" target="_blank" rel="noopener noreferrer" class="link-item-content" title="${item.url}">
            <span class="link-domain">${hostname}</span>
            <span class="link-url">${item.url}</span>
            <span class="link-author-ref">De: ${escapeHtml(item.postTitle || 'Avance')} (${escapeHtml(getAuthorName(item.author))})</span>
          </a>
          <div class="traffic-light-compact" title="Clasificar enlace">
            <button type="button" class="traffic-dot-sm dot-green ${currentRating === 'green' ? 'selected' : ''}" onclick="window.setLinkTrafficRating('${linkKey}', 'green')" title="🟢 Relevante / Aprobado"></button>
            <button type="button" class="traffic-dot-sm dot-yellow ${currentRating === 'yellow' ? 'selected' : ''}" onclick="window.setLinkTrafficRating('${linkKey}', 'yellow')" title="🟡 En revisión / Duda"></button>
            <button type="button" class="traffic-dot-sm dot-red ${currentRating === 'red' ? 'selected' : ''}" onclick="window.setLinkTrafficRating('${linkKey}', 'red')" title="🔴 Descartado"></button>
          </div>
        </div>
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
  // REPOSITORIO ACADÉMICO & APIS (BATERÍAS DE ION DE LITIO)
  // ==========================================================
  state.papers = (typeof FOROMAGMA_PAPERS_DB !== 'undefined' && Array.isArray(FOROMAGMA_PAPERS_DB))
    ? [...FOROMAGMA_PAPERS_DB]
    : [];
  state.paperRatings = StorageManager.getLocalPaperRatings();
  state.linkRatings = StorageManager.getLocalLinkRatings();
  state.activePaperTopic = 'all';
  state.activeRatingFilter = 'all';
  state.paperSearchQuery = '';

  const papersContainer = document.getElementById('papersContainer');
  const countAllPapersEl = document.getElementById('countAllPapers');
  const paperTopicPills = document.getElementById('paperTopicPills');
  const paperLiveSearchInput = document.getElementById('paperLiveSearchInput');
  const btnQueryOpenAlexLive = document.getElementById('btnQueryOpenAlexLive');
  const btnDownloadBibtex = document.getElementById('btnDownloadBibtex');
  const btnDownloadMarkdown = document.getElementById('btnDownloadMarkdown');
  const trafficFiltersBar = document.getElementById('trafficFiltersBar');
  const btnFilterUnimagdalenaPapers = document.getElementById('btnFilterUnimagdalenaPapers');

  // Elementos contadores de semáforo
  const countRatingAllEl = document.getElementById('countRatingAll');
  const countRatingGreenEl = document.getElementById('countRatingGreen');
  const countRatingYellowEl = document.getElementById('countRatingYellow');
  const countRatingRedEl = document.getElementById('countRatingRed');
  const countRatingNoneEl = document.getElementById('countRatingNone');

  if (countAllPapersEl) {
    countAllPapersEl.textContent = state.papers.length;
  }

  function getPaperKey(p) {
    if (p.doi) {
      return 'doi_' + p.doi.toLowerCase().replace(/[^a-z0-9]/g, '_');
    }
    return 'title_' + hashString((p.title || '').toLowerCase().trim());
  }

  // Funciones globales para clasificar enlaces y papers con semáforo
  window.setLinkTrafficRating = async function(linkKey, color) {
    const updated = await StorageManager.saveLinkRating(linkKey, color);
    state.linkRatings = updated;
    renderLinksSidebar();
    flashSyncIndicator();
  };

  window.setPaperTrafficRating = async function(paperKey, color) {
    const updated = await StorageManager.savePaperRating(paperKey, color);
    state.paperRatings = updated;
    renderPapersList();
    flashSyncIndicator();
  };

  // Filtrado por categoría de tesis
  if (paperTopicPills) {
    paperTopicPills.addEventListener('click', (e) => {
      const pill = e.target.closest('.paper-topic-pill');
      if (!pill) return;
      document.querySelectorAll('.paper-topic-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      state.activePaperTopic = pill.dataset.topic;
      renderPapersList();
    });
  }

  // Filtrado por Semáforo / PRISMA (Verde, Amarillo, Rojo, Sin Clasificar)
  if (trafficFiltersBar) {
    trafficFiltersBar.addEventListener('click', (e) => {
      const btn = e.target.closest('.traffic-filter-btn');
      if (!btn) return;
      document.querySelectorAll('.traffic-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.activeRatingFilter = btn.dataset.ratingFilter || 'all';
      renderPapersList();
    });
  }

  // Conector Descubridor Tayrona: Foco Santa Marta / Colombia
  if (btnFilterUnimagdalenaPapers) {
    btnFilterUnimagdalenaPapers.addEventListener('click', () => {
      if (paperLiveSearchInput) {
        paperLiveSearchInput.value = 'Colombia';
        state.paperSearchQuery = 'colombia';
      }
      state.activePaperTopic = 'Colombia / LatAm';
      document.querySelectorAll('.paper-topic-pill').forEach(p => {
        p.classList.toggle('active', p.dataset.topic === 'Colombia / LatAm');
      });
      renderPapersList();
      showToast('🇨🇴 Mostrando literatura con autores y contexto de Colombia / Santa Marta');
    });
  }

  // Búsqueda en vivo local
  if (paperLiveSearchInput) {
    paperLiveSearchInput.addEventListener('input', (e) => {
      state.paperSearchQuery = e.target.value;
      renderPapersList();
    });
  }

  // Consulta en Vivo a la API oficial de OpenAlex (Intervalo 2010 - 2026)
  if (btnQueryOpenAlexLive) {
    btnQueryOpenAlexLive.addEventListener('click', async () => {
      const query = paperLiveSearchInput ? paperLiveSearchInput.value.trim() : '';
      const finalQuery = query || 'second life lithium ion battery BMS SoH estimation Colombia';

      btnQueryOpenAlexLive.disabled = true;
      btnQueryOpenAlexLive.innerHTML = '<span>⏳</span> Consultando OpenAlex API (2010-2026)...';

      try {
        const url = `https://api.openalex.org/works?search=${encodeURIComponent(finalQuery)}&filter=publication_year:2010-2026&per_page=20&sort=cited_by_count:desc&mailto=ivanmezaf@users.noreply.github.com`;
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

        const data = await resp.json();
        const results = data.results || [];
        let newCount = 0;

        results.forEach(item => {
          const title = (item.title || '').trim();
          if (!title) return;
          const doi = item.doi || '';

          // Verificar si ya existe
          const exists = state.papers.some(p => (doi && p.doi && p.doi.toLowerCase() === doi.toLowerCase()) || (p.title && p.title.toLowerCase() === title.toLowerCase()));
          if (!exists) {
            // Reconstruir abstract
            let abstractText = '';
            if (item.abstract_inverted_index) {
              const posWord = [];
              for (const [w, positions] of Object.entries(item.abstract_inverted_index)) {
                positions.forEach(pos => posWord.push({ pos, word: w }));
              }
              posWord.sort((a, b) => a.pos - b.pos);
              abstractText = posWord.map(x => x.word).join(' ');
            }

            const authors = (item.authorships || []).map(a => a.author ? a.author.display_name : '').filter(Boolean);
            const oa = item.open_access || {};
            const source = item.primary_location && item.primary_location.source ? item.primary_location.source.display_name : 'Revista Científica';

            // Detectar ámbito
            const corpus = (title + ' ' + abstractText + ' ' + source).toLowerCase();
            let scope = '🌐 Internacional';
            if (corpus.includes('colombia') || corpus.includes('santa marta') || corpus.includes('unal') || corpus.includes('uis') || corpus.includes('unimagdalena')) {
              scope = '🇨🇴 Colombia / Local';
            } else if (corpus.includes('latin america') || corpus.includes('latinoamerica') || corpus.includes('chile') || corpus.includes('mexico')) {
              scope = '🌎 Latinoamérica';
            }

            state.papers.unshift({
              source_api: 'OpenAlex (En vivo 2010-2026)',
              title: title,
              authors: authors.slice(0, 5),
              year: item.publication_year || new Date().getFullYear(),
              doi: doi,
              journal: source,
              citations: item.cited_by_count || 0,
              url: doi || item.id || '#',
              open_access_pdf: oa.oa_url || '',
              abstract: abstractText ? abstractText.substring(0, 650) + '...' : 'Resumen disponible en el enlace oficial.',
              is_oa: oa.is_oa || false,
              scope: scope,
              thesis_category: 'Consultas API'
            });
            newCount++;
          }
        });

        if (countAllPapersEl) countAllPapersEl.textContent = state.papers.length;
        renderPapersList();
        showToast(`OpenAlex API: ${newCount} nuevos artículos agregados (2010-2026)`);
      } catch (err) {
        console.error(err);
        showToast('Error al consultar OpenAlex: ' + err.message);
      } finally {
        btnQueryOpenAlexLive.disabled = false;
        btnQueryOpenAlexLive.innerHTML = '<span>⚡</span> Consultar OpenAlex en Vivo';
      }
    });
  }

  // ==========================================================
  // AUTO-SYNC EN SEGUNDO PLANO CADA VEZ QUE SE ENTRA A LA PÁGINA (2010-2026)
  // ==========================================================
  async function autoSyncOpenAlex() {
    const statusText = document.getElementById('autoSyncStatusText');
    if (statusText) statusText.textContent = 'Buscando novedades en OpenAlex (2010-2026)...';

    try {
      // Consulta polite pool con filtro ampliado a 2010-2026
      const queryTerms = 'second life lithium ion battery BMS SoH SoC fast charging';
      const url = `https://api.openalex.org/works?search=${encodeURIComponent(queryTerms)}&filter=publication_year:2010-2026&per_page=25&sort=publication_year:desc&mailto=ivanmezaf@users.noreply.github.com`;
      const resp = await fetch(url);
      if (!resp.ok) return;

      const data = await resp.json();
      const results = data.results || [];
      let newCount = 0;

      results.forEach(item => {
        const title = (item.title || '').trim();
        if (!title) return;
        const doi = item.doi || '';

        const exists = state.papers.some(p =>
          (doi && p.doi && p.doi.toLowerCase() === doi.toLowerCase()) ||
          (p.title && p.title.toLowerCase().trim() === title.toLowerCase().trim())
        );

        if (!exists) {
          let abstractText = '';
          if (item.abstract_inverted_index) {
            const posWord = [];
            for (const [w, positions] of Object.entries(item.abstract_inverted_index)) {
              positions.forEach(pos => posWord.push({ pos, word: w }));
            }
            posWord.sort((a, b) => a.pos - b.pos);
            abstractText = posWord.map(x => x.word).join(' ');
          }

          const authors = (item.authorships || []).map(a => a.author ? a.author.display_name : '').filter(Boolean);
          const oa = item.open_access || {};
          const source = item.primary_location && item.primary_location.source ? item.primary_location.source.display_name : 'Revista Científica';

          const corpus = (title + ' ' + abstractText + ' ' + source).toLowerCase();
          let scope = '🌐 Internacional';
          if (corpus.includes('colombia') || corpus.includes('santa marta') || corpus.includes('unal') || corpus.includes('uis') || corpus.includes('unimagdalena')) {
            scope = '🇨🇴 Colombia / Local';
          } else if (corpus.includes('latin america') || corpus.includes('latinoamerica') || corpus.includes('chile') || corpus.includes('mexico')) {
            scope = '🌎 Latinoamérica';
          }

          let cat = 'Segunda Vida';
          if (corpus.includes('soh') || corpus.includes('state of health') || corpus.includes('salud')) cat = 'SoH (Salud)';
          else if (corpus.includes('soc') || corpus.includes('state of charge')) cat = 'SoC (Carga)';
          else if (corpus.includes('bms') || corpus.includes('battery management')) cat = 'BMS Segunda Vida';
          else if (corpus.includes('fast charge') || corpus.includes('carga rápida')) cat = 'Carga Rápida';

          state.papers.unshift({
            source_api: 'OpenAlex (Auto-sync)',
            title: title,
            authors: authors.slice(0, 5),
            year: item.publication_year || new Date().getFullYear(),
            doi: doi,
            journal: source,
            citations: item.cited_by_count || 0,
            url: doi || item.id || '#',
            open_access_pdf: oa.oa_url || '',
            abstract: abstractText ? abstractText.substring(0, 650) + '...' : 'Resumen disponible en el enlace oficial.',
            is_oa: oa.is_oa || false,
            scope: scope,
            thesis_category: cat
          });
          newCount++;
        }
      });

      if (countAllPapersEl) countAllPapersEl.textContent = state.papers.length;
      renderPapersList();

      if (statusText) {
        statusText.textContent = newCount > 0 ? `Sincronizado: +${newCount} nuevos` : 'OpenAlex Sincronizado';
      }
    } catch (e) {
      console.warn('Auto-sync en segundo plano finalizado:', e);
      if (statusText) statusText.textContent = 'OpenAlex Activo';
    }
  }

  // Renderizar la lista de artículos
  function renderPapersList() {
    if (!papersContainer) return;

    const paperRatings = state.paperRatings || {};

    // 1. Calcular contadores de Semáforo / PRISMA
    let countAll = 0;
    let countGreen = 0;
    let countYellow = 0;
    let countRed = 0;
    let countNone = 0;

    state.papers.forEach(p => {
      const key = getPaperKey(p);
      const r = paperRatings[key];
      countAll++;
      if (r === 'green') countGreen++;
      else if (r === 'yellow') countYellow++;
      else if (r === 'red') countRed++;
      else countNone++;
    });

    if (countRatingAllEl) countRatingAllEl.textContent = countAll;
    if (countRatingGreenEl) countRatingGreenEl.textContent = countGreen;
    if (countRatingYellowEl) countRatingYellowEl.textContent = countYellow;
    if (countRatingRedEl) countRatingRedEl.textContent = countRed;
    if (countRatingNoneEl) countRatingNoneEl.textContent = countNone;

    let filtered = [...state.papers];

    // 2. Filtro por tema
    if (state.activePaperTopic !== 'all') {
      if (state.activePaperTopic === 'Colombia / LatAm') {
        filtered = filtered.filter(p => (p.scope && (p.scope.includes('Colombia') || p.scope.includes('Latinoamérica'))));
      } else {
        filtered = filtered.filter(p => p.thesis_category === state.activePaperTopic);
      }
    }

    // 3. Filtro por semáforo
    if (state.activeRatingFilter !== 'all') {
      filtered = filtered.filter(p => {
        const key = getPaperKey(p);
        const r = paperRatings[key] || '';
        if (state.activeRatingFilter === 'none') return !r;
        return r === state.activeRatingFilter;
      });
    }

    // 4. Filtro por texto
    if (state.paperSearchQuery.trim()) {
      const q = state.paperSearchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        (p.title || '').toLowerCase().includes(q) ||
        (p.abstract || '').toLowerCase().includes(q) ||
        (p.doi || '').toLowerCase().includes(q) ||
        (p.journal || '').toLowerCase().includes(q) ||
        (p.authors || []).some(a => a.toLowerCase().includes(q))
      );
    }

    if (filtered.length === 0) {
      papersContainer.innerHTML = `
        <div class="box-panel" style="text-align: center; padding: 40px 20px;">
          <h3 style="font-family: var(--font-serif); font-size: 1.25rem; margin-bottom: 6px;">No se encontraron artículos con los filtros actuales</h3>
          <p style="font-size: 0.86rem; color: var(--ink-soft); max-width: 440px; margin: 0 auto 16px;">
            Intenta cambiando el filtro de semáforo, el tema de tesis o presiona "Consultar OpenAlex en Vivo".
          </p>
        </div>
      `;
      return;
    }

    papersContainer.innerHTML = filtered.map((p, idx) => {
      let scopeClass = 'global';
      if (p.scope && p.scope.includes('Colombia')) scopeClass = 'colombia';
      else if (p.scope && p.scope.includes('Latinoamérica')) scopeClass = 'latam';

      const authorsStr = (p.authors && p.authors.length > 0) ? p.authors.join(', ') : 'Autores no especificados';
      const safeDoi = p.doi ? (p.doi.startsWith('http') ? p.doi : `https://doi.org/${p.doi}`) : (p.url || '#');

      const paperKey = getPaperKey(p);
      const currentRating = paperRatings[paperKey] || '';

      let ratingBadgeHtml = '';
      if (currentRating === 'green') {
        ratingBadgeHtml = `<span class="badge-rating green">🟢 Aprobado / Incluido</span>`;
      } else if (currentRating === 'yellow') {
        ratingBadgeHtml = `<span class="badge-rating yellow">🟡 En Revisión</span>`;
      } else if (currentRating === 'red') {
        ratingBadgeHtml = `<span class="badge-rating red">🔴 Descartado</span>`;
      }

      return `
        <article class="paper-card ${currentRating ? 'rated-' + currentRating : ''}">
          <div class="paper-top-meta">
            <div class="paper-badges-left">
              <span class="badge-scope ${scopeClass}">${p.scope || '🌐 Internacional'}</span>
              ${p.thesis_category ? `<span class="person">${escapeHtml(p.thesis_category)}</span>` : ''}
              <span class="badge-citations">Citas: ${p.citations || 0}</span>
              ${ratingBadgeHtml}
            </div>

            <!-- Semáforo de Clasificación Rápida a la derecha -->
            <div class="traffic-light-box" title="Semáforo de relevancia para la tesis">
              <span class="traffic-label">Semáforo:</span>
              <button type="button" class="traffic-dot dot-green ${currentRating === 'green' ? 'selected' : ''}" onclick="window.setPaperTrafficRating('${paperKey}', 'green')" title="🟢 Verde: Relevante / Aprobado (Incluir en tesis)"></button>
              <button type="button" class="traffic-dot dot-yellow ${currentRating === 'yellow' ? 'selected' : ''}" onclick="window.setPaperTrafficRating('${paperKey}', 'yellow')" title="🟡 Amarillo: En revisión / Duda metodológica"></button>
              <button type="button" class="traffic-dot dot-red ${currentRating === 'red' ? 'selected' : ''}" onclick="window.setPaperTrafficRating('${paperKey}', 'red')" title="🔴 Rojo: Descartado / Fuera de alcance"></button>
            </div>
          </div>

          <h3 class="paper-title">${escapeHtml(p.title)}</h3>

          <div class="paper-authors">
            <strong>Autores:</strong> ${escapeHtml(authorsStr)}
          </div>

          <div class="paper-journal-row">
            <span><strong>Publicado:</strong> ${p.year || 'N/D'}</span>
            <span>•</span>
            <span><strong>Revista:</strong> ${escapeHtml(p.journal || 'Publicación Científica')}</span>
            <span>•</span>
            <span style="color:var(--ink-soft); font-size:0.75rem;">Fuente: ${p.source_api || 'API Oficial'}</span>
          </div>

          ${p.abstract ? `
            <div class="paper-abstract-box" id="abstract-box-${idx}">
              <div style="font-weight:700; font-size:0.78rem; text-transform:uppercase; margin-bottom:4px; color:var(--ink-soft);">Resumen / Abstract:</div>
              <div>${escapeHtml(p.abstract)}</div>
            </div>
          ` : ''}

          <div class="paper-actions-row">
            <a href="${safeDoi}" target="_blank" rel="noopener noreferrer" class="btn-paper-link" title="Enlace oficial verificado">
              <span>🔗</span> DOI Oficial
            </a>

            ${p.open_access_pdf ? `
              <a href="${p.open_access_pdf}" target="_blank" rel="noopener noreferrer" class="btn-paper-link btn-paper-oa" title="Descargar texto completo en Acceso Abierto">
                <span>📄</span> PDF Acceso Abierto
              </a>
            ` : ''}

            <button type="button" class="btn-paper-link" onclick="window.copyPaperBibtex(${idx})" title="Copiar referencia BibTeX">
              <span>📋</span> Copiar BibTeX
            </button>
          </div>
        </article>
      `;
    }).join('');
  }

  // Copiar BibTeX individual
  window.copyPaperBibtex = function(index) {
    const p = state.papers[index];
    if (!p) return;
    const authors = p.authors || ['Autor'];
    const firstAuthor = (authors[0] || 'Autor').split(' ').pop().replace(/[^\w]/g, '');
    const year = p.year || '2024';
    const citeKey = `${firstAuthor}${year}`;

    const bib = `@article{${citeKey},
  title = {{${p.title}}},
  author = {${authors.join(' and ')}},
  journal = {${p.journal || 'Revista Científica'}},
  year = {${year}},
  doi = {${(p.doi || '').replace('https://doi.org/', '')}},
  url = {${p.url || ''}}
}`;

    navigator.clipboard.writeText(bib).then(() => {
      showToast(`Referencia BibTeX de "${firstAuthor}" copiada`);
    }).catch(() => {
      prompt('Copia tu referencia BibTeX:', bib);
    });
  };

  // Descargar todas las referencias en archivo .bib
  if (btnDownloadBibtex) {
    btnDownloadBibtex.addEventListener('click', () => {
      let bibContent = '% Referencias Bibliográficas Generadas por ForoMagma\n% Tesis: Baterías de Ion de Litio, Segunda Vida y BMS\n\n';
      state.papers.forEach(p => {
        const authors = p.authors || ['Autor'];
        const firstAuthor = (authors[0] || 'Autor').split(' ').pop().replace(/[^\w]/g, '');
        const year = p.year || '2024';
        const citeKey = `${firstAuthor}${year}_${Math.abs(hashString(p.title || '')) % 1000}`;

        bibContent += `@article{${citeKey},\n`;
        bibContent += `  title = {{${p.title}}},\n`;
        bibContent += `  author = {${authors.join(' and ')}},\n`;
        bibContent += `  journal = {${p.journal || 'Revista Científica'}},\n`;
        bibContent += `  year = {${year}},\n`;
        if (p.doi) bibContent += `  doi = {${p.doi.replace('https://doi.org/', '')}},\n`;
        if (p.url) bibContent += `  url = {${p.url}},\n`;
        bibContent += `}\n\n`;
      });

      const blob = new Blob([bibContent], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'referencias_tesis_baterias.bib';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showToast('Descargando archivo referencias_tesis_baterias.bib');
    });
  }

  // Descargar todas las referencias en archivo .md
  if (btnDownloadMarkdown) {
    btnDownloadMarkdown.addEventListener('click', () => {
      let mdContent = `# 📚 Literatura Científica: Baterías de Ion de Litio (Segunda Vida, BMS, SoH, SoC)\n\n`;
      mdContent += `- Total de publicaciones verificadas: ${state.papers.length}\n`;
      mdContent += `- Generado en ForoMagma (Santa Marta, Colombia)\n\n---\n\n`;

      state.papers.forEach((p, i) => {
        mdContent += `### ${i + 1}. ${p.title}\n\n`;
        mdContent += `- **Autores:** ${(p.authors || []).join(', ')}\n`;
        mdContent += `- **Año:** ${p.year || 'N/D'} | **Revista:** ${p.journal || 'N/D'}\n`;
        mdContent += `- **Ámbito:** ${p.scope || 'Global'} | **Citas:** ${p.citations || 0}\n`;
        mdContent += `- **DOI Oficial:** ${p.url || p.doi || 'N/D'}\n`;
        if (p.open_access_pdf) mdContent += `- **PDF Acceso Abierto:** ${p.open_access_pdf}\n`;
        if (p.abstract) mdContent += `\n> **Resumen:** ${p.abstract}\n`;
        mdContent += `\n---\n\n`;
      });

      const blob = new Blob([mdContent], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'literatura_tesis_baterias.md';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showToast('Descargando reporte literatura_tesis_baterias.md');
    });
  }

  function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  // Render inicial de papers
  renderPapersList();

  // Auto-activación de búsqueda y sincronización académica al entrar a la página
  autoSyncOpenAlex();

  // ==========================================================
  // INICIALIZACIÓN CON FIREBASE EN TIEMPO REAL
  // ==========================================================
  await StorageManager.init(
    // 1. Callback cuando se actualiza el Foro
    (livePosts) => {
      state.posts = livePosts;
      renderPosts();
      renderLinksSidebar();
      flashSyncIndicator();
    },
    // 2. Callback cuando se actualiza el Tablero Kanban
    (liveCards) => {
      state.kanbanCards = liveCards;
      renderKanbanBoard();
      flashSyncIndicator();
    },
    // 3. Callback cuando se actualiza el Semáforo de Clasificación (Verde/Amarillo/Rojo)
    (livePaperRatings, liveLinkRatings) => {
      state.paperRatings = livePaperRatings || {};
      state.linkRatings = liveLinkRatings || {};
      renderPapersList();
      renderLinksSidebar();
      flashSyncIndicator();
    }
  );
});

