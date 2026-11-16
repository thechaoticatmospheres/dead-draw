const percentile = (values, fraction) => {
  if (!values.length) return 0;
  return [...values].sort((a, b) => a - b)[
    Math.min(values.length - 1, Math.floor(values.length * fraction))
  ];
};
// Opt-in, non-blocking GPU timing and a bounded sample window for repeatable QA.
export class RenderMetrics {
  constructor(renderer, enabled = false) {
    this.renderer = renderer;
    this.enabled = enabled;
    this.frames = [];
    this.cpu = [];
    this.gpu = [];
    this.last = 0;
    this.published = 0;
    this.pending = null;
    this.frame = 0;
    this.gl = enabled ? renderer.getContext() : null;
    this.extension = this.gl?.getExtension("EXT_disjoint_timer_query_webgl2");
    const rendererInfo = this.gl?.getExtension("WEBGL_debug_renderer_info");
    this.hardware = rendererInfo ? this.gl.getParameter(rendererInfo.UNMASKED_RENDERER_WEBGL) : "unavailable";
  }
  begin() {
    if (!this.enabled) return;
    const now = performance.now();
    if (this.last) this.record(this.frames, now - this.last);
    this.last = this.started = now;
    const gl = this.gl,
      ext = this.extension;
    if (
      this.pending &&
      gl.getQueryParameter(this.pending, gl.QUERY_RESULT_AVAILABLE)
    ) {
      if (!gl.getParameter(ext.GPU_DISJOINT_EXT))
        this.record(
          this.gpu,
          gl.getQueryParameter(this.pending, gl.QUERY_RESULT) / 1e6,
        );
      gl.deleteQuery(this.pending);
      this.pending = null;
    }
    if (ext && !this.pending && ++this.frame % 15 === 0) {
      this.pending = gl.createQuery();
      gl.beginQuery(ext.TIME_ELAPSED_EXT, this.pending);
      this.queryActive = true;
    }
  }
  record(list, value) {
    list.push(value);
    if (list.length > 300) list.shift();
  }
  end(loaded, effectPool) {
    if (this.enabled) {
      if (this.queryActive) {
        this.gl.endQuery(this.extension.TIME_ELAPSED_EXT);
        this.queryActive = false;
      }
      this.record(this.cpu, performance.now() - this.started);
    }
    const now = performance.now(),
      el = this.renderer.domElement,
      info = this.renderer.info;
    if (
      now - this.published < 250 &&
      el.dataset.graphics === (loaded ? "ready" : "loading")
    )
      return;
    this.published = now;
    Object.assign(el.dataset, {
      graphics: loaded ? "ready" : "loading",
      drawCalls: String(info.render.calls),
      triangles: String(info.render.triangles),
    });
    if (this.enabled)
      Object.assign(el.dataset, {
        frameAverage: (this.frames.reduce((a,b)=>a+b,0) / Math.max(1,this.frames.length)).toFixed(2),
        frameP95: percentile(this.frames, 0.95).toFixed(2),
        frameP99: percentile(this.frames, 0.99).toFixed(2),
        slowFramePercent: (100*this.frames.filter(ms=>ms>20).length/Math.max(1,this.frames.length)).toFixed(1),
        renderWidth: String(el.width),
        renderHeight: String(el.height),
        renderScale: String(this.renderer.getPixelRatio()),
        renderer: this.hardware,
        cpuP95: percentile(this.cpu, 0.95).toFixed(2),
        gpuP95: this.gpu.length
          ? percentile(this.gpu, 0.95).toFixed(2)
          : "unavailable",
        geometries: String(info.memory.geometries),
        textures: String(info.memory.textures),
        effectsAllocated: String(effectPool.allocated),
        effectsActive: String(effectPool.active.length),
      });
  }
}
