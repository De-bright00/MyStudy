import { GoogleGenerativeAI } from '@google/generative-ai'
import { getConfig } from './config'

// Priority list of valid Gemini models
const PREFERRED_MODELS = ['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro']

// Helper to get Gemini client with working model fallback
export function getGeminiModel(customModelName?: string) {
  const { geminiApiKey } = getConfig()
  if (!geminiApiKey) {
    throw new Error('AI API Key is not configured. Please set it in your settings or .env file.')
  }
  const genAI = new GoogleGenerativeAI(geminiApiKey)
  return genAI.getGenerativeModel({
    model: customModelName || 'gemini-1.5-flash',
    generationConfig: {
      responseMimeType: 'application/json',
    },
  })
}

// Clean markdown code blocks from JSON output and unwrap objects if needed
export function cleanJsonResponse(text: string): any {
  let cleaned = text.trim()
  const jsonBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  if (jsonBlockMatch) {
    cleaned = jsonBlockMatch[1].trim()
  } else {
    const firstBracket = cleaned.search(/[{\[]/)
    const lastBracket = Math.max(cleaned.lastIndexOf('}'), cleaned.lastIndexOf(']'))
    if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
      cleaned = cleaned.slice(firstBracket, lastBracket + 1)
    }
  }

  const parsed = JSON.parse(cleaned)
  if (!Array.isArray(parsed) && typeof parsed === 'object' && parsed !== null) {
    if (Array.isArray(parsed.concepts)) return parsed.concepts
    if (Array.isArray(parsed.questions)) return parsed.questions
    if (Array.isArray(parsed.data)) return parsed.data
    if (Array.isArray(parsed.items)) return parsed.items
    if (Array.isArray(parsed.results)) return parsed.results
  }
  return parsed
}

// Helper to run content generation with fallback models or OpenAI
async function generateWithFallback(prompt: string): Promise<string> {
  const { geminiApiKey } = getConfig()
  if (!geminiApiKey) {
    throw new Error('AI API Key is not configured.')
  }

  // If using an OpenAI API Key (starts with sk-)
  if (geminiApiKey.startsWith('sk-')) {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${geminiApiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'You are an expert educational AI assistant for Mystudy assessment platform. Respond strictly in valid JSON format. If returning a list of concepts or questions, you can return a JSON object with a "concepts" or "questions" array.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          response_format: { type: 'json_object' }
        })
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData?.error?.message || `OpenAI request failed with status ${response.status}`)
      }

      const data = await response.json()
      return data.choices?.[0]?.message?.content || ''
    } catch (err: any) {
      console.warn('OpenAI generation error:', err?.message || 'Request failed')
      throw err
    }
  }

  // If using a Gemini API Key
  let lastError: any = null
  for (const modelName of PREFERRED_MODELS) {
    try {
      const model = getGeminiModel(modelName)
      const result = await model.generateContent(prompt)
      return result.response.text()
    } catch (err: any) {
      console.warn(`Model ${modelName} failed, trying next:`, err?.message || err)
      lastError = err
    }
  }
  throw lastError || new Error('All Gemini model candidates failed.')
}

// 1. Guided-Help Guardrail: Detects if input is an assignment/exam task rather than study material
export interface GuardrailResult {
  isAssignment: boolean
  guidance?: string
}

