import React, { useState, useEffect, useRef } from "react";
import {
  Send,
  Mic,
  MicOff,
  Image as ImageIcon,
  Paperclip,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  PhoneCall,
  ExternalLink,
  X,
  Lock,
  Sparkles
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
  isStreaming?: boolean;
  streamToken?: string;
  caseState?: any;
  isDevMode?: boolean;
  onSelectSuggestion?: (text: string) => void;
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
  isStreaming = false,
  streamToken = "",
  caseState,
  isDevMode = false,
  onSelectSuggestion
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
      case "bn":
        return "bn-IN";
      default:
        return "en-IN";
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamToken]);

  // Web Speech API Voice Input (Requirement 12)
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
      setSpeechError("Speech recognition is not supported in this browser. Please use keyboard input.");
      setTimeout(() => setSpeechError(null), 4500);
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
        if (event.error !== "no-speech") {
          setSpeechError(`Voice input: ${event.error}`);
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
      setSpeechError(`Voice input error: ${err.message}`);
      setIsListening(false);
      setTimeout(() => setSpeechError(null), 4000);
    }
  };

  const isFraudCase =
    caseState?.classification === "unauthorized_or_fraud" ||
    caseState?.branch === "fraud_safety_branch" ||
    caseState?.scenario_id === "unauthorized_fraud_golden_hour";

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs flex flex-col h-[650px] overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/70 flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
          <div>
            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              RefundRakshak Redressal Copilot
            </h3>
            <span className="text-[10px] text-slate-400">
              Statutory TAT Engine • Language: {userLanguage.toUpperCase()}
            </span>
          </div>
        </div>

        {speechError && (
          <span className="text-[10px] text-rose-500 font-medium truncate max-w-xs">{speechError}</span>
        )}
      </div>

      {/* Fraud Golden Hour Checklist Banner (Requirement 19) */}
      {isFraudCase && (
        <div className="bg-rose-50 dark:bg-rose-950/50 border-b border-rose-200 dark:border-rose-900/80 p-4 space-y-2.5 animate-fadeIn">
          <div className="flex items-center justify-between text-xs font-bold text-rose-800 dark:text-rose-300">
            <span className="flex items-center space-x-1.5">
              <ShieldAlert className="w-4 h-4 text-rose-600" />
              <span>EMERGENCY: Unauthorized Debit Golden Hour Protocol</span>
            </span>
            <span className="text-[10px] bg-rose-200 dark:bg-rose-900 text-rose-900 dark:text-rose-200 px-2 py-0.5 rounded font-mono">
              Action Required
            </span>
          </div>

          <p className="text-[11px] text-rose-700 dark:text-rose-200 leading-snug">
            Under <strong>RBI Circular DBR.No.Leg.BC.78/09.07.005/2017-18</strong>, customer liability is <strong>ZERO</strong> if you notify your bank within 3 working days of receiving the unauthorized transaction alert. Follow these steps immediately:
          </p>

          <ol className="text-xs space-y-1.5 text-rose-900 dark:text-rose-100 font-medium pl-2">
            <li className="flex items-start space-x-2">
              <span className="w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">1</span>
              <span><strong>Call National Cyber Crime Helpline 1930</strong> immediately to freeze cyber accounts.</span>
            </li>
            <li className="flex items-start space-x-2">
              <span className="w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">2</span>
              <span>
                <strong>File formal report at cybercrime.gov.in</strong>{" "}
                <a href="https://cybercrime.gov.in" target="_blank" rel="noopener noreferrer" className="underline inline-flex items-center space-x-0.5 text-blue-700 dark:text-blue-300">
                  <span>Open Portal</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </span>
            </li>
            <li className="flex items-start space-x-2">
              <span className="w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">3</span>
              <span><strong>Block debit card / UPI ID immediately</strong> via your bank's 24x7 phone banking or mobile app.</span>
            </li>
            <li className="flex items-start space-x-2">
              <span className="w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">4</span>
              <span><strong>Submit written notice to your bank</strong> (we have drafted this in your Approvals tab).</span>
            </li>
          </ol>
        </div>
      )}

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
                  ? "bg-blue-700 text-white rounded-br-none shadow-xs"
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
              <span>Consulting verified statutory circulars & formulating draft...</span>
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
            <span className="text-[10px] text-slate-400">(ready to upload)</span>
          </div>
          <button
            onClick={onImageClear}
            className="text-slate-400 hover:text-rose-500 p-1 rounded"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Dev-Only Sample Scenarios (strictly gated behind ?dev=1 AND ENABLE_SIM_TIME=true) */}
      {isDevMode && onSelectSuggestion && (
        <div className="px-4 py-2 bg-amber-50/60 dark:bg-amber-950/30 border-t border-amber-200 dark:border-amber-900/50 flex items-center space-x-2 overflow-x-auto no-scrollbar">
          <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wider whitespace-nowrap flex items-center space-x-1">
            <Sparkles className="w-3 h-3 text-amber-600" />
            <span>Dev Samples:</span>
          </span>
          <button
            type="button"
            onClick={() =>
              onSelectSuggestion(
                "My UPI payment of ₹2,400 to friend failed on 2026-09-22, money debited from SBI. Reference: UTR9988112233."
              )
            }
            className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-100 border border-slate-300 dark:border-slate-700 whitespace-nowrap"
          >
            UPI P2P
          </button>
          <button
            type="button"
            onClick={() =>
              onSelectSuggestion(
                "I cancelled a Swiggy food order of ₹850 on 2026-09-25. The merchant says refunded but the amount is not in my bank."
              )
            }
            className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-100 border border-slate-300 dark:border-slate-700 whitespace-nowrap"
          >
            Merchant Refund
          </button>
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
          title="Upload payment receipt screenshot"
          className="min-h-[44px] min-w-[44px] p-2.5 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition flex items-center justify-center"
        >
          <Paperclip className="w-5 h-5" />
        </button>

        <button
          type="button"
          onClick={toggleSpeechRecognition}
          title={`Voice input in ${userLanguage.toUpperCase()}`}
          className={`min-h-[44px] min-w-[44px] p-2.5 rounded-xl transition flex items-center justify-center ${
            isListening
              ? "bg-rose-600 text-white animate-pulse"
              : "text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800"
          }`}
        >
          {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>

        <input
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          placeholder={isListening ? "Listening in your language..." : t.inputPlaceholder || "Describe your failed payment or paste transaction details..."}
          disabled={loading}
          className="flex-1 min-h-[44px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-blue-600 transition"
        />

        <button
          type="submit"
          disabled={(!inputMessage.trim() && !selectedImage) || loading}
          className="min-h-[44px] px-4 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed shadow-xs flex items-center justify-center"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
