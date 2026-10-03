"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { ArrowLeft, Check, ExternalLink, X } from "lucide-react";
import type { QuizState, QuizQuestionView } from "@/server/quizzes/service";
import { answerQuestion, startQuiz } from "@/app/actions/quiz";
import { TypeBadge } from "@/components/learn/badges";
import { Mascot } from "@/components/mascot";

const CHOICES = ["A", "B", "C", "D"] as const;
const PASS = 16;

export function QuizPlayer({ state, moduleTitle, whopUrl }: { state: QuizState; moduleTitle: string; whopUrl: string | null }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md lg:max-w-2xl lg:pt-6 flex-col px-4 pb-10">
      <header className="flex items-center gap-3 py-5">
        <Link href="/learn" className="rounded-full bg-card p-2 text-muted" aria-label="Retour à ma progression">
          <ArrowLeft size={18} />
        </Link>
        <TypeBadge type="UNDERSTANDING" size={32} />
        <div className="min-w-0">
          <p className="text-xs text-muted">{moduleTitle} · Compréhension</p>
          <h1 className="line-clamp-2 break-words leading-snug font-semibold">{state.lessonTitle}</h1>
        </div>
      </header>
      {state.status === "IN_PROGRESS" ? (
        <Playing state={state} />
      ) : (
        <Lobby state={state} whopUrl={whopUrl} />
      )}
    </main>
  );
}

