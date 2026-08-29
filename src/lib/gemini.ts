import { GoogleGenerativeAI } from '@google/generative-ai'
import { getConfig } from './config'

// Helper to get Gemini client
function getGeminiModel() {
  const { geminiApiKey } = getConfig()
  if (!geminiApiKey) {
    throw new Error('Gemini API Key is not configured. Please set it in your settings or .env.local file.')
  }
  const genAI = new GoogleGenerativeAI(geminiApiKey)
  return genAI.getGenerativeModel({
    model: 'gemini-1.5-flash',
    generationConfig: {
      responseMimeType: 'application/json',
    },
  })
}

// 1. Guided-Help Guardrail: Detects if input is an assignment/exam task rather than study material
export interface GuardrailResult {
  isAssignment: boolean
  guidance?: string
}

export async function checkGuidedHelpGuardrail(input: string): Promise<GuardrailResult> {
  try {
    const model = getGeminiModel()
    const prompt = `
      Analyze the following student input. Determine if it represents a direct homework assignment, essay task, test question, or prompt they want completed (where they would want a finished answer, essay, or solution written for them), rather than study notes, textbook text, or general concepts they want to learn/understand.

      If it is an assignment/solution request, set "isAssignment" to true, and generate Socratic guidance in "guidance". Do not produce a finished answer, essay, or solution. Instead, provide 2-3 guiding questions or a partially worked example with blanks that helps the student work toward the answer themselves. Keep the guidance under 150 words.
      If it is normal study material, set "isAssignment" to false.

      Return JSON format:
      {
        "isAssignment": boolean,
        "guidance": string (null if isAssignment is false)
      }

      Student input: "${input.replace(/"/g, '\\"')}"
    `
    const result = await model.generateContent(prompt)
    const text = result.response.text()
    return JSON.parse(text) as GuardrailResult
  } catch (error) {
    console.error('Error in checkGuidedHelpGuardrail:', error)
    // Fallback detection (simple keywords)
    const keywords = ['solve this', 'write an essay', 'assignment', 'homework', 'test prompt', 'exam question', 'answer this for me']
    const isAssignment = keywords.some(k => input.toLowerCase().includes(k))
    if (isAssignment) {
      return {
        isAssignment: true,
        guidance: "It looks like you've submitted an assignment prompt. Can you explain your initial thoughts on this topic? What is the main question asking, and what concepts do you think apply here?"
      }
    }
    return { isAssignment: false }
  }
}

// 2. Concept Extraction and Summary
export interface ExtractedConcept {
  name: string
  summary: string
  simple_explanation: string
}

export async function extractConcepts(rawText: string): Promise<ExtractedConcept[]> {
  try {
    const model = getGeminiModel()
    const prompt = `
      You are helping a student study. Given the following material, extract 3-8 distinct concepts covered. For each concept, give:
      - a short name (1-4 words)
      - a concise summary (3-5 sentences, factually accurate, no invented details)
      - a simplified explanation using everyday language and exactly one clear analogy.

      Return structured JSON matching this array structure:
      [
        {
          "name": "Concept Name",
          "summary": "Concise summary sentences...",
          "simple_explanation": "Simplified explanation with analogy..."
        }
      ]

      Material: ${rawText}
    `
    const result = await model.generateContent(prompt)
    const text = result.response.text()
    return JSON.parse(text) as ExtractedConcept[]
  } catch (error) {
    console.error('Error in extractConcepts:', error)
    // Fallback mock concepts
    return [
      {
        name: "Active Recall",
        summary: "Active recall involves retrieving information from memory rather than passively rereading it. By forcing the brain to retrieve a concept, you strengthen neural pathways. This technique makes learning more durable over time. It is one of the most effective study strategies known.",
        simple_explanation: "Instead of just looking at your notes, you hide them and try to explain the concept from memory. It's like testing your muscles by lifting weights rather than just watching someone else lift them."
      },
      {
        name: "Spaced Repetition",
        summary: "Spaced repetition is a learning technique where reviews are systematicially spaced out over increasing intervals. It exploits the psychological forgetting curve. Reviewing a concept just as you are about to forget it optimizes memory consolidation. This prevents cramming and builds long-term recall.",
        simple_explanation: "Reviewing information at increasing intervals (e.g., 1 day, 3 days, 1 week) to push it into long-term memory. It is like watering a plant: watering it a little bit regularly is much healthier than dumping a bucket of water on it once a month."
      },
      {
        name: "Feynman Technique",
        summary: "The Feynman Technique is a learning method that involves explaining a concept in simple terms, as if to a child. By doing this, you quickly identify gaps in your own understanding. You then return to the source material to fill those gaps. Finally, you simplify your explanation further using analogies.",
        simple_explanation: "Teaching a topic to someone else (or an imaginary child) in simple terms to find what you don't know. It's like trying to draw a map of your neighborhood from memory; you'll quickly realize which streets you don't actually know."
      }
    ]
  }
}

// 3. Question Generation
export interface GeneratedQuestion {
  type: 'mcq' | 'short_answer' | 'flashcard'
  prompt: string
  options: string[] | null
  correct_answer: string
  difficulty: number
}

