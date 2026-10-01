import { getSupabaseClient, isSupabaseConfigured } from './supabase'
import { calculateNewMastery } from './studyLogic'

// Interfaces representing the DB schema
export interface Subject {
  id: string
  user_id: string
  name: string
  created_at: string
}

export interface Material {
  id: string
  subject_id: string
  title: string
  raw_text: string | null
  source_type: 'upload' | 'paste' | 'topic_only'
  created_at: string
}

export interface Concept {
  id: string
  material_id: string
  subject_id: string
  name: string
  summary: string
  simple_explanation: string
  created_at: string
}

export interface Question {
  id: string
  concept_id: string
  question_type: 'mcq' | 'short_answer' | 'flashcard'
  sub_type?: 'objective' | 'theory' | 'body'
  prompt: string
  options: string[] | null
  correct_answer: string
  difficulty: number
  created_at: string
  concept_name?: string
  rubric?: string
}

export interface Attempt {
  id: string
  question_id: string
  user_id: string
  student_answer: string
  is_correct: boolean
  ai_feedback: string
  answered_at: string
  // Joined fields for UI convenience
  question_prompt?: string
  concept_name?: string
}

export interface Mastery {
  id: string
  concept_id: string
  user_id: string
  score: number
  last_updated: string
  concept_name?: string // Joined
}

export interface StudyPlanItem {
  id: string
  user_id: string
  concept_id: string
  priority: number
  suggested_minutes: number
  planned_date: string | null
  completed: boolean
  // Joined fields
  concept_name?: string
  mastery_score?: number
  ai_reason?: string
}

export interface UserProfile {
  id: string
  email: string
  role: 'teacher' | 'student'
  created_at: string
  institution?: string | null
  avatar_url?: string | null
}

export type QuestionSettingType = 'objective' | 'theory' | 'body' | 'mixed'

export interface Test {
  id: string
  teacher_id: string
  title: string
  subject_id: string
  question_count: number
  question_type: QuestionSettingType
  disable_guidance: boolean
  code: string
  created_at: string
  // UI convenience joins
  subject_name?: string
}

export interface TestStudent {
  id: string
  test_id: string
  student_id: string
  completed: boolean
  score: number | null
  started_at: string
  completed_at: string | null
  // UI joins
  test_title?: string
  student_email?: string
  subject_id?: string
  question_type?: QuestionSettingType
}

export interface TestStudentAttempt {
  id: string
  test_id: string
  student_id: string
  question_id: string
  student_answer: string
  is_correct: boolean
  ai_feedback: string
  answered_at: string
  // UI joins
  question_prompt?: string
}

// ----------------- LOCAL STORAGE DEMO IMPLEMENTATION -----------------
const MOCK_USER_ID = '00000000-0000-0000-0000-000000000000'

function getLS<T>(key: string, def: T): T {
  const item = localStorage.getItem(key)
  return item ? JSON.parse(item) : def
}

function setLS<T>(key: string, val: T) {
  localStorage.setItem(key, JSON.stringify(val))
}

const mockDb = {
  getSubjects: () => getLS<Subject[]>('study_subjects', []),
  setSubjects: (v: Subject[]) => setLS('study_subjects', v),
  
  getMaterials: () => getLS<Material[]>('study_materials', []),
  setMaterials: (v: Material[]) => setLS('study_materials', v),
  
  getConcepts: () => getLS<Concept[]>('study_concepts', []),
  setConcepts: (v: Concept[]) => setLS('study_concepts', v),
  
  getQuestions: () => getLS<Question[]>('study_questions', []),
  setQuestions: (v: Question[]) => setLS('study_questions', v),
  
  getAttempts: () => getLS<Attempt[]>('study_attempts', []),
  setAttempts: (v: Attempt[]) => setLS('study_attempts', v),
  
  getMastery: () => getLS<Mastery[]>('study_mastery', []),
  setMastery: (v: Mastery[]) => setLS('study_mastery', v),
  
  getStudyPlan: () => getLS<StudyPlanItem[]>('study_plan_items', []),
  setStudyPlan: (v: StudyPlanItem[]) => setLS('study_plan_items', v),

  getProfiles: () => getLS<UserProfile[]>('study_profiles', []),
  setProfiles: (v: UserProfile[]) => setLS('study_profiles', v),

  getTests: () => getLS<Test[]>('study_tests', []),
  setTests: (v: Test[]) => setLS('study_tests', v),

  getTestStudents: () => getLS<TestStudent[]>('study_test_students', []),
  setTestStudents: (v: TestStudent[]) => setLS('study_test_students', v),

  getTestAttempts: () => getLS<TestStudentAttempt[]>('study_test_attempts', []),
  setTestAttempts: (v: TestStudentAttempt[]) => setLS('study_test_attempts', v)
}

// Initialize seed subjects/concepts if local storage is empty
export function seedMockData() {
  // Clean initialization: start with a clean slate without dummy concepts
}