function Lobby({ state, whopUrl }: { state: QuizState; whopUrl: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const launch = () =>
    start(async () => {
      const res = await startQuiz(state.lessonId);
      if (res.ok) router.refresh();
      else setError(res.error);
    });

  if (state.status === "NOT_READY") {
    return <Card title="Ce QCM n'est pas encore prêt" text="Reviens un peu plus tard : les questions arrivent bientôt." />;
  }
  if (state.status === "PASSED") {
    return (
      <Passed score={state.bestScore ?? 0} attempts={state.attemptCount} />
    );
  }
  if (state.status === "COOLDOWN" && state.lastResult) {
    return <Failed score={state.lastResult.score} until={state.cooldownUntil!} whopUrl={whopUrl} onRetry={launch} pending={pending} error={error} />;
  }
  return (
    <div className="mt-6 space-y-4">
      <div className="rounded-3xl border border-line bg-card p-6">
        <h2 className="text-xl font-semibold">Prêt pour le QCM ?</h2>
        <ul className="mt-4 space-y-2 text-sm text-muted">
          <li>• 20 questions, 4 réponses possibles.</li>
          <li>
            • Il te faut <span className="font-semibold text-text">16/20</span> pour valider.
          </li>
          <li>• Ta réponse est définitive : la correction s&apos;affiche tout de suite.</li>
          <li>• Si tu rates, tu revois le module sur Whop et tu réessaies 5 minutes après.</li>
        </ul>
        {state.lastResult && (
          <p className="mt-4 text-sm text-muted">
            Dernier essai : {state.lastResult.score}/20 · {state.attemptCount} tentative{state.attemptCount > 1 ? "s" : ""}
          </p>
        )}
      </div>
      <PrimaryButton onClick={launch} disabled={pending}>
        {pending ? "Chargement…" : state.attemptCount ? "Réessayer le QCM" : "Commencer le QCM"}
      </PrimaryButton>
      {error && <p className="text-center text-sm text-danger">{error}</p>}
    </div>
  );
}

function Playing({ state }: { state: QuizState }) {
  const [questions, setQuestions] = useState<QuizQuestionView[]>(state.questions);
  const firstOpen = questions.findIndex((q) => !q.answered);
  const [index, setIndex] = useState(firstOpen === -1 ? questions.length - 1 : firstOpen);
  const [finished, setFinished] = useState<{ score: number; passed: boolean } | null>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  if (finished) return <Passed score={finished.score} attempts={state.attemptCount + 1} />;

  const q = questions[index];
  const answeredCount = questions.filter((x) => x.answered).length;
  const correctCount = questions.filter((x) => x.answered?.isCorrect).length;

  const choose = (choice: (typeof CHOICES)[number]) =>
    start(async () => {
      setError(null);
      const res = await answerQuestion({ lessonId: state.lessonId, position: q.position, choice });
      if (!res.ok) return setError(res.error);
      const { isCorrect, correct, explanation, finished: done } = res.data;
      setQuestions((prev) =>
        prev.map((x) => (x.position === q.position ? { ...x, answered: { selected: choice, correct, isCorrect, explanation } } : x)),
      );
      if (done?.passed) setFinished(done);
      else if (done) router.refresh(); // échec : le serveur impose l'attente de 5 minutes
    });

  const isLast = index === questions.length - 1;

  return (
    <div className="mt-2 flex flex-1 flex-col">
      <div className="flex items-center justify-between text-xs text-muted">
        <span>
          Question {index + 1}/{questions.length}
        </span>
        <span>
          <span className="text-success">{correctCount}</span> bonne{correctCount > 1 ? "s" : ""} réponse{correctCount > 1 ? "s" : ""}
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-card-2">
        <div className="h-full rounded-full bg-gold transition-all" style={{ width: `${(answeredCount / questions.length) * 100}%` }} />
      </div>

      <h2 className="mt-6 text-lg font-semibold leading-snug">{q.question}</h2>

      <div className="mt-5 space-y-3">
        {CHOICES.map((c) => {
          const a = q.answered;
          let tone = "border-line bg-card";
          let letter = "bg-card-2 text-text";
          if (a) {
            if (c === a.correct) {
              tone = "border-success bg-[#0f2e17] text-white";
              letter = "bg-success text-black";
            } else if (c === a.selected) {
              tone = "border-danger bg-[#3a0f0c] text-white";
              letter = "bg-danger text-white";
            } else tone = "border-line bg-card opacity-40";
          }
          return (
            <button
              key={c}
              disabled={!!a || pending}
              onClick={() => choose(c)}
              className={`flex w-full items-center gap-3 rounded-2xl border-2 p-4 text-left text-sm transition-colors ${tone}`}
            >
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${letter}`}>
                {c}
              </span>
              <span className="flex-1">{q.answers[c]}</span>
              {a && c === a.correct && <Check size={18} className="text-success" />}
              {a && c === a.selected && !a.isCorrect && <X size={18} className="text-danger" />}
            </button>
          );
        })}
      </div>

      {q.answered && (
        <div
          className={`mt-4 rounded-2xl border p-4 text-sm ${q.answered.isCorrect ? "border-success/40 bg-success/10" : "border-danger/40 bg-danger/10"}`}
        >
          <p className={`font-semibold ${q.answered.isCorrect ? "text-success" : "text-danger"}`}>
            {q.answered.isCorrect ? "Bonne réponse !" : `Raté : la bonne réponse était ${q.answered.correct}.`}
          </p>
          {q.answered.explanation && <p className="mt-1 text-text/90">{q.answered.explanation}</p>}
        </div>
      )}

      {error && <p className="mt-4 text-center text-sm text-danger">{error}</p>}

      <div className="mt-auto pt-6">
        {q.answered && !isLast && (
          <PrimaryButton onClick={() => setIndex((i) => i + 1)}>Question suivante</PrimaryButton>
        )}
      </div>
    </div>
  );
}

function Passed({ score, attempts }: { score: number; attempts: number }) {
  return (
    <Card
      icon={<Mascot mood="amour" size={112} />}
      title={`QCM validé : ${score}/20`}
      text={`Bravo ! La leçon suivante est débloquée. (${attempts} tentative${attempts > 1 ? "s" : ""})`}
    />
  );
}

function Failed({
  score,
  until,
  whopUrl,
  onRetry,
  pending,
  error,
}: {
  score: number;
  until: string;
  whopUrl: string | null;
  onRetry: () => void;
  pending: boolean;
  error: string | null;
}) {
  const left = useTimeLeft(until);
  return (
    <div className="mt-6 space-y-4">
      <div className="flex flex-col items-center rounded-3xl border border-danger/40 bg-card p-6 text-center">
        <Mascot mood="ko" size={96} />
        <p className="mt-3 text-4xl font-bold">{score}/20</p>
        <p className="mt-2 font-semibold">Il te faut {PASS}/20 pour valider.</p>
        <p className="mt-2 text-sm text-muted">Retourne revoir le module sur Whop, puis réessaie.</p>
      </div>
      {whopUrl && (
        <a
          href={whopUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 rounded-2xl bg-card-2 py-4 font-medium"
        >
          Revoir le module sur Whop <ExternalLink size={16} />
        </a>
      )}
      <PrimaryButton onClick={onRetry} disabled={left > 0 || pending}>
        {left > 0 ? `Nouvel essai dans ${formatClock(left)}` : pending ? "Chargement…" : "Réessayer le QCM"}
      </PrimaryButton>
      {error && <p className="text-center text-sm text-danger">{error}</p>}
    </div>
  );
}

function useTimeLeft(until: string) {
  const [left, setLeft] = useState(() => Math.max(0, new Date(until).getTime() - Date.now()));
  useEffect(() => {
    const id = setInterval(() => setLeft(Math.max(0, new Date(until).getTime() - Date.now())), 1000);
    return () => clearInterval(id);
  }, [until]);
  return left;
}

const formatClock = (ms: number) => {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

function Card({ icon, title, text, action }: { icon?: React.ReactNode; title: string; text: string; action?: React.ReactNode }) {
  return (
    <div className="mt-6 space-y-4">
      <div className="rounded-3xl border border-line bg-card p-6 text-center">
        {icon && <div className="mb-3 flex justify-center">{icon}</div>}
        <p className="text-xl font-semibold">{title}</p>
        <p className="mt-2 text-sm text-muted">{text}</p>
      </div>
      {action ?? <BackButton />}
    </div>
  );
}

function BackButton() {
  return (
    <Link href="/learn" className="block w-full rounded-2xl bg-text py-4 text-center font-semibold text-black">
      Retour à ma progression
    </Link>
  );
}

function PrimaryButton({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...props} className="w-full rounded-2xl bg-text py-4 font-semibold text-black disabled:opacity-40">
      {children}
    </button>
  );
}
