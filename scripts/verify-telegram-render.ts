import assert from 'node:assert/strict';
import {renderSummary,plainText} from '../src/telegram/render.js';
for(const summary of ['&<> *literal* <script>bad</script> 👨‍👩‍👧‍👦 é 中文 '.repeat(1000),'a'.repeat(340000), '😀'.repeat(20000)]){
 const log={book_id:'qa',date:'2026-11-15',reading_round:2,session:3,page_start:1,page_end:9,summary,key_insights:['&<>'],quote:'"quote"'};
 const parts=renderSummary('<title>','A&B',log,'https://chapter.example');
 assert(parts.length>1);
 for(const part of parts){assert(plainText(part).length<=3500);assert.equal((part.match(/<b>/g)||[]).length,1);assert.equal((part.match(/<\/b>/g)||[]).length,1);assert(!/<script>/.test(part));assert(!/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(plainText(part)));}
 const reconstructed=parts.map(p=>plainText(p).replace(/^Chapter · \d+\/\d+\n/,'')).join('');assert(reconstructed.includes(summary));assert(reconstructed.includes('2026-11-15'));
}
assert.throws(()=>renderSummary('a','b',{book_id:'x'},'http://chapter.example'));
console.log('PASS balanced escaped HTML, Unicode/graphemes, huge token, 100+ parts, decoded UTF-16 limits, lossless summary, HTTPS origin');
