import assert from "node:assert/strict";
import { buildDeepReadingSystemPrompt, parseSummary, resolveSummaryOutputLanguage, validateSummaryOutputLanguage } from "../src/llm.js";

const vietnamese = `## Luận điểm cốt lõi
Quản lý tạo ra kết quả tập thể thông qua sự phối hợp rõ ràng giữa những người cùng làm việc.

## Bản đồ lập luận
1. **Luận điểm:** Hiệu quả quản lý được đo bằng kết quả của đội ngũ.
   - **Cơ sở:** Công việc cần sự phối hợp giữa nhiều người.
   - **Ví dụ:** Nhóm cùng hoàn thành một mục tiêu chung.
   - **Hàm ý:** Nhà quản lý cần phát triển năng lực tập thể.

## Giả định & giới hạn
- Phần đọc chưa mô tả mọi hoàn cảnh tổ chức.

## Khái niệm then chốt
- **Quản lý:** Khả năng tạo kết quả tốt từ sự phối hợp.

## Câu hỏi cho phần đọc tiếp theo
- Những thực hành nào giúp nhóm làm việc hiệu quả hơn?

## Ý chính
- Kết quả tập thể quan trọng hơn nỗ lực cá nhân.
- Mục tiêu rõ ràng giúp phối hợp tốt hơn.
- Năng lực nhóm cần được phát triển liên tục.

## Trích dẫn
"Công việc của nhà quản lý là tạo ra thành quả tốt nhất từ một nhóm người."`;

const english = `## Core argument
Management is measured by collective outcomes and coordinated work rather than personal effort.

## Argument map
1. **Claim:** Managers create team results.
   - **Support:** The reading explains coordination.
   - **Example:** A team completes a shared goal.
   - **Implication:** Leaders build capacity.

## Assumptions & limits
- The reading does not establish every context.

## Key concepts
- **Management:** Coordinated collective output.

## Questions to carry forward
- What practices support the team?

## Insights
- Team output matters.
- Clear goals improve work.
- Capacity develops over time.

## Quote
"Management creates results."`;

const prompt = buildDeepReadingSystemPrompt("vi");
assert.match(prompt, /VIETNAMESE-ONLY CONTRACT/);
assert.match(prompt, /## Luận điểm cốt lõi/);
assert.match(prompt, /## Ý chính/);
assert.doesNotMatch(prompt, /## Core argument/);
assert.equal(validateSummaryOutputLanguage(vietnamese, "vi").valid, true);
assert.equal(validateSummaryOutputLanguage(english, "vi").valid, false);
assert.equal(validateSummaryOutputLanguage(english, "en").valid, true);
assert.equal(resolveSummaryOutputLanguage("auto", vietnamese), "vi");
assert.equal(resolveSummaryOutputLanguage("auto", english), "en");
assert.equal(resolveSummaryOutputLanguage("vi", english), "vi");
assert.equal(resolveSummaryOutputLanguage("en", vietnamese), "en");
assert.equal(validateSummaryOutputLanguage(english, resolveSummaryOutputLanguage("auto", vietnamese)).valid, false);
assert.equal(validateSummaryOutputLanguage(vietnamese, resolveSummaryOutputLanguage("auto", vietnamese)).valid, true);
const parsed = parseSummary(vietnamese, "deep_reading");
assert.equal(parsed.key_insights.length, 3);
assert.equal(parsed.quote, "Công việc của nhà quản lý là tạo ra thành quả tốt nhất từ một nhóm người.");
assert.match(parsed.summary, /## Bản đồ lập luận/);
console.log("deep-reading language fixtures passed");
