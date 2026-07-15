import React, { useState } from 'react';
import { BookOpen, Sparkles, HelpCircle, ArrowRight, Loader2, BookCheck } from 'lucide-react';

interface AIAnalysisResult {
  analysis: string;
  discussionQuestions: string[];
  nextRead: {
    title: string;
    author: string;
    description: string;
  };
}

export default function AIAnalyzer() {
  const [bookTitle, setBookTitle] = useState('');
  const [bookAuthor, setBookAuthor] = useState('');
  const [summaryHook, setSummaryHook] = useState('');
  const [detailedNotes, setDetailedNotes] = useState('');
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AIAnalysisResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleAnalyzeReflection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookTitle || !summaryHook) return;

    setIsAnalyzing(true);
    setAnalysisResult(null);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/gemini/analyze-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: bookTitle,
          author: bookAuthor,
          summary: summaryHook,
          content: detailedNotes
        })
      });

      const data = await response.json();
      if (response.ok) {
        setAnalysisResult(data);
      } else {
        setErrorMessage(data.error || "Failed to analyze summary. Please check your GEMINI_API_KEY.");
      }
    } catch (err) {
      setErrorMessage("Could not connect to the analysis service. Please try again later.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-natural-border pb-5">
        <h2 id="ai-analyzer-heading" className="text-2xl font-serif italic text-natural-dark">AI Literary Critique</h2>
        <p className="text-sm text-natural-stone font-sans">Uncover hidden motifs, receive deep analytical feedback, and find your next perfect book companion.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Form Column */}
        <div className="lg:col-span-2">
          <form id="form-ai-analysis" onSubmit={handleAnalyzeReflection} className="p-6 bg-white border border-natural-border rounded-[32px] shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-natural-clay font-bold text-xs uppercase tracking-wider font-sans">
              <Sparkles className="w-4 h-4 text-natural-clay" />
              <span>Submit for critique</span>
            </div>

            <div>
              <label htmlFor="analysis-book-title" className="block text-[10px] font-bold text-natural-stone uppercase mb-1 tracking-wider font-sans">Book Title</label>
              <input
                id="analysis-book-title"
                type="text"
                required
                placeholder="e.g., Sapiens"
                value={bookTitle}
                onChange={(e) => setBookTitle(e.target.value)}
                className="w-full px-4 py-2.5 bg-natural-cream border border-natural-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-natural-sage focus:bg-white text-natural-dark font-sans"
              />
            </div>

            <div>
              <label htmlFor="analysis-book-author" className="block text-[10px] font-bold text-natural-stone uppercase mb-1 tracking-wider font-sans">Author Name</label>
              <input
                id="analysis-book-author"
                type="text"
                placeholder="e.g., Yuval Noah Harari"
                value={bookAuthor}
                onChange={(e) => setBookAuthor(e.target.value)}
                className="w-full px-4 py-2.5 bg-natural-cream border border-natural-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-natural-sage focus:bg-white text-natural-dark font-sans"
              />
            </div>

            <div>
              <label htmlFor="analysis-summary" className="block text-[10px] font-bold text-natural-stone uppercase mb-1 tracking-wider font-sans">Brief Summary / Core Takeaway</label>
              <input
                id="analysis-summary"
                type="text"
                required
                placeholder="e.g., Human species dominated through shared myths."
                value={summaryHook}
                onChange={(e) => setSummaryHook(e.target.value)}
                className="w-full px-4 py-2.5 bg-natural-cream border border-natural-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-natural-sage focus:bg-white text-natural-dark font-sans"
              />
            </div>

            <div>
              <label htmlFor="analysis-notes" className="block text-[10px] font-bold text-natural-stone uppercase mb-1 tracking-wider font-sans">Your detailed notes & questions</label>
              <textarea
                id="analysis-notes"
                placeholder="What did you find confusing? What surprised you? What are your critiques?"
                rows={4}
                value={detailedNotes}
                onChange={(e) => setDetailedNotes(e.target.value)}
                className="w-full px-4 py-2.5 bg-natural-cream border border-natural-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-natural-sage focus:bg-white text-natural-dark font-sans resize-none"
              />
            </div>

            <button
              id="btn-analyze-submit"
              type="submit"
              disabled={isAnalyzing}
              className="w-full flex items-center justify-center gap-2 px-5 py-3 font-semibold text-white bg-natural-sage hover:bg-natural-sage-dark rounded-xl transition shadow-sm disabled:bg-natural-stone/60 cursor-pointer"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analyzing reflection...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Analyze with Gemini
                </>
              )}
            </button>
          </form>
        </div>

        {/* Results Column */}
        <div className="lg:col-span-3 min-h-[300px]">
          {isAnalyzing && (
            <div id="analysis-loading-card" className="h-full flex flex-col items-center justify-center p-12 bg-white border border-natural-border rounded-[32px] text-center space-y-4 shadow-sm">
              <div className="relative">
                <Loader2 className="w-10 h-10 text-natural-sage animate-spin" />
                <Sparkles className="w-4 h-4 text-natural-clay absolute -top-1.5 -right-1.5 animate-bounce" />
              </div>
              <div>
                <h3 className="font-bold text-natural-dark font-sans">Reading Companion is thinking...</h3>
                <p className="text-xs text-natural-stone mt-1 max-w-sm font-sans">
                  Connecting your thoughts to classical literature, psychology, and historical critique to synthesize feedback.
                </p>
              </div>
            </div>
          )}

          {errorMessage && (
            <div id="analysis-error-card" className="p-5 bg-white border border-natural-clay/30 rounded-[32px] text-xs text-natural-clay space-y-2 font-sans">
              <span className="font-bold block">Error Analyzing Reflections</span>
              <p>{errorMessage}</p>
            </div>
          )}

          {!analysisResult && !isAnalyzing && !errorMessage && (
            <div id="analysis-instruction-card" className="h-full flex flex-col items-center justify-center p-12 bg-white border border-dashed border-natural-border/80 rounded-[32px] text-center shadow-xs">
              <BookOpen className="w-12 h-12 text-natural-stone/40 mb-3" />
              <h3 className="font-bold font-serif text-lg italic text-natural-dark">Awaiting your reflection</h3>
              <p className="text-xs text-natural-stone mt-2 max-w-xs font-sans leading-relaxed">
                Submit your summary and reading notes on the left. The AI companion will generate immediate critique, deep philosophical discussion questions, and a custom tailored next read.
              </p>
            </div>
          )}

          {analysisResult && (
            <div id="analysis-results-card" className="space-y-6 animate-fade-in">
              {/* Takeaway Evaluation */}
              <div className="p-6 bg-white border border-natural-border rounded-[32px] shadow-sm space-y-3">
                <div className="flex items-center gap-2 text-natural-clay">
                  <BookCheck className="w-5 h-5 text-natural-clay" />
                  <h3 className="font-bold text-natural-dark font-sans text-sm uppercase tracking-wide">Takeaway Critique</h3>
                </div>
                <p className="text-sm text-natural-muted leading-relaxed font-serif">
                  {analysisResult.analysis}
                </p>
              </div>

              {/* Philosophical Questions */}
              <div className="p-6 bg-natural-cream border border-natural-border/60 rounded-[32px] shadow-sm space-y-3">
                <div className="flex items-center gap-2 text-natural-dark">
                  <HelpCircle className="w-5 h-5 text-natural-clay" />
                  <h3 className="font-bold text-natural-dark font-sans text-sm uppercase tracking-wide">Ponderings & Questions</h3>
                </div>
                <p className="text-xs text-natural-stone font-sans">Reflect on these or bring them to the public discussion room!</p>
                <div className="space-y-3 pt-1">
                  {analysisResult.discussionQuestions.map((q, idx) => (
                    <div id={`question-item-${idx}`} key={idx} className="flex gap-3 bg-white p-4 border border-natural-border rounded-2xl shadow-2xs text-xs text-natural-muted leading-relaxed font-serif">
                      <span className="font-bold text-natural-clay">{idx + 1}.</span>
                      <span>{q}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Next Recommended Read */}
              <div className="p-6 bg-white border border-natural-border rounded-[32px] shadow-sm space-y-4">
                <div className="flex items-center gap-2 text-natural-clay">
                  <Sparkles className="w-5 h-5 text-natural-clay" />
                  <h3 className="font-bold text-natural-dark font-sans text-sm uppercase tracking-wide">Recommended Next Read</h3>
                </div>
                <div className="bg-natural-cream border border-natural-border/50 rounded-2xl p-5 flex gap-4">
                  <div className="flex-1 space-y-2 min-w-0">
                    <div>
                      <h4 className="font-bold text-sm text-natural-dark font-serif">{analysisResult.nextRead.title}</h4>
                      <p className="text-xs text-natural-stone font-sans italic">by {analysisResult.nextRead.author}</p>
                    </div>
                    <p className="text-xs text-natural-muted leading-relaxed font-serif">
                      {analysisResult.nextRead.description}
                    </p>
                  </div>
                  <div className="self-center">
                    <div className="p-2 bg-white border border-natural-border rounded-xl text-natural-clay shadow-xs">
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
