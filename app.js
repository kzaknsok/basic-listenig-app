document.addEventListener('DOMContentLoaded', () => {
  const audio = document.getElementById('audio-player');
  const transcriptContainer = document.getElementById('transcript');
  const fileSelect = document.getElementById('file-select');
  const localFileInput = document.getElementById('local-file-input');

  const playBtn = document.getElementById('play-btn');
  const playIcon = document.getElementById('play-icon');
  const pauseIcon = document.getElementById('pause-icon');
  const currentTimeEl = document.getElementById('current-time');
  const durationTimeEl = document.getElementById('duration-time');
  const progressBar = document.getElementById('progress-bar');
  const progressBarWrapper = document.getElementById('progress-bar-wrapper');

  let wordElements = [];
  let lessonMap = {};

  // 0. lessons.json からドロップダウン初期化（相対パス ./ を使用）
  function initLessonList() {
    fetch('./lessons.json')
      .then(res => {
        if (!res.ok) throw new Error('lessons.json が見つかりません');
        return res.json();
      })
      .then(list => {
        fileSelect.innerHTML = '<option value="">-- Select Lesson --</option>';
        lessonMap = {};
        list.forEach(item => {
          lessonMap[item.id] = item.ext || '.mp3';
          const opt = document.createElement('option');
          opt.value = item.id;
          opt.textContent = item.title;
          fileSelect.appendChild(opt);
        });
      })
      .catch(err => {
        console.warn('lessons.json 読み込みスキップ:', err);
      });
  }

  initLessonList();

  // 1. サーバー上のファイル選択（パターンA）
  fileSelect.addEventListener('change', (e) => {
    const baseName = e.target.value;
    if (!baseName) return;

    const ext = lessonMap[baseName] || '.mp3';
    loadAudioAndJson(`./${baseName}${ext}`, `./${baseName}.json`);
  });

  // 2. ローカルファイル読み込み（パターンB）
  localFileInput.addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    const pairs = {};
    files.forEach(file => {
      const lastDotIndex = file.name.lastIndexOf('.');
      if (lastDotIndex === -1) return;

      const baseName = file.name.substring(0, lastDotIndex);
      const ext = file.name.substring(lastDotIndex + 1).toLowerCase();

      if (!pairs[baseName]) pairs[baseName] = {};
      if (ext === 'mp3' || ext === 'wav') pairs[baseName].audio = file;
      if (ext === 'json') pairs[baseName].json = file;
    });

    const validBaseName = Object.keys(pairs).find(key => pairs[key].audio && pairs[key].json);

    if (validBaseName) {
      const selectedPair = pairs[validBaseName];
      const audioUrl = URL.createObjectURL(selectedPair.audio);

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const jsonData = JSON.parse(event.target.result);
          setupAudio(audioUrl);
          renderTranscript(jsonData);
        } catch (err) {
          alert('JSONのパースに失敗しました。');
        }
      };
      reader.readAsText(selectedPair.json);
    } else {
      alert('同名の 音声(.mp3/.wav) と .json のペアが見つかりませんでした。');
    }
  });

  function loadAudioAndJson(audioUrl, jsonUrl) {
    setupAudio(audioUrl);
    fetch(jsonUrl)
      .then(res => {
        if (!res.ok) throw new Error('JSON読み込み失敗');
        return res.json();
      })
      .then(data => renderTranscript(data))
      .catch(err => {
        transcriptContainer.innerHTML = `<div class="placeholder-text"><p style="color:#ff6b6b;">${jsonUrl} が見つかりません。</p></div>`;
      });
  }

  function setupAudio(src) {
    audio.src = src;
    audio.load();
    resetPlayerUI();
  }

  // 3. テキスト描画
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

      wordElements.push({
        element: wordSpan,
        parentElement: currentSentenceEl,
        start: item.start,
        end: item.end === item.start ? item.start + 0.1 : item.end
      });

      if (/[.?!]$/.test(item.text.trim())) {
        currentSentenceEl = document.createElement('div');
        currentSentenceEl.className = 'sentence';
        transcriptContainer.appendChild(currentSentenceEl);
      }
    });
  }

  // 4. 同期トラッキング
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