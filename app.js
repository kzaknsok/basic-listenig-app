document.addEventListener('DOMContentLoaded', () => {
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

  let wordElements = [];
  let lessonMap = {};

  // 1. manifest.json からドロップダウンを動的生成
  function initLessonList() {
    // サブディレクトリやGitHub Pages環境での動作安定のため ./ を外した相対指定
    fetch('manifest.json')
      .then(res => {
        if (!res.ok) {
          throw new Error(`manifest.json の取得に失敗しました (Status: ${res.status})`);
        }
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

  // 2. セレクトボックス切り替え時の音声・字幕ロード
  fileSelect.addEventListener('change', (e) => {
    const baseName = e.target.value;
    if (!baseName) return;

    const audioExt = lessonMap[baseName] || '.mp3';
    loadAudioAndJson(`${baseName}${audioExt}`, `${baseName}.json`);
  });

  function loadAudioAndJson(audioUrl, jsonUrl) {
    setupAudio(audioUrl);
    fetch(jsonUrl)
      .then(res => {
        if (!res.ok) throw new Error(`${jsonUrl} の読み込みに失敗しました`);
        return res.json();
      })
      .then(data => renderTranscript(data))
      .catch(err => {
        transcriptContainer.innerHTML = `<div class="placeholder-text"><p style="color:#ff6b6b;">${err.message}</p></div>`;
      });
  }

  function setupAudio(src) {
    audio.src = src;
    audio.load();
    resetPlayerUI();
  }

  // 3. テキスト描画処理
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

      // start と end が同じ値（幅0秒）の場合は、ハイライト用に最低0.1秒の幅を確保
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

  // 4. トラッキング
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

            item.element.scrollIntoView({
              behavior: 'smooth',
              block: 'center'
            });
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

  // 5. プレイヤーコントロール
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