// ----------------- UNIFIED DB API -----------------

export async function dbFetchSubjects(userId: string): Promise<Subject[]> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient()!
    const { data, error } = await supabase.from('subjects').select('*').order('created_at', { ascending: false })
    if (error) throw error
    return data || []
  } else {
    seedMockData()
    return mockDb.getSubjects().filter(s => s.user_id === userId)
  }
}

export async function dbCreateSubject(userId: string, name: string): Promise<Subject> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient()!
    const { data, error } = await supabase.from('subjects').insert({ user_id: userId, name }).select().single()
    if (error) throw error
    return data
  } else {
    const newSub: Subject = {
      id: 'sub-' + Math.random().toString(36).substr(2, 9),
      user_id: userId,
      name,
      created_at: new Date().toISOString()
    }
    const current = mockDb.getSubjects()
    mockDb.setSubjects([newSub, ...current])
    return newSub
  }
}

export async function dbFetchMaterials(subjectId: string): Promise<Material[]> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient()!
    const { data, error } = await supabase.from('materials').select('*').eq('subject_id', subjectId).order('created_at', { ascending: false })
    if (error) throw error
    return data || []
  } else {
    return mockDb.getMaterials().filter(m => m.subject_id === subjectId)
  }
}

export async function dbCreateMaterial(
  subjectId: string,
  title: string,
  rawText: string | null,
  sourceType: 'upload' | 'paste' | 'topic_only'
): Promise<Material> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient()!
    const { data, error } = await supabase
      .from('materials')
      .insert({ subject_id: subjectId, title, raw_text: rawText, source_type: sourceType })
      .select()
      .single()
    if (error) throw error
    return data
  } else {
    const newMat: Material = {
      id: 'mat-' + Math.random().toString(36).substr(2, 9),
      subject_id: subjectId,
      title,
      raw_text: rawText,
      source_type: sourceType,
      created_at: new Date().toISOString()
    }
    const current = mockDb.getMaterials()
    mockDb.setMaterials([newMat, ...current])
    return newMat
  }
}

export async function dbFetchConcepts(subjectId: string): Promise<Concept[]> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient()!
    const { data, error } = await supabase.from('concepts').select('*').eq('subject_id', subjectId).order('created_at', { ascending: true })
    if (error) throw error
    return data || []
  } else {
    return mockDb.getConcepts().filter(c => c.subject_id === subjectId)
  }
}

export async function dbCreateConcepts(
  conceptsList: Array<{ name: string; summary: string; simple_explanation: string }>,
  materialId: string,
  subjectId: string
): Promise<Concept[]> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient()!
    const rows = conceptsList.map(c => ({
      material_id: materialId,
      subject_id: subjectId,
      name: c.name,
      summary: c.summary,
      simple_explanation: c.simple_explanation
    }))
    const { data, error } = await supabase.from('concepts').insert(rows).select()
    if (error) throw error
    return data || []
  } else {
    const created: Concept[] = conceptsList.map(c => ({
      id: 'con-' + Math.random().toString(36).substr(2, 9),
      material_id: materialId,
      subject_id: subjectId,
      name: c.name,
      summary: c.summary,
      simple_explanation: c.simple_explanation,
      created_at: new Date().toISOString()
    }))
    const current = mockDb.getConcepts()
    mockDb.setConcepts([...current, ...created])
    return created
  }
}

export async function dbFetchQuestions(conceptId: string): Promise<Question[]> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient()!
    const { data, error } = await supabase.from('questions').select('*').eq('concept_id', conceptId)
    if (error) throw error
    return (data || []).map(q => {
      let subType: 'objective' | 'theory' | 'body' = q.question_type === 'mcq' ? 'objective' : 'theory'
      let cleanOptions: string[] | null = null
      let rubric: string | undefined = undefined

      if (Array.isArray(q.options)) {
        cleanOptions = q.options
        subType = 'objective'
      } else if (q.options && typeof q.options === 'object') {
        if (q.options.subType) subType = q.options.subType
        if (q.options.rubric) rubric = q.options.rubric
        if (Array.isArray(q.options.choices)) cleanOptions = q.options.choices
      }

      return {
        ...q,
        sub_type: subType,
        options: cleanOptions,
        rubric: rubric
      }
    })
  } else {
    return mockDb.getQuestions().filter(q => q.concept_id === conceptId)
  }
}

export async function dbFetchQuestionsForSubject(subjectId: string): Promise<Question[]> {
  const concepts = await dbFetchConcepts(subjectId)
  const allQuestions: Question[] = []
  for (const c of concepts) {
    const qs = await dbFetchQuestions(c.id)
    allQuestions.push(...qs.map(q => ({ ...q, concept_name: c.name })))
  }
  return allQuestions
}

