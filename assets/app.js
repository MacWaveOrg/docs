(function () {
    'use strict';

    var OWNER = 'MacWaveOrg';
    var REPO = 'docs';
    var CONTENT_REF = 'main';           /* 文档所在分支，用于 GitHub 链接与原始文件回落 */
    var BLOB = 'https://github.com/' + OWNER + '/' + REPO + '/blob/' + CONTENT_REF + '/';
    var RAW = 'https://raw.githubusercontent.com/' + OWNER + '/' + REPO + '/' + CONTENT_REF + '/';

    /* 站点只提供两份文档，每份只有一个 PDF。
       这里刻意不列目录：仓库里还有 .md / .pages 等中间产物，对读者没有意义。 */
    var DOCS = [
        {
            id: 'history',
            title: { en: 'History', zh: '发展历史' },
            pdf: {
                en: 'history/en/MacWave-History.pdf',
                zh: 'history/zh-Hans/MacWave发展历史.pdf'
            }
        },
        {
            id: 'infosource',
            title: { en: 'infosource', zh: 'infosource' },
            pdf: {
                en: 'infosource/en/MacWave-infosource.pdf',
                zh: 'infosource/zh-Hans/MacWave-infosource.pdf'
            }
        }
    ];

    var STR = {
        loading: { en: 'Loading\u2026', zh: '加载中\u2026' },
        read: { en: 'Read', zh: '阅读' },
        pdf: { en: 'PDF', zh: 'PDF' },
        missing: {
            en: 'The PDF for this language is not published yet.',
            zh: '这个语言的 PDF 还没有发布。'
        }
    };

    var lang = 'en';
    var urlCache = {};

    var el = {
        html: document.documentElement,
        list: document.getElementById('list'),
        notice: document.getElementById('notice'),
        viewer: document.getElementById('viewer'),
        viewerFrame: document.getElementById('viewer-frame'),
        viewerBody: document.getElementById('viewer-body'),
        viewerPages: document.getElementById('viewer-pages'),
        pdfPages: document.getElementById('pdf-pages'),
        pdfStatus: document.getElementById('pdf-status'),
        viewerTitle: document.getElementById('viewer-title'),
        viewerOpen: document.getElementById('viewer-open'),
        viewerGh: document.getElementById('viewer-gh'),
        viewerClose: document.getElementById('viewer-close')
    };

    function t(key) {
        var entry = STR[key];
        return entry ? entry[lang] : key;
    }

    function encodePath(path) {
        return path.split('/').map(encodeURIComponent).join('/');
    }

    /* ---------- 文件地址解析 ----------
       PDF 在 gh-pages 上有一份副本（同源，快），但副本可能落后于 main，
       所以先探测同源地址；不存在时回落到 main 的原始文件。 */

    function resolveFileUrl(path) {
        if (urlCache[path]) return urlCache[path];

        var local = encodeURI(path);
        var remote = RAW + encodePath(path);

        urlCache[path] = fetch(local, { method: 'HEAD', cache: 'no-store' })
            .then(function (response) {
                var type = response.headers.get('content-type') || '';
                if (response.ok && type.indexOf('text/html') === -1) return local;
                return remote;
            })
            .catch(function () {
                return remote;
            });

        return urlCache[path];
    }

    /* ---------- 渲染 ---------- */

    function renderList() {
        el.list.textContent = '';

        var fragment = document.createDocumentFragment();

        DOCS.forEach(function (doc) {
            var row = document.createElement('button');
            row.type = 'button';
            row.className = 'row doc-row';
            row.dataset.docId = doc.id;

            var icon = document.createElement('span');
            icon.className = 'icon pdf';
            icon.textContent = 'PDF';
            icon.setAttribute('aria-hidden', 'true');

            var main = document.createElement('span');
            main.className = 'row-main doc-main';

            var title = document.createElement('span');
            title.className = 'row-name';
            title.textContent = doc.title[lang];
            main.appendChild(title);

            var action = document.createElement('span');
            action.className = 'row-actions';
            var read = document.createElement('span');
            read.className = 'btn btn-primary';
            read.textContent = t('read');
            action.appendChild(read);

            row.appendChild(icon);
            row.appendChild(main);
            row.appendChild(action);

            row.addEventListener('click', function () { openDoc(doc); });

            fragment.appendChild(row);
        });

        el.list.appendChild(fragment);
    }

    /* ---------- PDF 阅读器 ----------
       用 PDF.js 把页面渲染到 canvas，按容器宽度缩放，
       这样手机上不会横向溢出，也能通过滚动翻页。 */

    var pdfjsLoading = null;
    var pdfDoc = null;
    var pdfUrl = '';
    var pdfScale = 1;
    var pdfSizes = [];
    var pdfRendered = [];
    var pdfObserver = null;
    var pdfRenderTask = null;
    var pageTicker = null;

    function loadPdfjs() {
        if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
        if (pdfjsLoading) return pdfjsLoading;

        pdfjsLoading = new Promise(function (resolve, reject) {
            var script = document.createElement('script');
            script.src = 'assets/pdfjs/pdf.min.js';
            script.onload = function () {
                if (!window.pdfjsLib) {
                    reject(new Error('pdfjs missing'));
                    return;
                }
                window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'assets/pdfjs/pdf.worker.min.js';
                resolve(window.pdfjsLib);
            };
            script.onerror = function () { reject(new Error('pdfjs failed')); };
            document.head.appendChild(script);
        });

        return pdfjsLoading;
    }

    function showStatus(text) {
        if (!text) {
            el.pdfStatus.hidden = true;
            el.pdfStatus.textContent = '';
            return;
        }
        el.pdfStatus.textContent = text;
        el.pdfStatus.hidden = false;
    }

    function updatePageIndicator() {
        if (!pdfDoc) return;

        /* 以阅读区顶部向下 35% 处为判定线，按元素实际位置判断当前页 */
        var bodyRect = el.viewerBody.getBoundingClientRect();
        var line = bodyRect.top + bodyRect.height * 0.35;
        var current = 1;

        pdfRendered.forEach(function (page) {
            var rect = page.wrapper.getBoundingClientRect();
            if (rect.top <= line) current = page.number;
        });

        el.viewerPages.textContent = current + ' / ' + pdfDoc.numPages;
        el.viewerPages.hidden = false;
    }

    function clearPdf() {
        if (pdfObserver) {
            pdfObserver.disconnect();
            pdfObserver = null;
        }
        if (pdfRenderTask) {
            try { pdfRenderTask.cancel(); } catch (error) { /* 忽略 */ }
            pdfRenderTask = null;
        }
        pdfRendered = [];
        pdfSizes = [];
        el.pdfPages.textContent = '';
        el.viewerPages.hidden = true;
        if (pdfDoc) {
            try { pdfDoc.destroy(); } catch (error) { /* 忽略 */ }
            pdfDoc = null;
        }
    }

    function renderPage(entry) {
        if (entry.rendering || entry.done) return;
        entry.rendering = true;

        pdfDoc.getPage(entry.number).then(function (page) {
            var ratio = Math.min(window.devicePixelRatio || 1, 2);
            var viewportScaled = page.getViewport({ scale: pdfScale * ratio });

            var canvas = document.createElement('canvas');
            canvas.width = Math.floor(viewportScaled.width);
            canvas.height = Math.floor(viewportScaled.height);
            canvas.style.width = '100%';
            canvas.style.height = 'auto';
            canvas.style.display = 'block';

            entry.wrapper.textContent = '';
            entry.wrapper.appendChild(canvas);
            entry.wrapper.style.height = '';

            pdfRenderTask = page.render({
                canvasContext: canvas.getContext('2d'),
                viewport: viewportScaled
            });

            return pdfRenderTask.promise.then(function () {
                entry.done = true;
                entry.rendering = false;
                pdfRenderTask = null;
            });
        }).catch(function () {
            entry.rendering = false;
        });
    }

    function layoutPdf(pages) {
        var available = el.viewerBody.clientWidth - 24;
        pdfScale = Math.max(0.2, available / pages[0].width);
        pdfSizes = pages;

        el.pdfPages.textContent = '';
        pdfRendered = [];

        pages.forEach(function (info, index) {
            var wrapper = document.createElement('div');
            wrapper.className = 'pdf-page';
            wrapper.style.width = '100%';
            wrapper.style.maxWidth = Math.floor(info.width * pdfScale) + 'px';
            wrapper.style.height = Math.floor(info.height * pdfScale) + 'px';

            var entry = { number: index + 1, wrapper: wrapper, done: false, rendering: false };
            pdfRendered.push(entry);
            el.pdfPages.appendChild(wrapper);
        });
    }

    function observePdfPages() {
        /* 没有 IntersectionObserver，或页面不可见（回调会被浏览器暂停）时直接全部渲染 */
        if (!('IntersectionObserver' in window) || document.visibilityState === 'hidden') {
            pdfRendered.forEach(renderPage);
            return;
        }

        pdfObserver = new IntersectionObserver(function (records) {
            records.forEach(function (record) {
                if (!record.isIntersecting) return;
                var entry = pdfRendered.filter(function (item) {
                    return item.wrapper === record.target;
                })[0];
                if (entry) renderPage(entry);
            });
        }, { root: el.viewerBody, rootMargin: '400px 0px' });

        pdfRendered.forEach(function (entry) { pdfObserver.observe(entry.wrapper); });
    }

    function openPdf(url) {
        showStatus(t('loading'));
        el.viewerFrame.hidden = true;

        loadPdfjs()
            .then(function (lib) { return lib.getDocument(url).promise; })
            .catch(function () {
                /* PDF.js 不可用时退回浏览器自带的阅读器 */
                showStatus('');
                el.pdfPages.textContent = '';
                el.viewerFrame.hidden = false;
                el.viewerFrame.src = url;
                return null;
            })
            .then(function (doc) {
                if (!doc) return;
                if (el.viewer.hidden || url !== pdfUrl) {
                    try { doc.destroy(); } catch (error) { /* 忽略 */ }
                    return;
                }

                pdfDoc = doc;
                var tasks = [];
                for (var i = 1; i <= doc.numPages; i += 1) {
                    tasks.push(doc.getPage(i).then(function (page) {
                        var viewport = page.getViewport({ scale: 1 });
                        return { width: viewport.width, height: viewport.height };
                    }));
                }

                return Promise.all(tasks).then(function (sizes) {
                    layoutPdf(sizes);
                    /* 先画第一页，保证打开即有内容 */
                    if (pdfRendered.length) renderPage(pdfRendered[0]);
                    observePdfPages();
                    showStatus('');
                    updatePageIndicator();
                    el.viewerBody.scrollTop = 0;
                });
            })
            .catch(function () {
                showStatus('');
                el.viewerFrame.hidden = false;
                el.viewerFrame.src = url;
            });
    }

    function openDoc(doc) {
        var path = doc.pdf[lang];
        el.viewerTitle.textContent = doc.title[lang];
        el.viewerGh.href = BLOB + encodePath(path);
        el.viewer.hidden = false;
        document.body.style.overflow = 'hidden';
        el.viewerBody.scrollTop = 0;
        el.viewerClose.focus();
        clearPdf();

        if (pageTicker) clearInterval(pageTicker);
        pageTicker = setInterval(updatePageIndicator, 350);

        resolveFileUrl(path).then(function (url) {
            pdfUrl = url;
            el.viewerOpen.href = url;
            openPdf(url);
        });
    }

    function closeViewer() {
        el.viewer.hidden = true;
        if (pageTicker) {
            clearInterval(pageTicker);
            pageTicker = null;
        }
        pdfUrl = '';
        clearPdf();
        showStatus('');
        el.viewerFrame.src = 'about:blank';
        el.viewerFrame.hidden = true;
        document.body.style.overflow = '';
    }

    /* ---------- 语言 ---------- */

    function applyLang(next) {
        lang = next === 'zh' ? 'zh' : 'en';
        el.html.className = 'lang-' + lang;
        el.html.lang = lang === 'zh' ? 'zh-Hans' : 'en';

        Array.prototype.forEach.call(document.querySelectorAll('.lang-btn'), function (button) {
            button.classList.toggle('active', button.dataset.langSet === lang);
        });

        try {
            localStorage.setItem('macwave-docs-lang', lang);
        } catch (error) {
            /* 隐私模式下忽略 */
        }

        /* 语言切换后列表标题跟着变；阅读器开着的话直接换成该语言的 PDF */
        renderList();
        if (!el.viewer.hidden) closeViewer();
    }

    /* ---------- 启动 ---------- */

    document.getElementById('repo-link').href = 'https://github.com/' + OWNER + '/' + REPO;

    Array.prototype.forEach.call(document.querySelectorAll('.lang-btn'), function (button) {
        button.addEventListener('click', function () { applyLang(button.dataset.langSet); });
    });

    el.viewerClose.addEventListener('click', closeViewer);

    el.viewerBody.addEventListener('scroll', function () {
        updatePageIndicator();
    }, { passive: true });

    var resizeTimer = null;
    window.addEventListener('resize', function () {
        if (el.viewer.hidden || !pdfDoc || !pdfSizes.length) return;
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function () {
            layoutPdf(pdfSizes);
            observePdfPages();
            updatePageIndicator();
        }, 260);
    });

    el.viewer.addEventListener('click', function (event) {
        if (event.target === el.viewer) closeViewer();
    });

    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape' && !el.viewer.hidden) closeViewer();
    });

    var saved = null;
    try {
        saved = localStorage.getItem('macwave-docs-lang');
    } catch (error) {
        saved = null;
    }

    var detected = (navigator.language || '').toLowerCase().indexOf('zh') === 0 ? 'zh' : 'en';
    applyLang(saved || detected);
})();
