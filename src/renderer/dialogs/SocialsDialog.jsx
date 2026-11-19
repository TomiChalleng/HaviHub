// Whether Havikun's channels on the Home page load on their own, asked once to
// whoever updated from a version that didn't ask yet (a new installation is
// asked in the first-start welcome). Until it is answered, nothing loads.
import { useState } from 'react';
import { Modal } from '../components/Modal.jsx';
import { Button } from '../components/ui.jsx';
import { SocialChoice } from '../components/SocialChoice.jsx';
import { call } from '../lib/api.js';
import { t } from '../lib/i18n.js';

export default function SocialsDialog({ onResolve }) {
  const [choice, setChoice] = useState(true);
  return (
    <Modal
      title={t('Las redes de Havikun en Inicio')}
      icon="shield"
      width={640}
      closeOnBackdrop={false}
      onClose={null}
      className="close-behavior socials-ask"
      footer={
        <>
          <span className="muted small cb-note">{t('Puedes cambiarlo cuando quieras en Ajustes → Privacidad.')}</span>
          <Button variant="primary" onClick={() => onResolve(choice)}>
            {t('Guardar')}
          </Button>
        </>
      }
    >
      <p className="socials-ask-lead">{t('Havikun es quien hace Havi Hub. En Inicio vas a ver sus últimos videos de YouTube, si está en vivo en Twitch y sus links. Es una forma de apoyarlo sin pagar nada.')}</p>
      <SocialChoice value={choice} onChange={setChoice} />
      <p className="muted small socials-ask-note">
        {t('Para mostrarlas, Havi Hub se conecta a YouTube, Twitch y Linktree, que reciben tu dirección IP como cualquier página que visitas.')}{' '}
        <button className="link-btn" onClick={() => call('app.openExternal', 'https://havihub.github.io/privacy/')}>
          {t('Ver la política de privacidad')}
        </button>
      </p>
    </Modal>
  );
}
