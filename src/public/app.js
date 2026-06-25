'use strict';

/* ─────────────────────────────────────────────────────────────────
   auto-blog-gen — Frontend Shell (M1)
   - Hash router (/dashboard, /write, /settings, ...)
   - Theme toggle (light/dark, persisted)
   - View modules wired with existing API (transcribe, generate, publish, history, trends)
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
  // Stub revenue data — replaced by GET /api/dashboard in M5
  const monthRev = 423820;
  const monthGoal = 1000000;
  const pct = Math.round((monthRev / monthGoal) * 100);

  const recentPosts = [
    { title: '성수동 카페 추천 5선', visits: 1243, rev: 18200 },
    { title: '갤럭시 워치 6 후기',  visits: 824,  rev: 12100 },
    { title: '다이슨 V15 솔직 리뷰', visits: 612,  rev: 9800 },
  ];

  // ── Revenue hero
  const hero = el('div', { class: 'revenue-hero' },
    el('div', { class: 'revenue-hero-label' }, '이번 달 수익'),
    el('div', { class: 'revenue-hero-amount' }, fmtKrw(monthRev)),
    el('div', { class: 'revenue-hero-delta' }, '▲ 18%  ·  목표 ' + fmtKrw(monthGoal) + ` (${pct}%)`),
    el('div', { class: 'revenue-hero-progress' },
      el('div', { class: 'revenue-hero-progress-bar', style: { width: pct + '%' } })
    ),
    el('div', { class: 'revenue-hero-breakdown' }, '애드포스트 ₩162k  ·  쿠팡 ₩261k')
  );

  // ── KPI row
  const kpis = el('div', { class: 'kpi-grid' },
    kpiCard('✍️ 검수 대기', '3건', '오늘 발행 가능'),
    kpiCard('📅 오늘 예약', '1건', '07:00 자동 발행'),
    kpiCard('⚠️ 부진 글',   '2건', '리라이트 제안 있음'),
    kpiCard('🎯 이번 주 목표', '3/5', '주 5회 발행')
  );

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

  // ── Recent posts
  const postsTable = el('table', { class: 'list-table' },
    el('thead', {},
      el('tr', {},
        el('th', {}, '#'),
        el('th', {}, '제목'),
        el('th', { class: 'num' }, '방문'),
        el('th', { class: 'num' }, '수익')
      )
    ),
    el('tbody', {},
      ...recentPosts.map((p, i) =>
        el('tr', {},
          el('td', {}, String(i + 1)),
          el('td', {}, p.title),
          el('td', { class: 'num' }, fmtInt(p.visits)),
          el('td', { class: 'num' }, fmtKrw(p.rev))
        )
      )
    )
  );

  const postsSection = el('section', { class: 'card' },
    el('div', { class: 'flex items-center justify-between', style: { marginBottom: 'var(--space-3)' } },
      el('h2', { class: 'card-title', style: { margin: 0 } }, '📈 최근 글 성과 (7일)'),
      el('button', { class: 'btn btn-ghost btn-sm', onclick: () => navigate('/performance') }, '전체 보기 →')
    ),
    postsTable
  );

  // ── Hint
  const hint = el('div', { class: 'card', style: { background: 'var(--surface-alt)', borderStyle: 'dashed' } },
    el('div', { class: 'text-sm muted' },
      '💡 표시되는 숫자는 **샘플**입니다. M2에서 키워드 실데이터, M5에서 실수익이 연결됩니다.'
    )
  );

  // ── Compose
  const grid = el('div', { class: 'dashboard-grid' }, hero, kpis, kwSection, postsSection, hint);
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
  const previewActions = el('div', { class: 'flex items-center gap-2', style: { marginTop: 'var(--space-3)' } },
    el('button', { class: 'btn btn-secondary btn-sm', id: 'editToggle' }, '✏️ 편집'),
    el('input', { class: 'input', id: 'tagsInput', placeholder: '태그 (쉼표로 구분)', style: { flex: '1' } }),
    el('label', { class: 'flex items-center gap-2 text-sm' },
      el('input', { type: 'checkbox', id: 'draftMode' }), '임시저장'
    ),
    el('button', { class: 'btn btn-success', id: 'publishBtn' }, '📤 발행')
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

  // Publish
  document.getElementById('publishBtn').addEventListener('click', async () => {
    const title = titleInput.textContent.trim() || '블로그 포스팅';
    const content = isEditMode ? previewContent.innerHTML : generatedContent;
    const tagsArr = document.getElementById('tagsInput').value.split(',').map(t => t.trim()).filter(Boolean);
    const publish = !document.getElementById('draftMode').checked;
    if (!content) {
      toast('생성된 포스팅이 없습니다', 'error');
      return;
    }
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
      const res = await fetch('/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content, tags: tagsArr, publish, images: imagesPayload }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      publishResult.innerHTML = `<div class="toast success" style="position:static">✅ 업로드 완료! (포스팅 ID: ${data.postId})</div>`;
      publishResult.style.display = 'block';
      toast('네이버 블로그 발행 완료 🎉', 'success');
    } catch (err) {
      publishResult.innerHTML = `<div class="toast error" style="position:static">❌ ${err.message}</div>`;
      publishResult.style.display = 'block';
      toast('발행 실패: ' + err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '📤 발행';
    }
  });
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
function renderInbox(root) {
  placeholder(root, '📋', '검수 대기함',
    'Draft → Review → Scheduled 칸반 보드. 자동 생성된 초안이 여기로 쌓입니다.',
    'M4 — Schedule & Pipeline');
}
function renderCalendar(root) {
  placeholder(root, '📅', '발행 캘린더',
    '예약 발행 일정을 월/주 단위로 보고, 빈 슬롯에 클릭으로 새 글을 채울 수 있습니다.',
    'M4 — Schedule & Pipeline');
}
function renderPerformance(root) {
  placeholder(root, '📊', '성과 대시보드',
    '글별 방문자·노출·키워드 순위, 부진 글 알림, 시급 환산 ROI가 여기에 표시됩니다.',
    'M5 — Performance & Revenue');
}
function renderRevenue(root) {
  placeholder(root, '💰', '수익 관리',
    '애드포스트 + 쿠팡파트너스 + 협찬 채널 통합 대시보드와 제휴 링크 성과.',
    'M5 — Performance & Revenue');
}
function renderSponsors(root) {
  placeholder(root, '🤝', '협찬 보드',
    '제안받음 → 수락 → 작성중 → 발행 → 정산 칸반. 협찬 파이프라인 관리.',
    'M6 — Sponsor & Polish');
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

  card.appendChild(settingRow('🤝 협찬 메일 (Gmail)', '제안 메일 자동 분류',
    el('span', { class: 'chip' }, 'M6에서 활성화')));
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
  card.appendChild(settingRow('일일 추천 다이제스트', '매일 아침 황금 키워드 메일',
    el('span', { class: 'chip' }, 'M6에서 활성화')));
  card.appendChild(settingRow('부진 글 자동 알림', '14일 노출 < 100',
    el('span', { class: 'chip' }, 'M5에서 활성화')));
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
