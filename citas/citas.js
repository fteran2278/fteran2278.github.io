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


  /* Editor de horario semanal (registro y "Mi horario"). inicial = {lun:'09:00-13:00,16:00-19:00', ...} */
  const DIAS_ED = [['lun', 'Lunes'], ['mar', 'Martes'], ['mie', 'Miércoles'], ['jue', 'Jueves'], ['vie', 'Viernes'], ['sab', 'Sábado'], ['dom', 'Domingo']];
  function horasOpciones(ini, fin) { const o = []; for (let m = ini * 60; m <= fin * 60; m += 30) o.push(pad(Math.floor(m / 60)) + ':' + (m % 60 ? '30' : '00')); return o; }
  function aMin(t) { return (+t.slice(0, 2)) * 60 + (+t.slice(3)); }
  function editorHorario(inicial) {
    const HORAS = horasOpciones(6, 22);
    const sel = function (valor, vacio) {
      const s = h('select', null, vacio ? h('option', { value: '' }, vacio) : null, HORAS.map(function (x) { return h('option', { value: x }, x); }));
      s.value = valor || ''; return s;
    };
    const filas = {};
    const ui = DIAS_ED.map(function (d) {
      const bl = String((inicial && inicial[d[0]]) || '').split(',').map(function (x) { return x.trim().split('-'); }).filter(function (x) { return x.length === 2 && x[0]; });
      const chk = h('input', { type: 'checkbox', id: 'd-' + d[0], 'aria-label': d[1] });
      chk.checked = bl.length > 0;
      const a1 = sel(bl[0] ? bl[0][0].padStart(5, '0') : '09:00'), b1 = sel(bl[0] ? bl[0][1].padStart(5, '0') : '13:00');
      const a2 = sel(bl[1] ? bl[1][0].padStart(5, '0') : '', 'Sin 2º bloque'), b2 = sel(bl[1] ? bl[1][1].padStart(5, '0') : '');
      const cuerpo = h('div', { style: 'display:' + (chk.checked ? 'flex' : 'none') + ';flex-direction:column;gap:8px' },
        h('div', { class: 'rango' }, a1, h('span', { class: 'sep' }, 'a'), b1), h('div', { class: 'rango' }, a2, h('span', { class: 'sep' }, 'a'), b2));
      chk.addEventListener('change', function () { cuerpo.style.display = chk.checked ? 'flex' : 'none'; });
      filas[d[0]] = { chk: chk, a1: a1, b1: b1, a2: a2, b2: b2, cuerpo: cuerpo };
      return h('div', { class: 'dia' }, h('label', { class: 'dia-cab', for: 'd-' + d[0] }, chk, d[1]), cuerpo);
    });
    const copiarLV = h('button', { type: 'button', class: 'linkbtn', style: 'justify-content:flex-start', onclick: function () {
      const o = filas.lun;
      ['mar', 'mie', 'jue', 'vie'].forEach(function (k) {
        const f = filas[k]; f.chk.checked = o.chk.checked; f.cuerpo.style.display = o.chk.checked ? 'flex' : 'none';
        ['a1', 'b1', 'a2', 'b2'].forEach(function (x) { f[x].value = o[x].value; });
      });
    } }, 'Copiar el horario del lunes a martes–viernes');
    function leer() {
      const out = {}; let alguno = false;
      DIAS_ED.forEach(function (d) {
        const f = filas[d[0]]; out[d[0]] = '';
        if (!f.chk.checked) return;
        const bl = [[f.a1.value, f.b1.value]];
        if (f.a2.value || f.b2.value) bl.push([f.a2.value, f.b2.value]);
        bl.forEach(function (b) { if (!b[0] || !b[1] || aMin(b[1]) <= aMin(b[0])) throw new Error('Revisa el horario del ' + d[1].toLowerCase() + ': la hora final debe ser después de la inicial.'); });
        if (bl.length === 2 && aMin(bl[1][0]) < aMin(bl[0][1])) throw new Error('Los dos bloques del ' + d[1].toLowerCase() + ' se traslapan.');
        out[d[0]] = bl.map(function (b) { return b[0] + '-' + b[1]; }).join(','); alguno = true;
      });
      if (!alguno) throw new Error('Marca al menos un día con horario de atención.');
      return out;
    }
    return { nodo: h('div', { style: 'display:flex;flex-direction:column;gap:8px' }, h('div', { style: 'display:flex;flex-direction:column;gap:8px' }, ui), copiarLV), leer: leer };
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
    descargarIcs: descargarIcs, copiar: copiar, editorHorario: editorHorario, linkGoogleCal: linkGoogleCal, top: top, plaque: plaque, mapsLink: mapsLink, mesKey: mesKey, MESES: MESES };
})();
