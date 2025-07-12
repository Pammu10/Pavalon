"use client"

import { useState, useEffect } from "react"
import { Crown, Sword, Shield, Castle, Scroll, Gem } from "lucide-react"
import { useHapticFeedback } from "@/hooks/useHapticFeedback"
import { StorybookScene } from "@/components/ui/StorybookScene"
import { AvalonLoadingOverlay } from "@/components/ui/LoadingOverlay";
// import { App as CapacitorApp } from "@capacitor/app";
// import { PluginListenerHandle } from "@capacitor/core"
// import { Dialog } from "@capacitor/dialog"
// import { storageManager } from "@/lib/storage"

export default function HomeScreen({onEnter}) {
  const [mounted, setMounted] = useState(false)
  const [showStory, setShowStory] = useState(false);
  const [showLoading, setShowLoading] =useState(false);
  const [shouldSkipStory, setShouldSkipStory] = useState(false);
  useEffect(() => {
    setMounted(true)
  }, [])
//   useEffect(() => {
//     let listener: PluginListenerHandle;

//     const setupListener = async () => {
//       listener = await CapacitorApp.addListener("backButton", async () => {
//           const { value } = await Dialog.confirm({
//             title: "Retreat from the Realm?",
//             message:
//               "Are you sure you wish to abandon the Round Table and leave Pavalon?",
//             okButtonTitle: "Yes, Retreat",
//             cancelButtonTitle: "Stay and Fight",
//           });

//           if (value) {
//             CapacitorApp.exitApp();
//           }
//         })
//     };

//     setupListener();

//     return () => {
//       if (listener) {
//         listener.remove();
//       }
//     };
//   });

//   const { impact } = useHapticFeedback();

//   useEffect(() => {
//     const checkOnSkip = async () => {
//       const settings = await storageManager.loadSettings();
//       setShouldSkipStory(settings.skipIntro === true);
//     };
//     checkOnSkip();
//   }, []);

  return (
    <>
      {showStory ? (<StorybookScene onSkip={async () => {
        setShowStory(false)
    setShowLoading(true)
}} />
       ): 
      (
        <>
        {showLoading && <AvalonLoadingOverlay onFinish={onEnter}/>}
        
      <div className="absolute inset-0 opacity-10">
        <div className="absolute bottom-0 left-0 w-64 h-48 bg-gradient-to-t from-stone-900 to-transparent transform -skew-x-12 animate-pulse"></div>
        <div
          className="absolute bottom-0 right-0 w-48 h-56 bg-gradient-to-t from-stone-900 to-transparent transform skew-x-12 animate-pulse"
          style={{ animationDelay: "2s" }}
        ></div>
        <div
          className="absolute bottom-0 left-1/3 w-32 h-40 bg-gradient-to-t from-stone-900 to-transparent animate-pulse"
          style={{ animationDelay: "1s" }}
        ></div>
      </div>

     
      <div className="absolute inset-0">
        
        <div className="absolute top-20 left-4 sm:left-20 w-8 h-16 bg-gradient-to-b from-red-800 to-red-900 opacity-60 animate-sway"></div>
        <div
          className="absolute top-32 right-4 sm:right-32 w-6 h-12 bg-gradient-to-b from-blue-800 to-blue-900 opacity-50 animate-sway"
          style={{ animationDelay: "1s" }}
        ></div>
        <div
          className="absolute bottom-32 left-4 sm:left-16 w-10 h-20 bg-gradient-to-b from-purple-800 to-purple-900 opacity-40 animate-sway"
          style={{ animationDelay: "2s" }}
        ></div>

    
        <div className="absolute top-40 left-1/4 w-2 h-2 bg-yellow-400 rounded-full animate-twinkle opacity-80"></div>
        <div
          className="absolute top-60 right-1/3 w-1 h-1 bg-amber-300 rounded-full animate-twinkle opacity-60"
          style={{ animationDelay: "0.5s" }}
        ></div>
        <div
          className="absolute bottom-40 left-2/3 w-3 h-3 bg-gold-400 rounded-full animate-twinkle opacity-70"
          style={{ animationDelay: "1.5s" }}
        ></div>
        <div
          className="absolute top-80 left-1/2 w-1 h-1 bg-yellow-300 rounded-full animate-twinkle opacity-50"
          style={{ animationDelay: "2.5s" }}
        ></div>
      </div>

      <div className="absolute inset-0 border-8 border-gradient-to-r from-amber-600 via-yellow-500 to-amber-600 opacity-20 pointer-events-none"></div>
      <div className="absolute top-4 left-4 right-4 h-1 bg-gradient-to-r from-transparent via-amber-500 to-transparent opacity-30"></div>
      <div className="absolute bottom-4 left-4 right-4 h-1 bg-gradient-to-r from-transparent via-amber-500 to-transparent opacity-30"></div>


 
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 sm:px-6 lg:px-8">
        {/* Medieval decorative icons */}
        <div className="absolute top-4 sm:top-8 right-4 sm:right-8 opacity-30">
          <Castle className="w-8 sm:w-12 h-8 sm:h-12 text-amber-400 animate-float" />
        </div>
        <div className="absolute top-4 sm:top-8 right-12 sm:right-16 opacity-30">
          <Sword className="w-8 sm:w-12 h-8 sm:h-12 text-steel-400 animate-float" style={{ animationDelay: "1s" }} />
        </div>
        <div className="absolute bottom-4 sm:bottom-8 left-1/2 transform -translate-x-1/2 opacity-30">
          <Shield className="w-8 sm:w-12 h-8 sm:h-12 text-emerald-400 animate-float" style={{ animationDelay: "2s" }} />
        </div>

    
        <div
          className={`text-center mb-8 sm:mb-16 transition-all duration-1000 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
        >
     
          <div className="flex justify-center mb-4">
            <Scroll className="w-6 sm:w-8 h-6 sm:h-8 text-amber-400 opacity-60 animate-pulse" />
            <div className="mx-4 w-16 sm:w-24 h-0.5 bg-amber-400 self-center opacity-60"></div>
            <Scroll className="w-6 sm:w-8 h-6 sm:h-8 text-amber-400 opacity-60 animate-pulse" />
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-8xl font-bold bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 bg-clip-text text-transparent mb-2 sm:mb-4 tracking-wide sm:tracking-wider leading-tight drop-shadow-lg">
            THE SHATTERED THRONE
          </h1>
          <h2 className="text-2xl sm:text-4xl lg:text-6xl font-bold text-amber-200 mb-4 sm:mb-6 tracking-wider sm:tracking-widest  drop-shadow-md">
            ⚔️ PAVALON ⚔️
          </h2>

    
          <div className="flex justify-center items-center space-x-2 sm:space-x-4">
            <Gem className="w-3 sm:w-4 h-3 sm:h-4 text-amber-400 animate-pulse" />
            <div className="w-24 sm:w-32 h-0.5 sm:h-1 bg-gradient-to-r from-transparent via-amber-400 to-transparent animate-pulse"></div>
            <Crown className="w-4 sm:w-6 h-4 sm:h-6 text-yellow-400 animate-pulse" />
            <div className="w-24 sm:w-32 h-0.5 sm:h-1 bg-gradient-to-r from-transparent via-amber-400 to-transparent animate-pulse"></div>
            <Gem className="w-3 sm:w-4 h-3 sm:h-4 text-amber-400 animate-pulse" />
          </div>
        </div>


        <div
          className={`text-center mb-8 sm:mb-12 px-4 transition-all duration-1000 delay-300 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
        >
          <p className="text-lg sm:text-xl lg:text-2xl text-amber-100 font-light tracking-wide italic">
            In the realm of Camelot, loyalty and treachery intertwine...
          </p>
          <p className="text-sm sm:text-base text-amber-200 mt-2 opacity-80">
            A tale of knights, quests, and hidden allegiances
          </p>
        </div>


        <div
          className={`transition-all duration-1000 delay-500 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
        >
          
          
            <div className="absolute -inset-2 bg-gradient-to-r from-amber-600 via-yellow-500 to-amber-600 rounded-2xl blur opacity-75 group-hover:opacity-100 transition duration-1000 group-hover:duration-200 animate-pulse"></div>

          
            <button
              onClick={async () => {
                // await impact();
                if (!shouldSkipStory) {
          setShowStory(true);
        } else {
          setShowLoading(true);
        }
              }}
              className="relative px-8 sm:px-16 py-4 sm:py-6 bg-gradient-to-r from-amber-800 via-yellow-700 to-amber-800 rounded-2xl leading-none flex items-center hover:scale-105 active:scale-95 transform transition-all duration-300 shadow-2xl touch-manipulation border-2 border-amber-500"
            >
            
              <div className="absolute -top-1 -left-1 w-3 h-3 border-l-2 border-t-2 border-amber-400"></div>
              <div className="absolute -top-1 -right-1 w-3 h-3 border-r-2 border-t-2 border-amber-400"></div>
              <div className="absolute -bottom-1 -left-1 w-3 h-3 border-l-2 border-b-2 border-amber-400"></div>
              <div className="absolute -bottom-1 -right-1 w-3 h-3 border-r-2 border-b-2 border-amber-400"></div>

              <span className="flex items-center space-x-3 sm:space-x-5">
                <Crown className="w-6 sm:w-8 h-6 sm:h-8 text-yellow-300 group-hover:rotate-12 transition-transform duration-300" />
                <span className="text-xl sm:text-3xl font-bold text-amber-100 tracking-wide sm:tracking-wider">
                  BEGIN QUEST
                </span>
                <Sword className="w-6 sm:w-8 h-6 sm:h-8 text-steel-300 group-hover:-rotate-12 transition-transform duration-300" />
              </span>
            </button>
      
        </div>

     
        <div
          className={`mt-8 sm:mt-16 flex space-x-4 sm:space-x-8 transition-all duration-1000 delay-700 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
        >
          
          <div className="relative">
            <div className="w-12 sm:w-16 h-12 sm:h-16 border-2 border-amber-500 rounded-full flex items-center justify-center animate-spin-slow bg-gradient-to-br from-amber-800 to-amber-900">
              <Crown className="w-6 sm:w-8 h-6 sm:h-8 text-yellow-400" />
            </div>
            <div className="absolute -top-1 -left-1 w-2 h-2 bg-amber-400 rounded-full animate-pulse"></div>
          </div>

          <div className="relative" style={{ animationDelay: "1s" }}>
            <div className="w-12 sm:w-16 h-12 sm:h-16 border-2 border-emerald-500 rounded-full flex items-center justify-center animate-spin-slow bg-gradient-to-br from-emerald-800 to-emerald-900">
              <Shield className="w-6 sm:w-8 h-6 sm:h-8 text-emerald-400" />
            </div>
            <div
              className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-400 rounded-full animate-pulse"
              style={{ animationDelay: "0.5s" }}
            ></div>
          </div>

          <div className="relative" style={{ animationDelay: "2s" }}>
            <div className="w-12 sm:w-16 h-12 sm:h-16 border-2 border-red-500 rounded-full flex items-center justify-center animate-spin-slow bg-gradient-to-br from-red-800 to-red-900">
              <Sword className="w-6 sm:w-8 h-6 sm:h-8 text-red-400" />
            </div>
            <div
              className="absolute -bottom-1 -left-1 w-2 h-2 bg-red-400 rounded-full animate-pulse"
              style={{ animationDelay: "1s" }}
            ></div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-2 bg-gradient-to-r from-amber-800 via-yellow-600 to-amber-800 opacity-60"></div>
      <div className="absolute bottom-2 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-amber-400 to-transparent"></div>
      </>)
      }
    </>
  )
}
