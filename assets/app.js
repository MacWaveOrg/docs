(function () {
    'use strict';

    var OWNER = 'MacWaveOrg';
    var REPO = 'docs';
    var CONTENT_REF = 'main';           /* 文档所在分支，用于 GitHub 链接与目录接口 */
    var API = 'https://api.github.com/repos/' + OWNER + '/' + REPO + '/contents/';
    var BLOB = 'https://github.com/' + OWNER + '/' + REPO + '/blob/' + CONTENT_REF + '/';
    var TREE = 'https://github.com/' + OWNER + '/' + REPO + '/tree/' + CONTENT_REF + '/';
    var RAW = 'https://raw.githubusercontent.com/' + OWNER + '/' + REPO + '/' + CONTENT_REF + '/';

    /* 站点自身文件，不出现在列表里 */
    var HIDDEN = { 'index.html': 1, 'assets': 1, CNAME: 1 };

    /* 以点开头的文件与目录（如 .github、.gitignore）一律不展示 */
    function isHidden(name) {
        return name.charAt(0) === '.' || HIDDEN[name] === 1;
    }

    /* 接口不可用时的回退快照（commit 19586e2） */
    var SNAPSHOT = [
        ['history/en/MacWave-History.md', 34227],
        ['history/en/MacWave-History.pages', 765320],
        ['history/en/MacWave-History.pdf', 243541],
        ['history/zh-Hans/MacWave发展历史-原始.pages', 1537678],
        ['history/zh-Hans/MacWave发展历史.md', 31090],
        ['history/zh-Hans/MacWave发展历史.pages', 738824],
        ['history/zh-Hans/MacWave发展历史.pdf', 446663],
        ['infosource/zh-Hans/MacWave-infosource.pages', 675075]
    ];

    var STR = {
        loading: { en: 'Loading\u2026', zh: '加载中\u2026' },
        empty: { en: 'This folder is empty.', zh: '此目录为空。' },
        read: { en: 'Read', zh: '阅读' },
        download: { en: 'Download', zh: '下载' },
        folder: { en: 'Folder', zh: '文件夹' },
        offline: {
            en: 'Could not reach the GitHub API \u2014 showing a snapshot of the repository.',
            zh: '无法访问 GitHub API \u2014\u2014 正在显示仓库快照。'
        },
        rate: {
            en: 'GitHub API rate limit reached \u2014 showing a snapshot of the repository.',
            zh: 'GitHub API 请求次数已达上限 \u2014\u2014 正在显示仓库快照。'
        },
        missing: { en: 'Folder not found.', zh: '目录不存在。' },
        root: { en: 'Root', zh: '根目录' }
    };

    var cache = {};
    var urlCache = {};
    var currentPath = '';
    var lang = 'en';

    var el = {
        html: document.documentElement,
        crumbs: document.getElementById('crumbs'),
        list: document.getElementById('list'),
        notice: document.getElementById('notice'),
        dirLink: document.getElementById('dir-link'),
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

    function formatSize(bytes) {
        if (typeof bytes !== 'number' || bytes < 0) return '';
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(bytes < 10240 ? 1 : 0) + ' KB';
        return (bytes / 1024 / 1024).toFixed(1) + ' MB';
    }

    function extension(name) {
        var i = name.lastIndexOf('.');
        return i > 0 ? name.slice(i + 1).toLowerCase() : '';
    }

    function iconFor(item) {
        if (item.type === 'dir') return { text: 'DIR', cls: 'dir' };
        var ext = extension(item.name);
        if (ext === 'pdf') return { text: 'PDF', cls: 'pdf' };
        if (ext === 'md') return { text: 'MD', cls: 'md' };
        if (ext === 'pages') return { text: 'PG', cls: 'md' };
        return { text: ext ? ext.slice(0, 3).toUpperCase() : 'DOC', cls: '' };
    }

    function joinPath(base, name) {
        return base ? base + '/' + name : name;
    }

    function parentOf(path) {
        var i = path.lastIndexOf('/');
        return i === -1 ? '' : path.slice(0, i);
    }

    /* ---------- 数据获取 ---------- */

    function snapshotChildren(path) {
        var prefix = path ? path + '/' : '';
        var seen = {};
        var out = [];

        SNAPSHOT.forEach(function (entry) {
            var full = entry[0];
            if (full.indexOf(prefix) !== 0) return;

            var rest = full.slice(prefix.length);
            var slash = rest.indexOf('/');
            var name = slash === -1 ? rest : rest.slice(0, slash);
            var isDir = slash !== -1;

            if (seen[name]) return;
            seen[name] = true;
            if (isHidden(name)) return;
            out.push({
                name: name,
                path: joinPath(path, name),
                type: isDir ? 'dir' : 'file',
                size: isDir ? null : entry[1]
            });
        });

        return out;
    }

    function loadDir(path) {
        if (cache[path]) return Promise.resolve(cache[path]);

        var url = API + encodePath(path) + '?ref=' + CONTENT_REF;

        return fetch(url, { headers: { Accept: 'application/vnd.github+json' } })
            .then(function (response) {
                if (response.status === 403 || response.status === 429) {
                    var rateError = new Error('rate');
                    rateError.kind = 'rate';
                    throw rateError;
                }
                if (!response.ok) {
                    var httpError = new Error('http ' + response.status);
                    httpError.kind = 'http';
                    throw httpError;
                }
                return response.json();
            })
            .then(function (data) {
                var items = (Array.isArray(data) ? data : [])
                    .filter(function (item) { return !isHidden(item.name); })
                    .map(function (item) {
                        return {
                            name: item.name,
                            path: item.path,
                            type: item.type === 'dir' ? 'dir' : 'file',
                            size: item.size
                        };
                    });
                cache[path] = { items: items, snapshot: false };
                return cache[path];
            })
            .catch(function (error) {
                cache[path] = {
                    items: snapshotChildren(path),
                    snapshot: true,
                    reason: error && error.kind === 'rate' ? 'rate' : 'offline'
                };
                return cache[path];
            });
    }

    /* ---------- 文件地址解析 ----------
       站点部署在 gh-pages，但文档内容写在 main。gh-pages 上的副本可能落后于
       main，因此先探测同源地址；不存在时回落到 main 的原始文件。 */

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

    function sortItems(items) {
        return items.slice().sort(function (a, b) {
            if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
            return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
        });
    }

    function makeCrumb(label, path, isCurrent) {
        var node;

        if (isCurrent) {
            node = document.createElement('span');
            node.className = 'crumb is-current';
        } else {
            node = document.createElement('button');
            node.type = 'button';
            node.className = 'crumb';
            node.addEventListener('click', function () { go(path); });
        }

        node.textContent = label;
        return node;
    }

    function renderCrumbs(path) {
        el.crumbs.textContent = '';
        var parts = path ? path.split('/') : [];

        el.crumbs.appendChild(makeCrumb(t('root'), '', parts.length === 0));

        parts.forEach(function (part, index) {
            var sep = document.createElement('span');
            sep.className = 'crumb-sep';
            sep.textContent = '/';
            el.crumbs.appendChild(sep);

            var target = parts.slice(0, index + 1).join('/');
            el.crumbs.appendChild(makeCrumb(part, target, index === parts.length - 1));
        });
    }

    function makeButton(label, className, onClick) {
        var button = document.createElement('button');
        button.type = 'button';
        button.className = className;
        button.textContent = label;
        button.addEventListener('click', onClick);
        return button;
    }

    function makeLink(label, className, href, download) {
        var link = document.createElement('a');
        link.className = className;
        link.href = href;
        link.textContent = label;
        if (download) link.setAttribute('download', '');
        else {
            link.target = '_blank';
            link.rel = 'noopener';
        }
        return link;
    }

    function renderRow(item) {
        var row = document.createElement('div');
        var isPdf = item.type === 'file' && extension(item.name) === 'pdf';
        row.className = 'row' + (item.type === 'dir' ? ' is-dir' : '') + (isPdf ? ' has-preview' : '');

        var iconInfo = iconFor(item);
        var icon = document.createElement('span');
        icon.className = 'icon ' + iconInfo.cls;
        icon.textContent = iconInfo.text;
        icon.setAttribute('aria-hidden', 'true');

        var main = document.createElement('div');
        main.className = 'row-main';

        var name = document.createElement('span');
        name.className = 'row-name';
        name.textContent = item.name;
        main.appendChild(name);

        var meta = document.createElement('span');
        meta.className = 'row-meta';
        meta.textContent = item.type === 'dir'
            ? t('folder')
            : formatSize(item.size);
        main.appendChild(meta);

        var actions = document.createElement('div');
        actions.className = 'row-actions';

        if (isPdf) {
            actions.appendChild(makeButton(t('read'), 'btn btn-primary', function (event) {
                openViewer(item);
            }));
        }

        actions.appendChild(makeLink(
            'GitHub',
            'btn btn-quiet',
            (item.type === 'dir' ? TREE : BLOB) + encodePath(item.path),
            false
        ));

        if (item.type === 'file') {
            var download = makeLink(t('download'), 'btn btn-quiet', '#', false);
            download.dataset.filePath = item.path;
            download.classList.add('js-download');
            actions.appendChild(download);
        }

        row.appendChild(icon);
        row.appendChild(main);
        row.appendChild(actions);

        var downloadLink = actions.querySelector('.js-download');
        if (downloadLink) {
            resolveFileUrl(item.path).then(function (url) {
                downloadLink.href = url;
            });
        }

        if (item.type === 'dir' || isPdf) {
            row.addEventListener('click', function (event) {
                if (event.target.closest('a, button')) return;
                if (item.type === 'dir') go(item.path);
                else openViewer(item);
            });
        }

        return row;
    }

    function render(path, data) {
        renderCrumbs(path);
        el.dirLink.href = TREE + encodePath(path);

        el.list.textContent = '';

        var items = sortItems(data.items);

        if (!items.length) {
            var empty = document.createElement('div');
            empty.className = 'empty';
            empty.textContent = t('empty');
            el.list.appendChild(empty);
            return;
        }

        var fragment = document.createDocumentFragment();
        items.forEach(function (item) {
            fragment.appendChild(renderRow(item));
        });
        el.list.appendChild(fragment);
    }

    function showNotice(key) {
        el.notice.textContent = t(key);
        el.notice.hidden = false;
    }

    function hideNotice() {
        el.notice.hidden = true;
        el.notice.textContent = '';
    }

    /* ---------- 导航 ---------- */

    function parseHash() {
        var raw = (location.hash || '').replace(/^#\/?/, '');
        try {
            return decodeURIComponent(raw);
        } catch (error) {
            return raw;
        }
    }

    function go(path) {
        var target = '#/' + path.split('/').filter(Boolean).map(encodeURIComponent).join('/');
        if (location.hash === target) {
            route();
        } else {
            location.hash = target;
        }
    }

    function route() {
        currentPath = parseHash();
        hideNotice();

        el.list.textContent = '';
        var loading = document.createElement('div');
        loading.className = 'empty';
        loading.textContent = t('loading');
        el.list.appendChild(loading);
        renderCrumbs(currentPath);

        loadDir(currentPath).then(function (data) {
            if (data.snapshot) showNotice(data.reason === 'rate' ? 'rate' : 'offline');
            render(currentPath, data);
        });
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

        // 以阅读区顶部向下 35% 处为判定线，按元素实际位置判断当前页
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
            var viewport = page.getViewport({ scale: 1 });
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
        // 没有 IntersectionObserver，或页面不可见（回调会被浏览器暂停）时直接全部渲染
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

    function openPdf(url, item) {
        showStatus(t('loading'));
        el.viewerFrame.hidden = true;

        loadPdfjs()
            .then(function (lib) { return lib.getDocument(url).promise; })
            .catch(function () {
                // PDF.js 不可用时退回浏览器自带的阅读器
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
                var sizes = [];
                var tasks = [];
                for (var i = 1; i <= doc.numPages; i += 1) {
                    tasks.push(doc.getPage(i).then(function (page) {
                        var viewport = page.getViewport({ scale: 1 });
                        return { width: viewport.width, height: viewport.height };
                    }));
                }

                return Promise.all(tasks).then(function (list) {
                    sizes = list;
                    layoutPdf(sizes);
                    // 先画第一页，保证打开即有内容
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

    function openViewer(item) {
        el.viewerTitle.textContent = item.name;
        el.viewerGh.href = BLOB + encodePath(item.path);
        el.viewer.hidden = false;
        document.body.style.overflow = 'hidden';
        el.viewerBody.scrollTop = 0;
        el.viewerClose.focus();
        clearPdf();

        if (pageTicker) clearInterval(pageTicker);
        pageTicker = setInterval(updatePageIndicator, 350);

        resolveFileUrl(item.path).then(function (url) {
            pdfUrl = url;
            el.viewerOpen.href = url;
            openPdf(url, item);
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

        route();
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
        if (el.viewer.hidden || !pdfDoc) return;
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function () {
            if (!pdfSizes.length) return;
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

    window.addEventListener('hashchange', route);

    var saved = null;
    try {
        saved = localStorage.getItem('macwave-docs-lang');
    } catch (error) {
        saved = null;
    }

    var detected = (navigator.language || '').toLowerCase().indexOf('zh') === 0 ? 'zh' : 'en';
    applyLang(saved || detected);
})();
