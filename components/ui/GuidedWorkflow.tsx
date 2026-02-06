import React, { useState } from 'react'
import { cn } from '@/lib/design-system'
import { X, ChevronLeft, ChevronRight, Check } from 'lucide-react'
import { Button } from './Button'
import { Modal } from './Modal'

interface WorkflowStep {
  id: string
  title: string
  description: string
  content: React.ReactNode
  validation?: () => boolean | Promise<boolean>
  helpText?: string
}

interface GuidedWorkflowProps {
  title: string
  steps: WorkflowStep[]
  isOpen: boolean
  onClose: () => void
  onComplete: () => void
  className?: string
}

/**
 * Guided workflow component for complex multi-step processes
 * Provides step-by-step guidance with validation
 */
export const GuidedWorkflow: React.FC<GuidedWorkflowProps> = ({
  title,
  steps,
  isOpen,
  onClose,
  onComplete,
  className
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set())
  const [validating, setValidating] = useState(false)

  const currentStep = steps[currentStepIndex]
  const isFirstStep = currentStepIndex === 0
  const isLastStep = currentStepIndex === steps.length - 1

  const handleNext = async () => {
    if (currentStep.validation) {
      setValidating(true)
      try {
        const isValid = await currentStep.validation()
        if (!isValid) {
          setValidating(false)
          return
        }
      } catch (error) {
        console.error('Validation error:', error)
        setValidating(false)
        return
      }
      setValidating(false)
    }

    setCompletedSteps(prev => new Set(prev).add(currentStepIndex))

    if (isLastStep) {
      onComplete()
    } else {
      setCurrentStepIndex(prev => prev + 1)
    }
  }

  const handleBack = () => {
    if (!isFirstStep) {
      setCurrentStepIndex(prev => prev - 1)
    }
  }

  const handleStepClick = (index: number) => {
    // Allow navigation to completed steps or the next step
    if (completedSteps.has(index) || index === currentStepIndex + 1) {
      setCurrentStepIndex(index)
    }
  }

  const handleClose = () => {
    setCurrentStepIndex(0)
    setCompletedSteps(new Set())
    onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={title}
      size="xl"
      className={className}
    >
      <div className="flex flex-col h-full">
        {/* Progress Steps */}
        <div className="flex items-center justify-between mb-6 pb-6 border-b border-gray-200 dark:border-slate-700">
          {steps.map((step, index) => {
            const isCompleted = completedSteps.has(index)
            const isCurrent = index === currentStepIndex
            const isAccessible = isCompleted || index === currentStepIndex || completedSteps.has(index - 1)

            return (
              <React.Fragment key={step.id}>
                <button
                  onClick={() => handleStepClick(index)}
                  disabled={!isAccessible}
                  className={cn(
                    'flex flex-col items-center gap-2 transition-all',
                    isAccessible ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'
                  )}
                >
                  <div
                    className={cn(
                      'w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all',
                      isCompleted && 'bg-green-500 border-green-500',
                      isCurrent && !isCompleted && 'bg-blue-500 border-blue-500',
                      !isCompleted && !isCurrent && 'bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-600'
                    )}
                  >
                    {isCompleted ? (
                      <Check className="w-5 h-5 text-white" />
                    ) : (
                      <span
                        className={cn(
                          'text-sm font-medium',
                          isCurrent ? 'text-white' : 'text-gray-500 dark:text-slate-400'
                        )}
                      >
                        {index + 1}
                      </span>
                    )}
                  </div>
                  <span
                    className={cn(
                      'text-xs font-medium text-center max-w-[100px]',
                      isCurrent && 'text-blue-600 dark:text-blue-400',
                      isCompleted && 'text-green-600 dark:text-green-400',
                      !isCurrent && !isCompleted && 'text-gray-500 dark:text-slate-400'
                    )}
                  >
                    {step.title}
                  </span>
                </button>

                {index < steps.length - 1 && (
                  <div
                    className={cn(
                      'flex-1 h-0.5 mx-2 transition-colors',
                      completedSteps.has(index) ? 'bg-green-500' : 'bg-gray-300'
                    )}
                  />
                )}
              </React.Fragment>
            )
          })}
        </div>

        {/* Step Content */}
        <div className="flex-1 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-2">
            {currentStep.title}
          </h3>
          <p className="text-sm text-gray-600 dark:text-slate-400 mb-4">
            {currentStep.description}
          </p>

          <div className="space-y-4">
            {currentStep.content}
          </div>

          {currentStep.helpText && (
            <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-sm text-blue-800 dark:text-blue-300">
                <strong>Tip:</strong> {currentStep.helpText}
              </p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between pt-6 border-t border-gray-200 dark:border-slate-700">
          <Button
            variant="secondary"
            onClick={handleBack}
            disabled={isFirstStep}
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Back
          </Button>

          <div className="text-sm text-gray-600 dark:text-slate-400">
            Step {currentStepIndex + 1} of {steps.length}
          </div>

          <Button
            variant="primary"
            onClick={handleNext}
            loading={validating}
            disabled={validating}
          >
            {isLastStep ? 'Complete' : 'Next'}
            {!isLastStep && <ChevronRight className="w-4 h-4 ml-2" />}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

interface HelpPanelProps {
  title: string
  content: React.ReactNode
  isOpen: boolean
  onClose: () => void
  position?: 'left' | 'right'
  className?: string
}

/**
 * Slide-out help panel for contextual documentation
 */
export const HelpPanel: React.FC<HelpPanelProps> = ({
  title,
  content,
  isOpen,
  onClose,
  position = 'right',
  className
}) => {
  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={cn(
          'fixed top-0 bottom-0 w-96 bg-white dark:bg-slate-800 shadow-xl z-50 transform transition-transform duration-300',
          position === 'right' ? 'right-0' : 'left-0',
          isOpen ? 'translate-x-0' : position === 'right' ? 'translate-x-full' : '-translate-x-full',
          className
        )}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-slate-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">{title}</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:text-slate-400 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {content}
          </div>
        </div>
      </div>
    </>
  )
}

export default GuidedWorkflow
