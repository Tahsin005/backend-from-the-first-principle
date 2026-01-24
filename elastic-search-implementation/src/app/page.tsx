'use client';

import { useState, useEffect } from 'react';
import { Search, Database, Clock, Hash } from 'lucide-react';

interface Review {
  external_id: number;
  review: string;
  sentiment: number;
}

interface SearchData {
  data: Review[];
  total: number;
}

interface SearchResult {
  source: 'postgres' | 'elastic';
  data: SearchData;
  time: number;
}

export default function Home() {
  const [query, setQuery] = useState('');
  const [postgresResult, setPostgresResult] = useState<SearchResult | null>(null);
  const [elasticResult, setElasticResult] = useState<SearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setPostgresResult(null);
    setElasticResult(null);
    setIsSearching(true);

    const eventSource = new EventSource(`/api/search?q=${encodeURIComponent(query)}`);

    eventSource.onmessage = (event) => {
      const result: SearchResult = JSON.parse(event.data);
      if (result.source === 'postgres') {
        setPostgresResult(result);
      } else if (result.source === 'elastic') {
        setElasticResult(result);
      }
    };

    eventSource.onerror = (err) => {
      console.error('SSE Error:', err);
      eventSource.close();
      setIsSearching(false);
    };
  };

  useEffect(() => {
    if (postgresResult && elasticResult) {
      setIsSearching(false);
    }
  }, [postgresResult, elasticResult]);

  return (
    <main className="min-h-screen bg-[#f8fafc] text-[#1e293b] font-sans">
      <div className="max-w-[1200px] mx-auto pt-8 pb-8 px-4">
        <div className="text-center mb-6">
          <h1 className="text-[32px] font-bold text-[#0f172a] mb-1 leading-tight">
            Database Search Comparison
          </h1>
          <p className="text-[#64748b] text-[16px] max-w-2xl mx-auto">
            Compare search performance between Neon Postgres (ILIKE) and Elasticsearch (query_string). Results appear instantly as they complete.
          </p>
        </div>

        <div className="bg-white rounded-[20px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-[#f1f5f9] p-5 mb-6 max-w-4xl mx-auto">
          <h2 className="text-[#0f172a] text-[16px] font-bold mb-0.5">Search Reviews</h2>
          <p className="text-[#64748b] text-[13px] mb-4">Enter a term to search in the review texts.</p>

          <form onSubmit={handleSearch} className="flex gap-3">
            <div className="relative flex-1">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="something"
                className="w-full text-[#1e293b] bg-white border border-[#e2e8f0] rounded-xl py-3 px-5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-[15px] placeholder:text-[#94a3b8]"
              />
            </div>
            <button
              type="submit"
              disabled={isSearching}
              className="bg-[#0f172a] hover:bg-[#1e293b] text-white px-8 py-3 rounded-xl font-bold transition-all disabled:opacity-50 text-[15px]"
            >
              {isSearching ? 'Searching...' : 'Search'}
            </button>
          </form>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <ResultContainer
            title="Postgres (ILIKE) Results"
            icon={<Database className="w-5 h-5 text-[#334155]" />}
            result={postgresResult}
            isSearching={isSearching}
          />

          <ResultContainer
            title="Elasticsearch (query_string) Results"
            icon={<Search className="w-5 h-5 text-[#334155]" />}
            result={elasticResult}
            isSearching={isSearching}
          />
        </div>
      </div>
    </main>
  );
}

function ResultContainer({
  title,
  icon,
  result,
  isSearching
}: {
  title: string;
  icon: React.ReactNode;
  result: SearchResult | null;
  isSearching: boolean;
}) {
  return (
    <div className="bg-white rounded-[24px] border border-[#f1f5f9] shadow-[0_4px_20px_rgb(0,0,0,0.02)] flex flex-col h-[55vh] min-h-[400px]">
      <div className="px-6 pt-5 pb-3">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-1.5 bg-[#f8fafc] rounded-lg">
            {icon}
          </div>
          <h3 className="text-[16px] font-bold text-[#0f172a]">{title}</h3>
        </div>

        <div className="grid grid-cols-[100px_1fr] border-b border-[#f1f5f9] pb-3 px-2">
          <span className="text-[13px] font-bold text-[#64748b]">Sentiment</span>
          <span className="text-[13px] font-bold text-[#64748b]">Review</span>
        </div>
      </div>

      <div className="flex-1 overflow-auto max-h-[600px] scrollbar-thin scrollbar-thumb-slate-200">
        {!result && isSearching && (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-[3px] border-slate-200 border-t-blue-600 rounded-full animate-spin"></div>
          </div>
        )}

        {result?.data.data.map((item, idx) => (
          <div
            key={`${result.source}-${idx}`}
            className="grid grid-cols-[100px_1fr] items-start py-3 px-8 border-b border-[#f8fafc] last:border-0 hover:bg-[#f8fafc]/50 transition-colors"
          >
            <div className="pt-0.5">
              <span className={`
                inline-block px-2.5 py-1 rounded-md text-[11px] font-bold tracking-tight uppercase
                ${item.sentiment === 1
                  ? 'bg-[#0f172a] text-[#ffffff]'
                  : 'bg-[#ef4444] text-white'}
              `}>
                {item.sentiment === 1 ? 'positive' : 'negative'}
              </span>
            </div>
            <p className="text-[13.5px] text-[#334155] leading-[1.6] line-clamp-2 pr-4">
              {item.review}
            </p>
          </div>
        ))}

        {!result && !isSearching && (
          <div className="flex flex-col items-center justify-center py-40 opacity-20">
            <div className="w-12 h-1 gap-1 flex items-center justify-center mb-1">
              <div className="w-1.5 h-1.5 rounded-full bg-slate-400"></div>
              <div className="w-5 h-1.5 rounded-full bg-slate-400"></div>
              <div className="w-1.5 h-1.5 rounded-full bg-slate-400"></div>
            </div>
          </div>
        )}
      </div>

      <div className="px-8 py-5 border-t border-[#f1f5f9] bg-[#fafafa]/30 rounded-b-[24px] flex justify-between items-center text-[13px] font-medium text-[#94a3b8]">
        <div className="flex items-center gap-2">
          <Clock size={15} />
          <span>Latency: {result ? `${result.time.toFixed(2)} ms` : '0 ms'}</span>
        </div>
        <div className="flex items-center gap-2">
          <Hash size={15} className="opacity-50" />
          <span>Found: {result ? result.data.total : 0}</span>
        </div>
      </div>
    </div>
  );
}
