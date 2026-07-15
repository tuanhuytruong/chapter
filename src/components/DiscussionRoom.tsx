import React, { useState, useEffect, useRef } from 'react';
import { Send, Sparkles, MessageSquare, BookOpen, AlertCircle, RefreshCw, Layers } from 'lucide-react';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  name?: string;
  content: string;
  timestamp: string;
}

const PERSONAS = [
  {
    id: "elena",
    name: "Elena Vance",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100",
    specialty: "Classics & Literary Theory",
    color: "border-natural-border bg-white text-natural-clay",
    bio: "Devoted to themes, structures, prose design, and narrative subtexts."
  },
  {
    id: "marcus",
    name: "Marcus Chen",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100",
    specialty: "Sci-Fi & Speculative Concepts",
    color: "border-natural-border bg-white text-natural-clay",
    bio: "Obsessed with complex world-building, futurology, and space travel logic."
  },
  {
    id: "sophie",
    name: "Sophie Dubois",
    avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100",
    specialty: "Wellness & Self-Improvement",
    color: "border-natural-border bg-white text-natural-clay",
    bio: "Believer in books as emotional self-care, personal transformation, and mindfulness."
  }
];

export default function DiscussionRoom() {
  const [selectedPersonaId, setSelectedPersonaId] = useState('elena');
  const [bookContext, setBookContext] = useState('Atomic Habits');
  const [messages, setMessages] = useState<{ [personaId: string]: ChatMessage[] }>({
    elena: [
      {
        id: "m-1",
        role: "assistant",
        name: "Elena Vance",
        content: "Hello! I am absolutely delighted to discuss books with you. What are your thoughts on Atomic Habits? How does Clear's structured narrative style affect your reading pace?",
        timestamp: "Just now"
      }
    ],
    marcus: [
      {
        id: "m-2",
        role: "assistant",
        name: "Marcus Chen",
        content: "Hey there! Ready to break down Atomic Habits? Clear's systems-based approach to habits is basically programming for the human operating system. What parts did you find most logical?",
        timestamp: "Just now"
      }
    ],
    sophie: [
      {
        id: "m-3",
        role: "assistant",
        name: "Sophie Dubois",
        content: "Hi dear! I am so warm and excited to chat about Atomic Habits with you. This book has such beautiful guidelines on treating ourselves gently while growing. What stood out to you?",
        timestamp: "Just now"
      }
    ]
  });

  const [inputVal, setInputVal] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Auto scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, selectedPersonaId, isSending]);

  const activePersona = PERSONAS.find(p => p.id === selectedPersonaId) || PERSONAS[0];
  const activeMessages = messages[selectedPersonaId] || [];

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputVal.trim() || isSending) return;

    const userText = inputVal.trim();
    setInputVal('');
    setErrorMessage(null);

    // Create user message
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: userText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    // Append user message to active persona's message list
    const currentHistory = [...activeMessages, userMessage];
    setMessages(prev => ({
      ...prev,
      [selectedPersonaId]: currentHistory
    }));

    setIsSending(true);

    try {
      // Send to Express server proxy for Gemini evaluation
      const response = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: currentHistory.map(m => ({
            role: m.role,
            content: m.content,
            name: m.role === 'assistant' ? activePersona.name : undefined
          })),
          bookTitle: bookContext,
          personaId: selectedPersonaId
        })
      });

      const data = await response.json();
      if (response.ok) {
        const assistantMessage: ChatMessage = {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          name: data.name,
          content: data.content,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        setMessages(prev => ({
          ...prev,
          [selectedPersonaId]: [...currentHistory, assistantMessage]
        }));
      } else {
        setErrorMessage(data.error || "Failed to fetch response. Make sure GEMINI_API_KEY is configured.");
      }
    } catch (err) {
      setErrorMessage("Could not reach the AI book club server.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-6 h-full flex flex-col">
      {/* Header */}
      <div className="border-b border-natural-border pb-5">
        <h2 id="discussion-room-heading" className="text-2xl font-serif italic text-natural-dark">Discussion Salon</h2>
        <p className="text-sm text-natural-stone font-sans">Hop into 1-on-1 deep dives with specialized book critics or ask literature questions.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1 min-h-[500px]">
        {/* Companion Sidebar */}
        <div id="companions-sidebar" className="space-y-4 lg:col-span-1">
          <div className="bg-white border border-natural-border rounded-[32px] p-5 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-natural-stone uppercase tracking-wider flex items-center gap-1.5 font-sans">
              <Layers className="w-4 h-4 text-natural-clay" />
              <span>Literary Companions</span>
            </h3>

            <div className="space-y-2.5">
              {PERSONAS.map((p) => {
                const isActive = p.id === selectedPersonaId;
                return (
                  <button
                    id={`btn-select-persona-${p.id}`}
                    key={p.id}
                    onClick={() => {
                      setSelectedPersonaId(p.id);
                      setErrorMessage(null);
                    }}
                    className={`w-full text-left p-3 rounded-2xl border transition-all duration-150 flex items-center gap-3 cursor-pointer ${
                      isActive
                        ? 'border-natural-clay/60 bg-natural-cream shadow-xs'
                        : 'border-natural-border hover:border-natural-clay/30 bg-white'
                    }`}
                  >
                    <img
                      referrerPolicy="no-referrer"
                      src={p.avatar}
                      alt={p.name}
                      className="w-9 h-9 rounded-full object-cover border border-natural-border"
                    />
                    <div className="min-w-0 flex-1">
                      <span className="block text-xs font-bold text-natural-dark font-sans">{p.name}</span>
                      <span className="block text-[10px] text-natural-stone truncate font-sans">{p.specialty}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Discussion Context Card */}
          <div className="bg-white border border-natural-border rounded-[32px] p-5 shadow-sm space-y-3">
            <h3 className="text-xs font-bold text-natural-stone uppercase tracking-wider flex items-center gap-1.5 font-sans">
              <BookOpen className="w-3.5 h-3.5 text-natural-clay" />
              <span>Focus Book Context</span>
            </h3>
            <input
              id="input-book-context"
              type="text"
              placeholder="e.g., Atomic Habits"
              value={bookContext}
              onChange={(e) => setBookContext(e.target.value)}
              className="w-full px-3 py-2 bg-natural-cream border border-natural-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-natural-sage focus:bg-white text-natural-dark font-sans"
            />
            <p className="text-[10px] text-natural-stone leading-normal font-sans">
              Changing this sets the topic of discussion. AI companions will tailor their analytical styles and examples to this book.
            </p>
          </div>
        </div>

        {/* Chat Area */}
        <div className="lg:col-span-3 flex flex-col bg-white border border-natural-border rounded-[32px] shadow-sm overflow-hidden h-[500px]">
          {/* Companion header info */}
          <div className="p-4 border-b border-natural-border bg-natural-cream/50 flex items-center gap-3">
            <img
              referrerPolicy="no-referrer"
              src={activePersona.avatar}
              alt={activePersona.name}
              className="w-10 h-10 rounded-full border border-natural-border object-cover"
            />
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="text-sm font-bold text-natural-dark font-sans">{activePersona.name}</h3>
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${activePersona.color} font-sans`}>
                  {activePersona.specialty}
                </span>
              </div>
              <p className="text-[11px] text-natural-stone italic line-clamp-1 mt-0.5 font-sans">
                {activePersona.bio}
              </p>
            </div>
          </div>

          {/* Messages list */}
          <div id="messages-container" className="flex-1 overflow-y-auto p-5 space-y-4 bg-white">
            {activeMessages.map((msg) => {
              const isAI = msg.role === 'assistant';
              return (
                <div
                  id={`chat-bubble-${msg.id}`}
                  key={msg.id}
                  className={`flex gap-3 max-w-[85%] ${isAI ? 'mr-auto' : 'ml-auto flex-row-reverse'}`}
                >
                  {isAI && (
                    <img
                      referrerPolicy="no-referrer"
                      src={activePersona.avatar}
                      className="w-8 h-8 rounded-full object-cover border border-natural-border flex-shrink-0"
                      alt={activePersona.name}
                    />
                  )}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-[10px] text-natural-stone font-sans">
                      <span className="font-bold text-natural-dark">{isAI ? activePersona.name : 'You'}</span>
                      <span>• {msg.timestamp}</span>
                    </div>
                    <div className={`p-4 rounded-2xl text-xs leading-relaxed font-serif whitespace-pre-wrap ${
                      isAI
                        ? 'bg-natural-cream text-natural-muted border border-natural-border/30 rounded-tl-none'
                        : 'bg-natural-sage text-white rounded-tr-none shadow-xs'
                    }`}>
                      {msg.content}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Loading / Typing indicator */}
            {isSending && (
              <div className="flex gap-3 max-w-[85%] mr-auto items-center">
                <img
                  referrerPolicy="no-referrer"
                  src={activePersona.avatar}
                  className="w-8 h-8 rounded-full object-cover border border-natural-border flex-shrink-0 animate-pulse"
                  alt={activePersona.name}
                />
                <div className="space-y-1">
                  <span className="text-[10px] text-natural-stone font-sans">{activePersona.name} is formulating a response...</span>
                  <div className="flex items-center gap-1.5 p-4 bg-natural-cream border border-natural-border/30 text-natural-stone rounded-2xl rounded-tl-none shadow-2xs">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-natural-clay" />
                    <span className="text-xs font-sans">Crafting insights...</span>
                  </div>
                </div>
              </div>
            )}

            {errorMessage && (
              <div id="chat-error-card" className="p-4 bg-white border border-natural-clay/30 rounded-2xl text-xs text-natural-clay flex items-center gap-2 max-w-md mx-auto font-sans">
                <AlertCircle className="w-4 h-4 text-natural-clay flex-shrink-0" />
                <div>
                  <span className="font-bold">Error connecting discussion.</span>
                  <p className="mt-0.5 text-[11px]">{errorMessage}</p>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Form input */}
          <form id="chat-input-form" onSubmit={handleSendMessage} className="p-4 border-t border-natural-border flex gap-2 bg-white">
            <input
              id="input-chat-text"
              type="text"
              placeholder={`Message ${activePersona.name} regarding "${bookContext}"...`}
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              disabled={isSending}
              className="flex-1 px-4 py-2.5 bg-natural-cream border border-natural-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-natural-sage focus:bg-white text-natural-dark font-sans"
            />
            <button
              id="btn-send-chat"
              type="submit"
              disabled={!inputVal.trim() || isSending}
              className="px-4 py-2 bg-natural-sage hover:bg-natural-sage-dark disabled:bg-natural-stone text-white rounded-xl transition flex items-center justify-center cursor-pointer font-bold"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
