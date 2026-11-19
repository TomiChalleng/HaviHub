// Icon editor: build an instance icon from a background color and a symbol.
// Left: the preview at three sizes, "Aleatorio" and the recent icons.
// Right: the backgrounds (one scrolling row) and the symbols (blocks, objects
// and items, one grid each). Resolves { recipe } or null.
import { Fragment, useEffect, useRef, useState } from 'react';
import { Modal } from '../components/Modal.jsx';
import { Button } from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';
import { GeneratedIcon } from '../components/InstanceImage.jsx';
import { BACKGROUNDS, SYMBOL_GROUPS, symbolList, symbolUrl, symbolName, parseRecipe, randomRecipe, recipeKey, pushRecent } from '../lib/instance-icons.js';
import { useMcTextures } from '../lib/mc-textures.js';
import { t, getLanguage } from '../lib/i18n.js';
import { useApp } from '../lib/store.jsx';

function Check() {
  return (
    <span className="ie-check" aria-hidden="true">
      <Icon name="check" size={13} stroke={3} />
    </span>
  );
}

export default function IconEditorDialog({ current, onResolve, allowUpload = false }) {
  const app = useApp();
  const [recipe, setRecipe] = useState(() => current || randomRecipe());
  const recents = (app.config.iconRecents || []).map(parseRecipe).filter(Boolean);
  const bgRow = useRef(null);
  const lang = getLanguage();
  useMcTextures();
  const symbols = symbolList();

  // the selected background scrolls into view when the dialog opens
  useEffect(() => {
    const el = bgRow.current && bgRow.current.querySelector('.ie-bg.on');
    if (el) el.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, []);

  const save = async () => {
    await app.updateConfig({ iconRecents: pushRecent(app.config.iconRecents, recipe) });
    onResolve({ recipe });
  };

  return (
    <Modal
      title={t('Editor de ícono')}
      onClose={() => onResolve(null)}
      width={732}
      className="icon-editor"
      footer={
        <>
          {allowUpload ? (
            <Button variant="secondary" icon="upload" className="ie-upload" onClick={() => onResolve({ upload: true })}>
              {t('Usar una imagen propia…')}
            </Button>
          ) : null}
          <span className="ie-tip">
            <Icon name="info" size={18} />
            {allowUpload ? t('Combina un fondo y un símbolo, o usa una imagen tuya.') : t('Combina un fondo y un símbolo para crear tu ícono.')}
          </span>
          <Button variant="secondary" icon="x" onClick={() => onResolve(null)}>
            {t('Cancelar')}
          </Button>
          <Button variant="primary" icon="save" onClick={save}>
            {t('Guardar ícono')}
          </Button>
        </>
      }
    >
      <div className="ie">
        <aside className="ie-side">
          <div className="ie-preview">
            <GeneratedIcon recipe={recipe} className="ie-big" alt={t('Vista previa del ícono')} />
            <div className="ie-sizes">
              <GeneratedIcon recipe={recipe} className="ie-s32" />
              <GeneratedIcon recipe={recipe} className="ie-s24" />
              <GeneratedIcon recipe={recipe} className="ie-s16" />
            </div>
          </div>
          <Button variant="secondary" icon="refresh" className="ie-random" onClick={() => setRecipe((r) => randomRecipe(r))}>
            {t('Aleatorio')}
          </Button>
          {recents.length ? (
            <>
              <h3 className="ie-h">{t('Recientes')}</h3>
              <div className="ie-recents">
                {recents.map((r) => (
                  <button key={recipeKey(r)} className="ie-recent" title={`${symbolName(r.symbol, lang)}`} onClick={() => setRecipe(r)}>
                    <GeneratedIcon recipe={r} />
                  </button>
                ))}
              </div>
            </>
          ) : null}
        </aside>
        <div className="ie-main">
          <h3 className="ie-h">{t('Fondo')}</h3>
          <div
            className="ie-bgs"
            ref={bgRow}
            onWheel={(e) => {
              // a mouse wheel moves the row sideways
              if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) e.currentTarget.scrollLeft += e.deltaY;
            }}
          >
            {BACKGROUNDS.map((b) => {
              const on = b.id === recipe.bg;
              const name = lang === 'en' ? b.id[0].toUpperCase() + b.id.slice(1) : b.es;
              return (
                <button key={b.id} className={`ie-bg ${on ? 'on' : ''}`} style={{ backgroundImage: `linear-gradient(135deg, ${b.a}, ${b.b})` }} aria-pressed={on} aria-label={name} title={name} onClick={() => setRecipe((r) => ({ ...r, bg: b.id }))}>
                  {on ? <Check /> : null}
                </button>
              );
            })}
          </div>
          <hr className="ie-sep" />
          <h3 className="ie-h">{t('Símbolo')}</h3>
          {SYMBOL_GROUPS.map((g, i) => (
            <Fragment key={g}>
              {i ? <hr className="ie-sep ie-sep-in" /> : null}
              <div className="ie-symbols">
                {symbols.filter((s) => s.group === g).map((s) => {
                  const on = s.id === recipe.symbol;
                  const name = lang === 'en' ? s.en : s.es;
                  return (
                    <button key={s.id} className={`ie-sym ${on ? 'on' : ''}`} aria-pressed={on} aria-label={name} title={name} onClick={() => setRecipe((r) => ({ ...r, symbol: s.id }))}>
                      <img src={symbolUrl(s.id)} alt="" draggable={false} />
                      {on ? <Check /> : null}
                    </button>
                  );
                })}
              </div>
            </Fragment>
          ))}
        </div>
      </div>
    </Modal>
  );
}