export async function dbCreateQuestions(
  questionsList: Array<{
    type: 'mcq' | 'short_answer' | 'flashcard'
    sub_type?: 'objective' | 'theory' | 'body'
    prompt: string
    options: string[] | null
    correct_answer: string
    difficulty: number
    concept_name?: string
    rubric?: string
  }>,
  conceptId: string
): Promise<Question[]> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient()!
    const rows = questionsList.map(q => {
      // Store sub_type and rubric in options if options is null for short_answer
      let storedOptions: any = q.options
      if (!storedOptions && (q.sub_type || q.rubric)) {
        storedOptions = { subType: q.sub_type || 'theory', rubric: q.rubric || '' }
      }

      return {
        concept_id: conceptId,
        question_type: q.type,
        prompt: q.prompt,
        options: storedOptions,
        correct_answer: q.correct_answer,
        difficulty: q.difficulty
      }
    })
    const { data, error } = await supabase.from('questions').insert(rows).select()
    if (error) throw error
    return (data || []).map((row, idx) => ({
      ...row,
      sub_type: questionsList[idx]?.sub_type || (row.question_type === 'mcq' ? 'objective' : 'theory'),
      rubric: questionsList[idx]?.rubric
    }))
  } else {
    const created: Question[] = questionsList.map(q => ({
      id: 'q-' + Math.random().toString(36).substr(2, 9),
      concept_id: conceptId,
      question_type: q.type,
      sub_type: q.sub_type || (q.type === 'mcq' ? 'objective' : 'theory'),
      prompt: q.prompt,
      options: q.options,
      correct_answer: q.correct_answer,
      difficulty: q.difficulty,
      concept_name: q.concept_name,
      rubric: q.rubric,
      created_at: new Date().toISOString()
    }))
    const current = mockDb.getQuestions()
    mockDb.setQuestions([...current, ...created])
    return created
  }
}

export async function dbDeleteConcept(conceptId: string): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient()!
    
    // 1. Fetch question IDs belonging to this concept
    const { data: questions } = await supabase
      .from('questions')
      .select('id')
      .eq('concept_id', conceptId)

    const questionIds = (questions || []).map(q => q.id)

    if (questionIds.length > 0) {
      // 2. Delete test student attempts referencing these questions
      await supabase
        .from('test_student_attempts')
        .delete()
        .in('question_id', questionIds)

      // 3. Delete normal practice attempts referencing these questions
      await supabase
        .from('attempts')
        .delete()
        .in('question_id', questionIds)

      // 4. Delete the questions themselves
      const { error: qErr } = await supabase
        .from('questions')
        .delete()
        .in('id', questionIds)
      if (qErr) console.warn('Questions delete warning:', qErr)
    }

    // 5. Delete mastery
    await supabase.from('mastery').delete().eq('concept_id', conceptId)

    // 6. Delete study plan items
    await supabase.from('study_plan_items').delete().eq('concept_id', conceptId)

    // 7. Finally delete the concept
    const { error: cErr } = await supabase.from('concepts').delete().eq('id', conceptId)
    if (cErr) throw cErr
  } else {
    mockDb.setQuestions(mockDb.getQuestions().filter(q => q.concept_id !== conceptId))
    mockDb.setMastery(mockDb.getMastery().filter(m => m.concept_id !== conceptId))
    mockDb.setStudyPlan(mockDb.getStudyPlan().filter(sp => sp.concept_id !== conceptId))
    mockDb.setConcepts(mockDb.getConcepts().filter(c => c.id !== conceptId))
  }
}

export async function dbDeleteMaterial(materialId: string): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient()!
    const { data: relatedConcepts } = await supabase.from('concepts').select('id').eq('material_id', materialId)
    if (relatedConcepts && relatedConcepts.length > 0) {
      for (const c of relatedConcepts) {
        await dbDeleteConcept(c.id)
      }
    }
    const { error } = await supabase.from('materials').delete().eq('id', materialId)
    if (error) throw error
  } else {
    const conceptsToDelete = mockDb.getConcepts().filter(c => c.material_id === materialId)
    for (const c of conceptsToDelete) {
      await dbDeleteConcept(c.id)
    }
    mockDb.setMaterials(mockDb.getMaterials().filter(m => m.id !== materialId))
  }
}

