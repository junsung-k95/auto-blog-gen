'use strict';

/* ── State ───────────────────────────────────────────────── */
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let uploadedImages = []; // { file, buffer: ArrayBuffer, dataUrl, mimeType }
let generatedContent = '';
let isEditMode = false;
let autoSaveTimer = null;

/* ── DOM refs ────────────────────────────────────────────── */
const aiProvider        = document.getElementById('aiProvider');
const recordBtn         = document.getElementById('recordBtn');
const stopBtn           = document.getElementById('stopBtn');
const recordStatus      = document.getElementById('recordStatus');
const transcriptBox     = document.getElementById('transcriptBox');
const dropZone          = document.getElementById('dropZone');
const imageInput        = document.getElementById('imageInput');
const imagePreviews     = document.getElementById('imagePreviews');
const dragHint          = document.getElementById('dragHint');
const memoInput         = document.getElementById('memoInput');
const generateBtn       = document.getElementById('generateBtn');
const autoSaveStatus    = document.getElementById('autoSaveStatus');
const previewSection    = document.getElementById('previewSection');
const previewContent    = document.getElementById('previewContent');
const titleInput        = document.getElementById('titleInput');
const usageInfo         = document.getElementById('usageInfo');
const editToggleBtn     = document.getElementById('editToggleBtn');
const trendBtn          = document.getElementById('trendBtn');
const trendPanel        = document.getElementById('trendPanel');
const trendCloseBtn     = document.getElementById('trendCloseBtn');
const trendContent      = document.getElementById('trendContent');
const publishBtn        = document.getElementById('publishBtn');
const tagsInput         = document.getElementById('tagsInput');
const draftMode         = document.getElementById('draftMode');
const publishResult     = document.getElementById('publishResult');
const historyBtn        = document.getElementById('historyBtn');
const historyPanel      = document.getElementById('historyPanel');
const historyOverlay    = document.getElementById('historyOverlay');
const historyCloseBtn   = document.getElementById('historyCloseBtn');
const historyList       = document.getElementById('historyList');
const draftBanner       = document.getElementById('draftBanner');
const draftRestoreBtn   = document.getElementById('draftRestoreBtn');
const draftDismissBtn   = document.getElementById('draftDismissBtn');

/* ── Voice Recording ─────────────────────────────────────── */
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
    alert('마이크 접근 권한이 필요합니다: ' + err.message);
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
    scheduleSaveDraft();
  } catch (err) {
    recordStatus.textContent = '❌ 변환 실패';
    alert('음성 변환 실패: ' + err.message);
  }
}

/* ── Image Upload & Sortable ─────────────────────────────── */
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
    const [dataUrl, buffer] = await Promise.all([readFileAs(file, 'dataUrl'), readFileAs(file, 'buffer')]);
    uploadedImages.push({ file, buffer, dataUrl, mimeType: file.type });
  }
  rebuildImagePreviews();
}

