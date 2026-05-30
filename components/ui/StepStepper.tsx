'use client'

interface StepStepperProps {
  currentStep: number
  totalSteps?: number
  dimmedSteps?: number[]
  labels?: string[]
}

const DEFAULT_LABELS = [
  'Orderlijst',
  'Basisplaat',
  'Afmetingen',
  'Categorie',
  'Afwerking',
  'Bewerkingen',
  'Aantal',
  'Overzicht',
]

export function StepStepper({
  currentStep,
  totalSteps = 8,
  dimmedSteps = [],
  labels = DEFAULT_LABELS,
}: StepStepperProps) {
  const steps = Array.from({ length: totalSteps }, (_, i) => i)

  return (
    <div className="flex items-center overflow-x-auto pb-1">
      {steps.map((step, idx) => {
        const isDimmed = dimmedSteps.includes(step)
        const isCompleted = step < currentStep
        const isActive = step === currentStep
        const label = labels[step] ?? `Stap ${step}`

        return (
          <div key={step} className="flex items-center shrink-0">
            <div className="flex flex-col items-center">
              <div
                className={`
                  w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold border-2 transition-all
                  ${isDimmed
                    ? 'bg-gray-100 border-gray-200 text-gray-300'
                    : isCompleted
                    ? 'bg-[var(--color-primary)] border-[var(--color-primary)] text-white'
                    : isActive
                    ? 'bg-white border-[var(--color-primary)] text-[var(--color-primary)] shadow-sm'
                    : 'bg-white border-gray-300 text-gray-400'
                  }
                `}
              >
                {isCompleted && !isDimmed ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  step
                )}
              </div>
              <span
                className={`text-xs mt-1 text-center whitespace-nowrap hidden md:block
                  ${isDimmed ? 'text-gray-300' : isActive ? 'text-[var(--color-primary)] font-medium' : isCompleted ? 'text-[var(--color-primary)]' : 'text-gray-400'}
                `}
                style={{ fontSize: '10px', maxWidth: '60px' }}
              >
                {label}
              </span>
            </div>
            {idx < totalSteps - 1 && (
              <div
                className={`w-6 sm:w-10 h-0.5 mx-1 shrink-0 ${
                  dimmedSteps.includes(step + 1) ? 'bg-gray-100' : step < currentStep ? 'bg-[var(--color-primary-muted)]' : 'bg-gray-200'
                }`}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
