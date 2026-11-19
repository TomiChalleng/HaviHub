// Pictures without their transparent margins, so that pictures of different
// shapes (a block, a sapling, a rocket) come out the same size on screen.
import { useEffect, useState } from 'react';

const trimmedUrls = new Map();
function trimPicture(url) {
  let job = trimmedUrls.get(url);
  if (!job) {
    job = (async () => {
      const img = new Image();
      img.src = url;
      await img.decode();
      const N = 128;
      const cv = document.createElement('canvas');
      cv.width = N;
      cv.height = N;
      const ctx = cv.getContext('2d', { willReadFrequently: true });
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0, N, N);
      const d = ctx.getImageData(0, 0, N, N).data;
      let x0 = N, y0 = N, x1 = -1, y1 = -1;
      for (let y = 0; y < N; y++)
        for (let x = 0; x < N; x++)
          if (d[(y * N + x) * 4 + 3] > 24) {
            if (x < x0) x0 = x;
            if (x > x1) x1 = x;
            if (y < y0) y0 = y;
            if (y > y1) y1 = y;
          }
      if (x1 < 0) return url;
      const w = x1 - x0 + 1;
      const h = y1 - y0 + 1;
      const k = N / Math.max(w, h);
      const outCv = document.createElement('canvas');
      outCv.width = N;
      outCv.height = N;
      const o = outCv.getContext('2d', { willReadFrequently: true });
      o.imageSmoothingEnabled = false;
      o.drawImage(cv, x0, y0, w, h, (N - w * k) / 2, (N - h * k) / 2, w * k, h * k);
      return outCv.toDataURL('image/png');
    })().catch(() => url);
    trimmedUrls.set(url, job);
  }
  return job;
}
export function useTrimmed(url, on) {
  const [out, setOut] = useState(null);
  useEffect(() => {
    if (!on || !url) return undefined;
    let alive = true;
    setOut(null);
    trimPicture(url).then((u) => alive && setOut({ from: url, url: u }));
    return () => {
      alive = false;
    };
  }, [url, on]);
  return on && out && out.from === url ? out.url : null;
}
