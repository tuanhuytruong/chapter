const {spawnSync}=require('node:child_process');
const fs=require('node:fs');
(async()=>{
 const {build}=await import('vite');
 await build({configFile:false,plugins:[(await import('@tailwindcss/vite')).default()],build:{outDir:'.nousa-fixture-dist',rollupOptions:{input:'scripts/nousa/fixture.html',output:{entryFileNames:'assets/fixture.js'}}}});
 fs.copyFileSync('.nousa-fixture-dist/scripts/nousa/fixture.html','.nousa-fixture-dist/fixture.html');
 const result=spawnSync(process.execPath,['scripts/nousa/browser-fixtures.cjs'],{stdio:'inherit',env:{...process.env,NOUSA_FIXTURE_DIST:'.nousa-fixture-dist'}});
 process.exitCode=result.status??1;
})().catch(e=>{console.error(e);process.exitCode=1});
