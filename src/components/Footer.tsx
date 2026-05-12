import { Cloud, Heart } from "lucide-react";

export default function Footer() {
  return (
    <footer className="w-full border-t bg-slate-50 mt-auto">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-slate-700">
            <Cloud className="h-5 w-5 text-sky-600" />
            <span className="font-semibold">天象志</span>
            <span className="text-sm text-slate-400">— 记录天空的每一种奇迹</span>
          </div>
          <div className="text-sm text-slate-500">
            用 <Heart className="inline h-3 w-3 text-red-400" /> 为天象爱好者打造
          </div>
        </div>
      </div>
    </footer>
  );
}
