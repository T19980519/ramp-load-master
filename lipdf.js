/* ------------------------------------------------------------------
   Ramp Load Master - Loading Instruction PDF reader
   Small built-in PDF text reader (no internet, no library needed).
   Works for text PDFs with standard fonts (like the printed LI export).
   Scanned PDFs or photos are not read - those are entered by hand.
------------------------------------------------------------------- */
(function (root) {
  'use strict';

  function latin1(u8) {
    var s = '', CH = 0x8000;
    for (var i = 0; i < u8.length; i += CH) s += String.fromCharCode.apply(null, u8.subarray(i, i + CH));
    return s;
  }

  function inflate(u8) {
    if (typeof DecompressionStream === 'undefined') {
      if (typeof require === 'function') {           // node (testing)
        try { return Promise.resolve(new Uint8Array(require('zlib').inflateSync(Buffer.from(u8)))); }
        catch (e) { return Promise.reject(e); }
      }
      return Promise.reject(new Error('inflate not supported'));
    }
    var ds = new DecompressionStream('deflate');
    var stream = new Blob([u8]).stream().pipeThrough(ds);
    return new Response(stream).arrayBuffer().then(function (b) { return new Uint8Array(b); });
  }

  /* ---------- object table ---------- */
  function indexObjects(s) {
    var re = /(\d+)\s+(\d+)\s+obj\b/g, m, map = {};
    while ((m = re.exec(s))) map[m[1]] = m.index + m[0].length;
    return map;
  }
  function objText(s, map, n) {
    var at = map[n];
    if (at == null) return '';
    var end = s.indexOf('endobj', at);
    var st = s.indexOf('stream', at);
    if (st !== -1 && (end === -1 || st < end)) return s.slice(at, st);   // dictionary part only
    return s.slice(at, end === -1 ? undefined : end);
  }
  function streamBytes(u8, s, map, n) {
    var at = map[n];
    if (at == null) return Promise.resolve(null);
    var dictEnd = s.indexOf('stream', at);
    if (dictEnd === -1) return Promise.resolve(null);
    var dict = s.slice(at, dictEnd);
    var start = dictEnd + 6;
    if (s.charAt(start) === '\r') start++;
    if (s.charAt(start) === '\n') start++;
    var len = -1, lm = dict.match(/\/Length\s+(\d+)(\s+\d+\s+R)?/);
    if (lm) {
      if (lm[2]) { var lt = objText(s, map, lm[1]).match(/\d+/); len = lt ? +lt[0] : -1; }
      else len = +lm[1];
    }
    if (len < 0 || start + len > u8.length) {
      var e = s.indexOf('endstream', start);
      len = (e === -1 ? u8.length : e) - start;
    }
    var data = u8.subarray(start, start + len);
    if (/\/FlateDecode/.test(dict)) return inflate(data);
    if (/\/Filter/.test(dict)) return Promise.resolve(null);    // other filters not supported
    return Promise.resolve(data);
  }

  function pageList(s, map) {
    var pages = [];
    var rootRef = (s.match(/\/Root\s+(\d+)\s+\d+\s+R/) || [])[1];
    var cat = rootRef ? objText(s, map, rootRef) : '';
    if (!cat) {
      for (var k in map) { var t = objText(s, map, k); if (/\/Type\s*\/Catalog/.test(t)) { cat = t; break; } }
    }
    var pagesRef = (cat.match(/\/Pages\s+(\d+)\s+\d+\s+R/) || [])[1];
    var seen = {};
    function walk(n) {
      if (seen[n]) return; seen[n] = 1;
      var t = objText(s, map, n);
      if (/\/Type\s*\/Pages\b/.test(t)) {
        var kids = (t.match(/\/Kids\s*\[([^\]]*)\]/) || [])[1] || '';
        var re = /(\d+)\s+\d+\s+R/g, m;
        while ((m = re.exec(kids))) walk(m[1]);
      } else if (/\/Type\s*\/Page\b/.test(t)) pages.push(n);
    }
    if (pagesRef) walk(pagesRef);
    if (!pages.length) {
      Object.keys(map).sort(function (a, b) { return map[a] - map[b]; }).forEach(function (k) {
        if (/\/Type\s*\/Page\b/.test(objText(s, map, k))) pages.push(k);
      });
    }
    return pages;
  }

  /* ---------- content stream ---------- */
  function mul(m1, m2) {
    return [
      m1[0] * m2[0] + m1[1] * m2[2], m1[0] * m2[1] + m1[1] * m2[3],
      m1[2] * m2[0] + m1[3] * m2[2], m1[2] * m2[1] + m1[3] * m2[3],
      m1[4] * m2[0] + m1[5] * m2[2] + m2[4], m1[4] * m2[1] + m1[5] * m2[3] + m2[5]
    ];
  }

  function readContent(cs, out) {
    var i = 0, n = cs.length, stack = [], arrStack = [];
    var ctm = [1, 0, 0, 1, 0, 0], gs = [], tm = ctm.slice(), lm = ctm.slice(), fs = 10, tl = 0;
    function push(v) { if (arrStack.length) arrStack[arrStack.length - 1].push(v); else stack.push(v); }
    function emit(str) {
      if (!str) return;
      var t = mul(tm, ctm);
      out.push({ str: str, x: t[4], y: t[5], size: Math.abs(fs * t[3]) || fs });
      tm[4] += str.length * fs * 0.5 * tm[0];
    }
    function nl() { lm = mul([1, 0, 0, 1, 0, -tl], lm); tm = lm.slice(); }
    while (i < n) {
      var c = cs.charAt(i);
      if (c === ' ' || c === '\n' || c === '\r' || c === '\t' || c === '\f' || c === '\0') { i++; continue; }
      if (c === '%') { while (i < n && cs.charAt(i) !== '\n' && cs.charAt(i) !== '\r') i++; continue; }
      if (c === '(') {
        var depth = 1, str = ''; i++;
        while (i < n && depth) {
          var ch = cs.charAt(i);
          if (ch === '\\') {
            var nx = cs.charAt(i + 1);
            if (/[0-7]/.test(nx)) { var oct = cs.substr(i + 1, 3).match(/^[0-7]{1,3}/)[0]; str += String.fromCharCode(parseInt(oct, 8)); i += 1 + oct.length; continue; }
            var map = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f' };
            if (nx === '\r' || nx === '\n') { i += 2; if (nx === '\r' && cs.charAt(i) === '\n') i++; continue; }
            str += map[nx] || nx; i += 2; continue;
          }
          if (ch === '(') depth++;
          if (ch === ')') { depth--; if (!depth) { i++; break; } }
          str += ch; i++;
        }
        push(str); continue;
      }
      if (c === '<' && cs.charAt(i + 1) === '<') { i += 2; push('<<'); continue; }
      if (c === '>' && cs.charAt(i + 1) === '>') { i += 2; continue; }
      if (c === '<') {
        var e = cs.indexOf('>', i), hex = cs.slice(i + 1, e).replace(/\s+/g, ''), hs = '';
        if (hex.length % 2) hex += '0';
        for (var h = 0; h < hex.length; h += 2) hs += String.fromCharCode(parseInt(hex.substr(h, 2), 16));
        i = e + 1; push(hs); continue;
      }
      if (c === '[') { arrStack.push([]); i++; continue; }
      if (c === ']') { var a = arrStack.pop() || []; i++; push(a); continue; }
      if (c === '{' || c === '}') { i++; continue; }
      if (c === '/') { var nm = cs.slice(i).match(/^\/[^\s\/\[\]()<>{}%]*/)[0]; i += nm.length; push({ name: nm.slice(1) }); continue; }
      var num = cs.slice(i, i + 24).match(/^[+-]?(\d+\.?\d*|\.\d+)/);
      if (num) { push(parseFloat(num[0])); i += num[0].length; continue; }
      var op = cs.slice(i, i + 12).match(/^[A-Za-z'"*]+/);
      if (!op) { i++; continue; }
      op = op[0]; i += op.length;
      var s = stack; stack = [];
      switch (op) {
        case 'q': gs.push(ctm.slice()); break;
        case 'Q': ctm = gs.pop() || [1, 0, 0, 1, 0, 0]; break;
        case 'cm': if (s.length >= 6) ctm = mul(s.slice(-6), ctm); break;
        case 'BT': tm = [1, 0, 0, 1, 0, 0]; lm = tm.slice(); break;
        case 'Tf': fs = +s[s.length - 1] || fs; break;
        case 'TL': tl = +s[0] || 0; break;
        case 'Td': lm = mul([1, 0, 0, 1, +s[0] || 0, +s[1] || 0], lm); tm = lm.slice(); break;
        case 'TD': tl = -(+s[1] || 0); lm = mul([1, 0, 0, 1, +s[0] || 0, +s[1] || 0], lm); tm = lm.slice(); break;
        case 'Tm': if (s.length >= 6) { lm = s.slice(-6).map(Number); tm = lm.slice(); } break;
        case 'T*': nl(); break;
        case 'Tj': emit(typeof s[0] === 'string' ? s[0] : ''); break;
        case "'": nl(); emit(typeof s[0] === 'string' ? s[0] : ''); break;
        case '"': nl(); emit(typeof s[2] === 'string' ? s[2] : ''); break;
        case 'TJ':
          var arr = Array.isArray(s[0]) ? s[0] : [], txt = '';
          arr.forEach(function (p) { if (typeof p === 'string') txt += p; else if (typeof p === 'number' && p < -250) txt += ' '; });
          emit(txt); break;
        case 'BI':
          var ei = cs.indexOf('EI', i); i = ei === -1 ? n : ei + 2; break;
        default: break;
      }
    }
  }

  /* ---------- PDF -> text items per page ---------- */
  function extract(buffer) {
    var u8 = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    var s = latin1(u8);
    if (s.slice(0, 1024).indexOf('%PDF') === -1) return Promise.reject(new Error('not a pdf'));
    var map = indexObjects(s);
    var pages = pageList(s, map);
    return pages.reduce(function (p, pg) {
      return p.then(function (acc) {
        var t = objText(s, map, pg);
        var refs = [], cm = t.match(/\/Contents\s*(\[[^\]]*\]|\d+\s+\d+\s+R)/);
        if (cm) { var re = /(\d+)\s+\d+\s+R/g, m; while ((m = re.exec(cm[1]))) refs.push(m[1]); }
        var items = [];
        return refs.reduce(function (q, r) {
          return q.then(function () {
            return streamBytes(u8, s, map, r).then(function (b) { if (b) readContent(latin1(b), items); })
              .catch(function () {});
          });
        }, Promise.resolve()).then(function () { acc.push(items); return acc; });
      });
    }, Promise.resolve([]));
  }

  /* ---------- Loading Instruction parser ---------- */
  function norm(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }
  var LABELS = { 'FLIGHT': 'flight', 'ROUTE': 'route', 'DATE': 'date', 'DEP': 'dep', 'REG': 'reg', 'FIN': 'fin', 'A/C': 'acRaw',
    'WATER': 'water', 'HAZ': 'haz', 'MEL': 'mel', 'SPECIAL': 'special', 'LOAD AGENT': 'agent' };
  var POS_RE = /^(\d{2}[LRP]|BLK|BULK|C?\d)$/i;

  function lines(items) {
    var sorted = items.slice().sort(function (a, b) { return b.y - a.y || a.x - b.x; }), out = [];
    sorted.forEach(function (it) {
      var L = out.length && Math.abs(out[out.length - 1].y - it.y) < 2.5 ? out[out.length - 1] : null;
      if (!L) { L = { y: it.y, items: [] }; out.push(L); }
      L.items.push(it);
    });
    out.forEach(function (L) { L.items.sort(function (a, b) { return a.x - b.x; }); L.text = norm(L.items.map(function (i) { return i.t; }).join(' ')); });
    return out;
  }

  function parse(pages) {
    var all = [];
    pages.forEach(function (its, p) { its.forEach(function (it) { var t = norm(it.str); if (t) all.push({ p: p, x: it.x, y: it.y, t: t }); }); });
    var res = { hdr: {}, rows: [], type: null, ok: false };
    if (!all.length) return res;

    var title = all.filter(function (i) { return /LOADING\s+INSTRUCTION/i.test(i.t); })[0];
    if (title) {
      if (/OFF[\s-]*LOAD/i.test(title.t)) res.type = 'off';
      else if (/ON[\s-]*LOAD/i.test(title.t)) res.type = 'on';
    }

    var posH = all.filter(function (i) { return i.t.toUpperCase() === 'POS'; })[0];
    var hp = posH ? posH.p : 0;

    Object.keys(LABELS).forEach(function (lab) {
      var key = LABELS[lab];
      var L = all.filter(function (i) { return i.p === hp && i.t.toUpperCase() === lab && (!posH || i.y > posH.y); })[0];
      if (!L) return;
      var best = null;
      all.forEach(function (i) {
        if (i.p !== L.p || i === L) return;
        var dy = L.y - i.y, dx = i.x - L.x;
        if (dy > 3 && dy < 30 && dx > -8 && dx < 50) {
          if (!best || dy < best.dy - 1 || (Math.abs(dy - best.dy) <= 1 && Math.abs(dx) < Math.abs(best.dx))) best = { i: i, dy: dy, dx: dx };
        }
      });
      if (best && !LABELS[best.i.t.toUpperCase()]) res.hdr[key] = best.i.t;
      if (key === 'agent' && best) {
        var ph = all.filter(function (i) {
          return i.p === L.p && Math.abs(i.y - best.i.y) < 2.5 && i.x > best.i.x && /\+?\d[\d\s().-]{6,}\d/.test(i.t);
        })[0];
        if (ph) res.hdr.phone = ph.t;
      }
    });

    if (posH) {
      var hdrLine = all.filter(function (i) { return i.p === hp && Math.abs(i.y - posH.y) < 2.5; });
      var cols = [];
      hdrLine.forEach(function (i) {
        var k = i.t.toUpperCase();
        var key = { POS: 'pos', ULD: 'uld', DEST: 'dest', TYPE: 'type', PCS: 'pcs', KG: 'kg', '%': 'pct', WT: 'kg', WEIGHT: 'kg', NOTES: 'notes' }[k];
        if (key) cols.push({ key: key, x: i.x });
      });
      cols.sort(function (a, b) { return a.x - b.x; });
      function colOf(x) {
        var c = null;
        cols.forEach(function (cc) { if (cc.x <= x + 10) c = cc; });
        return c ? c.key : null;
      }
      var hold = null;
      lines(all.filter(function (i) { return i.p === hp && i.y < posH.y - 2; })).forEach(function (L) {
        var up = L.text.toUpperCase();
        if (/^FWD( HOLD)?$/.test(up)) { hold = 'FWD'; return; }
        if (/^AFT( HOLD)?$/.test(up)) { hold = 'AFT'; return; }
        if (/^BULK( HOLD)?$/.test(up)) { hold = 'BULK'; return; }
        var first = L.items[0];
        if (!first || !POS_RE.test(first.t.split(' ')[0])) return;
        if (cols.length && colOf(first.x) !== 'pos') return;
        var row = { pos: '', uld: '', dest: '', type: '', pcs: '', kg: '', pct: '', notes: '', hold: hold, y: L.y };
        L.items.forEach(function (it) {
          var k = cols.length ? colOf(it.x) : null;
          if (!k) return;
          row[k] = row[k] ? row[k] + ' ' + it.t : it.t;
        });
        if (!cols.length) {
          var tk = L.text.split(' ');
          row.pos = tk[0]; row.uld = tk[1] || ''; row.dest = tk[2] || ''; row.type = tk[3] || '';
          row.pcs = tk[4] || ''; row.kg = tk[5] || ''; row.pct = tk[6] || '';
        }
        row.pos = row.pos.split(' ')[0].toUpperCase();
        row.pcs = String(row.pcs).replace(/[^\d]/g, '');
        row.kg = String(row.kg).replace(/[^\d.]/g, '');
        row.pct = String(row.pct).replace(/[^\d.]/g, '');
        if (!row.hold) row.hold = /^(BLK|BULK|C?5)$/.test(row.pos) ? 'BULK' : /^[34]/.test(row.pos) ? 'AFT' : 'FWD';
        res.rows.push(row);
      });

      // NOTES column (can be on the same page or the next page)
      var notesH = all.filter(function (i) { return i.t.toUpperCase() === 'NOTES' && Math.abs(i.y - posH.y) < 4; })[0] ||
        all.filter(function (i) { return i.t.toUpperCase() === 'NOTES'; })[0];
      if (notesH) {
        all.forEach(function (i) {
          if (i.p !== notesH.p || i.y >= notesH.y - 2 || i.x < notesH.x - 8 || i.x > notesH.x + 160) return;
          if (i.p === hp && cols.length && colOf(i.x) !== 'notes') return;
          var best = null;
          res.rows.forEach(function (r) { var d = Math.abs(r.y - i.y); if (d < 6 && (!best || d < best.d)) best = { r: r, d: d }; });
          if (best && best.r.notes.indexOf(i.t) === -1) best.r.notes = norm(best.r.notes + ' ' + i.t);
        });
      }
    }
    res.rows.forEach(function (r) { delete r.y; });
    res.ok = res.rows.length > 0 || Object.keys(res.hdr).length > 2;
    return res;
  }

  function read(buffer) { return extract(buffer).then(parse); }

  var api = { extract: extract, parse: parse, read: read };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.RLM_PDF = api;
})(typeof self !== 'undefined' ? self : this);
