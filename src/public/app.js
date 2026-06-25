'use strict';

/* ─────────────────────────────────────────────────────────────────
   auto-blog-gen — Frontend Shell (M6)
   ───────────────────────────────────────────────────────────────── */

/* ──────────────── Toast ──────────────── */
function toast(msg, kind = 'info', ms = 2400) {
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  el.textContent = msg;
  document.getElementById('toastContainer').appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 250); }, ms);
}

/* ──────────────── Theme ──────────────── */
(function initTheme() {
  const saved = localStorage.getItem('theme');
  if (saved) document.documentElement.setAttribute('data-theme', saved);
  document.getElementById('themeToggle').addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-theme');
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    document.getElementById('themeToggle').textContent = next === 'dark' ? '☀️' : '🌙';
  });
  // Init icon
  document.getElementById('themeToggle').textContent =
    (document.documentElement.getAttribute('data-theme') === 'dark') ? '☀️' : '🌙';
})();

/* ──────────────── Mobile menu ──────────────── */
(function initMobileMenu() {
  const sb = document.getElementById('sidebar');
  const ov = document.getElementById('sidebarOverlay');
  document.getElementById('menuToggle').addEventListener('click', () => {
    sb.classList.add('open'); ov.classList.add('open');
  });
  ov.addEventListener('click', () => { sb.classList.remove('open'); ov.classList.remove('open'); });
})();

/* ──────────────── Router ──────────────── */
const ROUTES = {
  '/dashboard':   { title: '대시보드',     render: renderDashboard },
  '/discovery':   { title: '키워드 발굴',   render: renderDiscovery },
  '/write':       { title: '작성',         render: renderWrite },
  '/inbox':       { title: '검수 대기함',   render: renderInbox },
  '/calendar':    { title: '발행 캘린더',   render: renderCalendar },
  '/performance': { title: '성과',         render: renderPerformance },
  '/revenue':     { title: '수익 관리',    render: renderRevenue },
  '/sponsors':    { title: '협찬 보드',    render: renderSponsors },
  '/settings':    { title: '설정',         render: renderSettings },
};

function currentRoute() {
  const h = window.location.hash.replace(/^#/, '') || '/dashboard';
  return ROUTES[h] ? h : '/dashboard';
}

function navigate(path) { window.location.hash = path; }

function updateNavActive(route) {
  document.querySelectorAll('.nav-item, .mobile-tab').forEach(el => {
    el.classList.toggle('active', el.dataset.route === route);
  });
}

function attachNav() {
  document.querySelectorAll('[data-route]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      navigate(el.dataset.route);
      // close mobile sidebar
      document.getElementById('sidebar').classList.remove('open');
      document.getElementById('sidebarOverlay').classList.remove('open');
    });
  });
}

function renderRoute() {
  const route = currentRoute();
  const def = ROUTES[route];
  document.getElementById('topbarTitle').textContent = def.title;
  const root = document.getElementById('viewRoot');
  root.innerHTML = '';
  updateNavActive(route);
  try {
    def.render(root);
  } catch (err) {
    root.innerHTML = `<div class="empty-state">
      <div class="empty-state-icon">⚠️</div>
      <div class="empty-state-title">화면 렌더 실패</div>
      <div class="empty-state-desc">${err.message}</div>
    </div>`;
  }
}

window.addEventListener('hashchange', renderRoute);
attachNav();
renderRoute();

/* ──────────────── Helpers ──────────────── */
function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
    else if (v !== null && v !== undefined) node.setAttribute(k, v);
  }
  for (const c of children) {
    if (c == null) continue;
    if (typeof c === 'string') node.appendChild(document.createTextNode(c));
    else node.appendChild(c);
  }
  return node;
}

function fmtKrw(n) { return '₩' + (n || 0).toLocaleString('ko-KR'); }
function fmtInt(n) { return (n || 0).toLocaleString('ko-KR'); }

/* ═════════════════════════════════════════════════════════════════
   VIEW: Dashboard (M1.3) — stub data, real wiring in M5
   ═════════════════════════════════════════════════════════════════ */
async function renderDashboard(root) {
  // Real data from /api/dashboard (M5) — falls back gracefully if empty.
  const monthGoal = 1000000;

  const hero = el('div', { class: 'revenue-hero' },
    el('div', { class: 'revenue-hero-label' }, '최근 30일 수익'),
    el('div', { class: 'revenue-hero-amount' }, '...'),
    el('div', { class: 'revenue-hero-delta' }, '목표 ' + fmtKrw(monthGoal)),
    el('div', { class: 'revenue-hero-progress' },
      el('div', { class: 'revenue-hero-progress-bar', style: { width: '0%' } })
    ),
    el('div', { class: 'revenue-hero-breakdown' }, '...')
  );

  const kpis = el('div', { class: 'kpi-grid' });
  const postsSlot = el('div');

  (async () => {
    try {
      const [dash, counts] = await Promise.all([
        fetch('/api/dashboard?days=30').then(r => r.json()),
        fetch('/api/posts/counts').then(r => r.json()),
      ]);

      const totalRev = dash.revenue?.total || 0;
      const pct = Math.min(100, Math.round((totalRev / monthGoal) * 100));
      const byCh = (dash.revenue?.byChannel || []).reduce((acc, c) => { acc[c.channel] = c.amount; return acc; }, {});
      hero.querySelector('.revenue-hero-amount').textContent = fmtKrw(totalRev);
      hero.querySelector('.revenue-hero-delta').textContent =
        `목표 ${fmtKrw(monthGoal)} (${pct}%)  ·  방문 ${fmtInt(dash.visits?.visitors)}회`;
      hero.querySelector('.revenue-hero-progress-bar').style.width = pct + '%';
      hero.querySelector('.revenue-hero-breakdown').textContent =
        `애드포스트 ${fmtKrw(byCh.adpost || 0)} · 쿠팡 ${fmtKrw(byCh.coupang || 0)}`;

      kpis.innerHTML = '';
      kpis.appendChild(kpiCard('✍️ 초안', counts.draft + '건', '검수 대기'));
      kpis.appendChild(kpiCard('📅 예약', counts.scheduled + '건', '자동 발행 대기'));
      kpis.appendChild(kpiCard('⚠️ 부진 글', dash.slumping.length + '건', '14일+ 노출 100 미만'));
      kpis.appendChild(kpiCard('🎯 발행 완료', counts.published + '건', '누적'));

      const rows = (dash.topPosts || []).map((p, i) =>
        el('tr', { onclick: () => { sessionStorage.setItem('loadPostId', p.id); navigate('/write'); }, style: { cursor: 'pointer' } },
          el('td', {}, String(i + 1)),
          el('td', {}, p.title || '(제목 없음)'),
          el('td', { class: 'num' }, fmtInt(p.visitors)),
          el('td', { class: 'num' }, fmtKrw(p.revenueKrw))
        )
      );
      const tbl = el('table', { class: 'list-table' },
        el('thead', {}, el('tr', {},
          el('th', {}, '#'), el('th', {}, '제목'),
          el('th', { class: 'num' }, '방문'), el('th', { class: 'num' }, '수익')
        )),
        el('tbody', {}, ...rows)
      );
      postsSlot.innerHTML = '';
      const section = el('section', { class: 'card' },
        el('div', { class: 'flex items-center justify-between', style: { marginBottom: 'var(--space-3)' } },
          el('h2', { class: 'card-title', style: { margin: 0 } }, '📈 최근 글 성과 (30일)'),
          el('button', { class: 'btn btn-ghost btn-sm', onclick: () => navigate('/performance') }, '전체 보기 →')
        ),
        rows.length ? tbl : el('div', { class: 'muted text-sm' }, '발행된 글이 없습니다.')
      );
      postsSlot.appendChild(section);
    } catch (err) {
      hero.querySelector('.revenue-hero-amount').textContent = fmtKrw(0);
      postsSlot.appendChild(el('div', { class: 'muted text-sm' }, '대시보드 로딩 실패: ' + err.message));
    }
  })();

  // ── Golden keywords (real data, top 3 from /api/keywords/recommend)
  const kwGrid = el('div', { class: 'keyword-cards' });
  const kwSection = el('section', { class: 'card' },
    el('div', { class: 'flex items-center justify-between', style: { marginBottom: 'var(--space-4)' } },
      el('h2', { class: 'card-title', style: { margin: 0 } }, '🔥 오늘의 황금 키워드'),
      el('button', { class: 'btn btn-ghost btn-sm', onclick: () => navigate('/discovery') }, '전체 보기 →')
    ),
    kwGrid
  );
  (async () => {
    try {
      const res = await fetch('/api/keywords/recommend?limit=3');
      const data = await res.json();
      if (data.length) {
        data.forEach(kw => kwGrid.appendChild(realKwCard(kw)));
      } else {
        kwGrid.appendChild(el('div', { class: 'muted text-sm' }, '키워드를 수집하는 중입니다.'));
      }
    } catch (err) {
      kwGrid.appendChild(el('div', { class: 'muted text-sm' }, '키워드를 불러오지 못했습니다.'));
    }
  })();

  // ── Compose
  const grid = el('div', { class: 'dashboard-grid' }, hero, kpis, kwSection, postsSlot);
  root.appendChild(grid);

  // FAB
  attachFab(root, '⊕', () => navigate('/write'), '새 글 작성');
}

function kpiCard(label, value, delta) {
  return el('div', { class: 'kpi-card' },
    el('div', { class: 'kpi-label' }, label),
    el('div', { class: 'kpi-value' }, value),
    el('div', { class: 'kpi-delta muted' }, delta)
  );
}

function kwCard(kw) {
  return el('div', { class: 'kw-card' },
    el('div', { class: 'kw-head' },
      el('div', { class: 'kw-term' }, kw.term),
      el('div', { class: 'kw-score' }, '★ ' + kw.score)
    ),
    el('div', { class: 'kw-stats' },
      el('div', {}, el('div', { class: 'kw-stat-label' }, '검색량'), el('div', { class: 'kw-stat-value' }, fmtInt(kw.search))),
      el('div', {}, el('div', { class: 'kw-stat-label' }, '경쟁'),   el('div', { class: 'kw-stat-value' }, kw.comp)),
      el('div', {}, el('div', { class: 'kw-stat-label' }, 'CPC'),    el('div', { class: 'kw-stat-value' }, fmtKrw(kw.cpc))),
      el('div', {}, el('div', { class: 'kw-stat-label' }, '쿠팡'),   el('div', { class: 'kw-stat-value' }, '💰 ' + kw.coupang + '개'))
    ),
    el('div', { class: 'kw-actions' },
      el('button', { class: 'btn btn-primary btn-sm', onclick: () => { sessionStorage.setItem('seedKeyword', kw.term); navigate('/write'); } }, '이걸로 쓰기 →'),
      el('button', { class: 'btn btn-secondary btn-sm', onclick: () => toast('북마크 기능은 M2에서 활성화됩니다', 'info') }, '☆')
    )
  );
}

