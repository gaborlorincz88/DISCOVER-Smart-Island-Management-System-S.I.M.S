import React, { useEffect, useState, useRef, useCallback } from 'react';
import { onboardingSteps, OnboardingStep } from '../config/onboardingSteps';

interface OnboardingFlowProps {
  isOpen: boolean;
  onComplete: () => void;
  onSkip: () => void;
  theme?: 'light' | 'dark';
}

interface ElementBounds {
  top: number;
  left: number;
  width: number;
  height: number;
  bottom: number;
  right: number;
}

const OnboardingFlow: React.FC<OnboardingFlowProps> = ({
  isOpen,
  onComplete,
  onSkip,
  theme = 'light',
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [targetBounds, setTargetBounds] = useState<ElementBounds | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const currentStep = onboardingSteps[currentStepIndex];

  // Find and calculate bounds for target element
  const updateTargetBounds = useCallback(async (step: OnboardingStep) => {
    setIsLoading(true);

    // Execute pre-action first if specified (to prepare UI)
    if (step.preAction) {
      await step.preAction();
      // Wait for DOM to update after pre-action
      await new Promise(resolve => setTimeout(resolve, 400));
    }

    // Wait for element if needed (after pre-action)
    let element: Element | null = null;
    if (step.waitForElement !== false) {
      element = document.querySelector(step.targetSelector);
      let attempts = 0;
      const maxAttempts = step.waitForElement ? 30 : 5;
      
      while (!element && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 100));
        element = document.querySelector(step.targetSelector);
        attempts++;
      }
    } else {
      // Don't wait, just try once
      element = document.querySelector(step.targetSelector);
    }
    
    if (!element) {
      console.warn(`Onboarding: Element not found for selector: ${step.targetSelector}`);
      setIsLoading(false);
      // Skip to next step if element not found
      if (currentStepIndex < onboardingSteps.length - 1) {
        setTimeout(() => setCurrentStepIndex(prev => prev + 1), 500);
      } else {
        onComplete();
      }
      return;
    }

    const rect = element.getBoundingClientRect();
    const padding = step.highlightPadding || 8;
    
    setTargetBounds({
      top: rect.top - padding,
      left: rect.left - padding,
      width: rect.width + (padding * 2),
      height: rect.height + (padding * 2),
      bottom: rect.bottom + padding,
      right: rect.right + padding,
    });

    setIsLoading(false);

    // Scroll element into view if needed (only for elements that might be off-screen)
    const isVisible = rect.top >= 0 && rect.left >= 0 && 
                     rect.bottom <= window.innerHeight && 
                     rect.right <= window.innerWidth;
    
    if (!isVisible) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    }
  }, [currentStepIndex, onComplete]);

  useEffect(() => {
    // Add/remove body class for onboarding
    if (isOpen) {
      document.body.classList.add('onboarding-active');
    } else {
      document.body.classList.remove('onboarding-active');
    }

    return () => {
      document.body.classList.remove('onboarding-active');
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && currentStep) {
      updateTargetBounds(currentStep);
      
      // Update bounds on scroll/resize
      const handleUpdate = () => updateTargetBounds(currentStep);
      window.addEventListener('scroll', handleUpdate, true);
      window.addEventListener('resize', handleUpdate);

      return () => {
        window.removeEventListener('scroll', handleUpdate, true);
        window.removeEventListener('resize', handleUpdate);
      };
    }
  }, [isOpen, currentStep, updateTargetBounds]);

  const handleNext = () => {
    if (currentStepIndex < onboardingSteps.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    } else {
      onComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
    }
  };

  const handleSkip = () => {
    const completedSteps = currentStepIndex + 1;
    const totalSteps = onboardingSteps.length;
    const progress = Math.round((completedSteps / totalSteps) * 100);
    
    const message = `You've completed ${completedSteps} of ${totalSteps} steps (${progress}%). Would you like to finish the rest? It only takes a moment!`;
    
    if (window.confirm(message)) {
      // User wants to continue
      return;
    } else {
      // User confirms skip
      onSkip();
    }
  };

  if (!isOpen || !currentStep) return null;

  const isDark = theme === 'dark';
  const overlayColor = isDark ? 'rgba(0, 0, 0, 0.85)' : 'rgba(0, 0, 0, 0.75)';
  const cardBg = isDark ? 'rgb(30, 41, 59)' : 'rgb(255, 255, 255)';
  const cardText = isDark ? 'rgb(241, 245, 249)' : 'rgb(30, 41, 59)';
  const cardSecondary = isDark ? 'rgb(148, 163, 184)' : 'rgb(71, 85, 105)';
  const highlightColor = 'rgba(14, 165, 233, 0.3)'; // sky-500 with opacity
  const highlightBorderColor = 'rgb(14, 165, 233)'; // sky-500

  // Calculate tooltip position
  const getTooltipStyle = (): React.CSSProperties => {
    if (!targetBounds) return { display: 'none' };

    const isMobile = window.innerWidth < 768;
    const tooltipWidth = isMobile ? Math.min(280, window.innerWidth - 32) : 280;
    const tooltipHeight = tooltipRef.current?.offsetHeight || 200;
    const spacing = 16;

    let top = 0;
    let left = 0;
    let arrowPosition: { top?: number; bottom?: number; left?: number; right?: number } = {};

    switch (currentStep.tooltipPosition) {
      case 'top':
        top = targetBounds.top - tooltipHeight - spacing;
        left = targetBounds.left + (targetBounds.width / 2) - (tooltipWidth / 2);
        arrowPosition = { bottom: -8, left: '50%', transform: 'translateX(-50%)' };
        break;
      case 'bottom':
        top = targetBounds.bottom + spacing;
        left = targetBounds.left + (targetBounds.width / 2) - (tooltipWidth / 2);
        arrowPosition = { top: -8, left: '50%', transform: 'translateX(-50%)' };
        break;
      case 'left':
        top = targetBounds.top + (targetBounds.height / 2) - (tooltipHeight / 2);
        left = targetBounds.left - tooltipWidth - spacing;
        arrowPosition = { right: -8, top: '50%', transform: 'translateY(-50%)' };
        break;
      case 'right':
        top = targetBounds.top + (targetBounds.height / 2) - (tooltipHeight / 2);
        left = targetBounds.right + spacing;
        arrowPosition = { left: -8, top: '50%', transform: 'translateY(-50%)' };
        break;
      case 'center':
        // Special handling for registration benefits - show at bottom center of screen
        if (currentStep.id === 'registration-benefits') {
          const viewportWidth = window.innerWidth;
          const viewportHeight = window.innerHeight;
          top = viewportHeight - tooltipHeight - 24;
          left = (viewportWidth / 2) - (tooltipWidth / 2);
        } else {
          top = targetBounds.top + (targetBounds.height / 2) - (tooltipHeight / 2);
          left = targetBounds.left + (targetBounds.width / 2) - (tooltipWidth / 2);
        }
        break;
    }

    // Keep tooltip within viewport
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    if (left < 16) left = 16;
    if (left + tooltipWidth > viewportWidth - 16) {
      left = viewportWidth - tooltipWidth - 16;
    }

    if (top < 16) top = 16;
    if (top + tooltipHeight > viewportHeight - 16) {
      top = viewportHeight - tooltipHeight - 16;
    }

    return {
      position: 'fixed',
      top: `${top}px`,
      left: `${left}px`,
      width: `${tooltipWidth}px`,
      maxWidth: 'calc(100vw - 32px)',
      zIndex: 10001,
    };
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[10000] transition-opacity duration-300"
      style={{
        backgroundColor: 'transparent',
        opacity: isLoading ? 0.5 : 1,
      }}
      onClick={(e) => {
        // Only allow clicking outside if it's not the overlay itself
        if (e.target === overlayRef.current) {
          // Prevent accidental dismissal
        }
      }}
    >
      {/* Dimmed Background with Spotlight Cutout using box-shadow technique */}
      {targetBounds && !isLoading ? (
        <>
          {/* Top section */}
          <div
            className="absolute"
            style={{
              top: 0,
              left: 0,
              right: 0,
              height: `${targetBounds.top}px`,
              backgroundColor: overlayColor,
            }}
          />
          {/* Bottom section */}
          <div
            className="absolute"
            style={{
              top: `${targetBounds.bottom}px`,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: overlayColor,
            }}
          />
          {/* Left section */}
          <div
            className="absolute"
            style={{
              top: `${targetBounds.top}px`,
              left: 0,
              width: `${targetBounds.left}px`,
              height: `${targetBounds.height}px`,
              backgroundColor: overlayColor,
            }}
          />
          {/* Right section */}
          <div
            className="absolute"
            style={{
              top: `${targetBounds.top}px`,
              left: `${targetBounds.right}px`,
              right: 0,
              height: `${targetBounds.height}px`,
              backgroundColor: overlayColor,
            }}
          />
        </>
      ) : (
        <div className="absolute inset-0" style={{ backgroundColor: overlayColor }} />
      )}

      {/* Highlight Border around Target */}
      {targetBounds && !isLoading && (
        <div
          className="absolute pointer-events-none animate-pulse"
          style={{
            top: `${targetBounds.top}px`,
            left: `${targetBounds.left}px`,
            width: `${targetBounds.width}px`,
            height: `${targetBounds.height}px`,
            border: `3px solid ${highlightBorderColor}`,
            borderRadius: '8px',
            boxShadow: `0 0 0 4px ${highlightColor}, 0 0 20px ${highlightColor}`,
            zIndex: 10000,
            transition: 'all 0.3s ease',
          }}
        />
      )}

      {/* Tooltip Card */}
      {targetBounds && !isLoading && currentStep && (
        <div
          ref={tooltipRef}
          className="absolute rounded-xl shadow-2xl p-4 md:p-6 transition-all duration-300"
          style={{
            ...getTooltipStyle(),
            backgroundColor: cardBg,
            color: cardText,
            maxHeight: '90vh',
            overflowY: 'auto',
          }}
        >
          {/* Arrow - Hide for registration benefits when positioned at bottom */}
          {currentStep.tooltipPosition !== 'center' && !(currentStep.id === 'registration-benefits') && (
            <div
              className="absolute w-4 h-4"
              style={{
                ...(currentStep.tooltipPosition === 'top' && {
                  bottom: -8,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  borderLeft: '8px solid transparent',
                  borderRight: '8px solid transparent',
                  borderTop: `8px solid ${cardBg}`,
                }),
                ...(currentStep.tooltipPosition === 'bottom' && {
                  top: -8,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  borderLeft: '8px solid transparent',
                  borderRight: '8px solid transparent',
                  borderBottom: `8px solid ${cardBg}`,
                }),
                ...(currentStep.tooltipPosition === 'left' && {
                  right: -8,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  borderTop: '8px solid transparent',
                  borderBottom: '8px solid transparent',
                  borderLeft: `8px solid ${cardBg}`,
                }),
                ...(currentStep.tooltipPosition === 'right' && {
                  left: -8,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  borderTop: '8px solid transparent',
                  borderBottom: '8px solid transparent',
                  borderRight: `8px solid ${cardBg}`,
                }),
              }}
            />
          )}

          {/* Content */}
          <h3
            className="text-xl font-bold mb-2"
            style={{ color: cardText }}
          >
            {currentStep.title}
          </h3>
          <p
            className="text-sm mb-6 leading-relaxed"
            style={{ color: cardSecondary }}
          >
            {currentStep.description}
          </p>

          {/* Navigation */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mt-4">
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: cardSecondary }}>
                {currentStepIndex + 1} of {onboardingSteps.length}
              </span>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={handlePrevious}
                disabled={currentStepIndex === 0}
                className="flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                  color: cardText,
                }}
              >
                Previous
              </button>
              <button
                onClick={handleSkip}
                className="flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all"
                style={{
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                  color: cardText,
                }}
              >
                Skip
              </button>
              <button
                onClick={handleNext}
                className="flex-1 sm:flex-none px-4 sm:px-6 py-2 rounded-lg text-xs sm:text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-95"
                style={{
                  backgroundColor: 'rgb(14, 165, 233)', // sky-500
                }}
              >
                {currentStepIndex === onboardingSteps.length - 1 ? 'Finish' : 'Next'}
              </button>
            </div>
          </div>

          {/* Progress Indicator */}
          <div className="mt-4 h-1 rounded-full overflow-hidden" style={{ backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }}>
            <div
              className="h-full transition-all duration-300"
              style={{
                width: `${((currentStepIndex + 1) / onboardingSteps.length) * 100}%`,
                backgroundColor: 'rgb(14, 165, 233)',
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default OnboardingFlow;

