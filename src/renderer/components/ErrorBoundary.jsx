// Keeps a crash inside one page from taking down the whole app.
import { Component } from 'react';
import Icon from './Icon.jsx';
import { t } from '../lib/i18n.js';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('UI error', error, info && info.componentStack);
  }

  componentDidUpdate(prev) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(this.state.error);
    return (
      <div className="page">
        <div className="empty">
          <Icon name="alert" size={44} />
          <h3>{t('Algo salió mal en esta sección')}</h3>
          <p className="selectable">{String(this.state.error && this.state.error.message)}</p>
          <button className="btn btn-secondary btn-md" onClick={() => this.setState({ error: null })}>
            {t('Reintentar')}
          </button>
        </div>
      </div>
    );
  }
}
