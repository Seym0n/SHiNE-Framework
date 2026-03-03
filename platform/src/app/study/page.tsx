"use client"

import Skeleton from 'react-loading-skeleton';
import { Bounce, ToastContainer, toast } from 'react-toastify';
import SmartHomeSidebar from './smart-home-sidebar';
import EnvironmentBar from './environment-bar';
import TaskAbortModal from './task-abort-modal';
import 'react-loading-skeleton/dist/skeleton.css'
import { useEffect, useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { initializeSocket, getSocket } from './services/socketService';
import { useRouter } from "next/navigation";
import parse from 'html-react-parser';
import { Task } from '@/types/task';
import { 
  SocketInteractionUpdate, 
  SocketExplanation, 
  SocketGameUpdate, 
  GameInteractionEvent,
  GameConfig 
} from './types';

/** Dynamically import PhaserGame to avoid SSR issues with Phaser */
const PhaserGame = dynamic(() => import('./game/PhaserGame').then(mod => mod.PhaserGame), {
  ssr: false
})

/**
 * Main study page component that orchestrates the smart home simulation
 * Manages real-time communication, game state, and user interactions
 */
export default function Home() {
  const router = useRouter();
  /** Game configuration loaded from backend */
  const [gameConfig, setGameConfig] = useState<GameConfig | null>(null);
  /** Array of study tasks for the current session */
  const [tasks, setTasks] = useState<Task[]>([]);
  /** Index of the currently active task */
  const [currentTaskIndex, setCurrentTaskIndex] = useState(0);
  /** How explanations are triggered ('push', 'pull', or 'interactive') */
  const [explanationTrigger, setExplanationTrigger] = useState('push');
  /** Loading state for initial data fetch */
  const [isLoading, setIsLoading] = useState(true);
  /** Loading state specifically for Phaser game initialization */
  const [gameLoading, setGameLoading] = useState(true);
  /** Whether the task abort modal is currently visible */
  const [isAbortModalOpen, setIsAbortModalOpen] = useState(false);
  /** Array of abort reason options for the current task */
  const [abortReasons, setAbortReasons] = useState<string[]>([]);
  /** Viewport width tier: 'lg' ≥1024px, 'md' 768–1023px, 'sm' <768px */
  const [tier, setTier] = useState<'lg' | 'md' | 'sm'>('lg');

  /** Detect viewport width tier on mount and on resize */
  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      setTier(w >= 1024 ? 'lg' : w >= 768 ? 'md' : 'sm');
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  /**
   * Main effect hook that sets up the study environment:
   * 1. Initializes WebSocket connection for real-time communication
   * 2. Validates session and redirects if invalid
   * 3. Sets up event listeners for game updates and explanations
   * 4. Fetches game configuration and tasks
   * 5. Establishes communication between frontend and backend
   */
  useEffect(() => {
    const socket = initializeSocket();
    const sessionId = localStorage.getItem('smartHomeSessionId');
    
    if(!sessionId){
      router.push('/');
      return;
    }

    /**
     * Component for rendering explanation content with optional rating functionality
     * Displays explanations in toast notifications with thumbs up/down rating
     */
    const ExplanationContent = ({ content, explanationId, ratingType }: { 
      content: React.ReactNode, 
      explanationId: string,
      ratingType?: string 
    }) => {
      const [selectedRating, setSelectedRating] = useState<boolean | null>(null);
      
      /**
       * Handles user rating of explanation content
       * @param isLiked Whether the user liked (true) or disliked (false) the explanation
       */
      const handleRating = (isLiked: boolean) => {
        setSelectedRating(isLiked);
        
        socket.emit('explanation_rating', {
          explanation_id: explanationId,
          sessionId: sessionId,
          rating: { is_liked: isLiked }
        });
        
        toast.success(`Rating submitted!`, {
          position: "top-right",
          autoClose: 2000,
          hideProgressBar: true
        });
      };
      
      return (
        <div>
          {content}
          {ratingType === 'like' && (
            <>
              <div className="mt-3 flex gap-2">
                <button 
                  onClick={() => handleRating(true)}
                  className={`px-2 py-1 rounded transition-colors ${
                    selectedRating === true 
                      ? 'bg-green-700 text-white font-bold shadow-md' 
                      : 'bg-green-500 text-white hover:bg-green-600'
                  }`}
                  aria-label="Thumbs up"
                  disabled={selectedRating !== null}
                >
                  👍
                </button>
                <button 
                  onClick={() => handleRating(false)}
                  className={`px-2 py-1 rounded transition-colors ${
                    selectedRating === false 
                      ? 'bg-red-700 text-white font-bold shadow-md' 
                      : 'bg-red-500 text-white hover:bg-red-600'
                  }`}
                  aria-label="Thumbs down"
                  disabled={selectedRating !== null}
                >
                  👎
                </button>
              </div>
            </>
          )}
        </div>
      );
    };

    /**
     * Sets up WebSocket event listeners for real-time communication
     * Handles device updates, explanations, and game state changes
     */
    const setupSocketListeners = () => {
      // Listen for device interaction updates from other clients or backend
      socket.on('update-interaction', (data: SocketInteractionUpdate) => {
        const updatedData = {
          device: data.deviceId,
          interaction: data.interaction,
          value: data.value
        };
        
        // Delay to ensure game is ready, then update device states
        setTimeout(() => {
          import('./game/EventsCenter').then(({ eventsCenter }) => {
            eventsCenter.emit('update-interaction', updatedData);
            eventsCenter.emit('update-smarty-interaction', updatedData);
          });
        }, 300);
      });

      // Listen for explanation responses
      socket.on('explanation', (data: SocketExplanation) => {
        const parsedContent = parse(data.explanation);
        
        // Display explanation in toast notification with rating options
        toast.info(
          <ExplanationContent 
            content={parsedContent} 
            explanationId={data.explanation_id}
            ratingType={data.rating}
          />, 
          {
            position: "top-right",
            autoClose: 10000,
            hideProgressBar: false,
            closeOnClick: false,
            pauseOnHover: true,
            draggable: true,
            progress: undefined,
            theme: "colored",
            transition: Bounce,
          }
        );
      });

      // Listen for game state updates (task completion, rule triggers, etc.)
      socket.on('game-update', (data: SocketGameUpdate) => {
        const updatedTasks = data.updatedTasks;
        setTasks(updatedTasks);

        // Update device properties if provided
        const updatedProperties = data.updatedProperties;
        if (updatedProperties && updatedProperties.length > 0) {
          import('./game/EventsCenter').then(({ eventsCenter }) => {
            for (let i = 0; i < updatedProperties.length; i++) {
              eventsCenter.emit('update-smarty-interaction', updatedProperties[i]);
              eventsCenter.emit('update-interaction', updatedProperties[i]);
            }
          });
        }
        
        // Show success message for completed actions
        toast.success(data.message, {
          position: "top-right",
          autoClose: 5000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          progress: undefined,
          theme: "colored",
          transition: Bounce,
        });
      });
    };

    setupSocketListeners();

    /**
     * Fetches game configuration and tasks from the backend API
     * Handles session validation and redirects if session is completed
     */
    const fetchGameConfig = async () => {
      try {
        if (!sessionId) {
          throw new Error('No session ID found');
        }

        const response = await fetch(`/api/game-data?sessionId=${sessionId}`);
        if (!response.ok) {
          const responseData = await response.json();
          if (responseData.error && responseData.session_completed == true) {
            router.push('/finish');
            return;
          }

          throw new Error('Failed to fetch game configuration');
        }

        const data = await response.json();
        setGameConfig(data.gameConfig);
        setTasks(data.tasks);
        setExplanationTrigger(data.gameConfig.explanation.explanation_trigger);
        
        // Notify backend that game has started for this session
        if (socket && socket.connected) {
          socket.emit('game-start', { sessionId });
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchGameConfig();

    /**
     * Set up EventsCenter listeners for communication between React and Phaser
     * Handles game initialization and forwards user interactions to backend
     */
    import('./game/EventsCenter').then(({ eventsCenter }) => {
      // Listen for Phaser game initialization completion
      eventsCenter.on('game-started', () => {
        setGameLoading(false);
      });

      // Forward device interactions from Phaser to backend via WebSocket
      eventsCenter.on('update-interaction-backend', (data: SocketInteractionUpdate) => {
        const socket = getSocket();
        if (socket && socket.connected) {
          data.sessionId = sessionId;
          socket.emit('device-interaction', data);
        }
      });

      // Forward general game interactions to backend for logging
      eventsCenter.on('game-interaction', (data: GameInteractionEvent) => {
        const socket = getSocket();
        if(socket && socket.connected){
          data.sessionId = sessionId;
          socket.emit('game-interaction', data); 
        }
      });
    });

    /**
     * Cleanup function to remove event listeners when component unmounts
     * Prevents memory leaks and duplicate listeners
     */
    return () => {
      socket.off('update-interaction');
      socket.off('explanation');
      socket.off('game-update');
      
      import('./game/EventsCenter').then(({ eventsCenter }) => {
        eventsCenter.off('game-started');
        eventsCenter.off('update-interaction-backend');
        eventsCenter.off('game-interaction');
      });
    };
  }, [router]);

  /**
   * Callback function to update tasks state when changes occur
   * @param updatedTasks New tasks array from sidebar component
   */
  const handleTasksUpdate = useCallback((updatedTasks: Task[]) => {
    setTasks(updatedTasks);
  }, []);

  /**
   * Opens the task abort modal for reason selection
   */
  const openAbortModal = () => {
    const currentTask = tasks[currentTaskIndex];
    if (currentTask && currentTask.abortionOptions) {
      setAbortReasons(currentTask.abortionOptions);
    }
    setIsAbortModalOpen(true);
  };
  
  /**
   * Closes the task abort modal
   */
  const closeAbortModal = () => {
    setIsAbortModalOpen(false);
  };

  /**
   * Handles task abortion with selected reason
   * @param reasonIndex Index of the selected abort reason
   */
  const handleAbortTask = async (reasonIndex: number) => {
    try {
      const sessionId = localStorage.getItem('smartHomeSessionId');
      const currentTask = tasks[currentTaskIndex];
      
      if (!sessionId || !currentTask) {
        console.error('Missing session ID or current task');
        return;
      }

      const socket = getSocket();
      if (socket && socket.connected) {
        socket.emit('task-abort', {
          sessionId,
          taskId: currentTask.taskId,
          abortOption: abortReasons[reasonIndex]
        });
      }

    } catch (error) {
      console.error('Error aborting task:', error);
    }
    setIsAbortModalOpen(false);
  };

  // Show loading spinner while fetching initial game data
  if (isLoading) {
    return (
      <div className="grid items-center justify-items-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-gray-900 dark:border-gray-100"></div>
      </div>
    );
  }

  // Three size tiers — canvas always 16:9, sidebar shrinks proportionally
  const canvas  = tier === 'lg' ? { w: 768, h: 432 }
                : tier === 'md' ? { w: 512, h: 288 }
                :                 { w: 384, h: 216 };
  const sidebar = tier === 'lg' ? 'w-64' : tier === 'md' ? 'w-48' : 'w-40';
  const gap     = tier === 'lg' ? 'ml-6' : 'ml-4';
  // env bar matches the combined width of sidebar + gap + canvas
  const envWidth = tier === 'lg' ? 'calc(16rem + 1.5rem + 48rem)'
                 : tier === 'md' ? 'calc(12rem + 1rem + 32rem)'
                 :                 'calc(10rem + 1rem + 24rem)';

  return (
<div className="flex flex-col items-center justify-center min-h-screen w-full bg-white dark:bg-gray-900">
  {/* Main layout: sidebar and game area arranged horizontally */}
  <div className="flex flex-row items-center justify-center">
    {/* Left sidebar: same height as canvas so it matches at every tier */}
    <div className={sidebar} style={{ height: canvas.h }}>
      <SmartHomeSidebar
        explanationTrigger={explanationTrigger}
        tasks={tasks || []}
        onTasksUpdate={handleTasksUpdate}
        currentTaskIndex={currentTaskIndex}
        setCurrentTaskIndex={setCurrentTaskIndex}
        onOpenAbortModal={openAbortModal}
      />
    </div>

    {/* Game area: Phaser canvas for smart home simulation */}
    <div className={`${gap} h-full`}>
      {/* Show skeleton loader while Phaser game initializes */}
      {gameLoading && (
        <Skeleton width={canvas.w} height={canvas.h} />
      )}

      {/* Render Phaser game once configuration is loaded */}
      {gameConfig ? (
        <PhaserGame config={gameConfig} width={canvas.w} height={canvas.h} />
      ) : (
        <div
          className="bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg"
          style={{ width: canvas.w, height: canvas.h }}
        ></div>
      )}
    </div>
  </div>

  {/* Environment bar: matches combined width of sidebar + gap + canvas */}
  <div className="mt-4" style={{ width: envWidth }}>
    <EnvironmentBar gameConfig={gameConfig} tasks={tasks} currentTaskId={currentTaskIndex} />
  </div>
  
  {/* Toast notification container for explanations and status messages */}
  <ToastContainer 
    position="top-right"
    autoClose={5000}
    hideProgressBar={false}
    newestOnTop
    closeOnClick
    rtl={false}
    pauseOnFocusLoss
    draggable
    pauseOnHover
    theme="colored"
    transition={Bounce} 
  />

  {/* Modal for task abortion reason selection */}
  <TaskAbortModal
    isOpen={isAbortModalOpen}
    onClose={closeAbortModal}
    onAbort={handleAbortTask}
    abortReasons={abortReasons}
  />
</div>
  );
}