export async function dbDeleteSubject(subjectId: string): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient()!
    // 1. Delete all materials (which cascades to concepts, questions, attempts)
    const { data: materials } = await supabase.from('materials').select('id').eq('subject_id', subjectId)
    if (materials && materials.length > 0) {
      for (const m of materials) {
        await dbDeleteMaterial(m.id)
      }
    }
    // 2. Delete any orphaned concepts under this subject
    const { data: concepts } = await supabase.from('concepts').select('id').eq('subject_id', subjectId)
    if (concepts && concepts.length > 0) {
      for (const c of concepts) {
        await dbDeleteConcept(c.id)
      }
    }
    // 3. Delete any tests under this subject
    const { data: tests } = await supabase.from('tests').select('id').eq('subject_id', subjectId)
    if (tests && tests.length > 0) {
      const testIds = tests.map(t => t.id)
      await supabase.from('test_student_attempts').delete().in('test_id', testIds)
      await supabase.from('test_students').delete().in('test_id', testIds)
      await supabase.from('tests').delete().in('id', testIds)
    }
    // 4. Finally delete the subject
    const { error } = await supabase.from('subjects').delete().eq('id', subjectId)
    if (error) throw error
  } else {
    const materials = mockDb.getMaterials().filter(m => m.subject_id === subjectId)
    for (const m of materials) {
      await dbDeleteMaterial(m.id)
    }
    mockDb.setSubjects(mockDb.getSubjects().filter(s => s.id !== subjectId))
  }
}

export async function dbFetchAttempts(userId: string): Promise<Attempt[]> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient()!
    const { data, error } = await supabase
      .from('attempts')
      .select('*, questions(prompt, concept_id, concepts(name))')
      .eq('user_id', userId)
      .order('answered_at', { ascending: false })
    if (error) throw error
    
    return (data || []).map(row => ({
      id: row.id,
      question_id: row.question_id,
      user_id: row.user_id,
      student_answer: row.student_answer,
      is_correct: row.is_correct,
      ai_feedback: row.ai_feedback,
      answered_at: row.answered_at,
      question_prompt: row.questions?.prompt || 'Unknown Question',
      concept_name: row.questions?.concepts?.name || 'Unknown Concept'
    }))
  } else {
    const attempts = mockDb.getAttempts().filter(a => a.user_id === userId)
    const questions = mockDb.getQuestions()
    const concepts = mockDb.getConcepts()

    return attempts.map(att => {
      const q = questions.find(qi => qi.id === att.question_id)
      const c = q ? concepts.find(ci => ci.id === q.concept_id) : null
      return {
        ...att,
        question_prompt: q?.prompt || 'Unknown Question',
        concept_name: c?.name || 'Unknown Concept'
      }
    }).sort((a,b) => b.answered_at.localeCompare(a.answered_at))
  }
}

export async function dbCreateAttempt(
  userId: string,
  questionId: string,
  studentAnswer: string,
  isCorrect: boolean,
  aiFeedback: string
): Promise<Attempt> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient()!
    const { data, error } = await supabase
      .from('attempts')
      .insert({ user_id: userId, question_id: questionId, student_answer: studentAnswer, is_correct: isCorrect, ai_feedback: aiFeedback })
      .select()
      .single()
    if (error) throw error
    return data
  } else {
    const newAtt: Attempt = {
      id: 'att-' + Math.random().toString(36).substr(2, 9),
      question_id: questionId,
      user_id: userId,
      student_answer: studentAnswer,
      is_correct: isCorrect,
      ai_feedback: aiFeedback,
      answered_at: new Date().toISOString()
    }
    const current = mockDb.getAttempts()
    mockDb.setAttempts([newAtt, ...current])
    return newAtt
  }
}

export async function dbFetchMastery(userId: string): Promise<Mastery[]> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient()!
    const { data, error } = await supabase
      .from('mastery')
      .select('*, concepts(name)')
      .eq('user_id', userId)
    if (error) throw error
    return (data || []).map(row => ({
      id: row.id,
      concept_id: row.concept_id,
      user_id: row.user_id,
      score: Number(row.score),
      last_updated: row.last_updated,
      concept_name: row.concepts?.name || 'Unknown Concept'
    }))
  } else {
    const masteries = mockDb.getMastery().filter(m => m.user_id === userId)
    const concepts = mockDb.getConcepts()
    return masteries.map(m => {
      const c = concepts.find(ci => ci.id === m.concept_id)
      return {
        ...m,
        concept_name: c?.name || 'Unknown Concept'
      }
    })
  }
}

export async function dbUpdateMastery(userId: string, conceptId: string, isCorrect: boolean): Promise<Mastery> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient()!
    
    // First check existing score
    const { data: existing } = await supabase
      .from('mastery')
      .select('*')
      .eq('user_id', userId)
      .eq('concept_id', conceptId)
      .single()

    const currentScore = existing ? Number(existing.score) : 50 // starts at 50
    const newScore = calculateNewMastery(currentScore, isCorrect)

    const { data, error } = await supabase
      .from('mastery')
      .upsert({
        user_id: userId,
        concept_id: conceptId,
        score: newScore,
        last_updated: new Date().toISOString()
      }, { onConflict: 'concept_id,user_id' })
      .select()
      .single()

    if (error) throw error
    return data
  } else {
    const current = mockDb.getMastery()
    const existing = current.find(m => m.user_id === userId && m.concept_id === conceptId)
    const currentScore = existing ? existing.score : 50
    const newScore = calculateNewMastery(currentScore, isCorrect)

    const updated: Mastery = {
      id: existing ? existing.id : 'm-' + Math.random().toString(36).substr(2, 9),
      concept_id: conceptId,
      user_id: userId,
      score: newScore,
      last_updated: new Date().toISOString()
    }

    if (existing) {
      mockDb.setMastery(current.map(m => m.id === existing.id ? updated : m))
    } else {
      mockDb.setMastery([...current, updated])
    }
    return updated
  }
}

