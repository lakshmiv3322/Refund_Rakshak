import React, { useState, useEffect, useRef } from "react";
import {
  Send,
  Mic,
  MicOff,
  Image as ImageIcon,
  Sparkles,
  Paperclip,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  X
} from "lucide-react";
import { type Translations } from "../i18n/translations";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatPanelProps {
  t: Translations;
  messages: ChatMessage[];
  inputMessage: string;
  setInputMessage: (msg: string) => void;
  onSendMessage: (e: React.FormEvent) => void;
  loading: boolean;
  selectedImage: { base64: string; mime: string; name: string } | null;
  onImageClear: () => void;
  onOpenFileSelector: () => void;
  userLanguage: string;
  onSelectSuggestion?: (text: string) => void;
  isStreaming?: boolean;
  streamToken?: string;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  t,
  messages,
  inputMessage,
  setInputMessage,
  onSendMessage,
  loading,
  selectedImage,
  onImageClear,
  onOpenFileSelector,
  userLanguage,
  onSelectSuggestion,
  isStreaming = false,
  streamToken = ""
}) => {
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Map userLanguage to Web Speech API locale code
  const getSpeechLocale = (lang: string) => {
    switch (lang) {
      case "hi":
        return "hi-IN";
      case "ta":
        return "ta-IN";
      case "te":
        return "te-IN";
      case "mr":
        return "mr-IN";
      default:
        return "en-IN";
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamToken]);

  // Web Speech API Voice Input
  const toggleSpeechRecognition = () => {
    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSpeechError("Speech recognition is not supported in this browser.");
      setTimeout(() => setSpeechError(null), 4000);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = getSpeechLocale(userLanguage);
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => {
        setIsListening(true);
        setSpeechError(null);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setInputMessage(inputMessage ? `${inputMessage} ${transcript}` : transcript);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn("Speech error:", event.error);
        if (event.error !== "no-speech") {
          setSpeechError(`Voice input error: ${event.error}`);
          setTimeout(() => setSpeechError(null), 4000);
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      setSpeechError(`Could not start voice input: ${err.message}`);
      setIsListening(false);
      setTimeout(() => setSpeechError(null), 4000);
    }
  };

  const suggestions = [
    "My UPI transfer of ₹2,400 to friend failed on 2026-09-22, money debited.",
    "Swiggy food order refund not credited back to bank account.",
    "I authorized this payment, but UPI transfer failed. UTR: 9876543210."
  ];

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm flex flex-col h-[650px] overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/70 flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
          <div>
            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              RefundRakshak Grievance Copilot
            </h3>
            <span className="text-[10px] text-slate-400">
              Statutory TAT Engine • Active Language: {userLanguage.toUpperCase()}
            </span>
          </div>
        </div>

        {speechError && (
          <span className="text-[10px] text-rose-500 font-medium">{speechError}</span>
        )}
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {messages.map((m, idx) => (
          <div
            key={idx}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl p-4 text-xs leading-relaxed space-y-1.5 ${
                m.role === "user"
                  ? "bg-blue-700 text-white rounded-br-none shadow-sm"
                  : "bg-slate-100 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 rounded-bl-none border border-slate-200/80 dark:border-slate-700/60"
              }`}
            >
              <div className="whitespace-pre-wrap">{m.content}</div>
            </div>
          </div>
        ))}

        {/* Live Streaming Token Preview */}
        {isStreaming && streamToken && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-2xl p-4 text-xs leading-relaxed bg-slate-100 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 rounded-bl-none border border-blue-400">
              <span className="whitespace-pre-wrap">{streamToken}</span>
              <span className="inline-block w-1.5 h-3 bg-blue-600 animate-pulse ml-0.5"></span>
            </div>
          </div>
        )}

        {/* Skeleton Loader */}
        {loading && !isStreaming && (
          <div className="flex justify-start">
            <div className="bg-slate-100 dark:bg-slate-800/80 rounded-2xl p-4 rounded-bl-none border border-slate-200 dark:border-slate-700 flex items-center space-x-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping"></span>
              <span>Reasoning through statutory rules & evidence...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Attached Image Bar */}
      {selectedImage && (
        <div className="px-4 py-2 bg-blue-50 dark:bg-blue-950/40 border-t border-blue-200 dark:border-blue-900 flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2 text-blue-700 dark:text-blue-300 truncate">
            <ImageIcon className="w-4 h-4 flex-shrink-0" />
            <span className="truncate font-semibold">{selectedImage.name}</span>
            <span className="text-[10px] text-slate-400">(ready to attach)</span>
          </div>
          <button
            onClick={onImageClear}
            className="text-slate-400 hover:text-rose-500 p-1 rounded"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Quick Suggestions Pills */}
      {messages.length <= 2 && (
        <div className="px-4 py-2 border-t border-slate-200/60 dark:border-slate-800 flex items-center space-x-2 overflow-x-auto no-scrollbar">
          <span className="text-[10px] text-slate-400 whitespace-nowrap font-medium">Try:</span>
          {suggestions.map((s, idx) => (
            <button
              key={idx}
              onClick={() => onSelectSuggestion && onSelectSuggestion(s)}
              className="text-[10px] text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 px-2.5 py-1 rounded-full whitespace-nowrap transition"
            >
              {s.slice(0, 38)}...
            </button>
          ))}
        </div>
      )}

      {/* Input Bar */}
      <form
        onSubmit={onSendMessage}
        className="p-3 bg-slate-50 dark:bg-slate-950/80 border-t border-slate-200 dark:border-slate-800 flex items-center space-x-2"
      >
        <button
          type="button"
          onClick={onOpenFileSelector}
          title="Upload payment failure screenshot"
          className="p-2.5 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition"
        >
          <Paperclip className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={toggleSpeechRecognition}
          title={`Voice input in ${userLanguage.toUpperCase()}`}
          className={`p-2.5 rounded-xl transition ${
            isListening
              ? "bg-rose-600 text-white animate-pulse"
              : "text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800"
          }`}
        >
          {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>

        <input
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          placeholder={isListening ? "Listening in Indian language..." : t.chatPlaceholder}
          disabled={loading}
          className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-blue-600 transition"
        />

        <button
          type="submit"
          disabled={(!inputMessage.trim() && !selectedImage) || loading}
          className="p-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