function attachFab(root, icon, onClick, title) {
  const fab = el('button', { class: 'fab', title, onclick: onClick }, icon);
  root.parentElement.appendChild(fab);
  // cleanup on next navigation
  window.addEventListener('hashchange', () => fab.remove(), { once: true });
}

/* ═════════════════════════════════════════════════════════════════
   VIEW: Write (M1.4) — 3-panel using existing transcribe/generate API
   ═════════════════════════════════════════════════════════════════ */
function renderWrite(root) {
  const seed = sessionStorage.getItem('seedKeyword');
  const seedCat = sessionStorage.getItem('seedCategory');
  sessionStorage.removeItem('seedKeyword');
  sessionStorage.removeItem('seedCategory');

  const tags = seed ? [seed] : [];

  if (seed) {
    const banner = el('div', { class: 'card', style: { marginBottom: 'var(--space-4)', borderColor: 'var(--primary-500)', background: 'var(--primary-50)' } },
      el('div', { class: 'flex items-center justify-between gap-3', style: { flexWrap: 'wrap' } },
        el('div', {},
          el('div', { class: 'text-xs', style: { color: 'var(--primary-600)' } }, '🎯 키워드 컨텍스트 주입됨'),
          el('div', { class: 'font-semibold' }, seed),
          seedCat ? el('div', { class: 'text-xs muted' }, '카테고리 · ' + seedCat) : null
        ),
        el('button', { class: 'btn btn-ghost btn-sm', onclick: () => navigate('/discovery') }, '다른 키워드 보기 →')
      )
    );
    root.appendChild(banner);
  }

  // ── DOM
  const left = el('section', { class: 'write-panel' });
  const center = el('section', { class: 'write-panel' });
  const right = el('section', { class: 'write-panel' });

  const grid = el('div', { class: 'write-grid' }, left, center, right);
  root.appendChild(grid);

  // ── LEFT: Inputs
  left.appendChild(el('h3', {}, '입력'));

  // Target keywords
  const kwLabel = el('div', { class: 'field-label' }, '🎯 타겟 키워드');
  const kwChips = el('div', { class: 'flex gap-2', style: { flexWrap: 'wrap' } });
  function rebuildChips() {
    kwChips.innerHTML = '';
    tags.forEach((t, i) => {
      kwChips.appendChild(el('span', { class: 'chip' },
        t,
        el('button', { style: { marginLeft: '4px' }, onclick: () => { tags.splice(i, 1); rebuildChips(); } }, '×')
      ));
    });
    const inp = el('input', {
      class: 'input',
      placeholder: '키워드 추가 후 Enter',
      style: { width: 'auto', flex: '1', minWidth: '120px' },
      onkeydown: (e) => {
        if (e.key === 'Enter' && e.target.value.trim()) {
          tags.push(e.target.value.trim());
          rebuildChips();
        }
      }
    });
    kwChips.appendChild(inp);
  }
  rebuildChips();
  left.appendChild(el('div', { class: 'field' }, kwLabel, kwChips));

  // Voice
  const recordBtn = el('button', { class: 'btn btn-danger' }, '● 녹음 시작');
  const stopBtn = el('button', { class: 'btn btn-secondary', disabled: 'true' }, '■ 정지');
  const recordStatus = el('span', { class: 'text-xs muted' });
  const transcriptBox = el('div', { class: 'transcript-box', contenteditable: 'true', placeholder: '음성을 변환한 텍스트가 여기에 표시됩니다. 직접 수정도 가능합니다.' });
  left.appendChild(el('div', { class: 'field' },
    el('div', { class: 'field-label' }, '🎤 음성 입력'),
    el('div', { class: 'flex gap-2 items-center' }, recordBtn, stopBtn, recordStatus),
    transcriptBox
  ));

  // Images
  const dropZone = el('div', { class: 'drop-zone' }, '사진을 드래그하거나 클릭하여 업로드');
  const imageInput = el('input', { type: 'file', accept: 'image/*', multiple: 'true', hidden: 'true' });
  const imagePreviews = el('div', { class: 'image-previews' });
  left.appendChild(el('div', { class: 'field' },
    el('div', { class: 'field-label' }, '🖼️ 사진 첨부'),
    dropZone, imageInput, imagePreviews
  ));

  // Memo
  const memoInput = el('textarea', { class: 'textarea', placeholder: '짧은 메모나 추가 정보 (선택)' });
  left.appendChild(el('div', { class: 'field' },
    el('div', { class: 'field-label' }, '📝 추가 메모'),
    memoInput
  ));

  // Length preset
  const lengthSelect = el('select', { class: 'select' },
    el('option', { value: 'info' },     '정보형 (~1500자)'),
    el('option', { value: 'review', selected: 'true' }, '후기형 (~800자)'),
    el('option', { value: 'catalog' },  '카탈로그형 (~2000자)')
  );
  left.appendChild(el('div', { class: 'field' },
    el('div', { class: 'field-label' }, '🎨 길이 프리셋'),
    lengthSelect
  ));

  // Disclosure
  const disclosureSelect = el('select', { class: 'select' },
    el('option', { value: 'none' },         '공시 표기 없음'),
    el('option', { value: 'self_purchase' },'내돈내산'),
    el('option', { value: 'sponsored' },    '협찬')
  );
  left.appendChild(el('div', { class: 'field' },
    el('div', { class: 'field-label' }, '🏷️ 공시'),
    disclosureSelect
  ));

  // Generate
  const generateBtn = el('button', { class: 'btn btn-primary btn-lg' }, '✨ 포스팅 생성');
  left.appendChild(generateBtn);

  // ── CENTER: Preview
  center.appendChild(el('h3', {}, '미리보기'));
  const titleInput = el('div', { class: 'preview-title', contenteditable: 'true', placeholder: '포스팅 제목을 입력하세요' });
  if (seed) titleInput.textContent = seed + ' 관련 포스팅';
  const previewContent = el('div', { class: 'preview-content' });
  const previewActions = el('div', { class: 'flex items-center gap-2', style: { marginTop: 'var(--space-3)', flexWrap: 'wrap' } },
    el('button', { class: 'btn btn-secondary btn-sm', id: 'editToggle' }, '✏️ 편집'),
    el('input', { class: 'input', id: 'tagsInput', placeholder: '태그 (쉼표로 구분)', style: { flex: '1', minWidth: '160px' } }),
    el('button', { class: 'btn btn-ghost', id: 'saveDraftBtn' }, '💾 임시저장'),
    el('button', { class: 'btn btn-secondary', id: 'scheduleBtn' }, '📅 예약 발행'),
    el('button', { class: 'btn btn-success', id: 'publishBtn' }, '📤 즉시 발행')
  );
  const publishResult = el('div', { class: 'mt-3', style: { display: 'none' } });
  center.appendChild(titleInput);
  center.appendChild(previewContent);
  center.appendChild(previewActions);
  center.appendChild(publishResult);

  // ── RIGHT: Insights
  right.appendChild(el('h3', {}, '인사이트'));

  // ── SEO score block (live, recomputes on demand)
  const seoBlock = el('div', { class: 'insight-block' });
  const seoBody = el('div', { class: 'mt-2 text-sm muted' }, '본문 생성 후 자동 채점됩니다.');
  seoBlock.appendChild(el('div', { class: 'flex items-center justify-between' },
    el('div', { class: 'insight-block-title' }, '📊 SEO 점수'),
    el('button', { class: 'btn btn-ghost btn-sm', id: 'seoRefreshBtn' }, '↻')
  ));
  seoBlock.appendChild(seoBody);

  const trendBlock = el('div', { class: 'insight-block' },
    el('div', { class: 'insight-block-title' }, '📈 트렌드 분석'),
    el('button', { class: 'btn btn-secondary btn-sm', id: 'trendBtn' }, '분석 실행')
  );
  const trendResult = el('div', { class: 'text-sm', style: { display: 'none' } });
  trendBlock.appendChild(trendResult);

  // ── Coupang recommended-products block
  const couponBlock = el('div', { class: 'insight-block' });
  couponBlock.appendChild(el('div', { class: 'flex items-center justify-between' },
    el('div', { class: 'insight-block-title' }, '💰 쿠팡 추천 상품'),
    el('button', { class: 'btn btn-secondary btn-sm', id: 'matchBtn' }, '매칭 실행')
  ));
  const couponBody = el('div', { class: 'mt-2 text-sm muted' }, '본문 생성 후 매칭 실행을 누르세요.');
  couponBlock.appendChild(couponBody);

  const usageBlock = el('div', { class: 'insight-block', id: 'usageBlock', style: { display: 'none' } });

  right.appendChild(seoBlock);
  right.appendChild(trendBlock);
  right.appendChild(couponBlock);
  right.appendChild(usageBlock);

  /* ── Wire existing recording / generation / publish logic ── */
  let mediaRecorder = null;
  let audioChunks = [];
  let isRecording = false;
  let uploadedImages = [];
  let generatedContent = '';
  let isEditMode = false;

  recordBtn.addEventListener('click', async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunks = [];
      mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorder.ondataavailable = e => { if (e.data.size > 0) audioChunks.push(e.data); };
      mediaRecorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        transcribeAudio(new Blob(audioChunks, { type: 'audio/webm' }));
      };
      mediaRecorder.start(250);
      isRecording = true;
      recordBtn.disabled = true;
      stopBtn.disabled = false;
      recordStatus.textContent = '🔴 녹음 중...';
    } catch (err) {
      toast('마이크 권한이 필요합니다', 'error');
    }
  });

  stopBtn.addEventListener('click', () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      isRecording = false;
      recordBtn.disabled = false;
      stopBtn.disabled = true;
      recordStatus.textContent = '⏳ 변환 중...';
    }
  });

  async function transcribeAudio(blob) {
    const formData = new FormData();
    formData.append('audio', blob, 'recording.webm');
    try {
      const res = await fetch('/api/transcribe', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      transcriptBox.textContent = data.text;
      recordStatus.textContent = '✅ 변환 완료';
    } catch (err) {
      recordStatus.textContent = '❌ 변환 실패';
      toast('음성 변환 실패: ' + err.message, 'error');
    }
  }

  dropZone.addEventListener('click', () => imageInput.click());
  dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    addImages([...e.dataTransfer.files]);
  });
  imageInput.addEventListener('change', () => { addImages([...imageInput.files]); imageInput.value = ''; });

  async function addImages(files) {
    for (const file of files) {
      if (!file.type.startsWith('image/')) continue;
      const [dataUrl, buffer] = await Promise.all([
        readFileAs(file, 'dataUrl'),
        readFileAs(file, 'buffer'),
      ]);
      uploadedImages.push({ file, buffer, dataUrl, mimeType: file.type });
    }
    rebuildImagePreviews();
  }

  function rebuildImagePreviews() {
    imagePreviews.innerHTML = '';
    uploadedImages.forEach((img, i) => {
      const div = document.createElement('div');
      div.className = 'image-preview';
      div.innerHTML = `
        <img src="${img.dataUrl}" alt="사진${i + 1}" />
        <button class="remove-btn" data-i="${i}">×</button>
        <span class="order-badge">${i + 1}</span>`;
      imagePreviews.appendChild(div);
    });
    if (uploadedImages.length > 0 && window.Sortable) {
      Sortable.create(imagePreviews, {
        animation: 150, ghostClass: 'sortable-ghost',
        onEnd: (evt) => {
          if (evt.oldIndex === evt.newIndex) return;
          const moved = uploadedImages.splice(evt.oldIndex, 1)[0];
          uploadedImages.splice(evt.newIndex, 0, moved);
          rebuildImagePreviews();
        },
      });
    }
    imagePreviews.querySelectorAll('.remove-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        uploadedImages.splice(Number(btn.dataset.i), 1);
        rebuildImagePreviews();
      });
    });
  }

  function readFileAs(file, type) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.onerror = reject;
      type === 'dataUrl' ? reader.readAsDataURL(file) : reader.readAsArrayBuffer(file);
    });
  }

  generateBtn.addEventListener('click', async () => {
    const transcript = transcriptBox.textContent.trim();
    const memo = memoInput.value.trim();
    if (!transcript && uploadedImages.length === 0 && !memo) {
      toast('음성·사진·메모 중 하나 이상을 입력해주세요', 'error');
      return;
    }
    generateBtn.disabled = true;
    generateBtn.innerHTML = '<span class="spinner"></span> 생성 중...';
    previewContent.innerHTML = '';
    previewContent.classList.add('streaming-cursor');
    generatedContent = '';
    isEditMode = false;
    previewContent.contentEditable = 'false';
    document.getElementById('editToggle').textContent = '✏️ 편집';

    const formData = new FormData();
    formData.append('transcript', transcript);
    formData.append('memo', memo);
    formData.append('aiProvider', document.getElementById('aiProvider').value);
    if (seed) formData.append('seedKeyword', seed);
    const secondaries = tags.filter(t => t !== seed);
    if (secondaries.length) formData.append('secondaryKeywords', secondaries.join(','));
    formData.append('lengthPreset', lengthSelect.value);
    formData.append('disclosureKind', disclosureSelect.value);
    formData.append('hasCoupang', String(hasCoupangLinks()));
    uploadedImages.forEach(img =>
      formData.append('images', new Blob([img.buffer], { type: img.mimeType }), img.file.name)
    );

    try {
      const res = await fetch('/api/generate', { method: 'POST', body: formData });
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop();
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.error) {
              previewContent.innerHTML = `<p style="color:var(--danger)">오류: ${data.error}</p>`;
              break;
            }
            if (data.chunk) {
              generatedContent += data.chunk;
              previewContent.innerHTML = generatedContent;
              previewContent.scrollTop = previewContent.scrollHeight;
            }
            if (data.done) {
              previewContent.classList.remove('streaming-cursor');
              showUsage(data.usage, data.provider);
              const h2 = previewContent.querySelector('h2');
              if (h2 && !titleInput.textContent.trim()) titleInput.textContent = h2.textContent;
              refreshSeo();
            }
          } catch (_) {}
        }
      }
    } catch (err) {
      previewContent.innerHTML = `<p style="color:var(--danger)">오류: ${err.message}</p>`;
      previewContent.classList.remove('streaming-cursor');
    } finally {
      generateBtn.disabled = false;
      generateBtn.innerHTML = '✨ 포스팅 생성';
    }
  });

  function hasCoupangLinks() {
    const html = isEditMode ? previewContent.innerHTML : generatedContent;
    return /coupang\.com|partners\.coupang\.com/.test(html);
  }

  async function refreshSeo() {
    const title = titleInput.textContent.trim();
    const content = isEditMode ? previewContent.innerHTML : generatedContent;
    if (!title && !content) return;
    seoBody.innerHTML = '<span class="muted">채점 중...</span>';
    const tagsArr = document.getElementById('tagsInput').value.split(',').map(t => t.trim()).filter(Boolean);
    try {
      const res = await fetch('/api/seo/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title, content,
          primaryKeyword: seed || tags[0] || '',
          tags: tagsArr,
          disclosureKind: disclosureSelect.value,
          hasCoupangLinks: hasCoupangLinks(),
        }),
      });
      const data = await res.json();
      renderSeo(data);
    } catch (err) {
      seoBody.innerHTML = `<span style="color:var(--danger)">${err.message}</span>`;
    }
  }

  function renderSeo(data) {
    const color = data.total >= 80 ? 'var(--success)' : data.total >= 60 ? 'var(--warning)' : 'var(--danger)';
    const items = data.items.map(it => {
      const ok = it.got >= it.max ? '✅' : it.got >= it.max * 0.6 ? '🟡' : '⚪';
      return `<li style="display:flex;justify-content:space-between;font-size:12px;padding:4px 0;border-bottom:1px solid var(--border)">
        <span>${ok} ${it.label}</span><span class="muted">${it.got}/${it.max}</span></li>`;
    }).join('');
    const flags = (data.flags || []).map(f => {
      const c = f.severity === 'danger' ? 'badge-danger' : 'badge-warning';
      return `<div class="badge ${c}" style="margin:2px 4px 2px 0">⚠️ ${f.message}</div>`;
    }).join('');
    const advice = (data.advice || []).map(a => `<li style="font-size:12px">${a}</li>`).join('');
    seoBody.innerHTML = `
      <div style="display:flex;align-items:baseline;gap:8px;margin:6px 0 10px;">
        <span style="font-size:28px;font-weight:800;color:${color}">${data.total}</span>
        <span class="muted text-sm">/100</span>
      </div>
      ${flags ? `<div style="margin-bottom:10px">${flags}</div>` : ''}
      ${data.disclosure && data.disclosure.missing ? `<div class="badge badge-danger" style="margin-bottom:10px">⚠️ 공시 누락: ${data.disclosure.kind}</div>` : ''}
      <details style="margin-bottom:8px"><summary class="text-xs muted" style="cursor:pointer">항목별 보기</summary>
        <ul style="list-style:none;padding:0;margin-top:6px">${items}</ul>
      </details>
      ${advice ? `<div class="text-xs muted">💡 권장</div><ul style="margin-top:4px;padding-left:18px">${advice}</ul>` : ''}
    `;
  }

  document.getElementById('seoRefreshBtn').addEventListener('click', refreshSeo);

  // ── Coupang product matching
  document.getElementById('matchBtn').addEventListener('click', async () => {
    const title = titleInput.textContent.trim();
    const content = isEditMode ? previewContent.innerHTML : generatedContent;
    if (!title && !content) {
      toast('먼저 포스팅을 생성해주세요', 'error');
      return;
    }
    const btn = document.getElementById('matchBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner dark"></span> 매칭 중...';
    couponBody.innerHTML = '<span class="muted">분석 중...</span>';
    try {
      const res = await fetch('/api/coupang/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content, seedKeyword: seed, max: 5 }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      renderCoupang(data);
    } catch (err) {
      couponBody.innerHTML = `<span style="color:var(--danger)">${err.message}</span>`;
    } finally {
      btn.disabled = false;
      btn.textContent = '매칭 실행';
    }
  });

  function renderCoupang(data) {
    if (!data.products || !data.products.length) {
      couponBody.innerHTML = '<span class="muted">매칭된 상품이 없습니다.</span>';
      return;
    }
    const credBadge = data.hasApiCreds
      ? '<span class="badge badge-success">파트너스 API 활성</span>'
      : '<span class="badge badge-warning">검색 URL 폴백</span>';
    const queries = data.queries.map(q => `<span class="chip sm">${q}</span>`).join(' ');
    const cards = data.products.map((p, i) => {
      const price = p.price ? `₩${Number(p.price).toLocaleString('ko-KR')}` : '';
      return `<div style="border:1px solid var(--border);border-radius:10px;padding:10px;margin-bottom:8px;display:flex;gap:10px;align-items:center;">
        ${p.productImage ? `<img src="${p.productImage}" style="width:48px;height:48px;border-radius:6px;object-fit:cover" />` : '<div style="width:48px;height:48px;background:var(--surface-alt);border-radius:6px;display:grid;place-items:center;font-size:18px">🛒</div>'}
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${p.name}</div>
          <div style="font-size:11px" class="muted">${price}${p._fallback ? ' · 폴백 검색' : ''}</div>
        </div>
        <button class="btn btn-secondary btn-sm" data-idx="${i}">📌 본문 삽입</button>
      </div>`;
    }).join('');
    couponBody.innerHTML = `
      <div class="text-xs muted">${credBadge} · 쿼리: ${queries}</div>
      <div class="mt-3">${cards}</div>
    `;
    couponBody.querySelectorAll('button[data-idx]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const idx = +btn.dataset.idx;
        const p = data.products[idx];
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner dark"></span>';
        try {
          const r = await fetch('/api/coupang/deeplink', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productUrl: p.productUrl, product: p }),
          });
          const dl = await r.json();
          if (dl.error) throw new Error(dl.error);
          insertAtCursor(dl.html || `<a href="${dl.url}" target="_blank" rel="nofollow sponsored">${p.name}</a>`);
          toast('상품 카드 삽입됨', 'success');
          refreshSeo();
        } catch (err) {
          toast(err.message, 'error');
        } finally {
          btn.disabled = false;
          btn.innerHTML = '📌 본문 삽입';
        }
      });
    });
  }

  function insertAtCursor(html) {
    if (!isEditMode) {
      isEditMode = true;
      previewContent.contentEditable = 'true';
      previewContent.classList.add('edit-mode');
      document.getElementById('editToggle').textContent = '✅ 완료';
    }
    previewContent.focus();
    const sel = window.getSelection();
    if (sel.rangeCount && previewContent.contains(sel.anchorNode)) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      const frag = document.createRange().createContextualFragment(html);
      range.insertNode(frag);
    } else {
      previewContent.insertAdjacentHTML('beforeend', html);
    }
    generatedContent = previewContent.innerHTML;
  }

  function showUsage(usage, provider) {
    if (!usage) return;
    const model = provider === 'claude' ? 'Claude' : 'GPT-4o';
    usageBlock.innerHTML = `
      <div class="insight-block-title">💸 사용량 / 비용</div>
      <div class="text-sm">${model}</div>
      <div class="text-xs muted">입력 ${usage.input_tokens.toLocaleString()} · 출력 ${usage.output_tokens.toLocaleString()} 토큰</div>
      <div class="text-sm font-semibold mt-2">$${usage.cost_usd.toFixed(4)}</div>`;
    usageBlock.style.display = 'block';
  }

  // Edit toggle
  document.getElementById('editToggle').addEventListener('click', (e) => {
    isEditMode = !isEditMode;
    previewContent.contentEditable = isEditMode ? 'true' : 'false';
    previewContent.classList.toggle('edit-mode', isEditMode);
    e.target.textContent = isEditMode ? '✅ 완료' : '✏️ 편집';
    if (!isEditMode) generatedContent = previewContent.innerHTML;
  });

  // Trend
  document.getElementById('trendBtn').addEventListener('click', async () => {
    const title = titleInput.textContent.trim();
    if (!title && !generatedContent) {
      toast('먼저 포스팅을 생성해주세요', 'error');
      return;
    }
    const btn = document.getElementById('trendBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner dark"></span> 분석 중...';
    trendResult.style.display = 'block';
    trendResult.innerHTML = '<div class="muted text-sm">분석 중...</div>';
    try {
      const res = await fetch('/api/trends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content: generatedContent }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const tagsHtml = (data.suggestedTags || []).map(t => `<span class="chip">${t}</span>`).join('');
      trendResult.innerHTML = `
        <div class="mt-3"><strong class="text-xs muted">추천 제목</strong>
          <div class="text-sm mt-2">${data.suggestedTitle || '-'}</div>
          <button class="btn btn-secondary btn-sm mt-2" id="applyTitle">제목에 적용</button>
        </div>
        <div class="mt-3"><strong class="text-xs muted">추천 태그</strong>
          <div class="mt-2 flex gap-2" style="flex-wrap:wrap">${tagsHtml}</div>
          <button class="btn btn-secondary btn-sm mt-2" id="applyTags">태그에 적용</button>
        </div>`;
      document.getElementById('applyTitle').onclick = () => { titleInput.textContent = data.suggestedTitle; };
      document.getElementById('applyTags').onclick = () => {
        document.getElementById('tagsInput').value = (data.suggestedTags || []).join(', ');
      };
    } catch (err) {
      trendResult.innerHTML = `<div style="color:var(--danger);font-size:13px">${err.message}</div>`;
    } finally {
      btn.disabled = false;
      btn.textContent = '분석 실행';
    }
  });

  // ── Local state for the post being edited (persists draft/schedule/publish)
  let currentPostId = sessionStorage.getItem('loadPostId') || null;
  sessionStorage.removeItem('loadPostId');

  // If we loaded an existing post from inbox, fetch and populate
  if (currentPostId) {
    fetch('/api/posts/' + currentPostId).then(r => r.json()).then(p => {
      if (p?.id) {
        titleInput.textContent = p.title || '';
        previewContent.innerHTML = p.contentHtml || '';
        generatedContent = p.contentHtml || '';
        document.getElementById('tagsInput').value = (p.tags || []).join(', ');
        toast('초안을 불러왔습니다', 'info');
      }
    }).catch(() => {});
  }

  function readPostFromUI() {
    const title = titleInput.textContent.trim() || '블로그 포스팅';
    const content = isEditMode ? previewContent.innerHTML : generatedContent;
    const tagsArr = document.getElementById('tagsInput').value.split(',').map(t => t.trim()).filter(Boolean);
    return { title, content, tags: tagsArr };
  }

  async function upsertPost(extra = {}) {
    const { title, content, tags: tagsArr } = readPostFromUI();
    const seoSnapshot = await fetchSeoSnapshot(title, content, tagsArr);
    const body = {
      title,
      contentHtml: content,
      tags: tagsArr,
      seoScore: seoSnapshot?.total ?? null,
      riskFlags: (seoSnapshot?.flags || []).map(f => f.code),
      disclosureKind: disclosureSelect.value,
      aiProvider: document.getElementById('aiProvider').value,
      ...extra,
    };
    let res;
    if (currentPostId) {
      res = await fetch('/api/posts/' + currentPostId, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } else {
      res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    }
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    currentPostId = data.id;
    return data;
  }

  async function fetchSeoSnapshot(title, content, tagsArr) {
    try {
      const r = await fetch('/api/seo/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title, content,
          primaryKeyword: seed || tagsArr[0] || '',
          tags: tagsArr,
          disclosureKind: disclosureSelect.value,
          hasCoupangLinks: hasCoupangLinks(),
        }),
      });
      return await r.json();
    } catch { return null; }
  }

  // ── Save draft
  document.getElementById('saveDraftBtn').addEventListener('click', async () => {
    const { content } = readPostFromUI();
    if (!content) { toast('내용이 비어 있습니다', 'error'); return; }
    const btn = document.getElementById('saveDraftBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner dark"></span>';
    try {
      const post = await upsertPost({ status: 'draft' });
      toast('💾 임시저장됨 · #' + post.id.slice(0, 6), 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '💾 임시저장';
    }
  });

  // ── Schedule
  document.getElementById('scheduleBtn').addEventListener('click', () => {
    const { content } = readPostFromUI();
    if (!content) { toast('내용이 비어 있습니다', 'error'); return; }

    const seedAt = sessionStorage.getItem('seedScheduledAt');
    sessionStorage.removeItem('seedScheduledAt');
    const init = seedAt ? new Date(seedAt) : (() => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      d.setHours(7, 0, 0, 0);
      return d;
    })();

    const overlay = el('div', { class: 'modal-overlay', onclick: (e) => { if (e.target === overlay) overlay.remove(); } });
    const dtInput = el('input', { class: 'input', type: 'datetime-local',
      value: toDatetimeLocal(init) });
    const goldenHints = el('div', { class: 'flex gap-2', style: { flexWrap: 'wrap' } },
      el('button', { class: 'btn btn-secondary btn-sm', onclick: () => setQuick(7, '내일 오전 7시') }, '🌅 내일 07:00'),
      el('button', { class: 'btn btn-secondary btn-sm', onclick: () => setQuick(21, '오늘 저녁 9시') }, '🌙 오늘 21:00'),
      el('button', { class: 'btn btn-secondary btn-sm', onclick: () => setQuickDay(7, 7) }, '7일 후 07:00'),
    );
    function setQuick(hour, label) {
      const d = new Date();
      if (hour <= d.getHours()) d.setDate(d.getDate() + 1);
      d.setHours(hour, 0, 0, 0);
      dtInput.value = toDatetimeLocal(d);
    }
    function setQuickDay(addDays, hour) {
      const d = new Date(); d.setDate(d.getDate() + addDays); d.setHours(hour, 0, 0, 0);
      dtInput.value = toDatetimeLocal(d);
    }
    const confirmBtn = el('button', { class: 'btn btn-primary' }, '📅 예약하기');
    const cancelBtn = el('button', { class: 'btn btn-ghost' }, '취소');
    const modal = el('div', { class: 'modal' },
      el('div', { class: 'modal-title' }, '📅 예약 발행'),
      el('div', { class: 'text-sm muted' }, '예약 시각이 도래하면 자동으로 네이버 블로그에 발행됩니다.'),
      goldenHints,
      el('div', { class: 'field' }, el('div', { class: 'field-label' }, '발행 일시'), dtInput),
      el('div', { class: 'flex gap-2 justify-between' }, cancelBtn, confirmBtn),
    );
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    cancelBtn.onclick = () => overlay.remove();
    confirmBtn.onclick = async () => {
      confirmBtn.disabled = true;
      confirmBtn.innerHTML = '<span class="spinner"></span> 예약 중...';
      try {
        const at = new Date(dtInput.value).toISOString();
        const post = await upsertPost({ status: 'scheduled', scheduledAt: at });
        toast('📅 예약 발행 등록됨 · ' + new Date(at).toLocaleString('ko-KR'), 'success');
        overlay.remove();
        publishResult.innerHTML = `<div class="toast info" style="position:static">📅 예약됨: ${new Date(at).toLocaleString('ko-KR')}</div>`;
        publishResult.style.display = 'block';
      } catch (err) {
        toast(err.message, 'error');
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = '📅 예약하기';
      }
    };
  });

  // ── Publish now
  document.getElementById('publishBtn').addEventListener('click', async () => {
    const { title, content, tags: tagsArr } = readPostFromUI();
    if (!content) { toast('내용이 없습니다', 'error'); return; }
    const btn = document.getElementById('publishBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> 업로드 중...';
    publishResult.style.display = 'none';

    const imagesPayload = uploadedImages.map((img, i) => ({
      data: arrayBufferToBase64(img.buffer),
      filename: img.file.name || `photo${i + 1}.jpg`,
      mimeType: img.mimeType,
    }));

    try {
      // Save snapshot to DB so it's tracked even if the publish call fails
      await upsertPost({ status: 'review' });

      const res = await fetch('/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content, tags: tagsArr, publish: true, images: imagesPayload }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      // Mark our local post as published
      await upsertPost({ status: 'published', publishedAt: new Date().toISOString(), naverPostId: data.postId });

      publishResult.innerHTML = `<div class="toast success" style="position:static">✅ 업로드 완료! (포스팅 ID: ${data.postId})</div>`;
      publishResult.style.display = 'block';
      toast('네이버 블로그 발행 완료 🎉', 'success');
    } catch (err) {
      publishResult.innerHTML = `<div class="toast error" style="position:static">❌ ${err.message}</div>`;
      publishResult.style.display = 'block';
      toast('발행 실패: ' + err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '📤 즉시 발행';
    }
  });
}

function toDatetimeLocal(d) {
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

/* ═════════════════════════════════════════════════════════════════
   VIEW: Discovery, Inbox, Calendar, Performance, Revenue, Sponsors (M1 placeholders)
   ═════════════════════════════════════════════════════════════════ */
function placeholder(root, icon, title, desc, mNote) {
  root.appendChild(el('div', { class: 'empty-state' },
    el('div', { class: 'empty-state-icon' }, icon),
    el('div', { class: 'empty-state-title' }, title),
    el('div', { class: 'empty-state-desc' }, desc),
    mNote ? el('div', { class: 'chip mt-3' }, mNote) : null
  ));
}

async function renderDiscovery(root) {
  // Filter bar
  const filter = el('div', { class: 'card flex items-center gap-3', style: { flexWrap: 'wrap' } });
  const catSelect = el('select', { class: 'select', style: { width: 'auto' } },
    el('option', { value: 'all' }, '전체 카테고리')
  );
  const limitInput = el('input', { class: 'input', type: 'number', value: '24', min: '6', max: '60', style: { width: '80px' } });
  const refreshBtn = el('button', { class: 'btn btn-secondary btn-sm' }, '🔄 새로고침');
  filter.appendChild(el('span', { class: 'text-xs muted' }, '카테고리'));
  filter.appendChild(catSelect);
  filter.appendChild(el('span', { class: 'text-xs muted' }, '개수'));
  filter.appendChild(limitInput);
  filter.appendChild(refreshBtn);
  root.appendChild(filter);

  const gridWrap = el('div', { style: { marginTop: 'var(--space-5)' } });
  root.appendChild(gridWrap);

  async function load() {
    gridWrap.innerHTML = '<div class="muted text-sm">불러오는 중...</div>';
    const params = new URLSearchParams();
    if (catSelect.value && catSelect.value !== 'all') params.set('category', catSelect.value);
    params.set('limit', limitInput.value || '24');
    try {
      const res = await fetch('/api/keywords/recommend?' + params.toString());
      const data = await res.json();
      if (!data.length) {
        gridWrap.innerHTML = '';
        gridWrap.appendChild(el('div', { class: 'empty-state' },
          el('div', { class: 'empty-state-icon' }, '🌱'),
          el('div', { class: 'empty-state-title' }, '키워드가 아직 없어요'),
          el('div', { class: 'empty-state-desc' }, '새로고침을 눌러 키워드 수집을 시작하거나, 설정에서 네이버 OpenAPI 키를 등록하세요.'),
        ));
        return;
      }
      // Populate category options (once per load)
      const cats = [...new Set(data.map(k => k.category).filter(Boolean))];
      while (catSelect.options.length > 1) catSelect.remove(1);
      cats.forEach(c => catSelect.appendChild(el('option', { value: c }, c)));

      const grid = el('div', { class: 'keyword-cards' });
      data.forEach(kw => grid.appendChild(realKwCard(kw)));
      gridWrap.innerHTML = '';
      gridWrap.appendChild(grid);
    } catch (err) {
      gridWrap.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div>
        <div class="empty-state-title">불러오기 실패</div>
        <div class="empty-state-desc">${err.message}</div></div>`;
    }
  }

  catSelect.addEventListener('change', load);
  refreshBtn.addEventListener('click', async () => {
    refreshBtn.disabled = true;
    refreshBtn.innerHTML = '<span class="spinner dark"></span> 새로고침';
    try {
      const r = await fetch('/api/keywords/refresh', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      await r.json();
      toast('새로고침 작업을 큐에 넣었습니다 (서버 배경 처리)', 'info');
      await load();
    } catch (err) {
      toast('실패: ' + err.message, 'error');
    } finally {
      refreshBtn.disabled = false;
      refreshBtn.textContent = '🔄 새로고침';
    }
  });

  await load();
}

function realKwCard(kw) {
  const s = kw.signals || {};
  const compLabel = s.competitionRatio == null ? '— '
    : s.competitionRatio < 0.5 ? '🟢 낮음'
    : s.competitionRatio < 1.5 ? '🟡 중간' : '🔴 높음';
  const growthLabel = s.trendGrowth4w == null ? '—'
    : s.trendGrowth4w > 1.15 ? `↑ +${Math.round((s.trendGrowth4w - 1) * 100)}%`
    : s.trendGrowth4w < 0.85 ? `↓ -${Math.round((1 - s.trendGrowth4w) * 100)}%`
    : '→ 보합';

  return el('div', { class: 'kw-card' },
    el('div', { class: 'kw-head' },
      el('div', {},
        el('div', { class: 'kw-term' }, kw.term),
        kw.category ? el('span', { class: 'chip', style: { marginTop: '4px' } }, kw.category) : null
      ),
      el('div', { class: 'kw-score' }, '★ ' + (kw.score ?? '—'))
    ),
    el('div', { class: 'kw-stats' },
      el('div', {}, el('div', { class: 'kw-stat-label' }, '검색량'),
        el('div', { class: 'kw-stat-value' }, fmtInt(s.monthlySearch))),
      el('div', {}, el('div', { class: 'kw-stat-label' }, '경쟁'),
        el('div', { class: 'kw-stat-value' }, compLabel)),
      el('div', {}, el('div', { class: 'kw-stat-label' }, '트렌드'),
        el('div', { class: 'kw-stat-value' }, growthLabel)),
      el('div', {}, el('div', { class: 'kw-stat-label' }, '쿠팡'),
        el('div', { class: 'kw-stat-value' }, '💰 ' + (s.coupangMatches || 0)))
    ),
    el('div', { class: 'kw-actions' },
      el('button', {
        class: 'btn btn-primary btn-sm',
        onclick: () => {
          sessionStorage.setItem('seedKeyword', kw.term);
          sessionStorage.setItem('seedCategory', kw.category || '');
          navigate('/write');
        }
      }, '이걸로 쓰기 →'),
      el('button', {
        class: 'btn btn-secondary btn-sm',
        title: '북마크 (로그인 필요)',
        onclick: async (e) => {
          try {
            const r = await fetch(`/api/keywords/${kw.id}/bookmark`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ state: 'saved' }),
            });
            const data = await r.json();
            if (data.error) throw new Error(data.error);
            e.target.textContent = '★';
            toast('북마크 저장됨', 'success');
          } catch (err) {
            toast(err.message, 'error');
          }
        }
      }, '☆')
    )
  );
}
async function renderInbox(root) {
  const COLS = [
    { key: 'draft',     label: '초안 (Draft)' },
    { key: 'review',    label: '검수 중 (Review)' },
    { key: 'scheduled', label: '예약 (Scheduled)' },
    { key: 'published', label: '발행됨 (Published)' },
  ];
  const board = el('div', { class: 'kanban' });
  COLS.forEach(c => {
    const head = el('div', { class: 'kanban-col-head' },
      el('span', {}, c.label),
      el('span', { class: 'kanban-col-count', id: 'cnt-' + c.key }, '...')
    );
    const list = el('div', { class: 'flex-col gap-2', id: 'col-' + c.key });
    board.appendChild(el('div', { class: 'kanban-col' }, head, list));
  });
  root.appendChild(board);

  try {
    const [counts, posts] = await Promise.all([
      fetch('/api/posts/counts').then(r => r.json()),
      fetch('/api/posts?limit=200').then(r => r.json()),
    ]);
    COLS.forEach(c => {
      document.getElementById('cnt-' + c.key).textContent = (counts[c.key] || 0) + '건';
    });
    const grouped = {};
    COLS.forEach(c => grouped[c.key] = []);
    posts.forEach(p => { if (grouped[p.status]) grouped[p.status].push(p); });
    COLS.forEach(c => {
      const col = document.getElementById('col-' + c.key);
      const items = grouped[c.key];
      if (!items.length) {
        col.appendChild(el('div', { class: 'text-xs muted', style: { padding: '8px 4px' } }, '비어 있음'));
        return;
      }
      items.forEach(p => col.appendChild(inboxCard(p)));
    });
  } catch (err) {
    root.appendChild(el('div', { class: 'muted text-sm mt-3' }, '불러오기 실패: ' + err.message));
  }

  attachFab(root, '⊕', () => navigate('/write'), '새 글 작성');
}

function inboxCard(p) {
  const when = p.scheduledAt || p.publishedAt || p.updatedAt;
  const score = (p.seoScore != null)
    ? el('span', { class: 'badge ' + (p.seoScore >= 80 ? 'badge-success' : p.seoScore >= 60 ? 'badge-warning' : 'badge-danger') }, 'SEO ' + p.seoScore)
    : null;
  const card = el('div', { class: 'kanban-card', onclick: () => openInboxPost(p.id) },
    el('div', { class: 'kanban-card-title' }, p.title || '(제목 없음)'),
    el('div', { class: 'kanban-card-meta' },
      el('span', {}, fmtDateShort(when)),
      score
    ),
    p.preview ? el('div', { class: 'kanban-card-preview' }, p.preview) : null
  );
  return card;
}

function openInboxPost(id) {
  sessionStorage.setItem('loadPostId', id);
  navigate('/write');
}

function fmtDateShort(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

async function renderCalendar(root) {
  const state = { cursor: new Date() };
  state.cursor.setDate(1);

  const toolbar = el('div', { class: 'cal-toolbar' });
  const monthLabel = el('h2', { class: 'topbar-title' });
  const prev = el('button', { class: 'btn btn-secondary btn-sm' }, '◀');
  const next = el('button', { class: 'btn btn-secondary btn-sm' }, '▶');
  const today = el('button', { class: 'btn btn-ghost btn-sm' }, '오늘');
  toolbar.appendChild(el('div', { class: 'flex items-center gap-2' }, prev, monthLabel, next, today));
  toolbar.appendChild(el('div', { class: 'text-xs muted' }, '🎯 골든타임: 오전 7–9시 · 저녁 9–11시'));
  root.appendChild(toolbar);

  const grid = el('div', { class: 'cal-grid' });
  root.appendChild(grid);

  async function render() {
    const y = state.cursor.getFullYear();
    const m = state.cursor.getMonth();
    monthLabel.textContent = `${y}년 ${m + 1}월`;
    const first = new Date(y, m, 1);
    const startWeekday = first.getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const fromIso = new Date(y, m, 1 - startWeekday).toISOString();
    const toIso = new Date(y, m, daysInMonth + (6 - new Date(y, m, daysInMonth).getDay()) + 1).toISOString();

    let items = [];
    try {
      items = await fetch(`/api/calendar?from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}`).then(r => r.json());
    } catch {}
    const byDate = new Map();
    items.forEach(it => {
      const k = it.at ? it.at.slice(0, 10) : null;
      if (!k) return;
      if (!byDate.has(k)) byDate.set(k, []);
      byDate.get(k).push(it);
    });

    grid.innerHTML = '';
    ['일','월','화','수','목','금','토'].forEach(d => grid.appendChild(el('div', { class: 'cal-dow' }, d)));

    const totalCells = Math.ceil((startWeekday + daysInMonth) / 7) * 7;
    const todayKey = new Date().toISOString().slice(0, 10);
    for (let i = 0; i < totalCells; i++) {
      const dayNum = i - startWeekday + 1;
      const cellDate = new Date(y, m, dayNum);
      const k = cellDate.toISOString().slice(0, 10);
      const otherMonth = dayNum < 1 || dayNum > daysInMonth;
      const cell = el('div', {
        class: 'cal-cell' + (otherMonth ? ' other-month' : '') + (k === todayKey ? ' today' : ''),
        onclick: () => promptCreateOnDate(cellDate),
      },
        el('div', { class: 'cal-day' }, String(cellDate.getDate()))
      );
      const itemsForDay = byDate.get(k) || [];
      itemsForDay.slice(0, 4).forEach(it => {
        const time = new Date(it.at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
        cell.appendChild(el('div', {
          class: 'cal-item ' + (it.status === 'published' ? 'published' : it.status === 'failed' ? 'failed' : ''),
          onclick: (e) => { e.stopPropagation(); openInboxPost(it.id); },
        }, `${time} ${it.title || '(제목 없음)'}`));
      });
      if (itemsForDay.length > 4) {
        cell.appendChild(el('div', { class: 'text-xs muted' }, `+${itemsForDay.length - 4}건`));
      }
      grid.appendChild(cell);
    }
  }

  prev.addEventListener('click', () => { state.cursor.setMonth(state.cursor.getMonth() - 1); render(); });
  next.addEventListener('click', () => { state.cursor.setMonth(state.cursor.getMonth() + 1); render(); });
  today.addEventListener('click', () => { state.cursor = new Date(); state.cursor.setDate(1); render(); });
  render();
}

function promptCreateOnDate(date) {
  const ymd = date.toLocaleDateString('ko-KR');
  if (!confirm(`${ymd}에 새 글을 작성하시겠어요?`)) return;
  const at = new Date(date);
  at.setHours(7, 0, 0, 0); // suggest golden-hour
  sessionStorage.setItem('seedScheduledAt', at.toISOString());
  navigate('/write');
}
async function renderPerformance(root) {
  // Filter bar
  const filter = el('div', { class: 'card flex items-center gap-3', style: { flexWrap: 'wrap' } });
  const daysSelect = el('select', { class: 'select', style: { width: 'auto' } },
    el('option', { value: '7' }, '최근 7일'),
    el('option', { value: '30', selected: 'true' }, '최근 30일'),
    el('option', { value: '90' }, '최근 90일')
  );
  filter.appendChild(el('span', { class: 'text-xs muted' }, '기간'));
  filter.appendChild(daysSelect);
  root.appendChild(filter);

  const body = el('div', { class: 'dashboard-grid', style: { marginTop: 'var(--space-5)' } });
  root.appendChild(body);

  async function load() {
    body.innerHTML = '<div class="muted text-sm">불러오는 중...</div>';
    try {
      const data = await fetch('/api/performance?days=' + daysSelect.value).then(r => r.json());

      // KPI grid
      const v = data.visits.totals;
      const kpis = el('div', { class: 'kpi-grid' });
      kpis.appendChild(kpiCard('👤 방문자', fmtInt(v.visitors), `최근 ${data.days}일`));
      kpis.appendChild(kpiCard('👁 노출(조회)', fmtInt(v.views), '누적'));
      kpis.appendChild(kpiCard('❤️ 공감', fmtInt(v.likes), ''));
      kpis.appendChild(kpiCard('💬 댓글', fmtInt(v.comments), ''));

      // Sparkline of daily visitors
      const daily = data.visits.daily || [];
      const spark = renderSparkline(daily.map(d => d.visitors));
      const sparkCard = el('section', { class: 'card' },
        el('h2', { class: 'card-title' }, '📈 일별 방문 추이'),
        spark
      );

      // Top posts ranking
      const revById = new Map((data.revenuePerPost || []).map(p => [p.id, p]));
      const rows = data.topPosts.map((p, i) => {
        const rev = revById.get(p.id);
        return el('tr', { onclick: () => { sessionStorage.setItem('loadPostId', p.id); navigate('/write'); }, style: { cursor: 'pointer' } },
          el('td', {}, String(i + 1)),
          el('td', {}, p.title || '(제목 없음)'),
          el('td', { class: 'num' }, fmtInt(p.visitors)),
          el('td', { class: 'num' }, fmtInt(p.views)),
          el('td', { class: 'num' }, p.bestRank ? '#' + p.bestRank : '—'),
          el('td', { class: 'num' }, fmtKrw(rev?.amountKrw || 0))
        );
      });
      const rankCard = el('section', { class: 'card' },
        el('h2', { class: 'card-title' }, '🏆 글 성과 랭킹'),
        rows.length
          ? el('table', { class: 'list-table' },
              el('thead', {}, el('tr', {},
                el('th', {}, '#'), el('th', {}, '제목'),
                el('th', { class: 'num' }, '방문'),
                el('th', { class: 'num' }, '노출'),
                el('th', { class: 'num' }, '최고 순위'),
                el('th', { class: 'num' }, '수익')
              )),
              el('tbody', {}, ...rows))
          : el('div', { class: 'muted text-sm' }, '데이터가 없습니다.')
      );

      // Slump alerts
      const slump = data.slumping || [];
      const slumpCard = el('section', { class: 'card', style: { borderColor: slump.length ? 'var(--warning)' : 'var(--border)' } },
        el('h2', { class: 'card-title' }, '⚠️ 부진 글 알림 (발행 14일+ 노출 100 미만)'),
        slump.length
          ? el('div', { class: 'flex-col gap-2' },
              ...slump.map(p => el('div', { class: 'flex items-center justify-between' },
                el('span', { class: 'text-sm' }, p.title || '(제목 없음)'),
                el('span', { class: 'badge badge-warning' }, `노출 ${fmtInt(p.visitors)}`)
              ))
            )
          : el('div', { class: 'muted text-sm' }, '부진 글이 없습니다.')
      );

      body.innerHTML = '';
      body.appendChild(kpis);
      body.appendChild(sparkCard);
      body.appendChild(rankCard);
      body.appendChild(slumpCard);
    } catch (err) {
      body.innerHTML = '<div class="muted text-sm">불러오기 실패: ' + err.message + '</div>';
    }
  }
  daysSelect.addEventListener('change', load);
  load();
}

function renderSparkline(values) {
  const W = 600, H = 64, PAD = 4;
  if (!values || values.length === 0) {
    return el('div', { class: 'muted text-sm' }, '데이터가 없습니다.');
  }
  const max = Math.max(...values, 1);
  const step = (W - PAD * 2) / Math.max(values.length - 1, 1);
  const pts = values.map((v, i) => [PAD + i * step, H - PAD - (v / max) * (H - PAD * 2)]);
  const linePath = pts.map((p, i) => (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
  const areaPath = linePath + ` L${(W - PAD).toFixed(1)},${H - PAD} L${PAD},${H - PAD} Z`;
  const svg = `<svg class="sparkline" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
    <path class="sparkline-fill" d="${areaPath}" />
    <path class="sparkline-line" d="${linePath}" />
  </svg>`;
  const wrap = document.createElement('div');
  wrap.innerHTML = svg;
  return wrap;
}

async function renderRevenue(root) {
  // Filter bar
  const filter = el('div', { class: 'card flex items-center gap-3', style: { flexWrap: 'wrap' } });
  const daysSelect = el('select', { class: 'select', style: { width: 'auto' } },
    el('option', { value: '7' }, '최근 7일'),
    el('option', { value: '30', selected: 'true' }, '최근 30일'),
    el('option', { value: '90' }, '최근 90일')
  );
  filter.appendChild(el('span', { class: 'text-xs muted' }, '기간'));
  filter.appendChild(daysSelect);
  root.appendChild(filter);

  const body = el('div', { class: 'dashboard-grid', style: { marginTop: 'var(--space-5)' } });
  root.appendChild(body);

  async function load() {
    body.innerHTML = '<div class="muted text-sm">불러오는 중...</div>';
    try {
      const data = await fetch('/api/revenue?days=' + daysSelect.value).then(r => r.json());
      const total = data.summary?.total || 0;
      const byChannel = data.summary?.byChannel || [];

      // Total + donut
      const channelTotals = byChannel.reduce((acc, c) => { acc[c.channel] = c.amount; return acc; }, {});
      const adpost = channelTotals.adpost || 0;
      const coupang = channelTotals.coupang || 0;
      const sponsor = channelTotals.sponsor || 0;
      const sumNonZero = adpost + coupang + sponsor || 1;
      const pctAd = Math.round((adpost / sumNonZero) * 100);
      const pctCp = Math.round((coupang / sumNonZero) * 100);
      const pctSp = 100 - pctAd - pctCp;

      const donut = el('div', { class: 'donut',
        style: { '--p': String(pctAd + pctCp), '--c': 'var(--accent-gold)' } },
        el('div', { class: 'donut-label' },
          el('div', { class: 'v' }, fmtKrw(total)),
          el('div', { class: 'l' }, `최근 ${data.days}일`)
        )
      );
      const summary = el('section', { class: 'card' },
        el('h2', { class: 'card-title' }, '💰 채널별 수익 분포'),
        el('div', { class: 'donut-wrap' },
          donut,
          el('div', { class: 'flex-col gap-2' },
            channelRow('애드포스트', adpost, pctAd, 'var(--primary-500)'),
            channelRow('쿠팡 파트너스', coupang, pctCp, 'var(--accent-gold)'),
            channelRow('협찬', sponsor, pctSp, 'var(--success)'),
          )
        )
      );

      // Affiliate link rankings
      const linkRows = (data.affiliateLinks || []).map(l => el('tr', {},
        el('td', {}, l.productName || '(상품 미상)'),
        el('td', {}, channelChip(l.channel)),
        el('td', { class: 'num' }, fmtInt(l.clicks)),
        el('td', { class: 'num' }, fmtInt(l.conversions)),
        el('td', { class: 'num' }, fmtKrw(l.amountKrw)),
        el('td', { class: 'num' }, l.postsUsing + '개')
      ));
      const linksCard = el('section', { class: 'card' },
        el('h2', { class: 'card-title' }, '🛒 베스트 제휴 상품'),
        linkRows.length
          ? el('table', { class: 'list-table' },
              el('thead', {}, el('tr', {},
                el('th', {}, '상품'), el('th', {}, '채널'),
                el('th', { class: 'num' }, '클릭'),
                el('th', { class: 'num' }, '전환'),
                el('th', { class: 'num' }, '수익'),
                el('th', { class: 'num' }, '글 수')
              )),
              el('tbody', {}, ...linkRows))
          : el('div', { class: 'muted text-sm' }, '제휴 링크가 없습니다.')
      );

      // Per-post revenue
      const postRows = (data.perPost || []).filter(p => p.amountKrw > 0).map((p, i) => el('tr', {
        onclick: () => { sessionStorage.setItem('loadPostId', p.id); navigate('/write'); },
        style: { cursor: 'pointer' },
      },
        el('td', {}, String(i + 1)),
        el('td', {}, p.title || '(제목 없음)'),
        el('td', { class: 'num' }, fmtInt(p.clicks)),
        el('td', { class: 'num' }, fmtInt(p.conversions)),
        el('td', { class: 'num' }, fmtKrw(p.amountKrw)),
      ));
      const postsCard = el('section', { class: 'card' },
        el('h2', { class: 'card-title' }, '📑 글별 수익'),
        postRows.length
          ? el('table', { class: 'list-table' },
              el('thead', {}, el('tr', {},
                el('th', {}, '#'), el('th', {}, '제목'),
                el('th', { class: 'num' }, '클릭'),
                el('th', { class: 'num' }, '전환'),
                el('th', { class: 'num' }, '수익')
              )),
              el('tbody', {}, ...postRows))
          : el('div', { class: 'muted text-sm' }, '수익이 발생한 글이 없습니다.')
      );

      // Favorites library
      const favs = data.favorites || [];
      const favCard = el('section', { class: 'card' },
        el('h2', { class: 'card-title' }, '⭐ 상품 라이브러리 (즐겨찾기)'),
        favs.length
          ? el('div', { class: 'flex gap-3', style: { flexWrap: 'wrap' } },
              ...favs.map(f => el('div', { class: 'card', style: { padding: '12px', width: '160px' } },
                el('div', { class: 'text-sm font-semibold' }, f.name),
                el('div', { class: 'text-xs muted' }, fmtKrw(f.price || 0)),
              )))
          : el('div', { class: 'muted text-sm' }, '즐겨찾기한 상품이 없습니다. 작성 화면에서 쿠팡 상품 카드의 ⭐를 누르면 여기에 모입니다.')
      );

      body.innerHTML = '';
      body.appendChild(summary);
      body.appendChild(linksCard);
      body.appendChild(postsCard);
      body.appendChild(favCard);
    } catch (err) {
      body.innerHTML = '<div class="muted text-sm">불러오기 실패: ' + err.message + '</div>';
    }
  }
  daysSelect.addEventListener('change', load);
  load();
}

function channelRow(label, amount, pct, color) {
  return el('div', { class: 'legend-row' },
    el('span', { class: 'legend-dot', style: { background: color } }),
    el('span', { style: { width: '120px' } }, label),
    el('span', { class: 'text-sm font-semibold' }, fmtKrw(amount)),
    el('span', { class: 'text-xs muted' }, `(${pct}%)`)
  );
}

function channelChip(ch) {
  const map = { coupang: '쿠팡', adpost: '애드포스트', sponsor: '협찬', ali: '알리' };
  return el('span', { class: 'chip' }, map[ch] || ch);
}
/* ═════════════════════════════════════════════════════════════════
   VIEW: Sponsors — 협찬 칸반 (M6)
   ═════════════════════════════════════════════════════════════════ */
const SPONSOR_COLS = [
  { id: 'proposed',  label: '📩 제안받음',   color: 'var(--text-muted)' },
  { id: 'accepted',  label: '✅ 수락',       color: 'var(--success)' },
  { id: 'writing',   label: '✍️ 작성중',     color: 'var(--primary-500)' },
  { id: 'published', label: '📤 발행됨',     color: 'var(--warning)' },
  { id: 'settled',   label: '💰 정산완료',   color: 'var(--success)' },
  { id: 'rejected',  label: '🚫 거절',       color: 'var(--danger)' },
];

async function renderSponsors(root) {
  const fab = el('button', { class: 'fab', title: '협찬 추가', onclick: () => openSponsorModal(null, refresh) }, '+');

  const board = el('div', { class: 'sponsor-board', id: 'sponsorBoard' });
  root.appendChild(el('div', { style: { position: 'relative' } }, board, fab));

  async function refresh() {
    board.innerHTML = '';
    let data = {};
    try {
      const r = await fetch('/api/sponsors');
      if (r.ok) data = await r.json();
    } catch {}

    SPONSOR_COLS.forEach(col => {
      const cards = data[col.id] || [];
      const header = el('div', { class: 'sponsor-col-header' },
        el('span', { style: { color: col.color } }, col.label),
        el('span', { class: 'sponsor-col-count' }, String(cards.length))
      );
      const cardList = el('div', { class: 'sponsor-cards', 'data-status': col.id });
      cards.forEach(s => cardList.appendChild(buildSponsorCard(s, refresh)));

      const colEl = el('div', { class: 'sponsor-col' }, header, cardList);
      board.appendChild(colEl);

      if (typeof Sortable !== 'undefined') {
        Sortable.create(cardList, {
          group: 'sponsors',
          animation: 150,
          ghostClass: 'sortable-ghost',
          dragClass: 'sortable-drag',
          onEnd(evt) {
            const id = evt.item.dataset.id;
            const newStatus = evt.to.dataset.status;
            if (!id || !newStatus) return;
            fetch(`/api/sponsors/${id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: newStatus }),
            }).then(() => refresh()).catch(() => toast('업데이트 실패', 'error'));
          },
        });
      }
    });
  }

  refresh();
}

