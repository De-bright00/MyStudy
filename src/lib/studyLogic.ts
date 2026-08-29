// Deterministic learning logic for the Mystudy app

export function calculateNewMastery(currentScore: number, isCorrect: boolean): number {
  if (isCorrect) {
    return Math.min(100, currentScore + 8)
  } else {
    return Math.max(0, currentScore - 15)
  }
}

// Applies a small daily decay (-1 per day since last_updated) when displaying,
// simulating forgetting without writing changes to the DB.
export function getDecayedMastery(score: number, lastUpdatedStr: string): number {
  const lastUpdated = new Date(lastUpdatedStr)
  const now = new Date()
  const diffTime = Math.abs(now.getTime() - lastUpdated.getTime())
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
  return Math.max(0, score - diffDays)
}

// Next question target difficulty = round(mastery_score / 20) clamped to 1-5
export function getTargetDifficulty(masteryScore: number): number {
  const target = Math.round(masteryScore / 20)
  return Math.max(1, Math.min(5, target))
}

export interface ConceptWithMastery {
  id: string
  name: string
  score: number // already decayed if needed
}

export interface StudyPlanItemDraft {
  concept_id: string
  concept_name: string
  priority: number // lower is more urgent
  suggested_minutes: number
}

// Rules-based study plan scheduler
export function generateStudyPlan(
  concepts: ConceptWithMastery[],
  dailyBudgetMinutes: number = 60
): StudyPlanItemDraft[] {
  // Sort by score ascending (weakest first)
  const sorted = [...concepts].sort((a, b) => a.score - b.score)

  const items: StudyPlanItemDraft[] = []
  let accumulatedMinutes = 0

  for (let i = 0; i < sorted.length; i++) {
    const concept = sorted[i]
    let mins = 10
    if (concept.score < 40) {
      mins = 30
    } else if (concept.score < 70) {
      mins = 20
    }

    // Check if adding this exceeds budget
    if (accumulatedMinutes + mins > dailyBudgetMinutes) {
      const remaining = dailyBudgetMinutes - accumulatedMinutes
      // Only add if we can allocate at least 5 minutes
      if (remaining >= 5) {
        mins = remaining
      } else {
        break // budget fully allocated
      }
    }

    items.push({
      concept_id: concept.id,
      concept_name: concept.name,
      priority: i + 1, // 1 is highest priority (weakest)
      suggested_minutes: mins,
    })

    accumulatedMinutes += mins
    if (accumulatedMinutes >= dailyBudgetMinutes) {
      break
    }
  }

  return items
}
