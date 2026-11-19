// Change an instance image: pick any image and frame it as a square (drag to
// reposition, slider to zoom). It keeps its full resolution: a square image
// left as it is is saved untouched (same file, same format), anything else is
// cut at the photo's own pixel size and saved as lossless PNG.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal } from '../components/Modal.jsx';
import { Button, Slider, Pills } from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';
import { t } from '../lib/i18n.js';
import { readFileAsDataUrl } from '../lib/skin.js';

const VIEW = 320;
const MAX_OUT = 8192; // biggest square saved (64 megapixels)
const KEEP_AS_IS = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

export default function ImageDialog({ title, current, onResolve, allowReset = true }) {
  const [img, setImg] = useState(null);
  const [file, setFile] = useState(null);
  const [mode, setMode] = useState('cover');
  const [zoom, setZoom] = useState(1);
  const [off, setOff] = useState({ x: 0, y: 0 });
  const [bg, setBg] = useState('#202020');
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef(null);
  const canvasRef = useRef(null);
  const drag = useRef(null);

  const load = useCallback(async (file) => {
    if (!file || !file.type.startsWith('image/')) return;
    const url = await readFileAsDataUrl(file);
    const im = new Image();
    im.onload = () => {
      setImg(im);
      setFile(file);
      setZoom(1);
      setOff({ x: 0, y: 0 });
    };
    im.src = url;
  }, []);

  // base scale so that the image covers / fits the square
  const baseScale = (size) => {
    if (!img) return 1;
    return mode === 'cover' ? Math.max(size / img.width, size / img.height) : Math.min(size / img.width, size / img.height);
  };

  const draw = useCallback(
    (ctx, size) => {
      ctx.clearRect(0, 0, size, size);
      if (mode === 'contain') {
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, size, size);
      }
      if (!img) return;
      const s = baseScale(size) * zoom;
      const w = img.width * s;
      const h = img.height * s;
      const k = size / VIEW;
      ctx.imageSmoothingQuality = 'high';
      ctx.imageSmoothingEnabled = !(img.width <= 64 && img.height <= 64);
      ctx.drawImage(img, (size - w) / 2 + off.x * k, (size - h) / 2 + off.y * k, w, h);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [img, zoom, off, mode, bg],
  );

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    draw(cv.getContext('2d'), VIEW);
  }, [draw]);

  // keep the image covering the square while panning
  const clampOffset = (o) => {
    if (!img || mode !== 'cover') return o;
    const s = baseScale(VIEW) * zoom;
    const maxX = Math.max(0, (img.width * s - VIEW) / 2);
    const maxY = Math.max(0, (img.height * s - VIEW) / 2);
    return { x: Math.max(-maxX, Math.min(maxX, o.x)), y: Math.max(-maxY, Math.min(maxY, o.y)) };
  };

  // The square that is visible, measured in the photo's own pixels
  const outputSize = () => {
    if (!img) return 0;
    const side = mode === 'cover' ? Math.min(img.width, img.height) : Math.max(img.width, img.height);
    let out = Math.round(side / zoom);
    // tiny pixel art gets sharp, bigger pixels instead of a blurry stamp
    if (img.width <= 64 && img.height <= 64) out = Math.max(out, 512);
    return Math.max(16, Math.min(MAX_OUT, out));
  };

  const untouched = () => img && file && KEEP_AS_IS.includes(file.type) && img.width === img.height && zoom === 1 && off.x === 0 && off.y === 0 && img.width <= MAX_OUT;

  const save = async () => {
    if (untouched()) {
      onResolve({ png: new Uint8Array(await file.arrayBuffer()) });
      return;
    }
    const size = outputSize();
    const cv = document.createElement('canvas');
    cv.width = size;
    cv.height = size;
    draw(cv.getContext('2d', { willReadFrequently: true }), size);
    cv.toBlob(async (blob) => {
      const buf = new Uint8Array(await blob.arrayBuffer());
      onResolve({ png: buf });
    }, 'image/png');
  };

  return (
    <Modal
      title={title || t('Subir imagen')}
      icon="image"
      onClose={() => onResolve(null)}
      width={620}
      footer={
        <>
          {allowReset && current ? (
            <Button variant="ghost" icon="trash" onClick={() => onResolve({ reset: true })}>
              {t('Quitar imagen')}
            </Button>
          ) : null}
          <span className="spacer" />
          <Button variant="ghost" onClick={() => onResolve(null)}>
            {t('Cancelar')}
          </Button>
          <Button variant="primary" disabled={!img} onClick={save}>
            {t('Guardar')}
          </Button>
        </>
      }
    >
      <div className="cropper">
        <div
          className={`cropper-view ${dragOver ? 'drag' : ''} ${img ? 'has-img' : ''}`}
          style={{ width: VIEW, height: VIEW }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            load(e.dataTransfer.files[0]);
          }}
          onMouseDown={(e) => {
            if (!img) return fileRef.current.click();
            drag.current = { x: e.clientX, y: e.clientY, ox: off.x, oy: off.y };
            const move = (ev) => setOff(clampOffset({ x: drag.current.ox + ev.clientX - drag.current.x, y: drag.current.oy + ev.clientY - drag.current.y }));
            const up = () => {
              window.removeEventListener('mousemove', move);
              window.removeEventListener('mouseup', up);
            };
            window.addEventListener('mousemove', move);
            window.addEventListener('mouseup', up);
          }}
          onWheel={(e) => img && setZoom((z) => Math.max(1, Math.min(4, z - e.deltaY * 0.001)))}
        >
          <canvas ref={canvasRef} width={VIEW} height={VIEW} />
          {!img ? (
            current ? (
              <img src={current} alt="" className="cropper-current" />
            ) : (
              <div className="cropper-empty">
                <Icon name="image" size={46} stroke={1.4} />
                <span>{t('Arrastra una imagen aquí o haz clic para elegirla')}</span>
              </div>
            )
          ) : null}
        </div>
        <div className="cropper-side">
          <Button icon="folderOpen" onClick={() => fileRef.current.click()}>
            {t('Elegir imagen…')}
          </Button>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/bmp" className="hidden-input" onChange={(e) => load(e.target.files[0])} />
          <div className="stack">
            <span className="label">{t('Ajuste')}</span>
            <Pills
              value={mode}
              onChange={(m) => {
                setMode(m);
                setOff({ x: 0, y: 0 });
              }}
              options={[
                { value: 'cover', label: t('Recortar') },
                { value: 'contain', label: t('Encajar') },
              ]}
            />
          </div>
          <div className="stack">
            <span className="label">{t('Zoom')}</span>
            <Slider value={zoom} min={1} max={4} step={0.01} showValue={false} onChange={(z) => (setZoom(z), setOff((o) => clampOffset(o)))} disabled={!img} />
          </div>
          {mode === 'contain' ? (
            <div className="stack">
              <span className="label">{t('Color de fondo')}</span>
              <input type="color" value={bg} onChange={(e) => setBg(e.target.value)} className="color-native" />
            </div>
          ) : null}
          <p className="muted small">
            {img ? t('Se guarda en {w}×{h}, con la calidad original de la imagen.', { w: outputSize(), h: outputSize() }) : t('La imagen se guarda con su resolución original, sin comprimir.')}
          </p>
        </div>
      </div>
    </Modal>
  );
}
