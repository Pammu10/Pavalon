import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { CheckCircle, XCircle, Swords, HelpCircle } from "lucide-react";

type QuestStatus = 'PENDING' | 'ACTIVE' | 'PASSED' | 'FAILED';

interface QuestProgressProps {
  currentQuest: number;
  questResults: { 
    status: QuestStatus; 
    successVotes: number; 
    failVotes: number;
    failsRequired: number;
    teamSize: number;
  }[];
}

const QuestProgressWithPopover: React.FC<QuestProgressProps> = ({
  currentQuest,
  questResults,
}) => {
  const goodWins = questResults.filter(q => q.status === 'PASSED').length;
  const evilWins = questResults.filter(q => q.status === 'FAILED').length;
  const isGameOver = goodWins >= 3 || evilWins >= 3;

  return (
    <div id="quest-progress-bar" className="bg-gradient-to-br from-slate-800/40 to-black/40 border border-slate-600/30 shadow-slate-700/20 shadow-inner rounded-2xl p-4 sm:p-6 mb-6 backdrop-blur-sm">
      <h3 className="text-white text-lg sm:text-xl font-bold mt-4 flex items-center justify-center gap-2">
        <Swords className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-400" />
        Quest Progress {isGameOver ? '' : `${currentQuest} of 5`}
      </h3>

      {/* Mobile-friendly scrollable grid */}
      <div className="scroll-hide overflow-y-hidden">
        <div className="grid grid-cols-5 gap-2 min-w-[400px] px-2 mt-5">
          {[1, 2, 3, 4, 5].map((questNumber) => {
            const result = questResults[questNumber - 1];
            if (!result) return null; // Should not happen if data is correct
            
            let status = result.status;
            
            // If the game is over, we can infer the state of any 'ACTIVE' quest.
            if (isGameOver && status === 'ACTIVE') {
              status = goodWins >= 3 ? 'PASSED' : 'FAILED';
            }

            let bgClass = "bg-white/10 border-slate-500/40 text-white/70 backdrop-blur-xs";
            let popoverBgClass = "bg-slate-900/95 border-slate-700 backdrop-blur-md";
            let icon = <HelpCircle className="w-5 h-5 text-white/50" />;
            let statusText = "PENDING";

            if (status === 'PASSED') {
              bgClass = "bg-blue-500/20 border-blue-400/40 text-blue-300 backdrop-blur-xs";
              popoverBgClass = "bg-blue-950/90 border-blue-700/80 backdrop-blur-md";
              icon = <CheckCircle className="w-5 h-5 text-blue-300" />;
              statusText = "SUCCESS";
            } else if (status === 'FAILED') {
              bgClass = "bg-red-500/20 border-red-400/40 text-red-300 backdrop-blur-xs";
              popoverBgClass = "bg-red-950/90 border-red-700/80 backdrop-blur-md";
              icon = <XCircle className="w-5 h-5 text-red-300" />;
              statusText = "FAILED";
            } else if (status === 'ACTIVE') {
              bgClass = "bg-yellow-400/30 border-yellow-300/30 text-yellow-100 backdrop-blur-xs";
              popoverBgClass = "bg-yellow-900/90 border-yellow-600/80 backdrop-blur-md";
              icon = <Swords className="w-5 h-5 text-yellow-100 animate-bounce" />;
              statusText = "ONGOING";
            }

            return (
              <Popover key={questNumber}>
                <PopoverTrigger asChild>
                  <div
                    className={`p-3 rounded-xl border transition-all hover:scale-95 cursor-pointer ${bgClass} text-center`}
                  >
                    <div className="flex justify-center mb-1">{icon}</div>
                    <div className="text-[10px] sm:text-xs font-semibold">Quest {questNumber}</div>
                    <div className="text-[10px] sm:text-xs opacity-70 mt-1">
                      {result.teamSize} Knights
                    </div>
                  </div>
                </PopoverTrigger>

                <PopoverContent className={`w-64 sm:w-72 ${popoverBgClass} p-4 rounded-xl text-white`}>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm text-white/80 font-semibold">
                      Quest {questNumber} Summary
                    </h4>
                    <div
                      className={`px-2 py-1 text-xs rounded-full font-bold ${
                        status === 'PASSED' ? "text-blue-300 bg-blue-600/20" :
                        status === 'FAILED' ? "text-red-300 bg-red-600/20" :
                        status === 'ACTIVE' ? "text-yellow-300 bg-yellow-500/10" : "text-white/50 bg-white/10"
                      }`}
                    >
                      {statusText}
                    </div>
                  </div>

                    {(status === 'PASSED' || status === 'FAILED') ? (
                        <div className="space-y-1 mt-2">
                            <p className="text-sm text-white/80"><span className="font-bold">{result.teamSize}</span> knights participated.</p>
                            <div className="text-white/70 text-xs">
                                Result: {result.successVotes} Success / {result.failVotes} Fail
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-1 mt-2">
                            <p className="text-sm text-white/80">A team of <span className="font-bold">{result.teamSize}</span> knights is required.</p>
                            <div className="text-white/60 text-xs">
                                Requires <span className="font-bold">{result.failsRequired}</span> Fail vote{result.failsRequired > 1 ? 's' : ''} to fail.
                            </div>
                        </div>
                    )}
                </PopoverContent>
              </Popover>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default QuestProgressWithPopover;