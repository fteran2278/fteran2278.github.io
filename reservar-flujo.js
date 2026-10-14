(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var MESES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
  var DIAS = ["domingo","lunes","martes","miércoles","jueves","viernes","sábado"];
  var PLANES = [
    { id: "basico", n: "Básico", h: 5, p: 600 },
    { id: "plus", n: "Plus", h: 10, p: 1100, tag: "Popular" },
    { id: "business", n: "Business", h: 20, p: 2000 }
  ];
  var PACKS = [{ d: 1, p: 400 }, { d: 3, p: 1200 }, { d: 5, p: 2000 }];
  var PRECIO_HORA = 125;
  var CFG = window.RF_CONFIG || {};
  var API = (CFG.api || "https://despacios-server-production.up.railway.app").replace(/\/$/, "");
  var TEST = !!CFG.test;
  var NOMBRES = { oficina11: "Oficina 11", oficina12: "Oficina 12" };
  var S = { of: "oficina11", tab: "suelta", month: null, date: null, hours: [], plan: "plus", pack: 3, days: [], timer: null, deadline: 0, clabe: "", opener: null, pago: null, poll: null, busy: false, av: {}, dpMsg: "" };

  var ICO_L = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
  var ICO_R = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';
  var ICO_CLOCK = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8a5f12" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
  var ICO_CLOCK_S = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
  var ICO_COPY = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/></svg>';
  var ICO_BANK = '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#1C1C1A" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 9.5L12 4l9 5.5"/><path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8"/><path d="M3 20h18"/></svg>';
  var ICO_LOCK = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6b655b" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';

  /* ── utilidades ── */
  function midnight(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  function ymd(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function fromYmd(s) { var p = s.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function fmtLong(d) { return cap(DIAS[d.getDay()]) + " " + d.getDate() + " de " + MESES[d.getMonth()]; }
  function fmtShort(d) { return cap(DIAS[d.getDay()].slice(0, 3)) + " " + d.getDate() + " " + MESES[d.getMonth()].slice(0, 3); }
  function money(n) { return "$" + n.toLocaleString("es-MX"); }
  function today() { return midnight(new Date()); }
  function photoOf(of) { var el = document.querySelector('.space-card[data-space="' + of + '"] img'); return el ? el.src : ""; }

  /* ── disponibilidad real (GET /disponibilidad) ── */
  function avKey(d) { return S.of + "|" + ymd(d); }
  function loadAv(d, cb) {
    var k = avKey(d), cur = S.av[k];
    if (cur && cur !== "error") { if (cb) cb(); return; }
    S.av[k] = "loading";
    fetch(API + "/disponibilidad?oficina=" + encodeURIComponent(S.of) + "&fecha=" + ymd(d), { cache: "no-store" })
      .then(function (r) { return r.json(); })
      .then(function (j) { S.av[k] = j && j.bloques ? j.bloques : "error"; })
      .catch(function () { S.av[k] = "error"; })
      .then(function () { if (cb) cb(); });
  }
  function hourFree(d, h) {
    var now = new Date();
    if (ymd(d) === ymd(now) && h <= now.getHours()) return false;
    var a = S.av[avKey(d)];
    if (!Array.isArray(a)) return false;
    for (var i = 0; i < a.length; i++) if (a[i].hora === h) return !!a[i].disponible;
    return false;
  }
  function blocks(d) { var a = S.av[avKey(d)]; return Array.isArray(a) ? a : []; }
  function closedDay(d) { return d < today() || d.getDay() === 0; }

  /* ── calendario ── */
  function calendar(mode) {
    var m = S.month, first = new Date(m.getFullYear(), m.getMonth(), 1);
    var lead = (first.getDay() + 6) % 7, total = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
    var cur = new Date(today().getFullYear(), today().getMonth(), 1);
    var prevOff = m.getTime() <= cur.getTime();
    var nextOff = (m.getFullYear() * 12 + m.getMonth()) >= (cur.getFullYear() * 12 + cur.getMonth() + 2);
    var h = '<div class="rf-cal-head"><button type="button" class="rf-nav" data-act="prev" aria-label="Mes anterior"' + (prevOff ? " disabled" : "") + ">" + ICO_L + '</button><div class="rf-cal-title">' + cap(MESES[m.getMonth()]) + " " + m.getFullYear() + '</div><button type="button" class="rf-nav" data-act="next" aria-label="Mes siguiente"' + (nextOff ? " disabled" : "") + ">" + ICO_R + "</button></div>";
    h += '<div class="rf-grid7" role="grid" aria-label="Calendario">';
    "LMMJVSD".split("").forEach(function (x) { h += '<div class="rf-dow">' + x + "</div>"; });
    for (var i = 0; i < lead; i++) h += "<div></div>";
    for (var d = 1; d <= total; d++) {
      var dt = new Date(m.getFullYear(), m.getMonth(), d), key = ymd(dt);
      var full = closedDay(dt);
      var sel = mode === "suelta" ? S.date === key : S.days.indexOf(key) > -1;
      var cls = "rf-day" + (sel ? " sel" : "") + (key === ymd(new Date()) ? " today" : "") + (full && dt >= today() ? " full" : "");
      h += '<button type="button" class="' + cls + '" data-act="day" data-date="' + key + '"' + (full ? " disabled" : "") + ' aria-pressed="' + (sel ? "true" : "false") + '" aria-label="' + fmtLong(dt) + (full ? ", no disponible" : "") + '">' + d + "</button>";
    }
    return h + "</div>";
  }

  /* ── panel por pestaña ── */
  function renderPanel() {
    var p = $("rfPanel"), h = "";
    if (S.tab === "suelta") {
      h += calendar("suelta");
      if (!S.date) {
        h += '<div class="rf-note">' + ICO_CLOCK + "<span>Elige un día para ver los horarios disponibles.</span></div>";
      } else {
        var d = fromYmd(S.date), st = S.av[avKey(d)];
        h += '<div class="rf-sec">Horarios disponibles · ' + fmtShort(d) + "<span>" + money(PRECIO_HORA) + " por hora</span></div>";
        if (st === "loading" || !st) h += '<div class="rf-note"><span>Consultando disponibilidad…</span></div>';
        else if (st === "error") h += '<div class="rf-note"><span>No pudimos consultar la disponibilidad. <button type="button" class="rf-link" data-act="retry" style="height:auto">Reintentar</button></span></div>';
        else {
          var bl = blocks(d), anyFree = false;
          h += '<div class="rf-hours">';
          bl.forEach(function (b) {
            var hr = b.hora, free = hourFree(d, hr), on = S.hours.indexOf(hr) > -1;
            if (free) anyFree = true;
            h += '<button type="button" class="rf-hour' + (on ? " sel" : "") + '" data-act="hour" data-h="' + hr + '"' + (free ? "" : " disabled") + ' aria-pressed="' + (on ? "true" : "false") + '">' + hr + ":00</button>";
          });
          h += "</div>";
          if (!anyFree) h += '<div class="rf-note"><span>Ese día ya no tiene horarios libres. Elige otro día.</span></div>';
        }
        h += '<div class="rf-fine">Toca varias horas seguidas para reservar más tiempo. Cambios sin costo hasta 24 horas antes.</div>';
      }
    } else if (S.tab === "plan") {
      h += '<div style="margin-top:16px"><div class="rf-h">Compra horas, úsalas cuando quieras</div><div class="rf-sub" style="margin-top:4px">Vigencia de 30 días desde la compra.</div></div>';
      h += '<div class="rf-plans" role="radiogroup" aria-label="Plan de horas">';
      PLANES.forEach(function (pl) {
        var on = S.plan === pl.id;
        h += '<button type="button" class="rf-plan" role="radio" aria-checked="' + on + '" data-act="plan" data-id="' + pl.id + '"><span class="rf-radio"></span><span class="rf-plan-main"><span class="rf-plan-name">' + pl.n + (pl.tag ? '<span class="rf-badge">' + pl.tag + "</span>" : "") + '</span><span class="rf-plan-meta">' + pl.h + " horas · " + money(pl.p / pl.h) + ' por hora</span></span><span class="rf-plan-price">' + money(pl.p) + "</span></button>";
      });
      h += "</div>";
      h += '<div class="rf-note"><span><b>Hoy solo pagas.</b> Al recibir tu pago te enviamos tu link personal para agendar tus horas cuando quieras.</span></div>';
    } else {
      h += '<div class="rf-packs" role="radiogroup" aria-label="Cantidad de días">';
      PACKS.forEach(function (pk) {
        var on = S.pack === pk.d;
        h += '<button type="button" class="rf-pack" role="radio" aria-checked="' + on + '" data-act="pack" data-d="' + pk.d + '"><b>' + pk.d + (pk.d === 1 ? " día" : " días") + "</b><i>" + money(pk.p) + "</i></button>";
      });
      h += "</div>";
      h += '<div class="rf-sec" style="margin-top:12px">Elige ' + S.pack + (S.pack === 1 ? " día" : " días") + "<span>" + S.days.length + " de " + S.pack + " seleccionados</span></div>";
      h += calendar("daypass");
      if (S.dpMsg) h += '<div class="rf-note rf-warn"><span>' + S.dpMsg + "</span></div>";
      h += '<div class="rf-note">' + ICO_CLOCK + "<span>Cada día es de <b>8:00 a 16:00</b> (lunes a sábado).</span></div>";
      h += '<div class="rf-fine">Podrás cambiar o cancelar tus días desde tu link personal, hasta 24 horas antes de cada día.</div>';
    }
    p.innerHTML = h;
  }

  /* ── resumen y pie ── */
  function selection() {
    var o = NOMBRES[S.of];
    if (S.tab === "suelta") {
      if (!S.date) return { ok: false, label: "<b>Elige día y horario</b>Aún no hay horario seleccionado", price: 0, btn: "Elige día y horario" };
      if (!S.hours.length) return { ok: false, label: "<b>" + fmtLong(fromYmd(S.date)) + "</b>Elige tu horario", price: 0, btn: "Elige tu horario" };
      var a = Math.min.apply(null, S.hours), b = Math.max.apply(null, S.hours) + 1, n = S.hours.length;
      return { ok: true, price: PRECIO_HORA * n, label: "<b>" + fmtLong(fromYmd(S.date)) + "</b>" + a + ":00 a " + b + ":00 · " + n + (n === 1 ? " hora" : " horas") + " × " + money(PRECIO_HORA), title: o + " · Privada", l1: fmtLong(fromYmd(S.date)) + " de " + fromYmd(S.date).getFullYear(), l2: a + ":00 – " + b + ":00 · " + n + (n === 1 ? " hora" : " horas"), holds: true };
    }
    if (S.tab === "plan") {
      var pl = PLANES.filter(function (x) { return x.id === S.plan; })[0];
      return { ok: true, price: pl.p, label: "<b>Plan " + pl.n + " · " + pl.h + " horas</b>" + money(pl.p / pl.h) + " por hora · vigencia 30 días", title: "Plan " + pl.n + " · " + pl.h + " horas", l1: o + " · " + money(pl.p / pl.h) + " por hora", l2: "Vigencia de 30 días desde el pago", holds: false };
    }
    var pk = PACKS.filter(function (x) { return x.d === S.pack; })[0];
    if (S.days.length < S.pack) return { ok: false, price: 0, label: "<b>Elige " + S.pack + (S.pack === 1 ? " día" : " días") + "</b>" + S.days.length + " de " + S.pack + " seleccionados", btn: "Elige " + (S.pack - S.days.length) + (S.pack - S.days.length === 1 ? " día más" : " días más") };
    var ds = S.days.slice().sort().map(function (k) { return fromYmd(k); });
    var names = ds.map(function (d) { return fmtShort(d).replace(/ (\w+)$/, ""); });
    return { ok: true, price: pk.p, label: "<b>" + names.join(", ") + "</b>" + pk.d + (pk.d === 1 ? " día" : " días") + " · de 8:00 a 16:00 cada día", title: o + " · Day pass " + pk.d + (pk.d === 1 ? " día" : " días"), l1: names.join(", "), l2: "8:00 a 16:00 cada día", holds: true };
  }
  function renderFoot() {
    var s = selection();
    $("rfTotalTxt").innerHTML = s.label;
    $("rfTotalNum").textContent = s.ok ? money(s.price) : "—";
    var b = $("rfGo"); b.disabled = !s.ok; b.textContent = s.ok ? "Confirmar y pagar →" : s.btn;
  }
  function renderHeader() {
    $("rfPhoto").src = photoOf(S.of);
    $("rfName").textContent = NOMBRES[S.of];
    document.querySelectorAll("#rfOffices .rf-chip").forEach(function (c) { c.setAttribute("aria-pressed", c.getAttribute("data-of") === S.of ? "true" : "false"); });
    document.querySelectorAll(".rf-tab").forEach(function (t) { t.setAttribute("aria-selected", t.getAttribute("data-tab") === S.tab ? "true" : "false"); });
  }
  function renderAll() { renderHeader(); renderPanel(); renderFoot(); }

  /* ── abrir / cerrar ── */
  function resetSel() { S.date = null; S.hours = []; S.days = []; S.dpMsg = ""; }
  function pad2(n) { return String(n).padStart(2, "0"); }
  function api(path, opts) {
    return fetch(API + path, opts).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { j._status = r.status; return j; }); });
  }
  function openFlow(tab, of) {
    if (of && NOMBRES[of]) S.of = of;
    S.tab = tab; resetSel(); S.pago = null; S.busy = false; stopTimer(); stopPoll();
    var t = today(); S.month = new Date(t.getFullYear(), t.getMonth(), 1);
    S.opener = document.activeElement;
    showStep(1);
    renderAll();
    var ov = $("rfOverlay"); ov.classList.add("open"); ov.setAttribute("aria-hidden", "false");
    document.documentElement.style.overflow = "hidden";
    $("rfScroll").scrollTop = 0;
    setTimeout(function () { $("rfClose").focus(); }, 30);
  }
  function hideFlow() {
    stopTimer(); stopPoll();
    var ov = $("rfOverlay"); ov.classList.remove("open"); ov.setAttribute("aria-hidden", "true");
    document.documentElement.style.overflow = "";
    if (S.opener && S.opener.focus) S.opener.focus();
  }
  // Cerrar con un pago pendiente pide confirmación (liberar el horario)
  function closeFlow() {
    if (S.pago && S.step === 2) { askCancel(hideAfterCancel); return; }
    hideFlow();
  }
  function hideAfterCancel() { releasePago(function () { hideFlow(); }); }
  function showStep(n) {
    S.step = n;
    $("rfStep1").hidden = n !== 1; $("rfStep2").hidden = n !== 2; $("rfStep3").hidden = n !== 3; $("rfFoot").hidden = n !== 1;
    $("rfScroll").scrollTop = 0;
  }

  /* ── paso 2: datos y pago SPEI (CLABE real del servidor) ── */
  function fmtClabe(c) { return c.replace(/(\d{4})(?=\d)/g, "$1 ").trim(); }
  function validName(v) { return v.trim().length >= 3 && /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{2}/.test(v); }
  function validTel(v) { return v.replace(/\D/g, "").length === 10; }
  function validMail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  function payload(s) {
    var p = { nombre: $("rfNombre").value.trim(), telefono: $("rfTel").value.replace(/\D/g, ""), correo: $("rfCorreo").value.trim(), oficina: S.of };
    if (S.tab === "suelta") {
      p.tipo = "hora"; p.fecha = S.date; p.hora = pad2(Math.min.apply(null, S.hours)) + ":00"; p.horas = S.hours.length;
    } else if (S.tab === "plan") { p.tipo = "plan"; p.plan = S.plan; }
    else { p.tipo = "daypass"; p.fechas = S.days.slice().sort(); }
    return p;
  }

  function goStep2() {
    var s = selection(); if (!s.ok) return;
    S.pago = null; S.busy = false; S.sel = s;
    var cli = S.cli || {};
    var h = '<div class="rf-s2">';
    h += '<div class="rf-s2-head"><button type="button" class="rf-back" id="rfBack" aria-label="Volver">' + ICO_L + '</button><div class="rf-s2-title">Tus datos y pago</div><div class="rf-step">Paso 2 de 3</div></div>';
    h += '<div id="rfAsk" hidden></div>';
    h += '<div class="rf-summary"><img alt="" src="' + photoOf(S.of) + '"><div class="rf-summary-txt"><b>' + s.title + "</b><span>" + s.l1 + "</span><span>" + s.l2 + '</span></div><div class="rf-summary-price">' + money(s.price) + "</div></div>";
    h += '<div class="rf-fields"><div class="rf-field"><label for="rfNombre">Nombre completo</label><input class="rf-input" id="rfNombre" type="text" autocomplete="name" placeholder="Tu nombre" value="' + esc(cli.nombre || "") + '"></div>';
    h += '<div class="rf-row"><div class="rf-field" style="flex:5"><label for="rfTel">Teléfono (SMS)</label><input class="rf-input" id="rfTel" type="tel" inputmode="numeric" autocomplete="tel-national" placeholder="10 dígitos" value="' + esc(cli.tel || "") + '"></div>';
    h += '<div class="rf-field" style="flex:6"><label for="rfCorreo">Correo</label><input class="rf-input" id="rfCorreo" type="email" autocomplete="email" placeholder="tu@correo.com" value="' + esc(cli.correo || "") + '"></div></div></div>';
    h += '<div class="rf-label">Forma de pago</div>';
    h += '<div class="rf-method">' + ICO_BANK + "<div><b>Transferencia SPEI</b><span>Desde la app de tu banco, a cualquier hora</span></div></div>";
    h += '<div id="rfClabeLock" class="rf-clabe-lock">' + ICO_LOCK + '<div id="rfLockTxt"><b>Aquí aparecerá tu CLABE.</b><br>Completa tu nombre, teléfono y correo para verla.</div></div>';
    h += '<div id="rfClabe" hidden></div>';
    h += '<div class="rf-s2-foot">';
    if (s.holds) h += '<div class="rf-timer" id="rfTimerBox" hidden>' + ICO_CLOCK_S + 'Horario apartado · quedan <b id="rfTimer">15:00</b></div>';
    else h += '<div id="rfPlanNote">Tu plan se activa en cuanto recibimos tu pago.</div>';
    h += '<button type="button" class="rf-link" id="rfCancel">' + (s.holds ? "Cancelar y liberar el horario" : "Cancelar") + "</button></div></div>";
    $("rfStep2").innerHTML = h;
    showStep(2);
    bindStep2();
    var first = !validName($("rfNombre").value) ? "rfNombre" : (!validTel($("rfTel").value) ? "rfTel" : "rfCorreo");
    setTimeout(function () { var n = $(first); if (n) n.focus(); }, 30);
    tryCreate();
  }
  function formOk() { return validName($("rfNombre").value) && validTel($("rfTel").value) && validMail($("rfCorreo").value); }
  function lockMsg(html, bad) { var t = $("rfLockTxt"); if (t) t.innerHTML = html; var l = $("rfClabeLock"); if (l) l.classList.toggle("bad", !!bad); }

  function tryCreate() {
    if (S.pago || S.busy || !$("rfNombre") || !formOk()) return;
    S.busy = true; S.contact = { tel: $("rfTel").value.replace(/\D/g, ""), correo: $("rfCorreo").value.trim() };
    lockMsg("<b>Generando tu CLABE…</b><br>Estamos apartando tu horario.");
    api("/pago/crear", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload(S.sel)) })
      .then(function (r) {
        S.busy = false;
        if (!$("rfNombre")) return; // se cerró mientras tanto
        if (r.exito && r.clabe) { S.pago = r; S.lastId = r.pagoId; showClabe(r); return; }
        S.av = {};
        if (r._status === 409) {
          lockMsg("<b>" + esc(r.error || "Ese horario ya no está disponible.") + "</b><br>Vuelve y elige otro.", true);
          var b = document.createElement("button"); b.type = "button"; b.className = "rf-btn"; b.style.cssText = "margin-top:10px;width:100%"; b.textContent = "Elegir otro horario";
          b.onclick = function () { backToStep1(true); };
          $("rfClabeLock").appendChild(b);
        } else {
          S.err = true;
          lockMsg("<b>" + esc(r.error || "No pudimos generar tu CLABE.") + "</b><br>Revisa tu conexión y vuelve a tocar tus datos para reintentar.", true);
        }
      })
      .catch(function () {
        S.busy = false; S.err = true;
        lockMsg("<b>Sin conexión con el servidor.</b><br>Vuelve a tocar tus datos para reintentar.", true);
      });
  }

  function showClabe(r) {
    ["rfNombre", "rfTel", "rfCorreo"].forEach(function (id) { $(id).disabled = true; });
    var s = S.sel, sim = r.proveedor === "simulado";
    var h = '<div class="rf-clabe"><div class="rf-clabe-intro">Transfiere el monto exacto a esta cuenta. La CLABE es solo para este pago.</div>';
    h += '<div class="rf-clabe-row"><div><small>CLABE</small><strong>' + fmtClabe(r.clabe) + '</strong></div><button type="button" class="rf-copy" data-copy="' + r.clabe + '" aria-label="Copiar CLABE">' + ICO_COPY + "</button></div>";
    h += '<div class="rf-clabe-row"><div><small>Monto exacto</small><strong>' + money(r.monto) + '.00 MXN</strong></div><button type="button" class="rf-copy" data-copy="' + r.monto + '.00" aria-label="Copiar monto">' + ICO_COPY + "</button></div></div>";
    h += '<div class="rf-wait" style="margin-top:12px"><span class="rf-dot"></span>Esperando tu transferencia. Se confirma sola al llegar.</div>';
    if (sim) h += '<div class="rf-proto"><b>Modo de prueba.</b> La CLABE es simulada: no se cobra nada y no se envían SMS reales.<br><button type="button" class="rf-btn" id="rfSim" style="height:44px;width:100%;margin-top:8px;font-size:12px">Simular pago recibido</button></div>';
    $("rfClabe").innerHTML = h; $("rfClabe").hidden = false; $("rfClabeLock").hidden = true;
    bindCopy();
    var sb = $("rfSim"); if (sb) sb.onclick = function () { simulate(sb); };
    if (s.holds) { var tb = $("rfTimerBox"); if (tb) tb.hidden = false; startTimer(r.vence); }
    startPoll();
  }

  function bindCopy() {
    $("rfStep2").querySelectorAll(".rf-copy").forEach(function (b) {
      b.onclick = function () {
        var v = b.getAttribute("data-copy");
        function done() { b.classList.add("ok"); b.textContent = "Listo"; setTimeout(function () { b.classList.remove("ok"); b.innerHTML = ICO_COPY; }, 1400); }
        try { navigator.clipboard.writeText(v).then(done, function () { fallbackCopy(v); done(); }); } catch (e) { fallbackCopy(v); done(); }
      };
    });
  }
  function bindStep2() {
    $("rfBack").onclick = function () { S.pago ? askCancel(function () { backToStep1(true); }) : backToStep1(false); };
    $("rfCancel").onclick = $("rfBack").onclick;
    var ids = ["rfNombre", "rfTel", "rfCorreo"], fn = [validName, validTel, validMail];
    ids.forEach(function (id, i) {
      var el = $(id);
      el.addEventListener("input", function () {
        if (fn[i](el.value)) el.classList.remove("bad");
        if (S.err) { S.err = false; lockMsg("<b>Aquí aparecerá tu CLABE.</b><br>Completa tu nombre, teléfono y correo para verla.", false); }
        tryCreate();
      });
      el.addEventListener("blur", function () { el.classList.toggle("bad", el.value !== "" && !fn[i](el.value)); });
    });
  }
  function fallbackCopy(v) {
    var t = document.createElement("textarea"); t.value = v; t.style.position = "fixed"; t.style.opacity = "0";
    document.body.appendChild(t); t.select(); try { document.execCommand("copy"); } catch (e) {} document.body.removeChild(t);
  }

  // Confirmación en la propia ventana antes de liberar un horario ya apartado
  function askCancel(onYes) {
    var box = $("rfAsk"); if (!box) { onYes(); return; }
    box.hidden = false;
    box.innerHTML = '<div class="rf-ask"><b>¿Liberar el horario?</b><span>Si ya transferiste, no canceles: tu pago se confirma solo.</span><div><button type="button" class="rf-btn" id="rfAskYes" style="height:42px;padding:0 18px;font-size:12px">Sí, cancelar</button><button type="button" class="rf-link" id="rfAskNo">Seguir pagando</button></div></div>';
    $("rfAskYes").onclick = function () { box.hidden = true; onYes(); };
    $("rfAskNo").onclick = function () { box.hidden = true; };
    box.scrollIntoView({ block: "nearest" });
  }
  function releasePago(cb) {
    var p = S.pago; stopTimer(); stopPoll(); S.pago = null; S.av = {};
    if (!p) { if (cb) cb(); return; }
    api("/pago/cancelar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pagoId: p.pagoId }) })
      .then(function (r) { if (r && r.estado === "pagado") { S.pago = p; S.sel = S.sel; showDone({ estado: "pagado" }); } else if (cb) cb(); })
      .catch(function () { if (cb) cb(); });
  }
  function backToStep1(release) {
    if (release && S.pago) { releasePago(function () { showStep(1); renderAll(); }); return; }
    stopTimer(); stopPoll(); S.pago = null; S.busy = false;
    showStep(1); renderAll();
  }

  /* ── cuenta regresiva y consulta de estado ── */
  function startTimer(venceIso) {
    stopTimer(); S.deadline = venceIso ? new Date(venceIso).getTime() : Date.now() + 15 * 60 * 1000;
    function tick() {
      var left = Math.max(0, Math.round((S.deadline - Date.now()) / 1000)), el = $("rfTimer");
      if (el) el.textContent = pad2(Math.floor(left / 60)) + ":" + pad2(left % 60);
      if (left <= 0) { stopTimer(); onLocalExpiry(); }
    }
    tick(); S.timer = setInterval(tick, 1000);
  }
  function stopTimer() { if (S.timer) { clearInterval(S.timer); S.timer = null; } }
  function onLocalExpiry() {
    var p = S.pago; if (!p) return;
    api("/pago/cancelar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pagoId: p.pagoId }) })
      .then(function (r) { if (r && r.estado === "pagado") showDone({ estado: "pagado" }); else { stopPoll(); S.pago = null; S.av = {}; showExpired(); } })
      .catch(function () { stopPoll(); showExpired(); });
  }
  function startPoll() {
    stopPoll();
    var id = S.pago.pagoId;
    (function loop() {
      S.poll = setTimeout(function () {
        if (!S.pago || S.pago.pagoId !== id) return;
        api("/pago/estado?pagoId=" + encodeURIComponent(id))
          .then(function (r) {
            if (!S.pago || S.pago.pagoId !== id) return;
            if (r.estado === "pagado") { showDone({ estado: "pagado" }); }
            else if (r.estado === "tardio_sin_horario" || r.estado === "reembolsado") { showLate(); }
            else if (r.estado === "vencido" || r.estado === "cancelado") { stopTimer(); S.pago = null; S.av = {}; showExpired(); }
            else loop();
          })
          .catch(loop);
      }, 4000);
    })();
  }
  function stopPoll() { if (S.poll) { clearTimeout(S.poll); S.poll = null; } }

  function simulate(btn) {
    btn.disabled = true; btn.textContent = "Simulando…"; stopPoll();
    api("/pago/simular-pago", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pagoId: S.pago.pagoId, monto: S.pago.monto }) })
      .then(function (r) {
        if (r.exito && r.estado === "pagado") showDone(r);
        else if (r.estado === "tardio_sin_horario") showLate();
        else { btn.disabled = false; btn.textContent = "Simular pago recibido"; alertLine(r.error || "No se pudo simular el pago."); startPoll(); }
      })
      .catch(function () { btn.disabled = false; btn.textContent = "Simular pago recibido"; alertLine("Sin conexión con el servidor."); });
  }
  function alertLine(t) { var w = document.querySelector("#rfClabe .rf-proto"); if (w) { var e = document.createElement("div"); e.style.cssText = "color:#b3412f;margin-top:6px"; e.textContent = t; w.appendChild(e); } }

  /* ── paso 3: confirmación / casos especiales ── */
  function fmtCode(c) { c = String(c); return c.length === 6 ? c.slice(0, 3) + " " + c.slice(3) : c; }
  function addMin(h, m) { var x = h * 60 + m; return Math.floor(x / 60) + ":" + pad2(x % 60); }
  function maskTel(t) { return t.slice(0, 3) + " *** " + t.slice(-4); }
  var ICO_SMS = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1d1b18" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z"/><path d="M8 9.5h8M8 12.5h5"/></svg>';
  var ICO_MAIL = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1d1b18" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 7l8.5 6 8.5-6"/></svg>';
  var ICO_LOCK_G = '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#C9953A" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
  var ICO_CLOCK_G = '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#C9953A" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
  function fitDone() {
    var box = $("rfStep3").firstElementChild, ov = $("rfOverlay"); if (!box || !ov) return;
    box.style.zoom = 1;
    var pad = parseFloat(getComputedStyle(ov).paddingTop) || 0, foot = $("rfFoot");
    var avail = ov.clientHeight - 2 * pad - ((foot && !foot.hidden) ? foot.offsetHeight : 0) - 2;
    var need = box.offsetHeight;
    if (need > avail) box.style.zoom = Math.max(0.5, avail / need).toFixed(3);
  }
  window.addEventListener("resize", function () { if (S.step === 3) fitDone(); });
  function dlIcs(items) {
    var L = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//D Espacios//ES"];
    items.forEach(function (it, i) {
      var d = it.f.replace(/-/g, "");
      L.push("BEGIN:VEVENT", "UID:despacios-" + d + it.a + "-" + i + "@despacios.com.mx", "DTSTAMP:" + d + "T000000", "DTSTART:" + d + "T" + pad2(it.a) + "0000", "DTEND:" + d + "T" + pad2(it.b) + "0000", "SUMMARY:D Espacios · " + it.t, "LOCATION:Mariano Jiménez 1514, Del Real, San Luis Potosí", "END:VEVENT");
    });
    L.push("END:VCALENDAR");
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([L.join("\r\n")], { type: "text/calendar" })); a.download = "despacios.ics";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }
  function showDone(r) {
    stopTimer(); stopPoll();
    var s = S.sel, k = S.tab, c = S.contact || {}, pid = S.pago ? S.pago.pagoId : S.lastId;
    var res = (r && r.resultado) || r || {}, ac = res.accesos || [], link = res.linkPersonal || "";
    S.pago = null; S.av = {}; S.chan = "sms";
    var of = NOMBRES[S.of], cal = [];
    var title = k === "plan" ? "¡Plan activado!" : (k === "daypass" ? "¡Day pass confirmado!" : "¡Reserva confirmada!");
    var l1, l2, card, extra = "";
    if (k === "suelta") {
      var a = Math.min.apply(null, S.hours), b = Math.max.apply(null, S.hours) + 1, n = S.hours.length;
      l1 = of + " · Privada"; l2 = fmtShort(fromYmd(S.date)) + " · " + a + ":00 – " + b + ":00 · " + n + (n === 1 ? " hora" : " horas");
      cal.push({ f: S.date, a: a, b: b, t: of });
      card = '<div class="rf-coderow"><div><small>Tu código de acceso</small><div class="rf-code">' + (ac[0] ? fmtCode(ac[0].codigo) : "—") + '</div></div>' + ICO_LOCK_G + '</div><div class="rf-codeval">' + (ac[0] ? "Válido de " + addMin(a, -10).replace(/^(\d):/, "$1:") + " a " + addMin(b, 10) + " · Puerta principal y oficina." : "Te lo enviamos por SMS.") + "</div>";
    } else if (k === "daypass") {
      var ds = S.days.slice().sort(), np = ds.length;
      l1 = of + " · Privada"; l2 = "Day pass · " + np + (np === 1 ? " día" : " días") + " · 8:00 a 16:00";
      card = "<small>Tus días y códigos de acceso</small><div class=\"rf-days\">";
      ds.forEach(function (f) {
        var x = ac.filter(function (q) { return q.fecha === f; })[0];
        cal.push({ f: f, a: 8, b: 16, t: of + " (day pass)" });
        card += '<div class="rf-day-row"><div><b>' + fmtLong(fromYmd(f)) + "</b><span>8:00 – 16:00</span></div><strong>" + (x ? fmtCode(x.codigo) : "—") + "</strong></div>";
      });
      card += "</div>"; extra = '<div class="rf-n2">Cambia o cancela tus días desde tu link personal, hasta 24 horas antes de cada día.</div>';
    } else {
      var pl = PLANES.filter(function (x) { return x.id === S.plan; })[0], v = new Date(); v.setDate(v.getDate() + 30);
      l1 = "Plan " + pl.n + " · " + pl.h + " horas"; l2 = of + " · " + money(pl.p / pl.h) + " por hora";
      card = '<div class="rf-coderow"><div><small>Horas disponibles</small><div class="rf-hrs">' + pl.h + " <i>de " + pl.h + "</i></div></div>" + ICO_CLOCK_G + '</div><div class="rf-codeval rf-plan-val">Vigente hasta el ' + v.getDate() + " de " + MESES[v.getMonth()] + " de " + v.getFullYear() + "</div>";
    }
    var h = '<div class="rf-ok"><div class="rf-done-ico"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#2f7d5b" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div><h3>' + title + '</h3><div class="rf-sub">Tu pago fue recibido.</div>';
    h += '<div class="rf-summary"><img alt="" src="' + photoOf(S.of) + '"><div class="rf-summary-txt"><b>' + l1 + "</b><span>" + l2 + "</span></div></div>";
    h += '<div class="rf-codecard' + (k === "daypass" ? " rf-dp" : "") + '">' + card + "</div>" + extra;
    if (k === "plan") h += '<div class="rf-n2 rf-n2p"><b>Aún no tienes horario.</b> Agenda tus horas cuando quieras desde tu link personal. Cada vez que agendes, recibes tu código de acceso.</div>';
    h += '<div class="rf-ch-q">' + (k === "plan" ? "¿Cómo quieres recibir tu link personal?" : (k === "daypass" ? "¿Cómo quieres recibir tu link y tus códigos?" : "¿Cómo quieres recibir tu link y tu código?")) + '</div><div class="rf-chan" role="radiogroup">';
    h += '<button type="button" class="rf-ch" role="radio" aria-checked="true" data-ch="sms"><span class="rf-radio"></span>' + ICO_SMS + "<div><b>Por SMS</b><span>Al " + esc(maskTel(c.tel || "0000000000")) + "</span></div></button>";
    h += '<button type="button" class="rf-ch" role="radio" aria-checked="false" data-ch="correo"><span class="rf-radio"></span>' + ICO_MAIL + "<div><b>Por correo electrónico</b><span>" + esc(c.correo || "") + "</span></div></button></div>";
    h += '<div class="rf-sendmsg" id="rfSendMsg" role="status"></div>';
    h += '<div class="rf-fine">Te escribimos desde solucionandoespacios@gmail.com. Si no lo ves, revisa tu carpeta de spam. ¿Sigue sin llegar? <a href="https://wa.me/524448295401" target="_blank" rel="noopener"><b>Escríbenos por WhatsApp</b></a> y te lo reenviamos.' + (TEST ? " <b>Modo de prueba: el SMS es simulado y no se envió.</b>" : "") + "</div>";
    h += '<div class="rf-ft">';
    var main = k === "plan" ? "Agendar mis horas" : (k === "daypass" ? "Ver mis días" : "Ver mi reserva");
    h += link ? '<a class="rf-btn rf-btn-dark" href="' + esc(link) + '" target="_blank" rel="noopener">' + main + ' <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C9953A" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>' + "</a>" : "";
    h += k === "plan" ? (link ? '<a class="rf-btn rf-btn-out" href="' + esc(link) + '" target="_blank" rel="noopener">Ver mi cuenta</a>' : "") : '<button type="button" class="rf-btn rf-btn-out" id="rfIcs">Agregar a mi calendario</button>';
    h += '<button type="button" class="rf-link" id="rfDoneClose" hidden>Cerrar</button></div></div>';
    $("rfStep3").innerHTML = h; showStep(3); fitDone();
    $("rfDoneClose").onclick = hideFlow;
    var ib = $("rfIcs"); if (ib) ib.onclick = function () { dlIcs(cal); };
    $("rfStep3").querySelectorAll(".rf-ch").forEach(function (b) {
      b.onclick = function () {
        var ch = b.getAttribute("data-ch"); if (ch === S.chan) return;
        S.chan = ch;
        $("rfStep3").querySelectorAll(".rf-ch").forEach(function (x) { x.setAttribute("aria-checked", x === b ? "true" : "false"); });
        var m = $("rfSendMsg"); m.className = "rf-sendmsg"; m.textContent = "Enviando…";
        api("/pago/enviar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pagoId: pid, canal: ch }) })
          .then(function (x) { if (x.exito) m.textContent = ch === "sms" ? "Listo: te lo reenviamos por SMS." : "Listo: te lo enviamos a " + (c.correo || "tu correo") + "."; else { m.className = "rf-sendmsg bad"; m.textContent = x.error || "No se pudo enviar."; } })
          .catch(function () { m.className = "rf-sendmsg bad"; m.textContent = "Sin conexión con el servidor."; });
      };
    });
  }
  function showLate() {
    stopTimer(); stopPoll(); S.pago = null; S.av = {};
    $("rfStep3").innerHTML = '<div class="rf-expired"><h3>Recibimos tu pago tarde</h3><div class="rf-sub" style="max-width:360px">Tu transferencia llegó cuando el apartado ya había vencido y el horario fue ocupado. Te devolvemos tu dinero: escríbenos por WhatsApp y lo resolvemos hoy.</div><a class="rf-btn" style="padding:0 28px;display:inline-flex;align-items:center;text-decoration:none" href="https://wa.me/524448295401" target="_blank" rel="noopener">Escribir por WhatsApp</a><button type="button" class="rf-link" id="rfLateClose">Cerrar</button></div>';
    showStep(3); $("rfLateClose").onclick = hideFlow;
  }
  function showExpired() {
    $("rfStep3").innerHTML = '<div class="rf-expired"><h3>Se acabó el tiempo</h3><div class="rf-sub" style="max-width:340px">No recibimos tu transferencia y liberamos el horario para que otra persona pueda reservarlo. Si ya transferiste, escríbenos por WhatsApp.</div><button type="button" class="rf-btn" id="rfAgain" style="padding:0 28px">Volver a elegir</button></div>';
    showStep(3);
    $("rfAgain").onclick = function () { resetSel(); showStep(1); renderAll(); };
  }

  /* ── eventos del paso 1 ── */
  function rerender() { if (S.step === 1) { renderPanel(); renderFoot(); } }
  $("rfPanel").addEventListener("click", function (e) {
    var t = e.target.closest("[data-act]"); if (!t || t.disabled) return;
    var a = t.getAttribute("data-act");
    if (a === "prev" || a === "next") { S.month = new Date(S.month.getFullYear(), S.month.getMonth() + (a === "next" ? 1 : -1), 1); }
    else if (a === "day") {
      var k = t.getAttribute("data-date"), dd = fromYmd(k);
      if (S.tab === "suelta") { S.date = k; S.hours = []; loadAv(dd, function () { if (S.date === k) rerender(); }); }
      else {
        var i = S.days.indexOf(k); S.dpMsg = "";
        if (i > -1) S.days.splice(i, 1);
        else if (S.days.length < S.pack) {
          loadAv(dd, function () {
            for (var h2 = 8; h2 < 16; h2++) if (!hourFree(dd, h2)) { S.dpMsg = "El " + fmtLong(dd) + " ya no tiene libre el horario completo (8:00 a 16:00). Elige otro día."; rerender(); return; }
            if (S.days.indexOf(k) < 0 && S.days.length < S.pack) S.days.push(k);
            rerender();
          });
          return;
        }
      }
    } else if (a === "retry") { delete S.av[avKey(fromYmd(S.date))]; loadAv(fromYmd(S.date), rerender); }
    else if (a === "hour") {
      var h = +t.getAttribute("data-h"), i2 = S.hours.indexOf(h);
      if (i2 > -1) { var mn = Math.min.apply(null, S.hours), mx = Math.max.apply(null, S.hours); if (h === mn || h === mx) S.hours.splice(i2, 1); else S.hours = [h]; }
      else if (S.hours.length && (h === Math.min.apply(null, S.hours) - 1 || h === Math.max.apply(null, S.hours) + 1)) S.hours.push(h);
      else S.hours = [h];
    } else if (a === "plan") { S.plan = t.getAttribute("data-id"); }
    else if (a === "pack") { S.pack = +t.getAttribute("data-d"); S.dpMsg = ""; if (S.days.length > S.pack) S.days = S.days.slice(0, S.pack); }
    renderPanel(); renderFoot();
  });
  document.querySelectorAll(".rf-tab").forEach(function (t) { t.addEventListener("click", function () { S.tab = t.getAttribute("data-tab"); S.dpMsg = ""; renderAll(); }); });
  document.querySelectorAll("#rfOffices .rf-chip").forEach(function (c) {
    c.addEventListener("click", function () {
      S.of = c.getAttribute("data-of"); resetSel(); renderAll();
    });
  });
  $("rfGo").addEventListener("click", goStep2);
  $("rfClose").addEventListener("click", closeFlow);
  $("rfOverlay").addEventListener("mousedown", function (e) { if (e.target === this && S.step !== 2) closeFlow(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && $("rfOverlay").classList.contains("open")) closeFlow(); });

  /* ── enganches con la página ── */
  try {
    var qp = new URLSearchParams(location.search);
    S.cli = { nombre: qp.get("nombre") || "", tel: (qp.get("tel") || "").replace(/\D/g, "").slice(-10), correo: qp.get("correo") || "" };
  } catch (e) { S.cli = {}; }
  $("rfRibbon").hidden = !TEST;
  window.irAReservar = function (tab, of) { openFlow(tab === "paquete" ? "plan" : (tab || "suelta"), of); };
  window.selectSpace = function () {};
  window.toggleMobileNav = function () { $("navLinks").classList.toggle("open"); $("navBurger").classList.toggle("active"); };
  document.querySelectorAll("#navLinks a").forEach(function (a) {
    a.addEventListener("click", function () { $("navLinks").classList.remove("open"); $("navBurger").classList.remove("active"); });
  });
})();
