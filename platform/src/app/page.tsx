"use client";

import Image from "next/image";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { v4 as uuidv4 } from 'uuid';

/**
 * Home page component for the Virtual Smart Home Platform
 * Handles user onboarding, session management, and study initialization
 */
export default function Home() {
  const router = useRouter();
  /** Whether user can proceed to study (valid survey data received) */
  const [isValid, setIsValid] = useState(false);
  /** Custom data from URL parameters (survey responses) */
  const [customData, setCustomData] = useState<Record<string, unknown> | null>(null);
  /** Loading state for async operations */
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Verifies if an existing session ID is still valid and active
   * Redirects to study if valid, clears localStorage if invalid
   * @param sessionId The session ID to verify
   */
  const verifyExistingSession = useCallback(async (sessionId: string) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/verify-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sessionId }),
      });

      const verifyData = await response.json();
      
      if (response.ok && verifyData.isValid) {
        setIsValid(true);
        router.push(`/study`);
      } else {
        localStorage.removeItem("smartHomeSessionId");
        router.refresh();
      }
    } catch (error) {
      console.error('Error verifying session:', error);
      localStorage.removeItem("smartHomeSessionId");
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  /**
   * Effect hook that runs on component mount to:
   * 1. Process URL parameters for survey data
   * 2. Check for existing sessions and verify them
   * 3. Enable/disable study access based on data availability
   */
  useEffect(() => {
    const customData = {};

    setIsValid(true);

    setCustomData(customData);
    
    const existingSessionId = localStorage.getItem("smartHomeSessionId");
    
    if (existingSessionId) {
      verifyExistingSession(existingSessionId);
    }
  }, [verifyExistingSession]);

  /**
   * Initiates a new study session by:
   * 1. Generating a unique session ID
   * 2. Creating session data with user metadata
   * 3. Sending session to backend for storage
   * 4. Redirecting to the study interface
   */
  const startStudy = async () => {
    if (!isValid) return;
    
    setIsLoading(true);
    
    try {
      const sessionId = uuidv4();
      
      const sessionData = {
        sessionId: sessionId,
        startTime: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        userAgent: navigator.userAgent,
        screenSize: {
          width: window.innerWidth,
          height: window.innerHeight
        },
        isCompleted: false,
        custom_data: customData
      };
      
      const response = await fetch('/api/create-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(sessionData),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        
        if (response.status === 409 && errorData.existingSessionId) {
          localStorage.setItem("smartHomeSessionId", errorData.existingSessionId);
          router.push(`/study`);
          return;
        }
        
        throw new Error(errorData.error || 'Failed to create session');
      }
      
      await response.json();
      
      localStorage.setItem("smartHomeSessionId", sessionId);
      router.push("/study");
    } catch (error) {
      console.error('Error creating session:', error);
    }
  };

  return (
    <div className="grid grid-rows-[auto_1fr_auto] min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header with platform branding */}
      <header className="w-full p-4 sm:p-6 bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="/smart_home.png"
              alt="Smart Home Icon"
              width={40}
              height={40}
              priority
              className="dark:hidden"
            />
            <Image
              src="/smart_home_dm.png"
              alt="Smart Home Icon"
              width={40}
              height={40}
              priority
              className="hidden dark:block"
            />
            <h1 className="text-xl sm:text-2xl font-bold">V-SHiNE Platform</h1>
          </div>
        </div>
      </header>

      {/* Main content area with study onboarding */}
      <main className="flex flex-col items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 sm:p-8">
          <h2 className="text-2xl font-semibold mb-6 text-center">V-SHiNE Demo</h2>
          
          <p className="mb-6 text-gray-600 dark:text-gray-300">
            Welcome to our research study on smart home interactions. You&apos;ll explore various scenarios and provide feedback on your experience.
          </p>
          
          <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
            <p className="text-blue-800 dark:text-blue-300 text-sm">
              Please note that, in a real study, this part can host any questionnaire. The collected responses can then be passed to the game as personalized user context, allowing different game settings and behaviors to be adapted to each participant.
            </p>
          </div>
          
          {/* Study start button with loading state */}
          <button
            onClick={startStudy}
            disabled={!isValid || isLoading}
            className={`w-full py-3 px-4 rounded-md text-white text-center font-medium transition ${
              isValid && !isLoading
                ? "bg-blue-600 hover:bg-blue-700"
                : "bg-gray-400 cursor-not-allowed"
            }`}
          >
            {isLoading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing...
              </span>
            ) : (
              "Proceed to Demo"
            )}
          </button>
          
        </div>
      </main>

      {/* Footer with copyright information */}
      <footer className="w-full p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
        <div className="max-w-5xl mx-auto text-center text-sm text-gray-500 dark:text-gray-400">
          <p>© 2026 V-SHiNE Platform</p>
        </div>
      </footer>
    </div>
  );
}