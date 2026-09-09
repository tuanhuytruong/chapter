import fs from "node:fs";
const source = fs.readFileSync("src/pages/BookDetail.tsx", "utf8");
const expect = (value: boolean, message: string) => { if (!value) throw new Error(message); };
for (const component of ["JourneyView", "MindMap", "StoryThreadView", "BookWiki", "PodcastPanel", "ContextualUpgradeCard"]) {
  expect(source.includes(`const ${component} = React.lazy(`), `${component} must be dynamically imported`);
  expect(!source.includes(`import ${component} from`), `${component} must not be statically imported`);
}
expect(source.includes("BookDetailPanelFallback"), "lazy panels need an accessible fallback");
expect(source.includes("<React.Suspense"), "lazy panels need scoped Suspense boundaries");
console.log("BOOK_DETAIL_LAZY_PANELS_CONTRACT_OK");
