document.addEventListener('DOMContentLoaded', () => {
  // 既存の取得要素
  const audio = document.getElementById('audio-player');
  const transcriptContainer = document.getElementById('transcript');
  const fileSelect = document.getElementById('file-select');
  const playBtn = document.getElementById('play-btn');
  const playIcon = document.getElementById('play-icon');
  const pauseIcon = document.getElementById('pause-icon');
  const currentTimeEl = document.getElementById('current-time');
  const durationTimeEl = document.getElementById('duration-time');
  const progressBar = document.getElementById('progress-bar');
  const progressBarWrapper = document.getElementById('progress-bar-wrapper');

  // 追加要素（タブ・全文表示）
  const fullTextContainer = document.getElementById('full-text-container');
  const tabTranscript = document.getElementById('tab-transcript');
  const tabText = document.getElementById('tab-text');

  // ★ 再生速度の設定（1.0 が標準。0.85 = 0.85倍速、0.9 = 0.9倍速など）
  const PLAYBACK_RATE = 0.85;

  let wordElements = [];
  let lessonMap = {};

  // 1. マニフェスト取得
  function initLessonList() {
    fetch('manifest.json')
      .then(res => {
        if (!res.ok) throw new Error(`manifest.json の取得に失敗しました`);
        return res.json();
      })
      .then(list => {
        if (!Array.isArray(list) || list.length === 0) {
          fileSelect.innerHTML = '<option value="">-- No Lessons Found --</option>';
          return;
        }

        fileSelect.innerHTML = '<option value="">-- Select Lesson --</option>';
        lessonMap = {};

        list.forEach(item => {
          lessonMap[item.id] = item.audioExt;
          const opt = document.createElement('option');
          opt.value = item.id;
          opt.textContent = item.title;
          fileSelect.appendChild(opt);
        });
      })
      .catch(err => {
        console.error('マニフェスト読み込みエラー:', err);
        fileSelect.innerHTML = '<option value="">-- Failed to Load --</option>';
      });
  }

  initLessonList();

  // 2. セレクトボックス切り替え
  fileSelect.addEventListener('change', (e) => {
    const baseName = e.target.value;
    if (!baseName) return;

    const audioExt = lessonMap[baseName] || '.mp3';

    // ★ resources/ パスを付与してロード
    loadAudioAndData(
      `resources/${baseName}${audioExt}`,
      `resources/${baseName}.json`,
      `resources/${baseName}.txt`
    );
  });

  function loadAudioAndData(audioUrl, jsonUrl, txtUrl) {
    setupAudio(audioUrl);

    // JSON（ハイライト用）読み込み
    fetch(jsonUrl)
      .then(res => {
        if (!res.ok) throw new Error(`${jsonUrl} の読み込みに失敗しました`);
        return res.json();
      })
      .then(data => renderTranscript(data))
      .catch(err => {
        transcriptContainer.innerHTML = `<div class="placeholder-text"><p style="color:#ff6b6b;">${err.message}</p></div>`;
      });

    // TXT（全文表示用）読み込み
    fetch(txtUrl)
      .then(res => {
        if (!res.ok) throw new Error('File not found');
        return res.text();
      })
      .then(text => {
        fullTextContainer.textContent = text;
      })
      .catch(() => {
        fullTextContainer.innerHTML = `<div class="placeholder-text"><p style="color: var(--text-muted);">No File</p></div>`;
      });
  }

  function setupAudio(src) {
    audio.src = src;
    audio.playbackRate = PLAYBACK_RATE; // ★ ここで再生速度を設定
    audio.load();
    resetPlayerUI();
  }

  // 3. タブ切り替え処理
  tabTranscript.addEventListener('click', () => {
    tabTranscript.classList.add('active');
    tabText.classList.remove('active');

    transcriptContainer.classList.remove('hidden');
    fullTextContainer.classList.add('hidden');
  });

  tabText.addEventListener('click', () => {
    tabText.classList.add('active');
    tabTranscript.classList.remove('active');

    fullTextContainer.classList.remove('hidden');
    transcriptContainer.classList.add('hidden');
  });

  // 4. テキスト描画処理
  function renderTranscript(wordsData) {
    transcriptContainer.innerHTML = '';
    wordElements = [];

    let currentSentenceEl = document.createElement('div');
    currentSentenceEl.className = 'sentence';
    transcriptContainer.appendChild(currentSentenceEl);

    wordsData.forEach(item => {
      const wordSpan = document.createElement('span');
      wordSpan.className = 'word';
      wordSpan.textContent = item.text + ' ';
      wordSpan.dataset.start = item.start;
      wordSpan.dataset.end = item.end;

      wordSpan.addEventListener('click', () => {
        audio.currentTime = item.start;
        playAudio();
      });

      currentSentenceEl.appendChild(wordSpan);

      const calculatedEnd = Number(item.end) <= Number(item.start) ? Number(item.start) + 0.1 : Number(item.end);

      wordElements.push({
        element: wordSpan,
        parentElement: currentSentenceEl,
        start: Number(item.start),
        end: calculatedEnd
      });

      if (/[.?!]$/.test(item.text.trim())) {
        currentSentenceEl = document.createElement('div');
        currentSentenceEl.className = 'sentence';
        transcriptContainer.appendChild(currentSentenceEl);
      }
    });
  }

  // 5. トラッキング
  function syncTranscript() {
    if (!audio.paused && !audio.ended) {
      const currentTime = audio.currentTime;
      updatePlayerProgress();

      wordElements.forEach(item => {
        if (currentTime >= item.start && currentTime <= item.end) {
          if (!item.element.classList.contains('active')) {
            clearHighlights();
            item.element.classList.add('active');
            item.parentElement.classList.add('active-sentence');

            if (!transcriptContainer.classList.contains('hidden')) {
              item.element.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
              });
            }
          }
        }
      });

      requestAnimationFrame(syncTranscript);
    }
  }

  function clearHighlights() {
    document.querySelectorAll('.word.active').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.sentence.active-sentence').forEach(el => el.classList.remove('active-sentence'));
  }

  // 6. プレイヤーコントロール
  playBtn.addEventListener('click', () => {
    if (!audio.src) return;
    if (audio.paused) {
      playAudio();
    } else {
      pauseAudio();
    }
  });

  function playAudio() {
    audio.play().then(() => {
      playIcon.style.display = 'none';
      pauseIcon.style.display = 'block';
      requestAnimationFrame(syncTranscript);
    }).catch(e => console.log('Autoplay block:', e));
  }

  function pauseAudio() {
    audio.pause();
    playIcon.style.display = 'block';
    pauseIcon.style.display = 'none';
  }

  function resetPlayerUI() {
    pauseAudio();
    progressBar.style.width = '0%';
    currentTimeEl.textContent = '00:00';
    durationTimeEl.textContent = '00:00';
  }

  function updatePlayerProgress() {
    if (!audio.duration) return;
    const pct = (audio.currentTime / audio.duration) * 100;
    progressBar.style.width = `${pct}%`;
    currentTimeEl.textContent = formatTime(audio.currentTime);
  }

  audio.addEventListener('loadedmetadata', () => {
    durationTimeEl.textContent = formatTime(audio.duration);
  });

  progressBarWrapper.addEventListener('click', (e) => {
    if (!audio.duration) return;
    const rect = progressBarWrapper.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    audio.currentTime = pos * audio.duration;
    updatePlayerProgress();

    clearHighlights();
    const currentTime = audio.currentTime;
    const currentWord = wordElements.find(item => currentTime >= item.start && currentTime <= item.end);
    if (currentWord) {
      currentWord.element.classList.add('active');
      currentWord.parentElement.classList.add('active-sentence');
    }
  });

  audio.addEventListener('ended', () => {
    pauseAudio();
    clearHighlights();
  });

  function formatTime(seconds) {
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  }
});