function buildSponsorCard(s, refresh) {
  const card = el('div', { class: 'sponsor-card', 'data-id': s.id });
  card.appendChild(el('div', { class: 'sponsor-card-co' }, s.company));
  if (s.product_name) card.appendChild(el('div', { class: 'sponsor-card-product' }, s.product_name));
  if (s.budget_krw) card.appendChild(el('div', { class: 'sponsor-card-budget' }, fmtKrw(s.budget_krw)));
  if (s.due_at) {
    const daysLeft = Math.ceil((new Date(s.due_at) - new Date()) / 86400000);
    const cls = 'sponsor-card-due' + (daysLeft < 0 ? ' overdue' : '');
    card.appendChild(el('div', { class: cls }, daysLeft < 0 ? `마감 ${-daysLeft}일 초과` : `D-${daysLeft}`));
  }
  const actions = el('div', { class: 'sponsor-card-actions' });
  actions.appendChild(el('button', { class: 'btn btn-ghost btn-sm', onclick: () => openSponsorModal(s, refresh) }, '편집'));
  actions.appendChild(el('button', { class: 'btn btn-ghost btn-sm', onclick: async () => {
    if (!confirm('삭제하시겠습니까?')) return;
    await fetch(`/api/sponsors/${s.id}`, { method: 'DELETE' });
    refresh();
  }}, '삭제'));
  card.appendChild(actions);
  return card;
}