export async function generateQuestions(conceptName: string, summary: string): Promise<GeneratedQuestion[]> {
  try {
    const model = getGeminiModel()
    const prompt = `
      Generate 5 practice questions for the concept "${conceptName}" based on this summary:
      "${summary}"

      Include a mix of:
      - multiple-choice questions (type: "mcq") - provide 4 options in the options array.
      - short-answer questions (type: "short_answer") - options should be null.
      - flashcards (type: "flashcard") - options should be null, correct_answer should be the brief explanation on the back of the card.

      Tag each question with a difficulty from 1 (basic recall) to 5 (applied/analytical).
      Only use facts present in the summary — do not introduce outside information.

      Return structured JSON:
      [
        {
          "type": "mcq" | "short_answer" | "flashcard",
          "prompt": "Question text...",
          "options": ["Option A", "Option B", "Option C", "Option D"] or null,
          "correct_answer": "Correct answer text",
          "difficulty": 1-5
        }
      ]
    `
    const result = await model.generateContent(prompt)
    const text = result.response.text()
    return JSON.parse(text) as GeneratedQuestion[]
  } catch (error) {
    console.error('Error in generateQuestions:', error)
    // Fallback mock questions
    return [
      {
        type: 'mcq',
        prompt: `Which of the following is the main benefit of active recall?`,
        options: [
          'It allows you to read faster.',
          'It strengthens neural pathways by retrieving information.',
          'It requires less mental effort than rereading.',
          'It helps you memorize essays word-for-word.'
        ],
        correct_answer: 'It strengthens neural pathways by retrieving information.',
        difficulty: 1
      },
      {
        type: 'short_answer',
        prompt: `How does active recall differ from passive rereading?`,
        options: null,
        correct_answer: 'Active recall retrieves info from memory; passive reading just reviews it on the page.',
        difficulty: 3
      },
      {
        type: 'flashcard',
        prompt: `Active Recall`,
        options: null,
        correct_answer: 'Retrieving info from memory to strengthen neural pathways.',
        difficulty: 1
      },
      {
        type: 'mcq',
        prompt: `When practicing active recall, what does the retrieval process do to the brain?`,
        options: [
          'It temporarily fatigues it.',
          'It strengthens neural pathways.',
          'It has no long term effect.',
          'It decreases short term memory.'
        ],
        correct_answer: 'It strengthens neural pathways.',
        difficulty: 2
      },
      {
        type: 'short_answer',
        prompt: `Why is active recall considered a durable learning method?`,
        options: null,
        correct_answer: 'Because retrieving information forces the brain to construct and solidify memory pathways.',
        difficulty: 4
      }
    ]
  }
}

// 4. Answer Feedback (Socratic / guided for incorrect answers)
export interface AnswerFeedback {
  is_correct: boolean
  feedback: string
}

export async function evaluateAnswer(
  questionPrompt: string,
  correctAnswer: string,
  studentAnswer: string
): Promise<AnswerFeedback> {
  try {
    const model = getGeminiModel()
    const prompt = `
      The student was asked: "${questionPrompt}"
      Correct answer: "${correctAnswer}"
      Student answered: "${studentAnswer}"

      Determine if this is correct (allow for reasonable phrasing variation on short answers).
      Then give feedback:
      - If correct: briefly confirm and reinforce why.
      - If incorrect: explain specifically what was misunderstood and point back to the concept — DO NOT just restate the correct answer, help them see why theirs was wrong. Do not give the completed answer directly; guide them towards understanding.

      Keep the feedback under 80 words.

      Return JSON format:
      {
        "is_correct": boolean,
        "feedback": "Feedback text..."
      }
    `
    const result = await model.generateContent(prompt)
    const text = result.response.text()
    return JSON.parse(text) as AnswerFeedback
  } catch (error) {
    console.error('Error in evaluateAnswer:', error)
    // Fallback evaluation
    const isCorrect = studentAnswer.toLowerCase().trim() === correctAnswer.toLowerCase().trim() ||
      correctAnswer.toLowerCase().includes(studentAnswer.toLowerCase()) && studentAnswer.length > 3
    
    return {
      is_correct: isCorrect,
      feedback: isCorrect
        ? "Excellent job! You correctly identified the core element of the concept."
        : "Not quite. Think about the distinction between active retrieval and passive reading. Can you identify how forcing memory retrieval strengthens learning?"
    }
  }
}

// 5. Generate study plan reason
export async function generateStudyPlanReason(
  conceptName: string,
  masteryScore: number,
  isWeakest: boolean
): Promise<string> {
  try {
    const model = getGeminiModel()
    const prompt = `
      Generate a brief, one-line, encouraging study motivation reason for a concept named "${conceptName}".
      The student's mastery score is ${masteryScore.toFixed(0)}%.
      ${isWeakest ? 'This is currently their weakest concept in this subject.' : ''}

      Keep it under 15 words and return JSON:
      {
        "reason": "One-line motivation..."
      }
    `
    const result = await model.generateContent(prompt)
    const text = result.response.text()
    const parsed = JSON.parse(text) as { reason: string }
    return parsed.reason
  } catch (error) {
    console.error('Error in generateStudyPlanReason:', error)
    if (isWeakest) {
      return `Critical concept to review — currently your lowest mastery score at ${masteryScore.toFixed(0)}%.`
    }
    return `Review this to push your mastery score of ${masteryScore.toFixed(0)}% closer to 100%.`
  }
}
