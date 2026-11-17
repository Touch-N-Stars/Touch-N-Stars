export function histogramView(bins, { fullRange = false, logarithmic = false } = {}) {
  const counts = Array.from({ length: 256 }, (_, index) => {
    const value = Number(bins?.[index] ?? 0);
    return Number.isFinite(value) ? Math.max(0, value) : 0;
  });
  const first = counts.findIndex((value) => value > 0);
  let last = counts.length - 1;
  while (last >= 0 && counts[last] <= 0) last--;
  const padding = Math.max(2, Math.ceil((last - first + 1) * 0.08));
  const start = fullRange || first < 0 ? 0 : Math.max(0, first - padding);
  const end = fullRange || first < 0 ? 255 : Math.min(255, last + padding);
  const range = end - start + 1;
  const peak = Math.max(...counts);
  const scale = (count) => (logarithmic ? Math.log1p(count) : count);
  const maximum = scale(peak) || 1;
  const points = [];
  let area = 'M0,100';
  for (let index = start; index <= end; index++) {
    const x = ((index - start) / range) * 512;
    const right = ((index + 1 - start) / range) * 512;
    const y = 100 - (scale(counts[index]) / maximum) * 94;
    area += `L${x},${y}L${right},${y}`;
    points.push({ index, count: counts[index], x, right, y });
  }
  area += 'L512,100Z';
  return { start, end, peak, area, points, counts, empty: first < 0 };
}

export function histogramBinAt(fraction, view) {
  return Math.max(
    view.start,
    Math.min(
      view.end,
      view.start + Math.floor(Math.max(0, Math.min(1, fraction)) * (view.end - view.start + 1))
    )
  );
}