function openSponsorModal(existing, onDone) {
  const isEdit = !!existing;
  const modal = el('div', { class: 'modal-overlay', onclick: e => { if (e.target === modal) modal.remove(); } });
  const box = el('div', { class: 'modal' });
  box.appendChild(el('div', { class: 'modal-header' },
    el('h2', { class: 'modal-title' }, isEdit ? '협찬 편집' : '협찬 추가'),
    el('button', { class: 'btn-icon', onclick: () => modal.remove() }, '×')
  ));

  const form = el('div', { class: 'sponsor-form' });
  const fields = [
    { key: 'company', label: '브랜드/회사명 *', type: 'text', req: true },
    { key: 'contactEmail', label: '담당자 이메일', type: 'email' },
    { key: 'productName', label: '제품/서비스명', type: 'text' },
    { key: 'budgetKrw', label: '협찬 금액 (원)', type: 'number' },
    { key: 'receivedAt', label: '제안 받은 날짜', type: 'date' },
    { key: 'dueAt', label: '마감일', type: 'date' },
    { key: 'notes', label: '메모', type: 'textarea' },
  ];
  const inputs = {};
  fields.forEach(f => {
    const wrap = el('div', { class: 'field' },
      el('label', { class: 'field-label' }, f.label)
    );
    const inp = f.type === 'textarea'
      ? el('textarea', { class: 'input', rows: 3, style: { resize: 'vertical' } })
      : el('input', { class: 'input', type: f.type });
    if (existing) {
      const dbKey = { contactEmail: 'contact_email', productName: 'product_name',
                      budgetKrw: 'budget_krw', receivedAt: 'received_at', dueAt: 'due_at' }[f.key] || f.key;
      inp.value = existing[dbKey] || '';
    }
    inputs[f.key] = inp;
    wrap.appendChild(inp);
    form.appendChild(wrap);
  });

  const footer = el('div', { class: 'modal-footer' },
    el('button', { class: 'btn btn-ghost', onclick: () => modal.remove() }, '취소'),
    el('button', { class: 'btn btn-primary', onclick: async () => {
      const body = {};
      fields.forEach(f => { const v = inputs[f.key].value.trim(); if (v) body[f.key] = v; });
      if (!body.company) { toast('회사명을 입력하세요', 'error'); return; }
      const url = isEdit ? `/api/sponsors/${existing.id}` : '/api/sponsors';
      const method = isEdit ? 'PATCH' : 'POST';
      try {
        const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        if (!r.ok) throw new Error((await r.json()).error);
        modal.remove(); onDone();
        toast(isEdit ? '협찬 업데이트됨' : '협찬 추가됨', 'success');
      } catch (err) { toast(err.message, 'error'); }
    }}, isEdit ? '저장' : '추가')
  );

  box.appendChild(form);
  box.appendChild(footer);
  modal.appendChild(box);
  document.body.appendChild(modal);
  setTimeout(() => inputs.company.focus(), 50);
}