function rebuildImagePreviews() {
  imagePreviews.innerHTML = '';
  uploadedImages.forEach((img, i) => {
    const div = document.createElement('div');
    div.className = 'image-preview';
    div.dataset.idx = i;
    div.innerHTML =
      '<img src="' + img.dataUrl + '" alt="사진' + (i+1) + '" />' +
      '<button class="remove-btn" data-i="' + i + '">×</button>' +
      '<span class="order-badge">' + (i+1) + '</span>';
    imagePreviews.appendChild(div);
  });

  dragHint.style.display = uploadedImages.length > 1 ? 'block' : 'none';

  if (uploadedImages.length > 0 && window.Sortable) {
    Sortable.create(imagePreviews, {
      animation: 150,
      ghostClass: 'sortable-ghost',
      onEnd: function(evt) {
        var oldIndex = evt.oldIndex;
        var newIndex = evt.newIndex;
        if (oldIndex === newIndex) return;
        var moved = uploadedImages.splice(oldIndex, 1)[0];
        uploadedImages.splice(newIndex, 0, moved);
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

/* ── Auto-save Draft ─────────────────────────────────────── */
const DRAFT_KEY = 'auto-blog-draft';

function saveDraft() {
  const draft = {
    transcript: transcriptBox.textContent.trim(),
    memo: memoInput.value,
    title: titleInput.textContent.trim(),
    tags: tagsInput.value,
    content: generatedContent,
    timestamp: Date.now(),
  };
  if (!draft.transcript && !draft.content && !draft.memo) return;
  localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  var now = new Date();
  autoSaveStatus.textContent = '💾 자동 저장됨 ' + now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
}

function scheduleSaveDraft() {
  clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(saveDraft, 2000);
}

setInterval(saveDraft, 30000);
[transcriptBox, memoInput, titleInput, tagsInput].forEach(el =>
  el.addEventListener('input', scheduleSaveDraft)
);

function checkDraftOnLoad() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return;
    const draft = JSON.parse(raw);
    if (Date.now() - draft.timestamp > 24 * 60 * 60 * 1000) { localStorage.removeItem(DRAFT_KEY); return; }
    if (!draft.transcript && !draft.content && !draft.memo) return;
    draftBanner.style.display = 'block';

    draftRestoreBtn.addEventListener('click', () => {
      if (draft.transcript) transcriptBox.textContent = draft.transcript;
      if (draft.memo) memoInput.value = draft.memo;
      if (draft.title) titleInput.textContent = draft.title;
      if (draft.tags) tagsInput.value = draft.tags;
      if (draft.content) {
        generatedContent = draft.content;
        previewContent.innerHTML = draft.content;
        previewSection.style.display = 'block';
      }
      draftBanner.style.display = 'none';
    });

    draftDismissBtn.addEventListener('click', () => {
      localStorage.removeItem(DRAFT_KEY);
      draftBanner.style.display = 'none';
    });
  } catch (_) {}
}

/* ── Generate Blog Post ──────────────────────────────────── */
generateBtn.addEventListener('click', async () => {
  const transcript = transcriptBox.textContent.trim();
  const memo = memoInput.value.trim();

  if (!transcript && uploadedImages.length === 0 && !memo) {
    alert('음성, 사진, 또는 메모 중 하나 이상을 입력해주세요.');
    return;
  }

  generateBtn.disabled = true;
  generateBtn.innerHTML = '<span class="spinner"></span>생성 중...';
  previewSection.style.display = 'block';
  previewContent.innerHTML = '';
  previewContent.classList.add('streaming-cursor');
  previewContent.contentEditable = 'false';
  isEditMode = false;
  editToggleBtn.textContent = '✏️ 편집';
  editToggleBtn.classList.remove('active');
  usageInfo.style.display = 'none';
  trendPanel.style.display = 'none';
  publishResult.style.display = 'none';
  generatedContent = '';

  const formData = new FormData();
  formData.append('transcript', transcript);
  formData.append('memo', memo);
  formData.append('aiProvider', aiProvider.value);
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
          if (data.error) { previewContent.innerHTML = '<p style="color:red">오류: ' + data.error + '</p>'; break; }
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
            saveDraft();
          }
        } catch (_) {}
      }
    }
  } catch (err) {
    previewContent.innerHTML = '<p style="color:red">오류: ' + err.message + '</p>';
    previewContent.classList.remove('streaming-cursor');
  } finally {
    generateBtn.disabled = false;
    generateBtn.innerHTML = '✨ 포스팅 생성';
  }
});

function showUsage(usage, provider) {
  if (!usage) return;
  const model = provider === 'claude' ? 'Claude claude-opus-4-6' : 'GPT-4o';
  usageInfo.innerHTML =
    '💰 <strong>' + model + '</strong> &nbsp;|&nbsp; ' +
    '입력: ' + usage.input_tokens.toLocaleString() + ' 토큰 &nbsp;/&nbsp; ' +
    '출력: ' + usage.output_tokens.toLocaleString() + ' 토큰 &nbsp;|&nbsp; ' +
    '예상 비용: <strong>$' + usage.cost_usd.toFixed(4) + '</strong>';
  usageInfo.style.display = 'block';
}

