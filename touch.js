/* ============================================================
   JOXIA · Couche tactile & mobile commune aux jeux tiers
   ------------------------------------------------------------
   Inclus dans le <head> de chaque jeu (avant ses propres scripts) :
     <script src="https://joxiagame.github.io/Joxia-Games/touch.js"
             data-pad="dpad" data-buttons="Space:Tir,KeyP:Pause"></script>

   Options (attributs data-* de la balise script) :
     data-quit      position du bouton « Quitter » : tl | tr | bl | br | tc | bc (défaut tl ; tc/bc = centré)
     data-pad       croix directionnelle : dpad (8 directions) | dpad4 (4 directions) | none (défaut)
     data-buttons   boutons d'action « Code:Libellé » séparés par des virgules (ex. KeyZ:A,Space:Saut) ;
                    « Code:Libellé:toggle » = bouton bascule (touche maintenue jusqu'au prochain appui, ex. Ctrl)
     data-buttons-pos  position des boutons : br (défaut, en bas à droite) | tr (en haut à droite)
                    | mr (colonne compacte au milieu à droite)
     data-fit       sélecteur CSS d'un élément de taille fixe à agrandir/réduire pour tenir à l'écran
     data-viewport  contenu imposé pour <meta name="viewport"> (ex. width=720)
     data-drag-mouse  facteur : un glisser au doigt devient mousemove (movementX/Y) + mousedown/up
     data-no-pointer-lock  neutralise requestPointerLock sur écran tactile (sinon le jeu se met en pause)

   Les touches virtuelles envoient de vrais KeyboardEvent (key, code, keyCode, which)
   au document : les moteurs anciens (Phaser 2, Crafty, jQuery…) les reçoivent comme le clavier.
   La manette n'apparaît que sur les écrans tactiles ; le bouton Quitter partout.
   ============================================================ */
