import assert from 'node:assert/strict';
import {isNousaPreview,isPreviewRoute,internalPreviewDestination,originalUrl} from '../src/uiPreview';
const routes=['/','/today','/review','/books/fixture','/playbooks','/playbooks/fixture','/insights','/calendar','/momentum','/streaks','/achievements','/quotes','/profile','/account','/pricing','/help','/feedback'];
for(const pathname of routes){assert(isNousaPreview({hostname:'chapter-dev.srv.io.vn',pathname,search:'?uiPreview=nousa'}));for(const hostname of ['chapter.srv.io.vn','unknown'])assert(!isNousaPreview({hostname,pathname,search:'?uiPreview=nousa'}));assert(!isNousaPreview({hostname:'chapter-dev.srv.io.vn',pathname,search:''}));}
for(const pathname of ['/api/books','/login','/signup','/reset-password','/podcasts','/unknown'])assert(!isPreviewRoute(pathname));
assert.equal(originalUrl('/books/fixture','?view=podcast&uiPreview=nousa','#session'),'/books/fixture?view=podcast#session');
assert.deepEqual(internalPreviewDestination({pathname:'/today',search:'?activeBook=fixture',hash:'#a'},true),{pathname:'/today',search:'?activeBook=fixture&uiPreview=nousa',hash:'#a'});
assert.equal(internalPreviewDestination({pathname:'/',search:'?filter=paused&uiPreview=nousa'},false).search,'?filter=paused');
console.log('PASS 17 authenticated route gates, PRD exclusions, Original, destination filters/hash');
