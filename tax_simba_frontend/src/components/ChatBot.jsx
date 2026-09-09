import React, { useEffect, useState, useRef } from 'react';
import { MessageCircle, X, Send, User, Loader2, Info, Check, CheckCheck, Volume2, VolumeX } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { useSession } from 'next-auth/react';
import { usePathname, useRouter } from 'next/navigation';
import './ChatBot.css';

const DEFAULT_ACTIONS = [
    { label: "Crypto Tax", query: "I need help with Crypto Tax", icon: "🪙" },
    { label: "Self-Assessment", query: "I need help with Self-Assessment", icon: "📝" },
    { label: "Capital Gains", query: "I have questions about Capital Gains", icon: "📈" },
    { label: "Rental Income", query: "How do I handle Rental Income tax?", icon: "🏠" },
    { label: "CIS", query: "Tell me about CIS (Construction Industry Scheme)", icon: "🏗️" },
    { label: "HMRC Penalties", query: "I've received an HMRC Penalty", icon: "⚠️" },
    { label: "Offshore Income", query: "I have Offshore Income to declare", icon: "🌐" },
    { label: "MTD", query: "What is MTD (Making Tax Digital)?", icon: "💻" }
];

const PAGE_SPECIFIC_ACTIONS = {
    '/register': [
        { label: "Accountant Review", query: "Tell me about the accountant review process." },
        { label: "Security & GDPR", query: "How do you protect my tax data?" },
        { label: "Filing Process", query: "How does the filing process work?" }
    ],
    '/calculators': [
        { label: "Salary Calculator", query: "How do I use the salary calculator?" },
        { label: "Dividend Tax", query: "Can you help me calculate dividend tax?" },
        { label: "Income Tax Tool", query: "Tell me about the income tax calculator." }
    ],
    '/tax-filing': [
        { label: "Filing Deadline", query: "When is the deadline for self-assessment?" },
        { label: "Required Documents", query: "What documents do I need for tax filing?" },
        { label: "Online Submission", query: "How do I submit my tax return online?" }
    ],
    '/contact-us': [
        { label: "Book a Call", query: "How can I book a call with a consultant?" },
        { label: "Office Location", query: "Where is your office located?" },
        { label: "Business Hours", query: "What are your business hours?" }
    ],
    '/about-us': [
        { label: "Who are you?", query: "How can this chatbot help me?" },
        { label: "Team Expertise", query: "What is the team's expertise in UK tax?" }
    ]
};

const HUMAN_AGENTS = [
    { name: 'Sarah from Taxsimba', avatar: '/images/sarah-avatar.png' },
    { name: 'Emily from Taxsimba', avatar: '/images/sarah-avatar.png' },
    { name: 'Sophie from Taxsimba', avatar: '/images/sarah-avatar.png' },
    { name: 'Chloe from Taxsimba', avatar: '/images/sarah-avatar.png' },
    { name: 'Olivia from Taxsimba', avatar: '/images/sarah-avatar.png' }
];

const NOTIFICATION_SOUND_URL = 'https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3';