export async function checkGuidedHelpGuardrail(input: string): Promise<GuardrailResult> {
  try {
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
    const text = await generateWithFallback(prompt)
    return cleanJsonResponse(text) as GuardrailResult
  } catch (error) {
    console.error('Error in checkGuidedHelpGuardrail:', error)
    // Fallback detection (simple keywords)
    const keywords = ['solve this for me', 'do my homework', 'write an essay for me', 'give me the full answer to this exam']
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

// Smart local extraction fallback that analyzes actual student text directly
export function extractConceptsFromTextLocally(rawText: string): ExtractedConcept[] {
  const cleaned = rawText.replace(/\r\n/g, '\n').trim()
  if (!cleaned) {
    return [{
      name: 'General Material Study',
      summary: 'General notes and study concepts from this uploaded material.',
      simple_explanation: 'Key points to review and practice.'
    }]
  }

  // 1. Try to detect sections / headings / bullet points
  const lines = cleaned.split('\n').map(l => l.trim()).filter(Boolean)
  const candidateHeadings: string[] = []

  for (const line of lines) {
    const isMdHeading = /^#{1,4}\s+(.+)$/.exec(line)
    const isNumbered = /^(?:[0-9]+[.)]|[A-Z][.)])\s+([A-Z0-9].{3,60})$/.exec(line)
    const isTitleLine = line.length <= 60 && line.length >= 4 && !line.endsWith('.') && !line.endsWith(',') && /^[A-Z0-9]/.test(line)

    if (isMdHeading && isMdHeading[1]) {
      candidateHeadings.push(isMdHeading[1].trim())
    } else if (isNumbered && isNumbered[1]) {
      candidateHeadings.push(isNumbered[1].trim())
    } else if (isTitleLine && !candidateHeadings.includes(line)) {
      candidateHeadings.push(line)
    }
  }

  // Deduplicate and filter headings
  const uniqueHeadings = Array.from(new Set(candidateHeadings))
    .filter(h => h.length >= 3 && h.length <= 60)
    .slice(0, 5)

  if (uniqueHeadings.length >= 2) {
    return uniqueHeadings.map(heading => {
      const headingIdx = cleaned.indexOf(heading)
      const afterText = headingIdx !== -1 ? cleaned.slice(headingIdx + heading.length, headingIdx + 800).trim() : ''
      const firstFewSentences = afterText.split(/(?<=[.?!])\s+/).slice(0, 3).join(' ') || `Key conceptual material covering ${heading}.`
      const cleanName = heading.replace(/^[#0-9.)\s]+/, '').trim()
      return {
        name: cleanName,
        summary: firstFewSentences.slice(0, 300),
        simple_explanation: `Key study principle: understanding how ${cleanName} applies in this material.`
      }
    })
  }

  // 2. If no distinct headings found, split paragraphs into concepts
  const paragraphs = cleaned.split(/\n\s*\n/).map(p => p.trim()).filter(p => p.length > 40)
  if (paragraphs.length >= 2) {
    return paragraphs.slice(0, 4).map((p, idx) => {
      const firstSentence = p.split(/(?<=[.?!])\s+/)[0] || ''
      const words = firstSentence.replace(/[^a-zA-Z0-9\s]/g, '').split(/\s+/).slice(0, 4).join(' ')
      const name = words.length > 3 ? words : `Section ${idx + 1}`
      return {
        name: name.charAt(0).toUpperCase() + name.slice(1),
        summary: p.slice(0, 300),
        simple_explanation: `Focus on how this section connects with the overall topic.`
      }
    })
  }

  // 3. Fallback for single block of text
  const sentences = cleaned.split(/(?<=[.?!])\s+/).filter(s => s.length > 20)
  const mainTopic = sentences[0]?.slice(0, 40) || 'Core Subject Material'
  return [
    {
      name: mainTopic.replace(/[^a-zA-Z0-9\s]/g, '').trim() || 'Key Material Points',
      summary: sentences.slice(0, 3).join(' ').slice(0, 300) || cleaned.slice(0, 250),
      simple_explanation: 'The essential core of this lesson to review and practice.'
    }
  ]
}

// Smart local question generation fallback grounded directly in actual material sentences
export function generateQuestionsFromMaterialLocally(
  materialTitle: string,
  materialText: string,
  count: number = 5,
  questionType: QuestionSettingType = 'mixed',
  concepts: ExtractedConcept[] = []
): GeneratedQuestion[] {
  const cleaned = materialText.replace(/\r\n/g, '\n').trim()
  const rawSentences = cleaned
    .split(/(?<=[.?!])\s+/)
    .map(s => s.trim())
    .filter(s => s.length >= 25 && s.length <= 250 && !s.startsWith('#'))

  const sentences = rawSentences.length > 0 ? rawSentences : [
    `${materialTitle} provides fundamental core knowledge for this study material.`,
    `Mastering the key concepts of ${materialTitle} enables deeper subject comprehension.`,
    `Reviewing principles and applying them through practice questions reinforces learning.`
  ]

  const questions: GeneratedQuestion[] = []
  const conceptNames = concepts.length > 0 ? concepts.map(c => c.name) : [materialTitle]

  for (let i = 0; i < count; i++) {
    const targetSentence = sentences[i % sentences.length]
    const assignedConcept = conceptNames[i % conceptNames.length]

    let currentType: 'mcq' | 'short_answer' = 'mcq'
    let currentSubType: 'objective' | 'theory' | 'body' = 'objective'

    if (questionType === 'objective') {
      currentType = 'mcq'
      currentSubType = 'objective'
    } else if (questionType === 'theory') {
      currentType = 'short_answer'
      currentSubType = 'theory'
    } else if (questionType === 'body') {
      currentType = 'short_answer'
      currentSubType = 'body'
    } else {
      if (i % 3 === 0 || i % 3 === 1) {
        currentType = 'mcq'
        currentSubType = 'objective'
      } else if (i % 3 === 2 && i % 2 === 0) {
        currentType = 'short_answer'
        currentSubType = 'body'
      } else {
        currentType = 'short_answer'
        currentSubType = 'theory'
      }
    }

    if (currentType === 'mcq') {
      const otherSentences = sentences.filter(s => s !== targetSentence)
      const distractor1 = otherSentences[0] || `It contradicts the primary conclusions of ${assignedConcept}.`
      const distractor2 = otherSentences[1] || `It is unrelated to the foundational mechanisms of this subject.`
      const distractor3 = `None of the documented principles in ${assignedConcept} support this finding.`

      const options = [targetSentence, distractor1, distractor2, distractor3]
      const shuffledOptions = [...options].sort((a, b) => ((a.length + i) % 3) - ((b.length + i) % 3))

      questions.push({
        type: 'mcq',
        sub_type: 'objective',
        prompt: `Based on your notes for "${assignedConcept}", which statement is accurate?`,
        options: shuffledOptions,
        correct_answer: targetSentence,
        difficulty: (i % 3) + 1,
        concept_name: assignedConcept,
        rubric: `Directly verifiable from the material: "${targetSentence}"`
      })
    } else if (currentSubType === 'theory') {
      questions.push({
        type: 'short_answer',
        sub_type: 'theory',
        prompt: `In your own words, explain the core principle and purpose of "${assignedConcept}" based on your notes.`,
        options: null,
        correct_answer: targetSentence,
        difficulty: 3,
        concept_name: assignedConcept,
        rubric: `Student should explain the concept and articulate: ${targetSentence.slice(0, 100)}`
      })
    } else {
      const contextPara = sentences.slice(i % sentences.length, (i % sentences.length) + 2).join(' ')
      questions.push({
        type: 'short_answer',
        sub_type: 'body',
        prompt: `Provide an in-depth analytical explanation of "${assignedConcept}". How does it operate within "${materialTitle}"?`,
        options: null,
        correct_answer: contextPara || targetSentence,
        difficulty: 4,
        concept_name: assignedConcept,
        rubric: `In-depth analysis demonstrating understanding of: ${targetSentence}`
      })
    }
  }

  return questions
}

export async function extractConcepts(rawText: string): Promise<ExtractedConcept[]> {
  try {
    const prompt = `
      You are an expert tutor helping a student study and master this specific material.
      Given the following source material, extract 2-6 distinct, key concepts covered.
      
      CRITICAL RULES:
      - Concepts MUST be derived directly from the provided material. Do not introduce concepts outside this text.
      - For each concept, provide:
        - a short name (1-4 words)
        - a concise summary (2-4 sentences, factually accurate, strictly based on the material)
        - a simplified explanation using everyday language and one clear analogy.

      Return structured JSON array:
      [
        {
          "name": "Concept Name",
          "summary": "Concise factual summary based strictly on the material...",
          "simple_explanation": "Simplified explanation with analogy..."
        }
      ]

      Source Material:
      ${rawText.slice(0, 20000)}
    `
    const text = await generateWithFallback(prompt)
    const parsed = cleanJsonResponse(text) as ExtractedConcept[]
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed
    }
    throw new Error('AI returned empty response')
  } catch (error: any) {
    console.warn('AI online concept extraction unavailable, falling back to smart local text analysis:', error?.message || error)
    return extractConceptsFromTextLocally(rawText)
  }
}

// 3. Question Generation
export type QuestionSettingType = 'objective' | 'theory' | 'body' | 'mixed'

export interface GeneratedQuestion {
  type: 'mcq' | 'short_answer' | 'flashcard'
  sub_type?: 'objective' | 'theory' | 'body'
  prompt: string
  options: string[] | null
  correct_answer: string
  difficulty: number
  concept_name?: string
  rubric?: string
}

export async function generateQuestionsFromMaterial(
  materialTitle: string,
  materialText: string,
  count: number = 5,
  questionType: QuestionSettingType = 'mixed',
  concepts: ExtractedConcept[] = []
): Promise<GeneratedQuestion[]> {
  try {
    const conceptNames = concepts.map(c => c.name).join(', ')
    
    let typeInstructions = ''
    if (questionType === 'objective') {
      typeInstructions = `
        Generate EXACTLY ${count} MULTIPLE-CHOICE (Objective) questions.
        - "type": "mcq"
        - "sub_type": "objective"
        - "options": Array of exactly 4 plausible options [Option A, Option B, Option C, Option D].
        - "correct_answer": Exactly matches one of the options.
        - Randomize which index contains the correct answer so it is not predictable.
      `
    } else if (questionType === 'theory') {
      typeInstructions = `
        Generate EXACTLY ${count} THEORY (Short-Answer / Conceptual) questions.
        - "type": "short_answer"
        - "sub_type": "theory"
        - "options": null
        - "prompt": Questions that test comprehension of principles, definitions, cause-and-effect, and mechanisms.
        - "correct_answer": A concise 2-3 sentence benchmark explanation based on the material.
        - "rubric": 2-3 essential conceptual points a student must demonstrate to be credited.
      `
    } else if (questionType === 'body') {
      typeInstructions = `
        Generate EXACTLY ${count} BODY (In-Depth / Essay / Analytical) questions.
        - "type": "short_answer"
        - "sub_type": "body"
        - "options": null
        - "prompt": Questions requiring the student to elaborate, analyze, compare, or explain structured processes in depth based on the material.
        - "correct_answer": A comprehensive benchmark answer (1-2 paragraphs).
        - "rubric": Key criteria, structural points, and core arguments expected.
      `
    } else {
      // Mixed
      typeInstructions = `
        Generate a balanced MIX of EXACTLY ${count} questions:
        - Approximately 50-60% Objective multiple choice ("type": "mcq", "sub_type": "objective", "options": [4 choices])
        - Approximately 25-30% Theory conceptual ("type": "short_answer", "sub_type": "theory", "options": null)
        - Approximately 15-20% Body in-depth analytical ("type": "short_answer", "sub_type": "body", "options": null)
      `
    }

    const prompt = `
      You are an expert assessment examiner creating an official test and practice questions for students based on their study material titled "${materialTitle}".

      ${typeInstructions}

      CRITICAL ASSESSMENT RULES:
      1. STRICTLY GROUNDED IN MATERIAL: Every single question and answer MUST be directly verifiable from the provided source text. Do NOT make up outside facts.
      2. RANDOMIZED & VARIED: Ensure questions test diverse parts of the text, not just the first paragraph.
      3. Tag each question with a difficulty from 1 (fundamental recall) to 5 (applied analysis).
      4. If applicable, attribute each question to one of the extracted concepts: ${conceptNames || 'the material'}.

      Source Material:
      ${materialText.slice(0, 22000)}

      Return structured JSON array of exactly ${count} question objects:
      [
        {
          "type": "mcq" | "short_answer",
          "sub_type": "objective" | "theory" | "body",
          "prompt": "Question text...",
          "options": ["Option A", "Option B", "Option C", "Option D"] or null,
          "correct_answer": "Benchmark correct answer text",
          "difficulty": 1-5,
          "concept_name": "Concept Name",
          "rubric": "Optional key points expected"
        }
      ]
    `

    const text = await generateWithFallback(prompt)
    const questions = cleanJsonResponse(text) as GeneratedQuestion[]
    
    if (Array.isArray(questions) && questions.length > 0) {
      return questions.map(q => ({
        type: q.type === 'mcq' ? 'mcq' : 'short_answer',
        sub_type: q.sub_type || (q.type === 'mcq' ? 'objective' : 'theory'),
        prompt: q.prompt,
        options: Array.isArray(q.options) && q.options.length >= 2 ? q.options : null,
        correct_answer: q.correct_answer,
        difficulty: Math.max(1, Math.min(5, q.difficulty || 2)),
        concept_name: q.concept_name || (concepts[0]?.name || materialTitle),
        rubric: q.rubric
      }))
    }
    throw new Error('Failed to parse questions array')
  } catch (error: any) {
    console.warn('AI question generation online unavailable, generating questions directly from material text:', error?.message || error)
    return generateQuestionsFromMaterialLocally(materialTitle, materialText, count, questionType, concepts)
  }
}

// Fallback for single concept questions
export async function generateQuestions(conceptName: string, summary: string): Promise<GeneratedQuestion[]> {
  try {
    const prompt = `
      Generate 5 practice questions for the concept "${conceptName}" strictly based on this summary:
      "${summary}"

      Include a mix of:
      - multiple-choice questions (type: "mcq", sub_type: "objective") with 4 plausible options.
      - conceptual short-answer theory questions (type: "short_answer", sub_type: "theory", options: null).

      Tag each question with a difficulty from 1 (basic recall) to 5 (applied/analytical).
      Only use facts present in the summary.

      Return structured JSON:
      [
        {
          "type": "mcq" | "short_answer",
          "sub_type": "objective" | "theory",
          "prompt": "Question text...",
          "options": ["Option A", "Option B", "Option C", "Option D"] or null,
          "correct_answer": "Correct answer text",
          "difficulty": 1-5
        }
      ]
    `
    const text = await generateWithFallback(prompt)
    const parsed = cleanJsonResponse(text) as GeneratedQuestion[]
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed
    }
    throw new Error('Invalid format returned')
  } catch (error) {
    console.error('Error in generateQuestions fallback:', error)
    // Intelligent local fallback if offline
    return [
      {
        type: 'mcq',
        sub_type: 'objective',
        prompt: `According to the concept "${conceptName}", which statement is most accurate?`,
        options: [
          `It is a foundational study principle in this subject.`,
          `It is unrelated to learning or memory retention.`,
          `It only applies to passive reading without practice.`,
          `It has no measurable effect on understanding.`
        ],
        correct_answer: `It is a foundational study principle in this subject.`,
        difficulty: 1,
        concept_name: conceptName
      },
      {
        type: 'short_answer',
        sub_type: 'theory',
        prompt: `Explain the core purpose of "${conceptName}" based on your study material.`,
        options: null,
        correct_answer: summary,
        difficulty: 2,
        concept_name: conceptName
      }
    ]
  }
}

