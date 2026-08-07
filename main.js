(() => {
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

      float t = uTime * .12;
      vec2 p = uv + mouse * vec2(.14, .1);
      p *= mat2(.94, -.34, .34, .94);

      float warpA = fbm(p * 1.25 + vec2(t, -t * .7));
      float warpB = fbm(p * 1.8 + vec2(-t * .55, t * .8) + vec2(warpA * .7));
      vec2 warped = p + vec2(warpA - .5, warpB - .5) * .34;

      float sweep = warped.y + sin(warped.x * 1.55 + t * 3.0) * .18;
      float body = exp(-sweep * sweep * 4.2);
      float fold = exp(-pow(abs(sweep + (warpB - .5) * .34), 2.0) * 19.0);
      float veil = exp(-pow(abs(warped.y - .28 + sin(warped.x * 1.1 - t * 2.0) * .13), 2.0) * 8.0);
      float detail = smoothstep(.46, .82, fbm(warped * 3.1 + vec2(t * .4, 0.0)));
      float envelope = smoothstep(1.35, .16, length(uv * vec2(.58, .9)));

      vec3 color = vec3(.012, .015, .021);
      vec3 deepBlue = vec3(.055, .16, .27);
      vec3 ice = vec3(.28, .54, .72);
      vec3 pearl = vec3(.76, .86, .91);
      color += deepBlue * body * (.75 + warpA * .5);
      color += ice * fold * (.2 + detail * .48);
      color += pearl * fold * detail * .22;
      color += deepBlue * veil * .38;
      color += ice * uEnergy * body * .055;
      color *= envelope;

      float grain = hash21(gl_FragCoord.xy + floor(uTime * 12.0)) - .5;
      color += grain * .018;
      color *= .82 + smoothstep(1.2, .12, length(uv * vec2(.58, .76))) * .3;
      outColor = vec4(color, 1.0);
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

  function initialiseShader() {
    if (!canvas || !hero) return;
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'high-performance' });
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

    const position = gl.getAttribLocation(program, 'aPosition');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    const resolution = gl.getUniformLocation(program, 'uResolution');
    const pointerUniform = gl.getUniformLocation(program, 'uPointer');
    const timeUniform = gl.getUniformLocation(program, 'uTime');
    const energyUniform = gl.getUniformLocation(program, 'uEnergy');
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

    let previousFrame = 0;
    const render = (now) => {
      if (!reducedMotion && now - previousFrame < 30) {
        requestAnimationFrame(render);
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
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      if (!reducedMotion) requestAnimationFrame(render);
    };
    requestAnimationFrame(render);
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

  initialiseShader();
  initialiseReveals();
})();
