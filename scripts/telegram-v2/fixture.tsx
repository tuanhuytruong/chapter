import React from 'react';
import {createRoot} from 'react-dom/client';
import TelegramSettings from '../../src/components/telegram/TelegramSettings';
import '../../src/index.css';
createRoot(document.getElementById('root')!).render(<main className="mx-auto max-w-2xl p-4"><TelegramSettings owner="synthetic-owner"/></main>);