// 4. Answer Feedback (Intelligent conceptual evaluation rewarding student's own understanding)
export interface AnswerFeedback {
  is_correct: boolean
  score_percentage: number
  feedback: string
  strengths?: string
  missing_points?: string
}

export async function evaluateAnswer(
  questionPrompt: string,
  correctAnswer: string,
  studentAnswer: string,
  questionType: string = 'short_answer',
  sourceMaterialContext?: string
): Promise<AnswerFeedback> {
  try {
    const prompt = `
      You are an expert, compassionate assessment evaluator on an educational testing platform.
      Question asked: "${questionPrompt.replace(/"/g, '\\"')}"
      Question Type: "${questionType}"
      Benchmark / Reference Answer: "${correctAnswer.replace(/"/g, '\\"')}"
      ${sourceMaterialContext ? `Relevant Source Context: "${sourceMaterialContext.slice(0, 1000).replace(/"/g, '\\"')}"` : ''}
      Student's Submitted Answer: "${studentAnswer.replace(/"/g, '\\"')}"

      EVALUATION RULES:
      1. GIVE ROOM FOR THE STUDENT'S OWN UNDERSTANDING:
         - Do NOT penalize the student for not copying and pasting verbatim text from the notes.
         - Reward students who explain the concept correctly in their own words, using their own phrasing, terms, or valid everyday analogies.
         - If the student shows that they understand the underlying mechanism, definition, principle, or reasoning accurately, mark "is_correct": true.
      2. For multiple-choice (objective):
         - Exact match of the option text or correct letter = 100% and is_correct: true.
      3. For theory and body questions:
         - Grade conceptually based on genuine understanding.
         - Award a "score_percentage" from 0 to 100.
         - If score_percentage >= 50, mark "is_correct": true.
      4. Constructive Feedback:
         - Start by acknowledging what they understood well in their own words.
         - Gently clarify any misconceptions or important nuances they missed from the material.
         - Keep feedback under 90 words.

      Return JSON format:
      {
        "is_correct": boolean,
        "score_percentage": number (0 to 100),
        "feedback": "Concise, constructive feedback...",
        "strengths": "What the student grasped well in their own words",
        "missing_points": "Any key nuances or details to refine"
      }
    `
    const text = await generateWithFallback(prompt)
    const result = cleanJsonResponse(text) as AnswerFeedback
    return {
      is_correct: Boolean(result.is_correct),
      score_percentage: typeof result.score_percentage === 'number' ? result.score_percentage : (result.is_correct ? 100 : 30),
      feedback: result.feedback || (result.is_correct ? 'Great job! You demonstrated clear understanding in your own words.' : 'Not quite. Check the key concepts from your material.'),
      strengths: result.strengths,
      missing_points: result.missing_points
    }
  } catch (error) {
    console.error('Error in evaluateAnswer:', error)
    // Intelligent local fallback evaluation
    const cleanedStudent = studentAnswer.toLowerCase().trim()
    const cleanedCorrect = correctAnswer.toLowerCase().trim()
    const isExact = cleanedStudent === cleanedCorrect
    const isSubstring = cleanedCorrect.includes(cleanedStudent) && cleanedStudent.length > 5
    const isCorrect = isExact || isSubstring
    
    return {
      is_correct: isCorrect,
      score_percentage: isCorrect ? 100 : 35,
      feedback: isCorrect
        ? "Good job! You captured the essential idea of this question."
        : "Your answer differs from the material benchmark. Review the key concept points to solidify your understanding."
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
    const prompt = `
      Generate a brief, one-line, encouraging study motivation reason for a concept named "${conceptName}".
      The student's mastery score is ${masteryScore.toFixed(0)}%.
      ${isWeakest ? 'This is currently their weakest concept in this subject.' : ''}

      Keep it under 15 words and return JSON:
      {
        "reason": "One-line motivation..."
      }
    `
    const text = await generateWithFallback(prompt)
    const parsed = cleanJsonResponse(text) as { reason: string }
    return parsed.reason
  } catch (error) {
    console.error('Error in generateStudyPlanReason:', error)
    if (isWeakest) {
      return `Critical concept to review — currently your lowest mastery score at ${masteryScore.toFixed(0)}%.`
    }
    return `Review this to push your mastery score of ${masteryScore.toFixed(0)}% closer to 100%.`
  }
}