export async function dbFetchStudyPlan(userId: string): Promise<StudyPlanItem[]> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient()!
    const { data, error } = await supabase
      .from('study_plan_items')
      .select('*, concepts(name, subject_id, mastery(score))')
      .eq('user_id', userId)
      .order('priority', { ascending: true })
    if (error) throw error
    
    return (data || []).map(row => {
      // Find the mastery score for the user
      // Note: concept row can have mastery as array because of eq/relationship
      const scoreVal = row.concepts?.mastery?.[0]?.score ?? 50
      return {
        id: row.id,
        user_id: row.user_id,
        concept_id: row.concept_id,
        priority: row.priority,
        suggested_minutes: row.suggested_minutes,
        planned_date: row.planned_date,
        completed: row.completed,
        concept_name: row.concepts?.name || 'Unknown Concept',
        mastery_score: Number(scoreVal)
      }
    })
  } else {
    const plans = mockDb.getStudyPlan().filter(p => p.user_id === userId)
    const concepts = mockDb.getConcepts()
    const masteries = mockDb.getMastery().filter(m => m.user_id === userId)

    return plans.map(p => {
      const c = concepts.find(ci => ci.id === p.concept_id)
      const m = masteries.find(mi => mi.concept_id === p.concept_id)
      return {
        ...p,
        concept_name: c?.name || 'Unknown Concept',
        mastery_score: m ? m.score : 50
      }
    }).sort((a,b) => a.priority - b.priority)
  }
}

export async function dbSaveStudyPlan(userId: string, items: Array<{ concept_id: string; priority: number; suggested_minutes: number }>): Promise<StudyPlanItem[]> {
  const dateStr = new Date().toISOString().split('T')[0] // today's date
  
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient()!
    
    // Delete existing uncompleted study plan items for today
    await supabase
      .from('study_plan_items')
      .delete()
      .eq('user_id', userId)
      .eq('completed', false)

    const rows = items.map(item => ({
      user_id: userId,
      concept_id: item.concept_id,
      priority: item.priority,
      suggested_minutes: item.suggested_minutes,
      planned_date: dateStr,
      completed: false
    }))

    const { data, error } = await supabase.from('study_plan_items').insert(rows).select()
    if (error) throw error
    return data || []
  } else {
    // Local storage
    const current = mockDb.getStudyPlan()
    // Remove uncompleted items for user
    const filtered = current.filter(p => !(p.user_id === userId && !p.completed))
    
    const newItems: StudyPlanItem[] = items.map(item => ({
      id: 'spi-' + Math.random().toString(36).substr(2, 9),
      user_id: userId,
      concept_id: item.concept_id,
      priority: item.priority,
      suggested_minutes: item.suggested_minutes,
      planned_date: dateStr,
      completed: false
    }))
    
    mockDb.setStudyPlan([...filtered, ...newItems])
    return newItems
  }
}

export async function dbToggleStudyPlanItemCompleted(itemId: string, completed: boolean): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient()!
    const { error } = await supabase
      .from('study_plan_items')
      .update({ completed })
      .eq('id', itemId)
    if (error) throw error
  } else {
    const current = mockDb.getStudyPlan()
    const updated = current.map(item => {
      if (item.id === itemId) {
        return { ...item, completed }
      }
      return item
    })
    mockDb.setStudyPlan(updated)
  }
}

// --- USER PROFILE & ROLE-BASED APIs ---

export async function dbFetchUserProfile(userId: string): Promise<UserProfile> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient()!
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single()
    if (error) {
      // If profile is missing (e.g. before trigger, or manual creation), fallback to student
      if (error.code === 'PGRST116') {
        const { data: userData } = await supabase.auth.getUser()
        const email = userData.user?.email || 'unknown@mystudy.ai'
        // Insert fallback
        const { data: newProfile, error: insErr } = await supabase
          .from('profiles')
          .insert({ id: userId, email, role: 'student' })
          .select()
          .single()
        if (insErr) throw insErr
        return newProfile
      }
      throw error
    }
    return data
  } else {
    // Local Storage mock profile
    const profiles = mockDb.getProfiles()
    let profile = profiles.find(p => p.id === userId)
    if (!profile) {
      const email = userId === MOCK_USER_ID ? 'student@mystudy.ai' : 'user@mystudy.ai'
      profile = {
        id: userId,
        email,
        role: userId.startsWith('teacher') ? 'teacher' : 'student', // simple heuristic for mock accounts
        created_at: new Date().toISOString()
      }
      mockDb.setProfiles([...profiles, profile])
    }
    return profile
  }
}

