(function () {
  'use strict';

  var DB_NAME = 'RingforgedReader';
  var DB_VERSION = 1;
  var STORE = 'progress';

  var path = location.pathname.replace(/\\/g, '/');
  var fileName = decodeURIComponent(path.split('/').pop() || '');
  var isIndex = !fileName || fileName === 'index.html';

  // Карта томов/интерлюдий для глобальной навигации
  var TOC = [
    { href: '\u0438\u043d\u0442\u0435\u0440\u043b\u044e\u0434\u0438\u044f-01.html', label: '\u0418\u043d\u0442\u0435\u0440\u043b\u044e\u0434\u0438\u044f', title: '\u041f\u043b\u0430\u043d\u0435\u0442\u0430 \u0410\u0443\u0440\u0430\u043a\u0441', type: 'int' },
    { href: '\u0442\u043e\u043c-1.html', label: '\u0422\u043e\u043c I', title: '\u041f\u0435\u043f\u0435\u043b \u043d\u0430\u0434 \u0414\u043e\u043b\u043e\u043c', type: 'vol' },
    { href: '\u0438\u043d\u0442\u0435\u0440\u043b\u044e\u0434\u0438\u044f-02.html', label: '\u0418\u043d\u0442\u0435\u0440\u043b\u044e\u0434\u0438\u044f', title: '\u0412\u0435\u043b\u0438\u043a\u043e\u0435 \u0414\u044b\u0445\u0430\u043d\u0438\u0435 / 10 \u0441\u0442\u0438\u0445\u0438\u0439', type: 'int' },
    { href: '\u0442\u043e\u043c-2.html', label: '\u0422\u043e\u043c II', title: '\u041b\u0430\u0437\u0443\u0440\u043d\u044b\u0435 \u0441\u043b\u0451\u0437\u044b \u0438 \u041f\u0435\u0440\u0432\u044b\u0435 \u043a\u043b\u0438\u043d\u043a\u0438', type: 'vol' },
    { href: '\u0438\u043d\u0442\u0435\u0440\u043b\u044e\u0434\u0438\u044f-03.html', label: '\u0418\u043d\u0442\u0435\u0440\u043b\u044e\u0434\u0438\u044f', title: '\u041b\u0430\u0437\u0443\u0440\u043d\u044b\u0435 \u0420\u0435\u043a\u0438 / \u0421\u043b\u0438\u044f\u043d\u0438\u0435', type: 'int' },
    { href: '\u0442\u043e\u043c-3.html', label: '\u0422\u043e\u043c III', title: '\u0420\u0436\u0430\u0432\u043e\u0435 \u0421\u0435\u0440\u0434\u0446\u0435 \u043f\u0443\u0441\u0442\u044b\u043d\u0438', type: 'vol' },
    { href: '\u0438\u043d\u0442\u0435\u0440\u043b\u044e\u0434\u0438\u044f-04.html', label: '\u0418\u043d\u0442\u0435\u0440\u043b\u044e\u0434\u0438\u044f', title: '\u0422\u0435\u043a\u0442\u0440\u043e\u043d / \u0418\u043c\u043f\u0435\u0440\u0438\u044f \u0418\u0433\u043d\u0438\u0441', type: 'int' },
    { href: '\u0442\u043e\u043c-4.html', label: '\u0422\u043e\u043c IV', title: '\u0418\u0441\u043a\u0430\u0436\u0451\u043d\u043d\u0430\u044f \u0418\u0441\u0442\u0438\u043d\u0430 \u0438 \u0421\u0433\u043e\u0440\u0435\u0432\u0448\u0438\u0439 \u0428\u0430\u0440\u0444', type: 'vol' },
    { href: '\u0438\u043d\u0442\u0435\u0440\u043b\u044e\u0434\u0438\u044f-05.html', label: '\u0418\u043d\u0442\u0435\u0440\u043b\u044e\u0434\u0438\u044f', title: '\u0410\u0443\u0440\u0443\u043c\u0433\u0430\u0440\u0434: \u0417\u043e\u043b\u043e\u0442\u043e \u0438 \u0422\u0435\u043d\u0438', type: 'int' },
    { href: '\u0442\u043e\u043c-5.html', label: '\u0422\u043e\u043c V', title: '\u041d\u0435\u0431\u0435\u0441\u0430 \u0434\u043b\u044f \u043f\u0430\u0434\u0448\u0438\u0445', type: 'vol' },
    { href: '\u0438\u043d\u0442\u0435\u0440\u043b\u044e\u0434\u0438\u044f-06.html', label: '\u0418\u043d\u0442\u0435\u0440\u043b\u044e\u0434\u0438\u044f', title: '\u0417\u0430\u043f\u0440\u0435\u0442\u043d\u0430\u044f \u043c\u0430\u0433\u0438\u044f / \u041a\u0443\u043b\u044c\u0442 \u041e\u043c\u0435\u0433\u0430', type: 'int' },
    { href: '\u0442\u043e\u043c-6.html', label: '\u0422\u043e\u043c VI', title: '\u0422\u0435\u043d\u044c \u0423\u0440\u043e\u0431\u043e\u0440\u043e\u0441\u0430', type: 'vol' },
    { href: '\u0438\u043d\u0442\u0435\u0440\u043b\u044e\u0434\u0438\u044f-07.html', label: '\u0418\u043d\u0442\u0435\u0440\u043b\u044e\u0434\u0438\u044f', title: '\u041c\u0451\u0440\u0442\u0432\u0430\u044f \u0417\u043e\u043d\u0430', type: 'int' },
    { href: '\u0442\u043e\u043c-7.html', label: '\u0422\u043e\u043c VII', title: '\u041d\u0443\u043b\u0435\u0432\u043e\u0439 \u0427\u0430\u0441', type: 'vol' },
    { href: '\u0438\u043d\u0442\u0435\u0440\u043b\u044e\u0434\u0438\u044f-08.html', label: '\u0418\u043d\u0442\u0435\u0440\u043b\u044e\u0434\u0438\u044f', title: '\u041f\u043e\u0433\u0440\u0430\u043d\u0438\u0447\u044c\u0435: \u0417\u0430 \u0437\u0435\u0440\u043a\u0430\u043b\u043e\u043c', type: 'int' },
    { href: '\u0442\u043e\u043c-8.html', label: '\u0422\u043e\u043c VIII', title: '\u041f\u043e\u0441\u043b\u0435\u0434\u043d\u0438\u0439 \u0420\u0430\u0441\u043a\u043e\u043b', type: 'vol' }
  ];

  // ============================
  // DB HELPERS
  // ============================

  function openDB(cb) {
    var rq = indexedDB.open(DB_NAME, DB_VERSION);
    rq.onupgradeneeded = function (e) {
      var db = e.target.result;
      if (!db.objectStoreNames.contains(STORE))
        db.createObjectStore(STORE, { keyPath: 'page' });
    };
    rq.onsuccess = function (e) { cb(e.target.result); };
    rq.onerror = function () {};
  }

  function dbPut(db, d) {
    try { db.transaction(STORE, 'readwrite').objectStore(STORE).put(d); } catch (e) {}
  }

  function dbGet(db, k, cb) {
    try {
      var r = db.transaction(STORE, 'readonly').objectStore(STORE).get(k);
      r.onsuccess = function () { cb(r.result || null); };
      r.onerror = function () { cb(null); };
    } catch (e) { cb(null); }
  }

  function dbGetAll(db, cb) {
    try {
      var r = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
      r.onsuccess = function () { cb(r.result || []); };
      r.onerror = function () { cb([]); };
    } catch (e) { cb([]); }
  }

  // ============================
  // 1. SCROLL-TRIGGERED REVEAL
  // ============================

  function initReveal() {
    document.querySelectorAll(
      '.index-hero, .index-hero h1, .index-hero .subtitle,' +
      '.volume-list li, .interlude, .volume-header,' +
      'h2, .chapter-divider, .interlude-divider, .char-card, .gallery-section h2'
    ).forEach(function (el) {
      if (!el.classList.contains('reveal') && !el.classList.contains('reveal-stagger'))
        el.classList.add('reveal');
    });

    document.querySelectorAll('.volume-list li').forEach(function (li, i) {
      li.classList.remove('reveal');
      li.classList.add('reveal-stagger');
      li.style.transitionDelay = (i * 0.06) + 's';
    });

    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -30px 0px' });

    document.querySelectorAll('.reveal, .reveal-stagger').forEach(function (el) { obs.observe(el); });
  }

  // ============================
  // 2. READING PROGRESS BAR
  // ============================

  function initProgressBar() {
    if (isIndex) return;
    var bar = document.createElement('div');
    bar.className = 'reading-progress';
    document.body.appendChild(bar);
    function upd() {
      var h = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.width = h > 0 ? Math.min(window.scrollY / h * 100, 100) + '%' : '0%';
    }
    window.addEventListener('scroll', upd, { passive: true });
    upd();
  }

  // ============================
  // 3. MINIMAP (точки сбоку — внутри тома/интерлюдии)
  // ============================

  var headings = [];

  function initMinimap() {
    headings = Array.from(document.querySelectorAll('h2[id], h3[id]'));
    if (headings.length < 2) return;

    var mm = document.createElement('nav');
    mm.className = 'minimap';
    headings.forEach(function (h, i) {
      if (!h.id) h.id = 'sec-' + i;
      var dot = document.createElement('a');
      dot.href = '#' + h.id;
      dot.className = 'mm-dot' + (h.tagName === 'H3' ? ' mm-sub' : '');
      dot.title = h.textContent;
      var tip = document.createElement('span');
      tip.className = 'mm-tip';
      tip.textContent = h.textContent;
      dot.appendChild(tip);
      dot.addEventListener('click', function (e) {
        e.preventDefault();
        h.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      mm.appendChild(dot);
    });
    document.body.appendChild(mm);

    new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        mm.querySelectorAll('.mm-dot').forEach(function (d) { d.classList.remove('active'); });
        var idx = headings.indexOf(entry.target);
        if (idx >= 0) mm.children[idx].classList.add('active');
      });
    }, { threshold: 0, rootMargin: '-10% 0px -80% 0px' }).observe(headings[0]);
    headings.forEach(function (h) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          mm.querySelectorAll('.mm-dot').forEach(function (d) { d.classList.remove('active'); });
          var idx = headings.indexOf(entry.target);
          if (idx >= 0) mm.children[idx].classList.add('active');
        });
      }, { threshold: 0, rootMargin: '-10% 0px -80% 0px' }).observe(h);
    });
  }

  // ============================
  // 4. SCROLL-TO-TOP
  // ============================

  function initScrollTop() {
    var btn = document.createElement('button');
    btn.className = 'scroll-top';
    btn.innerHTML = '&#9650;';
    btn.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });
    document.body.appendChild(btn);
    window.addEventListener('scroll', function () {
      btn.classList.toggle('show', window.scrollY > 600);
    }, { passive: true });
  }

  // ============================
  // 5. GLOBAL NAV — выдвижная панель со всеми томами
  // ============================

  function initGlobalNav() {
    // Кнопка-бургер
    var fab = document.createElement('button');
    fab.className = 'gnav-fab';
    fab.innerHTML = '<span></span><span></span><span></span>';
    fab.title = 'Навигация';
    document.body.appendChild(fab);

    // Overlay
    var overlay = document.createElement('div');
    overlay.className = 'gnav-overlay';
    document.body.appendChild(overlay);

    // Панель
    var panel = document.createElement('nav');
    panel.className = 'gnav-panel';

    var head = document.createElement('div');
    head.className = 'gnav-head';
    head.innerHTML = '<a href="index.html" class="gnav-logo">Ringforged</a>' +
      '<button class="gnav-close">&times;</button>';
    panel.appendChild(head);

    var list = document.createElement('div');
    list.className = 'gnav-list';

    TOC.forEach(function (item) {
      var a = document.createElement('a');
      a.href = item.href;
      a.className = 'gnav-item' + (item.type === 'int' ? ' gnav-int' : ' gnav-vol');

      var isCurrent = (fileName === item.href);
      if (isCurrent) a.classList.add('gnav-current');

      a.innerHTML =
        '<span class="gnav-label">' + item.label + '</span>' +
        '<span class="gnav-title">' + item.title + '</span>' +
        '<span class="gnav-ring"></span>';

      list.appendChild(a);
    });

    panel.appendChild(list);

    // Галерея внизу
    var extra = document.createElement('div');
    extra.className = 'gnav-extra';
    extra.innerHTML = '<a href="\u0433\u0430\u043b\u0435\u0440\u0435\u044f.html" class="gnav-item gnav-gal">' +
      '<span class="gnav-label">\u0413\u0430\u043b\u0435\u0440\u0435\u044f</span>' +
      '<span class="gnav-title">\u041f\u0435\u0440\u0441\u043e\u043d\u0430\u0436\u0438 \u0438 \u0444\u0440\u0430\u043a\u0446\u0438\u0438</span></a>';
    panel.appendChild(extra);

    document.body.appendChild(panel);

    function toggle() {
      var open = panel.classList.toggle('open');
      fab.classList.toggle('open', open);
      overlay.classList.toggle('open', open);
    }

    fab.addEventListener('click', toggle);
    overlay.addEventListener('click', toggle);
    head.querySelector('.gnav-close').addEventListener('click', toggle);

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && panel.classList.contains('open')) toggle();
    });

    // Заполнить кружки прогресса
    openDB(function (db) {
      dbGetAll(db, function (allData) {
        list.querySelectorAll('.gnav-item').forEach(function (a) {
          var href = a.getAttribute('href');
          var rec = allData.find(function (d) { return d.page === href; });
          var ring = a.querySelector('.gnav-ring');
          if (rec && rec.percent > 0 && ring) {
            ring.style.background = 'conic-gradient(var(--accent) ' + (rec.percent * 3.6) + 'deg, var(--border) 0deg)';
            ring.title = rec.percent + '%';
          }
        });
      });
    });
  }

  // ============================
  // 6. SAVE PROGRESS (не index)
  // ============================

  function initSaveProgress() {
    if (isIndex) return;
    var key = fileName || 'index.html';
    var timer = null;

    openDB(function (db) {
      dbGet(db, key, function (data) {
        if (data && data.scrollY > 200) showResumeToast(data);
      });

      window.addEventListener('scroll', function () {
        if (timer) clearTimeout(timer);
        timer = setTimeout(function () {
          var sy = window.scrollY;
          var h = document.documentElement.scrollHeight - window.innerHeight;
          var pct = h > 0 ? Math.round(sy / h * 100) : 0;
          var ch = '';
          headings.forEach(function (hd) { if (hd.getBoundingClientRect().top < 150) ch = hd.textContent; });
          dbPut(db, { page: key, scrollY: sy, percent: pct, chapter: ch, timestamp: Date.now() });
        }, 600);
      }, { passive: true });
    });
  }

  function showResumeToast(data) {
    var toast = document.createElement('div');
    toast.className = 'resume-toast';
    var label = data.chapter || (data.percent + '%');
    toast.innerHTML =
      '<div class="resume-toast-text">\u041f\u0440\u043e\u0434\u043e\u043b\u0436\u0438\u0442\u044c \u0447\u0442\u0435\u043d\u0438\u0435<small>' +
      label + ' \u00b7 ' + data.percent + '% \u043f\u0440\u043e\u0447\u0438\u0442\u0430\u043d\u043e</small></div>' +
      '<button class="resume-toast-btn">\u041f\u0435\u0440\u0435\u0439\u0442\u0438</button>' +
      '<button class="resume-toast-dismiss">&times;</button>';
    document.body.appendChild(toast);
    requestAnimationFrame(function () { requestAnimationFrame(function () { toast.classList.add('show'); }); });
    toast.querySelector('.resume-toast-btn').addEventListener('click', function () {
      window.scrollTo({ top: data.scrollY, behavior: 'smooth' }); dismiss();
    });
    toast.querySelector('.resume-toast-dismiss').addEventListener('click', dismiss);
    var tid = setTimeout(dismiss, 8000);
    function dismiss() { clearTimeout(tid); toast.classList.remove('show'); setTimeout(function () { toast.remove(); }, 500); }
  }

  // ============================
  // 7. INDEX: кружки + тост → другая страница
  // ============================

  function initIndex() {
    if (!isIndex) return;

    openDB(function (db) {
      dbGetAll(db, function (allData) {
        if (!allData.length) return;

        var latest = null;
        var links = document.querySelectorAll('.volume-list a');

        // SVG-кружки на карточках
        links.forEach(function (link) {
          var href = link.getAttribute('href');
          if (!href) return;
          var rec = allData.find(function (d) { return d.page === href; });
          if (!rec || rec.percent <= 0) return;
          if (!latest || rec.timestamp > latest.timestamp) latest = rec;
          addCircle(link, rec.percent);
        });

        // Тост — перенаправление на страницу
        if (latest && latest.percent > 0 && latest.percent < 100) {
          showIndexResume(latest);
        }
      });
    });
  }

  function addCircle(link, pct) {
    var s = 32, sw = 3, r = (s - sw) / 2, c = 2 * Math.PI * r, off = c - (pct / 100) * c;
    var ns = 'http://www.w3.org/2000/svg';

    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('width', s); svg.setAttribute('height', s);
    svg.setAttribute('class', 'progress-ring');
    svg.style.cssText = 'position:absolute;right:1rem;top:50%;transform:translateY(-50%);';

    var bg = document.createElementNS(ns, 'circle');
    bg.setAttribute('cx', s/2); bg.setAttribute('cy', s/2); bg.setAttribute('r', r);
    bg.setAttribute('fill', 'none'); bg.setAttribute('stroke', 'rgba(176,141,87,0.15)');
    bg.setAttribute('stroke-width', sw);

    var fg = document.createElementNS(ns, 'circle');
    fg.setAttribute('cx', s/2); fg.setAttribute('cy', s/2); fg.setAttribute('r', r);
    fg.setAttribute('fill', 'none'); fg.setAttribute('stroke', '#b08d57');
    fg.setAttribute('stroke-width', sw); fg.setAttribute('stroke-linecap', 'round');
    fg.setAttribute('stroke-dasharray', c); fg.setAttribute('stroke-dashoffset', c);
    fg.style.cssText = 'transition:stroke-dashoffset 1s ease;transform:rotate(-90deg);transform-origin:50% 50%;';

    var txt = document.createElementNS(ns, 'text');
    txt.setAttribute('x', '50%'); txt.setAttribute('y', '50%');
    txt.setAttribute('text-anchor', 'middle'); txt.setAttribute('dominant-baseline', 'central');
    txt.setAttribute('fill', '#b08d57'); txt.setAttribute('font-size', '9');
    txt.setAttribute('font-family', 'Cinzel,serif');
    txt.textContent = pct + '%';

    svg.appendChild(bg); svg.appendChild(fg); svg.appendChild(txt);
    link.style.position = 'relative';
    link.appendChild(svg);

    requestAnimationFrame(function () {
      requestAnimationFrame(function () { fg.setAttribute('stroke-dashoffset', off); });
    });
  }

  function showIndexResume(data) {
    var toast = document.createElement('div');
    toast.className = 'resume-toast';

    var tocItem = TOC.find(function (t) { return t.href === data.page; });
    var label = tocItem ? tocItem.title : (data.chapter || data.page);

    toast.innerHTML =
      '<div class="resume-toast-text">\u041f\u0440\u043e\u0434\u043e\u043b\u0436\u0438\u0442\u044c \u0447\u0442\u0435\u043d\u0438\u0435<small>' +
      label + ' \u00b7 ' + data.percent + '%</small></div>' +
      '<button class="resume-toast-btn">\u041f\u0435\u0440\u0435\u0439\u0442\u0438</button>' +
      '<button class="resume-toast-dismiss">&times;</button>';
    document.body.appendChild(toast);
    requestAnimationFrame(function () { requestAnimationFrame(function () { toast.classList.add('show'); }); });

    toast.querySelector('.resume-toast-btn').addEventListener('click', function () {
      window.location.href = data.page + '#rf-resume=' + data.scrollY;
      dismiss();
    });
    toast.querySelector('.resume-toast-dismiss').addEventListener('click', dismiss);
    var tid = setTimeout(dismiss, 12000);
    function dismiss() { clearTimeout(tid); toast.classList.remove('show'); setTimeout(function () { toast.remove(); }, 500); }
  }

  function handleResumeHash() {
    var m = location.hash.match(/rf-resume=(\d+)/);
    if (m) {
      var y = parseInt(m[1], 10);
      history.replaceState(null, '', location.pathname + location.search);
      setTimeout(function () { window.scrollTo({ top: y, behavior: 'smooth' }); }, 200);
    }
  }

  // ============================
  // INIT
  // ============================

  document.addEventListener('DOMContentLoaded', function () {
    initReveal();
    initProgressBar();
    initScrollTop();
    initMinimap();
    initGlobalNav();
    initSaveProgress();
    initIndex();
    handleResumeHash();
  });

})();
