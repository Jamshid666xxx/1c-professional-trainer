/**
 * Тренажер для подготовки к экзамену «1С:Профессионал (Платформа 8.3)»
 * Desktop-ориентированное приложение
 */

(function () {
  'use strict';

  // State
  let allQuestions = [];
  let questionsMap = new Map();
  let sectionsList = [];
  let currentMode = 'exam'; // 'exam' | 'sections' | 'mistakes' | 'favorites' | 'search'

  let progress = {
    mistakes: [],
    starred: [],
    history: [],
    stats: { answered: 0, correct: 0 },
    questionStats: {} // qId: { answered: 0, correct: 0, lastResult: true/false }
  };

  // Exam State
  let examActive = false;
  let examQuestions = [];
  let examAnswers = {}; // qIndex: optionIndex
  let examCurrentIdx = 0;
  let examTimerInterval = null;
  let examTimeRemaining = 30 * 60; // 30 mins

  // Sections State
  let sectionFiltered = [];
  let sectionCurrentIdx = 0;
  let sectionUserAnswer = null; // null or optionIndex

  // Mistakes State
  let mistakeFiltered = [];
  let mistakeCurrentIdx = 0;
  let mistakeUserAnswer = null;

  // Favorites State
  let favFiltered = [];
  let favCurrentIdx = 0;
  let favUserAnswer = null;

  // Search State
  let searchDebounceTimer = null;

  // DOM Elements Cache
  const elements = {};

  function initDOMElements() {
    elements.currentModeTitle = document.getElementById('currentModeTitle');
    elements.currentModeDesc = document.getElementById('currentModeDesc');
    elements.navItems = document.querySelectorAll('.nav-item');
    elements.viewPanels = document.querySelectorAll('.view-panel');
    
    // Sidebar stats
    elements.totalQuestionsCount = document.getElementById('totalQuestionsCount');
    elements.mistakesCount = document.getElementById('mistakesCount');
    elements.favoritesCount = document.getElementById('favoritesCount');
    elements.overallPercentage = document.getElementById('overallPercentage');
    elements.overallProgressBar = document.getElementById('overallProgressBar');
    elements.statsAnswered = document.getElementById('statsAnswered');
    elements.statsCorrect = document.getElementById('statsCorrect');

    // Theme toggle
    elements.themeToggleBtn = document.getElementById('themeToggleBtn');
    elements.themeIcon = document.getElementById('themeIcon');
    elements.themeText = document.getElementById('themeText');

    // Exam View
    elements.viewExam = document.getElementById('viewExam');
    elements.examStartCard = document.getElementById('examStartCard');
    elements.startExamBtn = document.getElementById('startExamBtn');
    elements.examActiveContainer = document.getElementById('examActiveContainer');
    elements.examNavGrid = document.getElementById('examNavGrid');
    elements.examTimer = document.getElementById('examTimer');
    elements.finishExamBtn = document.getElementById('finishExamBtn');
    elements.examQuestionCard = document.getElementById('examQuestionCard');
    elements.examResultContainer = document.getElementById('examResultContainer');
    elements.examResultCard = document.getElementById('examResultCard');
    elements.examReviewContainer = document.getElementById('examReviewContainer');
    elements.examHistoryBox = document.getElementById('examHistoryBox');
    elements.examHistoryList = document.getElementById('examHistoryList');

    // Sections View
    elements.viewSections = document.getElementById('viewSections');
    elements.sectionSelect = document.getElementById('sectionSelect');
    elements.sectionOrder = document.getElementById('sectionOrder');
    elements.instantFeedbackToggle = document.getElementById('instantFeedbackToggle');
    elements.resetSectionFilterBtn = document.getElementById('resetSectionFilterBtn');
    elements.secPrevBtn = document.getElementById('secPrevBtn');
    elements.secNextBtn = document.getElementById('secNextBtn');
    elements.secCurrentIndex = document.getElementById('secCurrentIndex');
    elements.secTotalCount = document.getElementById('secTotalCount');
    elements.sectionQuestionCard = document.getElementById('sectionQuestionCard');

    // Mistakes View
    elements.viewMistakes = document.getElementById('viewMistakes');
    elements.mistakesEmptyCard = document.getElementById('mistakesEmptyCard');
    elements.mistakesActiveContainer = document.getElementById('mistakesActiveContainer');
    elements.mistakePrevBtn = document.getElementById('mistakePrevBtn');
    elements.mistakeNextBtn = document.getElementById('mistakeNextBtn');
    elements.mistakeCurrentIndex = document.getElementById('mistakeCurrentIndex');
    elements.mistakeTotalCount = document.getElementById('mistakeTotalCount');
    elements.clearCurrentMistakeBtn = document.getElementById('clearCurrentMistakeBtn');
    elements.mistakeQuestionCard = document.getElementById('mistakeQuestionCard');

    // Favorites View
    elements.viewFavorites = document.getElementById('viewFavorites');
    elements.favoritesEmptyCard = document.getElementById('favoritesEmptyCard');
    elements.favoritesActiveContainer = document.getElementById('favoritesActiveContainer');
    elements.favPrevBtn = document.getElementById('favPrevBtn');
    elements.favNextBtn = document.getElementById('favNextBtn');
    elements.favCurrentIndex = document.getElementById('favCurrentIndex');
    elements.favTotalCount = document.getElementById('favTotalCount');
    elements.favoritesQuestionCard = document.getElementById('favoritesQuestionCard');

    // Search View
    elements.viewSearch = document.getElementById('viewSearch');
    elements.searchInput = document.getElementById('searchInput');
    elements.clearSearchBtn = document.getElementById('clearSearchBtn');
    elements.searchSectionFilter = document.getElementById('searchSectionFilter');
    elements.searchResultsCount = document.getElementById('searchResultsCount');
    elements.searchResultsList = document.getElementById('searchResultsList');

    // Modal
    elements.screenshotModal = document.getElementById('screenshotModal');
    elements.modalCloseBtn = document.getElementById('modalCloseBtn');
    elements.modalFilename = document.getElementById('modalFilename');
    elements.modalDownloadLink = document.getElementById('modalDownloadLink');
    elements.modalScreenshotImg = document.getElementById('modalScreenshotImg');

    // Toast
    elements.toast = document.getElementById('toast');
  }

  // ==========================================
  // INITIALIZATION & DATA LOADING
  // ==========================================

  async function init() {
    initDOMElements();
    setupTheme();
    setupEventListeners();

    try {
      showToast('Загрузка базы вопросов...');
      const [datasetRes, progressRes] = await Promise.all([
        fetch('dataset.json'),
        fetch('/api/progress').catch(() => null)
      ]);

      if (!datasetRes.ok) throw new Error('Не удалось загрузить dataset.json');
      allQuestions = await datasetRes.json();
      allQuestions.forEach(q => questionsMap.set(q.id, q));

      // Extract unique sections
      const secSet = new Set(allQuestions.map(q => q.section));
      sectionsList = Array.from(secSet).sort((a, b) => {
        const numA = parseInt(a, 10) || 0;
        const numB = parseInt(b, 10) || 0;
        return numA - numB;
      });

      // Load progress
      if (progressRes && progressRes.ok) {
        try {
          const loadedProgress = await progressRes.json();
          progress = Object.assign(progress, loadedProgress);
        } catch (e) {
          console.warn('Progress parse error:', e);
        }
      } else {
        // Fallback localStorage
        const local = localStorage.getItem('trainer_1c_progress');
        if (local) {
          try { progress = Object.assign(progress, JSON.parse(local)); } catch (e) {}
        }
      }

      populateSectionDropdowns();
      updateSidebarStats();
      renderExamHistory();

      // Setup default view
      switchMode('exam');
      showToast(`База загружена: ${allQuestions.length} вопросов`);
    } catch (err) {
      console.error(err);
      // Видимая ошибка вместо молчаливого «977» в интерфейсе.
      showErrorBanner('Не удалось загрузить базу вопросов. Проверьте, что файл dataset.json доступен серверу.');
      showToast('Ошибка загрузки данных: ' + err.message, 6000);
      return;
    }

    // Защита от пустого набора: если dataset.json вернулся, но не содержит
    // вопросов (или был повреждён) — показываем ошибку, а не «977»-иллюзию.
    if (!allQuestions.length) {
      showErrorBanner('База вопросов пустая или повреждена (dataset.json). Проверьте сервер и путь к данным.');
      return;
    }
  }

  function populateSectionDropdowns() {
    elements.sectionSelect.innerHTML = '<option value="all">Все разделы (1..14)</option>';
    elements.searchSectionFilter.innerHTML = '<option value="">Все 14 разделов</option>';

    sectionsList.forEach(sec => {
      const opt1 = document.createElement('option');
      opt1.value = sec;
      opt1.textContent = sec;
      elements.sectionSelect.appendChild(opt1);

      const opt2 = document.createElement('option');
      opt2.value = sec;
      opt2.textContent = sec;
      elements.searchSectionFilter.appendChild(opt2);
    });
  }

  // ==========================================
  // SAVING & STATS
  // ==========================================

  let saveTimeout = null;
  function saveProgress() {
    localStorage.setItem('trainer_1c_progress', JSON.stringify(progress));
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async () => {
      try {
        await fetch('/api/progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(progress)
        });
      } catch (err) {
        console.warn('Server sync failed:', err);
      }
    }, 400);

    updateSidebarStats();
  }

  function updateSidebarStats() {
    // Показываем РЕАЛЬНО число загруженных вопросов, а не хардкод 977.
    // Это устраняет «иллюзию загрузки»: при пустом наборе будет 0, а не 977.
    const total = allQuestions.length;
    const answeredCount = Object.keys(progress.questionStats || {}).length;
    const correctCount = Object.values(progress.questionStats || {}).filter(s => s.lastResult).length;
    
    elements.totalQuestionsCount.textContent = total;
    elements.mistakesCount.textContent = progress.mistakes ? progress.mistakes.length : 0;
    elements.favoritesCount.textContent = progress.starred ? progress.starred.length : 0;
    
    elements.statsAnswered.textContent = answeredCount;
    elements.statsCorrect.textContent = correctCount;

    const percent = total > 0 ? Math.round((answeredCount / total) * 100) : 0;
    elements.overallPercentage.textContent = percent + '%';
    elements.overallProgressBar.style.width = percent + '%';

    // «/ 977» в прогрессе тоже делаем динамическим.
    const totalEl = document.getElementById('statsTotal');
    if (totalEl) totalEl.textContent = total || 0;
  }

  function recordQuestionAnswer(questionId, isCorrect) {
    if (!progress.questionStats) progress.questionStats = {};
    if (!progress.mistakes) progress.mistakes = [];

    const stat = progress.questionStats[questionId] || { answered: 0, correct: 0, lastResult: false };
    stat.answered += 1;
    if (isCorrect) stat.correct += 1;
    stat.lastResult = isCorrect;
    progress.questionStats[questionId] = stat;

    if (!isCorrect) {
      if (!progress.mistakes.includes(questionId)) {
        progress.mistakes.push(questionId);
      }
    } else {
      // If user had mistake and got it correct, we can keep it or leave it until explicitly cleared
    }

    saveProgress();
  }

  function toggleStarQuestion(questionId) {
    if (!progress.starred) progress.starred = [];
    const idx = progress.starred.indexOf(questionId);
    let starred = false;
    if (idx >= 0) {
      progress.starred.splice(idx, 1);
      showToast('Удалено из избранного');
    } else {
      progress.starred.push(questionId);
      starred = true;
      showToast('Добавлено в избранное ⭐');
    }
    saveProgress();
    
    // Re-render star icon if visible
    const starBtn = document.querySelector(`[data-star-qid="${questionId}"]`);
    if (starBtn) {
      starBtn.classList.toggle('starred', starred);
      starBtn.innerHTML = starred ? '★ В избранном' : '☆ В избранное';
    }

    if (currentMode === 'favorites') {
      setupFavoritesMode();
    }
    return starred;
  }

  // ==========================================
  // NAVIGATION & MODES
  // ==========================================

  function switchMode(mode) {
    currentMode = mode;
    elements.navItems.forEach(item => {
      item.classList.toggle('active', item.dataset.mode === mode);
    });

    elements.viewPanels.forEach(panel => panel.classList.remove('active'));

    const titles = {
      exam: {
        title: 'Режим «Экзамен»',
        desc: '14 случайных вопросов по одному из каждого раздела. Время: 30 мин. Порог сдачи: не менее 12 из 14.'
      },
      sections: {
        title: 'Тренировка по разделам',
        desc: 'Изучайте вопросы последовательно или случайно по каждому из 14 тематических разделов базы.'
      },
      mistakes: {
        title: 'Работа над ошибками',
        desc: 'Вопросы, в которых вы допускали ошибки. Повторяйте их до полного закрепления.'
      },
      favorites: {
        title: 'Избранные вопросы',
        desc: 'Вопросы, отмеченные звездочкой (клавиша F). Удобно для повторения сложных тем.'
      },
      search: {
        title: 'База вопросов и поиск',
        desc: 'Мгновенный поиск по всем 977 вопросам, ответам и ключевым терминам.'
      }
    };

    elements.currentModeTitle.textContent = titles[mode].title;
    elements.currentModeDesc.textContent = titles[mode].desc;

    switch (mode) {
      case 'exam':
        elements.viewExam.classList.add('active');
        if (!examActive) {
          elements.examStartCard.style.display = 'block';
          elements.examActiveContainer.style.display = 'none';
          elements.examResultContainer.style.display = 'none';
          renderExamHistory();
        }
        break;
      case 'sections':
        elements.viewSections.classList.add('active');
        setupSectionsMode();
        break;
      case 'mistakes':
        elements.viewMistakes.classList.add('active');
        setupMistakesMode();
        break;
      case 'favorites':
        elements.viewFavorites.classList.add('active');
        setupFavoritesMode();
        break;
      case 'search':
        elements.viewSearch.classList.add('active');
        performSearch();
        break;
    }
  }

  // ==========================================
  // MODE 1: EXAM IMPLEMENTATION
  // ==========================================

  function startExam() {
    // Generate exactly 14 questions: 1 from each section.
    // Safe bypass: вопросы с менее чем 2 вариантами (без выбора) обходятся
    // в пользу обычного вопроса из того же раздела. Это не меняет correct_index
    // и правильные ответы, а лишь защищает экзамен от некорректных вопросов.
    examQuestions = [];
    sectionsList.forEach(sec => {
      const qInSec = allQuestions.filter(q => q.section === sec);
      const usable = qInSec.filter(q => Array.isArray(q.options) && q.options.length >= 2);
      const pool = usable.length > 0 ? usable : qInSec;
      if (pool.length > 0) {
        const randQ = pool[Math.floor(Math.random() * pool.length)];
        examQuestions.push(randQ);
      }
    });

    // If less than 14 for any reason, pad from pool
    if (examQuestions.length < 14) {
      const remain = allQuestions.filter(q => !examQuestions.includes(q));
      while (examQuestions.length < 14 && remain.length > 0) {
        const idx = Math.floor(Math.random() * remain.length);
        examQuestions.push(remain.splice(idx, 1)[0]);
      }
    }

    examAnswers = {};
    examCurrentIdx = 0;
    examActive = true;
    examTimeRemaining = 30 * 60; // 30 minutes

    elements.examStartCard.style.display = 'none';
    elements.examResultContainer.style.display = 'none';
    elements.examActiveContainer.style.display = 'block';

    renderExamNav();
    renderExamQuestion(0);
    startExamTimer();
  }

  function startExamTimer() {
    clearInterval(examTimerInterval);
    updateExamTimerDisplay();
    examTimerInterval = setInterval(() => {
      examTimeRemaining--;
      updateExamTimerDisplay();
      if (examTimeRemaining <= 0) {
        clearInterval(examTimerInterval);
        showToast('Время экзамена истекло!', 4000);
        finishExam();
      }
    }, 1000);
  }

  function updateExamTimerDisplay() {
    const mins = Math.floor(examTimeRemaining / 60);
    const secs = examTimeRemaining % 60;
    const str = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    elements.examTimer.textContent = str;
    elements.examTimer.classList.toggle('danger', examTimeRemaining < 300); // red under 5 mins
  }

  function renderExamNav() {
    elements.examNavGrid.innerHTML = '';
    examQuestions.forEach((q, idx) => {
      const pill = document.createElement('button');
      pill.className = 'exam-q-pill';
      pill.textContent = idx + 1;
      if (idx === examCurrentIdx) pill.classList.add('current');
      if (examAnswers[idx] !== undefined) pill.classList.add('answered');

      pill.addEventListener('click', () => {
        renderExamQuestion(idx);
      });
      elements.examNavGrid.appendChild(pill);
    });
  }

  function renderExamQuestion(index) {
    examCurrentIdx = index;
    const q = examQuestions[index];
    renderExamNav();

    const selectedOption = examAnswers[index];
    const card = elements.examQuestionCard;
    card.innerHTML = '';

    // Header
    const header = document.createElement('div');
    header.className = 'question-header';
    header.innerHTML = `
      <div class="question-meta">
        <span class="question-section-pill">Вопрос ${index + 1} из 14 • ${escapeHtml(q.section)}</span>
        <span class="question-filename">Файл: ${escapeHtml(q.filename)}</span>
      </div>
      <div class="question-actions-top">
        <button class="btn-star ${progress.starred && progress.starred.includes(q.id) ? 'starred' : ''}" data-star-qid="${q.id}">
          ${progress.starred && progress.starred.includes(q.id) ? '★ В избранном' : '☆ В избранное'}
        </button>
        <button class="btn-screenshot-toggle" data-scr-qid="${q.id}">
          📷 Скриншот (S)
        </button>
      </div>
    `;
    card.appendChild(header);

    // Question Text
    const qText = document.createElement('div');
    qText.className = 'question-text';
    qText.textContent = q.question;
    card.appendChild(qText);

    // Diagram if present
    if (q.diagram) {
      const diagBox = document.createElement('div');
      diagBox.className = 'question-diagram-box';
      diagBox.innerHTML = `
        <img src="${encodeURI(q.diagram)}" alt="Иллюстрация к вопросу">
        <div class="diagram-caption">🔍 Кликните для увеличения или нажмите (S) для полного снимка</div>
      `;
      diagBox.querySelector('img').addEventListener('click', () => openScreenshotModal(q));
      card.appendChild(diagBox);
    }

    // Options list (Strict Canonical 1..N order)
    const optionsList = document.createElement('div');
    optionsList.className = 'options-list';

    q.options.forEach((optText, optIdx) => {
      const btn = document.createElement('button');
      btn.className = 'option-btn';
      if (selectedOption === optIdx) {
        btn.classList.add('selected');
      }

      btn.innerHTML = `
        <span class="option-num-badge">${optIdx + 1}</span>
        <span class="option-text">${escapeHtml(optText)}</span>
        <span class="option-hotkey">[${optIdx + 1}]</span>
      `;

      btn.addEventListener('click', () => {
        selectExamAnswer(index, optIdx);
      });

      optionsList.appendChild(btn);
    });
    card.appendChild(optionsList);

    // Question navigation footer inside card
    const navFooter = document.createElement('div');
    navFooter.className = 'question-pagination-bar mt-4';
    navFooter.innerHTML = `
      <button class="btn btn-outline" id="examPrevBtn" ${index === 0 ? 'disabled' : ''}>← Предыдущий</button>
      <div class="pagination-indicator">Вопрос ${index + 1} из 14</div>
      <button class="btn btn-primary" id="examNextBtn">${index === 13 ? 'Завершить экзамен' : 'Следующий →'}</button>
    `;
    card.appendChild(navFooter);

    // Event listeners
    header.querySelector('[data-star-qid]').addEventListener('click', () => toggleStarQuestion(q.id));
    header.querySelector('[data-scr-qid]').addEventListener('click', () => openScreenshotModal(q));

    navFooter.querySelector('#examPrevBtn').addEventListener('click', () => {
      if (examCurrentIdx > 0) renderExamQuestion(examCurrentIdx - 1);
    });

    navFooter.querySelector('#examNextBtn').addEventListener('click', () => {
      if (examCurrentIdx < 13) {
        renderExamQuestion(examCurrentIdx + 1);
      } else {
        finishExam();
      }
    });
  }

  function selectExamAnswer(qIdx, optionIdx) {
    examAnswers[qIdx] = optionIdx;
    renderExamQuestion(qIdx);
  }

  function finishExam() {
    clearInterval(examTimerInterval);
    examActive = false;

    // Tally results
    let correctCount = 0;
    const reviewData = [];

    examQuestions.forEach((q, idx) => {
      const userAns = examAnswers[idx];
      const isCorrect = (userAns === q.correct_index);
      if (isCorrect) correctCount++;
      recordQuestionAnswer(q.id, isCorrect);

      reviewData.push({
        question: q,
        userAnswer: userAns,
        isCorrect: isCorrect
      });
    });

    const isPassed = correctCount >= 12;
    const timeSpentSec = (30 * 60) - Math.max(0, examTimeRemaining);
    const spentMins = Math.floor(timeSpentSec / 60);
    const spentSecs = timeSpentSec % 60;

    // Save exam in history
    if (!progress.history) progress.history = [];
    progress.history.unshift({
      date: new Date().toLocaleString('ru-RU'),
      score: correctCount,
      total: 14,
      passed: isPassed,
      duration: `${spentMins} мин. ${spentSecs} сек.`
    });
    saveProgress();

    // Render result card
    elements.examActiveContainer.style.display = 'none';
    elements.examResultContainer.style.display = 'block';

    elements.examResultCard.innerHTML = `
      <div class="result-badge ${isPassed ? 'passed' : 'failed'}">
        ${isPassed ? '🎉 ЭКЗАМЕН СДАН' : '❌ ЭКЗАМЕН НЕ СДАН'}
      </div>
      <div class="result-score ${isPassed ? 'text-success' : 'text-danger'}">
        ${correctCount} / 14
      </div>
      <p class="result-summary">
        ${isPassed
          ? `Отличный результат! Вы набрали необходимый порог (минимум 12 из 14). Допущено ошибок: ${14 - correctCount}.`
          : `К сожалению, порог не пройден. Для успешной сдачи необходимо набрать не менее 12 баллов из 14. Допущено ошибок: ${14 - correctCount}.`
        }
        <br><small>Время сдачи: ${spentMins} мин. ${spentSecs} сек.</small>
      </p>
      <div class="result-actions">
        <button id="examRetryBtn" class="btn btn-primary btn-lg">Сдать еще раз</button>
        <button id="examToMistakesBtn" class="btn btn-outline" ${correctCount === 14 ? 'style="display:none;"' : ''}>
          Перейти к ошибкам (${14 - correctCount})
        </button>
      </div>
    `;

    document.getElementById('examRetryBtn').addEventListener('click', startExam);
    const toMistakes = document.getElementById('examToMistakesBtn');
    if (toMistakes) {
      toMistakes.addEventListener('click', () => switchMode('mistakes'));
    }

    // Render Review of all 14 questions
    elements.examReviewContainer.innerHTML = '<h3>Разбор ответов экзамена</h3>';
    reviewData.forEach((item, idx) => {
      const q = item.question;
      const rCard = document.createElement('div');
      rCard.className = `card search-item-card mb-2 ${item.isCorrect ? 'border-success' : 'border-danger'}`;
      
      let optionsHtml = '';
      q.options.forEach((opt, optIdx) => {
        let optClass = '';
        let badgeText = '';
        if (optIdx === q.correct_index) {
          optClass = 'text-success font-weight-bold';
          badgeText = ' ✓ ПРАВИЛЬНЫЙ';
        }
        if (item.userAnswer === optIdx && !item.isCorrect) {
          optClass = 'text-danger';
          badgeText = ' ✗ ВАШ ОТВЕТ';
        } else if (item.userAnswer === optIdx && item.isCorrect) {
          badgeText = ' (Ваш выбор)';
        }

        optionsHtml += `<li class="${optClass}">${optIdx + 1}. ${escapeHtml(opt)} <strong>${badgeText}</strong></li>`;
      });

      rCard.innerHTML = `
        <div class="search-item-header">
          <span class="question-section-pill">Вопрос ${idx + 1} • ${escapeHtml(q.section)}</span>
          <span class="badge ${item.isCorrect ? 'badge-success' : 'badge-danger'}">
            ${item.isCorrect ? '✓ Верно' : '✗ Ошибка'}
          </span>
        </div>
        <div class="search-item-question">${idx + 1}. ${escapeHtml(q.question)}</div>
        ${q.diagram ? `<div class="question-diagram-box"><img src="${encodeURI(q.diagram)}" style="max-height:240px"></div>` : ''}
        <ul style="padding-left: 20px; font-size: 0.95rem; line-height: 1.6;">${optionsHtml}</ul>
        <div class="search-item-footer">
          <span>Скриншот: ${escapeHtml(q.filename)}</span>
          <button class="btn btn-sm btn-outline" data-view-scr="${q.id}">Показать оригинал</button>
        </div>
      `;

      rCard.querySelector('[data-view-scr]').addEventListener('click', () => openScreenshotModal(q));
      elements.examReviewContainer.appendChild(rCard);
    });
  }

  function renderExamHistory() {
    if (!progress.history || progress.history.length === 0) {
      elements.examHistoryBox.style.display = 'none';
      return;
    }
    elements.examHistoryBox.style.display = 'block';
    elements.examHistoryList.innerHTML = '';

    progress.history.slice(0, 5).forEach(h => {
      const item = document.createElement('div');
      item.className = 'history-item';
      item.style.display = 'flex';
      item.style.justifyContent = 'space-between';
      item.style.padding = '8px 12px';
      item.style.borderBottom = '1px solid var(--border-light)';
      item.style.fontSize = '0.9rem';

      item.innerHTML = `
        <div>
          <strong>${h.passed ? '✓ Сдан' : '✗ Не сдан'}</strong> (${h.score} из ${h.total})
          <span style="color:var(--text-muted); margin-left:8px;">${h.duration || ''}</span>
        </div>
        <div style="color:var(--text-muted); font-size:0.8rem;">${h.date}</div>
      `;
      elements.examHistoryList.appendChild(item);
    });
  }

  // ==========================================
  // MODE 2: SECTIONS TRAINING IMPLEMENTATION
  // ==========================================

  function setupSectionsMode() {
    filterSectionQuestions();
    renderSectionQuestion(0);
  }

  function filterSectionQuestions() {
    const secVal = elements.sectionSelect.value;
    const orderVal = elements.sectionOrder.value;

    let list = (secVal === 'all')
      ? [...allQuestions]
      : allQuestions.filter(q => q.section === secVal);

    if (orderVal === 'unanswered') {
      const stats = progress.questionStats || {};
      list = list.filter(q => !stats[q.id] || stats[q.id].answered === 0);
    } else if (orderVal === 'random') {
      // Shuffle
      list = [...list].sort(() => Math.random() - 0.5);
    }

    sectionFiltered = list;
    elements.secTotalCount.textContent = list.length;
    sectionCurrentIdx = 0;
  }

  function renderSectionQuestion(idx) {
    if (sectionFiltered.length === 0) {
      elements.sectionQuestionCard.innerHTML = `
        <div class="empty-card">
          <div class="empty-icon">📂</div>
          <h2>Нет доступных вопросов</h2>
          <p>В выбранном разделе или по текущему фильтру нет вопросов.</p>
        </div>
      `;
      elements.secCurrentIndex.textContent = '0';
      return;
    }

    if (idx < 0) idx = 0;
    if (idx >= sectionFiltered.length) idx = sectionFiltered.length - 1;
    sectionCurrentIdx = idx;
    elements.secCurrentIndex.textContent = idx + 1;

    const q = sectionFiltered[idx];
    sectionUserAnswer = null;

    renderGenericQuestionCard(
      elements.sectionQuestionCard,
      q,
      idx,
      sectionFiltered.length,
      elements.instantFeedbackToggle.checked,
      (selectedIdx) => {
        sectionUserAnswer = selectedIdx;
      },
      () => {
        if (sectionCurrentIdx < sectionFiltered.length - 1) {
          renderSectionQuestion(sectionCurrentIdx + 1);
        }
      }
    );
  }

  // ==========================================
  // MODE 3: MISTAKES IMPLEMENTATION
  // ==========================================

  function setupMistakesMode() {
    const mistakeIds = progress.mistakes || [];
    mistakeFiltered = mistakeIds.map(id => questionsMap.get(id)).filter(Boolean);

    if (mistakeFiltered.length === 0) {
      elements.mistakesEmptyCard.style.display = 'block';
      elements.mistakesActiveContainer.style.display = 'none';
      return;
    }

    elements.mistakesEmptyCard.style.display = 'none';
    elements.mistakesActiveContainer.style.display = 'flex';
    elements.mistakeTotalCount.textContent = mistakeFiltered.length;
    renderMistakeQuestion(0);
  }

  function renderMistakeQuestion(idx) {
    if (mistakeFiltered.length === 0) {
      setupMistakesMode();
      return;
    }
    if (idx < 0) idx = 0;
    if (idx >= mistakeFiltered.length) idx = mistakeFiltered.length - 1;
    mistakeCurrentIdx = idx;
    elements.mistakeCurrentIndex.textContent = idx + 1;

    const q = mistakeFiltered[idx];
    renderGenericQuestionCard(
      elements.mistakeQuestionCard,
      q,
      idx,
      mistakeFiltered.length,
      true, // Always instant feedback for mistakes!
      (selectedIdx) => {
        mistakeUserAnswer = selectedIdx;
      },
      () => {
        if (mistakeCurrentIdx < mistakeFiltered.length - 1) {
          renderMistakeQuestion(mistakeCurrentIdx + 1);
        }
      }
    );
  }

  function clearCurrentMistake() {
    if (mistakeFiltered.length === 0) return;
    const q = mistakeFiltered[mistakeCurrentIdx];
    const idx = progress.mistakes.indexOf(q.id);
    if (idx >= 0) {
      progress.mistakes.splice(idx, 1);
      saveProgress();
      showToast('Вопрос удален из списка ошибок');
      setupMistakesMode();
    }
  }

  // ==========================================
  // MODE 4: FAVORITES IMPLEMENTATION
  // ==========================================

  function setupFavoritesMode() {
    const favIds = progress.starred || [];
    favFiltered = favIds.map(id => questionsMap.get(id)).filter(Boolean);

    if (favFiltered.length === 0) {
      elements.favoritesEmptyCard.style.display = 'block';
      elements.favoritesActiveContainer.style.display = 'none';
      return;
    }

    elements.favoritesEmptyCard.style.display = 'none';
    elements.favoritesActiveContainer.style.display = 'flex';
    elements.favTotalCount.textContent = favFiltered.length;
    renderFavQuestion(0);
  }

  function renderFavQuestion(idx) {
    if (favFiltered.length === 0) {
      setupFavoritesMode();
      return;
    }
    if (idx < 0) idx = 0;
    if (idx >= favFiltered.length) idx = favFiltered.length - 1;
    favCurrentIdx = idx;
    elements.favCurrentIndex.textContent = idx + 1;

    const q = favFiltered[idx];
    renderGenericQuestionCard(
      elements.favoritesQuestionCard,
      q,
      idx,
      favFiltered.length,
      true,
      (selectedIdx) => {
        favUserAnswer = selectedIdx;
      },
      () => {
        if (favCurrentIdx < favFiltered.length - 1) {
          renderFavQuestion(favCurrentIdx + 1);
        }
      }
    );
  }

  // ==========================================
  // MODE 5: SEARCH IMPLEMENTATION
  // ==========================================

  function performSearch() {
    const query = elements.searchInput.value.trim().toLowerCase();
    const secFilter = elements.searchSectionFilter.value;

    let results = allQuestions;

    if (secFilter) {
      results = results.filter(q => q.section === secFilter);
    }

    if (query) {
      results = results.filter(q => {
        return (
          q.question.toLowerCase().includes(query) ||
          q.correct_answer.toLowerCase().includes(query) ||
          q.options.some(opt => opt.toLowerCase().includes(query)) ||
          q.filename.toLowerCase().includes(query)
        );
      });
    }

    elements.searchResultsCount.textContent = results.length;
    elements.clearSearchBtn.style.display = query ? 'block' : 'none';

    // Limit rendering to top 80 for blistering performance
    const renderLimit = 80;
    const slice = results.slice(0, renderLimit);

    elements.searchResultsList.innerHTML = '';
    if (slice.length === 0) {
      elements.searchResultsList.innerHTML = `
        <div class="empty-card">
          <div class="empty-icon">🔎</div>
          <h2>Ничего не найдено</h2>
          <p>Попробуйте изменить поисковый запрос или выбрать другой раздел.</p>
        </div>
      `;
      return;
    }

    slice.forEach((q, idx) => {
      const itemCard = document.createElement('div');
      itemCard.className = 'search-item-card';

      let optionsList = '<ol style="padding-left: 20px; font-size: 0.92rem; line-height: 1.5; margin: 8px 0;">';
      q.options.forEach((opt, optIdx) => {
        const isCorr = (optIdx === q.correct_index);
        optionsList += `<li style="${isCorr ? 'color: var(--success); font-weight: 700;' : 'color: var(--text-muted);'}">${escapeHtml(opt)}${isCorr ? ' ✓' : ''}</li>`;
      });
      optionsList += '</ol>';

      itemCard.innerHTML = `
        <div class="search-item-header">
          <span class="question-section-pill">${escapeHtml(q.section)}</span>
          <button class="btn-star ${progress.starred && progress.starred.includes(q.id) ? 'starred' : ''}" data-star-qid="${q.id}">
            ${progress.starred && progress.starred.includes(q.id) ? '★ В избранном' : '☆ В избранное'}
          </button>
        </div>
        <div class="search-item-question">${escapeHtml(q.question)}</div>
        ${q.diagram ? `<div class="question-diagram-box"><img src="${encodeURI(q.diagram)}" style="max-height: 220px;"></div>` : ''}
        ${optionsList}
        <div class="search-item-footer">
          <span>Файл: ${escapeHtml(q.filename)}</span>
          <button class="btn btn-sm btn-outline" data-view-scr="${q.id}">Оригинальный скриншот (S)</button>
        </div>
      `;

      itemCard.querySelector('[data-star-qid]').addEventListener('click', () => {
        const isStarred = toggleStarQuestion(q.id);
        const btn = itemCard.querySelector('[data-star-qid]');
        btn.classList.toggle('starred', isStarred);
        btn.innerHTML = isStarred ? '★ В избранном' : '☆ В избранное';
      });

      itemCard.querySelector('[data-view-scr]').addEventListener('click', () => openScreenshotModal(q));
      elements.searchResultsList.appendChild(itemCard);
    });

    if (results.length > renderLimit) {
      const moreInfo = document.createElement('div');
      moreInfo.style.textAlign = 'center';
      moreInfo.style.padding = '16px';
      moreInfo.style.color = 'var(--text-muted)';
      moreInfo.textContent = `Показано первых ${renderLimit} из ${results.length} результатов. Уточните поиск для сужения выборки.`;
      elements.searchResultsList.appendChild(moreInfo);
    }
  }

  // ==========================================
  // GENERIC QUESTION CARD RENDERER
  // (Enforces CANONICAL 1..N ORDER strictly!)
  // ==========================================

  function renderGenericQuestionCard(cardElem, q, idx, total, instantFeedback, onSelect, onNext) {
    cardElem.innerHTML = '';

    // Header
    const header = document.createElement('div');
    header.className = 'question-header';
    header.innerHTML = `
      <div class="question-meta">
        <span class="question-section-pill">${escapeHtml(q.section)}</span>
        <span class="question-filename">Вопрос ${idx + 1} из ${total} • ${escapeHtml(q.filename)}</span>
      </div>
      <div class="question-actions-top">
        <button class="btn-star ${progress.starred && progress.starred.includes(q.id) ? 'starred' : ''}" data-star-qid="${q.id}">
          ${progress.starred && progress.starred.includes(q.id) ? '★ В избранном' : '☆ В избранное'}
        </button>
        <button class="btn-screenshot-toggle" data-scr-qid="${q.id}">
          📷 Скриншот (S)
        </button>
      </div>
    `;
    cardElem.appendChild(header);

    // Question Text
    const qText = document.createElement('div');
    qText.className = 'question-text';
    qText.textContent = q.question;
    cardElem.appendChild(qText);

    // Diagram if present
    if (q.diagram) {
      const diagBox = document.createElement('div');
      diagBox.className = 'question-diagram-box';
      diagBox.innerHTML = `
        <img src="${encodeURI(q.diagram)}" alt="Иллюстрация к вопросу">
        <div class="diagram-caption">🔍 Кликните для увеличения или нажмите (S) для полного снимка</div>
      `;
      diagBox.querySelector('img').addEventListener('click', () => openScreenshotModal(q));
      cardElem.appendChild(diagBox);
    }

    // Feedback Container
    const feedbackBox = document.createElement('div');
    feedbackBox.style.display = 'none';
    cardElem.appendChild(feedbackBox);

    // Options List (STRICT CANONICAL 1..N ORDER!)
    const optionsList = document.createElement('div');
    optionsList.className = 'options-list';

    let answered = false;

    q.options.forEach((optText, optIdx) => {
      const btn = document.createElement('button');
      btn.className = 'option-btn';
      btn.dataset.optIdx = optIdx;

      btn.innerHTML = `
        <span class="option-num-badge">${optIdx + 1}</span>
        <span class="option-text">${escapeHtml(optText)}</span>
        <span class="option-hotkey">[${optIdx + 1}]</span>
      `;

      btn.addEventListener('click', () => {
        if (answered && instantFeedback) return;
        handleOptionClick(optIdx);
      });

      optionsList.appendChild(btn);
    });

    cardElem.appendChild(optionsList);

    function handleOptionClick(optIdx) {
      answered = true;
      const isCorrect = (optIdx === q.correct_index);
      recordQuestionAnswer(q.id, isCorrect);
      onSelect(optIdx);

      if (instantFeedback) {
        // Highlight options
        const allBtns = optionsList.querySelectorAll('.option-btn');
        allBtns.forEach((b, bIdx) => {
          b.classList.add('disabled');
          if (bIdx === q.correct_index) {
            b.classList.add('correct');
          } else if (bIdx === optIdx) {
            b.classList.add('incorrect');
          }
        });

        // Show feedback message
        feedbackBox.style.display = 'flex';
        feedbackBox.className = `question-feedback-box ${isCorrect ? 'correct' : 'incorrect'} mt-4`;
        feedbackBox.innerHTML = `
          <span class="feedback-icon">${isCorrect ? '✓' : '✗'}</span>
          <div>
            <strong>${isCorrect ? 'Правильно!' : 'Неверно!'}</strong>
            <div>Правильный ответ: <strong>Вариант ${q.correct_index + 1}</strong> («${escapeHtml(q.correct_answer)}»)</div>
          </div>
        `;
      } else {
        // Just mark selected
        const allBtns = optionsList.querySelectorAll('.option-btn');
        allBtns.forEach((b, bIdx) => {
          b.classList.toggle('selected', bIdx === optIdx);
        });
      }
    }

    // Header actions
    header.querySelector('[data-star-qid]').addEventListener('click', () => toggleStarQuestion(q.id));
    header.querySelector('[data-scr-qid]').addEventListener('click', () => openScreenshotModal(q));
  }

  // ==========================================
  // MODAL: ORIGINAL SCREENSHOT VIEWER
  // ==========================================

  let currentModalQuestion = null;

  function openScreenshotModal(q) {
    currentModalQuestion = q;
    elements.modalTitle.textContent = `Вопрос: ${q.question.substring(0, 60)}...`;
    elements.modalFilename.textContent = `${q.section} / ${q.filename}`;
    elements.modalScreenshotImg.src = encodeURI(q.screenshot);
    elements.modalDownloadLink.href = encodeURI(q.screenshot);
    elements.screenshotModal.classList.add('open');
  }

  function closeScreenshotModal() {
    elements.screenshotModal.classList.remove('open');
    elements.modalScreenshotImg.src = '';
    currentModalQuestion = null;
  }

  function toggleScreenshotForCurrent() {
    if (elements.screenshotModal.classList.contains('open')) {
      closeScreenshotModal();
      return;
    }

    let q = null;
    if (currentMode === 'exam' && examQuestions[examCurrentIdx]) {
      q = examQuestions[examCurrentIdx];
    } else if (currentMode === 'sections' && sectionFiltered[sectionCurrentIdx]) {
      q = sectionFiltered[sectionCurrentIdx];
    } else if (currentMode === 'mistakes' && mistakeFiltered[mistakeCurrentIdx]) {
      q = mistakeFiltered[mistakeCurrentIdx];
    } else if (currentMode === 'favorites' && favFiltered[favCurrentIdx]) {
      q = favFiltered[favCurrentIdx];
    }

    if (q) openScreenshotModal(q);
  }

  // ==========================================
  // KEYBOARD SHORTCUTS & EVENT LISTENERS
  // ==========================================

  function setupEventListeners() {
    // Nav items
    elements.navItems.forEach(item => {
      item.addEventListener('click', () => switchMode(item.dataset.mode));
    });

    // Theme toggle
    elements.themeToggleBtn.addEventListener('click', toggleTheme);

    // Exam controls
    elements.startExamBtn.addEventListener('click', startExam);
    elements.finishExamBtn.addEventListener('click', () => {
      if (confirm('Вы уверены, что хотите завершить экзамен и узнать результаты?')) {
        finishExam();
      }
    });

    // Sections controls
    elements.sectionSelect.addEventListener('change', () => {
      filterSectionQuestions();
      renderSectionQuestion(0);
    });
    elements.sectionOrder.addEventListener('change', () => {
      filterSectionQuestions();
      renderSectionQuestion(0);
    });
    elements.resetSectionFilterBtn.addEventListener('click', () => {
      elements.sectionSelect.value = 'all';
      elements.sectionOrder.value = 'direct';
      filterSectionQuestions();
      renderSectionQuestion(0);
    });
    elements.secPrevBtn.addEventListener('click', () => {
      if (sectionCurrentIdx > 0) renderSectionQuestion(sectionCurrentIdx - 1);
    });
    elements.secNextBtn.addEventListener('click', () => {
      if (sectionCurrentIdx < sectionFiltered.length - 1) renderSectionQuestion(sectionCurrentIdx + 1);
    });

    // Mistakes controls
    elements.mistakePrevBtn.addEventListener('click', () => {
      if (mistakeCurrentIdx > 0) renderMistakeQuestion(mistakeCurrentIdx - 1);
    });
    elements.mistakeNextBtn.addEventListener('click', () => {
      if (mistakeCurrentIdx < mistakeFiltered.length - 1) renderMistakeQuestion(mistakeCurrentIdx + 1);
    });
    elements.clearCurrentMistakeBtn.addEventListener('click', clearCurrentMistake);

    // Favorites controls
    elements.favPrevBtn.addEventListener('click', () => {
      if (favCurrentIdx > 0) renderFavQuestion(favCurrentIdx - 1);
    });
    elements.favNextBtn.addEventListener('click', () => {
      if (favCurrentIdx < favFiltered.length - 1) renderFavQuestion(favCurrentIdx + 1);
    });

    // Search controls
    elements.searchInput.addEventListener('input', () => {
      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = setTimeout(performSearch, 200);
    });
    elements.clearSearchBtn.addEventListener('click', () => {
      elements.searchInput.value = '';
      performSearch();
    });
    elements.searchSectionFilter.addEventListener('change', performSearch);

    // Modal
    elements.modalCloseBtn.addEventListener('click', closeScreenshotModal);
    elements.screenshotModal.addEventListener('click', (e) => {
      if (e.target === elements.screenshotModal) closeScreenshotModal();
    });

    // GLOBAL HOTKEYS
    window.addEventListener('keydown', handleGlobalKeydown);
  }

  function handleGlobalKeydown(e) {
    // If typing in input, ignore hotkeys except Esc
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') {
      if (e.key === 'Escape') {
        e.target.blur();
      }
      return;
    }

    // Modal open handling
    if (elements.screenshotModal.classList.contains('open')) {
      if (e.key === 'Escape' || e.key.toLowerCase() === 's' || e.key.toLowerCase() === 'ы') {
        closeScreenshotModal();
        e.preventDefault();
      }
      return;
    }

    const key = e.key;

    // Keys 1..6: Select Option
    if (key >= '1' && key <= '6') {
      const optIdx = parseInt(key, 10) - 1;
      // Try active panel first, then exam card
      const btns = (currentMode === 'exam')
        ? elements.examQuestionCard.querySelectorAll('.option-btn')
        : document.querySelectorAll('.view-panel.active .option-btn');
      if (btns[optIdx]) {
        btns[optIdx].click();
        e.preventDefault();
      }
      return;
    }

    // S or Ы: Toggle screenshot
    if (key.toLowerCase() === 's' || key.toLowerCase() === 'ы') {
      toggleScreenshotForCurrent();
      e.preventDefault();
      return;
    }

    // F or А: Toggle Star
    if (key.toLowerCase() === 'f' || key.toLowerCase() === 'а') {
      let q = getCurrentActiveQuestion();
      if (q) {
        toggleStarQuestion(q.id);
        e.preventDefault();
      }
      return;
    }

    // Left Arrow / A / Ф: Previous
    if (key === 'ArrowLeft' || key.toLowerCase() === 'a' || key.toLowerCase() === 'ф') {
      triggerPrevious();
      e.preventDefault();
      return;
    }

    // Right Arrow / D / В: Next
    if (key === 'ArrowRight' || key.toLowerCase() === 'd' || key.toLowerCase() === 'в') {
      triggerNext();
      e.preventDefault();
      return;
    }

    // Enter / Space: Advance or Confirm
    if (key === 'Enter' || key === ' ') {
      // If exam mode: next question
      if (currentMode === 'exam' && examActive) {
        if (examCurrentIdx < 13) {
          renderExamQuestion(examCurrentIdx + 1);
        } else {
          finishExam();
        }
        e.preventDefault();
      } else if (currentMode === 'sections') {
        if (sectionCurrentIdx < sectionFiltered.length - 1) {
          renderSectionQuestion(sectionCurrentIdx + 1);
        }
        e.preventDefault();
      } else if (currentMode === 'mistakes') {
        if (mistakeCurrentIdx < mistakeFiltered.length - 1) {
          renderMistakeQuestion(mistakeCurrentIdx + 1);
        }
        e.preventDefault();
      } else if (currentMode === 'favorites') {
        if (favCurrentIdx < favFiltered.length - 1) {
          renderFavQuestion(favCurrentIdx + 1);
        }
        e.preventDefault();
      }
    }
  }

  function getCurrentActiveQuestion() {
    if (currentMode === 'exam' && examQuestions[examCurrentIdx]) {
      return examQuestions[examCurrentIdx];
    } else if (currentMode === 'sections' && sectionFiltered[sectionCurrentIdx]) {
      return sectionFiltered[sectionCurrentIdx];
    } else if (currentMode === 'mistakes' && mistakeFiltered[mistakeCurrentIdx]) {
      return mistakeFiltered[mistakeCurrentIdx];
    } else if (currentMode === 'favorites' && favFiltered[favCurrentIdx]) {
      return favFiltered[favCurrentIdx];
    }
    return null;
  }

  function triggerPrevious() {
    if (currentMode === 'exam' && examActive && examCurrentIdx > 0) {
      renderExamQuestion(examCurrentIdx - 1);
    } else if (currentMode === 'sections' && sectionCurrentIdx > 0) {
      renderSectionQuestion(sectionCurrentIdx - 1);
    } else if (currentMode === 'mistakes' && mistakeCurrentIdx > 0) {
      renderMistakeQuestion(mistakeCurrentIdx - 1);
    } else if (currentMode === 'favorites' && favCurrentIdx > 0) {
      renderFavQuestion(favCurrentIdx - 1);
    }
  }

  function triggerNext() {
    if (currentMode === 'exam' && examActive && examCurrentIdx < 13) {
      renderExamQuestion(examCurrentIdx + 1);
    } else if (currentMode === 'sections' && sectionCurrentIdx < sectionFiltered.length - 1) {
      renderSectionQuestion(sectionCurrentIdx + 1);
    } else if (currentMode === 'mistakes' && mistakeCurrentIdx < mistakeFiltered.length - 1) {
      renderMistakeQuestion(mistakeCurrentIdx + 1);
    } else if (currentMode === 'favorites' && favCurrentIdx < favFiltered.length - 1) {
      renderFavQuestion(favCurrentIdx + 1);
    }
  }

  // ==========================================
  // THEME SUPPORT
  // ==========================================

  function setupTheme() {
    const saved = localStorage.getItem('trainer_1c_theme') || 'dark';
    applyTheme(saved);
  }

  function toggleTheme() {
    const isDark = document.body.classList.contains('theme-dark');
    const newTheme = isDark ? 'light' : 'dark';
    applyTheme(newTheme);
    localStorage.setItem('trainer_1c_theme', newTheme);
  }

  function applyTheme(theme) {
    if (theme === 'light') {
      document.body.classList.remove('theme-dark');
      elements.themeIcon.textContent = '🌙';
      elements.themeText.textContent = 'Тёмная тема';
    } else {
      document.body.classList.add('theme-dark');
      elements.themeIcon.textContent = '☀️';
      elements.themeText.textContent = 'Светлая тема';
    }
  }

  // ==========================================
  // UTILITIES
  // ==========================================

  // ==========================================
  // ERROR BANNER (visible, replaces the '977' illusion on load failure)
  // ==========================================
  function showErrorBanner(msg) {
    let banner = document.getElementById('loadErrorBanner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'loadErrorBanner';
      banner.className = 'load-error-banner';
      banner.style.cssText =
        'position:fixed;top:0;left:0;right:0;z-index:9999;' +
        'background:#8b2320;color:#fff;padding:12px 18px;' +
        'font-family:sans-serif;font-size:0.95rem;text-align:center;' +
        'box-shadow:0 2px 8px rgba(0,0,0,.4);';
      document.body.appendChild(banner);
    }
    banner.textContent = msg;
    banner.style.display = 'block';
  }

  let toastTimer = null;
  function showToast(msg, duration = 2500) {
    clearTimeout(toastTimer);
    elements.toast.textContent = msg;
    elements.toast.classList.add('show');
    toastTimer = setTimeout(() => {
      elements.toast.classList.remove('show');
    }, duration);
  }

  function escapeHtml(text) {
    if (!text) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Boot
  document.addEventListener('DOMContentLoaded', init);
})();