export async function dbSaveUserProfile(userId: string, email: string, role: 'teacher' | 'student'): Promise<UserProfile> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient()!
    // Since profiles has trigger, we upsert to be safe
    const { data, error } = await supabase
      .from('profiles')
      .upsert({ id: userId, email, role, created_at: new Date().toISOString() })
      .select()
      .single()
    if (error) throw error
    return data
  } else {
    const profiles = mockDb.getProfiles()
    const newProfile: UserProfile = {
      id: userId,
      email,
      role,
      created_at: new Date().toISOString()
    }
    mockDb.setProfiles([newProfile, ...profiles.filter(p => p.id !== userId)])
    return newProfile
  }
}

export async function dbUpdateUserProfile(
  userId: string,
  institution: string | null,
  avatarUrl: string | null
): Promise<UserProfile> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient()!
    const { data, error } = await supabase
      .from('profiles')
      .update({ institution, avatar_url: avatarUrl })
      .eq('id', userId)
      .select()
      .single()
    if (error) throw error
    return data
  } else {
    const profiles = mockDb.getProfiles()
    const existing = profiles.find(p => p.id === userId)
    if (!existing) {
      throw new Error('Profile not found')
    }
    const newProfile: UserProfile = {
      ...existing,
      institution,
      avatar_url: avatarUrl
    }
    mockDb.setProfiles([newProfile, ...profiles.filter(p => p.id !== userId)])
    return newProfile
  }
}


// --- TESTING APIs ---

function getTestMeta(id?: string, code?: string): { title?: string; question_type?: QuestionSettingType } | null {
  try {
    if (id) {
      const byId = localStorage.getItem(`mystudy_test_meta_${id}`)
      if (byId) return JSON.parse(byId)
    }
    if (code) {
      const byCode = localStorage.getItem(`mystudy_test_meta_code_${code}`)
      if (byCode) return JSON.parse(byCode)
    }
  } catch (e) {}
  return null
}

function saveTestMeta(id: string, code: string, meta: { title: string; question_type: QuestionSettingType }) {
  try {
    localStorage.setItem(`mystudy_test_meta_${id}`, JSON.stringify(meta))
    localStorage.setItem(`mystudy_test_meta_code_${code}`, JSON.stringify(meta))
  } catch (e) {}
}

export async function dbFetchTests(userId: string, role: 'teacher' | 'student'): Promise<Test[]> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient()!
    if (role === 'teacher') {
      const { data, error } = await supabase
        .from('tests')
        .select('*, subjects(name)')
        .eq('teacher_id', userId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data || []).map(row => {
        const meta = getTestMeta(row.id, row.code)
        return {
          id: row.id,
          teacher_id: row.teacher_id,
          title: row.title || meta?.title || row.subjects?.name || 'Assessment Test',
          subject_id: row.subject_id,
          question_count: row.question_count,
          question_type: (row.question_type || meta?.question_type || 'mixed') as QuestionSettingType,
          disable_guidance: row.disable_guidance,
          code: row.code,
          created_at: row.created_at,
          subject_name: row.subjects?.name || 'Unknown Subject'
        }
      })
    } else {
      // For student, fetch tests they have joined/enrolled in
      const { data, error } = await supabase
        .from('test_students')
        .select('*, tests(*, subjects(name))')
        .eq('student_id', userId)
      if (error) throw error
      return (data || []).filter(row => !!row.tests).map(row => {
        const meta = getTestMeta(row.tests.id, row.tests.code)
        return {
          id: row.tests.id,
          teacher_id: row.tests.teacher_id,
          title: row.tests.title || meta?.title || row.tests.subjects?.name || 'Assessment Test',
          subject_id: row.tests.subject_id,
          question_count: row.tests.question_count,
          question_type: (row.tests.question_type || meta?.question_type || 'mixed') as QuestionSettingType,
          disable_guidance: row.tests.disable_guidance,
          code: row.tests.code,
          created_at: row.tests.created_at,
          subject_name: row.tests.subjects?.name || 'Unknown Subject'
        }
      })
    }
  } else {
    // Mock storage tests
    const allTests = mockDb.getTests()
    const subjects = mockDb.getSubjects()
    if (role === 'teacher') {
      return allTests
        .filter(t => t.teacher_id === userId)
        .map(t => ({
          ...t,
          question_type: t.question_type || 'mixed',
          subject_name: subjects.find(s => s.id === t.subject_id)?.name || 'Unknown Subject'
        }))
    } else {
      const enrollments = mockDb.getTestStudents().filter(ts => ts.student_id === userId)
      return enrollments.map(e => {
        const t = allTests.find(tst => tst.id === e.test_id)!
        return {
          ...t,
          question_type: t?.question_type || 'mixed',
          subject_name: subjects.find(s => s.id === t?.subject_id)?.name || 'Unknown Subject'
        }
      })
    }
  }
}

