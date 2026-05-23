import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { MessageSquareCode, X, Send, Bot, Sparkles, HelpCircle } from 'lucide-react';

export default function QuizBot() {
  const { token } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      sender: 'bot',
      text: "👋 Hello! I am **QuizBot AI**, your smart exam companion. I can explain complex syllabus concepts (like Closures, React State, or WebGL), clarify proctoring rules, or help you navigate certificates. What are we studying today?",
      time: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  
  const chatEndRef = useRef(null);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isTyping]);

  // Only render the chatbot if the user is authenticated/logged in
  if (!token) return null;

  const quickChips = [
    { label: '📜 Proctoring Rules', query: 'What are the proctoring and anti-cheat rules?' },
    { label: '💡 JS Closures', query: 'Can you explain JavaScript closures?' },
    { label: '🌐 React Three Fiber', query: 'What is React Three Fiber (R3F)?' },
    { label: '🏆 Certificates Guide', query: 'How do I download my certificate?' }
  ];

  const handleSend = (textToSend) => {
    const query = textToSend.trim();
    if (!query) return;

    // Add user message
    const userMsg = { sender: 'user', text: query, time: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    // Simulate AI response delay
    setTimeout(() => {
      let botResponse = "";
      const q = query.toLowerCase();

      if (q.includes('proctor') || q.includes('cheat') || q.includes('rule') || q.includes('strike') || q.includes('tabs')) {
        botResponse = `🛡️ **QuizPortal Proctoring & Anti-Cheat Rules:**\n\n1. **Tab-Switch Proctoring:** Leaving the exam screen or minimizing the window registers a **Cheating Strike**.\n2. **Strike Limit:** You are allowed a maximum of **2 strikes**.\n3. **Auto-Submit Action:** Upon the **3rd strike**, the system triggers an automatic force-submit. All answers are graded, and your exam sheet is permanently locked.\n4. **Audio Proctoring:** Surrounding sound decibels are actively analyzed. Ensure you are in a quiet room to avoid sound warnings!`;
      } else if (q.includes('closure') || q.includes('lexical') || q.includes('scope')) {
        botResponse = `💡 **JavaScript Closures Explained:**\n\nA closure is the combination of a function bundled together with references to its surrounding state (the **lexical environment**). In simple terms, a closure gives an inner function access to the outer function's variables even *after* the outer function has finished executing.\n\n**Example Code:**\n\`\`\`javascript\nfunction outer() {\n  const secret = "Passcode123";\n  return function inner() {\n    console.log(secret); // Accesses outer scope!\n  };\n}\nconst myFunc = outer();\nmyFunc(); // Prints "Passcode123"\n\`\`\``;
      } else if (q.includes('react') || q.includes('fiber') || q.includes('r3f') || q.includes('three') || q.includes('webgl') || q.includes('3d')) {
        botResponse = `🌐 **React Three Fiber & WebGL:**\n\n* **WebGL:** The browser's low-level hardware-accelerated drawing context used to render 3D scenes.\n* **Three.js:** The most popular JavaScript library used to simplify complex WebGL math.\n* **React Three Fiber (R3F):** A powerful React renderer that compiles standard JSX components (like \`<mesh>\` or \`<ambientLight>\`) directly into Three.js objects.\n\n*In this portal, R3F drives the interactive glowing 3D particle constellation background that shifts dynamically to track your mouse cursor movement!*`;
      } else if (q.includes('certificate') || q.includes('passed') || q.includes('download') || q.includes('60')) {
        botResponse = `🏆 **QuizPortal Certificates Download Guide:**\n\n1. **Threshold:** You must achieve a score of **60% or higher** on a published quiz.\n2. **Download Location:** Go to your **Student Dashboard**, click the **Attempt History** tab (2nd tab), and look at the far right **Actions** column.\n3. **Download Trigger:** Click the **"Certificate"** button. The server will dynamically compile an A4 Landscape vector PDF using the \`pdfkit\` engine and open it in a secure new tab!`;
      } else if (q.includes('NaN') || q.includes('typeof')) {
        botResponse = `🔢 **NaN typeof Paradox:**\n\nIn JavaScript, \`NaN\` stands for *"Not a Number"*. However, its standard data type evaluates to a number!\n\n\`\`\`javascript\nconsole.log(typeof NaN); // Returns "number"!\n\`\`\`\nThis is a standard JS specification anomaly that is frequently asked in full-stack developer interviews!`;
      } else if (q.includes('hello') || q.includes('hi') || q.includes('hey') || q.includes('who are you')) {
        botResponse = `👋 Hey there! I am **QuizBot AI**, your personal study coordinator. Ask me about **JavaScript closures, proctoring parameters, React 3D, or certificates**!`;
      } else {
        botResponse = `🤖 **QuizBot AI Response:**\n\nI understand your query! However, my core module is currently tuned to help you with **Portal Navigation, Proctoring Security Rules, and Computer Science concepts** (like Closures, React Three Fiber, or database structures).\n\nTry clicking one of the quick study chips below to see what I can explain!`;
      }

      setMessages(prev => [...prev, { sender: 'bot', text: botResponse, time: new Date() }]);
      setIsTyping(false);
    }, 900);
  };

  const renderText = (text) => {
    // Process markdown-like strong (**text**) and code (```code```)
    return text.split('\n').map((line, lIdx) => {
      // Inline code blocks
      let renderedLine = line;
      
      // Simple code block check
      if (renderedLine.startsWith('```')) {
        return (
          <pre key={lIdx} style={{ background: 'rgba(0,0,0,0.3)', padding: '8px', borderRadius: '6px', fontFamily: 'monospace', fontSize: '11px', overflowX: 'auto', margin: '6px 0', border: '1px solid rgba(255,255,255,0.05)', color: '#a5b4fc' }}>
            <code>{renderedLine.replace(/```[a-z]*/g, '')}</code>
          </pre>
        );
      }

      // Strong formatting replacement
      const strongRegex = /\*\*(.*?)\*\*/g;
      const parts = [];
      let lastIndex = 0;
      let match;
      
      while ((match = strongRegex.exec(renderedLine)) !== null) {
        if (match.index > lastIndex) {
          parts.push(renderedLine.substring(lastIndex, match.index));
        }
        parts.push(<strong key={match.index} style={{ color: 'white', fontWeight: '700' }}>{match[1]}</strong>);
        lastIndex = strongRegex.lastIndex;
      }
      
      if (lastIndex < renderedLine.length) {
        parts.push(renderedLine.substring(lastIndex));
      }

      return (
        <p key={lIdx} style={{ margin: '4px 0', lineHeight: '1.4' }}>
          {parts.length > 0 ? parts : renderedLine}
        </p>
      );
    });
  };

  return (
    <>
      {/* Floating Chat Trigger Button */}
      <button
        onClick={() => setIsOpen(prev => !prev)}
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '84px', // Placed side-by-side with theme toggle button!
          zIndex: 9999,
          background: 'var(--glass-bg)',
          border: '1px solid var(--glass-border)',
          borderRadius: '50%',
          width: '46px',
          height: '46px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: '0 8px 32px 0 var(--glass-shadow)',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          outline: 'none',
          color: 'var(--accent-primary)'
        }}
        title="Open QuizBot Study AI"
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.1) translateY(-2px)';
          e.currentTarget.style.borderColor = 'var(--accent-primary)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1) translateY(0)';
          e.currentTarget.style.borderColor = 'var(--glass-border)';
        }}
      >
        {isOpen ? (
          <X size={20} style={{ color: 'var(--accent-danger)' }} />
        ) : (
          <MessageSquareCode size={20} />
        )}
      </button>

      {/* Slide-out Chat Window Panel */}
      {isOpen && (
        <div
          className="glass-panel"
          style={{
            position: 'fixed',
            bottom: '82px',
            right: '24px',
            width: '380px',
            height: '480px',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 12px 40px 0 rgba(0, 0, 0, 0.55)',
            border: '1px solid var(--glass-border)',
            background: 'rgba(15, 23, 42, 0.88)',
            backdropFilter: 'blur(20px)'
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '16px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(168, 85, 247, 0.15))'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ padding: '6px', borderRadius: '8px', background: 'rgba(99,102,241,0.15)', color: 'var(--accent-primary)' }}>
                <Bot size={18} />
              </div>
              <div>
                <h4 style={{ fontSize: '14px', fontWeight: '800', color: 'white', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span>QuizBot AI</span>
                  <Sparkles size={11} style={{ color: '#EAB308' }} />
                </h4>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Online Study Companion</span>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Messages container */}
          <div
            style={{
              flex: 1,
              padding: '16px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}
          >
            {messages.map((msg, idx) => {
              const isBot = msg.sender === 'bot';
              return (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: isBot ? 'flex-start' : 'flex-end',
                    maxWidth: '85%',
                    alignSelf: isBot ? 'flex-start' : 'flex-end'
                  }}
                >
                  <div
                    style={{
                      padding: '10px 14px',
                      borderRadius: isBot ? '12px 12px 12px 2px' : '12px 12px 2px 12px',
                      background: isBot ? 'rgba(255,255,255,0.03)' : 'var(--accent-primary)',
                      border: isBot ? '1px solid var(--glass-border)' : 'none',
                      color: isBot ? 'var(--text-primary)' : 'white',
                      fontSize: '12.5px',
                      boxShadow: '0 4px 10px rgba(0,0,0,0.15)'
                    }}
                  >
                    {isBot ? renderText(msg.text) : msg.text}
                  </div>
                  <span style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '4px', padding: '0 4px' }}>
                    {msg.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              );
            })}

            {isTyping && (
              <div style={{ display: 'flex', gap: '4px', padding: '10px 14px', borderRadius: '12px 12px 12px 2px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)', alignSelf: 'flex-start', fontSize: '11px', color: 'var(--text-secondary)' }}>
                <span style={{ animation: 'bounce 1.4s infinite alternate', display: 'inline-block' }}>●</span>
                <span style={{ animation: 'bounce 1.4s infinite alternate 0.2s', display: 'inline-block' }}>●</span>
                <span style={{ animation: 'bounce 1.4s infinite alternate 0.4s', display: 'inline-block' }}>●</span>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Quick reply chips */}
          {messages.length === 1 && (
            <div style={{ padding: '0 16px 8px 16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <HelpCircle size={10} />
                <span>Quick Study Topics:</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {quickChips.map((chip, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSend(chip.query)}
                    style={{
                      padding: '5px 10px',
                      borderRadius: '14px',
                      border: '1px solid var(--glass-border)',
                      background: 'rgba(255,255,255,0.02)',
                      color: 'var(--text-secondary)',
                      fontSize: '10.5px',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      outline: 'none'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--accent-primary)';
                      e.currentTarget.style.color = 'white';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--glass-border)';
                      e.currentTarget.style.color = 'var(--text-secondary)';
                    }}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Message input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend(input);
            }}
            style={{
              padding: '12px 16px',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              gap: '8px',
              background: 'rgba(0,0,0,0.1)'
            }}
          >
            <input
              type="text"
              placeholder="Ask me a CS concept or rule..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              style={{
                flex: 1,
                padding: '8px 12px',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--glass-border)',
                borderRadius: '8px',
                color: 'white',
                fontSize: '12px',
                outline: 'none'
              }}
            />
            <button
              type="submit"
              style={{
                background: 'var(--accent-primary)',
                border: 'none',
                borderRadius: '8px',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'white',
                boxShadow: '0 4px 10px rgba(99, 102, 241, 0.3)'
              }}
            >
              <Send size={14} />
            </button>
          </form>

        </div>
      )}
    </>
  );
}
