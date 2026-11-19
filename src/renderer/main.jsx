import { createRoot } from 'react-dom/client';
import '@fontsource/lato/400.css';
import '@fontsource/lato/700.css';
import '@fontsource/lato/900.css';
import '@fontsource/roboto-mono/400.css';
import '@fontsource/montserrat/400.css';
import '@fontsource/montserrat/500.css';
import '@fontsource/montserrat/600.css';
import './styles/base.css';
import './styles/components.css';
import './styles/pages.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/inter/800.css';
import './modrinth/mr.css';
import App from './App.jsx';
import { installInputGuard } from './lib/inputGuard.js';

installInputGuard();

createRoot(document.getElementById('root')).render(<App />);