/* ═════════════════════════════════════════════════════════════════
   VIEW: Settings (M1.5) — tabs
   ═════════════════════════════════════════════════════════════════ */
function renderSettings(root) {
  const tabs = [
    { id: 'blog',     label: '블로그',     render: tabBlog },
    { id: 'channels', label: '수익 채널',  render: tabChannels },
    { id: 'ai',       label: 'AI',        render: tabAI },
    { id: 'notif',    label: '알림',       render: tabNotif },
    { id: 'usage',    label: '사용량·비용', render: tabUsage },
  ];

  const tabBar = el('div', { class: 'tabs' });
  const body = el('div');

  function activate(tabId) {
    [...tabBar.children].forEach(c => c.classList.toggle('active', c.dataset.tab === tabId));
    body.innerHTML = '';
    const def = tabs.find(t => t.id === tabId);
    def.render(body);
  }

  tabs.forEach(t => {
    const tabEl = el('div', { class: 'tab', 'data-tab': t.id, onclick: () => activate(t.id) }, t.label);
    tabBar.appendChild(tabEl);
  });

  root.appendChild(tabBar);
  root.appendChild(body);
  activate('blog');
}

function settingRow(label, desc, control) {
  return el('div', { class: 'setting-row' },
    el('div', {},
      el('div', { class: 'setting-row-label' }, label),
      desc ? el('div', { class: 'setting-row-desc' }, desc) : null
    ),
    control
  );
}