(function () {
    'use strict';
    var script = document.currentScript || {};
    var opt = function (name, def) {
        var v = script.getAttribute && script.getAttribute('data-' + name);
        return v === null || v === undefined ? def : v;
    };
    var HUB = 'https://joxiagame.github.io/Joxia-Games/';
    var isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

    /* ---------- viewport (avant le rendu) ---------- */
    var vp = opt('viewport', null), fitSel = opt('fit', null);
    var meta = document.querySelector('meta[name="viewport"]');
    // en mode « fit », le viewport est verrouillé : sinon un contenu qui déborde élargit la page sur mobile
    if (vp || !meta || fitSel) {
        if (!meta) { meta = document.createElement('meta'); meta.name = 'viewport'; document.head.appendChild(meta); }
        meta.content = vp || 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover';
    }

    /* ---------- pointer lock inutilisable au doigt ---------- */
    if (isTouch && opt('no-pointer-lock', null) !== null) {
        Element.prototype.requestPointerLock = function () {};
        document.exitPointerLock = function () {};
    }

    /* ---------- clavier virtuel ---------- */
    var KEYCODES = { ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40, Space: 32, Enter: 13, Escape: 27,
        ShiftLeft: 16, ControlLeft: 17, Tab: 9, Backspace: 8, Delete: 46 };
    var KEYNAMES = { Space: ' ', Escape: 'Escape', Enter: 'Enter', ShiftLeft: 'Shift', ControlLeft: 'Control', Tab: 'Tab', Backspace: 'Backspace',
        Delete: 'Delete' };
    function keyInfo(code) {
        if (KEYCODES[code]) return { key: KEYNAMES[code] || code, keyCode: KEYCODES[code] };
        var m = /^Key([A-Z])$/.exec(code);
        if (m) return { key: m[1].toLowerCase(), keyCode: m[1].charCodeAt(0) };
        m = /^Digit([0-9])$/.exec(code);
        if (m) return { key: m[1], keyCode: 48 + +m[1] };
        return { key: code, keyCode: 0 };
    }
    var held = {};
    function sendKey(type, code) {
        if (type === 'keydown') { if (held[code]) return; held[code] = true; }
        else { if (!held[code]) return; delete held[code]; }
        var k = keyInfo(code);
        var ev = new KeyboardEvent(type, { key: k.key, code: code, bubbles: true, cancelable: true });
        // keyCode/which sont en lecture seule (0) sur un KeyboardEvent construit : on les force
        Object.defineProperty(ev, 'keyCode', { get: function () { return k.keyCode; } });
        Object.defineProperty(ev, 'which', { get: function () { return k.keyCode; } });
        (document.activeElement && document.activeElement !== document.documentElement ? document.activeElement : document.body || document).dispatchEvent(ev);
    }
    function releaseAll() {
        Object.keys(held).forEach(function (c) { sendKey('keyup', c); });
        var on = document.querySelectorAll('#joxia-btns button.on');
        for (var i = 0; i < on.length; i++) { on[i].classList.remove('on'); on[i].setAttribute('aria-pressed', 'false'); }
    }

    /* ---------- styles ---------- */
    var css = '' +
        '#joxia-quit{position:fixed;z-index:2147483647;display:flex;align-items:center;gap:6px;background:rgba(20,22,30,.86);color:#fff;' +
        'border:1px solid rgba(255,255,255,.3);border-radius:10px;padding:7px 11px;font:700 13px system-ui,-apple-system,sans-serif;' +
        'text-decoration:none;box-shadow:0 3px 12px rgba(0,0,0,.45);-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px);' +
        '-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none}' +
        '#joxia-quit.tl{top:calc(8px + env(safe-area-inset-top));left:calc(8px + env(safe-area-inset-left))}' +
        '#joxia-quit.tr{top:calc(8px + env(safe-area-inset-top));right:calc(8px + env(safe-area-inset-right))}' +
        '#joxia-quit.bl{bottom:calc(8px + env(safe-area-inset-bottom));left:calc(8px + env(safe-area-inset-left))}' +
        '#joxia-quit.br{bottom:calc(8px + env(safe-area-inset-bottom));right:calc(8px + env(safe-area-inset-right))}' +
        '#joxia-quit.tc{top:calc(8px + env(safe-area-inset-top));left:50%;transform:translateX(-50%)}' +
        '#joxia-quit.bc{bottom:calc(8px + env(safe-area-inset-bottom));left:50%;transform:translateX(-50%)}' +
        '.joxia-pad{position:fixed;z-index:2147483646;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;' +
        '-webkit-tap-highlight-color:transparent}' +
        '#joxia-dpad{left:calc(18px + env(safe-area-inset-left));bottom:calc(18px + env(safe-area-inset-bottom));width:132px;height:132px;' +
        'border-radius:50%;background:rgba(20,22,30,.38);border:2px solid rgba(255,255,255,.28)}' +
        '#joxia-dpad i{position:absolute;width:0;height:0;border:11px solid transparent;opacity:.75}' +
        '#joxia-dpad .u{left:55px;top:10px;border-bottom:14px solid #fff;border-top:0}' +
        '#joxia-dpad .d{left:55px;bottom:10px;border-top:14px solid #fff;border-bottom:0}' +
        '#joxia-dpad .l{top:55px;left:10px;border-right:14px solid #fff;border-left:0}' +
        '#joxia-dpad .r{top:55px;right:10px;border-left:14px solid #fff;border-right:0}' +
        '#joxia-dpad .on{opacity:1;filter:drop-shadow(0 0 6px #ffb347)}' +
        '#joxia-dpad b{position:absolute;left:46px;top:46px;width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,.35);' +
        'transition:transform .05s}' +
        '#joxia-btns{right:calc(16px + env(safe-area-inset-right));bottom:calc(20px + env(safe-area-inset-bottom));display:flex;' +
        'flex-wrap:wrap-reverse;justify-content:flex-end;gap:12px;max-width:180px}' +
        '#joxia-btns.tr{bottom:auto;top:calc(10px + env(safe-area-inset-top));flex-wrap:wrap}' +
        '#joxia-btns button{min-width:64px;height:64px;padding:0 10px;border-radius:32px;border:2px solid rgba(255,255,255,.35);' +
        'background:rgba(20,22,30,.45);color:#fff;font:700 13px system-ui,sans-serif;touch-action:none}' +
        '#joxia-btns button.on{background:rgba(255,138,61,.75);border-color:#ffb347}' +
        '#joxia-btns.mr{bottom:auto;top:50%;transform:translateY(-50%);flex-direction:column;flex-wrap:nowrap;gap:8px;max-width:none}' +
        '#joxia-btns.mr button{min-width:0;width:auto;height:44px;border-radius:22px;padding:0 12px;font-size:12px}' +
        '.joxia-fit{position:fixed!important;left:0!important;top:0!important;margin:0!important;transform-origin:0 0}' +
        (fitSel ? 'html,body{overflow:hidden!important;overscroll-behavior:none}' : '');

    function build() {
        var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

        /* bouton Quitter (toutes plateformes) */
        if (!document.getElementById('joxia-quit')) {
            var q = document.createElement('a');
            q.id = 'joxia-quit'; q.className = opt('quit', 'tl'); q.href = HUB; q.target = '_top';
            // emoji échappé : affichage correct quel que soit l'encodage de la page du jeu
            q.textContent = '\uD83C\uDFE0 Quitter'; q.setAttribute('aria-label', 'Quitter le jeu et revenir au hub Joxia');
            // le jeu ne doit pas recevoir ce clic (tir, pause, glisser…)
            ['mousedown', 'mouseup', 'pointerdown', 'pointerup', 'touchstart', 'touchend'].forEach(function (t) {
                q.addEventListener(t, function (e) { e.stopPropagation(); }, true);
            });
            document.body.appendChild(q);
        }
        if (!isTouch) return;

        /* croix directionnelle : on suit le pouce, 8 ou 4 directions */
        var padMode = opt('pad', 'none');
        if (padMode === 'dpad' || padMode === 'dpad4') {
            var pad = document.createElement('div');
            pad.id = 'joxia-dpad'; pad.className = 'joxia-pad';
            pad.innerHTML = '<i class="u"></i><i class="d"></i><i class="l"></i><i class="r"></i><b></b>';
            var knob = pad.querySelector('b'), dirs = { u: 'ArrowUp', d: 'ArrowDown', l: 'ArrowLeft', r: 'ArrowRight' }, active = {};
            var setDirs = function (next) {
                Object.keys(dirs).forEach(function (d) {
                    if (next[d] && !active[d]) sendKey('keydown', dirs[d]);
                    if (!next[d] && active[d]) sendKey('keyup', dirs[d]);
                    pad.querySelector('.' + d).classList.toggle('on', !!next[d]);
                });
                active = next;
            };
            var track = function (e) {
                var r = pad.getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
                var dist = Math.hypot(dx, dy), n = {};
                if (dist > 14) {
                    if (padMode === 'dpad4') {
                        if (Math.abs(dx) > Math.abs(dy)) n[dx > 0 ? 'r' : 'l'] = 1; else n[dy > 0 ? 'd' : 'u'] = 1;
                    } else {  // 8 directions : l'axe secondaire compte s'il dépasse ~22°
                        if (Math.abs(dx) > Math.abs(dy) * 0.41) n[dx > 0 ? 'r' : 'l'] = 1;
                        if (Math.abs(dy) > Math.abs(dx) * 0.41) n[dy > 0 ? 'd' : 'u'] = 1;
                    }
                }
                var k = Math.min(dist, 40) / (dist || 1);
                knob.style.transform = 'translate(' + dx * k + 'px,' + dy * k + 'px)';
                setDirs(n);
            };
            var end = function () { knob.style.transform = ''; setDirs({}); };
            pad.addEventListener('pointerdown', function (e) { e.preventDefault(); e.stopPropagation(); pad.setPointerCapture(e.pointerId); track(e); });
            pad.addEventListener('pointermove', function (e) { if (pad.hasPointerCapture(e.pointerId)) { e.preventDefault(); track(e); } });
            pad.addEventListener('pointerup', end); pad.addEventListener('pointercancel', end);
            pad.addEventListener('touchstart', function (e) { e.preventDefault(); e.stopPropagation(); }, { passive: false });
            document.body.appendChild(pad);
        }

        /* boutons d'action */
        var list = opt('buttons', '');
        if (list) {
            var box = document.createElement('div');
            box.id = 'joxia-btns'; box.className = 'joxia-pad ' + opt('buttons-pos', 'br');
            list.split(',').forEach(function (item) {
                var p = item.split(':'), code = p[0].trim(), label = (p[1] || code).trim(), toggle = (p[2] || '').trim() === 'toggle';
                if (!code) return;
                var b = document.createElement('button');
                b.type = 'button'; b.textContent = label; b.setAttribute('aria-label', label);
                if (toggle) {
                    // bascule : 1er appui = touche enfoncée (reste allumé), 2e appui = relâchée
                    b.setAttribute('aria-pressed', 'false');
                    b.addEventListener('pointerdown', function (e) {
                        e.preventDefault(); e.stopPropagation();
                        var on = !b.classList.contains('on');
                        b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on));
                        sendKey(on ? 'keydown' : 'keyup', code);
                    });
                } else {
                    var up = function () { b.classList.remove('on'); sendKey('keyup', code); };
                    b.addEventListener('pointerdown', function (e) { e.preventDefault(); e.stopPropagation(); b.setPointerCapture(e.pointerId); b.classList.add('on'); sendKey('keydown', code); });
                    b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up);
                }
                b.addEventListener('touchstart', function (e) { e.preventDefault(); e.stopPropagation(); }, { passive: false });
                box.appendChild(b);
            });
            document.body.appendChild(box);
        }

        /* glisser au doigt → souris relative (jeux pilotés par pointer lock) */
        var drag = parseFloat(opt('drag-mouse', ''));
        if (drag) {
            var last = null;
            var fire = function (type, t, mx, my) {
                var ev = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: t.clientX, clientY: t.clientY,
                    movementX: mx || 0, movementY: my || 0, button: 0, buttons: type === 'mouseup' ? 0 : 1 });
                (document.elementFromPoint(t.clientX, t.clientY) || document).dispatchEvent(ev);
            };
            document.addEventListener('touchstart', function (e) {
                if (e.target.closest && e.target.closest('.joxia-pad,#joxia-quit,a,button,input,select')) return;
                var t = e.touches[0]; last = { x: t.clientX, y: t.clientY }; fire('mousedown', t);
            }, { passive: true });
            document.addEventListener('touchmove', function (e) {
                if (!last) return;
                var t = e.touches[0];
                fire('mousemove', t, (t.clientX - last.x) * drag, (t.clientY - last.y) * drag);
                last = { x: t.clientX, y: t.clientY };
                if (e.cancelable) e.preventDefault();
            }, { passive: false });
            document.addEventListener('touchend', function (e) {
                if (!last || e.touches.length) return;
                fire('mouseup', e.changedTouches[0]); last = null;
            }, { passive: true });
        }
    }

    /* ---------- mise à l'échelle d'un élément de taille fixe ---------- */
    function fit() {
        var el = fitSel && document.querySelector(fitSel);
        if (!el) return;
        el.classList.add('joxia-fit');
        el.style.transform = '';
        var w = el.offsetWidth, h = el.offsetHeight;
        if (!w || !h) return;
        var vw = window.innerWidth, vh = window.innerHeight, s = Math.min(vw / w, vh / h);
        el.style.transform = 'translate(' + Math.round((vw - w * s) / 2) + 'px,' + Math.round((vh - h * s) / 2) + 'px) scale(' + s + ')';
    }
    if (fitSel) {
        window.addEventListener('resize', fit);
        window.addEventListener('orientationchange', function () { setTimeout(fit, 250); });
        window.addEventListener('load', function () { fit(); setTimeout(fit, 1000); setTimeout(fit, 3000); });
    }

    /* touches relâchées si l'onglet perd le focus (évite une direction « collée ») */
    window.addEventListener('blur', releaseAll);
    document.addEventListener('visibilitychange', function () { if (document.hidden) releaseAll(); });

    if (document.body) build(); else document.addEventListener('DOMContentLoaded', build);
})();
