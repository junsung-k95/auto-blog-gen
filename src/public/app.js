'use strict';

/* ── State ───────────────────────────────────────────────── */
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let uploadedImages = []; // Array of { file: File, buffer: ArrayBuffer, dataUrl: string }
let generatedContent = ''; // full generated HTML
let generatedTitle = '';

/* ── DOM refs ────────────────────────────────────────────── */
const aiProvider = document.getElementById('aiProvider');
const recordBtn = document.getElementById('recordBtn');
const stopBtn = document.getElementById('stopBtn');
const recordStatus = document.getElementById('recordStatus');
const transcriptBox = document.getElementById('transcriptBox');
const dropZone = document.getElementById('dropZone');
const imageInput = document.getElementById('imageInput');
const imagePreviews = document.getElementById('imagePreviews');
const memoInput = document.getElementById('memoInput');
const generateBtn = document.getElementById('generateBtn');
const previewSection = document.getElementById('previewSection');
const previewContent = document.getElementById('previewContent');
const titleInput = document.getElementById('titleInput');
const usageInfo = document.getElementById('usageInfo');
const publishBtn = document.getElementById('publishBtn');
const tagsInput = document.getElementById('tagsInput');
const draftMode = document.getElementById('draftMode');
const publishResult = document.getElementById('publishResult');

/* ── Voice Recording ─────────────────────────────────────── */
recordBtn.addEventListener('click', async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioChunks = [];
    mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });

    mediaRecorder.ondataavailable = e => { if (e.data.size > 0) audioChunks.push(e.data); };
    mediaRecorder.onstop = () => {
      stream.getTracks().forEach(t => t.stop());
      const blob = new Blob(audioChunks, { type: 'audio/webm' });
      transcribeAudio(blob);
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
  } catch (err) {
    recordStatus.textContent = '❌ 변환 실패';
    alert('음성 변환 실패: ' + err.message);
  }
}

/* ── Image Upload ────────────────────────────────────────── */
dropZone.addEventListener('click', () => imageInput.click());

dropZone.addEventListener('dragover', e => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));

dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  addImages([...e.dataTransfer.files]);
});

imageInput.addEventListener('change', () => {
  addImages([...imageInput.files]);
  imageInput.value = '';
});

async function addImages(files) {
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;
    const dataUrl = await readFileAsDataUrl(file);
    const buffer = await readFileAsArrayBuffer(file);
    uploadedImages.push({ file, buffer, dataUrl, mimeType: file.type });
    renderImagePreview(uploadedImages.length - 1, dataUrl);
  }
}

function renderImagePreview(index, dataUrl) {
  const div = document.createElement('div');
  div.className = 'image-preview';
  div.dataset.index = index;
  div.innerHTML = `
    <img src="${dataUrl}" alt="사진${index + 1}" />
    <button class="remove-btn" onclick="removeImage(${index})">×</button>
  `;
  imagePreviews.appendChild(div);
}

window.removeImage = function (index) {
  uploadedImages.splice(index, 1);
  imagePreviews.innerHTML = '';
  uploadedImages.forEach((img, i) => renderImagePreview(i, img.dataUrl));
};

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
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
  usageInfo.style.display = 'none';
  publishResult.style.display = 'none';
  generatedContent = '';

  const formData = new FormData();
  formData.append('transcript', transcript);
  formData.append('memo', memo);
  formData.append('aiProvider', aiProvider.value);

  uploadedImages.forEach((img, i) => {
    formData.append('images', new Blob([img.buffer], { type: img.mimeType }), img.file.name);
  });

  try {
    const res = await fetch('/api/generate', { method: 'POST', body: formData });
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // keep incomplete line

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const data = JSON.parse(line.slice(6));

          if (data.error) {
            previewContent.innerHTML = `<p style="color:red">오류: ${data.error}</p>`;
            break;
          }

          if (data.chunk) {
            generatedContent += data.chunk;
            // Render HTML directly (content is HTML from LLM)
            previewContent.innerHTML = generatedContent;
            previewContent.scrollTop = previewContent.scrollHeight;
          }

          if (data.done) {
            previewContent.classList.remove('streaming-cursor');
            showUsage(data.usage, data.provider);
            // Extract title from H2 if present
            const h2 = previewContent.querySelector('h2');
            if (h2 && !titleInput.textContent.trim()) {
              titleInput.textContent = h2.textContent;
              generatedTitle = h2.textContent;
            }
          }
        } catch (_) { /* skip malformed SSE lines */ }
      }
    }
  } catch (err) {
    previewContent.innerHTML = `<p style="color:red">오류: ${err.message}</p>`;
    previewContent.classList.remove('streaming-cursor');
  } finally {
    generateBtn.disabled = false;
    generateBtn.innerHTML = '✨ 포스팅 생성';
  }
});

function showUsage(usage, provider) {
  if (!usage) return;
  const modelName = provider === 'claude' ? 'Claude claude-opus-4-6' : 'GPT-4o';
  const cost = usage.cost_usd.toFixed(4);
  usageInfo.innerHTML = `
    💰 <strong>${modelName}</strong> &nbsp;|&nbsp;
    입력: ${usage.input_tokens.toLocaleString()} 토큰 &nbsp;/&nbsp;
    출력: ${usage.output_tokens.toLocaleString()} 토큰 &nbsp;|&nbsp;
    예상 비용: <strong>$${cost}</strong>
  `;
  usageInfo.style.display = 'block';
}

/* ── Publish to Naver ────────────────────────────────────── */
publishBtn.addEventListener('click', async () => {
  const title = titleInput.textContent.trim() || '블로그 포스팅';
  const content = generatedContent;
  const tags = tagsInput.value.split(',').map(t => t.trim()).filter(Boolean);
  const publish = !draftMode.checked;

  if (!content) { alert('생성된 포스팅이 없습니다.'); return; }

  publishBtn.disabled = true;
  publishBtn.innerHTML = '<span class="spinner"></span>업로드 중...';
  publishResult.style.display = 'none';

  // Convert images to base64 for upload
  const imagesPayload = uploadedImages.map((img, i) => ({
    data: arrayBufferToBase64(img.buffer),
    filename: img.file.name || `photo${i + 1}.jpg`,
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
    publishResult.textContent = `✅ 네이버 블로그에 업로드 완료! (포스팅 ID: ${data.postId})`;
    publishResult.style.display = 'block';
  } catch (err) {
    publishResult.className = 'publish-result error';
    publishResult.textContent = `❌ 업로드 실패: ${err.message}`;
    publishResult.style.display = 'block';
  } finally {
    publishBtn.disabled = false;
    publishBtn.innerHTML = '📤 네이버 블로그 업로드';
  }
});

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}
