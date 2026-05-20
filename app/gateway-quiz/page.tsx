"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Loader2, Sparkles, Compass, Feather, ArrowRight } from "lucide-react"
import { toast } from "sonner"

import { useAuth } from "@/lib/auth-context"
import {
  cleanNarration,
  findSectionFor,
  flattenQuestions,
  gatewayQuizService,
  type GatewayQuizAnswerResult,
  type GatewayQuizContent,
  type GatewayQuizOptionKey,
  type GatewayQuizQuestion,
} from "@/lib/gateway-quiz"

type Stage = "loading" | "intro" | "question" | "guidance" | "complete"

const OPTION_KEYS: GatewayQuizOptionKey[] = ["A", "B", "C", "D"]

export default function GatewayQuizPage() {
  const router = useRouter()
  const { user, loading: authLoading, refreshGatewayQuizStatus } = useAuth()

  const [stage, setStage] = useState<Stage>("loading")
  const [content, setContent] = useState<GatewayQuizContent | null>(null)
  const [currentQuestionNumber, setCurrentQuestionNumber] = useState(1)
  const [selectedOption, setSelectedOption] = useState<GatewayQuizOptionKey | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [starting, setStarting] = useState(false)
  const [lastResult, setLastResult] = useState<GatewayQuizAnswerResult | null>(null)
  const [completionMessage, setCompletionMessage] = useState<string>("")
  const [error, setError] = useState<string>("")

  const questions: GatewayQuizQuestion[] = useMemo(
    () => (content ? flattenQuestions(content) : []),
    [content],
  )
  const totalQuestions = content?.total_questions ?? questions.length
  const currentQuestion = questions.find(
    (q) => q.question_number === currentQuestionNumber,
  )
  const currentSection = content
    ? findSectionFor(content, currentQuestionNumber)
    : undefined

  // Redirect unauthenticated users to login.
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/auth/login")
    }
  }, [authLoading, user, router])

  // Load quiz content + current attempt state.
  useEffect(() => {
    if (!user) return
    let cancelled = false

    const load = async () => {
      try {
        const [contentData, statusData] = await Promise.all([
          gatewayQuizService.getContent(),
          gatewayQuizService.getStatus(),
        ])
        if (cancelled) return

        setContent(contentData)

        if (statusData.status === "completed") {
          setCompletionMessage(contentData.completion_message)
          setStage("complete")
          return
        }

        if (statusData.status === "in_progress") {
          setCurrentQuestionNumber(statusData.next_question_number ?? 1)
          setStage("question")
          return
        }

        setStage("intro")
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : "Unable to load the Gateway Quiz")
        setStage("intro")
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [user])

  const handleBegin = async () => {
    setStarting(true)
    setError("")
    try {
      const attempt = await gatewayQuizService.start()
      setCurrentQuestionNumber(attempt.next_question_number ?? 1)
      setStage("question")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to start the quiz"
      setError(message)
      toast.error(message)
    } finally {
      setStarting(false)
    }
  }

  const handleSubmitAnswer = async () => {
    if (!selectedOption || !currentQuestion) return
    setSubmitting(true)
    setError("")
    try {
      const result = await gatewayQuizService.submitAnswer(
        currentQuestion.question_number,
        selectedOption,
      )
      setLastResult(result)
      if (result.status === "completed" && result.completion_message) {
        setCompletionMessage(result.completion_message)
      }
      setStage("guidance")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to record your answer"
      setError(message)
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleContinue = () => {
    if (!lastResult) return
    if (lastResult.status === "completed") {
      setStage("complete")
      return
    }
    setCurrentQuestionNumber(lastResult.next_question_number ?? currentQuestionNumber + 1)
    setSelectedOption(null)
    setLastResult(null)
    setStage("question")
  }

  const handleEnterPlatform = async () => {
    await refreshGatewayQuizStatus()
    router.push("/dashboard")
  }

  if (authLoading || stage === "loading" || !content) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-navy">
        <Loader2 className="h-8 w-8 animate-spin text-gold" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-dark-navy flex flex-col">
      <header className="p-6 border-b border-gold/10">
        <Link href="/" className="inline-flex items-center gap-3 group">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.svg"
            alt="Evonaire"
            width={44}
            height={44}
            className="drop-shadow-[0_0_12px_rgba(217,181,116,0.4)]"
          />
          <span className="text-cream font-serif text-lg tracking-wide">Evonaire</span>
        </Link>
      </header>

      <main className="flex-1 container mx-auto px-4 py-10 max-w-3xl">
        {stage === "intro" && (
          <IntroPanel
            title={content.quiz_title}
            message={cleanNarration(content.opening_message)}
            totalQuestions={totalQuestions}
            onBegin={handleBegin}
            starting={starting}
            error={error}
          />
        )}

        {stage === "question" && currentQuestion && (
          <QuestionPanel
            question={currentQuestion}
            sectionTitle={currentSection?.title ?? ""}
            sectionTheme={currentSection?.theme ?? ""}
            totalQuestions={totalQuestions}
            selectedOption={selectedOption}
            onSelect={setSelectedOption}
            onSubmit={handleSubmitAnswer}
            submitting={submitting}
            error={error}
          />
        )}

        {stage === "guidance" && currentQuestion && lastResult && (
          <GuidancePanel
            question={currentQuestion}
            result={lastResult}
            totalQuestions={totalQuestions}
            onContinue={handleContinue}
          />
        )}

        {stage === "complete" && (
          <CompletionPanel
            message={cleanNarration(completionMessage || content.completion_message)}
            onEnter={handleEnterPlatform}
          />
        )}
      </main>
    </div>
  )
}

interface IntroPanelProps {
  title: string
  message: string
  totalQuestions: number
  starting: boolean
  error: string
  onBegin: () => void
}

function IntroPanel({ title, message, totalQuestions, starting, error, onBegin }: IntroPanelProps) {
  return (
    <div className="bg-[#141f2a] border border-gold/20 rounded-2xl p-10 shadow-[0_8px_40px_rgba(0,0,0,0.4)]">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gold/10 mb-5">
          <Compass className="w-8 h-8 text-gold" />
        </div>
        <h1 className="text-3xl font-serif text-cream mb-3 tracking-wide">{title}</h1>
        <p className="text-cream/50 text-sm">
          {totalQuestions} reflections · take your time, there is no rush here
        </p>
      </div>

      <blockquote className="border-l-2 border-gold/40 pl-5 my-8 text-cream/80 leading-relaxed font-serif text-lg whitespace-pre-line">
        {message}
      </blockquote>

      {error && (
        <p className="text-red-300/90 text-sm text-center mb-4">{error}</p>
      )}

      <div className="flex justify-center">
        <button
          onClick={onBegin}
          disabled={starting}
          className="inline-flex items-center justify-center gap-2 min-w-[200px] h-12 rounded-xl bg-gold text-dark-navy font-semibold text-sm hover:bg-gold-muted transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(217,181,116,0.25)]"
        >
          {starting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Opening the gateway…
            </>
          ) : (
            <>
              Begin the Gateway
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </div>
  )
}

interface QuestionPanelProps {
  question: GatewayQuizQuestion
  sectionTitle: string
  sectionTheme: string
  totalQuestions: number
  selectedOption: GatewayQuizOptionKey | null
  submitting: boolean
  error: string
  onSelect: (option: GatewayQuizOptionKey) => void
  onSubmit: () => void
}

function QuestionPanel({
  question,
  sectionTitle,
  sectionTheme,
  totalQuestions,
  selectedOption,
  submitting,
  error,
  onSelect,
  onSubmit,
}: QuestionPanelProps) {
  const progressPct = Math.round((question.question_number / totalQuestions) * 100)

  return (
    <div className="space-y-6">
      <ProgressHeader
        questionNumber={question.question_number}
        totalQuestions={totalQuestions}
        progressPct={progressPct}
        sectionTitle={sectionTitle}
        sectionTheme={sectionTheme}
      />

      <div className="bg-[#141f2a] border border-gold/20 rounded-2xl p-8 shadow-[0_8px_40px_rgba(0,0,0,0.4)]">
        <h2 className="text-xl md:text-2xl font-serif text-cream leading-snug mb-8">
          {question.question_text}
        </h2>

        <div className="space-y-3">
          {OPTION_KEYS.map((key) => {
            const optionText = question.options[key]
            if (!optionText) return null
            const isSelected = selectedOption === key
            return (
              <button
                key={key}
                type="button"
                onClick={() => onSelect(key)}
                className={`w-full text-left flex items-start gap-4 rounded-xl px-5 py-4 border transition-all duration-200 ${
                  isSelected
                    ? "border-gold/70 bg-gold/10 shadow-[0_0_18px_rgba(217,181,116,0.15)]"
                    : "border-gold/15 bg-dark-navy hover:border-gold/40 hover:bg-gold/5"
                }`}
                aria-pressed={isSelected}
              >
                <span
                  className={`flex-none w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                    isSelected
                      ? "bg-gold text-dark-navy"
                      : "bg-gold/10 text-gold"
                  }`}
                >
                  {key}
                </span>
                <span className="text-cream/90 leading-relaxed pt-1">{optionText}</span>
              </button>
            )
          })}
        </div>

        {error && (
          <p className="text-red-300/90 text-sm text-center mt-6">{error}</p>
        )}

        <div className="mt-8 flex justify-end">
          <button
            onClick={onSubmit}
            disabled={!selectedOption || submitting}
            className="inline-flex items-center justify-center gap-2 min-w-[180px] h-12 rounded-xl bg-gold text-dark-navy font-semibold text-sm hover:bg-gold-muted transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(217,181,116,0.25)]"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Reflecting…
              </>
            ) : (
              <>
                Offer Reflection
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

interface GuidancePanelProps {
  question: GatewayQuizQuestion
  result: GatewayQuizAnswerResult
  totalQuestions: number
  onContinue: () => void
}

function GuidancePanel({ question, result, totalQuestions, onContinue }: GuidancePanelProps) {
  const isFinal = result.status === "completed"
  const correctText = result.correct_option_text || question.options[result.correct_option]
  const aligned = result.is_correct
  const headline = aligned
    ? "Your reflection resonates with the sanctuary."
    : "A gentle thread of guidance for you."

  const body = aligned
    ? "The path you chose holds the same care Evonaire is built on. Carry it forward."
    : `The wisdom we hold here points toward ${result.correct_option} — ${correctText}. Each question is an invitation, not a measure. Receive this gently and continue with us.`

  const progressPct = Math.round((question.question_number / totalQuestions) * 100)

  return (
    <div className="space-y-6">
      <ProgressHeader
        questionNumber={question.question_number}
        totalQuestions={totalQuestions}
        progressPct={progressPct}
        sectionTitle=""
        sectionTheme=""
      />

      <div className="bg-[#141f2a] border border-gold/20 rounded-2xl p-8 shadow-[0_8px_40px_rgba(0,0,0,0.4)]">
        <div className="flex items-center gap-3 mb-5">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-gold/10">
            <Feather className="w-5 h-5 text-gold" />
          </div>
          <h2 className="font-serif text-xl text-cream tracking-wide">{headline}</h2>
        </div>

        <p className="text-cream/80 leading-relaxed mb-6">{body}</p>

        <div className="rounded-xl border border-gold/15 bg-dark-navy/60 p-5">
          <p className="text-cream/40 text-xs uppercase tracking-widest mb-2">The question</p>
          <p className="text-cream/90 font-serif leading-relaxed mb-4">
            {question.question_text}
          </p>
          <p className="text-cream/40 text-xs uppercase tracking-widest mb-2">The Evonaire path</p>
          <p className="text-cream leading-relaxed">
            <span className="text-gold font-semibold mr-2">{result.correct_option}.</span>
            {correctText}
          </p>
        </div>

        <div className="mt-8 flex justify-end">
          <button
            onClick={onContinue}
            className="inline-flex items-center justify-center gap-2 min-w-[180px] h-12 rounded-xl bg-gold text-dark-navy font-semibold text-sm hover:bg-gold-muted transition-all duration-300 shadow-[0_0_20px_rgba(217,181,116,0.25)]"
          >
            {isFinal ? "View the Gateway" : "Continue"}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

function CompletionPanel({ message, onEnter }: { message: string; onEnter: () => void }) {
  return (
    <div className="bg-[#141f2a] border border-gold/20 rounded-2xl p-10 shadow-[0_8px_40px_rgba(0,0,0,0.4)]">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gold/10 mb-5">
          <Sparkles className="w-8 h-8 text-gold" />
        </div>
        <h1 className="text-3xl font-serif text-cream mb-3 tracking-wide">
          You have passed through the Gateway
        </h1>
        <p className="text-cream/50 text-sm">Welcome to Evonaire</p>
      </div>

      <blockquote className="border-l-2 border-gold/40 pl-5 my-8 text-cream/80 leading-relaxed font-serif text-lg whitespace-pre-line">
        {message}
      </blockquote>

      <div className="flex justify-center">
        <button
          onClick={onEnter}
          className="inline-flex items-center justify-center gap-2 min-w-[200px] h-12 rounded-xl bg-gold text-dark-navy font-semibold text-sm hover:bg-gold-muted transition-all duration-300 shadow-[0_0_20px_rgba(217,181,116,0.25)]"
        >
          Enter Evonaire
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

interface ProgressHeaderProps {
  questionNumber: number
  totalQuestions: number
  progressPct: number
  sectionTitle: string
  sectionTheme: string
}

function ProgressHeader({
  questionNumber,
  totalQuestions,
  progressPct,
  sectionTitle,
  sectionTheme,
}: ProgressHeaderProps) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs text-cream/50 mb-2">
        <span className="uppercase tracking-widest">
          Question {questionNumber} of {totalQuestions}
        </span>
        {sectionTitle && (
          <span className="text-gold/70 truncate ml-3 text-right">{sectionTitle}</span>
        )}
      </div>
      <div className="h-1.5 w-full bg-gold/10 rounded-full overflow-hidden">
        <div
          className="h-full bg-gold transition-all duration-500"
          style={{ width: `${progressPct}%` }}
        />
      </div>
      {sectionTheme && (
        <p className="text-cream/40 text-xs mt-2 italic">{sectionTheme}</p>
      )}
    </div>
  )
}
