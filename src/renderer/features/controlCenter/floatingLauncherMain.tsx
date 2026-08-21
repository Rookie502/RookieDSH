import { createRoot } from 'react-dom/client';
import FloatingLauncher from './FloatingLauncher';
import './floatingLauncher.css';

const container = document.getElementById('root');
if (!container) throw new Error('#root not found');

createRoot(container).render(<FloatingLauncher />);