/* ── Edit Mode Toggle ────────────────────────────────────── */
editToggleBtn.addEventListener('click', () => {
  isEditMode = !isEditMode;
  if (isEditMode) {
    previewContent.contentEditable = 'true';
    previewContent.classList.add('edit-mode');
    editToggleBtn.textContent = '✅ 완료';
    editToggleBtn.classList.add('active');
    previewContent.focus();
  } else {
    previewContent.contentEditable = 'false';
    previewContent.classList.remove('edit-mode');
    editToggleBtn.textContent = '✏️ 편집';
    editToggleBtn.classList.remove('active');
    generatedContent = previewContent.innerHTML;
    scheduleSaveDraft();
  }
});

/* ── Trend Analysis ──────────────────────────────────────── */
trendBtn.addEventListener('click', async () => {
  const title = titleInput.textContent.trim();
  const content = generatedContent;
  if (!title && !content) { alert('먼저 포스팅을 생성해주세요.'); return; }

  trendBtn.disabled = true;
  trendBtn.innerHTML = '<span class="spinner spinner-dark"></span>분석 중...';
  trendPanel.style.display = 'block';
  trendContent.innerHTML = '<p class="loading-msg">키워드 추출 및 트렌드 분석 중...</p>';

  try {
    const res = await fetch('/api/trends', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, content }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    renderTrendResult(data);
  } catch (err) {
    trendContent.innerHTML = '<p style="color:red">분석 실패: ' + err.message + '</p>';
  } finally {
    trendBtn.disabled = false;
    trendBtn.textContent = '📊 트렌드 분석';
  }
});

trendCloseBtn.addEventListener('click', () => { trendPanel.style.display = 'none'; });

function renderTrendResult(result) {
  const blogSearch = result.blogSearch || [];
  const suggestedTitle = result.suggestedTitle || '';
  const suggestedTags = result.suggestedTags || [];

  const maxTotal = Math.max.apply(null, blogSearch.map(function(b) { return b.total || 0; }).concat([1]));

  const barsHtml = blogSearch.map(function(item) {
    const hasData = item.total != null;
    const pct = hasData ? Math.round((item.total / maxTotal) * 100) : 0;
    const label = hasData ? Number(item.total).toLocaleString() + '개' : '데이터 없음';
    const colorClass = item.total > 5000000 ? 'bar-high' : item.total > 1000000 ? 'bar-mid' : 'bar-low';
    return '<div class="trend-bar-row">' +
      '<span class="trend-kw">' + item.keyword + '</span>' +
      '<div class="trend-bar-wrap"><div class="trend-bar ' + colorClass + '" style="width:' + pct + '%"></div></div>' +
      '<span class="trend-count">' + label + '</span>' +
      '</div>';
  }).join('');

  const tagsHtml = suggestedTags.map(function(t) {
    return '<span class="tag-chip">' + t + '</span>';
  }).join('');

  trendContent.innerHTML =
    '<div class="trend-section">' +
      '<h4>📌 추출된 키워드 (블로그 검색 수)</h4>' +
      '<div class="trend-bars">' + barsHtml + '</div>' +
      '<p class="trend-note">검색 수가 너무 많으면 경쟁 포화, 적으면 노출 기회 낮음</p>' +
    '</div>' +
    '<div class="trend-section">' +
      '<h4>✨ AI 추천 제목</h4>' +
      '<div class="suggested-title">' + suggestedTitle + '</div>' +
      '<button class="btn btn-sm btn-outline apply-title-btn">제목에 적용</button>' +
    '</div>' +
    '<div class="trend-section">' +
      '<h4>🏷️ 추천 태그</h4>' +
      '<div class="tag-chips">' + tagsHtml + '</div>' +
      '<button class="btn btn-sm btn-outline apply-tags-btn">태그에 적용</button>' +
    '</div>';

  trendContent.querySelector('.apply-title-btn').addEventListener('click', function() {
    titleInput.textContent = suggestedTitle;
    scheduleSaveDraft();
  });
  trendContent.querySelector('.apply-tags-btn').addEventListener('click', function() {
    tagsInput.value = suggestedTags.join(', ');
    scheduleSaveDraft();
  });
}

