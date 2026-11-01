export function createPolishedAssembly(positions, duration = 2.5) {
  const total = positions.length;
  const start = new Float32Array(total);
  const end = new Float32Array(positions);

  // Scatter start positions on sphere radius 6-8 (per spec v2 §3.3)
  for (let i = 0; i < total / 3; i++) {
    const i3 = i * 3;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = 6 + Math.random() * 2;
    start[i3] = r * Math.sin(phi) * Math.cos(theta);
    start[i3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    start[i3 + 2] = r * Math.cos(phi);
  }

  return {
    start,
    end,
    duration,
    elapsed: 0,
    playing: true,
    tick(dt) {
      if (!this.playing) return this.end;
      this.elapsed += dt;
      const t = Math.min(this.elapsed / this.duration, 1);

      // Cubic-out easing (per spec v2 §3.3)
      const eased = 1 - Math.pow(1 - t, 3);

      const current = new Float32Array(end.length);
      for (let i = 0; i < end.length / 3; i++) {
        const i3 = i * 3;
        // Staggered per particle
        const stagger = (i % 1000) / 1000 * 0.15;
        const finalT = Math.max(0, Math.min(1, eased - stagger));

        current[i3] = start[i3] + (end[i3] - start[i3]) * finalT;
        current[i3 + 1] = start[i3 + 1] + (end[i3 + 1] - start[i3 + 1]) * finalT;
        current[i3 + 2] = start[i3 + 2] + (end[i3 + 2] - start[i3 + 2]) * finalT;
      }

      if (t >= 1) {
        this.playing = false;
        if (this.onComplete) this.onComplete();
      }
      return current;
    },
    reset() {
      this.elapsed = 0;
      this.playing = true;
    }
  };
}
