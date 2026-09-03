(() => {
  document.documentElement.classList.add('js');
  const canvas = document.querySelector('#wave-canvas');
  const hero = document.querySelector('.hero');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const vertexSource = `#version 300 es
    in vec2 aPosition;
    void main() { gl_Position = vec4(aPosition, 0.0, 1.0); }
  `;

  const fragmentSource = `#version 300 es
    precision highp float;
    uniform vec2 uResolution;
    uniform vec2 uPointer;
    uniform float uTime;
    uniform float uEnergy;
    uniform float uScroll;
    out vec4 outColor;

    float hash21(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }

    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x), mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0)), f.x), f.y);
    }

    float fbm(vec2 p) {
      float value = 0.0;
      float amplitude = .5;
      for (int i = 0; i < 4; i++) {
        value += noise(p) * amplitude;
        p = p * 2.03 + vec2(5.1, 8.7);
        amplitude *= .5;
      }
      return value;
    }

    void main() {
      vec2 frag = gl_FragCoord.xy / uResolution.xy;
      vec2 uv = frag - .5;
      uv.x *= uResolution.x / uResolution.y;
      vec2 mouse = uPointer;
      mouse.x *= uResolution.x / uResolution.y;

      float t = uTime * .12;
      vec2 p = uv + mouse * vec2(.14, .1);
      p *= mat2(.94, -.34, .34, .94);
      p.y += uScroll * .35;

      float warpA = fbm(p * 1.25 + vec2(t, -t * .7));
      float warpB = fbm(p * 1.8 + vec2(-t * .55, t * .8) + vec2(warpA * .7));
      vec2 warped = p + vec2(warpA - .5, warpB - .5) * .34;

      float sweep = warped.y + sin(warped.x * 1.55 + t * 3.0) * .18;
      float body = exp(-sweep * sweep * 4.2);
      float fold = exp(-pow(abs(sweep + (warpB - .5) * .34), 2.0) * 19.0);
      float veil = exp(-pow(abs(warped.y - .28 + sin(warped.x * 1.1 - t * 2.0) * .13), 2.0) * 8.0);
      float detail = smoothstep(.46, .82, fbm(warped * 3.1 + vec2(t * .4, 0.0)));
      float tracks = smoothstep(.75, .95, fbm(vec2(warped.x * 6.0, warped.y * 1.5 - t * .5)));
      float envelope = smoothstep(1.35, .16, length(uv * vec2(.58, .9)));

      vec3 color = vec3(.012, .015, .021);
      vec3 deepBlue = vec3(.055, .16, .27);
      vec3 ice = vec3(.28, .54, .72);
      vec3 pearl = vec3(.76, .86, .91);
      vec3 amber = vec3(.45, .28, .12);
      color += deepBlue * body * (.75 + warpA * .5);
      color += ice * fold * (.2 + detail * .48);
      color += pearl * fold * detail * .22;
      color += deepBlue * veil * .38;
      color += amber * tracks * fold * .35;
      color += ice * uEnergy * body * .055;
      color *= envelope;

      float grain = hash21(gl_FragCoord.xy + floor(uTime * 12.0)) - .5;
      color += grain * .018;
      color *= .82 + smoothstep(1.2, .12, length(uv * vec2(.58, .76))) * .3;
      // scanline whisper: instrument feel
      color *= 1.0 - 0.035 * sin(gl_FragCoord.y * 1.7);
      // Dissolve the field into the page so the fold never cuts hard.
      outColor = vec4(color, envelope);
    }
  `;

  function compile(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error(`WebGL ${type === gl.VERTEX_SHADER ? 'vertex' : 'fragment'} shader failed to compile:`, gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  let heroVisible = true;
  let scrollProgress = 0;

  function initialiseShader() {
    if (!canvas || !hero) return;
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: true, premultipliedAlpha: false, powerPreference: 'high-performance' });
    if (!gl) return;

    const vertex = compile(gl, gl.VERTEX_SHADER, vertexSource);
    const fragment = compile(gl, gl.FRAGMENT_SHADER, fragmentSource);
    if (!vertex || !fragment) return;

    const program = gl.createProgram();
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('WebGL shader program failed to link:', gl.getProgramInfoLog(program));
      return;
    }

    const vertices = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertices);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    gl.useProgram(program);
    gl.clearColor(0, 0, 0, 0);

    const position = gl.getAttribLocation(program, 'aPosition');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    const resolution = gl.getUniformLocation(program, 'uResolution');
    const pointerUniform = gl.getUniformLocation(program, 'uPointer');
    const timeUniform = gl.getUniformLocation(program, 'uTime');
    const energyUniform = gl.getUniformLocation(program, 'uEnergy');
    const scrollUniform = gl.getUniformLocation(program, 'uScroll');
    const target = { x: .18, y: 0 };
    const pointer = { x: .18, y: 0 };
    let energy = 0;
    let lastX = window.innerWidth * .68;
    let lastY = window.innerHeight * .5;

    window.addEventListener('pointermove', (event) => {
      target.x = event.clientX / window.innerWidth - .5;
      target.y = .5 - event.clientY / window.innerHeight;
      const velocity = Math.hypot(event.clientX - lastX, event.clientY - lastY) / 45;
      energy = Math.min(1, energy + velocity);
      lastX = event.clientX;
      lastY = event.clientY;
    }, { passive: true });

    window.addEventListener('scroll', () => {
      const max = Math.max(1, window.innerHeight);
      scrollProgress = Math.min(1, window.scrollY / max);
    }, { passive: true });

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1) * .72;
      const width = Math.floor(canvas.clientWidth * dpr);
      const height = Math.floor(canvas.clientHeight * dpr);
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
      }
    };

    const start = performance.now();
    hero.classList.add('has-webgl');

    if ('IntersectionObserver' in window) {
      new IntersectionObserver((entries) => {
        heroVisible = entries[0].isIntersecting;
        if (heroVisible && !reducedMotion) requestAnimationFrame(render);
      }, { threshold: 0 }).observe(hero);
    }

    let previousFrame = 0;
    let rafId = 0;
    const render = (now) => {
      if (!heroVisible && !reducedMotion) return;
      if (!reducedMotion && now - previousFrame < 30) {
        rafId = requestAnimationFrame(render);
        return;
      }
      previousFrame = now;
      resize();
      pointer.x += (target.x - pointer.x) * .055;
      pointer.y += (target.y - pointer.y) * .055;
      energy *= .94;
      gl.uniform2f(resolution, canvas.width, canvas.height);
      gl.uniform2f(pointerUniform, reducedMotion ? .18 : pointer.x, reducedMotion ? 0 : pointer.y);
      gl.uniform1f(timeUniform, reducedMotion ? 0 : (now - start) / 1000);
      gl.uniform1f(energyUniform, reducedMotion ? 0 : energy);
      gl.uniform1f(scrollUniform, scrollProgress);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      if (reducedMotion) return;
      rafId = requestAnimationFrame(render);
    };
    requestAnimationFrame(render);
    void rafId;
  }

  function initialiseReveals() {
    const items = document.querySelectorAll('.reveal');
    if (reducedMotion || !('IntersectionObserver' in window)) {
      items.forEach((item) => item.classList.add('is-visible'));
      return;
    }
    const observer = new IntersectionObserver((entries, currentObserver) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          currentObserver.unobserve(entry.target);
        }
      });
    }, { threshold: .08, rootMargin: '0px 0px -8% 0px' });
    items.forEach((item) => observer.observe(item));
  }

  function initialiseRoleCanvases() {
    const roles = [...document.querySelectorAll('.role, .contact')];
    if (!roles.length) return;

    const vertexSource = `#version 300 es
      in vec2 aPosition;
      void main() { gl_Position = vec4(aPosition, 0.0, 1.0); }
    `;

    // Faint sibling of the hero field: same language, quieter voice.
    const fragmentSource = `#version 300 es
      precision highp float;
      uniform vec2 uResolution;
      uniform vec2 uPointer;
      uniform float uTime;
      uniform float uEnergy;
      uniform float uSeed;
      uniform float uStir;
      uniform float uFlow;
      out vec4 outColor;

      float hash21(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x), mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0)), f.x), f.y);
      }

      float fbm(vec2 p) {
        float value = 0.0;
        float amplitude = .5;
        for (int i = 0; i < 3; i++) {
          value += noise(p) * amplitude;
          p = p * 2.03 + vec2(5.1, 8.7);
          amplitude *= .5;
        }
        return value;
      }

      void main() {
        vec2 frag = gl_FragCoord.xy / uResolution.xy;
        vec2 uv = frag - .5;
        uv.x *= uResolution.x / uResolution.y;
        vec2 mouse = uPointer;
        mouse.x *= uResolution.x / uResolution.y;

        // Keep seed offsets small so every row's field stays inside the frame.
        vec2 seedFrac = vec2(fract(uSeed), fract(uSeed * 2.0));
        float t = uTime * (.06 + seedFrac.y * .06) + uFlow;
        vec2 seedOff = (seedFrac - .5) * .7;
        float rot = .3 + seedFrac.x * .9;
        // Hover sway: the field leans over as you enter, settles as you leave.
        vec2 sway = vec2(sin(uSeed * 3.1), cos(uSeed * 2.2)) * uStir * .22;
        float c = cos(rot);
        float s = sin(rot);
        vec2 p = uv + mouse * vec2(.12, .09) + seedOff * .15 + sway;
        p *= mat2(c, -s, s, c);

        float warpA = fbm(p * 1.25 + vec2(t, -t * .7) + seedOff);
        float warpB = fbm(p * 1.8 + vec2(-t * .55, t * .8) + vec2(warpA * .7));
        vec2 warped = p + vec2(warpA - .5, warpB - .5) * .34;

        float sweep = warped.y + sin(warped.x * 1.55 + t * 3.0 + uSeed) * .18;
        float body = exp(-sweep * sweep * 4.2);
        float fold = exp(-pow(abs(sweep + (warpB - .5) * .34), 2.0) * 19.0);
        float veil = exp(-pow(abs(warped.y - .28 + sin(warped.x * 1.1 - t * 2.0 + uSeed) * .13), 2.0) * 8.0);
        float detail = smoothstep(.46, .82, fbm(warped * 3.1 + vec2(t * .4, 0.0) + seedOff));
        float envelope = smoothstep(1.35, .16, length(uv * vec2(.58, .9)));

        vec3 color = vec3(.012, .015, .021);
        vec3 deepBlue = vec3(.055, .16, .27);
        vec3 ice = vec3(.28, .54, .72);
        vec3 pearl = vec3(.76, .86, .91);
        color += deepBlue * body * (.75 + warpA * .5);
        color += ice * fold * (.2 + detail * .48);
        color += pearl * fold * detail * .22;
        color += deepBlue * veil * .38;
        color += ice * uEnergy * body * .04;
        // Entry bloom: flashes with the field's own features, then fades.
        color += (ice * .06 + pearl * .02) * (body * .8 + fold * .4 + veil * .3) * uStir;
        color *= envelope;

        float grain = hash21(gl_FragCoord.xy + floor(uTime * 12.0)) - .5;
        color += grain * .014;
        color *= .82 + smoothstep(1.2, .12, length(uv * vec2(.58, .76))) * .3;
        color *= .6;
        // Fade alpha with the envelope so the panel dissolves into the row.
        outColor = vec4(color, envelope);
      }
    `;

    const items = [];
    roles.forEach((role, index) => {
      const canvas = role.querySelector('.field-canvas');
      if (!canvas) return;
      const gl = canvas.getContext('webgl2', { antialias: false, alpha: true, premultipliedAlpha: false, powerPreference: 'low-power' });
      if (!gl) return;

      const vertex = compile(gl, gl.VERTEX_SHADER, vertexSource);
      const fragment = compile(gl, gl.FRAGMENT_SHADER, fragmentSource);
      if (!vertex || !fragment) return;

      const program = gl.createProgram();
      gl.attachShader(program, vertex);
      gl.attachShader(program, fragment);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Role shader program failed to link:', gl.getProgramInfoLog(program));
        return;
      }

      const vertices = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, vertices);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
      gl.useProgram(program);
      gl.clearColor(0, 0, 0, 0);

      const position = gl.getAttribLocation(program, 'aPosition');
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

      const seed = 0.35 + index * 1.618;
      gl.uniform1f(gl.getUniformLocation(program, 'uSeed'), seed);

      const state = {
        role, canvas, gl,
        resolution: gl.getUniformLocation(program, 'uResolution'),
        pointerUniform: gl.getUniformLocation(program, 'uPointer'),
        timeUniform: gl.getUniformLocation(program, 'uTime'),
        energyUniform: gl.getUniformLocation(program, 'uEnergy'),
        stirUniform: gl.getUniformLocation(program, 'uStir'),
        flowUniform: gl.getUniformLocation(program, 'uFlow'),
        seed,
        target: { x: .18, y: 0 },
        pointer: { x: .18, y: 0 },
        energy: 0,
        stir: 0,
        stirTarget: 0,
        flow: 0,
        lastX: null, lastY: null,
        visible: false,
      };

      // Each row owns its interaction space: pointer is relative to the row.
      role.addEventListener('pointermove', (event) => {
        const rect = role.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;
        state.target.x = (event.clientX - rect.left) / rect.width - .5;
        state.target.y = .5 - (event.clientY - rect.top) / rect.height;
        if (state.lastX !== null) {
          const velocity = Math.hypot(event.clientX - state.lastX, event.clientY - state.lastY) / 45;
          state.energy = Math.min(1, state.energy + velocity);
        }
        state.lastX = event.clientX;
        state.lastY = event.clientY;
      }, { passive: true });
      role.addEventListener('pointerleave', () => { state.lastX = null; state.lastY = null; state.stirTarget = 0; }, { passive: true });
      // Entering the row stirs the field; it settles after you leave.
      role.addEventListener('pointerenter', () => { state.stirTarget = 1; }, { passive: true });

      role.classList.add('has-gl');
      items.push(state);
    });
    if (!items.length) return;

    const resize = (state) => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1) * .5;
      const width = Math.max(2, Math.floor(state.canvas.clientWidth * dpr));
      const height = Math.max(2, Math.floor(state.canvas.clientHeight * dpr));
      if (state.canvas.width !== width || state.canvas.height !== height) {
        state.canvas.width = width;
        state.canvas.height = height;
        state.gl.viewport(0, 0, width, height);
      }
    };

    const start = performance.now();
    // Static frame for reduced motion; one shared loop otherwise.
    items.forEach((state) => {
      resize(state);
      state.gl.uniform2f(state.resolution, state.canvas.width, state.canvas.height);
      state.gl.uniform2f(state.pointerUniform, .18, 0);
      state.gl.uniform1f(state.timeUniform, reducedMotion ? 0 : (performance.now() - start) / 1000);
      state.gl.uniform1f(state.energyUniform, 0);
      state.gl.uniform1f(state.stirUniform, 0);
      state.gl.uniform1f(state.flowUniform, 0);
      state.gl.clear(state.gl.COLOR_BUFFER_BIT);
      state.gl.drawArrays(state.gl.TRIANGLES, 0, 6);
    });
    if (reducedMotion) return;

    let running = false;
    let previousFrame = 0;
    const tick = (now) => {
      if (!items.some((state) => state.visible)) { running = false; return; }
      if (now - previousFrame < 33) { requestAnimationFrame(tick); return; }
      previousFrame = now;
      items.forEach((state) => {
        if (!state.visible) return;
        resize(state);
        state.pointer.x += (state.target.x - state.pointer.x) * .055;
        state.pointer.y += (state.target.y - state.pointer.y) * .055;
        state.energy *= .94;
        // Fast rise on entry, slow settle on leave; flow only ever moves forward.
        state.stir += (state.stirTarget - state.stir) * (state.stirTarget > state.stir ? .22 : .06);
        state.flow += state.stir * .02;
        state.gl.uniform2f(state.resolution, state.canvas.width, state.canvas.height);
        state.gl.uniform2f(state.pointerUniform, state.pointer.x, state.pointer.y);
        state.gl.uniform1f(state.timeUniform, (now - start) / 1000);
        state.gl.uniform1f(state.energyUniform, state.energy);
        state.gl.uniform1f(state.stirUniform, state.stir);
        state.gl.uniform1f(state.flowUniform, state.flow);
        state.gl.clear(state.gl.COLOR_BUFFER_BIT);
        state.gl.drawArrays(state.gl.TRIANGLES, 0, 6);
      });
      requestAnimationFrame(tick);
    };
    const kick = () => {
      if (running) return;
      running = true;
      requestAnimationFrame(tick);
    };

    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          const state = items.find((item) => item.canvas === entry.target);
          if (!state) return;
          state.visible = entry.isIntersecting;
          if (state.visible) kick();
        });
      }, { threshold: 0 });
      items.forEach((state) => observer.observe(state.canvas));
    } else {
      items.forEach((state) => { state.visible = true; });
      kick();
    }
  }

  initialiseShader();
  initialiseReveals();
  initialiseRoleCanvases();
})();
