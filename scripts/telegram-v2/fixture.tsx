import React from 'react';
import {createRoot} from 'react-dom/client';
import TelegramSettings from '../../src/components/telegram/TelegramSettings';
import '../../src/index.css';
function Fixture(){const [owner,setOwner]=React.useState('synthetic-owner');return <main className="mx-auto max-w-2xl p-4"><button onClick={()=>setOwner(x=>x==='synthetic-owner'?'synthetic-other':'synthetic-owner')}>Switch fixture owner</button><TelegramSettings owner={owner}/></main>;}
createRoot(document.getElementById('root')!).render(<Fixture/>);
