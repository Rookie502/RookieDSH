import { createRoot } from 'react-dom/client';
import ControlCenter from './ControlCenter';
import './controlCenter.css';

const container = document.getElementById('root');
if (!container) throw new Error('#root not found');

createRoot(container).render(<ControlCenter />);