function tabBlog(body) {
  const card = el('div', { class: 'card' });
  card.appendChild(el('h2', { class: 'card-title' }, '📝 네이버 블로그 연결'));
  card.appendChild(settingRow('아이디', 'NAVER_USERNAME 환경변수',
    el('span', { class: 'badge badge-success' }, '연결됨 (env)')));
  card.appendChild(settingRow('블로그 ID', 'NAVER_BLOG_ID 환경변수',
    el('span', { class: 'badge badge-success' }, '연결됨 (env)')));
  card.appendChild(settingRow('API 비밀번호', '블로그 관리 > 글쓰기 API 설정',
    el('span', { class: 'badge badge-success' }, '연결됨 (env)')));
  card.appendChild(settingRow('과거 글 자동 임포트', 'XML-RPC getRecentPosts',
    el('span', { class: 'chip' }, 'M2에서 활성화')));
  card.appendChild(settingRow('다중 블로그', '메인/서브/주제별',
    el('span', { class: 'chip' }, 'M2에서 활성화')));
  body.appendChild(card);
}

async function tabChannels(body) {
  const card = el('div', { class: 'card' });
  card.appendChild(el('h2', { class: 'card-title' }, '💰 수익 채널'));

  const status = el('div', { class: 'text-xs muted', style: { marginBottom: '12px' } },
    '로그인 후 채널별 자격증명을 저장할 수 있습니다. (자격증명은 AES-256으로 암호화 저장)');
  card.appendChild(status);

  // Try to load existing channels (logged in)
  let connected = {};
  try {
    const token = localStorage.getItem('jwt');
    const res = await fetch('/api/channels', {
      headers: token ? { Authorization: 'Bearer ' + token } : {},
    });
    if (res.ok) {
      const list = await res.json();
      list.forEach(c => { connected[c.kind] = c; });
    } else if (res.status === 401) {
      status.textContent = '⚠️ 로그인 후 채널 등록이 가능합니다. (M3 단계에서는 환경변수도 함께 사용됩니다.)';
    }
  } catch {}

  card.appendChild(channelFormRow({
    kind: 'coupang',
    label: '🛒 쿠팡 파트너스',
    desc: '본문 자동 상품 매칭 + 단축링크',
    fields: [
      { name: 'accessKey', label: 'Access Key', type: 'text' },
      { name: 'secretKey', label: 'Secret Key', type: 'password' },
      { name: 'subId',     label: 'Sub ID (선택)', type: 'text' },
    ],
    existing: connected.coupang,
  }));

  card.appendChild(channelFormRow({
    kind: 'adpost',
    label: '📺 애드포스트',
    desc: '일별 수익 동기화 (M5에서 자동화)',
    fields: [
      { name: 'memberId', label: '회원 ID', type: 'text' },
    ],
    existing: connected.adpost,
  }));

  card.appendChild(settingRow('🤝 협찬 보드',
    '협찬 파이프라인 관리 (제안→수락→작성→발행→정산)',
    el('button', { class: 'btn btn-ghost btn-sm', onclick: () => navigate('/sponsors') }, '보드 열기 →')));
  card.appendChild(settingRow('💱 알리/아마존', '해외 제휴 채널',
    el('span', { class: 'chip' }, 'Post-MVP')));

  body.appendChild(card);
}

