/**
 * RCD Calculator — NSCP 2015
 * Working Stress Design (WSD) & Ultimate Strength Design (USD)
 * Singly and Doubly Reinforced Rectangular Beams
 */

(function () {
  'use strict';

  const Es = 200000; // MPa
  const EC = 0.003;  // concrete strain limit
  const ET_TENSION_CONTROLLED = 0.005;

  // ---------- Helpers ----------
  function getEl(id) { return document.getElementById(id); }
  function num(id, def = 0) { const v = getEl(id); return v ? (parseFloat(v.value) || def) : def; }
  function fmt(n, d = 2) {
    if (n === undefined || n === null || isNaN(n)) return '—';
    return Number(n).toLocaleString('en', { minimumFractionDigits: d, maximumFractionDigits: d });
  }

  /**
   * β1 (NSCP 2015): 0.85 for fc' ≤ 28 MPa; reduce 0.05 per 7 MPa above 28; min 0.65
   */
  function beta1(fc) {
    if (fc <= 28) return 0.85;
    return Math.max(0.65, 0.85 - (0.05 * (fc - 28)) / 7);
  }

  // ==================== A. UNCRACKED SECTION ====================
  function calcUncracked() {
    const b = num('uncracked-b', 300);
    const h = num('uncracked-h', 500);
    const fc = num('uncracked-fc', 28);
    const lambda = num('uncracked-lambda', 1);
    const M_kNm = num('uncracked-M', 20);
    if (!b || !h || !fc) return null;

    const fr = 0.62 * lambda * Math.sqrt(fc);
    const I = (b * Math.pow(h, 3)) / 12;
    const yt = h / 2;
    const Mcr_Nmm = (fr * I) / yt;
    const Mcr_kNm = Mcr_Nmm / 1e6;
    const M_Nmm = M_kNm * 1e6;
    const fb = (M_Nmm * yt) / I;

    return { b, h, fc, lambda, M_kNm, fr, I, yt, Mcr_Nmm, Mcr_kNm, fb };
  }

  function renderUncracked(r, out) {
    out = out || getEl('calculation-output');
    if (!out) return;
    if (!r) {
      out.innerHTML = '<div class="calc-step"><p>Enter valid b, h, f<sub>c</sub>′.</p></div>';
      return;
    }
    let html = '';
    html += `<div class="calc-step"><div class="calc-step-title">Given</div><div class="calc-step-equation">b = ${fmt(r.b)} mm, h = ${fmt(r.h)} mm, f<sub>c</sub>′ = ${fmt(r.fc)} MPa, λ = ${fmt(r.lambda)}</div></div>`;
    html += `<div class="calc-step"><div class="calc-step-title">1. Modulus of rupture</div><div class="calc-step-equation">f<sub>r</sub> = 0.62 λ √(f<sub>c</sub>′) = 0.62 × ${fmt(r.lambda)} × √${fmt(r.fc)} = <span class="calc-step-result">${fmt(r.fr)} MPa</span></div></div>`;
    html += `<div class="calc-step"><div class="calc-step-title">2. Moment of inertia</div><div class="calc-step-equation">I = b h³/12 = ${fmt(r.b)} × ${fmt(r.h)}³/12 = <span class="calc-step-result">${fmt(r.I, 0)} mm⁴</span></div></div>`;
    html += `<div class="calc-step"><div class="calc-step-title">3. Distance to extreme fiber</div><div class="calc-step-equation">y<sub>t</sub> = h/2 = <span class="calc-step-result">${fmt(r.yt)} mm</span></div></div>`;
    html += `<div class="calc-step"><div class="calc-step-title">4. Cracking moment</div><div class="calc-step-equation">M<sub>cr</sub> = f<sub>r</sub> I / y<sub>t</sub> = ${fmt(r.fr)} × ${fmt(r.I, 0)} / ${fmt(r.yt)} = ${fmt(r.Mcr_Nmm, 0)} N·mm = <span class="calc-step-result">${fmt(r.Mcr_kNm)} kN·m</span></div></div>`;
    html += `<div class="calc-step"><div class="calc-step-title">5. Bending stress (at M = ${fmt(r.M_kNm)} kN·m)</div><div class="calc-step-equation">f<sub>b</sub> = M y / I = (${fmt(r.M_kNm)}×10⁶) × ${fmt(r.yt)} / ${fmt(r.I, 0)} = <span class="calc-step-result">${fmt(r.fb)} MPa</span></div></div>`;
    out.innerHTML = html;
  }

  // ==================== B. CRACKED SECTION ====================
  function calcCracked() {
    const b = num('cracked-b', 300);
    const h = num('cracked-h', 500);
    const d = num('cracked-d', 450);
    const fc = num('cracked-fc', 28);
    let n = num('cracked-n', 0);
    if (!n && fc) { const Ec = 4700 * Math.sqrt(fc); n = Es / Ec; }
    if (!n) n = 9;
    const Nb = num('cracked-Nb', 4);
    const Db = num('cracked-Db', 20);
    const M_kNm = num('cracked-M', 80);
    if (!b || !d || !n || !Nb || !Db) return null;

    const As = Nb * (Math.PI * Db * Db) / 4;
    // b c²/2 = n As (d - c)  =>  (b/2) c² + n As c - n As d = 0
    const Aq = b / 2;
    const Bq = n * As;
    const Cq = -n * As * d;
    const disc = Bq * Bq - 4 * Aq * Cq;
    if (disc < 0) return null;
    const c = (-Bq + Math.sqrt(disc)) / (2 * Aq);
    if (c <= 0 || c >= d) return null;

    const Ic = (b * Math.pow(c, 3)) / 3 + n * As * Math.pow(d - c, 2);
    const M_Nmm = M_kNm * 1e6;
    const fc_stress = (M_Nmm * c) / Ic;
    const fs = n * (M_Nmm * (d - c)) / Ic;

    return { b, h, d, n, Nb, Db, M_kNm, As, c, Ic, fc_stress, fs };
  }

  function renderCracked(r, out) {
    out = out || getEl('calculation-output');
    if (!out) return;
    if (!r) {
      out.innerHTML = '<div class="calc-step"><p>Enter valid inputs. Ensure neutral axis c &lt; d.</p></div>';
      return;
    }
    let html = '';
    html += `<div class="calc-step"><div class="calc-step-title">Given</div><div class="calc-step-equation">b = ${fmt(r.b)}, h = ${fmt(r.h)}, d = ${fmt(r.d)}, n = ${fmt(r.n)}, N<sub>b</sub> = ${r.Nb}, D<sub>b</sub> = ${fmt(r.Db)} mm, M = ${fmt(r.M_kNm)} kN·m</div></div>`;
    html += `<div class="calc-step"><div class="calc-step-title">1. Area of steel</div><div class="calc-step-equation">A<sub>s</sub> = N<sub>b</sub> × π D<sub>b</sub>²/4 = <span class="calc-step-result">${fmt(r.As)} mm²</span></div></div>`;
    html += `<div class="calc-step"><div class="calc-step-title">2. Neutral axis (b c²/2 = n A<sub>s</sub>(d − c))</div><div class="calc-step-equation">c = <span class="calc-step-result">${fmt(r.c)} mm</span></div></div>`;
    html += `<div class="calc-step"><div class="calc-step-title">3. Cracked moment of inertia</div><div class="calc-step-equation">I<sub>c</sub> = b c³/3 + n A<sub>s</sub>(d − c)² = <span class="calc-step-result">${fmt(r.Ic, 0)} mm⁴</span></div></div>`;
    html += `<div class="calc-step"><div class="calc-step-title">4. Concrete stress</div><div class="calc-step-equation">f<sub>c</sub> = M c / I<sub>c</sub> = <span class="calc-step-result">${fmt(r.fc_stress)} MPa</span></div></div>`;
    html += `<div class="calc-step"><div class="calc-step-title">5. Steel stress</div><div class="calc-step-equation">f<sub>s</sub> = n M (d − c) / I<sub>c</sub> = <span class="calc-step-result">${fmt(r.fs)} MPa</span></div></div>`;
    out.innerHTML = html;
  }

  // ==================== C1. USD ANALYSIS (SINGLY) ====================
  function calcUsdAnalysis() {
    const b = num('usd-a-b', 300);
    const h = num('usd-a-h', 500);
    const d = num('usd-a-d', 450);
    const fc = num('usd-a-fc', 28);
    const fy = num('usd-a-fy', 420);
    const Nb = num('usd-a-Nb', 4);
    const Db = num('usd-a-Db', 20);
    const Mu_kNm = num('usd-a-Mu', 150);
    if (!b || !d || !fc || !fy || !Nb || !Db) return null;

    const As = Nb * (Math.PI * Db * Db) / 4;
    const rho = As / (b * d);
    const rhoMin1 = 1.4 / fy;
    const rhoMin2 = (0.25 * Math.sqrt(fc)) / fy;
    const rhoMin = Math.max(rhoMin1, rhoMin2);
    const ety = fy / Es;
    const b1 = beta1(fc);
    const rhoBal = (0.85 * b1 * fc / fy) * (EC / (ety + EC));
    const rhoMax = 0.75 * rhoBal;
    const a = (As * fy) / (0.85 * fc * b);
    const c = a / b1;
    const et = ((d - c) / c) * EC;
    let phi = 0.65;
    if (et >= ET_TENSION_CONTROLLED) phi = 0.90;
    else if (et > ety) phi = 0.65 + (0.25 * (et - ety)) / (ET_TENSION_CONTROLLED - ety);
    const Mn = As * fy * (d - a / 2);
    const phiMn = phi * Mn;
    const Mu_Nmm = Mu_kNm * 1e6;
    const safe = phiMn >= Mu_Nmm;

    return {
      b, h, d, fc, fy, Nb, Db, Mu_kNm, As, rho, rhoMin1, rhoMin2, rhoMin,
      rhoBal, rhoMax, b1, a, c, et, ety, phi, Mn, phiMn, Mu_Nmm, safe
    };
  }

  function renderUsdAnalysis(r, out) {
    out = out || getEl('calculation-output');
    if (!out) return;
    if (!r) {
      out.innerHTML = '<div class="calc-step"><p>Enter valid inputs.</p></div>';
      return;
    }
    const phiMnKnm = r.phiMn / 1e6;
    let html = '';
    html += `<div class="calc-step"><div class="calc-step-title">Given</div><div class="calc-step-equation">b = ${fmt(r.b)}, h = ${fmt(r.h)}, d = ${fmt(r.d)}, f<sub>c</sub>′ = ${fmt(r.fc)}, f<sub>y</sub> = ${fmt(r.fy)}, N<sub>b</sub> = ${r.Nb}, D<sub>b</sub> = ${fmt(r.Db)} mm, M<sub>u</sub> = ${fmt(r.Mu_kNm)} kN·m</div></div>`;
    html += `<div class="calc-step"><div class="calc-step-title">1. Area of steel</div><div class="calc-step-equation">A<sub>s</sub> = ${fmt(r.As)} mm²</div></div>`;
    html += `<div class="calc-step"><div class="calc-step-title">2. Steel ratio</div><div class="calc-step-equation">ρ = A<sub>s</sub>/(b d) = ${fmt(r.rho, 4)}</div></div>`;
    html += `<div class="calc-step"><div class="calc-step-title">3. Minimum steel ratio</div><div class="calc-step-equation">ρ<sub>min</sub> = max(1.4/f<sub>y</sub>, 0.25√f<sub>c</sub>′/f<sub>y</sub>) = max(${fmt(r.rhoMin1, 4)}, ${fmt(r.rhoMin2, 4)}) = ${fmt(r.rhoMin, 4)}</div></div>`;
    html += `<div class="calc-step"><div class="calc-step-title">4. Maximum steel ratio</div><div class="calc-step-equation">ρ<sub>b</sub> = ${fmt(r.rhoBal, 4)}, ρ<sub>max</sub> = 0.75 ρ<sub>b</sub> = ${fmt(r.rhoMax, 4)}</div></div>`;
    html += `<div class="calc-step"><div class="calc-step-title">5. β<sub>1</sub>, a, c</div><div class="calc-step-equation">β<sub>1</sub> = ${fmt(r.b1, 3)}, a = A<sub>s</sub> f<sub>y</sub>/(0.85 f<sub>c</sub>′ b) = ${fmt(r.a)} mm, c = a/β<sub>1</sub> = ${fmt(r.c)} mm</div></div>`;
    html += `<div class="calc-step"><div class="calc-step-title">6. Steel strain &amp; φ</div><div class="calc-step-equation">ε<sub>t</sub> = (d−c)/c × 0.003 = ${fmt(r.et, 4)}; φ = ${fmt(r.phi, 2)}</div></div>`;
    html += `<div class="calc-step"><div class="calc-step-title">7. Nominal &amp; design moment</div><div class="calc-step-equation">M<sub>n</sub> = A<sub>s</sub> f<sub>y</sub>(d − a/2) = ${fmt(r.Mn / 1e6)} kN·m; φM<sub>n</sub> = ${fmt(phiMnKnm)} kN·m</div></div>`;
    const cls = r.safe ? 'verification-ok' : 'verification-warn';
    const msg = r.safe ? `SAFE: φM<sub>n</sub> (${fmt(phiMnKnm)} kN·m) ≥ M<sub>u</sub> (${fmt(r.Mu_kNm)} kN·m)` : `UNSAFE: φM<sub>n</sub> (${fmt(phiMnKnm)} kN·m) &lt; M<sub>u</sub> (${fmt(r.Mu_kNm)} kN·m)`;
    html += `<div class="calc-step ${cls}"><div class="calc-step-title">Safety check</div><div class="calc-step-result">${r.safe ? '✔' : '⚠'} ${msg}</div></div>`;
    out.innerHTML = html;
  }

  // ==================== C2. USD DESIGN (SINGLY) ====================
  function calcUsdDesign() {
    const mode = (document.querySelector('input[name="usd-design-mode"]:checked') || {}).value || 'moment';
    if (mode === 'loads') {
      const L_m = num('usd-d-L', 6);
      const L = L_m * 1000; // mm
      const support = getEl('usd-d-support') ? getEl('usd-d-support').value : 'simple';
      const DL = num('usd-d-DL', 15);
      const LL = num('usd-d-LL', 20);
      const DL_point = num('usd-d-DL-point', 0);
      const LL_point = num('usd-d-LL-point', 0);
      const wu = 1.2 * DL + 1.6 * LL; // kN/m
      const Pu = 1.2 * DL_point + 1.6 * LL_point; // kN
      let Mmax_kNm = (wu * L_m * L_m) / 8 + (Pu * L_m) / 4;
      if (support === 'cantilever') Mmax_kNm = (wu * L_m * L_m) / 2 + Pu * L_m;
      let h = support === 'cantilever' ? L / 8 : L / 16;
      h = Math.round(h / 25) * 25;
      const b = Math.ceil(h / 1.5 / 25) * 25;
      const cover = num('usd-d-cover', 40);
      const stirrup = num('usd-d-stirrup', 10);
      const Db = parseInt((getEl('usd-d-Db-L') || {}).value || 16, 10);
      const d = h - cover - stirrup - Db / 2;
      const fc = num('usd-d-fc-L', 28);
      const fy = num('usd-d-fy-L', 420);
      const Mu_kNm = Mmax_kNm;
      return designSinglyFromMu(b, h, d, fc, fy, Mmax_kNm, Db, { fromLoads: true, L: L_m, wu, Pu, Mmax_kNm });
    }
    const b = num('usd-d-b', 300);
    const h = num('usd-d-h', 500);
    const d = num('usd-d-d', 450);
    const fc = num('usd-d-fc', 28);
    const fy = num('usd-d-fy', 420);
    const Mu_kNm = num('usd-d-Mu', 150);
    const Db = parseInt((getEl('usd-d-Db') || {}).value || 16, 10);
    return designSinglyFromMu(b, h, d, fc, fy, Mu_kNm, Db, {});
  }

  function designSinglyFromMu(b, h, d, fc, fy, Mu_kNm, Db, extra) {
    const Mu_Nmm = Mu_kNm * 1e6;
    let phi = 0.9;
    const b1 = beta1(fc);
    const rhoMin1 = 1.4 / fy;
    const rhoMin2 = (0.25 * Math.sqrt(fc)) / fy;
    const rhoMin = Math.max(rhoMin1, rhoMin2);
    const ety = fy / Es;
    const rhoBal = (0.85 * b1 * fc / fy) * (EC / (ety + EC));
    const rhoMax = 0.75 * rhoBal;
    // Mu = φ As fy (d - a/2), a = As fy/(0.85 fc' b) => As² fy²/(1.7 fc' b) - As fy d + Mu/φ = 0
    const coA = (fy * fy) / (1.7 * fc * b);
    const coB = -fy * d;
    const coC = Mu_Nmm / phi;
    const disc = coB * coB - 4 * coA * coC;
    let AsReq = 0;
    if (disc >= 0) {
      AsReq = (-coB - Math.sqrt(disc)) / (2 * coA);
      if (AsReq < 0) AsReq = (-coB + Math.sqrt(disc)) / (2 * coA);
    }
    const Ab = (Math.PI * Db * Db) / 4;
    const AsMin = rhoMin * b * d;
    const AsUsed = Math.max(AsMin, Math.min(AsReq, rhoMax * b * d));
    const Nb = Math.ceil(AsUsed / Ab);
    const As = Nb * Ab;
    const rho = As / (b * d);
    const a = (As * fy) / (0.85 * fc * b);
    const c = a / b1;
    const et = ((d - c) / c) * EC;
    if (et >= ET_TENSION_CONTROLLED) phi = 0.9;
    else if (et > ety) phi = 0.65 + (0.25 * (et - ety)) / (ET_TENSION_CONTROLLED - ety);
    else phi = 0.65;
    const Mn = As * fy * (d - a / 2);
    const phiMn = phi * Mn;
    const safe = phiMn >= Mu_Nmm;
    return {
      b, h, d, fc, fy, Mu_kNm, Db, phi, b1, rhoMin, rhoMax, AsReq, AsMin, AsUsed, Ab, Nb, As, rho, a, c, et, Mn, phiMn, safe, ...extra
    };
  }

  function renderUsdDesign(r, out) {
    out = out || getEl('calculation-output');
    if (!out) return;
    if (!r) {
      out.innerHTML = '<div class="calc-step"><p>Enter valid inputs.</p></div>';
      return;
    }
    let html = '';
    if (r.fromLoads) {
      html += `<div class="calc-step"><div class="calc-step-title">From loads (NSCP)</div><div class="calc-step-equation">L = ${fmt(r.L)} m, w<sub>u</sub> = 1.2 DL + 1.6 LL = ${fmt(r.wu)} kN/m${r.Pu ? `, P<sub>u</sub> = 1.2 DL<sub>pt</sub> + 1.6 LL<sub>pt</sub> = ${fmt(r.Pu)} kN` : ''}; M<sub>max</sub> = ${fmt(r.Mmax_kNm)} kN·m</div></div>`;
      html += `<div class="calc-step"><div class="calc-step-title">Beam proportioning</div><div class="calc-step-equation">h ≈ L/16 (simply) or L/8 (cantilever); b = h/1.5 (round to 25 mm). h = ${fmt(r.h)} mm, b = ${fmt(r.b)} mm, d = ${fmt(r.d)} mm</div></div>`;
    }
    html += `<div class="calc-step"><div class="calc-step-title">Step 1 — Required steel ratio</div><div class="calc-step-equation">φ = 0.9 (assumed). A<sub>s(req)</sub> from M<sub>u</sub> = φ A<sub>s</sub> f<sub>y</sub>(d − a/2): A<sub>s(req)</sub> = ${fmt(r.AsReq)} mm²</div></div>`;
    html += `<div class="calc-step"><div class="calc-step-title">Step 2–3 — Min/max</div><div class="calc-step-equation">ρ<sub>min</sub> = ${fmt(r.rhoMin, 4)}, ρ<sub>max</sub> = ${fmt(r.rhoMax, 4)}. A<sub>s(used)</sub> = max(A<sub>s(min)</sub>, A<sub>s(req)</sub>) = ${fmt(r.AsUsed)} mm²</div></div>`;
    html += `<div class="calc-step"><div class="calc-step-title">Step 4 — Number of bars</div><div class="calc-step-equation">N<sub>b</sub> = ceil(A<sub>s</sub>/A<sub>b</sub>) = <span class="calc-step-result">${r.Nb} bars</span> (${fmt(r.Db)} mm φ), A<sub>s</sub> = ${fmt(r.As)} mm²</div></div>`;
    html += `<div class="calc-step"><div class="calc-step-title">Step 5–6 — Recheck</div><div class="calc-step-equation">ρ = ${fmt(r.rho, 4)}; a = ${fmt(r.a)} mm, c = ${fmt(r.c)} mm, ε<sub>t</sub> = ${fmt(r.et, 4)}, φ = ${fmt(r.phi, 2)}</div></div>`;
    html += `<div class="calc-step"><div class="calc-step-title">Step 7–8 — Capacity &amp; safety</div><div class="calc-step-equation">M<sub>n</sub> = ${fmt(r.Mn / 1e6)} kN·m, φM<sub>n</sub> = ${fmt(r.phiMn / 1e6)} kN·m</div></div>`;
    const cls = r.safe ? 'verification-ok' : 'verification-warn';
    html += `<div class="calc-step ${cls}"><div class="calc-step-title">Conclusion</div><div class="calc-step-result">${r.safe ? '✔' : '⚠'} Beam is ${r.safe ? 'SAFE' : 'NOT SAFE'} (φM<sub>n</sub> ${r.safe ? '≥' : '&lt;'} M<sub>u</sub>)</div></div>`;
    out.innerHTML = html;
  }

  // ==================== DOUBLY — ANALYSIS ====================
  function calcDoublyAnalysis() {
    const b = num('doubly-a-b', 300);
    const h = num('doubly-a-h', 500);
    const d = num('doubly-a-d', 450);
    const dp = num('doubly-a-dp', 60);
    const fc = num('doubly-a-fc', 28);
    const fy = num('doubly-a-fy', 420);
    const Nb = num('doubly-a-Nb', 5);
    const Db = num('doubly-a-Db', 20);
    const Nbc = num('doubly-a-Nbc', 2);
    const Dbc = num('doubly-a-Dbc', 16);
    const Mu_kNm = num('doubly-a-Mu', 220);
    if (!b || !d || !fc || !fy) return null;

    const As = Nb * (Math.PI * Db * Db) / 4;
    const Asc = Nbc * (Math.PI * Dbc * Dbc) / 4;
    const b1 = beta1(fc);
    const ety = fy / Es;
    // Solve for c: 0.85 fc' b β1 c + Asc fsc = As fy. First assume fsc = fy.
    let a = (As * fy - Asc * fy) / (0.85 * fc * b);
    if (a < 0) a = (As * fy) / (0.85 * fc * b); // no compression contribution
    let c = a / b1;
    let fsc = fy;
    const esc = c > dp ? (EC * (c - dp)) / c : 0;
    if (esc < ety) {
      fsc = Es * esc;
      // 0.85 fc' b β1 c + Asc Es εsc = As fy, εsc = 0.003(c-d')/c
      // 0.85 fc' b β1 c² + Asc Es 0.003 (c-d') = As fy c
      const Aq = 0.85 * fc * b * b1;
      const Bq = Asc * Es * 0.003 - As * fy;
      const Cq = -Asc * Es * 0.003 * dp;
      const disc = Bq * Bq - 4 * Aq * Cq;
      if (disc >= 0) {
        c = (-Bq + Math.sqrt(disc)) / (2 * Aq);
        a = b1 * c;
        fsc = Math.min(fy, Es * (EC * (c - dp)) / c);
      }
    }
    const Cc = 0.85 * fc * b * a;
    const Cs = Asc * fsc;
    const T = As * fy;
    const Mn = Cc * (d - a / 2) + Cs * (d - dp);
    const et = ((d - c) / c) * EC;
    let phi = 0.65;
    if (et >= ET_TENSION_CONTROLLED) phi = 0.9;
    else if (et > ety) phi = 0.65 + (0.25 * (et - ety)) / (ET_TENSION_CONTROLLED - ety);
    const phiMn = phi * Mn;
    const Mu_Nmm = Mu_kNm * 1e6;
    const safe = phiMn >= Mu_Nmm;

    return { b, h, d, dp, fc, fy, As, Asc, b1, a, c, fsc, esc: (EC * (c - dp)) / c, Cc, Cs, T, Mn, phi, phiMn, Mu_Nmm, Mu_kNm, safe };
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
    html += `<div class="calc-step"><div class="calc-step-title">Given</div><div class="calc-step-equation">b = ${fmt(r.b)}, d = ${fmt(r.d)}, d′ = ${fmt(r.dp)}, A<sub>s</sub> = ${fmt(r.As)}, A<sub>sc</sub> = ${fmt(r.Asc)}, M<sub>u</sub> = ${fmt(r.Mu_kNm)} kN·m</div></div>`;
    html += `<div class="calc-step"><div class="calc-step-title">Compression steel stress</div><div class="calc-step-equation">ε<sub>sc</sub> = 0.003(c−d′)/c = ${fmt(r.esc, 4)}; f<sub>sc</sub> = ${fmt(r.fsc)} MPa ${r.fsc >= r.fy ? '(yielded)' : ''}</div></div>`;
    html += `<div class="calc-step"><div class="calc-step-title">Force equilibrium</div><div class="calc-step-equation">C<sub>c</sub> = ${fmt(r.Cc, 0)} N, C<sub>s</sub> = ${fmt(r.Cs, 0)} N, T = ${fmt(r.T, 0)} N</div></div>`;
    html += `<div class="calc-step"><div class="calc-step-title">Moment capacity</div><div class="calc-step-equation">M<sub>n</sub> = C<sub>c</sub>(d−a/2) + C<sub>s</sub>(d−d′) = ${fmt(r.Mn / 1e6)} kN·m; φ = ${fmt(r.phi, 2)}; φM<sub>n</sub> = <span class="calc-step-result">${fmt(phiMnKnm)} kN·m</span></div></div>`;
    const cls = r.safe ? 'verification-ok' : 'verification-warn';
    html += `<div class="calc-step ${cls}"><div class="calc-step-title">Safety</div><div class="calc-step-result">${r.safe ? '✔' : '⚠'} ${r.safe ? 'SAFE' : 'UNSAFE'}: φM<sub>n</sub> ${fmt(phiMnKnm)} kN·m ${r.safe ? '≥' : '&lt;'} M<sub>u</sub> ${fmt(r.Mu_kNm)} kN·m</div></div>`;
    out.innerHTML = html;
  }

  // ==================== DOUBLY — DESIGN ====================
  function calcDoublyDesign() {
    const b = num('doubly-d-b', 300);
    const h = num('doubly-d-h', 500);
    const d = num('doubly-d-d', 450);
    const dp = num('doubly-d-dp', 60);
    const fc = num('doubly-d-fc', 28);
    const fy = num('doubly-d-fy', 420);
    const Mu_kNm = num('doubly-d-Mu', 220);
    const Db = parseInt((getEl('doubly-d-Db') || {}).value || 20, 10);
    const Dbc = parseInt((getEl('doubly-d-Dbc') || {}).value || 16, 10);
    if (!b || !d || !fc || !fy || !Mu_kNm) return null;

    const Mu_Nmm = Mu_kNm * 1e6;
    const b1 = beta1(fc);
    const ety = fy / Es;
    // Max a for εt = 0.005: c = d*0.003/0.008 = 0.375d, a = β1*c
    const cMax = d * EC / (EC + ET_TENSION_CONTROLLED);
    const aMax = b1 * cMax;
    const M1 = 0.85 * fc * b * aMax * (d - aMax / 2); // nominal moment from concrete only at max tension-controlled a
    const phi = 0.9;
    if (Mu_Nmm / phi <= M1) {
      // Singly sufficient — not doubly
      const As1 = (0.85 * fc * b * aMax) / fy;
      const Ab = (Math.PI * Db * Db) / 4;
      const Nb = Math.ceil(As1 / Ab);
      const As = Nb * Ab;
      const a = (As * fy) / (0.85 * fc * b);
      const Mn = As * fy * (d - a / 2);
      return {
        doublyRequired: false, b, h, d, dp, fc, fy, Mu_kNm, As1, As, Nb, Db, a, Mn, phiMn: phi * Mn, safe: phi * Mn >= Mu_Nmm
      };
    }
    const M2 = Mu_Nmm / phi - M1;
    let Asc = M2 / (fy * (d - dp));
    if (Asc < 0) Asc = 0;
    const Abc = (Math.PI * Dbc * Dbc) / 4;
    const Nbc = Math.ceil(Asc / Abc);
    Asc = Nbc * Abc;
    const As1 = (0.85 * fc * b * aMax) / fy;
    const As = As1 + Asc;
    const Ab = (Math.PI * Db * Db) / 4;
    const Nb = Math.ceil(As / Ab);
    const AsProvided = Nb * Ab;
    const a = (AsProvided * fy - Asc * fy) / (0.85 * fc * b);
    const c = a / b1;
    let fsc = fy;
    const esc = c > dp ? (EC * (c - dp)) / c : 0;
    if (esc < ety) fsc = Es * esc;
    const Mn = 0.85 * fc * b * a * (d - a / 2) + Asc * fsc * (d - dp);
    const phiMn = phi * Mn;
    const safe = phiMn >= Mu_Nmm;

    return {
      doublyRequired: true, b, h, d, dp, fc, fy, Mu_kNm, M1, M2, aMax, As1, Asc, As: AsProvided, Nb, Nbc, Db, Dbc, a, c, fsc, Mn, phiMn, Mu_Nmm, safe
    };
  }

  function renderDoublyDesign(r, out) {
    out = out || getEl('calculation-output');
    if (!out) return;
    if (!r) {
      out.innerHTML = '<div class="calc-step"><p>Enter valid inputs.</p></div>';
      return;
    }
    let html = '';
    if (!r.doublyRequired) {
      html += `<div class="calc-step"><div class="calc-step-title">Singly reinforced sufficient</div><div class="calc-step-equation">M<sub>u</sub>/φ ≤ M<sub>1</sub> (max tension-controlled). Use A<sub>s</sub> = ${fmt(r.As)} mm² (${r.Nb} × ${fmt(r.Db)} mm). φM<sub>n</sub> = ${fmt(r.phiMn / 1e6)} kN·m. ${r.safe ? '✔ SAFE' : '⚠ Check'}</div></div>`;
      out.innerHTML = html;
      return;
    }
    html += `<div class="calc-step"><div class="calc-step-title">Doubly required</div><div class="calc-step-equation">M<sub>1</sub> = ${fmt(r.M1 / 1e6)} kN·m (concrete at ε<sub>t</sub>=0.005), M<sub>2</sub> = M<sub>u</sub>/φ − M<sub>1</sub> = ${fmt(r.M2 / 1e6)} kN·m</div></div>`;
    html += `<div class="calc-step"><div class="calc-step-title">Compression steel</div><div class="calc-step-equation">A<sub>sc</sub> = M<sub>2</sub>/(f<sub>y</sub>(d−d′)) = ${fmt(r.Asc)} mm² → <span class="calc-step-result">${r.Nbc} bars</span> (${fmt(r.Dbc)} mm φ)</div></div>`;
    html += `<div class="calc-step"><div class="calc-step-title">Tension steel</div><div class="calc-step-equation">A<sub>s1</sub> = ${fmt(r.As1)} mm², A<sub>s</sub> = A<sub>s1</sub> + A<sub>sc</sub> → <span class="calc-step-result">${r.Nb} bars</span> (${fmt(r.Db)} mm φ), A<sub>s</sub> = ${fmt(r.As)} mm²</div></div>`;
    html += `<div class="calc-step"><div class="calc-step-title">Check</div><div class="calc-step-equation">a = ${fmt(r.a)} mm, c = ${fmt(r.c)} mm, f<sub>sc</sub> = ${fmt(r.fsc)} MPa; M<sub>n</sub> = ${fmt(r.Mn / 1e6)} kN·m, φM<sub>n</sub> = ${fmt(r.phiMn / 1e6)} kN·m</div></div>`;
    const cls = r.safe ? 'verification-ok' : 'verification-warn';
    html += `<div class="calc-step ${cls}"><div class="calc-step-title">Conclusion</div><div class="calc-step-result">${r.safe ? '✔' : '⚠'} Beam is ${r.safe ? 'SAFE' : 'NOT SAFE'}</div></div>`;
    out.innerHTML = html;
  }

  // ---------- Active tab & single output ----------
  function getActiveTab() {
    const t = document.querySelector('.topic-tab.active');
    return t ? t.dataset.tab : 'uncracked';
  }

  function runActiveCalculation() {
    const out = getEl('calculation-output');
    if (!out) return;
    const tab = getActiveTab();
    const stepMode = (getEl('toggle-step-mode') && getEl('toggle-step-mode').checked) !== false;
    if (!stepMode) {
      renderResultOnly(tab, out);
      return;
    }
    switch (tab) {
      case 'uncracked':
        renderUncracked(calcUncracked(), out);
        break;
      case 'cracked':
        renderCracked(calcCracked(), out);
        break;
      case 'usd-analysis':
        renderUsdAnalysis(calcUsdAnalysis(), out);
        break;
      case 'usd-design':
        renderUsdDesign(calcUsdDesign(), out);
        break;
      case 'doubly-analysis':
        renderDoublyAnalysis(calcDoublyAnalysis(), out);
        break;
      case 'doubly-design':
        renderDoublyDesign(calcDoublyDesign(), out);
        break;
      default:
        out.innerHTML = '<div class="calc-step"><p>Select a topic.</p></div>';
    }
    highlightResults(out);
  }

  function renderResultOnly(tab, out) {
    let r; let html = '';
    switch (tab) {
      case 'uncracked':
        r = calcUncracked();
        if (!r) { out.innerHTML = '<div class="calc-step"><p>Enter valid b, h, f<sub>c</sub>′.</p></div>'; return; }
        html = `<div class="calc-step"><div class="calc-step-title">Results</div><div class="calc-step-equation">f<sub>r</sub> = <span class="calc-step-result">${fmt(r.fr)} MPa</span>, M<sub>cr</sub> = <span class="calc-step-result">${fmt(r.Mcr_kNm)} kN·m</span>, f<sub>b</sub> = <span class="calc-step-result">${fmt(r.fb)} MPa</span></div></div>`;
        break;
      case 'cracked':
        r = calcCracked();
        if (!r) { out.innerHTML = '<div class="calc-step"><p>Enter valid inputs.</p></div>'; return; }
        html = `<div class="calc-step"><div class="calc-step-title">Results</div><div class="calc-step-equation">A<sub>s</sub> = ${fmt(r.As)} mm², c = ${fmt(r.c)} mm, I<sub>c</sub> = ${fmt(r.Ic, 0)} mm⁴, f<sub>c</sub> = ${fmt(r.fc_stress)} MPa, f<sub>s</sub> = <span class="calc-step-result">${fmt(r.fs)} MPa</span></div></div>`;
        break;
      case 'usd-analysis':
        r = calcUsdAnalysis();
        if (!r) { out.innerHTML = '<div class="calc-step"><p>Enter valid inputs.</p></div>'; return; }
        const safeA = r.safe ? 'verification-ok' : 'verification-warn';
        html = `<div class="calc-step"><div class="calc-step-title">Results</div><div class="calc-step-equation">φM<sub>n</sub> = ${fmt(r.phiMn / 1e6)} kN·m, ρ = ${fmt(r.rho, 4)}</div></div><div class="calc-step ${safeA}"><div class="calc-step-result">${r.safe ? '✔ SAFE' : '⚠ UNSAFE'}</div></div>`;
        break;
      case 'usd-design':
        r = calcUsdDesign();
        if (!r) { out.innerHTML = '<div class="calc-step"><p>Enter valid inputs.</p></div>'; return; }
        const safeD = r.safe ? 'verification-ok' : 'verification-warn';
        html = `<div class="calc-step"><div class="calc-step-title">Results</div><div class="calc-step-equation">A<sub>s</sub> = ${fmt(r.As)} mm², N<sub>b</sub> = ${r.Nb} bars, φM<sub>n</sub> = ${fmt(r.phiMn / 1e6)} kN·m</div></div><div class="calc-step ${safeD}"><div class="calc-step-result">${r.safe ? '✔ SAFE' : '⚠ NOT SAFE'}</div></div>`;
        break;
      case 'doubly-analysis':
        r = calcDoublyAnalysis();
        if (!r) { out.innerHTML = '<div class="calc-step"><p>Enter valid inputs.</p></div>'; return; }
        const safeDA = r.safe ? 'verification-ok' : 'verification-warn';
        html = `<div class="calc-step"><div class="calc-step-title">Results</div><div class="calc-step-equation">φM<sub>n</sub> = ${fmt(r.phiMn / 1e6)} kN·m</div></div><div class="calc-step ${safeDA}"><div class="calc-step-result">${r.safe ? '✔ SAFE' : '⚠ UNSAFE'}</div></div>`;
        break;
      case 'doubly-design':
        r = calcDoublyDesign();
        if (!r) { out.innerHTML = '<div class="calc-step"><p>Enter valid inputs.</p></div>'; return; }
        const safeDD = r.safe ? 'verification-ok' : 'verification-warn';
        html = `<div class="calc-step"><div class="calc-step-title">Results</div><div class="calc-step-equation">${r.doublyRequired ? 'A<sub>s</sub> = ' + fmt(r.As) + ' mm² (' + r.Nb + ' bars), A<sub>sc</sub> = ' + fmt(r.Asc) + ' mm² (' + r.Nbc + ' bars)' : 'Singly sufficient: ' + fmt(r.As) + ' mm² (' + r.Nb + ' bars)'} , φM<sub>n</sub> = ${fmt(r.phiMn / 1e6)} kN·m</div></div><div class="calc-step ${safeDD}"><div class="calc-step-result">${r.safe ? '✔ SAFE' : '⚠ NOT SAFE'}</div></div>`;
        break;
      default:
        html = '<div class="calc-step"><p>Select a topic.</p></div>';
    }
    out.innerHTML = html;
    highlightResults(out);
  }

  function highlightResults(container) {
    if (!container) return;
    const results = container.querySelectorAll('.calc-step-result');
    results.forEach(el => {
      el.classList.add('result-highlight');
      setTimeout(() => el.classList.remove('result-highlight'), 800);
    });
  }

  // ---------- Dynamic beam SVG ----------
  function updateBeamViz() {
    const tab = getActiveTab();
    const svg = getEl('beam-dynamic-svg');
    const rect = getEl('beam-rect');
    const tensionG = getEl('beam-tension-bars');
    const compG = getEl('beam-compression-bars');
    const compBlock = getEl('beam-comp-block');
    const caption = getEl('beam-viz-caption');
    if (!svg || !rect || !tensionG) return;

    let b = 300, h = 500, d = 450, Nb = 4, Db = 20, Nbc = 0, dp = 60, a = 0;
    switch (tab) {
      case 'uncracked':
        b = num('uncracked-b', 300);
        h = num('uncracked-h', 500);
        Nb = 4;
        Db = 20;
        break;
      case 'cracked':
        b = num('cracked-b', 300);
        h = num('cracked-h', 500);
        d = num('cracked-d', 450);
        Nb = num('cracked-Nb', 4);
        Db = num('cracked-Db', 20);
        break;
      case 'usd-analysis':
        b = num('usd-a-b', 300);
        h = num('usd-a-h', 500);
        d = num('usd-a-d', 450);
        Nb = num('usd-a-Nb', 4);
        Db = num('usd-a-Db', 20);
        a = (function () {
          const r = calcUsdAnalysis();
          return r ? r.a : 0;
        })();
        break;
      case 'usd-design':
        b = num('usd-d-b', 300);
        h = num('usd-d-h', 500);
        d = num('usd-d-d', 450);
        a = (function () {
          const r = calcUsdDesign();
          return r ? r.a : 0;
        })();
        Nb = (function () {
          const r = calcUsdDesign();
          return r ? r.Nb : 4;
        })();
        Db = parseInt((getEl('usd-d-Db') || {}).value || 16, 10);
        break;
      case 'doubly-analysis':
        b = num('doubly-a-b', 300);
        h = num('doubly-a-h', 500);
        d = num('doubly-a-d', 450);
        dp = num('doubly-a-dp', 60);
        Nb = num('doubly-a-Nb', 5);
        Db = num('doubly-a-Db', 20);
        Nbc = num('doubly-a-Nbc', 2);
        a = (function () {
          const r = calcDoublyAnalysis();
          return r ? r.a : 0;
        })();
        break;
      case 'doubly-design':
        b = num('doubly-d-b', 300);
        h = num('doubly-d-h', 500);
        d = num('doubly-d-d', 450);
        dp = num('doubly-d-dp', 60);
        Nbc = (function () {
          const r = calcDoublyDesign();
          return r && r.doublyRequired ? r.Nbc : 0;
        })();
        Nb = (function () {
          const r = calcDoublyDesign();
          return r ? r.Nb : 4;
        })();
        Db = parseInt((getEl('doubly-d-Db') || {}).value || 20, 10);
        a = (function () {
          const r = calcDoublyDesign();
          return r ? r.a : 0;
        })();
        break;
    }

    const scale = Math.min(200 / Math.max(b / 1.5, 1), 240 / Math.max(h / 2, 1), 1);
    const w = Math.min(200 * (b / 300), 200);
    const boxH = 240;
    const hScaled = Math.min(240 * (h / 500), 240);
    rect.setAttribute('width', w);
    rect.setAttribute('height', hScaled);
    rect.setAttribute('y', 40 + (240 - hScaled));

    const x0 = 40;
    const yBottom = 40 + hScaled;
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
      circle.setAttribute('stroke-width', '1.5');
      tensionG.appendChild(circle);
    }

    compG.innerHTML = '';
    if (Nbc > 0) {
      const yTop = 40 + 12;
      for (let i = 0; i < Nbc; i++) {
        const cx = x0 + (w * (i + 1)) / (Nbc + 1);
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', cx);
        circle.setAttribute('cy', yTop);
        circle.setAttribute('r', barR * 0.9);
        circle.setAttribute('fill', 'url(#vgComp)');
        circle.setAttribute('stroke', 'currentColor');
        circle.setAttribute('stroke-width', '1');
        compG.appendChild(circle);
      }
    }

    if (compBlock) {
      if (a > 0 && h > 0) {
        const ah = (a / h) * hScaled;
        const topY = 40 + (240 - hScaled);
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

    if (caption) caption.textContent = 'b = ' + b + ' mm, h = ' + h + ' mm' + (Nb ? ', ' + Nb + ' tension bar(s)' : '') + (Nbc ? ', ' + Nbc + ' comp.' : '') + '.';
  }

  // ---------- Topic tabs ----------
  function initTopicTabs() {
    const tabBtns = document.querySelectorAll('.topic-tab');
    const inputContents = document.querySelectorAll('.tab-input-content');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const tabId = btn.dataset.tab;
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        inputContents.forEach(block => {
          const id = block.id;
          if (id === 'input-' + tabId) {
            block.classList.add('active');
          } else {
            block.classList.remove('active');
          }
        });
        runActiveCalculation();
        updateBeamViz();
      });
    });
  }

  function initDesignModeToggle() {
    const radios = document.querySelectorAll('input[name="usd-design-mode"]');
    const momentBox = getEl('usd-design-moment-inputs');
    const loadsBox = getEl('usd-design-loads-inputs');
    if (!radios.length || !momentBox || !loadsBox) return;
    function toggle() {
      const v = document.querySelector('input[name="usd-design-mode"]:checked');
      const isLoads = v && v.value === 'loads';
      momentBox.classList.toggle('hidden', isLoads);
      loadsBox.classList.toggle('hidden', !isLoads);
      runActiveCalculation();
      updateBeamViz();
    }
    radios.forEach(r => r.addEventListener('change', toggle));
    toggle();
  }

  function initStepModeToggle() {
    const chk = getEl('toggle-step-mode');
    const out = getEl('calculation-output');
    if (!chk || !out) return;
    chk.addEventListener('change', () => {
      out.dataset.stepMode = chk.checked ? 'true' : 'false';
      runActiveCalculation();
    });
  }

  function initDarkToggle() {
    const chk = getEl('toggle-dark');
    if (!chk) return;
    const saved = localStorage.getItem('rcd-dark');
    if (saved === 'true') {
      chk.checked = true;
      document.documentElement.setAttribute('data-theme', 'dark');
    }
    chk.addEventListener('change', () => {
      const dark = chk.checked;
      document.documentElement.setAttribute('data-theme', dark ? 'dark' : '');
      try { localStorage.setItem('rcd-dark', dark); } catch (e) {}
    });
  }

  function initNavLinks() {
    document.querySelectorAll('.nav-link[href="#calculator"]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const target = document.getElementById('calculator');
        if (target) target.scrollIntoView({ behavior: 'smooth' });
        const tab = link.dataset.tab;
        if (tab) {
          const btn = document.querySelector('.topic-tab[data-tab="' + tab + '"]');
          if (btn) btn.click();
        }
      });
    });
  }

  function initInputListeners() {
    const byTab = {
      uncracked: ['uncracked-b', 'uncracked-h', 'uncracked-fc', 'uncracked-lambda', 'uncracked-M'],
      cracked: ['cracked-b', 'cracked-h', 'cracked-d', 'cracked-fc', 'cracked-n', 'cracked-Nb', 'cracked-Db', 'cracked-M'],
      'usd-analysis': ['usd-a-b', 'usd-a-h', 'usd-a-d', 'usd-a-fc', 'usd-a-fy', 'usd-a-Nb', 'usd-a-Db', 'usd-a-Mu'],
      'usd-design': ['usd-d-b', 'usd-d-h', 'usd-d-d', 'usd-d-fc', 'usd-d-fy', 'usd-d-Mu', 'usd-d-Db', 'usd-d-L', 'usd-d-support', 'usd-d-DL', 'usd-d-LL', 'usd-d-DL-point', 'usd-d-LL-point', 'usd-d-fc-L', 'usd-d-fy-L', 'usd-d-cover', 'usd-d-stirrup', 'usd-d-Db-L'],
      'doubly-analysis': ['doubly-a-b', 'doubly-a-h', 'doubly-a-d', 'doubly-a-dp', 'doubly-a-fc', 'doubly-a-fy', 'doubly-a-Nb', 'doubly-a-Db', 'doubly-a-Nbc', 'doubly-a-Dbc', 'doubly-a-Mu'],
      'doubly-design': ['doubly-d-b', 'doubly-d-h', 'doubly-d-d', 'doubly-d-dp', 'doubly-d-fc', 'doubly-d-fy', 'doubly-d-Mu', 'doubly-d-Db', 'doubly-d-Dbc']
    };
    Object.keys(byTab).forEach(tab => {
      byTab[tab].forEach(id => {
        const el = getEl(id);
        if (el) {
          el.addEventListener('input', () => {
            if (getActiveTab() === tab) {
              runActiveCalculation();
              updateBeamViz();
            }
          });
          el.addEventListener('change', () => {
            if (getActiveTab() === tab) {
              runActiveCalculation();
              updateBeamViz();
            }
          });
        }
      });
    });
  }

  function init() {
    initTopicTabs();
    initDesignModeToggle();
    initStepModeToggle();
    initDarkToggle();
    initNavLinks();
    initInputListeners();
    runActiveCalculation();
    updateBeamViz();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
