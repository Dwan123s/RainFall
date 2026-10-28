'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  X,
  Send,
  RotateCcw,
  Sparkles,
  User,
  Radio,
  ChevronDown,
  Activity,
  CloudRain
} from 'lucide-react';
import { RainSenseIcon } from './RainSenseIcon';
import { api } from '@/lib/api';
import {
  generateRainSenseReply,
  normalizeStationContext,
  cleanLatexArtifacts,
  ChatTurn
} from '@/lib/rainsense-ai';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

// Formatted message component that renders code blocks, tables, bold text, inline code cleanly
function FormattedMessage({ content }: { content: string }) {
  const cleaned = cleanLatexArtifacts(content);
  const lines = cleaned.split('\n');

  type Block =
    | { type: 'code'; lines: string[] }
    | { type: 'table'; lines: string[] }
    | { type: 'text'; lines: string[] };

  const blocks: Block[] = [];
  let currentBlock: Block | null = null;
  let inCode = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith('```')) {
      if (inCode) {
        inCode = false;
        if (currentBlock) blocks.push(currentBlock);
        currentBlock = null;
      } else {
        if (currentBlock) blocks.push(currentBlock);
        inCode = true;
        currentBlock = { type: 'code', lines: [] };
      }
      continue;
    }

    if (inCode) {
      if (currentBlock && currentBlock.type === 'code') {
        currentBlock.lines.push(line);
      }
      continue;
    }

    const isTableLine = trimmed.startsWith('|') && trimmed.endsWith('|');
    if (isTableLine) {
      if (currentBlock && currentBlock.type === 'table') {
        currentBlock.lines.push(line);
      } else {
        if (currentBlock) blocks.push(currentBlock);
        currentBlock = { type: 'table', lines: [line] };
      }
    } else {
      if (currentBlock && currentBlock.type === 'text') {
        currentBlock.lines.push(line);
      } else {
        if (currentBlock) blocks.push(currentBlock);
        currentBlock = { type: 'text', lines: [line] };
      }
    }
  }
  if (currentBlock) blocks.push(currentBlock);

  // Helper to format inline bold & code
  const renderInline = (str: string) => {
    const parts = str.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
    return parts.map((part, idx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={idx} className="font-bold text-slate-900 dark:text-slate-100">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code
            key={idx}
            className="px-1 py-0.5 rounded bg-slate-200/70 dark:bg-slate-700/70 font-mono text-[11px] text-cyan-700 dark:text-cyan-300"
          >
            {part.slice(1, -1)}
          </code>
        );
      }
      return part;
    });
  };

  return (
    <div className="space-y-1.5 leading-relaxed text-xs">
      {blocks.map((block, bIdx) => {
        if (block.type === 'code') {
          return (
            <div
              key={bIdx}
              className="my-2.5 rounded-xl border border-cyan-500/40 bg-slate-900 shadow-md overflow-hidden"
            >
              <div className="flex items-center justify-between px-3 py-1.5 bg-slate-800/90 border-b border-slate-700/60 text-[10px] font-semibold text-cyan-400 select-none">
                <span className="flex items-center gap-1.5">
                  <span>📐</span>
                  <span>CÔNG THỨC & THÔNG SỐ KỸ THUẬT</span>
                </span>
                <span className="text-slate-400 font-mono text-[9px]">RainSense Math</span>
              </div>
              <div className="p-3 font-mono text-[11px] leading-relaxed overflow-x-auto text-cyan-200 whitespace-pre">
                {block.lines.join('\n')}
              </div>
            </div>
          );
        }

        if (block.type === 'table') {
          const rows = block.lines
            .map((l) =>
              l
                .trim()
                .split('|')
                .slice(1, -1)
                .map((cell) => cell.trim())
            )
            .filter((r) => r.length > 0 && !r.every((c) => /^[-:]+$/.test(c)));

          if (rows.length === 0) return null;
          const [header, ...bodyRows] = rows;

          return (
            <div
              key={bIdx}
              className="my-2 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs"
            >
              <table className="w-full text-left border-collapse text-[11px]">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700 font-semibold">
                  <tr>
                    {header.map((col, cIdx) => (
                      <th key={cIdx} className="px-2.5 py-1.5">
                        {renderInline(col)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800 bg-white/40 dark:bg-slate-900/40">
                  {bodyRows.map((r, rIdx) => (
                    <tr key={rIdx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      {r.map((cell, cIdx) => (
                        <td key={cIdx} className="px-2.5 py-1.5 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          {renderInline(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        return (
          <div key={bIdx} className="whitespace-pre-line">
            {block.lines.map((line, lIdx) => (
              <React.Fragment key={lIdx}>
                {renderInline(line)}
                {lIdx < block.lines.length - 1 && '\n'}
              </React.Fragment>
            ))}
          </div>
        );
      })}
    </div>
  );
}

// Fallback response generator if network fails
function getClientFallbackReply(query: string, ctx?: any, history: Message[] = []): string {
  const normCtx = normalizeStationContext(ctx, ctx?.deviceId || 'RS-ESP32S3-01');
  const chatTurns: ChatTurn[] = history.map((m) => ({
    role: m.role,
    content: m.content
  }));
  return generateRainSenseReply(query, normCtx, chatTurns);
}

const DEFAULT_WELCOME_MESSAGE: Message = {
  id: 'msg-welcome',
  role: 'assistant',
  content:
    'Mình là **RainSense AI** 🌧️, hỗ trợ toàn diện về dữ liệu vi khí hậu và đồ án trạm quan trắc RainSense (ESP32-S3, gầu lật Hall A3144, BME280, MQTT TLS).\n\nBạn có thể hỏi về công thức tính mưa, số lần lật gầu hôm qua/hôm nay, sơ đồ mạch điện hoặc thời tiết hiện tại.',
  timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
};

const SUGGESTED_PROMPTS = [
  '🌧️ Cách gầu lật A3144 tính lượng mưa?',
  '📊 Tính số lần gầu lật trong hôm qua',
  '🔌 Sơ đồ nối chân ESP32-S3 & mạch điện',
  '🌤️ Phân tích thời tiết hiện tại',
  '🌡️ Công thức tính điểm sương & khí áp'
];

export function ChiikawaAiChat({ stationId = 'RS-ESP32S3-01' }: { stationId?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([DEFAULT_WELCOME_MESSAGE]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [hasNewBadge, setHasNewBadge] = useState(true);
  const [showTooltip, setShowTooltip] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch live context from station
  const { data: contextData } = useQuery({
    queryKey: ['aiContext', stationId],
    queryFn: () => api.getAiContext(stationId),
    refetchInterval: 15000,
    enabled: isOpen
  });

  // Auto-scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setHasNewBadge(false);
      setShowTooltip(false);
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [isOpen, messages, isTyping]);

  // Handle send message
  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputValue).trim();
    if (!text || isTyping) return;

    const userMsg: Message = {
      id: `usr-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue('');
    setIsTyping(true);

    try {
      const history = messages.slice(-6).map((m) => ({
        role: m.role,
        content: m.content
      }));

      const res = await api.chatWithAi(text, history, stationId, contextData);

      const botMsg: Message = {
        id: `bot-${Date.now()}`,
        role: 'assistant',
        content: res.reply,
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err: any) {
      // Smart fallback: always provide helpful response grounded in telemetry data
      const fallbackReply = getClientFallbackReply(text, contextData, messages);
      const fallbackMsg: Message = {
        id: `bot-${Date.now()}`,
        role: 'assistant',
        content: fallbackReply,
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleResetChat = () => {
    setMessages([DEFAULT_WELCOME_MESSAGE]);
  };

  return (
    <>
      {/* ============================================================== */}
      {/* FLOATING ACTION BUTTON (BOTTOM-RIGHT)                         */}
      {/* ============================================================== */}
      <div className="fixed bottom-6 right-6 z-50 flex items-center select-none">
        {/* Modern Speech Bubble Tooltip when idle */}
        {!isOpen && showTooltip && (
          <div className="mr-3 hidden sm:flex items-center gap-2 bg-white dark:bg-slate-900 border border-cyan-500/30 dark:border-cyan-500/30 shadow-2xl px-3.5 py-2 rounded-2xl text-xs animate-in fade-in slide-in-from-right-4 duration-300 relative group">
            <Sparkles className="w-3.5 h-3.5 text-cyan-500 animate-pulse shrink-0" />
            <span className="font-semibold text-slate-800 dark:text-slate-100 whitespace-nowrap flex items-center gap-1.5">
              <span>Hỏi RainSense AI</span>
              <span className="text-cyan-500">🌧️</span>
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowTooltip(false);
              }}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 ml-1 font-bold"
            >
              ×
            </button>
            {/* Tooltip triangle arrow */}
            <div className="absolute right-[-6px] top-1/2 -translate-y-1/2 w-0 h-0 border-y-[6px] border-y-transparent border-l-[6px] border-l-white dark:border-l-slate-900" />
          </div>
        )}

        {/* Main Floating Round Button with RainSense Mascot Icon */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Kích hoạt trợ lý RainSense AI"
          className={`relative group flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-full shadow-2xl transition-all duration-300 transform active:scale-95 ${
            isOpen
              ? 'bg-rose-500 text-white rotate-90 ring-4 ring-rose-500/20'
              : 'bg-gradient-to-tr from-cyan-600 to-sky-400 text-white border-2 border-cyan-300/80 hover:scale-105 hover:shadow-cyan-500/30 ring-4 ring-cyan-500/20'
          }`}
        >
          {isOpen ? (
            <X className="w-7 h-7 transition-transform" />
          ) : (
            <div className="relative">
              <RainSenseIcon
                size={44}
                expression="happy"
                className="group-hover:scale-110 transition-transform"
              />
              {/* Radar pulse ping */}
              <span className="absolute -inset-1 rounded-full bg-cyan-400/30 animate-ping -z-10 pointer-events-none" />
            </div>
          )}

          {/* Alert badge */}
          {hasNewBadge && !isOpen && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-4 w-4 bg-cyan-500 border-2 border-white dark:border-slate-900 text-[9px] font-bold text-white items-center justify-center">
                !
              </span>
            </span>
          )}
        </button>
      </div>

      {/* ============================================================== */}
      {/* RAINSENSE AI CHAT MODAL / DRAWER                               */}
      {/* ============================================================== */}
      {isOpen && (
        <div className="fixed bottom-24 right-4 sm:right-6 z-50 w-[94vw] sm:w-[420px] h-[610px] max-h-[82vh] bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-cyan-500/20 dark:border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          {/* 1. Header */}
          <div className="p-3.5 sm:p-4 border-b border-slate-200 dark:border-slate-800/80 bg-gradient-to-r from-cyan-50/90 via-sky-50/50 to-white dark:from-slate-900 dark:via-slate-900 dark:to-cyan-950/30 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <RainSenseIcon
                  size={42}
                  expression={isTyping ? 'thinking' : 'happy'}
                  className="rounded-full ring-2 ring-cyan-400/50 dark:ring-cyan-500/40 p-0.5 bg-white dark:bg-slate-800 shadow-sm"
                />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    <span>RainSense AI</span>
                    <Sparkles className="w-3.5 h-3.5 text-cyan-500 fill-cyan-500" />
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Trực tuyến</span>
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Trợ lý Khí tượng & Giám sát Mưa Đô thị
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={handleResetChat}
                title="Làm mới cuộc trò chuyện"
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                title="Đóng cửa sổ"
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 2. Live Station Glance Ribbon */}
          {contextData && (
            <div className="px-3.5 py-1.5 bg-cyan-500/5 dark:bg-slate-800/40 border-b border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between text-[11px] font-mono text-slate-600 dark:text-slate-400">
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                <span className="flex items-center gap-1">
                  <span className="text-orange-500">🌡️</span>
                  <span>{contextData.currentTemp !== null ? `${Number(contextData.currentTemp).toFixed(1)}°C` : '--'}</span>
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <span className="text-blue-500">💧</span>
                  <span>{contextData.currentHumid !== null ? `${Number(contextData.currentHumid).toFixed(1)}%` : '--'}</span>
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <span className="text-cyan-500">🌧️</span>
                  <span>{contextData.todayRainMm !== null && contextData.todayRainMm !== undefined ? `${Number(contextData.todayRainMm).toFixed(1)}mm` : '0.0mm'}</span>
                </span>
              </div>
              <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 font-semibold border border-cyan-500/20">
                {contextData.deviceId}
              </span>
            </div>
          )}

          {/* 3. Messages Chat Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${
                  msg.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {msg.role === 'assistant' && (
                  <RainSenseIcon
                    size={28}
                    expression="happy"
                    className="shrink-0 mt-0.5"
                  />
                )}

                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 leading-relaxed shadow-sm ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-r from-cyan-600 to-sky-500 text-white font-medium rounded-br-xs'
                      : 'bg-slate-100 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200 border border-slate-200/60 dark:border-slate-700/50 rounded-bl-xs'
                  }`}
                >
                  {msg.role === 'user' ? (
                    <div className="whitespace-pre-line font-medium text-white">
                      {msg.content}
                    </div>
                  ) : (
                    <FormattedMessage content={msg.content} />
                  )}

                  <div
                    className={`text-[9px] mt-1.5 font-mono text-right ${
                      msg.role === 'user'
                        ? 'text-cyan-100/75'
                        : 'text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    {msg.timestamp}
                  </div>
                </div>

                {msg.role === 'user' && (
                  <div className="w-7 h-7 rounded-full bg-cyan-100 dark:bg-cyan-900/50 border border-cyan-300 dark:border-cyan-700/50 flex items-center justify-center text-cyan-600 dark:text-cyan-300 shrink-0 mt-0.5">
                    <User className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>
            ))}

            {/* RainSense Typing Indicator */}
            {isTyping && (
              <div className="flex gap-2.5 items-center">
                <RainSenseIcon size={28} expression="thinking" className="shrink-0" />
                <div className="bg-slate-100 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/50 rounded-2xl px-3.5 py-2 text-slate-600 dark:text-slate-300 flex items-center gap-2">
                  <span className="italic font-medium">RainSense AI đang phân tích dữ liệu... 📡</span>
                  <div className="flex gap-1 items-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-bounce" />
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-bounce [animation-delay:0.2s]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-bounce [animation-delay:0.4s]" />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* 4. Quick Suggestion Pills */}
          {messages.length <= 3 && !isTyping && (
            <div className="px-3.5 py-2 border-t border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/40">
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => handleSendMessage(prompt)}
                    className="whitespace-nowrap px-2.5 py-1 rounded-full text-[11px] font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-cyan-500 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors shadow-2xs"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 5. Input Footer */}
          <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-2"
            >
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Hỏi RainSense AI: 'Hôm nay thế nào?', 'Có mưa không?', cảm biến ESP32-S3..."
                disabled={isTyping}
                className="flex-1 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!inputValue.trim() || isTyping}
                className="p-2 bg-gradient-to-r from-cyan-600 to-sky-500 hover:from-cyan-700 hover:to-sky-600 text-white rounded-xl shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
