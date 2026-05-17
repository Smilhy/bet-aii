(function () {
  var DESIGN_W = 2560;
  var DESIGN_H = 1440;
  var MIN_DESKTOP_SCALE = 0.50;
  var MAX_DESKTOP_SCALE = 1.08;

  function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

  function classify(cssW, cssH, physicalW, physicalH, ratio, dpr) {
    var longest = Math.max(physicalW, physicalH);
    var shortest = Math.min(physicalW, physicalH);
    var type = 'desktop';
    if (longest <= 1700 && shortest <= 1000 && cssW <= 900) type = 'phone';
    else if (cssW <= 1180 || (longest <= 3000 && shortest <= 1900 && dpr > 1.25)) type = 'tablet';
    else if (cssW <= 1700) type = 'laptop-or-small-monitor';

    var bucket = 'fhd';
    if (physicalW >= 7600 || physicalH >= 4200) bucket = '8k';
    else if (physicalW >= 5000 || physicalH >= 2800) bucket = '5k';
    else if (physicalW >= 3800 || physicalH >= 2100) bucket = '4k';
    else if ((physicalW >= 2500 && physicalH >= 1350) || (physicalW >= 1350 && physicalH >= 2500)) bucket = '2k-qhd';
    else if ((physicalW >= 1900 && physicalH >= 1050) || (physicalW >= 1050 && physicalH >= 1900)) bucket = 'fhd';
    else bucket = 'small';

    var shape = 'standard';
    if (ratio >= 2.25) shape = 'super-ultrawide';
    else if (ratio >= 1.95) shape = 'ultrawide';
    else if (ratio <= 1.40) shape = 'square-tablet';
    else if (ratio >= 1.70 && ratio <= 1.86) shape = 'wide';
    else if (ratio >= 1.55 && ratio < 1.70) shape = 'sixteen-ten';

    return { type: type, bucket: bucket, shape: shape };
  }

  function apply() {
    var root = document.documentElement;
    var vv = window.visualViewport;
    var cssW = Math.max(320, Math.round(vv && vv.width ? vv.width : window.innerWidth || document.documentElement.clientWidth || DESIGN_W));
    var cssH = Math.max(320, Math.round(vv && vv.height ? vv.height : window.innerHeight || document.documentElement.clientHeight || DESIGN_H));
    var dpr = Number(window.devicePixelRatio || 1) || 1;
    var screenW = Math.round((window.screen && window.screen.width ? window.screen.width : cssW) * dpr);
    var screenH = Math.round((window.screen && window.screen.height ? window.screen.height : cssH) * dpr);
    var physicalW = Math.max(screenW, Math.round(cssW * dpr));
    var physicalH = Math.max(screenH, Math.round(cssH * dpr));
    var ratio = Math.max(cssW, cssH) / Math.max(1, Math.min(cssW, cssH));
    var info = classify(cssW, cssH, physicalW, physicalH, ratio, dpr);

    // Main rule: every screen receives the same 2560x1440 design canvas.
    // Smaller monitors are zoomed down, 2K stays natural, huge monitors stay close to 2K look.
    var fitW = cssW / DESIGN_W;
    var fitH = cssH / DESIGN_H;
    var scale = Math.min(fitW, fitH);

    // Mobile browsers with fixed viewport already emulate desktop width. Keep it readable.
    if (info.type === 'phone' || info.type === 'tablet') {
      scale = Math.min(fitW, fitH);
      scale = clamp(scale, 0.34, 1);
    } else {
      scale = clamp(scale, MIN_DESKTOP_SCALE, MAX_DESKTOP_SCALE);
    }

    var virtualW = Math.ceil(cssW / scale);
    var virtualH = Math.ceil(cssH / scale);

    root.classList.add('betai-resolution-lock-v1148');
    root.setAttribute('data-betai-device', info.type);
    root.setAttribute('data-betai-resolution', info.bucket);
    root.setAttribute('data-betai-shape', info.shape);
    root.style.setProperty('--betai-design-width', DESIGN_W + 'px');
    root.style.setProperty('--betai-design-height', DESIGN_H + 'px');
    root.style.setProperty('--betai-ui-scale', String(scale));
    root.style.setProperty('--betai-virtual-width', virtualW + 'px');
    root.style.setProperty('--betai-virtual-height', virtualH + 'px');
    root.style.setProperty('--betai-css-width', cssW + 'px');
    root.style.setProperty('--betai-css-height', cssH + 'px');
    root.style.setProperty('--betai-physical-width', physicalW + 'px');
    root.style.setProperty('--betai-physical-height', physicalH + 'px');
  }

  var raf = 0;
  function schedule() {
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(apply);
  }

  apply();
  window.addEventListener('resize', schedule, { passive: true });
  window.addEventListener('orientationchange', function () { setTimeout(schedule, 120); }, { passive: true });
  if (window.visualViewport) window.visualViewport.addEventListener('resize', schedule, { passive: true });
})();