function channelFormRow({ kind, label, desc, fields, existing }) {
  const row = el('div', { class: 'setting-row', style: { alignItems: 'flex-start' } });
  const left = el('div', {},
    el('div', { class: 'setting-row-label' }, label),
    el('div', { class: 'setting-row-desc' }, desc),
    existing ? el('div', { class: 'badge badge-success mt-2' }, '연결됨') : null
  );
  const formWrap = el('div', { style: { minWidth: '280px' } });
  const inputs = {};
  fields.forEach(f => {
    const wrap = el('div', { class: 'field', style: { marginBottom: '6px' } },
      el('label', { class: 'field-label' }, f.label),
      el('input', {
        class: 'input', type: f.type, name: f.name,
        placeholder: existing?.credentials?.[f.name] || ''
      })
    );
    inputs[f.name] = wrap.querySelector('input');
    formWrap.appendChild(wrap);
  });
  const save = el('button', { class: 'btn btn-primary btn-sm' }, existing ? '업데이트' : '연결');
  formWrap.appendChild(save);
  save.addEventListener('click', async () => {
    const creds = {};
    for (const [k, inp] of Object.entries(inputs)) if (inp.value) creds[k] = inp.value;
    if (!Object.keys(creds).length) { toast('값을 입력해주세요', 'error'); return; }
    save.disabled = true;
    save.innerHTML = '<span class="spinner"></span>';
    try {
      const token = localStorage.getItem('jwt');
      const r = await fetch(`/api/channels/${kind}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: 'Bearer ' + token } : {}),
        },
        body: JSON.stringify(creds),
      });
      const d = await r.json();
      if (d.error) throw new Error(d.error);
      toast(label + ' 저장됨', 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      save.disabled = false;
      save.textContent = existing ? '업데이트' : '연결';
    }
  });
  row.appendChild(left);
  row.appendChild(formWrap);
  return row;
}

function tabAI(body) {
  const card = el('div', { class: 'card' });
  card.appendChild(el('h2', { class: 'card-title' }, '🤖 AI 모델'));
  card.appendChild(settingRow('기본 Provider', 'OPENAI_API_KEY / ANTHROPIC_API_KEY',
    el('select', { class: 'select', style: { width: 'auto' } },
      el('option', { value: 'openai' }, 'OpenAI GPT-4o'),
      el('option', { value: 'claude' }, 'Claude Opus')
    )));
  card.appendChild(settingRow('Whisper 언어', '음성 → 텍스트',
    el('select', { class: 'select', style: { width: 'auto' } },
      el('option', { value: 'ko', selected: 'true' }, '한국어'),
      el('option', { value: 'en' }, 'English')
    )));
  body.appendChild(card);
}

function tabNotif(body) {
  const card = el('div', { class: 'card' });
  card.appendChild(el('h2', { class: 'card-title' }, '🔔 알림'));
  card.appendChild(settingRow('발행 완료 Slack 알림', 'SLACK_WEBHOOK_URL',
    el('span', { class: 'badge badge-success' }, '환경변수로 설정')));
  card.appendChild(settingRow('인앱 알림', '발행·부진·키워드·협찬 마감 알림',
    el('span', { class: 'badge badge-success' }, 'M6 활성화')));
  card.appendChild(settingRow('일일 추천 다이제스트', '매일 아침 황금 키워드 메일',
    el('span', { class: 'chip' }, 'Post-MVP')));
  card.appendChild(settingRow('부진 글 자동 알림', '14일 노출 < 100',
    el('span', { class: 'badge badge-success' }, 'M5 활성화')));
  card.appendChild(settingRow('온보딩 투어 다시 보기', '첫 방문 가이드',
    el('button', { class: 'btn btn-ghost btn-sm', onclick: () => {
      localStorage.removeItem('onboarding_done');
      initOnboarding();
      toast('온보딩 투어를 시작합니다', 'info');
    }}, '다시 보기')));
  body.appendChild(card);
}

function tabUsage(body) {
  const card = el('div', { class: 'card' });
  card.appendChild(el('h2', { class: 'card-title' }, '📈 사용량 · 비용'));
  card.appendChild(settingRow('이번 달 토큰 사용', '실시간 누적',
    el('span', { class: 'muted text-sm' }, '집계 준비 중 (M2)')));
  card.appendChild(settingRow('월 비용 한도', '한도 초과 시 자동 모델 다운그레이드',
    el('input', { class: 'input', type: 'number', value: '20', style: { width: '100px' } })));
  body.appendChild(card);
}

/* ═════════════════════════════════════════════════════════════════
   M6: Notification Panel
   ═════════════════════════════════════════════════════════════════ */
const NOTIF_ICONS = {
  publish_done:    '📤',
  slump_alert:     '⚠️',
  keyword_refresh: '🔍',
  sponsor_due:     '🤝',
  default:         '🔔',
};

let _notifOpen = false;

async function initNotifications() {
  const btn = document.getElementById('notifBtn');
  const panel = document.getElementById('notifPanel');
  const badge = document.getElementById('notifBadge');
  const list  = document.getElementById('notifList');
  const readAll = document.getElementById('notifReadAll');

  async function loadNotifs() {
    try {
      const r = await fetch('/api/notifications');
      if (!r.ok) return;
      const { items, unread } = await r.json();
      badge.hidden = unread === 0;
      badge.textContent = unread > 9 ? '9+' : unread || '';
      list.innerHTML = '';
      if (!items.length) {
        list.appendChild(el('div', { class: 'notif-empty' }, '알림이 없습니다.'));
        return;
      }
      items.forEach(n => {
        const row = el('div', {
          class: 'notif-item' + (n.read_at ? '' : ' unread'),
          onclick: async () => {
            if (!n.read_at) {
              await fetch(`/api/notifications/${n.id}/read`, { method: 'POST' });
              row.classList.remove('unread');
              await loadNotifs();
            }
            if (n.link) { window.location.hash = n.link.replace(/^#/, ''); panel.hidden = true; _notifOpen = false; }
          },
        });
        row.appendChild(el('div', { class: 'notif-icon' }, NOTIF_ICONS[n.type] || NOTIF_ICONS.default));
        const body = el('div', {});
        body.appendChild(el('div', { class: 'notif-body-title' }, n.title));
        if (n.body) body.appendChild(el('div', { class: 'notif-body-desc' }, n.body));
        row.appendChild(body);
        list.appendChild(row);
      });
    } catch {}
  }

  readAll.addEventListener('click', async () => {
    await fetch('/api/notifications/read-all', { method: 'POST' });
    await loadNotifs();
  });

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    _notifOpen = !_notifOpen;
    panel.hidden = !_notifOpen;
    if (_notifOpen) loadNotifs();
  });

  document.addEventListener('click', (e) => {
    if (_notifOpen && !panel.contains(e.target)) {
      _notifOpen = false;
      panel.hidden = true;
    }
  });

  // Initial badge load
  loadNotifs();
  // Poll every 60s
  setInterval(loadNotifs, 60000);
}

/* ═════════════════════════════════════════════════════════════════
   M6: Onboarding tour
   ═════════════════════════════════════════════════════════════════ */
const ONBOARD_STEPS = [
  { icon: '🏠', title: '안녕하세요! 👋', desc: '블로그 자동화 수익 스튜디오에 오신 걸 환영합니다. 주요 기능을 빠르게 살펴볼게요.' },
  { icon: '🔍', title: '키워드 발굴', desc: 'AI가 매일 황금 키워드를 추천합니다. 경쟁이 낮고 검색량이 높은 키워드를 골라 바로 글쓰기로 연결하세요.' },
  { icon: '✍️', title: 'AI 블로그 생성', desc: '키워드를 선택하고 "작성" 버튼 하나로 SEO 최적화된 블로그 글이 자동 생성됩니다. 쿠팡 제휴 링크도 자동 삽입돼요.' },
  { icon: '💰', title: '수익 관리', desc: '애드포스트·쿠팡·협찬 수익을 한 곳에서 관리하세요. 글별 수익과 성과를 실시간으로 확인할 수 있어요.' },
  { icon: '🚀', title: '시작할 준비 완료!', desc: '대시보드에서 전체 현황을 확인하고, 키워드 발굴에서 첫 글을 시작해보세요!' },
];

function initOnboarding() {
  if (localStorage.getItem('onboarding_done')) return;
  const overlay = document.getElementById('onboardOverlay');
  const stepsEl = document.getElementById('onboardSteps');
  const dotsEl  = document.getElementById('onboardDots');
  const nextBtn  = document.getElementById('onboardNext');
  const skipBtn  = document.getElementById('onboardSkip');
  let cur = 0;

  function render() {
    stepsEl.innerHTML = '';
    dotsEl.innerHTML = '';
    const s = ONBOARD_STEPS[cur];
    stepsEl.appendChild(
      el('div', { class: 'onboard-step' },
        el('div', { class: 'onboard-step-icon' }, s.icon),
        el('div', { class: 'onboard-step-title' }, s.title),
        el('div', { class: 'onboard-step-desc' }, s.desc)
      )
    );
    ONBOARD_STEPS.forEach((_, i) =>
      dotsEl.appendChild(el('div', { class: 'onboard-dot' + (i === cur ? ' active' : '') }))
    );
    nextBtn.textContent = cur === ONBOARD_STEPS.length - 1 ? '시작하기 🎉' : '다음';
  }

  function finish() {
    localStorage.setItem('onboarding_done', '1');
    overlay.hidden = true;
  }

  nextBtn.addEventListener('click', () => {
    if (cur < ONBOARD_STEPS.length - 1) { cur++; render(); }
    else finish();
  });
  skipBtn.addEventListener('click', finish);

  overlay.hidden = false;
  render();
}

/* ═════════════════════════════════════════════════════════════════
   M6: PWA — service worker + install prompt
   ═════════════════════════════════════════════════════════════════ */
function initPWA() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }

  let deferredPrompt = null;
  const banner = document.getElementById('pwaBanner');
  const installBtn = document.getElementById('pwaInstall');
  const dismissBtn = document.getElementById('pwaDismiss');

  if (localStorage.getItem('pwa_dismissed')) return;

  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
    banner.hidden = false;
  });

  installBtn.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    deferredPrompt = null;
    banner.hidden = true;
    if (outcome === 'accepted') toast('앱이 홈 화면에 추가됐습니다!', 'success');
  });

  dismissBtn.addEventListener('click', () => {
    banner.hidden = true;
    localStorage.setItem('pwa_dismissed', '1');
  });
}

/* ═════════════════════════════════════════════════════════════════
   M6: Settings — update notif tab & sponsor channel row
   ═════════════════════════════════════════════════════════════════ */

/* ──────────────── M6 bootstrap ──────────────── */
(function initM6() {
  initNotifications();
  initOnboarding();
  initPWA();
}());
