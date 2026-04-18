/**
 * RCD Calculator — NSCP 2015 Ultimate Strength Design (USD)
 * Singly: rectangular + T-beam (analysis / design)
 * Doubly: rectangular (analysis / design from loads)
 */

(function () {
  'use strict';

  const Es = 200000;
  const EC = 0.003;
  const ET_TENSION_CONTROLLED = 0.005;

  function getEl(id) { return document.getElementById(id); }
  function num(id, def = 0) {
    const v = getEl(id);
    return v ? (parseFloat(v.value) || def) : def;
  }
  function fmt(n, d = 2) {
    if (n === undefined || n === null || isNaN(n)) return '—';
    return Number(n).toLocaleString('en', { minimumFractionDigits: d, maximumFractionDigits: d });
  }

  function beta1(fc) {
    if (fc <= 28) return 0.85;
    return Math.max(0.65, 0.85 - (0.05 * (fc - 28)) / 7);
  }

  function phiFromStrain(et, ety) {
    if (et >= ET_TENSION_CONTROLLED) return 0.9;
    if (et <= ety) return 0.65;
    return 0.65 + (0.25 * (et - ety)) / (ET_TENSION_CONTROLLED - ety);
  }

  /** Factored moment (kN·m) from distributed + point loads, NSCP combination */
  function factoredMoment_kNm(L_m, support, DL, LL, DLpt, LLpt) {
    const wu = 1.2 * DL + 1.6 * LL;
    const Pu = 1.2 * DLpt + 1.6 * LLpt;
    let M = (wu * L_m * L_m) / 8 + (Pu * L_m) / 4;
    if (support === 'cantilever') M = (wu * L_m * L_m) / 2 + Pu * L_m;
    return { Mu_kNm: M, wu, Pu };
  }

  // ---------- Context (main tab, singly type, mode) ----------
  function getMain() {
    const t = document.querySelector('.main-tab.active');
    return t ? t.dataset.main : 'singly';
  }
  function getSinglyType() {
    const t = document.querySelector('.sub-tab.active');
    return t ? t.dataset.singly : 'rect';
  }
  function getRectMode() {
    const r = document.querySelector('input[name="rect-mode"]:checked');
    return r ? r.value : 'analysis';
  }
  function getTBeamMode() {
    const r = document.querySelector('input[name="tbeam-mode"]:checked');
    return r ? r.value : 'analysis';
  }
  function getDoublyMode() {
    const r = document.querySelector('input[name="doubly-mode"]:checked');
    return r ? r.value : 'analysis';
  }

  function getContextKey() {
    const main = getMain();
    if (main === 'doubly') return `doubly-${getDoublyMode()}`;
    if (getSinglyType() === 'rect') return `rect-${getRectMode()}`;
    return `tbeam-${getTBeamMode()}`;
  }

  function refreshPanels() {
    const singly = getEl('panel-singly');
    const doubly = getEl('panel-doubly');
    const main = getMain();
    if (singly) singly.classList.toggle('hidden', main !== 'singly');
    if (doubly) doubly.classList.toggle('hidden', main !== 'doubly');

    const rectBlock = getEl('singly-rect-block');
    const tBlock = getEl('singly-tbeam-block');
    if (main === 'singly' && rectBlock && tBlock) {
      const st = getSinglyType();
      rectBlock.classList.toggle('hidden', st !== 'rect');
      tBlock.classList.toggle('hidden', st !== 'tbeam');
    }

    if (main === 'singly' && getSinglyType() === 'rect') {
      const m = getRectMode();
      toggleModeInputs('input-rect-analysis', 'input-rect-design', m === 'analysis');
    }
    if (main === 'singly' && getSinglyType() === 'tbeam') {
      const m = getTBeamMode();
      toggleModeInputs('input-tbeam-analysis', 'input-tbeam-design', m === 'analysis');
    }
    if (main === 'doubly') {
      const m = getDoublyMode();
      toggleModeInputs('input-doubly-analysis', 'input-doubly-design', m === 'analysis');
    }
  }

  function toggleModeInputs(idA, idB, showA) {
    const a = getEl(idA);
    const b = getEl(idB);
    if (a) { a.classList.toggle('hidden', !showA); a.classList.toggle('active', showA); }
    if (b) { b.classList.toggle('hidden', showA); b.classList.toggle('active', !showA); }
  }

  // ==================== RECTANGULAR ANALYSIS ====================
  function calcRectangularAnalysis() {
    const b = num('usd-a-b', 300);
    const h = num('usd-a-h', 500);
    const d = num('usd-a-d', 450);
    const fc = num('usd-a-fc', 28);
    const fy = num('usd-a-fy', 420);
    const Nb = num('usd-a-Nb', 4);
    const Db = num('usd-a-Db', 20);
    if (!b || !d || !fc || !fy || !Nb || !Db) return null;

    const As = Nb * (Math.PI * Db * Db) / 4;
    const rho = As / (b * d);
    const rhoMin1 = 1.4 / fy;
    const rhoMin2 = (0.25 * Math.sqrt(fc)) / fy;
    const rhoMin = Math.max(rhoMin1, rhoMin2);
    const ety = fy / Es;
    const b1 = beta1(fc);
    const rhoMax = (3 / 7) * b1 * (0.85 * fc / fy);
    const a = (As * fy) / (0.85 * fc * b);
    const c = a / b1;
    const et = ((d - c) / c) * EC;
    const phi = phiFromStrain(et, ety);
    const Mn = As * fy * (d - a / 2);
    const phiMn = phi * Mn;
    const Mu_kNm = phiMn / 1e6; // report capacity as Mu in analysis output

    return {
      b, h, d, fc, fy, Nb, Db, Mu_kNm, As, rho, rhoMin1, rhoMin2, rhoMin,
      rhoMax, b1, a, c, et, ety, phi, Mn, phiMn
    };
  }

  function renderRectangularAnalysis(r, out) {
    out = out || getEl('calculation-output');
    if (!out) return;
    if (!r) {
      out.innerHTML = '<div class="calc-step"><p>Enter valid inputs.</p></div>';
      return;
    }
    const phiMnKnm = r.phiMn / 1e6;
    let html = '';
    html += `<div class="calc-step"><div class="calc-step-title">Rectangular beam — Analysis (NSCP 2015 USD)</div><div class="calc-step-equation">Given: b = ${fmt(r.b)}, h = ${fmt(r.h)}, d = ${fmt(r.d)}, f<sub>c</sub>′ = ${fmt(r.fc)}, f<sub>y</sub> = ${fmt(r.fy)}, N<sub>b</sub> = ${r.Nb}, D<sub>b</sub> = ${fmt(r.Db)} mm</div></div>`;
    const steelCond = r.et >= r.ety ? '✔ Steel yields' : '⚠ Not yielding';
    html += `<div class="calc-step"><div class="calc-step-title">1) Check for p (p<sub>min</sub>, p<sub>act</sub>, p<sub>max</sub>)</div><div class="calc-step-equation">A<sub>s</sub> = N<sub>b</sub>πD<sub>b</sub>²/4 = ${fmt(r.As)} mm²</div><div class="calc-step-equation">p<sub>min</sub> = max(0.25√f<sub>c</sub>′/f<sub>y</sub>, 1.4/f<sub>y</sub>) = ${fmt(r.rhoMin, 4)}</div><div class="calc-step-equation">p<sub>act</sub> = A<sub>s</sub>/(bd) = ${fmt(r.rho, 4)}</div><div class="calc-step-equation">p<sub>max</sub> = (3/7) β<sub>1</sub>(0.85 f<sub>c</sub>′ / f<sub>y</sub>) = ${fmt(r.rhoMax, 4)}</div><div class="calc-step-equation"><span class="calc-step-result">${steelCond}</span></div></div>`;
    html += `<div class="calc-step"><div class="calc-step-title">2) Solve for a, c, ε<sub>t</sub></div><div class="calc-step-equation">β<sub>1</sub> = ${fmt(r.b1, 3)}, a = A<sub>s</sub>f<sub>y</sub>/(0.85f<sub>c</sub>′b) = ${fmt(r.a)} mm, c = a/β<sub>1</sub> = ${fmt(r.c)} mm, ε<sub>t</sub> = ${fmt(r.et, 4)}</div></div>`;
    html += `<div class="calc-step"><div class="calc-step-title">3) Compute for Moment Capacity (M<sub>u</sub>)</div><div class="calc-step-equation">M<sub>n</sub> = ${fmt(r.Mn / 1e6)} kN·m; φ = ${fmt(r.phi, 2)}; φM<sub>n</sub> = ${fmt(phiMnKnm)} kN·m; <span class="calc-step-result">M<sub>u</sub> = ${fmt(r.Mu_kNm)} kN·m</span></div></div>`;
    out.innerHTML = html;
  }

  // ==================== RECTANGULAR DESIGN (loads only) ====================
  function designSinglyFromMu(b, h, d, fc, fy, Mu_kNm, Db, extra) {
    const Mu_Nmm = Mu_kNm * 1e6;
    let phi = 0.9;
    const b1 = beta1(fc);
    const rhoMin1 = 1.4 / fy;
    const rhoMin2 = (0.25 * Math.sqrt(fc)) / fy;
    const rhoMin = Math.max(rhoMin1, rhoMin2);
    const ety = fy / Es;
    const rhoMax = (3 / 7) * b1 * (0.85 * fc / fy);
    const coA = (fy * fy) / (1.7 * fc * b);
    const coB = -fy * d;
    const coC = Mu_Nmm / phi;
    const disc = coB * coB - 4 * coA * coC;
    let AsReq = 0;
    if (disc >= 0) {
      AsReq = (-coB - Math.sqrt(disc)) / (2 * coA);
      if (AsReq < 0) AsReq = (-coB + Math.sqrt(disc)) / (2 * coA);
    }
    const rhoReq = AsReq / (b * d);
    const Ab = (Math.PI * Db * Db) / 4;
    const AsMin = rhoMin * b * d;
    const AsUsed = Math.max(AsMin, Math.min(AsReq, rhoMax * b * d));
    const Nb = Math.ceil(AsUsed / Ab);
    const As = Nb * Ab;
    const rho = As / (b * d);
    const a = (As * fy) / (0.85 * fc * b);
    const c = a / b1;
    const et = ((d - c) / c) * EC;
    phi = phiFromStrain(et, ety);
    const Mn = As * fy * (d - a / 2);
    const phiMn = phi * Mn;
    const safe = phiMn >= Mu_Nmm;
    return {
      b, h, d, fc, fy, Mu_kNm, Db, phi, b1, rhoMin, rhoMax, AsReq, rhoReq, AsMin, AsUsed, Ab, Nb, As, rho, a, c, et, Mn, phiMn, safe, ...extra
    };
  }

  function calcRectangularDesignLoads() {
    const L_m = num('usd-d-L', 6);
    const support = getEl('usd-d-support') ? getEl('usd-d-support').value : 'simple';
    const Mu_kNm = num('usd-d-Mu', 180);
    const L = L_m * 1000;
    let h;
    if (support === 'cantilever') h = L / 8;
    else if (support === 'one-end-cont') h = L / 18.5;
    else if (support === 'both-ends-cont') h = L / 21;
    else h = L / 16;
    h = Math.round(h / 25) * 25;
    const b0 = Math.max(200, Math.round((h / 1.5) / 25) * 25);
    const cover = num('usd-d-cover', 40);
    const stirrup = num('usd-d-stirrup', 10);
    const Db = parseInt((getEl('usd-d-Db-L') || {}).value || 16, 10);
    const fc = num('usd-d-fc-L', 28);
    const fy = num('usd-d-fy-L', 420);
    const Mu_Nmm = Mu_kNm * 1e6;
    const phiAssumed = 0.9;

    function evaluateSection(b, h) {
      const d = h - cover - stirrup - Db / 2;
      if (d <= 0) return null;
      const rhoReq = Mu_Nmm / (phiAssumed * b * d * d * fy);
      const AsReq = rhoReq * b * d;
      const ety = fy / Es;
      const b1 = beta1(fc);
      const rhoMin = Math.max(1.4 / fy, (0.25 * Math.sqrt(fc)) / fy);
      const rhoBal = (0.85 * b1 * fc / fy) * (ety / (ety + 0.003));
      const rhoMax = 0.75 * rhoBal;
      const overReinforced = rhoReq > rhoMax;
      const Ab = (Math.PI * Db * Db) / 4;
      const AsTrial = Math.max(AsReq, rhoMin * b * d);
      const nb = Math.max(2, Math.ceil(AsTrial / Ab));
      const AsActual = nb * Ab;
      const rhoActual = AsActual / (b * d);
      const a = (AsActual * fy) / (0.85 * fc * b);
      const c = a / b1;
      const et = ((d - c) / c) * 0.003;
      const phi = phiFromStrain(et, ety);
      const Mn = AsActual * fy * (d - a / 2);
      const phiMn = phi * Mn;
      const overActualMax = rhoActual > rhoMax;
      const steelYields = et >= ety;
      const safe = phiMn >= Mu_Nmm && !overActualMax && steelYields;
      return {
        b, h, d, rhoReq, AsReq, ety, b1, rhoMin, rhoMax, overReinforced,
        nb, AsActual, rhoActual, a, c, et, phi, Mn, phiMn, overActualMax, steelYields, safe
      };
    }

    const initial = evaluateSection(b0, h);
    let result = initial;
    let adjusted = false;
    let adjustedSteps = 0;
    if (result && !result.safe) {
      let trialH = h;
      for (let i = 0; i < 120; i++) {
        trialH += 25;
        const trialB = Math.max(200, Math.round((trialH / 1.5) / 25) * 25);
        const trial = evaluateSection(trialB, trialH);
        if (!trial) continue;
        adjustedSteps += 1;
        result = trial;
        if (trial.safe) {
          adjusted = true;
          break;
        }
      }
    }
    if (!result) return null;
    return {
      L_m, support, Mu_kNm, fc, fy, Db, phiAssumed,
      ...result,
      adjusted,
      adjustedSteps,
      originalB: b0,
      originalH: h
    };
  }

  function renderRectangularDesign(r, out) {
    out = out || getEl('calculation-output');
    if (!r) {
      out.innerHTML = '<div class="calc-step"><p>Enter valid inputs.</p></div>';
      return;
    }
    let html = '';
    html += `<div class="calc-step"><div class="calc-step-title">Rectangular beam — Design (using M<sub>u</sub>)</div>`;
    html += `<div class="calc-step-equation">L = ${fmt(r.L_m)} m, support = ${r.support}, M<sub>u</sub> = ${fmt(r.Mu_kNm)} kN·m, f<sub>c</sub>′ = ${fmt(r.fc)} MPa, f<sub>y</sub> = ${fmt(r.fy)} MPa</div></div>`;
    html += `<div class="calc-step"><div class="calc-step-title">1) Final geometry</div><div class="calc-step-equation">Final base b = <span class=\"calc-step-result\">${fmt(r.b)} mm</span>, height h = <span class=\"calc-step-result\">${fmt(r.h)} mm</span>, effective depth d = <span class=\"calc-step-result\">${fmt(r.d)} mm</span></div></div>`;
    html += `<div class="calc-step"><div class="calc-step-title">2) Solve for p; assume reduction factor φ = 0.90</div><div class="calc-step-equation">p = M<sub>u</sub>/(φ b d² f<sub>y</sub>) = <span class=\"calc-step-result\">${fmt(r.rhoReq, 4)}</span></div></div>`;
    if (r.adjusted) {
      html += `<div class="calc-step verification-ok"><div class="calc-step-title">Auto-adjusted section</div><div class="calc-step-equation">Initial trial (${fmt(r.originalB)} × ${fmt(r.originalH)} mm) was NOT SAFE. Section resized to <span class=\"calc-step-result\">${fmt(r.b)} × ${fmt(r.h)} mm</span> after ${r.adjustedSteps} increment(s).</div></div>`;
    }
    html += `<div class="calc-step"><div class="calc-step-title">3) Check for p (p<sub>min</sub>, p, p<sub>max</sub>)</div><div class="calc-step-equation">p<sub>min</sub> = max(1.4/f<sub>y</sub>, 0.25√f<sub>c</sub>′/f<sub>y</sub>) = ${fmt(r.rhoMin, 4)}</div><div class="calc-step-equation">p = ${fmt(r.rhoReq, 4)}</div><div class="calc-step-equation">p<sub>max</sub> = (3/7) β<sub>1</sub>(0.85 f<sub>c</sub>′ / f<sub>y</sub>) = ${fmt(r.rhoMax, 4)}</div></div>`;
    html += `<div class="calc-step"><div class="calc-step-title">4) Solve for A<sub>s</sub> and no. of rebars</div><div class="calc-step-equation">p = A<sub>s</sub>/(bd)</div><div class="calc-step-equation">A<sub>s,req</sub> = pbd = ${fmt(r.AsReq)} mm²</div><div class="calc-step-equation">A<sub>s</sub> = n(πD<sub>b</sub>²/4) = ${fmt(r.AsActual)} mm²</div><div class="calc-step-equation">n<sub>b</sub> = <span class=\"calc-step-result\">${r.nb} bars</span></div></div>`;
    html += `<div class="calc-step"><div class="calc-step-title">5) Recheck p ratio (p<sub>min</sub>, p, p<sub>max</sub>)</div><div class="calc-step-equation">p<sub>min</sub> = ${fmt(r.rhoMin, 4)}, p<sub>actual</sub> = ${fmt(r.rhoActual, 4)}, p<sub>max</sub> = ${fmt(r.rhoMax, 4)}</div></div>`;
    const steelCond = r.steelYields ? '✔ Steel yields' : '⚠ Not yielding / compression-controlled';
    html += `<div class="calc-step"><div class="calc-step-title">6) Compute for a, c, ε<sub>t</sub></div><div class="calc-step-equation">a = ${fmt(r.a)} mm; c = ${fmt(r.c)} mm; ε<sub>t</sub> = ${fmt(r.et, 4)}; φ = ${fmt(r.phi, 2)}</div><div class="calc-step-equation"><span class=\"calc-step-result\">${steelCond}</span></div></div>`;
    html += `<div class="calc-step"><div class="calc-step-title">7) Compute for moment capacity (M<sub>u</sub>)</div><div class="calc-step-equation">M<sub>n</sub> = ${fmt(r.Mn / 1e6)} kN·m; φM<sub>n</sub> = <span class=\"calc-step-result\">${fmt(r.phiMn / 1e6)} kN·m</span> (moment capacity)</div></div>`;
    const cls = r.safe ? 'verification-ok' : 'verification-warn';
    html += `<div class="calc-step ${cls}"><div class="calc-step-title">21 Final result</div><div class="calc-step-result">${r.safe ? 'SAFE ✔' : 'NOT SAFE ❌'} (φM<sub>n</sub> ${r.safe ? '≥' : '&lt;'} M<sub>u</sub>${r.overReinforced ? '; ρ<sub>req</sub> > ρ<sub>max</sub>' : ''}${r.overActualMax ? '; ρ<sub>actual</sub> > ρ<sub>max</sub>' : ''}${!r.steelYields ? '; steel not yielding (ε<sub>t</sub> < ε<sub>y</sub>)' : ''})</div></div>`;
    out.innerHTML = html;
  }

  // ==================== T-BEAM ANALYSIS ====================
  function calcTBeamAnalysis() {
    const bf = num('tb-a-bf', 1200);
    const bw = num('tb-a-bw', 300);
    const hf = num('tb-a-hf', 120);
    const d = num('tb-a-d', 550);
    const fc = num('tb-a-fc', 28);
    const fy = num('tb-a-fy', 420);
    const Nb = num('tb-a-Nb', 6);
    const Db = num('tb-a-Db', 25);
    const Mu_kNm = num('tb-a-Mu', 400);
    if (!bf || !bw || !hf || !d || !fc || !fy || !Nb || !Db) return null;

    const As = Nb * (Math.PI * Db * Db) / 4;
    const Ts = As * fy;
    const b1 = beta1(fc);
    const ety = fy / Es;
    const rho = As / (bw * d);
    const rhoMin1 = 1.4 / fy;
    const rhoMin2 = (0.25 * Math.sqrt(fc)) / fy;
    const rhoMin = Math.max(rhoMin1, rhoMin2);
    const rhoMax = (3 / 7) * b1 * (0.85 * fc / fy);
    const pSafe = rho > rhoMin;

    // Requested concrete compression area form
    const Ac = Ts / (0.85 * fc); // mm^2
    const Af = bf * hf; // mm^2

    const aTrial = Ac / bf;
    let a;
    let flangeOnly; // false T-beam branch in requested wording
    if (Ac <= Af) {
      a = aTrial;
      flangeOnly = true;
    } else {
      // Requested true T-beam branch equation: Ac = 2(bf-bw)(hf) + bw(a)
      const flangeSideArea = 2 * (bf - bw) * hf;
      a = (Ac - flangeSideArea) / bw;
      flangeOnly = false;
    }

    const c = a / b1;
    const et = ((d - c) / c) * EC;
    const phi = phiFromStrain(et, ety);

    let Mn;
    if (flangeOnly) {
      // Requested false T-beam capacity form
      Mn = 0.85 * fc * Ac * (d - a / 2);
    } else {
      // Requested true T-beam style capacity decomposition
      const flangeSideArea = 2 * (bf - bw) * hf;
      const webCompArea = Math.max(0, Ac - flangeSideArea);
      const Cflange = 0.85 * fc * flangeSideArea;
      const Cweb = 0.85 * fc * webCompArea;
      Mn = Cflange * (d - hf / 2) + Cweb * (d - a / 2);
    }

    const phiMn = phi * Mn;
    const Mu_Nmm = Mu_kNm * 1e6;
    const safe = phiMn >= Mu_Nmm;

    return {
      bf, bw, hf, d, fc, fy, Nb, Db, Mu_kNm, As, Ts, a, c, et, ety, phi, b1,
      flangeOnly, aTrial, Mn, phiMn, Mu_Nmm, safe,
      rho, rhoMin, rhoMax, pSafe, Ac, Af
    };
  }

  function renderTBeamAnalysis(r, out) {
    out = out || getEl('calculation-output');
    if (!out) return;
    if (!r) {
      out.innerHTML = '<div class="calc-step"><p>Enter valid inputs.</p></div>';
      return;
    }
    const gov = r.flangeOnly ? 'False T-beam branch (A<sub>c</sub> < A<sub>f</sub>).' : 'True T-beam branch (A<sub>c</sub> > A<sub>f</sub>).';
    let html = '';
    html += `<div class="calc-step"><div class="calc-step-title">T-beam — Analysis (USD)</div><div class="calc-step-equation">b<sub>f</sub> = ${fmt(r.bf)}, b<sub>w</sub> = ${fmt(r.bw)}, h<sub>f</sub> = ${fmt(r.hf)}, d = ${fmt(r.d)}, f<sub>c</sub>′ = ${fmt(r.fc)}, f<sub>y</sub> = ${fmt(r.fy)}, M<sub>u</sub> = ${fmt(r.Mu_kNm)} kN·m</div></div>`;
    html += `<div class="calc-step"><div class="calc-step-title">1) Solve for (p<sub>min</sub>, p)</div><div class="calc-step-equation">p<sub>min</sub> = max(1.4/f<sub>y</sub>, 0.25√f<sub>c</sub>′/f<sub>y</sub>) = ${fmt(r.rhoMin, 4)}</div><div class="calc-step-equation">p = A<sub>s</sub>/(b<sub>w</sub>d) = ${fmt(r.rho, 4)}</div><div class="calc-step-equation"><span class="calc-step-result">${r.pSafe ? '✔ p > pmin therefore SAFE' : '⚠ p ≤ pmin therefore NOT SAFE'}</span></div></div>`;
    html += `<div class="calc-step"><div class="calc-step-title">2) Solve for A<sub>c</sub> (Area of concrete)</div><div class="calc-step-equation">A<sub>c</sub> = A<sub>s</sub>f<sub>y</sub>/(0.85f<sub>c</sub>′) = <span class="calc-step-result">${fmt(r.Ac)} mm²</span></div></div>`;
    html += `<div class="calc-step"><div class="calc-step-title">3) Check area of flange</div><div class="calc-step-equation">A<sub>f</sub> = b<sub>f</sub>h<sub>f</sub> = ${fmt(r.Af)} mm²; ${gov}</div></div>`;
    if (r.flangeOnly) {
      html += `<div class="calc-step"><div class="calc-step-title">4) Solve for a, c, ε<sub>t</sub> (false T beam)</div><div class="calc-step-equation">A<sub>c</sub> = a(b<sub>f</sub>) → a = ${fmt(r.a)} mm</div><div class="calc-step-equation">c = a/β<sub>1</sub> = ${fmt(r.c)} mm; ε<sub>t</sub> = ${(fmt(r.et, 4))}</div></div>`;
      html += `<div class="calc-step"><div class="calc-step-title">5) Solve for M<sub>u</sub> capacity (false T beam)</div><div class="calc-step-equation">M<sub>u,cap</sub> = φ(0.85f<sub>c</sub>′A<sub>c</sub>(d-a/2)) = <span class="calc-step-result">${fmt(r.phiMn / 1e6)} kN·m</span></div></div>`;
    } else {
      html += `<div class="calc-step"><div class="calc-step-title">4) Solve for a, c, ε<sub>t</sub> (true T beam)</div><div class="calc-step-equation">A<sub>c</sub> = 2(b<sub>f</sub>-b<sub>w</sub>)(h<sub>f</sub>) + b<sub>w</sub>(a) → a = ${fmt(r.a)} mm</div><div class="calc-step-equation">c = a/β<sub>1</sub> = ${fmt(r.c)} mm; ε<sub>t</sub> = ${fmt(r.et, 4)}</div></div>`;
      html += `<div class="calc-step"><div class="calc-step-title">5) Solve for M<sub>u</sub> capacity (true T beam)</div><div class="calc-step-equation">M<sub>u,cap</sub> = φ[0.85f<sub>c</sub>′·2(b<sub>f</sub>-b<sub>w</sub>)(h<sub>f</sub>)(d-h<sub>f</sub>/2) + 0.85f<sub>c</sub>′·A<sub>c,web</sub>(d-a/2)] = <span class="calc-step-result">${fmt(r.phiMn / 1e6)} kN·m</span></div></div>`;
    }
    const cls = r.safe ? 'verification-ok' : 'verification-warn';
    html += `<div class="calc-step ${cls}"><div class="calc-step-title">Capacity check</div><div class="calc-step-result">${r.safe ? '✔ SAFE' : '⚠ NOT SAFE'} (M<sub>u,cap</sub> ${r.safe ? '≥' : '<'} M<sub>u</sub>)</div></div>`;
    out.innerHTML = html;
  }

  // ==================== T-BEAM DESIGN ====================
  function calcTBeamAnalysisWithNb(Nb, bf, bw, hf, d, fc, fy, Db) {
    const As = Nb * (Math.PI * Db * Db) / 4;
    const Ts = As * fy;
    const b1 = beta1(fc);
    const ety = fy / Es;
    const aTrial = Ts / (0.85 * fc * bf);
    let a;
    let flangeOnly;
    if (aTrial <= hf) {
      a = aTrial;
      flangeOnly = true;
    } else {
      a = hf + (Ts / (0.85 * fc) - bf * hf) / bw;
      flangeOnly = false;
    }
    const c = a / b1;
    const et = ((d - c) / c) * EC;
    const phi = phiFromStrain(et, ety);
    let Mn;
    if (flangeOnly) {
      Mn = Ts * (d - a / 2);
    } else {
      const Af = bf * hf;
      const Aw = bw * Math.max(0, a - hf);
      const denom = Af + Aw;
      const ybar = denom > 0 ? (Af * (hf / 2) + Aw * (hf + (a - hf) / 2)) / denom : a / 2;
      Mn = Ts * (d - ybar);
    }
    return { phiMn: phi * Mn, phi, Mn, a, c, et, As, flangeOnly };
  }

  function calcTBeamDesignLoads() {
    const Mu_kNm = num('tb-d-Mu', 400);
    const bw = num('tb-d-bw', 300);
    const d = num('tb-d-d', 550);
    const bf = num('tb-d-bf', 1200);
    const hf = num('tb-d-hf', 120);
    const Db = num('tb-d-Db', 25);
    const fc = num('tb-d-fc', 28);
    const fy = num('tb-d-fy', 420);
    if (!Mu_kNm || !bw || !d || !bf || !hf || !Db || !fc || !fy) return null;
    const Mu_Nmm = Mu_kNm * 1e6;
    const Ab = (Math.PI * Db * Db) / 4;
    const ety = fy / Es;
    const b1 = beta1(fc);
    const rhoMin = Math.max(1.4 / fy, (0.25 * Math.sqrt(fc)) / fy);
    const rhoBal = (0.85 * b1 * fc / fy) * (EC / (ety + EC));
    const rhoMax = 0.75 * rhoBal;
    const AsMin = rhoMin * bw * d;
    let Nb = Math.max(2, Math.ceil(AsMin / Ab));
    let best = null;
    for (let n = Nb; n <= 120; n++) {
      const cap = calcTBeamAnalysisWithNb(n, bf, bw, hf, d, fc, fy, Db);
      if (cap && cap.phiMn >= Mu_Nmm) {
        best = { Nb: n, ...cap, bf, bw, hf, d, fc, fy, Mu_kNm, Db, AsMin, rhoMin, rhoMax };
        break;
      }
    }
    if (!best) return { error: true, bf, bw, hf, d, Mu_kNm, Db };
    const rho = best.As / (bw * d);
    const safe = best.phiMn >= Mu_Nmm;
    return { ...best, rho, safe, rhoMin, rhoMax };
  }

  function renderTBeamDesign(r, out) {
    out = out || getEl('calculation-output');
    if (!out) return;
    if (r && r.error) {
      out.innerHTML = `<div class="calc-step verification-warn"><div class="calc-step-title">Design</div><p>Could not reach required capacity within 120 bars. Increase b<sub>w</sub>, h, b<sub>f</sub>, or f<sub>c</sub>′.</p></div>`;
      return;
    }
    if (!r) {
      out.innerHTML = '<div class="calc-step"><p>Enter valid inputs.</p></div>';
      return;
    }
    let html = '';
    const MnReq_Nmm = (r.Mu_kNm / 0.9) * 1e6;
    const Rn = MnReq_Nmm / (r.bf * r.d * r.d);
    const pTerm = 1 - (2 * Rn) / (0.85 * r.fc);
    const p = pTerm > 0 ? (0.85 * r.fc / r.fy) * (1 - Math.sqrt(pTerm)) : NaN;
    const AsFromP = isNaN(p) ? NaN : p * r.bf * r.d;
    const pmin = Math.max(1.4 / r.fy, (0.25 * Math.sqrt(r.fc)) / r.fy);
    const Ac = (r.As * r.fy) / (0.85 * r.fc);
    const Af = r.bf * r.hf;
    const ety = r.fy / Es;

    html += `<div class="calc-step"><div class="calc-step-title">T-beam — Design (using M<sub>u</sub> + geometry)</div><div class="calc-step-equation">M<sub>u</sub> = ${fmt(r.Mu_kNm)} kN·m; f<sub>c</sub>′ = ${fmt(r.fc)} MPa; f<sub>y</sub> = ${fmt(r.fy)} MPa; b<sub>f</sub> = ${fmt(r.bf)} mm; h<sub>f</sub> = ${fmt(r.hf)} mm; b<sub>w</sub> = ${fmt(r.bw)} mm; d = ${fmt(r.d)} mm; D<sub>b</sub> = ${fmt(r.Db)} mm</div></div>`;

    if (r.flangeOnly) {
      html += `<div class="calc-step"><div class="calc-step-title">False T beam</div><div class="calc-step-equation">a = ${fmt(r.a)} mm ≤ h<sub>f</sub> = ${fmt(r.hf)} mm</div></div>`;
      html += `<div class="calc-step"><div class="calc-step-title">1) Solve for M<sub>n</sub> and R<sub>n</sub> (assume φ = 0.9)</div><div class="calc-step-equation">M<sub>n</sub> = M<sub>u</sub>/0.9 = ${fmt(MnReq_Nmm / 1e6)} kN·m; R<sub>n</sub> = M<sub>n</sub>/(b<sub>f</sub>d²) = ${fmt(Rn, 4)}</div></div>`;
      html += `<div class="calc-step"><div class="calc-step-title">2) Solve for p</div><div class="calc-step-equation">p = (0.85f<sub>c</sub>′/f<sub>y</sub>)(1-√(1-2R<sub>n</sub>/(0.85f<sub>c</sub>′))) = ${fmt(p, 5)}</div></div>`;
      html += `<div class="calc-step"><div class="calc-step-title">3) Solve for a</div><div class="calc-step-equation">A<sub>s</sub> = p b<sub>f</sub>d = ${fmt(AsFromP)} mm²; a = A<sub>s</sub>f<sub>y</sub>/(0.85f<sub>c</sub>′b<sub>f</sub>) = ${fmt(r.a)} mm (false T beam because a &lt; h<sub>f</sub>)</div></div>`;
      html += `<div class="calc-step"><div class="calc-step-title">4) Solve no. of rebars</div><div class="calc-step-equation">p = A<sub>s</sub>/(b<sub>f</sub>d); A<sub>s</sub> = (π/4)D<sub>b</sub>²n → n = <span class="calc-step-result">${r.Nb}</span>, A<sub>s</sub> = ${fmt(r.As)} mm²</div></div>`;
      html += `<div class="calc-step"><div class="calc-step-title">5) Check steel ratio (p<sub>min</sub>, p)</div><div class="calc-step-equation">p<sub>min</sub> = ${fmt(pmin, 4)}; p = ${fmt(r.rho, 4)}; <span class="calc-step-result">${r.rho > pmin ? '✔ p > pmin SAFE' : '⚠ p ≤ pmin NOT SAFE'}</span></div></div>`;
      html += `<div class="calc-step"><div class="calc-step-title">6) Solve A<sub>c</sub> and flange area check</div><div class="calc-step-equation">A<sub>c</sub> = A<sub>s</sub>f<sub>y</sub>/(0.85f<sub>c</sub>′) = ${fmt(Ac)} mm²; A<sub>f</sub> = b<sub>f</sub>h<sub>f</sub> = ${fmt(Af)} mm²; ${Ac < Af ? '✔ A<sub>c</sub> < A<sub>f</sub> (false T beam)' : '⚠ A<sub>c</sub> ≥ A<sub>f</sub>'}</div></div>`;
      html += `<div class="calc-step"><div class="calc-step-title">7) Solve for a, c, ε<sub>t</sub> and reduction factor</div><div class="calc-step-equation">A<sub>c</sub> = a(b<sub>f</sub>); c = a/β<sub>1</sub> = ${fmt(r.c)} mm; ε<sub>t</sub> = ${(fmt(r.et, 4))}; φ = ${fmt(r.phi, 2)} (${r.et >= ety ? 'steel yields' : 'steel not yielding'})</div></div>`;
      html += `<div class="calc-step"><div class="calc-step-title">8) Solve for M<sub>u</sub> capacity (false T beam)</div><div class="calc-step-equation">M<sub>u,cap</sub> = φ(A<sub>s</sub>f<sub>y</sub>(d-a/2)) = <span class="calc-step-result">${fmt(r.phiMn / 1e6)} kN·m</span></div></div>`;
    } else {
      const Asf = 0.85 * r.fc * r.hf * (r.bf - r.bw) / r.fy;
      const Mnf = Asf * r.fy * (r.d - r.hf / 2);
      const MnReq = MnReq_Nmm;
      const Mnw = Math.max(0, MnReq - Mnf);
      const Rnw = Mnw / (r.bw * r.d * r.d);
      const pwTerm = 1 - (2 * Rnw) / (0.85 * r.fc);
      const pw = pwTerm > 0 ? (0.85 * r.fc / r.fy) * (1 - Math.sqrt(pwTerm)) : NaN;
      const Asw = isNaN(pw) ? NaN : pw * r.bw * r.d;
      const AsTotCalc = Asf + (isNaN(Asw) ? 0 : Asw);
      html += `<div class="calc-step"><div class="calc-step-title">True T beam</div><div class="calc-step-equation">a = ${fmt(r.a)} mm > h<sub>f</sub> = ${fmt(r.hf)} mm</div></div>`;
      html += `<div class="calc-step"><div class="calc-step-title">1) Solve for M<sub>n</sub> and R<sub>n</sub> (assume φ = 0.9)</div><div class="calc-step-equation">M<sub>n</sub> = M<sub>u</sub>/0.9 = ${fmt(MnReq / 1e6)} kN·m; R<sub>n</sub> = M<sub>n</sub>/(b<sub>f</sub>d²) = ${fmt(Rn, 4)}</div></div>`;
      html += `<div class="calc-step"><div class="calc-step-title">2) Solve for p</div><div class="calc-step-equation">p = (0.85f<sub>c</sub>′/f<sub>y</sub>)(1-√(1-2R<sub>n</sub>/(0.85f<sub>c</sub>′))) = ${fmt(p, 5)}</div></div>`;
      html += `<div class="calc-step"><div class="calc-step-title">3) Solve for a</div><div class="calc-step-equation">A<sub>s</sub> = p b<sub>f</sub>d = ${fmt(AsFromP)} mm²; a = A<sub>s</sub>f<sub>y</sub>/(0.85f<sub>c</sub>′b<sub>f</sub>) = ${fmt(r.a)} mm (true T beam because a > h<sub>f</sub>)</div></div>`;
      html += `<div class="calc-step"><div class="calc-step-title">4) Compute for Moment Capacity components</div><div class="calc-step-equation">A<sub>sf</sub> = 0.85f<sub>c</sub>′h<sub>f</sub>(b<sub>f</sub>-b<sub>w</sub>)/f<sub>y</sub> = ${fmt(Asf)} mm²; M<sub>nf</sub> = A<sub>sf</sub>f<sub>y</sub>(d-h<sub>f</sub>/2) = ${fmt(Mnf / 1e6)} kN·m</div></div>`;
      html += `<div class="calc-step"><div class="calc-step-title">5) Solve required moment in web</div><div class="calc-step-equation">M<sub>n</sub> = M<sub>nf</sub> + M<sub>nw</sub>; M<sub>nw</sub> = M<sub>n</sub> - M<sub>nf</sub> = ${fmt(Mnw / 1e6)} kN·m</div></div>`;
      html += `<div class="calc-step"><div class="calc-step-title">6) Compute no. of rebars</div><div class="calc-step-equation">R<sub>nw</sub> = M<sub>nw</sub>/(b<sub>w</sub>d²) = ${fmt(Rnw, 4)}; p<sub>w</sub> = (0.85f<sub>c</sub>′/f<sub>y</sub>)(1-√(1-2R<sub>nw</sub>/(0.85f<sub>c</sub>′))) = ${fmt(pw, 5)}</div><div class="calc-step-equation">A<sub>sw</sub> = p<sub>w</sub>b<sub>w</sub>d = ${fmt(Asw)} mm²; A<sub>s</sub> = A<sub>sw</sub>+A<sub>sf</sub> = ${fmt(AsTotCalc)} mm²; A<sub>s</sub> = (π/4)D<sub>b</sub>²n → n = <span class="calc-step-result">${r.Nb}</span></div></div>`;
      html += `<div class="calc-step"><div class="calc-step-title">7) Check steel ratio (p<sub>min</sub>, p)</div><div class="calc-step-equation">p<sub>min</sub> = ${fmt(pmin, 4)}; p = A<sub>s</sub>/(b<sub>w</sub>d) = ${fmt(r.rho, 4)}; <span class="calc-step-result">${r.rho > pmin ? '✔ p > pmin SAFE' : '⚠ p ≤ pmin NOT SAFE'}</span></div></div>`;
      html += `<div class="calc-step"><div class="calc-step-title">8) Solve A<sub>c</sub> and flange check</div><div class="calc-step-equation">A<sub>c</sub> = A<sub>s</sub>f<sub>y</sub>/(0.85f<sub>c</sub>′) = ${fmt(Ac)} mm²; A<sub>f</sub> = ${fmt(Af)} mm²; ${Ac > Af ? '✔ A<sub>c</sub> > A<sub>f</sub> (true T beam)' : '⚠ A<sub>c</sub> ≤ A<sub>f</sub>'}</div></div>`;
      html += `<div class="calc-step"><div class="calc-step-title">9) Solve for a, c, ε<sub>t</sub></div><div class="calc-step-equation">A<sub>c</sub> = 2(b<sub>f</sub>-b<sub>w</sub>)h<sub>f</sub> + b<sub>w</sub>a; c = a/β<sub>1</sub> = ${fmt(r.c)} mm; ε<sub>t</sub> = ${fmt(r.et, 4)}; φ = ${fmt(r.phi, 2)}</div></div>`;
      html += `<div class="calc-step"><div class="calc-step-title">10) Solve for M<sub>u</sub> capacity (true T beam)</div><div class="calc-step-equation">M<sub>u,cap</sub> = φ[0.85f<sub>c</sub>′·2(b<sub>f</sub>-b<sub>w</sub>)h<sub>f</sub>(d-h<sub>f</sub>/2) + 0.85f<sub>c</sub>′·A<sub>c,web</sub>(d-a/2)] = <span class="calc-step-result">${fmt(r.phiMn / 1e6)} kN·m</span></div></div>`;
    }
    const cls = r.safe ? 'verification-ok' : 'verification-warn';
    html += `<div class="calc-step ${cls}"><div class="calc-step-title">Safety</div><div class="calc-step-result">${r.safe ? '✔ SAFE' : '⚠ NOT SAFE'}</div></div>`;
    out.innerHTML = html;
  }

  // ==================== DOUBLY ====================
  function calcDoublyAnalysis() {
    const b = num('doubly-a-b', 300);
    const d = num('doubly-a-d', 450);
    const dp = num('doubly-a-dp', 60);
    const fc = num('doubly-a-fc', 28);
    const fy = num('doubly-a-fy', 420);
    if (!b || !d || !fc || !fy) return null;

    const tensMode = (getEl('doubly-a-tens-mode') || {}).value || 'bars';
    const compMode = (getEl('doubly-a-comp-mode') || {}).value || 'bars';

    const Nb = num('doubly-a-Nb', 5);
    const Db = num('doubly-a-Db', 20);
    const Nbc = num('doubly-a-Nbc', 2);
    const Dbc = num('doubly-a-Dbc', 16);

    const As = tensMode === 'area'
      ? num('doubly-a-As', 1571)
      : Nb * (Math.PI * Db * Db) / 4;
    const Asc = compMode === 'area'
      ? num('doubly-a-Asc', 402)
      : Nbc * (Math.PI * Dbc * Dbc) / 4;
    const b1 = beta1(fc);
    const ety = fy / Es;

    // Step 1: assume steel yields (fs' = fy)
    let fsPrime = fy;
    let a = (As * fy - Asc * fsPrime) / (0.85 * fc * b);
    if (a <= 0) a = (As * fy) / (0.85 * fc * b);
    let c = a / b1;
    let et = ((d - c) / c) * EC;
    let esp = c > dp ? (EC * (c - dp)) / c : 0;
    let etYield = et > 0.004;
    let espYield = esp > ety;
    let usedRecheck = false;

    // If es' does not yield -> recheck equilibrium with fs' = Es*es'
    if (!espYield) {
      usedRecheck = true;
      // (0.85 fc' β1 c b) + As' * Es * 0.003(c-d')/c = As fy
      // => 0.85fc'β1b c^2 + As'Es0.003(c-d') - Asfy c = 0
      const Aq = 0.85 * fc * b1 * b;
      const Bq = Asc * Es * 0.003 - As * fy;
      const Cq = -Asc * Es * 0.003 * dp;
      const disc = Bq * Bq - 4 * Aq * Cq;
      if (disc >= 0) {
        c = (-Bq + Math.sqrt(disc)) / (2 * Aq);
        if (c <= 0) c = (-Bq - Math.sqrt(disc)) / (2 * Aq);
      }
      a = b1 * c;
      et = ((d - c) / c) * EC;
      esp = c > dp ? (EC * (c - dp)) / c : 0;
      fsPrime = Es * esp;
      etYield = et > 0.004;
      espYield = esp > ety;
    }

    const Cc = 0.85 * fc * b * a;
    const Cs = Asc * fsPrime;
    const T = As * fy;
    const Mn = Cc * (d - a / 2) + Cs * (d - dp);
    const phi = phiFromStrain(et, ety);
    const phiMn = phi * Mn;
    const Mu_kNm = phiMn / 1e6; // capacity output
    return {
      b, d, dp, fc, fy, As, Asc, b1, a, c, fsPrime, esp, et, ety,
      etYield, espYield, usedRecheck, Cc, Cs, T, Mn, phi, phiMn, Mu_kNm,
      Nb, Db, Nbc, Dbc, tensMode, compMode
    };
  }

  function renderDoublyAnalysis(r, out) {
    out = out || getEl('calculation-output');
    if (!out) return;
    if (!r) {
      out.innerHTML = '<div class="calc-step"><p>Enter valid inputs.</p></div>';
      return;
    }
    const phiMnKnm = r.phiMn / 1e6;
    let html = '';
    html += `<div class="calc-step"><div class="calc-step-title">Doubly reinforced — Analysis</div><div class="calc-step-equation">A<sub>s</sub> = ${fmt(r.As)} mm² (${r.tensMode === 'bars' ? `${r.Nb} bars @ ${fmt(r.Db)} mm` : 'direct input'}), A<sub>s</sub>′ = ${fmt(r.Asc)} mm² (${r.compMode === 'bars' ? `${r.Nbc} bars @ ${fmt(r.Dbc)} mm` : 'direct input'})</div></div>`;
    html += `<div class="calc-step"><div class="calc-step-title">1) Assume steel yields (f<sub>s</sub>′ = f<sub>s</sub> = f<sub>y</sub>)</div><div class="calc-step-equation">Assume f<sub>s</sub>′ = ${fmt(r.fy)} MPa</div></div>`;
    html += `<div class="calc-step"><div class="calc-step-title">2) Solve equilibrium</div><div class="calc-step-equation">0.85f<sub>c</sub>′ab + A<sub>s</sub>′f<sub>s</sub>′ = A<sub>s</sub>f<sub>y</sub> → a = ${fmt(r.a)} mm</div><div class="calc-step-equation">c = a/β<sub>1</sub> = ${fmt(r.c)} mm</div></div>`;
    html += `<div class="calc-step"><div class="calc-step-title">3) Compute steel strains</div><div class="calc-step-equation">ε<sub>t</sub> = 0.003(d-c)/c = ${fmt(r.et, 4)}</div><div class="calc-step-equation">ε<sub>s</sub>′ = 0.003(c-d′)/c = ${fmt(r.esp, 4)}</div></div>`;
    html += `<div class="calc-step"><div class="calc-step-title">4) Check compression and tension yield</div><div class="calc-step-equation">For ε<sub>t</sub>: ε<sub>t</sub> > 0.004 ? ${r.etYield ? '✔ yes (steel yields)' : '⚠ no (does not yield)'}</div><div class="calc-step-equation">For ε<sub>s</sub>′: ε<sub>s</sub>′ > f<sub>y</sub>/E<sub>s</sub> (${fmt(r.ety, 4)}) ? ${r.espYield ? '✔ yes (steel yields)' : '⚠ no (does not yield)'}</div></div>`;
    if (r.usedRecheck) {
      html += `<div class="calc-step verification-warn"><div class="calc-step-title">5) Since ε<sub>s</sub>′ does not yield: recheck equilibrium</div><div class="calc-step-equation">(0.85f<sub>c</sub>′β<sub>1</sub>cb) + A<sub>s</sub>′(0.003E<sub>s</sub>(c-d′)/c) = A<sub>s</sub>f<sub>y</sub>; a = β<sub>1</sub>c</div><div class="calc-step-equation">Updated: c = ${fmt(r.c)} mm, a = ${fmt(r.a)} mm, f<sub>s</sub>′ = 0.003E<sub>s</sub>(c-d′)/c = ${fmt(r.fsPrime)} MPa</div></div>`;
    } else {
      html += `<div class="calc-step"><div class="calc-step-title">5) Both steel yield; proceed</div><div class="calc-step-equation">Use f<sub>s</sub>′ = f<sub>y</sub></div></div>`;
    }
    html += `<div class="calc-step"><div class="calc-step-title">6) Compute reduction factor and M<sub>u</sub> capacity</div><div class="calc-step-equation">φ from strain = ${fmt(r.phi, 2)}</div><div class="calc-step-equation">M<sub>u,cap</sub> = φ(0.85f<sub>c</sub>′ab(d-a/2)+A<sub>s</sub>′f<sub>s</sub>′(d-d′)) = <span class="calc-step-result">${fmt(phiMnKnm)} kN·m</span></div></div>`;
    html += `<div class="calc-step verification-ok"><div class="calc-step-title">Final</div><div class="calc-step-result">M<sub>u</sub> (capacity) = ${fmt(r.Mu_kNm)} kN·m</div></div>`;
    out.innerHTML = html;
  }

  function calcDoublyDesignLoads() {
    const b = num('doubly-d-b', 300);
    const d = num('doubly-d-d', 450);
    const dp = num('doubly-d-dp', 60);
    const fc = num('doubly-d-fc', 28);
    const fy = num('doubly-d-fy', 420);
    const Mu_kNm = num('doubly-d-Mu', 220);
    const Db = num('doubly-d-Db', 20);
    if (!b || !d || !fc || !fy || !Mu_kNm) return null;
    if (!Db || d <= dp) return null;

    const Mu_Nmm = Mu_kNm * 1e6;
    const b1 = beta1(fc);
    const ety = fy / Es;
    const phiAssumed = 0.9;
    const Mn_req = Mu_Nmm / phiAssumed;

    const rhoMax = (3 / 7) * b1 * ((0.85 * fc) / fy);
    const Asmax = rhoMax * b * d;
    const Mn1 = b * d * d * rhoMax * fy * (1 - (rhoMax * fy) / (1.7 * fc));

    let Mn2 = Mn_req - Mn1;
    let singlyBranch = false;
    let rhoReq = null;
    let AscReq = 0;
    let AsReqCont = 0;

    if (Mn2 <= 0) {
      singlyBranch = true;
      const Rn = Mn_req / (b * d * d);
      const rad = 1 - (2 * Rn) / (0.85 * fc);
      if (rad < 0) return null;
      rhoReq = (0.85 * fc / fy) * (1 - Math.sqrt(rad));
      AsReqCont = rhoReq * b * d;
      AscReq = 0;
      Mn2 = Mn_req - Mn1;
    } else {
      AscReq = Mn2 / (fy * (d - dp));
      AsReqCont = Asmax + AscReq;
    }

    const Ab = (Math.PI * Db * Db) / 4;
    const Nbc = singlyBranch ? 0 : Math.max(1, Math.ceil(AscReq / Ab));
    const Asc = Nbc * Ab;
    const Nb = Math.max(1, Math.ceil(AsReqCont / Ab));
    const As = Nb * Ab;

    let fsPrime = fy;
    let a = (As * fy - Asc * fsPrime) / (0.85 * fc * b);
    if (a <= 0) a = (As * fy) / (0.85 * fc * b);
    let c = a / b1;
    let et = ((d - c) / c) * EC;
    let esp = c > dp ? (EC * (c - dp)) / c : 0;
    let etYield = et > 0.004;
    let espYield = Asc < 1e-3 ? true : esp > ety;
    let usedRecheck = false;

    if (Asc >= 1e-3 && !espYield) {
      usedRecheck = true;
      const Aq = 0.85 * fc * b1 * b;
      const Bq = Asc * Es * 0.003 - As * fy;
      const Cq = -Asc * Es * 0.003 * dp;
      const disc = Bq * Bq - 4 * Aq * Cq;
      if (disc >= 0) {
        c = (-Bq + Math.sqrt(disc)) / (2 * Aq);
        if (c <= 0) c = (-Bq - Math.sqrt(disc)) / (2 * Aq);
      }
      a = b1 * c;
      et = ((d - c) / c) * EC;
      esp = c > dp ? (EC * (c - dp)) / c : 0;
      fsPrime = Es * esp;
      etYield = et > 0.004;
      espYield = esp > ety;
    }

    const Mn = 0.85 * fc * b * a * (d - a / 2) + Asc * fsPrime * (d - dp);
    const phi = phiFromStrain(et, ety);
    const phiMn = phi * Mn;
    const safe = phiMn >= Mu_Nmm;

    return {
      b, d, dp, fc, fy, Mu_kNm, Mu_Nmm,
      phiAssumed, Mn_req, rhoMax, Asmax, Mn1, Mn2, singlyBranch, rhoReq,
      AscReq, AsReqCont, As, Asc, Nb, Db, Nbc, Ab,
      b1, a, c, et, esp, fsPrime, etYield, espYield, usedRecheck, ety,
      phi, Mn, phiMn, safe,
      doublyRequired: !singlyBranch
    };
  }

  function renderDoublyDesign(r, out) {
    out = out || getEl('calculation-output');
    if (!out) return;
    if (!r) {
      out.innerHTML = '<div class="calc-step"><p>Enter valid inputs.</p></div>';
      return;
    }
    const MnKnm = r.Mn_req / 1e6;
    let html = '';
    html += `<div class="calc-step"><div class="calc-step-title">Doubly reinforced — Design (using M<sub>u</sub>)</div><div class="calc-step-equation">M<sub>u,req</sub> = ${fmt(r.Mu_kNm)} kN·m; b = ${fmt(r.b)} mm; d = ${fmt(r.d)} mm; d′ = ${fmt(r.dp)} mm; f<sub>c</sub>′ = ${fmt(r.fc)} MPa; f<sub>y</sub> = ${fmt(r.fy)} MPa; D<sub>b</sub> = ${fmt(r.Db)} mm; β<sub>1</sub> = ${fmt(r.b1, 3)}</div></div>`;

    html += `<div class="calc-step"><div class="calc-step-title">Assume reduction factor φ = ${fmt(r.phiAssumed, 1)}</div><div class="calc-step-equation">M<sub>n</sub> = M<sub>u</sub>/φ = ${fmt(MnKnm)} kN·m (${fmt(r.Mn_req)} N·mm)</div></div>`;

    html += `<div class="calc-step"><div class="calc-step-title">Solve for M<sub>n1</sub> (max nominal moment, singly reinforced at ρ<sub>max</sub>)</div>`;
    html += `<div class="calc-step-equation">ρ<sub>max</sub> = (3/7)β<sub>1</sub>(0.85f<sub>c</sub>′/f<sub>y</sub>) = ${fmt(r.rhoMax, 5)}</div>`;
    html += `<div class="calc-step-equation">A<sub>s,max</sub> = ρ<sub>max</sub>bd = ${fmt(r.Asmax)} mm²</div>`;
    html += `<div class="calc-step-equation">M<sub>n1</sub> = bd²ρ<sub>max</sub>f<sub>y</sub>(1 − ρ<sub>max</sub>f<sub>y</sub>/(1.7f<sub>c</sub>′)) = ${fmt(r.Mn1 / 1e6)} kN·m</div></div>`;

    html += `<div class="calc-step"><div class="calc-step-title">Solve for M<sub>n2</sub></div><div class="calc-step-equation">M<sub>n2</sub> = M<sub>n</sub> − M<sub>n1</sub> = ${fmt(r.Mn2 / 1e6)} kN·m</div></div>`;

    if (r.singlyBranch) {
      html += `<div class="calc-step verification-warn"><div class="calc-step-title">M<sub>n</sub> ≤ M<sub>n1</sub> — singly reinforced suffices</div>`;
      html += `<div class="calc-step-equation">R<sub>n</sub> = M<sub>n</sub>/(bd²) = ${fmt(r.Mn_req / (r.b * r.d * r.d), 4)}; ρ = (0.85f<sub>c</sub>′/f<sub>y</sub>)(1 − √(1 − 2R<sub>n</sub>/(0.85f<sub>c</sub>′))) = ${fmt(r.rhoReq, 5)}</div>`;
      html += `<div class="calc-step-equation">A<sub>s,req</sub> = ρbd = ${fmt(r.AsReqCont)} mm²; A<sub>s</sub>′ = 0</div></div>`;
    } else {
      html += `<div class="calc-step"><div class="calc-step-title">Solve for A<sub>s</sub> (couple + tension at ρ<sub>max</sub>)</div>`;
      html += `<div class="calc-step-equation">M<sub>n2</sub> = A<sub>s</sub>′f<sub>y</sub>(d − d′) → A<sub>s</sub>′ = M<sub>n2</sub>/(f<sub>y</sub>(d − d′)) = ${fmt(r.AscReq)} mm²</div>`;
      html += `<div class="calc-step-equation">A<sub>s</sub> = A<sub>s,max</sub> + A<sub>s</sub>′ = ${fmt(r.AsReqCont)} mm²</div></div>`;
    }

    html += `<div class="calc-step"><div class="calc-step-title">Solve for no. of rebars</div>`;
    html += `<div class="calc-step-equation">A<sub>bar</sub> = (π/4)D<sub>b</sub>² = ${fmt(r.Ab)} mm²</div>`;
    html += `<div class="calc-step-equation">A<sub>s</sub> = (π/4)D<sub>b</sub>²n → n<sub>tension</sub> = ${r.Nb}, A<sub>s</sub> = ${fmt(r.As)} mm²</div>`;
    html += `<div class="calc-step-equation">A<sub>s</sub>′ = (π/4)D<sub>b</sub>²n′ → n<sub>comp</sub> = ${r.Nbc}, A<sub>s</sub>′ = ${fmt(r.Asc)} mm²</div></div>`;

    html += `<div class="calc-step"><div class="calc-step-title">Assume steel yields (f<sub>s</sub>′ = f<sub>s</sub> = f<sub>y</sub>)</div><div class="calc-step-equation">Initial assumption: f<sub>s</sub>′ = f<sub>y</sub> for equilibrium</div></div>`;

    html += `<div class="calc-step"><div class="calc-step-title">Solve equilibrium</div>`;
    html += `<div class="calc-step-equation">0.85f<sub>c</sub>′ab + A<sub>s</sub>′f<sub>s</sub>′ = A<sub>s</sub>f<sub>y</sub> → a = ${fmt(r.a)} mm</div>`;
    html += `<div class="calc-step-equation">c = a/β<sub>1</sub> = ${fmt(r.c)} mm</div></div>`;

    html += `<div class="calc-step"><div class="calc-step-title">Compute steel strain</div>`;
    html += `<div class="calc-step-equation">ε<sub>t</sub> = 0.003(d − c)/c = ${fmt(r.et, 4)}</div>`;
    html += `<div class="calc-step-equation">ε<sub>s</sub>′ = 0.003(c − d′)/c = ${fmt(r.esp, 4)}</div></div>`;

    html += `<div class="calc-step"><div class="calc-step-title">Check compression and tension yield</div>`;
    html += `<div class="calc-step-equation">ε<sub>t</sub> &gt; 0.004 ? ${r.etYield ? '✔ yes (steel yields)' : '⚠ no (does not yield)'}</div>`;
    html += `<div class="calc-step-equation">ε<sub>s</sub>′ &gt; f<sub>y</sub>/E<sub>s</sub> (${fmt(r.ety, 4)}) ? ${r.espYield ? '✔ yes (steel yields)' : '⚠ no (does not yield)'}</div></div>`;

    if (r.usedRecheck) {
      html += `<div class="calc-step verification-warn"><div class="calc-step-title">ε<sub>s</sub>′ does not yield — recheck equilibrium</div>`;
      html += `<div class="calc-step-equation">(0.85f<sub>c</sub>′β<sub>1</sub>cb) + A<sub>s</sub>′(0.003E<sub>s</sub>(c − d′)/c) = A<sub>s</sub>f<sub>y</sub>; a = β<sub>1</sub>c</div>`;
      html += `<div class="calc-step-equation">Updated: c = ${fmt(r.c)} mm, a = ${fmt(r.a)} mm, f<sub>s</sub>′ = E<sub>s</sub>ε<sub>s</sub>′ = ${fmt(r.fsPrime)} MPa</div></div>`;

      html += `<div class="calc-step"><div class="calc-step-title">Compute steel strain (after recheck)</div>`;
      html += `<div class="calc-step-equation">ε<sub>t</sub> = 0.003(d − c)/c = ${fmt(r.et, 4)}</div>`;
      html += `<div class="calc-step-equation">ε<sub>s</sub>′ = 0.003(c − d′)/c = ${fmt(r.esp, 4)}</div></div>`;

      html += `<div class="calc-step"><div class="calc-step-title">Check compression and tension yield (after recheck)</div>`;
      html += `<div class="calc-step-equation">ε<sub>t</sub> &gt; 0.004 ? ${r.etYield ? '✔ yes (steel yields)' : '⚠ no (does not yield)'}</div>`;
      html += `<div class="calc-step-equation">ε<sub>s</sub>′ &gt; f<sub>y</sub>/E<sub>s</sub> ? ${r.espYield ? '✔ yes (steel yields)' : '⚠ no (does not yield)'}</div></div>`;
    } else {
      html += `<div class="calc-step"><div class="calc-step-title">Both steels yield (initial assumption OK)</div><div class="calc-step-equation">Use f<sub>s</sub>′ = f<sub>y</sub> in moment expression</div></div>`;
    }

    html += `<div class="calc-step"><div class="calc-step-title">Reduction factor and design moment capacity</div>`;
    html += `<div class="calc-step-equation">φ from ε<sub>t</sub> (NSCP strain limits) = ${fmt(r.phi, 2)}</div>`;
    html += `<div class="calc-step-equation">M<sub>u,cap</sub> = φ(0.85f<sub>c</sub>′ab(d − a/2) + A<sub>s</sub>′f<sub>s</sub>′(d − d′)) = <span class="calc-step-result">${fmt(r.phiMn / 1e6)} kN·m</span> (f<sub>s</sub>′ as computed)</div></div>`;

    const cls = r.safe ? 'verification-ok' : 'verification-warn';
    html += `<div class="calc-step ${cls}"><div class="calc-step-title">M<sub>u</sub> capacity vs M<sub>u</sub> demand</div><div class="calc-step-result">${r.safe ? '✔ M<sub>u,cap</sub> ≥ M<sub>u,req</sub> (SAFE)' : '⚠ M<sub>u,cap</sub> &lt; M<sub>u,req</sub> (NOT SAFE)'}</div><div class="calc-step-equation">M<sub>u,req</sub> = ${fmt(r.Mu_kNm)} kN·m; M<sub>u,cap</sub> = ${fmt(r.phiMn / 1e6)} kN·m</div></div>`;
    out.innerHTML = html;
  }

  // ---------- Run / result-only ----------
  function runActiveCalculation() {
    const out = getEl('calculation-output');
    if (!out) return;
    refreshPanels();
    const stepMode = getEl('toggle-step-mode') && getEl('toggle-step-mode').checked;
    const key = getContextKey();
    if (!stepMode) {
      renderResultOnlyKey(key, out);
      return;
    }
    switch (key) {
      case 'rect-analysis':
        renderRectangularAnalysis(calcRectangularAnalysis(), out);
        break;
      case 'rect-design':
        renderRectangularDesign(calcRectangularDesignLoads(), out);
        break;
      case 'tbeam-analysis':
        renderTBeamAnalysis(calcTBeamAnalysis(), out);
        break;
      case 'tbeam-design':
        renderTBeamDesign(calcTBeamDesignLoads(), out);
        break;
      case 'doubly-analysis':
        renderDoublyAnalysis(calcDoublyAnalysis(), out);
        break;
      case 'doubly-design':
        renderDoublyDesign(calcDoublyDesignLoads(), out);
        break;
      default:
        out.innerHTML = '<div class="calc-step"><p>Select options.</p></div>';
    }
    highlightResults(out);
  }

  function renderResultOnlyKey(key, out) {
    let r;
    let html = '';
    switch (key) {
      case 'rect-analysis':
        r = calcRectangularAnalysis();
        if (!r) { out.innerHTML = '<p>Enter valid inputs.</p>'; return; }
        html = `<div class="calc-step"><div class="calc-step-result">M<sub>u</sub> = ${fmt(r.Mu_kNm)} kN·m, φM<sub>n</sub> = ${fmt(r.phiMn / 1e6)} kN·m, ρ = ${fmt(r.rho, 4)}</div></div>`;
        break;
      case 'rect-design':
        r = calcRectangularDesignLoads();
        if (!r) { out.innerHTML = '<p>Enter valid inputs.</p>'; return; }
        html = `<div class="calc-step"><div class="calc-step-result">b×h×d = ${fmt(r.b)}×${fmt(r.h)}×${fmt(r.d)} mm, n<sub>b</sub> = ${r.nb}, φM<sub>n</sub> = ${fmt(r.phiMn / 1e6)} kN·m, ${r.safe ? 'SAFE' : 'NOT SAFE'}</div></div>`;
        break;
      case 'tbeam-analysis':
        r = calcTBeamAnalysis();
        if (!r) { out.innerHTML = '<p>Enter valid inputs.</p>'; return; }
        html = `<div class="calc-step"><div class="calc-step-result">φM<sub>n</sub> = ${fmt(r.phiMn / 1e6)} kN·m, ${r.safe ? 'SAFE' : 'NOT SAFE'}</div></div>`;
        break;
      case 'tbeam-design':
        r = calcTBeamDesignLoads();
        if (!r || r.error) { out.innerHTML = '<p>Adjust inputs.</p>'; return; }
        html = `<div class="calc-step"><div class="calc-step-result">N<sub>b</sub> = ${r.Nb}, φM<sub>n</sub> = ${fmt(r.phiMn / 1e6)} kN·m, ${r.safe ? 'SAFE' : 'NOT SAFE'}</div></div>`;
        break;
      case 'doubly-analysis':
        r = calcDoublyAnalysis();
        if (!r) { out.innerHTML = '<p>Enter valid inputs.</p>'; return; }
        html = `<div class="calc-step"><div class="calc-step-result">φM<sub>n</sub> = ${fmt(r.phiMn / 1e6)} kN·m, M<sub>u</sub> capacity = ${fmt(r.Mu_kNm)} kN·m</div></div>`;
        break;
      case 'doubly-design':
        r = calcDoublyDesignLoads();
        if (!r) { out.innerHTML = '<p>Enter valid inputs.</p>'; return; }
        html = `<div class="calc-step"><div class="calc-step-result">M<sub>u</sub> = ${fmt(r.Mu_kNm)} kN·m, ${r.doublyRequired ? 'A<sub>sc</sub> req.' : 'Singly OK'}, ${r.safe ? 'SAFE' : 'NOT SAFE'}</div></div>`;
        break;
      default:
        html = '<p>—</p>';
    }
    out.innerHTML = html;
    highlightResults(out);
  }

  function highlightResults(container) {
    if (!container) return;
    container.querySelectorAll('.calc-step-result').forEach(el => {
      el.classList.add('result-highlight');
      setTimeout(() => el.classList.remove('result-highlight'), 800);
    });
  }

  // ---------- Beam visualization ----------
  function updateBeamViz() {
    const svg = getEl('beam-dynamic-svg');
    const rect = getEl('beam-rect');
    const tShape = getEl('beam-t-shape');
    const tensionG = getEl('beam-tension-bars');
    const compG = getEl('beam-compression-bars');
    const compBlock = getEl('beam-comp-block');
    const caption = getEl('beam-viz-caption');
    if (!svg || !rect || !tensionG) return;

    if (tShape) tShape.innerHTML = '';
    compG.innerHTML = '';

    let b = 300, h = 500, d = 450, Nb = 4, Db = 20, Nbc = 0, a = 0;
    const main = getMain();

    if (main === 'singly' && getSinglyType() === 'tbeam') {
      let bf; let bw; let hf; let r;
      if (getTBeamMode() === 'analysis') {
        bf = num('tb-a-bf', 1200);
        bw = num('tb-a-bw', 300);
        hf = num('tb-a-hf', 120);
        d = num('tb-a-d', 550);
        Nb = num('tb-a-Nb', 6);
        Db = num('tb-a-Db', 25);
        r = calcTBeamAnalysis();
      } else {
        const des = calcTBeamDesignLoads();
        bf = num('tb-d-bf', 1200);
        hf = num('tb-d-hf', 120);
        Db = parseInt((getEl('tb-d-Db') || {}).value || 25, 10);
        if (des && !des.error) {
          bw = des.bw;
          d = des.d;
          Nb = des.Nb;
          r = calcTBeamAnalysisWithNb(Nb, bf, bw, hf, d, num('tb-d-fc', 28), num('tb-d-fy', 420), Db);
        } else {
          bw = 300;
          d = 500;
          Nb = 4;
          r = null;
        }
      }
      a = r ? r.a : 0;
      const scale = 180 / Math.max(bf, 400);
      const wWeb = Math.max(40, bw * scale);
      const wFl = Math.min(200, bf * scale);
      const stemH = 200;
      const flangeH = Math.min(60, hf * scale * 2);
      rect.setAttribute('width', wWeb);
      rect.setAttribute('height', stemH);
      rect.setAttribute('x', 40 + (200 - wWeb) / 2);
      rect.setAttribute('y', 40 + flangeH);
      if (tShape) {
        const fr = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        fr.setAttribute('x', 40 + (200 - wFl) / 2);
        fr.setAttribute('y', 40);
        fr.setAttribute('width', wFl);
        fr.setAttribute('height', flangeH);
        fr.setAttribute('fill', 'url(#vgConcrete)');
        fr.setAttribute('stroke', 'currentColor');
        tShape.appendChild(fr);
      }
      h = stemH + flangeH;
      b = bw;
      if (caption) caption.textContent = `T-beam: bf ≈ ${bf} mm, web ${bw} mm.`;
    } else if (main === 'singly' && getSinglyType() === 'rect') {
      if (getRectMode() === 'analysis') {
        b = num('usd-a-b', 300);
        h = num('usd-a-h', 500);
        d = num('usd-a-d', 450);
        Nb = num('usd-a-Nb', 4);
        Db = num('usd-a-Db', 20);
        const r = calcRectangularAnalysis();
        a = r ? r.a : 0;
      } else {
        const r = calcRectangularDesignLoads();
        if (r) { b = r.b; h = r.h; d = r.d; Nb = r.nb; Db = r.Db; a = r.a; }
      }
      const hScaled = Math.min(240 * (h / 500), 240);
      const w = Math.min(200 * (b / 300), 200);
      rect.setAttribute('width', w);
      rect.setAttribute('height', hScaled);
      rect.setAttribute('x', 40);
      rect.setAttribute('y', 40 + (240 - hScaled));
      if (caption) caption.textContent = `Rectangular: b = ${b} mm, h = ${h} mm.`;
    } else {
      if (getDoublyMode() === 'analysis') {
        b = num('doubly-a-b', 300);
        h = 500;
        d = num('doubly-a-d', 450);
        const r = calcDoublyAnalysis();
        if (r) {
          a = r.a;
          Nb = r.tensMode === 'bars' ? r.Nb : Math.max(2, Math.ceil(r.As / (Math.PI * 20 * 20 / 4)));
          Db = r.tensMode === 'bars' ? r.Db : 20;
          Nbc = r.compMode === 'bars' ? r.Nbc : Math.max(0, Math.ceil(r.Asc / (Math.PI * 16 * 16 / 4)));
        } else {
          a = 0;
          Nb = 4;
          Db = 20;
          Nbc = 0;
        }
      } else {
        b = num('doubly-d-b', 300);
        d = num('doubly-d-d', 450);
        const dpV = num('doubly-d-dp', 60);
        h = d + dpV + 80;
        Db = num('doubly-d-Db', 20);
        const r = calcDoublyDesignLoads();
        if (r && !r.error) {
          Nb = r.Nb;
          Nbc = r.singlyBranch ? 0 : r.Nbc;
          a = r.a || 0;
        } else {
          Nb = 4;
          Nbc = 0;
          a = 0;
        }
      }
      const hScaled = Math.min(240 * (h / 500), 240);
      const w = Math.min(200 * (b / 300), 200);
      rect.setAttribute('width', w);
      rect.setAttribute('height', hScaled);
      rect.setAttribute('x', 40);
      rect.setAttribute('y', 40 + (240 - hScaled));
      if (caption) caption.textContent = 'Doubly reinforced (rectangular).';
    }

    const w = parseFloat(rect.getAttribute('width')) || 200;
    const hScaled = parseFloat(rect.getAttribute('height')) || 240;
    const x0 = parseFloat(rect.getAttribute('x')) || 40;
    const yBottom = parseFloat(rect.getAttribute('y')) + hScaled;
    const barR = Math.min(8, (w / (Nb + 1)) * 0.35);
    tensionG.innerHTML = '';
    for (let i = 0; i < Nb; i++) {
      const cx = x0 + (w * (i + 1)) / (Nb + 1);
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', cx);
      circle.setAttribute('cy', yBottom - barR - 4);
      circle.setAttribute('r', barR);
      circle.setAttribute('fill', 'url(#vgSteel)');
      circle.setAttribute('stroke', 'currentColor');
      tensionG.appendChild(circle);
    }
    if (Nbc > 0 && main === 'doubly') {
      const yTop = parseFloat(rect.getAttribute('y')) + 12;
      for (let i = 0; i < Nbc; i++) {
        const cx = x0 + (w * (i + 1)) / (Nbc + 1);
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', cx);
        circle.setAttribute('cy', yTop);
        circle.setAttribute('r', barR * 0.9);
        circle.setAttribute('fill', 'url(#vgComp)');
        compG.appendChild(circle);
      }
    }
    if (compBlock && h > 0) {
      if (a > 0) {
        const ah = (a / h) * hScaled;
        const topY = parseFloat(rect.getAttribute('y'));
        compBlock.setAttribute('x', x0);
        compBlock.setAttribute('y', topY);
        compBlock.setAttribute('width', w);
        compBlock.setAttribute('height', Math.max(4, ah));
        compBlock.removeAttribute('display');
      } else {
        compBlock.setAttribute('height', '0');
        compBlock.setAttribute('display', 'none');
      }
    }
  }

  // ---------- Init ----------
  function initMainTabs() {
    document.querySelectorAll('.main-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.main-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        runActiveCalculation();
        updateBeamViz();
      });
    });
  }

  function initSubTabs() {
    document.querySelectorAll('.sub-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.sub-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        runActiveCalculation();
        updateBeamViz();
      });
    });
  }

  function initModeRadios() {
    document.querySelectorAll('input[name="rect-mode"], input[name="tbeam-mode"], input[name="doubly-mode"]').forEach(r => {
      r.addEventListener('change', () => {
        refreshPanels();
        runActiveCalculation();
        updateBeamViz();
      });
    });

    const compMode = getEl('doubly-a-comp-mode');
    const tensMode = getEl('doubly-a-tens-mode');
    function syncDoublyModeFields() {
      const compBars = getEl('doubly-a-comp-bars-wrap');
      const compDb = getEl('doubly-a-comp-db-wrap');
      const compArea = getEl('doubly-a-comp-area-wrap');
      const tensBars = getEl('doubly-a-tens-bars-wrap');
      const tensDb = getEl('doubly-a-tens-db-wrap');
      const tensArea = getEl('doubly-a-tens-area-wrap');

      const compIsArea = compMode && compMode.value === 'area';
      const tensIsArea = tensMode && tensMode.value === 'area';

      if (compBars) compBars.classList.toggle('hidden', compIsArea);
      if (compDb) compDb.classList.toggle('hidden', compIsArea);
      if (compArea) compArea.classList.toggle('hidden', !compIsArea);
      if (tensBars) tensBars.classList.toggle('hidden', tensIsArea);
      if (tensDb) tensDb.classList.toggle('hidden', tensIsArea);
      if (tensArea) tensArea.classList.toggle('hidden', !tensIsArea);

    }
    if (compMode) compMode.addEventListener('change', () => { syncDoublyModeFields(); runActiveCalculation(); updateBeamViz(); });
    if (tensMode) tensMode.addEventListener('change', () => { syncDoublyModeFields(); runActiveCalculation(); updateBeamViz(); });
    syncDoublyModeFields();
  }

  function initStepDark() {
    const chk = getEl('toggle-step-mode');
    if (chk) chk.addEventListener('change', runActiveCalculation);
    const dark = getEl('toggle-dark');
    if (dark) {
      try {
        if (localStorage.getItem('rcd-dark') === 'true') {
          dark.checked = true;
          document.documentElement.setAttribute('data-theme', 'dark');
        }
      } catch (e) {}
      dark.addEventListener('change', () => {
        document.documentElement.setAttribute('data-theme', dark.checked ? 'dark' : '');
        try { localStorage.setItem('rcd-dark', dark.checked); } catch (e2) {}
      });
    }
  }

  function initNavLinks() {
    document.querySelectorAll('.nav-link[data-main]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        getEl('calculator').scrollIntoView({ behavior: 'smooth' });
        const m = link.dataset.main;
        const btn = document.querySelector('.main-tab[data-main="' + m + '"]');
        if (btn) btn.click();
      });
    });
  }

  function initDelegatedInputs() {
    const root = getEl('calculator');
    if (!root) return;
    root.addEventListener('input', () => {
      runActiveCalculation();
      updateBeamViz();
    });
    root.addEventListener('change', () => {
      runActiveCalculation();
      updateBeamViz();
    });
  }

  function init() {
    initMainTabs();
    initSubTabs();
    initModeRadios();
    initStepDark();
    initNavLinks();
    initDelegatedInputs();
    refreshPanels();
    runActiveCalculation();
    updateBeamViz();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
