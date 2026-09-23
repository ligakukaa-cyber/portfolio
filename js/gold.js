/* Фон «жидкое золото» — чистый WebGL, без библиотек.
   Мягкий дымчатый градиент с золотыми прожилками, реагирует на курсор.
   Рисуется в уменьшенном разрешении (это размытый фон) — дёшево для GPU. */
(() => {
  "use strict";

  const canvas = document.getElementById("gold");
  if (!canvas) return;

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const gl = canvas.getContext("webgl", { antialias: false, alpha: true, depth: false });

  // Нет WebGL или выключены анимации — статичная золотая подложка.
  if (!gl || reduced) {
    canvas.style.background =
      "radial-gradient(70% 55% at 28% 18%, rgba(201,162,39,.22), transparent 62%)," +
      "radial-gradient(60% 50% at 82% 72%, rgba(138,107,30,.18), transparent 60%)," +
      "linear-gradient(160deg,#07070A,#0B0B10)";
    return;
  }

  const VERT = `
    attribute vec2 p;
    void main(){ gl_Position = vec4(p, 0.0, 1.0); }
  `;

  const FRAG = `
    precision highp float;
    uniform vec2  u_res;
    uniform float u_time;
    uniform vec2  u_mouse;

    float hash(vec2 p){
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
    }
    float noise(vec2 p){
      vec2 i = floor(p), f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
                 mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
    }
    float fbm(vec2 p){
      float v = 0.0, a = 0.5;
      mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
      for (int i = 0; i < 5; i++){ v += a * noise(p); p = m * p; a *= 0.5; }
      return v;
    }

    void main(){
      vec2 uv = gl_FragCoord.xy / u_res.xy;
      vec2 st = uv;
      st.x *= u_res.x / u_res.y;

      float t = u_time * 0.045;
      vec2 mo = (u_mouse - 0.5) * 0.35;

      // двойное искажение области — «течение» металла
      vec2 q = vec2(fbm(st * 1.6 + t), fbm(st * 1.6 + vec2(5.2, 1.3) - t * 0.8));
      vec2 r = vec2(fbm(st * 1.9 + q * 2.2 + vec2(1.7, 9.2) + t * 0.6 + mo),
                    fbm(st * 1.9 + q * 2.2 + vec2(8.3, 2.8) - t * 0.5 + mo));
      float f = fbm(st * 1.7 + r * 1.8);

      // палитра: от почти чёрного к светлому золоту
      vec3 c0 = vec3(0.027, 0.027, 0.039);
      vec3 c1 = vec3(0.086, 0.070, 0.043);
      vec3 c2 = vec3(0.404, 0.302, 0.086);
      vec3 c3 = vec3(0.788, 0.635, 0.153);
      vec3 c4 = vec3(0.949, 0.851, 0.545);

      vec3 col = mix(c0, c1, smoothstep(0.12, 0.52, f));
      col = mix(col, c2, smoothstep(0.46, 0.84, f) * 0.62);
      col = mix(col, c3, smoothstep(0.72, 0.98, f) * 0.26);

      // тонкие светящиеся прожилки по контуру шума
      float vein = smoothstep(0.010, 0.0, abs(f - 0.70));
      col += c4 * vein * 0.22;
      float vein2 = smoothstep(0.006, 0.0, abs(length(r) - 0.62));
      col += c4 * vein2 * 0.12;

      // объём: светлее у курсора, темнее по краям кадра
      float glow = 1.0 - smoothstep(0.0, 0.85, distance(uv, u_mouse));
      col += vec3(0.30, 0.23, 0.08) * glow * 0.16;
      float vig = 1.0 - smoothstep(0.30, 1.05, distance(uv, vec2(0.5)));
      col *= 0.22 + vig * 0.62;

      gl_FragColor = vec4(col, 1.0);
    }
  `;

  function compile(type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      console.warn("shader:", gl.getShaderInfoLog(sh));
      return null;
    }
    return sh;
  }

  const vs = compile(gl.VERTEX_SHADER, VERT);
  const fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return;

  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "p");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const uRes = gl.getUniformLocation(prog, "u_res");
  const uTime = gl.getUniformLocation(prog, "u_time");
  const uMouse = gl.getUniformLocation(prog, "u_mouse");

  // Фон мягкий и размытый, поэтому пиксели можно экономить.
  const SCALE = 0.42;
  function resize() {
    const w = Math.max(1, Math.round(window.innerWidth * SCALE));
    const h = Math.max(1, Math.round(window.innerHeight * SCALE));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
    gl.uniform2f(uRes, w, h);
  }
  window.addEventListener("resize", resize, { passive: true });
  resize();

  const mouse = { x: 0.5, y: 0.62, tx: 0.5, ty: 0.62 };
  window.addEventListener("pointermove", (e) => {
    mouse.tx = e.clientX / window.innerWidth;
    mouse.ty = 1 - e.clientY / window.innerHeight;
  }, { passive: true });

  let running = true;
  document.addEventListener("visibilitychange", () => {
    running = !document.hidden;
    if (running) requestAnimationFrame(frame);
  });

  const start = performance.now();
  function frame(now) {
    if (!running) return;
    mouse.x += (mouse.tx - mouse.x) * 0.045;
    mouse.y += (mouse.ty - mouse.y) * 0.045;
    gl.uniform1f(uTime, (now - start) / 1000);
    gl.uniform2f(uMouse, mouse.x, mouse.y);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
