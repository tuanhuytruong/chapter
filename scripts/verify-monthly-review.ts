import { buildMonthlyReviewPrompt, hasReviewableMonthlySource, parseMonthlyReview, periodBoundsInAppTz } from "../src/monthlyReview.js";
const source=[{logId:"l",bookId:"b",bookTitle:"Book",date:"2026-08-01",session:1,summary:"A grounded idea.",insights:["Insight"],notes:null,quote:null,lens:null}];
if(periodBoundsInAppTz("2026-12").end!=="2027-01-01")throw new Error("period boundary failed");
if(!hasReviewableMonthlySource(source))throw new Error("source fixture failed");
if(!buildMonthlyReviewPrompt({periodKey:"2026-08",language:"en",source}).includes("Book"))throw new Error("prompt fixture failed");
const parsed=parseMonthlyReview(JSON.stringify({title:"August",opening:"A grounded month.",themes:[{title:"Theme",detail:"Detail",evidence:["Insight"]}],books:[{bookId:"b",title:"Book",sessions:1,contribution:"Contribution"}],carryForward:["Carry"],gentleNextStep:"Keep going."}),"en");
if(parsed.title!=="August"||parsed.outputLanguage!=="en")throw new Error("parser fixture failed"); console.log("MONTHLY_REVIEW_FIXTURES_OK");
