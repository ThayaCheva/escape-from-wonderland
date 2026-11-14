import { createRoot } from 'react-dom/client';
import '@fontsource/im-fell-english-sc';
import '@fontsource/crimson-text/400.css';
import '@fontsource/crimson-text/600.css';
import './styles.css';
import { App } from './App';

createRoot(document.getElementById('root')!).render(<App />);
