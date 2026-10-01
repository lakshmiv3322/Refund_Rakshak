import React, { useRef } from "react";
import { Upload, Image as ImageIcon, X, Check, AlertCircle, Sparkles, FileText } from "lucide-react";
import { type Translations } from "../i18n/translations";

interface EvidenceUploaderProps {
  t: Translations;
  selectedImage: { base64: string; mime: string; name: string } | null;
  onImageSelect: (file: File) => void;
  onImageClear: () => void;
  caseState: any;
  loading: boolean;
  onConfirmExtractedFacts?: () => void;
}

export const EvidenceUploader: React.FC<EvidenceUploaderProps> = ({
  t,
  selectedImage,
  onImageSelect,
  onImageClear,
  caseState,
  loading,
  onConfirmExtractedFacts
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImageSelect(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      onImageSelect(file);
    }
  };

  const facts = caseState?.transaction_facts || {};
  const evidenceItems = caseState?.evidence_items || [];

  return (
    <div className="space-y-6">
      {/* Upload Box */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center space-x-2">
            <Upload className="w-3.5 h-3.5 text-blue-600" />
            <span>Upload Payment Screenshot Evidence</span>
          </h3>
          <span className="text-[10px] text-slate-400">PNG, JPEG up to 4MB</span>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg"
          onChange={handleFileChange}
          className="hidden"
        />

        {selectedImage ? (
          <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/30 flex items-center justify-between">
            <div className="flex items-center space-x-3 truncate">
              <div className="w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-300 flex-shrink-0">
                <ImageIcon className="w-6 h-6" />
              </div>
              <div className="truncate">
                <div className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                  {selectedImage.name}
                </div>
                <div className="text-[10px] text-blue-600 dark:text-blue-400 flex items-center space-x-1">
                  <Sparkles className="w-3 h-3" />
                  <span>Ready for Gemini Multimodal OCR extraction</span>
                </div>
              </div>
            </div>
            <button
              onClick={() => {
                onImageClear();
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 rounded-xl p-8 text-center cursor-pointer transition bg-slate-50/50 dark:bg-slate-950/40 group"
          >
            <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-400 flex items-center justify-center mx-auto mb-3 group-hover:scale-105 transition-transform">
              <Upload className="w-6 h-6" />
            </div>
            <div className="text-xs font-semibold text-slate-900 dark:text-white">
              Drop your payment failure screenshot here, or <span className="text-blue-600 dark:text-blue-400 underline">browse</span>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Supports Google Pay, PhonePe, Paytm, BHIM, and bank debit SMS captures.
            </div>
          </div>
        )}
      </div>

      {/* Extracted Facts Verification Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center space-x-2">
            <FileText className="w-3.5 h-3.5 text-blue-600" />
            <span>Extracted Case Facts</span>
          </h3>
          <span className="text-[10px] font-mono text-slate-400">
            Source Audit Tracking
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60">
            <div className="text-[10px] text-slate-400">Principal Amount</div>
            <div className="text-base font-bold text-emerald-600 dark:text-emerald-400 font-mono">
              {facts.amount ? `₹${facts.amount}` : "Pending"}
            </div>
            <div className="text-[9px] text-slate-400 mt-0.5">
              Source: {evidenceItems.length > 0 ? "screenshot" : "user_input"}
            </div>
          </div>

          <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60">
            <div className="text-[10px] text-slate-400">UTR / Reference Number</div>
            <div className="text-xs font-mono font-bold text-slate-900 dark:text-white truncate">
              {facts.transaction_reference ? `****${facts.transaction_reference.slice(-4)}` : "Pending"}
            </div>
            <div className="text-[9px] text-slate-400 mt-0.5">
              Source: {evidenceItems.length > 0 ? "screenshot" : "user_input"}
            </div>
          </div>

          <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60">
            <div className="text-[10px] text-slate-400">Transaction Date (T)</div>
            <div className="text-xs font-semibold text-slate-900 dark:text-white">
              {facts.transaction_date || "Pending"}
            </div>
            <div className="text-[9px] text-slate-400 mt-0.5">Calendar day of debit</div>
          </div>

          <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60">
            <div className="text-[10px] text-slate-400">Bank or Provider</div>
            <div className="text-xs font-semibold text-slate-900 dark:text-white truncate">
              {facts.bank_or_provider || "Pending"}
            </div>
            <div className="text-[9px] text-slate-400 mt-0.5">PSP or Issuer</div>
          </div>
        </div>

        {evidenceItems.length > 0 && onConfirmExtractedFacts && (
          <div className="pt-2 flex items-center justify-between border-t border-slate-200 dark:border-slate-800">
            <div className="text-[11px] text-slate-500">
              Please verify extracted facts before complaint drafting.
            </div>
            <button
              onClick={onConfirmExtractedFacts}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Confirm Extracted Values</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
