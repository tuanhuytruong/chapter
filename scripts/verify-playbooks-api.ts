import fs from "node:fs"; import path from "node:path";
const root=path.resolve(import.meta.dirname,".."); const read=(p:string)=>fs.readFileSync(path.join(root,p),"utf8");
const repo=read("src/referenceCardRepository.ts"), route=read("src/routes/playbooks.ts"), cards=read("src/referenceCards.ts"), server=read("server.ts"), books=read("src/routes/books.ts"), search=read("src/librarySearch.ts");
for(const token of ["owner_id=$1","FOR UPDATE","Resume this book to change or use its cards.","ON CONFLICT(owner_id,request_key)","reference_card","sourceExcerpt must match the saved session exactly"]) if(!repo.includes(token)&&!route.includes(token))throw new Error(`missing API guard: ${token}`);
for(const token of ["playbooksRouter","/api/playbooks","extractReferenceCardDraft","callLLM","sourceExcerptMatches"]) if(!route.includes(token)&&!server.includes(token)&&!cards.includes(token))throw new Error(`missing API contract: ${token}`);
if(!search.includes("reference_card"))throw new Error("library search kind missing");
if(!books.includes('"reference"')||!books.includes('reading_experience must be analytical, story, or reference'))throw new Error("reference book creation contract missing");
if(!books.includes('else if (result.readingExperience === "analytical")'))throw new Error("three-way enrichment guard missing");
console.log("PLAYBOOK_API_FIXTURES_OK");