export async function dbCreateTest(
  teacherId: string,
  title: string,
  subjectId: string,
  questionCount: number,
  disableGuidance: boolean,
  questionType: QuestionSettingType = 'mixed'
): Promise<Test> {
  // Generate random 6-character alphanumeric uppercase code
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }

  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient()!
    let data: any = null

    // Attempt 1: Full insert with title and question_type
    const res1 = await supabase
      .from('tests')
      .insert({
        teacher_id: teacherId,
        title,
        subject_id: subjectId,
        question_count: questionCount,
        question_type: questionType,
        disable_guidance: disableGuidance,
        code
      })
      .select()
      .single()

    if (!res1.error) {
      data = res1.data
    } else {
      console.warn('Initial test insert failed, testing schema column compatibility:', res1.error)
      const err1 = (res1.error.message || '').toLowerCase()

      // If question_type is missing in schema cache
      if (err1.includes('question_type')) {
        const res2 = await supabase
          .from('tests')
          .insert({
            teacher_id: teacherId,
            title,
            subject_id: subjectId,
            question_count: questionCount,
            disable_guidance: disableGuidance,
            code
          })
          .select()
          .single()

        if (!res2.error) {
          data = res2.data
        } else {
          const err2 = (res2.error.message || '').toLowerCase()
          if (err2.includes('title')) {
            // title is also missing in DB
            const res3 = await supabase
              .from('tests')
              .insert({
                teacher_id: teacherId,
                subject_id: subjectId,
                question_count: questionCount,
                disable_guidance: disableGuidance,
                code
              })
              .select()
              .single()

            if (res3.error) throw res3.error
            data = res3.data
          } else {
            throw res2.error
          }
        }
      } else if (err1.includes('title')) {
        // title is missing in DB
        const res2 = await supabase
          .from('tests')
          .insert({
            teacher_id: teacherId,
            subject_id: subjectId,
            question_count: questionCount,
            disable_guidance: disableGuidance,
            code
          })
          .select()
          .single()

        if (res2.error) throw res2.error
        data = res2.data
      } else {
        throw res1.error
      }
    }

    saveTestMeta(data.id, code, { title, question_type: questionType })

    return {
      id: data.id,
      teacher_id: data.teacher_id,
      title: data.title || title,
      subject_id: data.subject_id,
      question_count: data.question_count,
      question_type: (data.question_type || questionType) as QuestionSettingType,
      disable_guidance: data.disable_guidance,
      code: data.code,
      created_at: data.created_at
    }
  } else {
    const newTest: Test = {
      id: 'test-' + Math.random().toString(36).substr(2, 9),
      teacher_id: teacherId,
      title,
      subject_id: subjectId,
      question_count: questionCount,
      question_type: questionType,
      disable_guidance: disableGuidance,
      code,
      created_at: new Date().toISOString()
    }
    const current = mockDb.getTests()
    mockDb.setTests([newTest, ...current])
    saveTestMeta(newTest.id, code, { title, question_type: questionType })
    return newTest
  }
}

export async function dbFetchTestDetails(code: string): Promise<Test | null> {
  const cleanCode = code.trim().toUpperCase()
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient()!
    const { data, error } = await supabase
      .from('tests')
      .select('*, subjects(name)')
      .eq('code', cleanCode)
      .maybeSingle()
    if (error) throw error
    if (!data) return null
    const meta = getTestMeta(data.id, data.code)
    return {
      id: data.id,
      teacher_id: data.teacher_id,
      title: data.title || meta?.title || data.subjects?.name || 'Assessment Test',
      subject_id: data.subject_id,
      question_count: data.question_count,
      question_type: (data.question_type || meta?.question_type || 'mixed') as QuestionSettingType,
      disable_guidance: data.disable_guidance,
      code: data.code,
      created_at: data.created_at,
      subject_name: data.subjects?.name || 'Unknown Subject'
    }
  } else {
    const allTests = mockDb.getTests()
    const subjects = mockDb.getSubjects()
    const test = allTests.find(t => t.code === cleanCode)
    if (!test) return null
    const meta = getTestMeta(test.id, test.code)
    return {
      ...test,
      question_type: (test.question_type || meta?.question_type || 'mixed') as QuestionSettingType,
      subject_name: subjects.find(s => s.id === test.subject_id)?.name || 'Unknown Subject'
    }
  }
}

export async function dbJoinTest(studentId: string, testId: string): Promise<TestStudent> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient()!
    // Check if already joined
    const { data: existing } = await supabase
      .from('test_students')
      .select('*')
      .eq('test_id', testId)
      .eq('student_id', studentId)
      .maybeSingle()
    if (existing) return existing

    const { data, error } = await supabase
      .from('test_students')
      .insert({ test_id: testId, student_id: studentId })
      .select()
      .single()
    if (error) throw error
    return data
  } else {
    const enrollments = mockDb.getTestStudents()
    const existing = enrollments.find(e => e.test_id === testId && e.student_id === studentId)
    if (existing) return existing

    const newEnrollment: TestStudent = {
      id: 'ts-' + Math.random().toString(36).substr(2, 9),
      test_id: testId,
      student_id: studentId,
      completed: false,
      score: null,
      started_at: new Date().toISOString(),
      completed_at: null
    }
    mockDb.setTestStudents([newEnrollment, ...enrollments])
    return newEnrollment
  }
}