/* ── History Panel ───────────────────────────────────────── */
historyBtn.addEventListener('click', openHistory);
historyCloseBtn.addEventListener('click', closeHistory);
historyOverlay.addEventListener('click', closeHistory);

function openHistory() {
  historyPanel.classList.add('open');
  historyOverlay.classList.add('visible');
  loadHistory();
}

function closeHistory() {
  historyPanel.classList.remove('open');
  historyOverlay.classList.remove('visible');
}

async function loadHistory() {
  historyList.innerHTML = '<p class="loading-msg">불러오는 중...</p>';
  try {
    const res = await fetch('/api/history');
    const entries = await res.json();
    if (!entries.length) {
      historyList.innerHTML = '<p class="empty-msg">발행된 포스팅이 없습니다.</p>';
      return;
    }
    historyList.innerHTML = entries.map(function(e) {
      const tagsHtml = e.tags.length
        ? '<div class="history-tags">' + e.tags.map(function(t) { return '<span class="tag-chip sm">' + t + '</span>'; }).join('') + '</div>'
        : '';
      return '<div class="history-entry">' +
        '<div class="history-title">' + (e.title || '(제목 없음)') + '</div>' +
        '<div class="history-meta">' + formatDate(e.publishedAt) + ' · ID: ' + (e.postId || '-') + '</div>' +
        tagsHtml +
        '<p class="history-preview">' + e.preview + '</p>' +
        '</div>';
    }).join('');
  } catch (err) {
    historyList.innerHTML = '<p style="color:red">불러오기 실패: ' + err.message + '</p>';
  }
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/* ── Publish to Naver ────────────────────────────────────── */
publishBtn.addEventListener('click', async () => {
  const title = titleInput.textContent.trim() || '블로그 포스팅';
  const content = isEditMode ? previewContent.innerHTML : generatedContent;
  const tags = tagsInput.value.split(',').map(t => t.trim()).filter(Boolean);
  const publish = !draftMode.checked;

  if (!content) { alert('생성된 포스팅이 없습니다.'); return; }

  publishBtn.disabled = true;
  publishBtn.innerHTML = '<span class="spinner"></span>업로드 중...';
  publishResult.style.display = 'none';

  const imagesPayload = uploadedImages.map((img, i) => ({
    data: arrayBufferToBase64(img.buffer),
    filename: img.file.name || ('photo' + (i+1) + '.jpg'),
    mimeType: img.mimeType,
  }));

  try {
    const res = await fetch('/api/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, content, tags, publish, images: imagesPayload }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    publishResult.className = 'publish-result success';
    publishResult.textContent = '✅ 네이버 블로그에 업로드 완료! (포스팅 ID: ' + data.postId + ')';
    publishResult.style.display = 'block';
    localStorage.removeItem(DRAFT_KEY);
    autoSaveStatus.textContent = '';
  } catch (err) {
    publishResult.className = 'publish-result error';
    publishResult.textContent = '❌ 업로드 실패: ' + err.message;
    publishResult.style.display = 'block';
  } finally {
    publishBtn.disabled = false;
    publishBtn.innerHTML = '📤 네이버 블로그 업로드';
  }
});

/* ── Utils ───────────────────────────────────────────────── */
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

/* ── Init ────────────────────────────────────────────────── */
checkDraftOnLoad();