export default function ChatBot() {
    const { data: session } = useSession();
    const prevSessionRef = useRef(session);
    const pathname = usePathname();
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);
    const [showNudge, setShowNudge] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [agent, setAgent] = useState({ 
        name: 'Taxsimba Support', 
        avatar: null, // null means show "TS"
        status: 'Active'
    });

    // Get a dynamic greeting based on the time of day and user session
    const getTimeBasedGreeting = () => {
        const hour = new Date().getHours();
        const userName = session?.user?.firstName || session?.user?.name || "";
        const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

        if (pathname === '/register') {
            return `Need help with your Taxsimba registration? I'm here to assist you!`;
        }

        if (userName) {
            return `${greeting}, ${userName}! Welcome back to Taxsimba.`;
        }
        return `${greeting}! I'm part of the Taxsimba support team.`;
    };

    const [messages, setMessages] = useState([]);
    const [visibleTimestamps, setVisibleTimestamps] = useState({});
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef(null);

    const toggleTimestamp = (idx) => {
        setVisibleTimestamps(prev => ({
            ...prev,
            [idx]: !prev[idx]
        }));
    };

    // Storage key helper
    const getStorageKey = () => session?.user?.email ? `taxsimba_chat_history_${session.user.email}` : 'taxsimba_chat_history_guest';

    // Load history on mount or session change
    useEffect(() => {
        const key = getStorageKey();
        const savedHistory = localStorage.getItem(key);
        if (savedHistory) {
            try {
                setMessages(JSON.parse(savedHistory));
            } catch (e) {
                console.error("Failed to parse chat history", e);
            }
        } else {
            setMessages([
                {
                    role: 'assistant',
                    senderName: 'Taxsimba Support',
                    senderAvatar: null,
                    content: `Hi! I'm your Taxsimba Assistant. I can help guide you through your UK tax questions and get you started with our specialist-led review. What can we help you with today?`,
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    status: 'seen',
                    isInitial: true
                }
            ]);
        }

        // Initializing mute state
        const savedMute = localStorage.getItem('taxsimba_chat_muted');
        if (savedMute) setIsMuted(savedMute === 'true');
    }, [session]);

    // Save history on change
    useEffect(() => {
        if (messages.length > 0) {
            const key = getStorageKey();
            localStorage.setItem(key, JSON.stringify(messages));
        }
    }, [messages, session]);

    // Clear chat history on logout cleanup
    useEffect(() => {
        if (prevSessionRef.current && !session) {
            localStorage.removeItem('taxsimba_chat_history_guest');
            sessionStorage.removeItem('taxsimba_chat_interacted');
        }
        prevSessionRef.current = session;
    }, [session]);

    // Proactive Nudge logic
    useEffect(() => {
        if (!isOpen && pathname === '/') {
            const timer = setTimeout(() => {
                const hasInteracted = sessionStorage.getItem('taxsimba_chat_interacted');
                if (!hasInteracted) {
                    setShowNudge(true);
                }
            }, 7000);
            return () => clearTimeout(timer);
        } else {
            setShowNudge(false);
        }
    }, [isOpen, pathname]);

    // Lock background scroll on mobile when chat is open
    useEffect(() => {
        const isMobile = window.innerWidth <= 768;
        if (isMobile) {
            if (isOpen) {
                document.body.style.overflow = 'hidden';
            } else {
                document.body.style.overflow = '';
            }
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    const playNotificationSound = () => {
        if (!isMuted) {
            const audio = new Audio(NOTIFICATION_SOUND_URL);
            audio.volume = 0.4;
            audio.play().catch(e => console.log("Sound play failed", e));
        }
    };

    const containsSignupCTA = (content) => {
        const patterns = [/sign up/i, /create.*account/i, /register/i, /account/i];
        return patterns.some(p => p.test(content));
    };

    const getSignupLink = (content) => {
        const match = content.match(/\[([^\]]+)\]\(([^)]*\/register([^)]*))\)/);
        if (match && match[3]) {
            return `/register${match[3]}`;
        }
        return '/register';
    };

    const extractCalculatorLink = (content) => {
        // Regex to find markdown links that point to /calculators
        const match = content.match(/\[([^\]]+)\]\(([^)]*\/calculators[^)]*)\)/);
        return match ? { name: match[1], url: match[2] } : null;
    };

    const toggleMute = (e) => {
        e.stopPropagation();
        const newState = !isMuted;
        setIsMuted(newState);
        localStorage.setItem('taxsimba_chat_muted', newState.toString());
    };

    const getQuickActions = () => {
        return PAGE_SPECIFIC_ACTIONS[pathname] || DEFAULT_ACTIONS;
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isLoading]);

    const handleSendMessage = async (text) => {
        if (!text.trim() || isLoading) return;

        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const userMessage = { role: 'user', content: text, timestamp, status: 'sent' };

        setMessages((prev) => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            // ONLY DO HANDOFF IF AGENT IS STILL GENERIC
            const isInitialHandoff = agent.name === 'Taxsimba Support';

            if (isInitialHandoff) {
                // Wait 5 seconds before showing the reassurance message
                await new Promise(resolve => setTimeout(resolve, 5000));
                
                const initialWaitMessage = {
                    role: 'assistant',
                    senderName: 'Taxsimba Support',
                    senderAvatar: null,
                    content: "One of our team members will be with you shortly! 😄",
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    status: 'sent'
                };

                setMessages((prev) => [...prev, initialWaitMessage]);

                // Second artificial delay to simulate "Agent Joining"
                await new Promise(resolve => setTimeout(resolve, 7000));

                // Pick a random human agent
                const randomAgent = HUMAN_AGENTS[Math.floor(Math.random() * HUMAN_AGENTS.length)];

                // Inform the user that Agent has joined
                const joinMessage = {
                    role: 'assistant',
                    content: `${randomAgent.name} joined the conversation`,
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    status: 'seen',
                    isSystem: true,
                    isJoinNotification: true
                };
                setMessages(prev => [...prev, joinMessage]);

                // UPDATE HEADER IDENTITY
                setAgent({
                    name: randomAgent.name,
                    avatar: randomAgent.avatar,
                    status: 'Active now'
                });
                
                // Extra pause after join
                await new Promise(resolve => setTimeout(resolve, 2000));
            } else {
                // If agent already joined, just a short typing delay for realism
                await new Promise(resolve => setTimeout(resolve, 1500));
            }

            const response = await fetch('/frontend-api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: [...messages.map(({ role, content }) => ({ role, content })), { role: userMessage.role, content: userMessage.content }] }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Something went wrong');
            }

            setIsLoading(true);
            await new Promise(resolve => setTimeout(resolve, 500));
            
            setIsLoading(true); // Start typing again for the first bubble
            await new Promise(resolve => setTimeout(resolve, 1500));

            const assistantTimestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            
            const bubbles = data.content.split('---next---').filter(b => b.trim());
            
            for (let i = 0; i < bubbles.length; i++) {
                if (i > 0) {
                    setIsLoading(true);
                    await new Promise(resolve => setTimeout(resolve, 1200)); // Delay between bubbles
                    setIsLoading(false);
                }
                
                const bubbleContent = bubbles[i].trim();
                const assistantMessage = {
                    role: 'assistant',
                    content: bubbleContent,
                    timestamp: assistantTimestamp,
                    status: 'sent'
                };

                playNotificationSound();

                setMessages((prev) => {
                    const newMessages = [...prev, assistantMessage];
                    // Mark previous user message as seen when the first bubble arrives
                    if (i === 0 && newMessages.length >= 2) {
                        const userMsgIndex = newMessages.findIndex(m => m.role === 'user' && m.status === 'sent');
                        if (userMsgIndex !== -1) newMessages[userMsgIndex].status = 'seen';
                    }
                    return newMessages;
                });

                // Mark current bubble as seen after a brief delay
                const currentMsgIndex = i;
                setTimeout(() => {
                    setMessages(prev => {
                        const updated = [...prev];
                        // Find the nth bubble we just added
                        let bubblesFound = 0;
                        for (let j = updated.length - 1; j >= 0; j--) {
                            if (updated[j].role === 'assistant') {
                                if (bubblesFound === 0) {
                                    updated[j].status = 'seen';
                                    break;
                                }
                                bubblesFound++;
                            }
                        }
                        return updated;
                    });
                }, 1000);
            }

        } catch (error) {
            setMessages((prev) => [
                ...prev,
                { role: 'assistant', content: `⚠️ ${error.message}`, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
            ]);
        } finally {
            setIsLoading(false);
        }
    };


    const handleSubmit = (e) => {
        e.preventDefault();
        handleSendMessage(input);
    };

    return (
        <>
            <div className="chatbot-container">
                    <AnimatePresence>
                        {isOpen && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                                className="chatbot-window"
                            >
                                {/* Header */}
                                <div className="chatbot-header">
                                    <div className="chatbot-header-info">
                                        <div className="chatbot-avatar-container">
                                            {agent.avatar ? (
                                                <img
                                                    src={agent.avatar}
                                                    alt={agent.name}
                                                    className="chatbot-avatar"
                                                />
                                            ) : (
                                                <div className="chatbot-avatar placeholder">TS</div>
                                            )}
                                            <span className="chatbot-status-indicator"></span>
                                        </div>
                                        <div className="chatbot-header-text">
                                            <h3>{agent.name}</h3>
                                            <p>{agent.status}</p>
                                        </div>
                                    </div>
                                    <div className="chatbot-header-actions">
                                        <button
                                            onClick={toggleMute}
                                            className="chatbot-header-btn"
                                            title={isMuted ? "Unmute" : "Mute"}
                                        >
                                            {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                                        </button>
                                        <button
                                            onClick={() => {
                                                setIsOpen(false);
                                                sessionStorage.setItem('taxsimba_chat_interacted', 'true');
                                            }}
                                            className="chatbot-close-btn"
                                        >
                                            <X size={24} />
                                        </button>
                                    </div>
                                </div>

                                {/* Messages Area */}
                                <div className="chatbot-messages">
                                    {messages.map((msg, idx) => {
                                        if (msg.isSystem) {
                                            return (
                                                <div key={idx} className="system-notification">
                                                    <span>{msg.content}</span>
                                                </div>
                                            );
                                        }

                                        const isConsecutive = idx > 0 && messages[idx - 1].role === msg.role && !messages[idx - 1].isSystem;
                                        return (
                                            <div
                                                key={idx}
                                                className={`message-row ${msg.role === 'user' ? 'user' : 'assistant'} ${isConsecutive ? 'consecutive' : ''}`}
                                            >
                                                {msg.role === 'assistant' && !isConsecutive && (
                                                    <div className="assistant-avatar-wrapper">
                                                        {(msg.senderAvatar || agent.avatar) ? (
                                                            <img
                                                                src={msg.senderAvatar || agent.avatar}
                                                                alt={msg.senderName || agent.name}
                                                                className="assistant-avatar-small"
                                                            />
                                                        ) : (
                                                            <div className="assistant-avatar-small placeholder">TS</div>
                                                        )}
                                                    </div>
                                                )}
                                                <div 
                                                    className="message-content" 
                                                    onClick={() => toggleTimestamp(idx)}
                                                    style={{ cursor: 'pointer' }}
                                                >
                                                    <motion.div
                                                        initial={{ opacity: 0, y: 10 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        className="message-bubble"
                                                    >
                                                        <ReactMarkdown
                                                            components={{
                                                                p: ({ node, ...props }) => <p {...props} style={{ margin: 0 }} />,
                                                                a: ({ node, ...props }) => <a {...props} className="chat-inline-link" target="_blank" rel="noopener noreferrer" />
                                                            }}
                                                        >
                                                            {msg.content}
                                                        </ReactMarkdown>
                                                        {(extractCalculatorLink(msg.content) || containsSignupCTA(msg.content)) && (
                                                            <div className="cta-button-group">
                                                                {extractCalculatorLink(msg.content) && (
                                                                    <button 
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            router.push(extractCalculatorLink(msg.content).url);
                                                                        }} 
                                                                        className="calculator-cta-inline-btn"
                                                                    >
                                                                        {extractCalculatorLink(msg.content).name}
                                                                    </button>
                                                                )}
                                                                {containsSignupCTA(msg.content) && (
                                                                    <button 
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            router.push(getSignupLink(msg.content));
                                                                        }} 
                                                                        className="signup-cta-inline-btn"
                                                                    >
                                                                        Sign Up
                                                                    </button>
                                                                )}
                                                            </div>
                                                        )}
                                                    </motion.div>
                                                    {visibleTimestamps[idx] && (
                                                        <motion.div 
                                                            initial={{ opacity: 0, height: 0 }}
                                                            animate={{ opacity: 1, height: 'auto' }}
                                                            className="message-info"
                                                        >
                                                            {msg.timestamp}
                                                            {msg.role === 'user' && (
                                                                <span className={`status-icon ${msg.status === 'seen' ? 'seen' : ''}`}>
                                                                    {msg.status === 'seen' ? <CheckCheck size={12} /> : <Check size={12} />}
                                                                </span>
                                                            )}
                                                        </motion.div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {isLoading && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="message-row assistant"
                                        >
                                            {agent.avatar ? (
                                                <img
                                                    src={agent.avatar}
                                                    alt={agent.name}
                                                    className="assistant-avatar-small"
                                                />
                                            ) : (
                                                <div className="assistant-avatar-small placeholder">TS</div>
                                            )}
                                            <div className="typing-indicator">
                                                <span className="typing-text">{agent.name} is typing</span>
                                                <div className="typing-dots">
                                                    {[0, 0.2, 0.4].map((delay, i) => (
                                                        <motion.span
                                                            key={i}
                                                            animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.1, 0.8] }}
                                                            transition={{ duration: 1.2, repeat: Infinity, delay }}
                                                            className="dot"
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}

                                    {/* Quick Actions / Intent Cards */}
                                    {!isLoading && (
                                        <div className={`quick-actions-container ${messages.length <= 1 ? 'initial-grid' : 'pills-row'}`}>
                                            {messages.length <= 1 && (
                                                <div className="intent-grid">
                                                    {DEFAULT_ACTIONS.map((action, i) => (
                                                        <motion.button
                                                            key={i}
                                                            whileHover={{ scale: 1.02 }}
                                                            whileTap={{ scale: 0.98 }}
                                                            onClick={() => handleSendMessage(action.query)}
                                                            className="intent-card"
                                                        >
                                                            <span className="intent-icon">{action.icon}</span>
                                                            <span className="intent-label">{action.label}</span>
                                                        </motion.button>
                                                    ))}
                                                </div>
                                            )}
                                            {messages.length > 1 && messages[messages.length - 1]?.role === 'assistant' && (
                                                <div className="quick-actions">
                                                    {getQuickActions().map((action, i) => (
                                                        <button
                                                            key={i}
                                                            onClick={() => handleSendMessage(action.query)}
                                                            className="quick-action-pill"
                                                        >
                                                            {action.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <div ref={messagesEndRef} />
                                </div>

                                {/* Footer / Input */}
                                <div className="chatbot-footer">
                                    <form onSubmit={handleSubmit} className="chatbot-input-form">
                                        <input
                                            type="text"
                                            value={input}
                                            onChange={(e) => setInput(e.target.value)}
                                            placeholder="Type a message..."
                                            className="chatbot-input"
                                        />
                                        <button
                                            type="submit"
                                            disabled={isLoading || !input.trim()}
                                            className={`chatbot-send-btn ${(input.trim() && !isLoading) ? 'active' : ''}`}
                                        >
                                            <Send size={20} />
                                        </button>
                                    </form>
                                    <div className="chatbot-branding">
                                        <Info size={12} color="#9ca3af" />
                                        <p>Powered by {agent.name.split(' from')[0]} • Taxsimba Support</p>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <AnimatePresence>
                        {showNudge && !isOpen && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.8, x: 20 }}
                                animate={{ opacity: 1, scale: 1, x: 0 }}
                                exit={{ opacity: 0, scale: 0.8, x: 20 }}
                                className="chatbot-nudge"
                                onClick={() => {
                                    setIsOpen(true);
                                    setShowNudge(false);
                                    sessionStorage.setItem('taxsimba_chat_interacted', 'true');
                                }}
                            >
                                <p>Hi there! Need help with your {new Date().getFullYear() - 1}-{new Date().getFullYear()} tax return? I'm here to help! 👋</p>
                                <button
                                    className="nudge-close"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowNudge(false);
                                        sessionStorage.setItem('taxsimba_chat_interacted', 'true');
                                    }}
                                >
                                    <X size={14} />
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => {
                            setIsOpen(!isOpen);
                            if (!isOpen) {
                                setShowNudge(false);
                                sessionStorage.setItem('taxsimba_chat_interacted', 'true');
                            }
                        }}
                        className={`chatbot-toggle-btn ${isOpen ? 'open' : 'closed'}`}
                    >
                        {isOpen ? <X size={32} /> : <MessageCircle size={32} />}
                    </motion.button>
                </div>
        </>
    );
}