export async function dbFetchEnrolledTests(studentId: string): Promise<TestStudent[]> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient()!
    const { data, error } = await supabase
      .from('test_students')
      .select('*, tests(*, subjects(name))')
      .eq('student_id', studentId)
      .order('started_at', { ascending: false })
    if (error) throw error
    return (data || []).map(row => {
      const meta = getTestMeta(row.tests?.id, row.tests?.code)
      return {
        id: row.id,
        test_id: row.test_id,
        student_id: row.student_id,
        completed: row.completed,
        score: row.score === null ? null : Number(row.score),
        started_at: row.started_at,
        completed_at: row.completed_at,
        test_title: row.tests?.title || meta?.title || row.tests?.subjects?.name || 'Unknown Test',
        subject_id: row.tests?.subject_id,
        question_type: (row.tests?.question_type || meta?.question_type || 'mixed') as QuestionSettingType
      }
    })
  } else {
    const enrollments = mockDb.getTestStudents().filter(ts => ts.student_id === studentId)
    const tests = mockDb.getTests()
    return enrollments.map(e => {
      const t = tests.find(tst => tst.id === e.test_id)
      const meta = getTestMeta(t?.id, t?.code)
      return {
        ...e,
        test_title: t?.title || meta?.title || 'Unknown Test',
        subject_id: t?.subject_id,
        question_type: (t?.question_type || meta?.question_type || 'mixed') as QuestionSettingType
      }
    })
  }
}

export async function dbSubmitTestGrade(studentId: string, testId: string, score: number): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient()!
    const { error } = await supabase
      .from('test_students')
      .update({ completed: true, score: score, completed_at: new Date().toISOString() })
      .eq('test_id', testId)
      .eq('student_id', studentId)
    if (error) throw error
  } else {
    const enrollments = mockDb.getTestStudents()
    const updated = enrollments.map(e => {
      if (e.test_id === testId && e.student_id === studentId) {
        return {
          ...e,
          completed: true,
          score,
          completed_at: new Date().toISOString()
        }
      }
      return e
    })
    mockDb.setTestStudents(updated)
  }
}

export async function dbCreateTestAttempt(
  testId: string,
  studentId: string,
  questionId: string,
  studentAnswer: string,
  isCorrect: boolean,
  aiFeedback: string
): Promise<TestStudentAttempt> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient()!
    const { data, error } = await supabase
      .from('test_student_attempts')
      .insert({ test_id: testId, student_id: studentId, question_id: questionId, student_answer: studentAnswer, is_correct: isCorrect, ai_feedback: aiFeedback })
      .select()
      .single()
    if (error) throw error
    return data
  } else {
    const attempts = mockDb.getTestAttempts()
    const newAttempt: TestStudentAttempt = {
      id: 'tsa-' + Math.random().toString(36).substr(2, 9),
      test_id: testId,
      student_id: studentId,
      question_id: questionId,
      student_answer: studentAnswer,
      is_correct: isCorrect,
      ai_feedback: aiFeedback,
      answered_at: new Date().toISOString()
    }
    mockDb.setTestAttempts([newAttempt, ...attempts])
    return newAttempt
  }
}

export async function dbFetchTestScores(testId: string): Promise<TestStudent[]> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient()!
    const { data, error } = await supabase
      .from('test_students')
      .select('*, profiles(email)')
      .eq('test_id', testId)
      .order('completed_at', { ascending: false, nullsFirst: false })
    if (error) throw error
    return (data || []).map(row => ({
      id: row.id,
      test_id: row.test_id,
      student_id: row.student_id,
      completed: row.completed,
      score: row.score === null ? null : Number(row.score),
      started_at: row.started_at,
      completed_at: row.completed_at,
      student_email: row.profiles?.email || 'unknown@mystudy.ai'
    }))
  } else {
    const enrollments = mockDb.getTestStudents().filter(ts => ts.test_id === testId)
    const profiles = mockDb.getProfiles()
    return enrollments.map(e => {
      const p = profiles.find(pr => pr.id === e.student_id)
      return {
        ...e,
        student_email: p?.email || 'demo-worker@mystudy.ai'
      }
    })
  }
}

export async function dbJoinTestByCode(studentId: string, code: string): Promise<Test> {
  const test = await dbFetchTestDetails(code)
  if (!test) throw new Error('Test not found for code: ' + code)
  await dbJoinTest(studentId, test.id)
  return test
}
