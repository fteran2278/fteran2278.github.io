/* D Espacios · utilidades compartidas del front (sin dependencias).
   Todo el DOM se construye con textContent: nada de innerHTML con datos del servidor. */
(function () {
  'use strict';
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

  function h(tag, attrs) {
    const el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      const v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'class') el.className = v;
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'text') el.textContent = v;
      else el.setAttribute(k, v === true ? '' : v);
    });
    for (let i = 2; i < arguments.length; i++) {
      const c = arguments[i];
      if (c == null || c === false) continue;
      if (Array.isArray(c)) { c.forEach(function (x) { el.appendChild(x.nodeType ? x : document.createTextNode(String(x))); }); continue; }
      el.appendChild(c.nodeType ? c : document.createTextNode(String(c)));
    }
    return el;
  }

  function svg(d, size, color, w) {
    const ns = 'http://www.w3.org/2000/svg';
    const s = document.createElementNS(ns, 'svg');
    s.setAttribute('width', size); s.setAttribute('height', size); s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('fill', 'none'); s.setAttribute('stroke', color); s.setAttribute('stroke-width', w || 2);
    s.setAttribute('stroke-linecap', 'square'); s.setAttribute('aria-hidden', 'true');
    d.split('|').forEach(function (seg) { const p = document.createElementNS(ns, 'path'); p.setAttribute('d', seg); s.appendChild(p); });
    return s;
  }

  async function api(accion, datos) {
    const cfg = window.CITAS_CONFIG || {};
    if (!cfg.API_URL || cfg.API_URL.indexOf('PEGAR_AQUI') >= 0) throw new Error('El sistema de citas aún no está configurado.');
    const ctl = new AbortController();
    const t = setTimeout(function () { ctl.abort(); }, 30000);
    let res;
    try {
      res = await fetch(cfg.API_URL, {
        method: 'POST', redirect: 'follow', signal: ctl.signal,
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(Object.assign({ accion: accion }, datos || {}))
      });
    } catch (e) {
      throw new Error('No pudimos conectar. Revisa tu internet e intenta de nuevo.');
    } finally { clearTimeout(t); }
    let j;
    try { j = await res.json(); } catch (e) { throw new Error('Respuesta inesperada. Intenta de nuevo en un momento.'); }
    if (!j || !j.ok) {
      const er = new Error((j && j.error && j.error.mensaje) || 'Algo salió mal. Intenta de nuevo.');
      er.codigo = j && j.error && j.error.codigo;
      throw er;
    }
    return j.data;
  }

  const pad = function (n) { return (n < 10 ? '0' : '') + n; };
  const mesKey = function (y, m) { return y + '-' + pad(m); };

  /* Calendario mensual. o = {mes:'yyyy-mm', dias:{fecha:[horas]}|null, sel:'yyyy-mm-dd', hoy, mesMin, mesMax, onDia(fecha), onMes(delta)} */
  function calendario(host, o) {
    const p = o.mes.split('-'), y = +p[0], m = +p[1];
    const offset = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
    const n = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const cab = h('div', { class: 'cal-head' },
      h('button', { type: 'button', class: 'arrow', 'aria-label': 'Mes anterior', disabled: o.mes <= o.mesMin, onclick: function () { o.onMes(-1); } }, svg('M15 5l-7 7 7 7', 20, 'currentColor')),
      h('h2', { 'aria-live': 'polite' }, MESES[m - 1].charAt(0).toUpperCase() + MESES[m - 1].slice(1) + ' ' + y),
      h('button', { type: 'button', class: 'arrow', 'aria-label': 'Mes siguiente', disabled: o.mes >= o.mesMax, onclick: function () { o.onMes(1); } }, svg('M9 5l7 7-7 7', 20, 'currentColor')));
    const dow = h('div', { class: 'dow' }, ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(function (d) { return h('span', null, d); }));
    const grid = h('div', { class: 'grid' });
    for (let i = 0; i < offset; i++) grid.appendChild(h('div'));
    for (let d = 1; d <= n; d++) {
      const f = o.mes + '-' + pad(d);
      const av = !!(o.dias && o.dias[f]);
      const cls = 'day' + (av ? ' av' : '') + (o.sel === f ? ' sel' : '');
      const lbl = d + ' de ' + MESES[m - 1] + (av ? '' : ', sin horarios');
      grid.appendChild(h('button', { type: 'button', class: cls, disabled: !av, 'aria-label': lbl, 'aria-pressed': o.sel === f ? 'true' : 'false', onclick: function () { o.onDia(f); } }, String(d)));
    }
    host.replaceChildren(cab, dow, grid);
  }

  function slots(host, horas, sel, onHora) {
    host.replaceChildren.apply(host, horas.map(function (hr) {
      return h('button', { type: 'button', class: 'slot' + (sel === hr ? ' sel' : ''), 'aria-pressed': sel === hr ? 'true' : 'false', onclick: function () { onHora(hr); } }, hr);
    }));
  }

  function cap(s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); }
  function fechaCorta(f, hr) { // 'yyyy-mm-dd','HH:mm' -> 'Mar 13 oct · 10:00'
    const p = f.split('-'), d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
    const dia = DIAS[d.getUTCDay()];
    return dia.charAt(0).toUpperCase() + dia.slice(1, 3) + ' ' + (+p[2]) + ' ' + MESES[+p[1] - 1].slice(0, 3) + (hr ? ' · ' + hr : '');
  }
  function fechaTitulo(f) {
    const p = f.split('-'), d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
    const dia = DIAS[d.getUTCDay()];
    return dia.charAt(0).toUpperCase() + dia.slice(1) + ' ' + (+p[2]);
  }

  /* Calendario del cliente: .ics y link de Google Calendar */
  function utc(iso) { return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); }
  function icsTxt(s) { return String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'); }
  function datosEvento(c) {
    const cons = c.consultorio;
    return {
      titulo: 'Cita con ' + c.profesionista.nombre,
      lugar: cons ? [cons.nombre, cons.direccion].filter(Boolean).join(' · ') : '',
      detalle: 'Folio ' + c.id + (cons && cons.instruccionesLlegada ? '\n' + cons.instruccionesLlegada : '')
    };
  }
  function descargarIcs(c) {
    const e = datosEvento(c);
    const txt = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//D Espacios//Citas//ES', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT',
      'UID:' + c.id + '@despacios.com.mx', 'DTSTAMP:' + utc(new Date().toISOString()), 'DTSTART:' + utc(c.inicioISO), 'DTEND:' + utc(c.finISO),
      'SUMMARY:' + icsTxt(e.titulo), 'LOCATION:' + icsTxt(e.lugar), 'DESCRIPTION:' + icsTxt(e.detalle),
      'BEGIN:VALARM', 'TRIGGER:-PT2H', 'ACTION:DISPLAY', 'DESCRIPTION:Recordatorio de cita', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    const url = URL.createObjectURL(new Blob([txt], { type: 'text/calendar;charset=utf-8' }));
    const a = h('a', { href: url, download: 'cita-' + c.id + '.ics' });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }
  function linkGoogleCal(c) {
    const e = datosEvento(c);
    return 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(e.titulo) +
      '&dates=' + utc(c.inicioISO) + '/' + utc(c.finISO) + '&details=' + encodeURIComponent(e.detalle) + '&location=' + encodeURIComponent(e.lugar);
  }


  /* Editor de horario semanal en calendario (registro y "Mi horario").
     Se pinta por horas (toca o arrastra). inicial = {lun:'09:00-13:00,16:00-19:00', ...}; leer() regresa el mismo formato. */
  const DIAS_ED = [['lun', 'Lun', 'lunes'], ['mar', 'Mar', 'martes'], ['mie', 'Mié', 'miércoles'], ['jue', 'Jue', 'jueves'], ['vie', 'Vie', 'viernes'], ['sab', 'Sáb', 'sábado'], ['dom', 'Dom', 'domingo']];
  function editorHorario(inicial, ini, fin) {
    ini = ini || 6; fin = fin || 22;
    const horas = []; for (let x = ini; x < fin; x++) horas.push(x);
    const on = {}; DIAS_ED.forEach(function (d) { on[d[0]] = {}; });
    DIAS_ED.forEach(function (d) {
      String((inicial && inicial[d[0]]) || '').split(',').forEach(function (b) {
        const m = b.trim().match(/^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/); if (!m) return;
        const a = +m[1], z = +m[3] + (+m[4] > 0 ? 1 : 0);
        for (let x = a; x < z; x++) if (x >= ini && x < fin) on[d[0]][x] = true;
      });
    });
    const celdas = {}; // 'lun|9' -> nodo
    const total = h('span', { style: 'font-weight:600' });
    function pintar(dk, hr, v) {
      if (v) on[dk][hr] = true; else delete on[dk][hr];
      const c = celdas[dk + '|' + hr]; c.className = 'hc' + (v ? ' on' : ''); c.setAttribute('aria-pressed', v ? 'true' : 'false');
    }
    function contar() {
      let n = 0; DIAS_ED.forEach(function (d) { n += Object.keys(on[d[0]]).length; });
      total.textContent = n + (n === 1 ? ' hora por semana' : ' horas por semana');
    }
    const grid = h('div', { class: 'hgrid' }, h('div'), DIAS_ED.map(function (d) { return h('div', { class: 'hday' }, d[1]); }));
    horas.forEach(function (hr) {
      grid.appendChild(h('div', { class: 'hlab' }, String(hr).padStart(2, '0') + ':00'));
      DIAS_ED.forEach(function (d) {
        const c = h('button', { type: 'button', class: 'hc' + (on[d[0]][hr] ? ' on' : ''), 'aria-pressed': on[d[0]][hr] ? 'true' : 'false', 'aria-label': d[2] + ' ' + hr + ':00 a ' + (hr + 1) + ':00', 'data-d': d[0], 'data-h': hr });
        celdas[d[0] + '|' + hr] = c; grid.appendChild(c);
      });
    });
    let modo = null;
    grid.addEventListener('pointerdown', function (ev) {
      const c = ev.target.closest && ev.target.closest('.hc'); if (!c) return;
      ev.preventDefault();
      modo = !on[c.dataset.d][c.dataset.h];
      pintar(c.dataset.d, +c.dataset.h, modo); contar();
      try { grid.setPointerCapture(ev.pointerId); } catch (e) { /* sin captura */ }
    });
    grid.addEventListener('pointermove', function (ev) {
      if (modo === null) return;
      const el = document.elementFromPoint(ev.clientX, ev.clientY), c = el && el.closest && el.closest('.hc');
      if (c && grid.contains(c) && !!on[c.dataset.d][c.dataset.h] !== modo) { pintar(c.dataset.d, +c.dataset.h, modo); contar(); }
    });
    const fuera = function () { modo = null; };
    grid.addEventListener('pointerup', fuera); grid.addEventListener('pointercancel', fuera);
    grid.addEventListener('click', function (ev) { // teclado (Enter/Espacio)
      const c = ev.target.closest && ev.target.closest('.hc'); if (!c || ev.detail !== 0) return;
      pintar(c.dataset.d, +c.dataset.h, !on[c.dataset.d][c.dataset.h]); contar();
    });
    grid.addEventListener('dragstart', function (ev) { ev.preventDefault(); });
    function aplicar(fn) { DIAS_ED.forEach(function (d, i) { horas.forEach(function (hr) { pintar(d[0], hr, fn(i, hr)); }); }); contar(); }
    const chip = function (t, fn) { return h('button', { type: 'button', class: 'hchip', onclick: fn }, t); };
    const chips = h('div', { class: 'hchips' },
      chip('Lun a vie 9–18', function () { aplicar(function (i, hr) { return i < 5 && hr >= 9 && hr < 18; }); }),
      chip('Copiar lunes a todos los días', function () { const base = Object.assign({}, on.lun); aplicar(function (i, hr) { return !!base[hr]; }); }),
      chip('Borrar todo', function () { aplicar(function () { return false; }); }));
    const leyenda = h('div', { class: 'hleg' }, h('span', null, h('i', { class: 'hc on' }), ' Atiendo'), h('span', null, h('i', { class: 'hc' }), ' No atiendo'));
    function leer() {
      const out = {}; let alguno = false;
      DIAS_ED.forEach(function (d) {
        const bl = []; let a = null;
        horas.concat([fin]).forEach(function (hr) {
          const v = hr < fin && on[d[0]][hr];
          if (v && a === null) a = hr;
          if (!v && a !== null) { bl.push(String(a).padStart(2, '0') + ':00-' + String(hr).padStart(2, '0') + ':00'); a = null; }
        });
        out[d[0]] = bl.join(','); if (bl.length) alguno = true;
      });
      if (!alguno) throw new Error('Pinta al menos un horario en el que atiendas.');
      return out;
    }
    contar();
    return { nodo: h('div', { class: 'heditor' }, leyenda, chips, grid, h('div', { class: 'htotal' }, h('span', null, 'Atenderás'), total)), leer: leer, total: total };
  }

  /* Aviso de privacidad dentro de la misma página (ventana encima): no se navega, no se pierde nada del formulario. */
  function verAviso(url, ev) {
    if (!/^[\w.\-]+\.html$/.test(String(url || ''))) return; // enlace externo: se abre normal en otra pestaña
    if (ev) ev.preventDefault();
    const previo = document.activeElement;
    const cerrar = function () { cap.remove(); document.body.style.overflow = ''; document.removeEventListener('keydown', tecla); if (previo && previo.focus) previo.focus(); };
    const tecla = function (e) { if (e.key === 'Escape') cerrar(); };
    const btn = h('button', { type: 'button', class: 'btn solid-ink', style: 'width:auto;height:44px;font-size:14px;letter-spacing:0;text-transform:none;padding:0 18px', onclick: cerrar }, '← Volver al formulario');
    const cap = h('div', { class: 'overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Aviso de privacidad' },
      h('div', { class: 'overlay-bar' }, btn),
      h('iframe', { src: url + '?v=3', title: 'Aviso de privacidad', class: 'overlay-frame' }));
    document.body.appendChild(cap); document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', tecla); btn.focus();
  }

  async function copiar(txt) {
    try { await navigator.clipboard.writeText(txt); return true; } catch (e) { /* respaldo */ }
    const t = h('textarea', { style: 'position:fixed;opacity:0' }); t.value = txt; document.body.appendChild(t); t.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; } t.remove(); return ok;
  }

  function top(opts) { // cabecera negra común
    return h('div', { class: 'top' },
      h('div', { class: 'top-bar' }, h('span', { class: 'brand' }, 'D ESPACIOS'), opts && opts.accion ? opts.accion : null),
      opts && opts.plaque ? opts.plaque : null);
  }
  function plaque(cons, nombre, sub) {
    const num = cons && cons.numero ? String(cons.numero).padStart(2, '0') : '';
    const lugar = cons ? [cons.nombre, cons.sede].filter(Boolean).join(' · ') : '';
    return h('div', { class: 'plaque' },
      num ? h('div', { class: 'num', 'aria-hidden': 'true' }, num) : null,
      h('div', { class: 'plaque-txt' }, lugar ? h('span', { class: 'eyebrow' }, lugar) : null, h('h1', null, nombre), sub ? h('span', { class: 'sub' }, sub) : null));
  }
  function mapsLink(cons) {
    return h('a', { class: 'maps', href: cons.mapsLink, target: '_blank', rel: 'noopener noreferrer' }, svg('M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z|M12 7.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z', 18, 'currentColor'), 'Abrir en Google Maps');
  }

  window.Citas = { h: h, svg: svg, api: api, calendario: calendario, slots: slots, fechaCorta: fechaCorta, cap: cap, fechaTitulo: fechaTitulo,
    descargarIcs: descargarIcs, copiar: copiar, verAviso: verAviso, editorHorario: editorHorario, linkGoogleCal: linkGoogleCal, top: top, plaque: plaque, mapsLink: mapsLink, mesKey: mesKey, MESES: MESES };
})();
