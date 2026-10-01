import React, { useState, useEffect, useRef } from 'react'
import { 
  BookOpen, 
  Award, 
  Calendar, 
  Plus, 
  ArrowRight, 
  CheckCircle2, 
  XCircle, 
  Brain, 
  Compass, 
  Sparkles, 
  User, 
  LogOut, 
  Lightbulb, 
  Check, 
  RotateCcw, 
  FileText, 
  ChevronRight,
  TrendingUp,
  AlertTriangle,
  Clock,
  Menu,
  X,
  UploadCloud,
  Trash2,
  Sliders,
  CheckCircle,
  FileCheck,
  Printer,
  Search,
  FileSpreadsheet,
  Users
} from 'lucide-react'

// Import config and clients
import { getSupabaseClient, isSupabaseConfigured } from './lib/supabase'
import { 
  extractConcepts, 
  generateQuestions, 
  generateQuestionsFromMaterial,
  type QuestionSettingType,
  type ExtractedConcept,
  evaluateAnswer, 
  checkGuidedHelpGuardrail,
  generateStudyPlanReason
} from './lib/gemini'
import { 
  getDecayedMastery, 
  getTargetDifficulty, 
  generateStudyPlan
} from './lib/studyLogic'
import {
  dbFetchSubjects,
  dbCreateSubject,
  dbCreateMaterial,
  dbFetchMaterials,
  dbFetchConcepts,
  dbCreateConcepts,
  dbFetchQuestions,
  dbCreateQuestions,
  dbFetchQuestionsForSubject,
  dbDeleteConcept,
  dbDeleteSubject,
  dbFetchAttempts,
  dbCreateAttempt,
  dbFetchMastery,
  dbUpdateMastery,
  dbFetchStudyPlan,
  dbSaveStudyPlan,
  dbToggleStudyPlanItemCompleted,
  seedMockData,
  dbFetchUserProfile,
  dbFetchTests,
  dbFetchEnrolledTests,
  dbSaveUserProfile,
  dbCreateTestAttempt,
  dbSubmitTestGrade,
  dbJoinTestByCode,
  dbCreateTest,
  dbFetchTestScores,
  dbUpdateUserProfile
} from './lib/db'
import type {
  Subject,
  Concept,
  Question,
  Attempt,
  Mastery,
  StudyPlanItem,
  Test,
  TestStudent,
  UserProfile
} from './lib/db'
import { extractTextFromFile } from './lib/fileParser'


export default function App() {
  // --- STATE ---
  const [isDemoMode] = useState(!isSupabaseConfigured())
  const [session, setSession] = useState<{ user: { id: string; email: string } } | null>(null)
  const [userRole, setUserRole] = useState<'teacher' | 'student' | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  
  // Auth Form State
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [signUpRole, setSignUpRole] = useState<'teacher' | 'student'>('student')
  const [authError, setAuthError] = useState('')
  const [authLoading, setAuthLoading] = useState(false)

  // Navigation State
  const [activeTab, setActiveTab] = useState<'dashboard' | 'study' | 'progress' | 'studyplan' | 'tests' | 'profile'>('dashboard')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Test states
  const [tests, setTests] = useState<Test[]>([])
  const [enrolledTests, setEnrolledTests] = useState<TestStudent[]>([])
  const [activeTest, setActiveTest] = useState<Test | null>(null)
  const [joinTestCode, setJoinTestCode] = useState('')
  const [isJoiningTest, setIsJoiningTest] = useState(false)
  const [isCreatingTest, setIsCreatingTest] = useState(false)
  const [newTestTitle, setNewTestTitle] = useState('')
  const [newTestSubjectId, setNewTestSubjectId] = useState('')
  const [newTestQuestionCount, setNewTestQuestionCount] = useState(5)
  const [newTestQuestionType, setNewTestQuestionType] = useState<QuestionSettingType>('mixed')
  const [newTestDisableGuidance, setNewTestDisableGuidance] = useState(false)

  // Scores View & Export State
  const [viewingTestScores, setViewingTestScores] = useState<{
    test: Test
    scores: TestStudent[]
  } | null>(null)
  const [isLoadingScores, setIsLoadingScores] = useState<string | null>(null)
  const [scoresSearchQuery, setScoresSearchQuery] = useState('')

  // Export scores to CSV / Excel
  const handleExportCSV = (test: Test, scores: TestStudent[]) => {
    const headers = ['Student Email', 'Status', 'Score (%)', 'Started At', 'Completed At', 'Assessment Title', 'Access Code']
    const rows = scores.map(s => [
      `"${(s.student_email || s.student_id).replace(/"/g, '""')}"`,
      `"${s.completed ? 'Completed' : 'In Progress'}"`,
      s.completed ? (s.score !== null && s.score !== undefined ? s.score : 0) : 'N/A',
      `"${s.started_at ? new Date(s.started_at).toLocaleString() : 'N/A'}"`,
      `"${s.completed_at ? new Date(s.completed_at).toLocaleString() : 'N/A'}"`,
      `"${(test.title || 'Assessment').replace(/"/g, '""')}"`,
      `"${test.code}"`
    ])
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `${(test.title || 'assessment').replace(/[^a-zA-Z0-9_-]/g, '_')}_student_scores.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // Print / Save as PDF or Document report
  const handlePrintPDF = (test: Test, scores: TestStudent[]) => {
    const printWindow = window.open('', '_blank', 'width=900,height=700')
    if (!printWindow) {
      alert('Pop-up was blocked. Please allow pop-ups to generate PDF report.')
      return
    }

    const completedScores = scores.filter(s => s.completed && s.score !== null && s.score !== undefined)
    const avgScore = completedScores.length > 0 
      ? Math.round(completedScores.reduce((acc, curr) => acc + Number(curr.score || 0), 0) / completedScores.length) 
      : 0

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Assessment Report - ${test.title}</title>
  <style>
    @media print {
      body { margin: 20mm; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #1e293b; }
      .no-print { display: none; }
      table { page-break-inside: auto; }
      tr { page-break-inside: avoid; page-break-after: auto; }
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #0f172a;
      line-height: 1.5;
      padding: 32px;
      max-width: 900px;
      margin: 0 auto;
    }
    .header {
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 20px;
      margin-bottom: 24px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .title {
      font-size: 24px;
      font-weight: 800;
      color: #1e1b4b;
      margin: 0 0 6px 0;
    }
    .subtitle {
      font-size: 13px;
      color: #64748b;
      margin: 0;
    }
    .badge-code {
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      padding: 6px 14px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 2px;
      color: #4338ca;
    }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin-bottom: 28px;
    }
    .summary-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 14px 18px;
    }
    .summary-label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #64748b;
      font-weight: 600;
      margin-bottom: 4px;
    }
    .summary-val {
      font-size: 22px;
      font-weight: 800;
      color: #0f172a;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 12px;
      font-size: 13px;
    }
    th {
      background: #f1f5f9;
      text-align: left;
      padding: 10px 14px;
      font-weight: 700;
      color: #334155;
      border-bottom: 2px solid #cbd5e1;
    }
    td {
      padding: 10px 14px;
      border-bottom: 1px solid #e2e8f0;
    }
    tr:nth-child(even) {
      background: #f8fafc;
    }
    .score-badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 6px;
      font-weight: 700;
      font-size: 12px;
    }
    .score-high { background: #dcfce7; color: #15803d; }
    .score-mid { background: #fef9c3; color: #a16207; }
    .score-low { background: #fee2e2; color: #b91c1c; }
    .status-badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 600;
    }
    .status-completed { background: #e0e7ff; color: #3730a3; }
    .status-progress { background: #f1f5f9; color: #64748b; }
    .btn-print {
      background: #4f46e5;
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      margin-bottom: 20px;
    }
    .footer {
      margin-top: 40px;
      border-top: 1px solid #e2e8f0;
      padding-top: 14px;
      font-size: 11px;
      color: #94a3b8;
      display: flex;
      justify-content: space-between;
    }
  </style>
</head>
<body>
  <div class="no-print" style="margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
    <button class="btn-print" onclick="window.print()">🖨️ Print or Save as PDF</button>
    <span style="font-size: 12px; color: #64748b;">Tip: Select destination "Save as PDF" in print prompt to download.</span>
  </div>

  <div class="header">
    <div>
      <h1 class="title">${test.title || 'Student Assessment Report'}</h1>
      <p class="subtitle">Generated on ${new Date().toLocaleDateString(undefined, { dateStyle: 'full' })} at ${new Date().toLocaleTimeString()} • MyStudy Platform</p>
    </div>
    <div style="text-align: right;">
      <div style="font-size: 11px; color: #64748b; margin-bottom: 4px; font-weight: 600;">INVITATION CODE</div>
      <div class="badge-code">${test.code}</div>
    </div>
  </div>

  <div class="summary-grid">
    <div class="summary-card">
      <div class="summary-label">Total Enrolled</div>
      <div class="summary-val">${scores.length}</div>
    </div>
    <div class="summary-card">
      <div class="summary-label">Completed</div>
      <div class="summary-val">${completedScores.length}</div>
    </div>
    <div class="summary-card">
      <div class="summary-label">In Progress</div>
      <div class="summary-val">${scores.length - completedScores.length}</div>
    </div>
    <div class="summary-card">
      <div class="summary-label">Class Average</div>
      <div class="summary-val">${avgScore}%</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 5%;">#</th>
        <th style="width: 45%;">Student Email / Identity</th>
        <th style="width: 18%;">Status</th>
        <th style="width: 14%;">Score</th>
        <th style="width: 18%;">Completed Date</th>
      </tr>
    </thead>
    <tbody>
      ${scores.length === 0 ? '<tr><td colspan="5" style="text-align: center; padding: 24px; color: #94a3b8;">No students have enrolled or completed this assessment yet.</td></tr>' : ''}
      ${scores.map((s, idx) => {
        const isComp = s.completed
        const scoreVal = s.score !== null && s.score !== undefined ? Number(s.score) : 0
        const scoreClass = scoreVal >= 70 ? 'score-high' : scoreVal >= 50 ? 'score-mid' : 'score-low'
        return `
          <tr>
            <td>${idx + 1}</td>
            <td style="font-weight: 600; color: #1e293b;">${s.student_email || s.student_id}</td>
            <td><span class="status-badge ${isComp ? 'status-completed' : 'status-progress'}">${isComp ? 'Completed' : 'In Progress'}</span></td>
            <td>${isComp ? `<span class="score-badge ${scoreClass}">${scoreVal}%</span>` : '<span style="color: #94a3b8;">-</span>'}</td>
            <td style="color: #64748b;">${s.completed_at ? new Date(s.completed_at).toLocaleDateString() + ' ' + new Date(s.completed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
          </tr>
        `
      }).join('')}
    </tbody>
  </table>

  <div class="footer">
    <span>Assessment ID: ${test.id}</span>
    <span>MyStudy Automated Grading & Report</span>
  </div>
</body>
</html>`

    printWindow.document.open()
    printWindow.document.write(html)
    printWindow.document.close()
  }

  // Core Data State
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [currentSubject, setCurrentSubject] = useState<Subject | null>(null)
  const [concepts, setConcepts] = useState<Concept[]>([])
  const [currentConcept, setCurrentConcept] = useState<Concept | null>(null)
  const [masteries, setMasteries] = useState<Mastery[]>([])
  const [studyPlanItems, setStudyPlanItems] = useState<StudyPlanItem[]>([])
  const [attempts, setAttempts] = useState<Attempt[]>([])
  
  // Modal states for adding subjects without blocking prompt
  const [isAddSubjectModalOpen, setIsAddSubjectModalOpen] = useState(false)
  const [modalSubjectName, setModalSubjectName] = useState('')

  // Quiz Session State
  const [isPracticing, setIsPracticing] = useState(false)
  const [quizQuestions, setQuizQuestions] = useState<Question[]>([])
  const [activeQuestionIdx, setActiveQuestionIdx] = useState(0)
  const [studentAnswer, setStudentAnswer] = useState('')
  const [isSubmittingAnswer, setIsSubmittingAnswer] = useState(false)
  const [quizFeedback, setQuizFeedback] = useState<{
    is_correct: boolean
    score_percentage?: number
    feedback: string
    strengths?: string
    missing_points?: string
  } | null>(null)
  const [masteryChange, setMasteryChange] = useState<number | null>(null)
  const [testCorrectCount, setTestCorrectCount] = useState(0)
  const [flashcardRevealed, setFlashcardRevealed] = useState(false)
  const [isMaterialAssessment, setIsMaterialAssessment] = useState(false)

  // Creation/Form States
  const [newSubjectName, setNewSubjectName] = useState('')
  const [isCreatingSubject, setIsCreatingSubject] = useState(false)
  
  const [materialTitle, setMaterialTitle] = useState('')
  const [rawText, setRawText] = useState('')
  const [sourceType, setSourceType] = useState<'paste' | 'upload' | 'topic_only'>('upload')
  const [topicOnlyName, setTopicOnlyName] = useState('')
  const [isAddingMaterial, setIsAddingMaterial] = useState(false)
  const [materialLoadingState, setMaterialLoadingState] = useState<string>('') // loading description
  
  // File Upload Dropzone State
  const [uploadedFileName, setUploadedFileName] = useState('')
  const [uploadedFileSize, setUploadedFileSize] = useState('')
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Assessment / Question Generation Settings
  const [materialQuestionCount, setMaterialQuestionCount] = useState<number>(5)
  const [materialQuestionType, setMaterialQuestionType] = useState<QuestionSettingType>('mixed')
  
  // Study view control
  const [explainSimpler, setExplainSimpler] = useState(false)

  // Guardrail Warning State
  const [guardrailWarning, setGuardrailWarning] = useState<{ originalInput: string; guidance: string } | null>(null)

  // Study Plan setting
  const [studyMinutesBudget, setStudyMinutesBudget] = useState(60)
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false)

  // Global Alert
  const [globalError, setGlobalError] = useState('')

  // --- INITIALIZE & AUTH LISTENER ---
  useEffect(() => {
    if (isDemoMode) {
      // Simulate login in demo mode or read from localStorage
      const cachedSession = localStorage.getItem('study_demo_session')
      if (cachedSession) {
        setSession(JSON.parse(cachedSession))
      } else {
        const defaultSession = { user: { id: '00000000-0000-0000-0000-000000000000', email: 'student@mystudy.ai' } }
        localStorage.setItem('study_demo_session', JSON.stringify(defaultSession))
        setSession(defaultSession)
      }
      seedMockData()
    } else {
      // Supabase Live Auth setup
      const supabase = getSupabaseClient()
      if (supabase) {
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (session) {
            setSession({ user: { id: session.user.id, email: session.user.email || '' } })
          } else {
            setSession(null)
          }
        })

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
          if (session) {
            setSession({ user: { id: session.user.id, email: session.user.email || '' } })
          } else {
            setSession(null)
          }
        })

        return () => subscription.unsubscribe()
      }
    }
  }, [isDemoMode])

  // Reload data whenever session changes, or demo mode changes, or active tab changes
  useEffect(() => {
    if (session) {
      loadUserData()
    }
  }, [session, activeTab, isDemoMode])

  // --- LOAD DATA FROM DB ---
  const loadUserData = async () => {
    if (!session) return
    try {
      const uId = session.user.id

      // Fetch user profile to check the role
      const profile = await dbFetchUserProfile(uId)
      setUserProfile(profile)
      setUserRole(profile.role)

      if (profile.role === 'teacher') {
        const fetchedSubjects = await dbFetchSubjects(uId)
        setSubjects(fetchedSubjects)

        // Set default subject if none selected
        if (fetchedSubjects.length > 0 && !currentSubject) {
          setCurrentSubject(fetchedSubjects[0])
        }

        const fetchedTests = await dbFetchTests(uId, 'teacher')
        setTests(fetchedTests)
      } else {
        // Student role
        const fetchedEnrolled = await dbFetchEnrolledTests(uId)
        setEnrolledTests(fetchedEnrolled)

        // Fetch tests to extract subjects for student
        const fetchedTests = await dbFetchTests(uId, 'student')
        setTests(fetchedTests)

        // Fetch subjects associated with enrolled tests OR created by the student
        const fetchedSubjects = await dbFetchSubjects(uId) // will fetch all visible subjects thanks to RLS policy
        const uniqueSubjectIds = Array.from(new Set(fetchedTests.map((t: Test) => t.subject_id)))
        const filteredSubjects = fetchedSubjects.filter((s: Subject) => uniqueSubjectIds.includes(s.id) || s.user_id === uId)
        setSubjects(filteredSubjects)

        if (filteredSubjects.length > 0 && !currentSubject) {
          setCurrentSubject(filteredSubjects[0])
        }
      }

      // Fetch global progress and plans
      const fetchedMastery = await dbFetchMastery(uId)
      setMasteries(fetchedMastery)

      const fetchedPlans = await dbFetchStudyPlan(uId)
      setStudyPlanItems(fetchedPlans)

      const fetchedAttempts = await dbFetchAttempts(uId)
      setAttempts(fetchedAttempts)
    } catch (err: any) {
      console.error(err)
      setGlobalError(err.message || 'Failed to load user data')
    }
  }

  // Load subject-specific details when currentSubject changes
  useEffect(() => {
    if (currentSubject) {
      loadSubjectDetails(currentSubject.id)
    } else {
      setConcepts([])
      setCurrentConcept(null)
    }
  }, [currentSubject, session])

  const loadSubjectDetails = async (subId: string) => {
    try {
      const fetchedConcepts = await dbFetchConcepts(subId)
      setConcepts(fetchedConcepts)

      if (fetchedConcepts.length > 0) {
        setCurrentConcept(fetchedConcepts[0])
      } else {
        setCurrentConcept(null)
      }
    } catch (err: any) {
      console.error(err)
      setGlobalError('Failed to load subject materials')
    }
  }

  // --- AUTH OPERATIONS ---
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthError('')
    setAuthLoading(true)

    if (isDemoMode) {
      // Simulate auth in demo mode
      const isTeacher = authEmail.toLowerCase().includes('teacher') || signUpRole === 'teacher';
      const role = isTeacher ? 'teacher' : 'student';
      const uId = isTeacher ? 'teacher-demo-id' : 'student-demo-id';
      
      const simulatedSession = { user: { id: uId, email: authEmail || (isTeacher ? 'teacher@mystudy.ai' : 'student@mystudy.ai') } }
      localStorage.setItem('study_demo_session', JSON.stringify(simulatedSession))
      
      // Save profile in mock localStorage
      await dbSaveUserProfile(simulatedSession.user.id, simulatedSession.user.email, role)
      
      setSession(simulatedSession)
      setAuthLoading(false)
      return
    }

    const supabase = getSupabaseClient()
    if (!supabase) {
      setAuthError('Supabase is not configured yet.')
      setAuthLoading(false)
      return
    }

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email: authEmail,
          password: authPassword,
          options: {
            data: {
              role: signUpRole
            }
          }
        })
        if (error) throw error
        if (data.user) {
          await dbSaveUserProfile(data.user.id, authEmail, signUpRole)
          alert('Sign up successful! Please check your email for verification (if enabled) or log in.')
          setIsSignUp(false)
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: authEmail,
          password: authPassword,
        })
        if (error) throw error
      }
    } catch (err: any) {
      setAuthError(err.message || 'Authentication failed')
    } finally {
      setAuthLoading(false)
    }
  }

  const handleLogout = async () => {
    if (isDemoMode) {
      localStorage.removeItem('study_demo_session')
      setSession(null)
    } else {
      const supabase = getSupabaseClient()
      if (supabase) {
        await supabase.auth.signOut()
        setSession(null)
      }
    }
    // Clear state
    setSubjects([])
    setCurrentSubject(null)
    setConcepts([])
    setCurrentConcept(null)
    setMasteries([])
    setStudyPlanItems([])
    setAttempts([])
  }

  // --- CREATION OPERATIONS ---
  const handleCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!session || !newSubjectName.trim()) return
    setIsCreatingSubject(true)
    try {
      const newSub = await dbCreateSubject(session.user.id, newSubjectName.trim())
      setSubjects(prev => [newSub, ...prev])
      setCurrentSubject(newSub)
      setNewSubjectName('')
      alert(`Subject "${newSub.name}" created! Now add your study material to extract concepts.`)
    } catch (err: any) {
      alert(err.message || 'Failed to create subject')
    } finally {
      setIsCreatingSubject(false)
    }
  }

  const handleModalCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!session || !modalSubjectName.trim()) return
    setIsCreatingSubject(true)
    try {
      const newSub = await dbCreateSubject(session.user.id, modalSubjectName.trim())
      setSubjects(prev => [newSub, ...prev])
      setCurrentSubject(newSub)
      setModalSubjectName('')
      setIsAddSubjectModalOpen(false)
      alert(`Subject "${newSub.name}" created! Now select it and add study material.`)
    } catch (err: any) {
      alert(err.message || 'Failed to create subject')
    } finally {
      setIsCreatingSubject(false)
    }
  }

  // File Upload parser (client side reader)
  const processUploadedFile = async (file: File) => {
    if (!file) return
    const title = file.name.replace(/\.[^/.]+$/, "")
    setMaterialTitle(title)
    setUploadedFileName(file.name)
    const sizeInKb = (file.size / 1024).toFixed(1)
    const sizeStr = file.size > 1024 * 1024 ? `${(file.size / (1024 * 1024)).toFixed(2)} MB` : `${sizeInKb} KB`
    setUploadedFileSize(sizeStr)
    setRawText("Reading and parsing document, please wait...")
    
    try {
      const text = await extractTextFromFile(file)
      setRawText(text)
    } catch (err: any) {
      console.error(err)
      alert(err.message || "Failed to extract text from file.")
      setRawText("")
      setMaterialTitle("")
      setUploadedFileName("")
      setUploadedFileSize("")
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processUploadedFile(file)
  }

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) processUploadedFile(file)
  }

  const handleDeleteConcept = async (conceptId: string, conceptName: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    if (!confirm(`Are you sure you want to delete concept "${conceptName}" and all its questions?`)) return
    try {
      await dbDeleteConcept(conceptId)
      setConcepts(prev => prev.filter(c => c.id !== conceptId))
      if (currentConcept?.id === conceptId) {
        const remaining = concepts.filter(c => c.id !== conceptId)
        setCurrentConcept(remaining.length > 0 ? remaining[0] : null)
      }
      loadUserData()
      if (currentSubject) {
        await loadSubjectDetails(currentSubject.id)
      }
    } catch (err: any) {
      alert('Failed to delete concept: ' + (err.message || err))
    }
  }

  const handleDeleteSubject = async (subjectId: string, subjectName: string) => {
    if (!confirm(`Are you sure you want to delete the entire subject "${subjectName}" and all its materials, concepts, and questions?`)) return
    try {
      await dbDeleteSubject(subjectId)
      const remainingSubjects = subjects.filter(s => s.id !== subjectId)
      setSubjects(remainingSubjects)
      if (currentSubject?.id === subjectId) {
        setCurrentSubject(remainingSubjects.length > 0 ? remainingSubjects[0] : null)
      }
      loadUserData()
    } catch (err: any) {
      alert('Failed to delete subject: ' + (err.message || err))
    }
  }

  const handleAddMaterial = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentSubject || !session) return
    
    let contentToSubmit = ''
    let titleToSubmit = ''

    if (sourceType === 'topic_only') {
      if (!topicOnlyName.trim()) return
      titleToSubmit = topicOnlyName.trim()
      contentToSubmit = `Study materials and key principles related to the topic of ${topicOnlyName.trim()}.`
    } else {
      if (!rawText.trim()) return
      contentToSubmit = rawText.trim()
      titleToSubmit = materialTitle.trim() || `Material - ${new Date().toLocaleDateString()}`
    }

    setIsAddingMaterial(true)
    setMaterialLoadingState('Step 1: Checking study material...')
    setGuardrailWarning(null)

    try {
      // Check Guided-Help Guardrail safely
      try {
        const guardrail = await checkGuidedHelpGuardrail(contentToSubmit)
        if (guardrail.isAssignment) {
          setGuardrailWarning({
            originalInput: contentToSubmit,
            guidance: guardrail.guidance || "It looks like you've uploaded an assignment. Let's work through this step by step."
          })
          setIsAddingMaterial(false)
          return
        }
      } catch (guardErr) {
        console.warn('Guardrail check skipped due to connection:', guardErr)
      }

      // Proceed with creation
      setMaterialLoadingState('Step 2: Saving material details...')
      const newMat = await dbCreateMaterial(currentSubject.id, titleToSubmit, contentToSubmit, sourceType)
      
      setMaterialLoadingState('Step 3: Extracting key study concepts from your material...')
      const extracted = await extractConcepts(contentToSubmit)

      if (extracted.length === 0) {
        throw new Error('No concepts could be extracted from this material. Try providing more detailed text.')
      }

      setMaterialLoadingState('Step 4: Creating study concepts...')
      const newConcepts = await dbCreateConcepts(extracted, newMat.id, currentSubject.id)

      setMaterialLoadingState(`Step 5: Setting ${materialQuestionCount} ${materialQuestionType.toUpperCase()} questions directly from your notes...`)
      
      try {
        const generatedQs = await generateQuestionsFromMaterial(
          titleToSubmit,
          contentToSubmit,
          materialQuestionCount,
          materialQuestionType,
          extracted
        )

        if (generatedQs.length > 0 && newConcepts.length > 0) {
          // Distribute questions among extracted concepts
          for (let i = 0; i < generatedQs.length; i++) {
            const q = generatedQs[i]
            const matchedConcept = newConcepts.find(c => c.name.toLowerCase() === q.concept_name?.toLowerCase()) || newConcepts[i % newConcepts.length]
            await dbCreateQuestions([q], matchedConcept.id)
          }
        }
      } catch (genErr) {
        console.warn('Material question generation warning, falling back to per-concept generation:', genErr)
        for (const concept of newConcepts) {
          const matchingConcept = extracted.find(e => e.name.toLowerCase() === concept.name.toLowerCase())
          const summary = matchingConcept ? matchingConcept.summary : concept.summary
          const fallbackQs = await generateQuestions(concept.name, summary)
          if (fallbackQs.length > 0) {
            await dbCreateQuestions(fallbackQs, concept.id)
          }
        }
      }

      // Reset Form State
      setRawText('')
      setMaterialTitle('')
      setTopicOnlyName('')
      setUploadedFileName('')
      setUploadedFileSize('')
      
      // Reload UI Data
      await loadSubjectDetails(currentSubject.id)
      await loadUserData()
      
      alert(`Success! Extracted ${newConcepts.length} concepts and generated ${materialQuestionCount} ${materialQuestionType} questions directly from your material.`)
    } catch (err: any) {
      console.error(err)
      alert(err.message || 'Failed to process study material')
    } finally {
      setIsAddingMaterial(false)
      setMaterialLoadingState('')
    }
  }

  // --- PRACTICE / QUIZ FLOW ---
  const startPractice = async (concept: Concept) => {
    setIsPracticing(true)
    setIsMaterialAssessment(false)
    setActiveTest(null)
    setQuizQuestions([])
    setActiveQuestionIdx(0)
    setStudentAnswer('')
    setQuizFeedback(null)
    setMasteryChange(null)
    setFlashcardRevealed(false)

    try {
      // Find questions
      let qs = await dbFetchQuestions(concept.id)
      
      // If no questions exist, generate them now
      if (qs.length === 0) {
        alert('Generating practice questions for this concept...')
        const generatedQs = await generateQuestions(concept.name, concept.summary)
        qs = await dbCreateQuestions(generatedQs, concept.id)
      }

      // Dynamic difficulty targeting
      const conceptMastery = masteries.find(m => m.concept_id === concept.id)
      const currentScore = conceptMastery ? getDecayedMastery(conceptMastery.score, conceptMastery.last_updated) : 50
      const targetDiff = getTargetDifficulty(currentScore)
      
      let filteredQs = qs.filter(q => Math.abs(q.difficulty - targetDiff) <= 1)
      if (filteredQs.length === 0) {
        filteredQs = qs
      }

      // Shuffle a max of 5 questions for this session
      const shuffled = [...filteredQs].sort(() => 0.5 - Math.random()).slice(0, 5)
      setQuizQuestions(shuffled)
      setCurrentConcept(concept)
    } catch (err: any) {
      console.error(err)
      alert('Could not start practice session: ' + err.message)
      setIsPracticing(false)
    }
  }

  const startMaterialAssessment = async (subject: Subject) => {
    setIsPracticing(true)
    setIsMaterialAssessment(true)
    setActiveTest(null)
    setQuizQuestions([])
    setActiveQuestionIdx(0)
    setStudentAnswer('')
    setQuizFeedback(null)
    setMasteryChange(null)
    setFlashcardRevealed(false)

    try {
      const allQs = await dbFetchQuestionsForSubject(subject.id)
      if (allQs.length === 0) {
        alert('No assessment questions found for this subject. Add study material to generate questions first.')
        setIsPracticing(false)
        return
      }

      const shuffled = [...allQs].sort(() => 0.5 - Math.random())
      setQuizQuestions(shuffled)
      if (concepts.length > 0) {
        setCurrentConcept(concepts[0])
      }
    } catch (err: any) {
      console.error(err)
      alert('Could not start material assessment: ' + err.message)
      setIsPracticing(false)
    }
  }

  const handleAnswerSubmit = async () => {
    if (!session || quizQuestions.length === 0) return
    const activeQ = quizQuestions[activeQuestionIdx]
    const uId = session.user.id
    
    setIsSubmittingAnswer(true)
    setMasteryChange(null)

    try {
      let isCorrect = false
      let feedbackText = ''

      if (activeQ.question_type === 'flashcard') {
        return
      }

      // MCQ or Short Answer/Theory/Body: Grade via AI with conceptual understanding
      const grading = await evaluateAnswer(
        activeQ.prompt,
        activeQ.correct_answer,
        studentAnswer.trim(),
        activeQ.sub_type || activeQ.question_type,
        currentConcept?.summary
      )
      isCorrect = grading.is_correct
      feedbackText = grading.feedback

      if (activeTest) {
        // Record test attempt
        await dbCreateTestAttempt(activeTest.id, uId, activeQ.id, studentAnswer, isCorrect, feedbackText)
        
        let newCorrectCount = testCorrectCount
        if (isCorrect) {
          newCorrectCount = testCorrectCount + 1
          setTestCorrectCount(newCorrectCount)
        }

        // If guidance is disabled, skip feedback and proceed
        if (activeTest.disable_guidance) {
          if (activeQuestionIdx + 1 < quizQuestions.length) {
            setActiveQuestionIdx(prev => prev + 1)
            setStudentAnswer('')
            setQuizFeedback(null)
          } else {
            const finalScore = Math.round((newCorrectCount / quizQuestions.length) * 100)
            await dbSubmitTestGrade(uId, activeTest.id, finalScore)
            
            setQuizFeedback({
              is_correct: finalScore >= 50,
              score_percentage: finalScore,
              feedback: `Test Completed! You scored ${finalScore}% (${newCorrectCount} / ${quizQuestions.length} correct answers).`
            })
          }
          setIsSubmittingAnswer(false)
          return
        }
      } else if (currentConcept) {
        // Self-study Concept practice attempt
        await dbCreateAttempt(uId, activeQ.id, studentAnswer, isCorrect, feedbackText)

        // Update Mastery Score (+8 if correct, -15 if incorrect)
        const conceptMastery = masteries.find(m => m.concept_id === currentConcept.id)
        const oldScore = conceptMastery ? conceptMastery.score : 50
        const updatedMastery = await dbUpdateMastery(uId, currentConcept.id, isCorrect)
        
        // Calculate delta
        setMasteryChange(updatedMastery.score - oldScore)
      }

      setQuizFeedback({
        is_correct: isCorrect,
        score_percentage: grading.score_percentage,
        feedback: feedbackText,
        strengths: grading.strengths,
        missing_points: grading.missing_points
      })

      // Reload global masteries
      loadUserData()
    } catch (err: any) {
      console.error(err)
      alert('Error submitting answer: ' + err.message)
    } finally {
      setIsSubmittingAnswer(false)
    }
  }

  const handleFlashcardGrade = async (isCorrect: boolean) => {
    if (!session || quizQuestions.length === 0) return
    const activeQ = quizQuestions[activeQuestionIdx]
    const uId = session.user.id
    
    setIsSubmittingAnswer(true)
    setMasteryChange(null)

    try {
      const feedbackText = isCorrect 
        ? "Excellent recall! You confirmed understanding of this flashcard term."
        : "No problem. Review this term again. Try summarizing it in your own words next time."

      if (activeTest) {
        await dbCreateTestAttempt(activeTest.id, uId, activeQ.id, '[Self Graded Flashcard]', isCorrect, feedbackText)
        let newCorrectCount = testCorrectCount
        if (isCorrect) {
          newCorrectCount = testCorrectCount + 1
          setTestCorrectCount(newCorrectCount)
        }

        if (activeTest.disable_guidance) {
          if (activeQuestionIdx + 1 < quizQuestions.length) {
            setActiveQuestionIdx(prev => prev + 1)
            setStudentAnswer('')
            setQuizFeedback(null)
            setFlashcardRevealed(false)
          } else {
            const finalScore = Math.round((newCorrectCount / quizQuestions.length) * 100)
            await dbSubmitTestGrade(uId, activeTest.id, finalScore)
            setQuizFeedback({
              is_correct: finalScore >= 50,
              feedback: `Test Completed! You scored ${finalScore}% (${newCorrectCount} / ${quizQuestions.length} correct answers).`
            })
          }
          setIsSubmittingAnswer(false)
          return
        }
      } else if (currentConcept) {
        await dbCreateAttempt(uId, activeQ.id, '[Self Graded Flashcard]', isCorrect, feedbackText)
        const conceptMastery = masteries.find(m => m.concept_id === currentConcept.id)
        const oldScore = conceptMastery ? conceptMastery.score : 50
        const updatedMastery = await dbUpdateMastery(uId, currentConcept.id, isCorrect)
        setMasteryChange(updatedMastery.score - oldScore)
      }

      setQuizFeedback({ is_correct: isCorrect, feedback: feedbackText })
      loadUserData()
    } catch (err: any) {
      console.error(err)
      alert(err.message || 'Error updating score')
    } finally {
      setIsSubmittingAnswer(false)
    }
  }

  const handleNextQuizQuestion = () => {
    if (!session) return
    const uId = session.user.id
    if (activeTest) {
      // If we are currently showing the test score feedback (test is complete)
      const isTestCompleteFeedback = quizFeedback && quizFeedback.feedback.includes("Test Completed!")
      if (isTestCompleteFeedback) {
        setIsPracticing(false)
        setActiveTest(null)
        setQuizFeedback(null)
        setTestCorrectCount(0)
        setActiveQuestionIdx(0)
        setStudentAnswer('')
        loadUserData()
        return
      }

      // If guidance is enabled, we show feedback between questions. Proceed to next question:
      if (activeQuestionIdx + 1 < quizQuestions.length) {
        setActiveQuestionIdx(prev => prev + 1)
        setStudentAnswer('')
        setQuizFeedback(null)
        setFlashcardRevealed(false)
      } else {
        // Last question submitted, calculate grade and show test complete screen
        const finalScore = Math.round((testCorrectCount / quizQuestions.length) * 100)
        dbSubmitTestGrade(uId, activeTest.id, finalScore).then(() => {
          setQuizFeedback({
            is_correct: finalScore >= 50,
            feedback: `Test Completed! You scored ${finalScore}% (${testCorrectCount} / ${quizQuestions.length} correct answers).`
          })
        })
      }
    } else {
      if (activeQuestionIdx + 1 < quizQuestions.length) {
        setActiveQuestionIdx(prev => prev + 1)
        setStudentAnswer('')
        setQuizFeedback(null)
        setMasteryChange(null)
        setFlashcardRevealed(false)
      } else {
        // Quiz finished!
        setIsPracticing(false)
        alert('Practice session complete! Check your progress dashboard to see how your mastery scores have updated.')
        loadUserData()
      }
    }
  }

  // --- STUDY PLAN GENERATION ---
  const handleGenerateStudyPlan = async () => {
    if (!session) return
    setIsGeneratingPlan(true)
    try {
      // Build concept list for algorithm
      // Get all concepts across all subjects to schedule
      const allConcepts: Concept[] = []
      for (const sub of subjects) {
        const subConcepts = await dbFetchConcepts(sub.id)
        allConcepts.push(...subConcepts)
      }

      if (allConcepts.length === 0) {
        alert('Please add some study materials and extract concepts first.')
        setIsGeneratingPlan(false)
        return
      }

      const conceptsWithScores = allConcepts.map(c => {
        const m = masteries.find(ma => ma.concept_id === c.id)
        // Apply decay dynamically
        const decayedScore = m ? getDecayedMastery(m.score, m.last_updated) : 50
        return {
          id: c.id,
          name: c.name,
          score: decayedScore
        }
      })

      // Generate base study plan using deterministic algorithm
      const planDraft = generateStudyPlan(conceptsWithScores, studyMinutesBudget)

      // Find the weakest concept overall
      const weakestId = planDraft[0]?.concept_id

      // Call Gemini in parallel to generate personalized, encouraging explanations for today's recommended topics
      const finalizedItems = await Promise.all(
        planDraft.map(async (item) => {
          try {
            const isWeakest = item.concept_id === weakestId
            const conceptScore = conceptsWithScores.find(c => c.id === item.concept_id)?.score || 50
            const reason = await generateStudyPlanReason(item.concept_name, conceptScore, isWeakest)
            return {
              ...item,
              ai_reason: reason
            }
          } catch (reasonErr) {
            return {
              ...item,
              ai_reason: 'Important focus area for conceptual balance.'
            }
          }
        })
      )

      // Save plan items to DB
      await dbSaveStudyPlan(session.user.id, finalizedItems)

      // Reload
      const fetchedPlans = await dbFetchStudyPlan(session.user.id)
      setStudyPlanItems(fetchedPlans)
      alert(`Successfully generated a personalized ${studyMinutesBudget}-minute study schedule!`)
    } catch (err: any) {
      console.error(err)
      alert('Failed to generate study plan: ' + err.message)
    } finally {
      setIsGeneratingPlan(false)
    }
  }

  const handleTogglePlanItem = async (itemId: string, completed: boolean) => {
    try {
      await dbToggleStudyPlanItemCompleted(itemId, completed)
      setStudyPlanItems(prev => prev.map(item => item.id === itemId ? { ...item, completed } : item))
    } catch (err: any) {
      console.error(err)
    }
  }



  // --- UTILITY RENDERERS ---

  // Overall subject mastery (average of concepts)
  const getSubjectMasteryMetrics = (subId: string) => {
    const subConcepts = concepts.filter(c => c.subject_id === subId)
    if (subConcepts.length === 0) return { avg: 50, weakest: null, weakestScore: null }
    
    let totalScore = 0
    let weakestConcept: Concept | null = null
    let weakestScore = 101

    subConcepts.forEach(c => {
      const m = masteries.find(ma => ma.concept_id === c.id)
      const decayedScore = m ? getDecayedMastery(m.score, m.last_updated) : 50
      totalScore += decayedScore

      if (decayedScore < weakestScore) {
        weakestScore = decayedScore
        weakestConcept = c
      }
    })

    return {
      avg: Math.round(totalScore / subConcepts.length),
      weakest: weakestConcept ? (weakestConcept as Concept).name : null,
      weakestScore: weakestConcept ? weakestScore : null
    }
  }

  // --- VIEW RENDERING ---

  // Auth Screen
  if (!session) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
        <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
          <div className="inline-flex items-center justify-center p-1 bg-white rounded-3xl shadow-lg mb-4 border border-slate-100">
            <img src="/logo.png" className="h-20 w-20 object-contain rounded-2xl" alt="Mystudy Logo" />
          </div>
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Mystudy</h2>
          <p className="mt-2 text-sm text-slate-600">
            Your Socratic, AI-powered active learning mentor
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow-md sm:rounded-2xl sm:px-10 border border-slate-100">
            {authError && (
              <div className="mb-4 bg-rose-50 border border-rose-200 text-rose-600 rounded-lg p-3 text-sm flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            <form onSubmit={handleAuth} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="student@learning.com"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Password</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 text-sm"
                />
              </div>

              {isSignUp && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Select Role</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setSignUpRole('student')}
                      className={`flex-1 py-2 px-3 border rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        signUpRole === 'student'
                          ? 'border-violet-600 bg-violet-50 text-violet-700 shadow-sm'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                      }`}
                    >
                      I am a Student / Worker
                    </button>
                    <button
                      type="button"
                      onClick={() => setSignUpRole('teacher')}
                      className={`flex-1 py-2 px-3 border rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        signUpRole === 'teacher'
                          ? 'border-violet-600 bg-violet-50 text-violet-700 shadow-sm'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                      }`}
                    >
                      I am a Teacher / Instructor
                    </button>
                  </div>
                </div>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-violet-500 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {authLoading ? 'Loading...' : isSignUp ? 'Sign Up' : 'Log In'}
                </button>
              </div>
            </form>

            <div className="mt-6 flex flex-col items-center gap-3">
              <button
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-sm text-violet-600 hover:text-violet-500 font-medium cursor-pointer"
              >
                {isSignUp ? 'Already have an account? Log In' : "Don't have an account? Sign Up"}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Layout with sidebar
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans">
      
      {/* GLOBAL ERROR BANNER */}
      {globalError && (
        <div className="fixed bottom-4 right-4 max-w-sm z-50 bg-rose-600 text-white rounded-xl shadow-2xl p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
          <div className="flex-1 text-sm">
            <h4 className="font-bold">Error Occurred</h4>
            <p className="opacity-90">{globalError}</p>
            <button 
              onClick={() => setGlobalError('')} 
              className="mt-2 text-xs bg-white text-rose-600 px-2 py-1 rounded font-semibold hover:bg-opacity-90"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* MOBILE HEADER */}
      <header className="md:hidden bg-white border-b border-slate-200 px-4 py-3 flex justify-between items-center w-full shadow-sm">
        <div className="flex items-center gap-2">
          <img src="/logo.png" className="h-7 w-7 object-contain rounded-md" alt="Mystudy Logo" />
          <span className="font-bold text-slate-800 text-lg">Mystudy</span>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="text-slate-600 focus:outline-none"
        >
          {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </header>

      {/* SIDEBAR NAVIGATION */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-slate-200 flex flex-col shadow-sm transition-transform md:translate-x-0 md:static md:h-screen
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-0.5 bg-white border border-slate-100 rounded-xl">
              <img src="/logo.png" className="h-8 w-8 object-contain rounded-lg" alt="Mystudy Logo" />
            </div>
            <span className="font-bold text-slate-900 text-lg">Mystudy</span>
          </div>
          <button className="md:hidden text-slate-400" onClick={() => setMobileMenuOpen(false)}>
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* NAVIGATION LINKS */}
        <nav className="flex-1 px-4 py-4 space-y-1.5 overflow-y-auto">
          {userRole === 'teacher' ? (
            <>
              <button
                onClick={() => { setActiveTab('dashboard'); setMobileMenuOpen(false); }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer hover:translate-x-1 ${
                  activeTab === 'dashboard' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Compass className={`h-5 w-5 ${activeTab === 'dashboard' ? 'text-white' : 'text-slate-500'}`} />
                Dashboard
              </button>

              <button
                onClick={() => { setActiveTab('study'); setMobileMenuOpen(false); }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer hover:translate-x-1 ${
                  activeTab === 'study' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <BookOpen className={`h-5 w-5 ${activeTab === 'study' ? 'text-white' : 'text-slate-500'}`} />
                Subjects & Materials
              </button>

              <button
                onClick={() => { setActiveTab('tests'); setMobileMenuOpen(false); }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer hover:translate-x-1 ${
                  activeTab === 'tests' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <FileText className={`h-5 w-5 ${activeTab === 'tests' ? 'text-white' : 'text-slate-500'}`} />
                Tests & Invites
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => { setActiveTab('dashboard'); setMobileMenuOpen(false); }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer hover:translate-x-1 ${
                  activeTab === 'dashboard' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Compass className={`h-5 w-5 ${activeTab === 'dashboard' ? 'text-white' : 'text-slate-500'}`} />
                My Active Tests
              </button>

              <button
                onClick={() => { setActiveTab('studyplan'); setMobileMenuOpen(false); }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer hover:translate-x-1 ${
                  activeTab === 'studyplan' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Calendar className={`h-5 w-5 ${activeTab === 'studyplan' ? 'text-white' : 'text-slate-500'}`} />
                Study Plan
              </button>

              <button
                onClick={() => { setActiveTab('progress'); setMobileMenuOpen(false); }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer hover:translate-x-1 ${
                  activeTab === 'progress' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Award className={`h-5 w-5 ${activeTab === 'progress' ? 'text-white' : 'text-slate-500'}`} />
                Progress Tracker
              </button>
            </>
          )}

          <div className="pt-6 border-t border-slate-100">
            <p className="px-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">Subjects</p>
            <div className="mt-2 space-y-1">
              {subjects.map(sub => (
                <button
                  key={sub.id}
                  onClick={() => { setCurrentSubject(sub); setActiveTab('study'); setMobileMenuOpen(false); }}
                  className={`w-full flex items-center justify-between px-3.5 py-2 rounded-lg text-xs font-medium transition-all ${
                    currentSubject?.id === sub.id ? 'bg-slate-100 text-slate-900 font-semibold' : 'text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  <span className="truncate">{sub.name}</span>
                  <ChevronRight className="h-3 w-3 shrink-0" />
                </button>
              ))}
            </div>
          </div>
        </nav>

        {/* LOGGED IN USER PROFILE */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50">
          <div 
            onClick={() => { setActiveTab('profile'); setMobileMenuOpen(false); }}
            className="flex items-center gap-3 mb-3 hover:bg-slate-100/70 p-1.5 -mx-1.5 rounded-xl transition-colors cursor-pointer"
            title="Profile Settings"
          >
            {userProfile?.avatar_url ? (
              <img 
                src={userProfile.avatar_url} 
                className="h-8 w-8 object-cover rounded-full border border-violet-200 shrink-0" 
                alt="Profile" 
              />
            ) : (
              <div className="p-2 bg-slate-200 text-slate-600 rounded-full shrink-0">
                <User className="h-4 w-4" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-medium text-slate-500">Logged in as</p>
                <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${
                  userRole === 'teacher' ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-700'
                }`}>
                  {userRole === 'teacher' ? 'Teacher' : 'Student'}
                </span>
              </div>
              <p className="text-xs text-slate-700 truncate font-semibold mt-0.5">{session.user.email}</p>
              {userProfile?.institution && (
                <p className="text-[10px] text-slate-500 truncate font-medium mt-0.5">{userProfile.institution}</p>
              )}
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold shadow-sm transition-colors cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
            Logout
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT WORKSPACE */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto max-w-6xl mx-auto w-full">
        
        {/* IF CURRENTLY TAKING A PRACTICE SESSION (FULLSCREEN MODAL OVERLAY INSTEAD OF TABS) */}
        {isPracticing && quizQuestions.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl p-6 md:p-8 mb-8 animate-slideUp">
            {/* Header */}
            <div className="flex justify-between items-center pb-4 border-b border-slate-100 mb-6">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 border border-indigo-100 px-3 py-1 rounded-lg">
                  {activeTest ? 'Test Assessment' : isMaterialAssessment ? 'Material Assessment' : 'Concept Practice'}
                </span>
                <h2 className="text-xl font-black text-slate-900 mt-1">
                  {activeTest ? activeTest.title : isMaterialAssessment ? `${currentSubject?.name || 'Subject'} Full Assessment` : currentConcept?.name}
                </h2>
              </div>
              <button 
                onClick={() => { if (confirm(activeTest ? 'Abort test? Progress will not be saved.' : 'Abort session? Current score will not be saved.')) setIsPracticing(false); }}
                className="text-slate-400 hover:text-slate-700 text-xs font-semibold cursor-pointer px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
              >
                Quit Session
              </button>
            </div>

            {/* Progress indicator */}
            <div className="mb-6">
              <div className="flex justify-between text-xs text-slate-500 mb-1 font-semibold">
                <span>Question {activeQuestionIdx + 1} of {quizQuestions.length}</span>
                <span>Difficulty {quizQuestions[activeQuestionIdx].difficulty} / 5</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${((activeQuestionIdx + 1) / quizQuestions.length) * 100}%` }}
                ></div>
              </div>
            </div>

            {/* Question Type Header & Meta */}
            <div className="flex items-center gap-2 mb-3">
              {quizQuestions[activeQuestionIdx].sub_type === 'objective' || quizQuestions[activeQuestionIdx].question_type === 'mcq' ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                  <CheckCircle className="h-3.5 w-3.5" /> Objective (Multiple Choice)
                </span>
              ) : quizQuestions[activeQuestionIdx].sub_type === 'body' ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">
                  <FileText className="h-3.5 w-3.5" /> Body (In-Depth / Essay Question)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  <Brain className="h-3.5 w-3.5" /> Theory (Conceptual Question)
                </span>
              )}
              {quizQuestions[activeQuestionIdx].concept_name && (
                <span className="text-xs text-slate-500 font-medium">
                  • Concept: {quizQuestions[activeQuestionIdx].concept_name}
                </span>
              )}
            </div>

            {/* Question Box */}
            <div className="bg-slate-50 rounded-xl p-5 border border-slate-200 mb-6">
              <p className="text-lg font-bold text-slate-900 leading-relaxed">
                {quizQuestions[activeQuestionIdx].prompt}
              </p>
            </div>

            {/* Answer Input depending on question type */}
            <div className="space-y-4">
              {(quizQuestions[activeQuestionIdx].sub_type === 'objective' || quizQuestions[activeQuestionIdx].question_type === 'mcq') && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {quizQuestions[activeQuestionIdx].options?.map((option, idx) => (
                    <button
                      key={idx}
                      disabled={!!quizFeedback}
                      onClick={() => setStudentAnswer(option)}
                      className={`text-left p-4 rounded-xl text-sm font-semibold transition-all border shadow-sm cursor-pointer hover:-translate-y-0.5 ${
                        studentAnswer === option 
                          ? 'border-indigo-600 bg-indigo-50/80 text-indigo-950 ring-2 ring-indigo-500/20' 
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                          studentAnswer === option ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {String.fromCharCode(65 + idx)}
                        </span>
                        <span>{option}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {quizQuestions[activeQuestionIdx].question_type === 'short_answer' && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      {quizQuestions[activeQuestionIdx].sub_type === 'body' ? 'Your In-Depth Explanation / Essay Answer:' : 'Your Conceptual Answer:'}
                    </span>
                    <span className="text-xs text-indigo-600 font-semibold">
                      Answer in your own words (understanding is graded, not verbatim text)
                    </span>
                  </div>
                  <textarea
                    rows={quizQuestions[activeQuestionIdx].sub_type === 'body' ? 7 : 4}
                    disabled={!!quizFeedback}
                    placeholder={
                      quizQuestions[activeQuestionIdx].sub_type === 'body'
                        ? "Provide a structured, comprehensive explanation in your own words based on what you learned from the material..."
                        : "Explain the key idea in your own words (exact copy-pasting is not required)..."
                    }
                    value={studentAnswer}
                    onChange={(e) => setStudentAnswer(e.target.value)}
                    className="w-full p-4 border border-slate-300 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm font-medium leading-relaxed"
                  />
                  <div className="flex justify-between items-center text-xs text-slate-400 mt-1">
                    <span>{studentAnswer.trim().split(/\s+/).filter(Boolean).length} words</span>
                    <span>{studentAnswer.length} characters</span>
                  </div>
                </div>
              )}

              {quizQuestions[activeQuestionIdx].question_type === 'flashcard' && (
                <div className="flex flex-col items-center">
                  {!flashcardRevealed ? (
                    <button
                      onClick={() => setFlashcardRevealed(true)}
                      className="w-full max-w-md py-12 px-6 bg-white hover:bg-slate-50 border border-slate-200 rounded-2xl shadow-md text-center cursor-pointer font-bold text-indigo-700 text-xl flex items-center justify-center gap-2 hover:-translate-y-0.5 transition-all"
                    >
                      <RotateCcw className="h-5 w-5 animate-spin-slow" />
                      Click to Reveal Back
                    </button>
                  ) : (
                    <div className="w-full max-w-md bg-indigo-50/60 border border-indigo-200 rounded-2xl p-6 shadow-md text-center animate-slideUp">
                      <p className="text-xs font-semibold uppercase text-indigo-700 mb-2">Back of Card / Explanation</p>
                      <p className="text-slate-800 font-semibold mb-6">{quizQuestions[activeQuestionIdx].correct_answer}</p>
                      
                      {!quizFeedback && (
                        <div className="flex gap-4 justify-center">
                          <button
                            onClick={() => handleFlashcardGrade(false)}
                            className="px-4 py-2 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 rounded-xl text-sm font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-sm"
                          >
                            <XCircle className="h-4 w-4" /> I missed it
                          </button>
                          <button
                            onClick={() => handleFlashcardGrade(true)}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-sm"
                          >
                            <CheckCircle2 className="h-4 w-4" /> I recalled correctly
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Submit Buttons */}
              {!quizFeedback && quizQuestions[activeQuestionIdx].question_type !== 'flashcard' && (
                <div className="flex justify-end pt-2">
                  <button
                    onClick={handleAnswerSubmit}
                    disabled={isSubmittingAnswer || !studentAnswer.trim()}
                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl shadow-sm transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer hover:-translate-y-0.5 active:scale-95"
                  >
                    {isSubmittingAnswer ? 'Evaluating Conceptual Understanding...' : 'Submit Answer'}
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}

              {/* Feedback Block with Conceptual Grading */}
              {quizFeedback && (
                <div className="mt-6 border border-slate-200 rounded-2xl p-6 shadow-sm bg-white animate-slideUp">
                  <div className="flex items-start gap-3.5">
                    {quizFeedback.is_correct ? (
                      <CheckCircle2 className="h-7 w-7 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="h-7 w-7 text-rose-600 shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-base font-bold text-slate-900">
                          {quizFeedback.is_correct ? 'Correct! Strong Understanding' : 'Needs Review'}
                        </h4>
                        {quizFeedback.score_percentage !== undefined && (
                          <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${
                            quizFeedback.score_percentage >= 70 
                              ? 'text-emerald-700 bg-emerald-50 border-emerald-200' 
                              : quizFeedback.score_percentage >= 50
                              ? 'text-amber-700 bg-amber-50 border-amber-200'
                              : 'text-rose-700 bg-rose-50 border-rose-200'
                          }`}>
                            {quizFeedback.score_percentage}% Conceptual Score
                          </span>
                        )}
                        {masteryChange !== null && (
                          <span className={`text-xs px-2 py-0.5 rounded font-bold ${masteryChange >= 0 ? 'text-emerald-700 bg-emerald-50' : 'text-rose-700 bg-rose-50'}`}>
                            {masteryChange >= 0 ? `+${masteryChange}` : `${masteryChange}`} Mastery
                          </span>
                        )}
                      </div>
                      
                      {/* Socratic / Understanding Feedback */}
                      <p className="mt-2.5 text-sm text-slate-700 leading-relaxed font-medium">
                        {quizFeedback.feedback}
                      </p>

                      {/* Strengths */}
                      {quizFeedback.strengths && (
                        <div className="mt-3 p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-xl text-xs text-emerald-900">
                          <span className="font-bold block text-[10px] uppercase text-emerald-700 mb-0.5">What you grasped well:</span>
                          <span>{quizFeedback.strengths}</span>
                        </div>
                      )}

                      {/* Missing Points */}
                      {quizFeedback.missing_points && (
                        <div className="mt-2.5 p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl text-xs text-amber-900">
                          <span className="font-bold block text-[10px] uppercase text-amber-700 mb-0.5">Nuances or concepts to refine:</span>
                          <span>{quizFeedback.missing_points}</span>
                        </div>
                      )}

                      {/* Material Benchmark Reference */}
                      {quizQuestions[activeQuestionIdx].question_type === 'short_answer' && (
                        <div className="mt-3 bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs">
                          <span className="font-bold text-slate-500 block mb-1">Source Material Benchmark:</span>
                          <span className="text-slate-800 font-medium leading-relaxed block">{quizQuestions[activeQuestionIdx].correct_answer}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-end pt-4 border-t border-slate-100 mt-5">
                    <button
                      onClick={handleNextQuizQuestion}
                      className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer hover:-translate-y-0.5 active:scale-95"
                    >
                      {activeQuestionIdx + 1 < quizQuestions.length ? 'Next Question' : 'Complete Session'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB: DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="space-y-8 animate-fadeIn">
            {userRole === 'teacher' ? (
              <>
                {/* Teacher Top Overview Cards */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/85 shadow-sm">
                  <div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight">Mystudy Teacher Dashboard</h1>
                    <p className="text-sm text-slate-500 mt-1">Select a subject, upload learning material, and track your student test results.</p>
                  </div>
                  <button
                    onClick={() => setIsAddSubjectModalOpen(true)}
                    className="inline-flex items-center gap-2 px-4.5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors cursor-pointer shrink-0"
                  >
                    <Plus className="h-4 w-4" /> Add New Subject
                  </button>
                </div>

                {/* Subject Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {subjects.map(sub => {
                    const metrics = getSubjectMasteryMetrics(sub.id)
                    return (
                      <div key={sub.id} className="bg-white rounded-2xl border border-slate-100 p-6 flex flex-col justify-between shadow-sm hover:shadow-md hover:scale-[1.02] hover:border-violet-100 transition-all duration-300">
                        <div>
                          <div className="flex justify-between items-start mb-4">
                            <div className="max-w-[70%]">
                              <h3 className="text-lg font-bold text-slate-800 truncate">{sub.name}</h3>
                              <p className="text-xs text-slate-400 mt-0.5">Created {new Date(sub.created_at).toLocaleDateString()}</p>
                            </div>

                            {/* Circular Progress Ring */}
                            <div className="relative flex items-center justify-center shrink-0">
                              <svg className="w-14 h-14">
                                <circle className="text-slate-100" strokeWidth="4" stroke="currentColor" fill="transparent" r="22" cx="28" cy="28"/>
                                <circle className="text-violet-600 transition-all duration-300" strokeWidth="4" strokeDasharray={138} strokeDashoffset={138 - (138 * metrics.avg) / 100} strokeLinecap="round" stroke="currentColor" fill="transparent" r="22" cx="28" cy="28" transform="rotate(-90 28 28)"/>
                              </svg>
                              <span className="absolute text-xs font-bold text-slate-800">{metrics.avg}%</span>
                            </div>
                          </div>

                          {/* Weakest Concept */}
                          {metrics.weakest ? (
                            <div className="mb-6 p-3.5 bg-rose-50/70 border border-rose-100 rounded-xl backdrop-blur-sm">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-500 block">Weakest Concept Flagged</span>
                              <span className="text-sm font-bold text-slate-800 mt-1 block truncate">{metrics.weakest}</span>
                              <span className="text-xs text-slate-500 mt-0.5 block">Mastery score is currently at {metrics.weakestScore}%</span>
                            </div>
                          ) : (
                            <div className="mb-6 p-3.5 bg-slate-50/80 border border-slate-100 rounded-xl text-center">
                              <span className="text-xs text-slate-500 font-medium">No concepts extracted yet. Upload study material to begin.</span>
                            </div>
                          )}
                        </div>

                        <div className="flex gap-3 mt-4 pt-4 border-t border-slate-100">
                          <button
                            onClick={() => {
                              setCurrentSubject(sub)
                              setActiveTab('study')
                            }}
                            className="flex-1 py-2 px-3 bg-indigo-600 hover:bg-indigo-700 hover:scale-[1.02] active:scale-[0.98] text-white rounded-xl text-xs font-bold shadow-sm text-center cursor-pointer transition-all duration-200"
                          >
                            Study Materials
                          </button>
                          <button
                            onClick={() => {
                              setCurrentSubject(sub)
                              setActiveTab('progress')
                            }}
                            className="flex-1 py-2 px-3 bg-white hover:bg-slate-50 border border-slate-200 hover:scale-[1.02] active:scale-[0.98] text-slate-700 rounded-xl text-xs font-bold text-center cursor-pointer transition-all duration-200"
                          >
                            View Progress
                          </button>
                        </div>
                      </div>
                    )
                  })}

                  {subjects.length === 0 && (
                    <div className="col-span-full bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-sm">
                      <BookOpen className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                      <h3 className="text-lg font-bold text-slate-800">Create your first subject</h3>
                      <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">To start, create a study subject (like "Ethics 101" or "Sales Manual").</p>
                      
                      <form onSubmit={handleCreateSubject} className="mt-6 max-w-md mx-auto flex gap-2">
                        <input
                          type="text"
                          required
                          placeholder="e.g. Computer Science Basics"
                          value={newSubjectName}
                          onChange={(e) => setNewSubjectName(e.target.value)}
                          className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm shadow-sm focus:ring-1 focus:ring-violet-500 focus:border-violet-500"
                        />
                        <button
                          type="submit"
                          disabled={isCreatingSubject}
                          className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold rounded-lg shadow-md disabled:opacity-50 cursor-pointer"
                        >
                          {isCreatingSubject ? 'Creating...' : 'Create'}
                        </button>
                      </form>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                {/* Student Top Dashboard Overview */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/85 shadow-sm">
                  <div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight">Mystudy Assessment Center</h1>
                    <p className="text-sm text-slate-500 mt-1">Join tests, practice study materials, and build your conceptual mastery scores.</p>
                  </div>
                </div>

                {/* Join Test form */}
                <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm">
                  <h2 className="text-xl font-bold text-slate-800 mb-2">Join a Training Session / Test</h2>
                  <p className="text-xs text-slate-500 mb-4">
                    Enter the 6-character invitation code provided by your instructor or manager.
                  </p>
                  <form 
                    onSubmit={async (e) => {
                      e.preventDefault()
                      if (!joinTestCode.trim()) return
                      setIsJoiningTest(true)
                      try {
                        const test = await dbJoinTestByCode(session.user.id, joinTestCode.trim().toUpperCase())
                        alert(`Successfully enrolled in "${test.title}"!`)
                        setJoinTestCode('')
                        loadUserData()
                      } catch (err: any) {
                        alert('Could not join test: ' + err.message)
                      } finally {
                        setIsJoiningTest(false)
                      }
                    }}
                    className="flex flex-col sm:flex-row gap-3"
                  >
                    <input
                      type="text"
                      required
                      placeholder="Enter Code (e.g. ETHICS)"
                      value={joinTestCode}
                      onChange={(e) => setJoinTestCode(e.target.value.toUpperCase())}
                      className="flex-1 px-4 py-2.5 border border-slate-300 rounded-xl text-sm font-bold tracking-widest placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 bg-white"
                    />
                    <button
                      type="submit"
                      disabled={isJoiningTest}
                      className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-sm cursor-pointer disabled:opacity-50 transition-colors shrink-0"
                    >
                      {isJoiningTest ? 'Joining...' : 'Join Assessment'}
                    </button>
                  </form>
                </div>

                {/* Active & Completed Tests */}
                <div className="space-y-4">
                  <h3 className="text-base font-bold text-slate-800">Your Assessments & Tests</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {enrolledTests.map(enroll => {
                      const matchedTest = tests.find(t => t.id === enroll.test_id)
                      if (!matchedTest) return null
                      return (
                        <div key={enroll.id} className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col justify-between shadow-sm">
                          <div>
                            <div className="flex justify-between items-start mb-4">
                              <div className="max-w-[70%]">
                                <h4 className="text-base font-bold text-slate-800 truncate">{matchedTest.title}</h4>
                                <p className="text-xs text-slate-400 mt-0.5">Subject: {matchedTest.subject_name}</p>
                                <div className="flex items-center gap-1.5 mt-2">
                                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                                    matchedTest.question_type === 'objective' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                    matchedTest.question_type === 'theory' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                                    matchedTest.question_type === 'body' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                                    'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  }`}>
                                    {matchedTest.question_type === 'objective' ? 'Obj (MCQ)' :
                                     matchedTest.question_type === 'theory' ? 'Theory' :
                                     matchedTest.question_type === 'body' ? 'Essay' : 'Mix (All)'}
                                  </span>
                                  {matchedTest.disable_guidance && (
                                    <span className="text-[9px] font-bold uppercase tracking-wider text-rose-600 bg-rose-50 px-2 py-0.5 rounded">
                                      Strict Mode
                                    </span>
                                  )}
                                </div>
                              </div>
                              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                                enroll.completed ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                              }`}>
                                {enroll.completed ? 'Completed' : 'Active'}
                              </span>
                            </div>

                            {enroll.completed ? (
                              <div className="mb-4 bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex items-center justify-between">
                                <div>
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 block leading-tight">Your Score</span>
                                  <span className="text-2xl font-black text-emerald-800 mt-0.5 block">{enroll.score}%</span>
                                </div>
                                <span className="text-xs text-emerald-700 font-semibold">Submitted</span>
                              </div>
                            ) : (
                              <div className="mb-4 bg-slate-50 border border-slate-100 rounded-xl p-4 flex items-center justify-between">
                                <div>
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block leading-tight">Format & Count</span>
                                  <span className="text-lg font-extrabold text-slate-800 mt-0.5 block">{matchedTest.question_count} Questions</span>
                                </div>
                                <button
                                  onClick={async () => {
                                    try {
                                      const subjectConcepts = await dbFetchConcepts(matchedTest.subject_id)
                                      const allQuestions: Question[] = []
                                      for (const concept of subjectConcepts) {
                                        const conceptQuestions = await dbFetchQuestions(concept.id)
                                        allQuestions.push(...conceptQuestions)
                                      }

                                      const reqType = matchedTest.question_type || 'mixed'
                                      let candidateQuestions = allQuestions.filter(q => {
                                        if (reqType === 'objective') return q.question_type === 'mcq' || q.sub_type === 'objective'
                                        if (reqType === 'theory') return q.sub_type === 'theory' || (q.question_type === 'short_answer' && q.sub_type !== 'body')
                                        if (reqType === 'body') return q.sub_type === 'body'
                                        return true
                                      })

                                      // Auto-generate missing questions if fewer than question_count
                                      if (candidateQuestions.length < matchedTest.question_count && subjectConcepts.length > 0) {
                                        try {
                                          const mats = await dbFetchMaterials(matchedTest.subject_id)
                                          if (mats.length > 0 && mats[0].raw_text) {
                                            const needed = Math.max(matchedTest.question_count - candidateQuestions.length, 5)
                                            const extractedConcepts: ExtractedConcept[] = subjectConcepts.map(c => ({
                                              name: c.name,
                                              summary: c.summary,
                                              simple_explanation: c.simple_explanation
                                            }))
                                            const generated = await generateQuestionsFromMaterial(
                                              mats[0].title,
                                              mats[0].raw_text,
                                              needed,
                                              reqType,
                                              extractedConcepts
                                            )
                                            for (let i = 0; i < generated.length; i++) {
                                              const gq = generated[i]
                                              const targetConcept = subjectConcepts.find(c => c.name.toLowerCase() === gq.concept_name?.toLowerCase()) || subjectConcepts[i % subjectConcepts.length]
                                              const created = await dbCreateQuestions([gq], targetConcept.id)
                                              candidateQuestions.push(...created)
                                            }
                                          }
                                        } catch (genErr) {
                                          console.warn('Note: could not dynamically generate questions:', genErr)
                                        }
                                      }

                                      if (candidateQuestions.length === 0) {
                                        candidateQuestions = allQuestions
                                      }

                                      if (candidateQuestions.length === 0) {
                                        alert('This test subject does not have any questions generated yet.')
                                        return
                                      }

                                      const shuffled = [...candidateQuestions].sort(() => 0.5 - Math.random()).slice(0, matchedTest.question_count)
                                      setQuizQuestions(shuffled)
                                      setActiveQuestionIdx(0)
                                      setStudentAnswer('')
                                      setQuizFeedback(null)
                                      setTestCorrectCount(0)
                                      
                                      setActiveTest(matchedTest)
                                      setIsPracticing(true)
                                    } catch (err: any) {
                                      alert('Error starting test: ' + err.message)
                                    }
                                  }}
                                  className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-xs font-bold shadow-md cursor-pointer transition-colors"
                                >
                                  Start Test
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}

                    {enrolledTests.length === 0 && (
                      <div className="col-span-full bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-sm">
                        <Compass className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                        <h3 className="text-lg font-bold text-slate-800">No assessments enrolled yet</h3>
                        <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
                          Enter an invitation code above to join a test created by your instructor or manager.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
                {/* Self-study subjects */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-base font-bold text-slate-800">Your Study Subjects</h3>
                    <button
                      onClick={() => setIsAddSubjectModalOpen(true)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer"
                    >
                      <Plus className="h-3 w-3" /> Add Subject
                    </button>
                  </div>

                  {subjects.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {subjects.map(sub => {
                        const metrics = getSubjectMasteryMetrics(sub.id)
                        return (
                          <div key={sub.id} className="bg-white rounded-2xl border border-slate-100 p-6 flex flex-col justify-between shadow-sm hover:shadow-md hover:scale-[1.02] hover:border-violet-100 transition-all duration-300">
                            <div>
                              <div className="flex justify-between items-start mb-4">
                                <div className="max-w-[70%]">
                                  <h3 className="text-lg font-bold text-slate-800 truncate">{sub.name}</h3>
                                  <p className="text-xs text-slate-400 mt-0.5">Created {new Date(sub.created_at).toLocaleDateString()}</p>
                                </div>
        
                                <div className="relative flex items-center justify-center shrink-0">
                                  <svg className="w-14 h-14">
                                    <circle className="text-slate-100" strokeWidth="4" stroke="currentColor" fill="transparent" r="22" cx="28" cy="28"/>
                                    <circle className="text-violet-600 transition-all duration-300" strokeWidth="4" strokeDasharray={138} strokeDashoffset={138 - (138 * metrics.avg) / 100} strokeLinecap="round" stroke="currentColor" fill="transparent" r="22" cx="28" cy="28" transform="rotate(-90 28 28)"/>
                                  </svg>
                                  <span className="absolute text-xs font-bold text-slate-800">{metrics.avg}%</span>
                                </div>
                              </div>
                            </div>
        
                            <div className="flex gap-3 mt-4 pt-4 border-t border-slate-100">
                              <button
                                onClick={() => {
                                  setCurrentSubject(sub)
                                  setActiveTab('study')
                                }}
                                className="flex-1 py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold text-center cursor-pointer transition-all"
                              >
                                Study Materials
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="bg-white border border-slate-200 border-dashed rounded-2xl p-8 text-center text-slate-500 text-sm">
                      <BookOpen className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                      <p>You haven't created any study subjects yet.</p>
                      <p className="text-xs text-slate-400 mt-1">Click the "Add Subject" button above to start self-learning.</p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* TAB: STUDY MATERIAL */}
        {activeTab === 'study' && (
          <div className="space-y-8 animate-fadeIn">
            {/* Subject Selector Header */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-violet-600 uppercase tracking-widest block">Study View</span>
                <div className="flex items-center gap-2 mt-1">
                  <h1 className="text-xl md:text-2xl font-black text-slate-900">{currentSubject?.name || 'No Subject Selected'}</h1>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={currentSubject?.id || ''}
                  onChange={(e) => {
                    const match = subjects.find(s => s.id === e.target.value)
                    if (match) setCurrentSubject(match)
                  }}
                  className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold shadow-sm focus:ring-violet-500 focus:border-violet-500 text-slate-700"
                >
                  {subjects.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                <button
                  onClick={() => setIsAddingMaterial(!isAddingMaterial)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-100 text-xs font-bold rounded-xl cursor-pointer transition-colors shadow-sm"
                >
                  <Plus className="h-4 w-4" /> Add Material
                </button>
                {currentSubject && (
                  <button
                    onClick={() => handleDeleteSubject(currentSubject.id, currentSubject.name)}
                    className="p-2 border border-slate-200 hover:border-rose-300 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all cursor-pointer shadow-sm"
                    title={`Delete entire subject "${currentSubject.name}"`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {/* GUIDED-HELP GUARDRAIL BLOCKED VIEW */}
            {guardrailWarning && (
              <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 shadow-md animate-slideUp">
                <div className="flex items-start gap-4">
                  <AlertTriangle className="h-8 w-8 text-rose-600 shrink-0" />
                  <div className="flex-1">
                    <h3 className="text-lg font-black text-rose-900">Learning Guardrail Triggered</h3>
                    <p className="text-sm text-rose-700 mt-1">
                      Our system detected that the content you submitted resembles a homework assignment, essay prompt, or direct exam task designed for a completed answer. 
                      To support your education, <strong>Mystudy will never do the work for you.</strong>
                    </p>
                    
                    {/* Guiding Socratic help */}
                    <div className="mt-4 bg-white border border-rose-200 rounded-xl p-5 shadow-sm">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2">Socratic Guidance</span>
                      <p className="text-slate-700 text-sm font-semibold italic">"{guardrailWarning.guidance}"</p>
                    </div>

                    <div className="mt-4 flex gap-3">
                      <button 
                        onClick={() => {
                          setRawText(guardrailWarning.originalInput)
                          setGuardrailWarning(null)
                          setIsAddingMaterial(true)
                        }}
                        className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors cursor-pointer"
                      >
                        Revise Input
                      </button>
                      <button 
                        onClick={() => setGuardrailWarning(null)}
                        className="px-4 py-2 bg-white hover:bg-rose-100 text-rose-800 border border-rose-200 rounded-xl text-xs font-bold shadow-sm transition-colors cursor-pointer"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ADD MATERIAL PANEL */}
            {isAddingMaterial && (
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-md animate-slideUp">
                <h3 className="text-base font-bold text-slate-800 mb-4">Add Study Material / Concept Source</h3>
                
                {materialLoadingState ? (
                  <div className="py-8 text-center space-y-4">
                    <div className="w-10 h-10 border-4 border-violet-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                    <p className="text-sm font-bold text-slate-700 animate-pulse">{materialLoadingState}</p>
                  </div>
                ) : (
                  <form onSubmit={handleAddMaterial} className="space-y-5">
                    {/* Source type tabs */}
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Input Source Type</label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setSourceType('upload')}
                          className={`flex-1 py-2 px-3 border rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            sourceType === 'upload' ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-sm' : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                          }`}
                        >
                          Upload File (PDF, DOCX, PPTX, TXT, MD)
                        </button>
                        <button
                          type="button"
                          onClick={() => setSourceType('paste')}
                          className={`flex-1 py-2 px-3 border rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            sourceType === 'paste' ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-sm' : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                          }`}
                        >
                          Paste Notes/Text
                        </button>
                        <button
                          type="button"
                          onClick={() => setSourceType('topic_only')}
                          className={`flex-1 py-2 px-3 border rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            sourceType === 'topic_only' ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-sm' : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                          }`}
                        >
                          Topic Only (No materials)
                        </button>
                      </div>
                    </div>

                    {/* UPLOAD FILE TAB WITH INTERACTIVE CLICKABLE GRID BOX */}
                    {sourceType === 'upload' && (
                      <div className="space-y-3">
                        <input
                          type="file"
                          ref={fileInputRef}
                          id="file-upload-input"
                          accept=".txt,.md,.json,.pdf,.docx,.pptx,.doc"
                          onChange={handleFileUpload}
                          className="hidden"
                        />

                        {/* Clickable Grid Box / Dropzone Tile */}
                        <div
                          onClick={() => fileInputRef.current?.click()}
                          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                          onDragLeave={() => setIsDragOver(false)}
                          onDrop={handleFileDrop}
                          className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all duration-200 group ${
                            isDragOver
                              ? 'border-indigo-600 bg-indigo-50/80 ring-4 ring-indigo-500/10'
                              : 'border-indigo-300 bg-indigo-50/20 hover:bg-indigo-50/50 hover:border-indigo-600'
                          }`}
                        >
                          <div className="w-14 h-14 mx-auto mb-3 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white group-hover:scale-105 transition-all shadow-sm">
                            <UploadCloud className="h-7 w-7" />
                          </div>

                          <h4 className="text-sm font-bold text-slate-800 group-hover:text-indigo-900 transition-colors">
                            Click here to add study material, or drag & drop file
                          </h4>
                          <p className="text-xs text-slate-500 mt-1">
                            Click anywhere inside this box to browse files from your device
                          </p>

                          <div className="mt-3.5 inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 group-hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all hover:scale-105">
                            <Plus className="h-4 w-4" /> Select File from Device
                          </div>

                          {/* Format tags grid */}
                          <div className="mt-4 flex items-center justify-center gap-1.5 flex-wrap">
                            {['PDF', 'Word (.docx)', 'PowerPoint (.pptx)', 'Text (.txt)', 'Markdown (.md)'].map(format => (
                              <span key={format} className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-white border border-slate-200 text-slate-600 shadow-2xs">
                                {format}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Selected file confirmation & preview */}
                        {uploadedFileName && (
                          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2 animate-fadeIn">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2.5">
                                <FileCheck className="h-5 w-5 text-emerald-600 shrink-0" />
                                <div>
                                  <span className="text-xs font-bold text-slate-800 block truncate max-w-xs">{uploadedFileName}</span>
                                  <span className="text-[10px] text-slate-400 font-medium">{uploadedFileSize} • Parsed & ready</span>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="text-xs text-indigo-600 font-bold hover:underline cursor-pointer"
                              >
                                Replace File
                              </button>
                            </div>

                            <div>
                              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Material Title</label>
                              <input
                                type="text"
                                required
                                placeholder="Material Title"
                                value={materialTitle}
                                onChange={(e) => setMaterialTitle(e.target.value)}
                                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold shadow-sm focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                              />
                            </div>

                            {rawText && (
                              <div className="mt-2 bg-white p-3 rounded-lg border border-slate-200 text-left max-h-36 overflow-y-auto">
                                <span className="text-[10px] font-bold text-slate-400 block mb-1">
                                  Extracted Content Preview ({rawText.length} characters):
                                </span>
                                <span className="text-xs font-medium text-slate-700 block whitespace-pre-wrap leading-relaxed">
                                  {rawText.slice(0, 400)}...
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* PASTE NOTES TAB */}
                    {sourceType === 'paste' && (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Material Title</label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. Chapter 4: Photosynthesis Notes"
                            value={materialTitle}
                            onChange={(e) => setMaterialTitle(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm shadow-sm focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Paste Learning Text Content</label>
                          <textarea
                            rows={6}
                            required
                            placeholder="Paste chapters, lecture notes, definitions, or general text..."
                            value={rawText}
                            onChange={(e) => setRawText(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm shadow-sm focus:ring-indigo-500 focus:border-indigo-500 font-medium bg-white"
                          />
                        </div>
                      </div>
                    )}

                    {/* TOPIC ONLY TAB */}
                    {sourceType === 'topic_only' && (
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Topic Name</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Mitosis, Capitalism vs Socialism, Linear Algebra"
                          value={topicOnlyName}
                          onChange={(e) => setTopicOnlyName(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm shadow-sm focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                        />
                      </div>
                    )}

                    {/* ASSESSMENT & QUESTION GENERATION SETTINGS */}
                    <div className="pt-4 border-t border-slate-200 space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                            <Sliders className="h-4 w-4 text-indigo-600" />
                            Question Setting & Assessment Configuration
                          </h4>
                          <p className="text-xs text-slate-500 mt-0.5">Control how many and what format of questions the AI sets from this material.</p>
                        </div>
                      </div>

                      {/* Question Count Selector */}
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1.5">How many questions do you want from this material?</label>
                        <div className="flex items-center gap-2 flex-wrap">
                          {[5, 10, 15, 20].map(count => (
                            <button
                              key={count}
                              type="button"
                              onClick={() => setMaterialQuestionCount(count)}
                              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                                materialQuestionCount === count
                                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                              }`}
                            >
                              {count} Questions
                            </button>
                          ))}
                          <div className="flex items-center gap-1.5 pl-2">
                            <span className="text-xs text-slate-400 font-medium">Custom:</span>
                            <input
                              type="number"
                              min={1}
                              max={30}
                              value={materialQuestionCount}
                              onChange={(e) => setMaterialQuestionCount(Math.max(1, Math.min(30, parseInt(e.target.value) || 1)))}
                              className="w-16 px-2.5 py-1 text-xs font-bold border border-slate-300 rounded-lg text-center focus:ring-1 focus:ring-indigo-500 bg-white"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Question Format / Type Selector */}
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1.5">What type of questions do you want?</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                          {[
                            {
                              id: 'objective',
                              title: 'Objective (MCQ)',
                              desc: 'Multiple choice with 4 options tested against facts in the material.',
                              icon: CheckCircle2
                            },
                            {
                              id: 'theory',
                              title: 'Theory',
                              desc: 'Conceptual short-answer questions testing principles and understanding.',
                              icon: Brain
                            },
                            {
                              id: 'body',
                              title: 'Body / Essay',
                              desc: 'Structured, in-depth analytical questions testing comprehensive mastery.',
                              icon: FileText
                            },
                            {
                              id: 'mixed',
                              title: 'Mixed / Both',
                              desc: 'Balanced combination of Objective MCQs + Theory & Body questions.',
                              icon: Sparkles
                            }
                          ].map(t => {
                            const IconComp = t.icon
                            const isSelected = materialQuestionType === t.id
                            return (
                              <button
                                key={t.id}
                                type="button"
                                onClick={() => setMaterialQuestionType(t.id as QuestionSettingType)}
                                className={`text-left p-3 rounded-xl border text-xs transition-all cursor-pointer flex flex-col justify-between ${
                                  isSelected
                                    ? 'border-indigo-600 bg-indigo-50/70 ring-2 ring-indigo-500/20'
                                    : 'border-slate-200 bg-white hover:bg-slate-50'
                                }`}
                              >
                                <div className="flex items-center gap-2 mb-1">
                                  <div className={`p-1.5 rounded-lg ${isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                                    <IconComp className="h-3.5 w-3.5" />
                                  </div>
                                  <span className={`font-bold ${isSelected ? 'text-indigo-950' : 'text-slate-800'}`}>{t.title}</span>
                                </div>
                                <p className="text-[11px] text-slate-500 leading-tight">{t.desc}</p>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setIsAddingMaterial(false)}
                        className="px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-sm"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm cursor-pointer transition-all hover:-translate-y-0.5"
                      >
                        Extract Concepts & Generate Questions
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {/* CONCEPTS STUDY CORE VIEW */}
            {currentSubject && concepts.length > 0 && (
              <div className="space-y-6">
                {/* Full Material Assessment Action Banner */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0 shadow-2xs">
                      <Award className="h-6 w-6" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">Full Material Assessment Ready</h4>
                      <p className="text-xs text-slate-500 mt-0.5">Test yourself across all questions generated from your study materials for "{currentSubject.name}".</p>
                    </div>
                  </div>
                  <button
                    onClick={() => startMaterialAssessment(currentSubject)}
                    className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm cursor-pointer transition-all hover:-translate-y-0.5 active:scale-95 flex items-center justify-center gap-2 shrink-0"
                  >
                    <Award className="h-4 w-4" /> Start Full Assessment
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                  {/* Concepts list panel */}
                  <div className="lg:col-span-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Concepts Extracted ({concepts.length})</h3>
                      <span className="text-[10px] text-slate-400">Click to study</span>
                    </div>

                    <div className="space-y-2">
                      {concepts.map(con => {
                        const m = masteries.find(ma => ma.concept_id === con.id)
                        const decayedScore = m ? getDecayedMastery(m.score, m.last_updated) : 50
                        const isSelected = currentConcept?.id === con.id
                        return (
                          <div
                            key={con.id}
                            onClick={() => {
                              setCurrentConcept(con)
                              setExplainSimpler(false)
                            }}
                            className={`group w-full text-left p-4 rounded-xl border shadow-sm transition-all flex flex-col justify-between cursor-pointer hover:-translate-y-0.5 ${
                              isSelected
                                ? 'border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-500/20'
                                : 'border-slate-200 bg-white hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <span className="font-bold text-slate-900 truncate block text-sm">{con.name}</span>
                              <button
                                onClick={(e) => handleDeleteConcept(con.id, con.name, e)}
                                className="opacity-70 group-hover:opacity-100 text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-1.5 rounded-lg transition-all cursor-pointer shrink-0"
                                title="Delete concept"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                            
                            <div className="flex items-center gap-2 mt-3 w-full">
                              <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                <div 
                                  className={`h-1.5 rounded-full ${
                                    decayedScore >= 70 ? 'bg-emerald-500' : decayedScore >= 40 ? 'bg-amber-500' : 'bg-rose-500'
                                  }`}
                                  style={{ width: `${decayedScore}%` }}
                                ></div>
                              </div>
                              <span className="text-[10px] font-bold text-slate-500 shrink-0">{decayedScore}%</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Concept Study details card */}
                  {currentConcept && (
                    <div className="lg:col-span-8 space-y-6">
                      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between min-h-[300px]">
                        <div>
                          {/* Tab header */}
                          <div className="flex justify-between items-center pb-4 border-b border-slate-100 mb-6">
                            <h3 className="text-xl font-bold text-slate-900">{currentConcept.name}</h3>
                            
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-500">Explain Simpler:</span>
                              <button
                                onClick={() => setExplainSimpler(!explainSimpler)}
                                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                  explainSimpler ? 'bg-indigo-600' : 'bg-slate-200'
                                }`}
                              >
                                <span
                                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                    explainSimpler ? 'translate-x-5' : 'translate-x-0'
                                  }`}
                                />
                              </button>
                            </div>
                          </div>

                          {/* Explanation Content */}
                          <div className="space-y-6 font-medium text-slate-700 leading-relaxed text-sm">
                            {!explainSimpler ? (
                              <div className="space-y-4">
                                <p className="font-bold text-xs uppercase text-slate-400 tracking-wider">Concept Summary</p>
                                <p>{currentConcept.summary}</p>
                              </div>
                            ) : (
                              <div className="space-y-4 animate-fadeIn">
                                <div className="p-3 bg-indigo-50/70 rounded-xl border border-indigo-100 flex items-start gap-2 text-indigo-900 text-xs">
                                  <Lightbulb className="h-4 w-4 shrink-0 mt-0.5 text-indigo-600" />
                                  <span>Using simpler explanation mode with analogy to aid understanding.</span>
                                </div>
                                
                                <p className="font-bold text-xs uppercase text-slate-400 tracking-wider">Analogy & Simplified Version</p>
                                <p>{currentConcept.simple_explanation}</p>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Launch practice session or delete */}
                        <div className="mt-8 pt-4 border-t border-slate-100 flex items-center justify-between gap-4">
                          <button
                            onClick={() => handleDeleteConcept(currentConcept.id, currentConcept.name)}
                            className="px-4 py-2 border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-bold rounded-xl cursor-pointer transition-all flex items-center gap-1.5"
                            title="Delete this concept and all its questions"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>Delete Concept</span>
                          </button>
                          <button
                            onClick={() => startPractice(currentConcept)}
                            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm cursor-pointer transition-all hover:-translate-y-0.5 flex items-center gap-2"
                          >
                            <Brain className="h-4 w-4" /> Practice this Concept
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {currentSubject && concepts.length === 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
                <BookOpen className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-slate-800">No study materials in "{currentSubject.name}"</h3>
                <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">Upload learning notes or paste your study material above to extract concepts and set practice questions.</p>
                <button
                  onClick={() => setIsAddingMaterial(true)}
                  className="mt-6 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors cursor-pointer hover:-translate-y-0.5"
                >
                  Add Learning Material Now
                </button>
              </div>
            )}
          </div>
        )}

        {/* TAB: PROGRESS DASHBOARD */}
        {activeTab === 'progress' && (
          <div className="space-y-8 animate-fadeIn">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Active Mastery Progress</h1>

            {/* Grid for mastery scores */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* Weakest concepts warnings */}
              <div className="lg:col-span-1 space-y-6">
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                  <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-rose-500" /> Key Weak Areas
                  </h3>
                  
                  <div className="space-y-3">
                    {masteries
                      .map(m => ({ ...m, decayedScore: getDecayedMastery(m.score, m.last_updated) }))
                      .filter(m => m.decayedScore < 40)
                      .map(m => (
                        <div key={m.id} className="p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-center justify-between">
                          <div className="truncate max-w-[70%]">
                            <span className="text-sm font-bold text-slate-800 truncate block">{m.concept_name}</span>
                            <span className="text-[10px] text-slate-400 block">Current score: {m.decayedScore}%</span>
                          </div>
                          <span className="text-xs font-black text-rose-600 bg-white px-2.5 py-1 rounded-lg border border-rose-200 shrink-0">
                            Critical
                          </span>
                        </div>
                      ))}

                    {masteries.filter(m => getDecayedMastery(m.score, m.last_updated) < 40).length === 0 && (
                      <div className="text-center py-6 text-slate-500 text-xs font-medium">
                        Excellent! No concepts are flagged under 40% mastery. Keep reviewing to avoid decay.
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                  <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-emerald-500" /> Mastery Ranges
                  </h3>
                  <div className="space-y-3.5 text-xs font-semibold">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full"></span> Mastered (70-100)
                      </span>
                      <span className="text-slate-800">{masteries.filter(m => getDecayedMastery(m.score, m.last_updated) >= 70).length} concepts</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 bg-amber-500 rounded-full"></span> Developing (40-69)
                      </span>
                      <span className="text-slate-800">{masteries.filter(m => {
                        const ds = getDecayedMastery(m.score, m.last_updated)
                        return ds >= 40 && ds < 70
                      }).length} concepts</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 bg-rose-500 rounded-full"></span> Unmastered (0-39)
                      </span>
                      <span className="text-slate-800">{masteries.filter(m => getDecayedMastery(m.score, m.last_updated) < 40).length} concepts</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Progress bars list */}
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                  <h3 className="text-base font-bold text-slate-800 mb-6">Concept Mastery Tracker</h3>

                  <div className="space-y-6">
                    {masteries.map(m => {
                      const ds = getDecayedMastery(m.score, m.last_updated)
                      const isDecayed = ds < m.score
                      return (
                        <div key={m.id} className="space-y-1.5">
                          <div className="flex justify-between text-xs font-bold text-slate-700">
                            <span className="truncate">{m.concept_name}</span>
                            <div className="flex items-center gap-2">
                              {isDecayed && (
                                <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded font-medium flex items-center gap-0.5">
                                  <Clock className="h-2.5 w-2.5" /> Decayed (Forgetting)
                                </span>
                              )}
                              <span>{ds} / 100</span>
                            </div>
                          </div>

                          <div className="w-full bg-slate-100 rounded-full h-3.5 overflow-hidden border border-slate-100 flex">
                            <div 
                              className={`h-3.5 rounded-full transition-all duration-300 ${
                                ds >= 70 ? 'bg-emerald-500' : ds >= 40 ? 'bg-amber-500' : 'bg-rose-500'
                              }`}
                              style={{ width: `${ds}%` }}
                            ></div>
                          </div>
                        </div>
                      )
                    })}

                    {masteries.length === 0 && (
                      <div className="text-center py-12 text-slate-400 text-sm">
                        No concepts tracked yet. Fill subjects with materials and attempt questions to see mastery ratings!
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Attempt History List */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <h3 className="text-base font-bold text-slate-800 mb-6">Recent Practice History</h3>
              <div className="space-y-4">
                {attempts.map(att => (
                  <div key={att.id} className="p-4 border border-slate-100 rounded-xl hover:bg-slate-50/50 transition-colors flex flex-col md:flex-row md:items-start gap-4">
                    <div className="shrink-0">
                      {att.is_correct ? (
                        <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                      ) : (
                        <XCircle className="h-6 w-6 text-rose-600" />
                      )}
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-400 uppercase">{att.concept_name}</span>
                        <span className="text-xs text-slate-400">{new Date(att.answered_at).toLocaleDateString()} {new Date(att.answered_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <p className="text-sm font-bold text-slate-800">{att.question_prompt}</p>
                      <div className="bg-white border border-slate-200/80 rounded-lg p-2.5 text-xs text-slate-700 font-medium">
                        <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block mb-1">Student Answer</span>
                        {att.student_answer}
                      </div>
                      <div className="text-xs text-slate-500 pt-1">
                        <strong className="text-slate-700">Socratic feedback:</strong> {att.ai_feedback}
                      </div>
                    </div>
                  </div>
                ))}

                {attempts.length === 0 && (
                  <div className="text-center py-8 text-slate-400 text-sm">
                    No learning attempts logged yet. Try practicing to track your results!
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB: STUDY PLAN */}
        {activeTab === 'studyplan' && (
          <div className="space-y-8 animate-fadeIn">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">Adaptive Study Plan</h1>
                <p className="text-sm text-slate-500 mt-1">Generate a structured list of tasks and minutes based on your actual weaknesses.</p>
              </div>

              {/* Set budget and generate */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-500 uppercase">Daily Budget:</span>
                  <input
                    type="number"
                    min={10}
                    max={180}
                    value={studyMinutesBudget}
                    onChange={(e) => setStudyMinutesBudget(Number(e.target.value))}
                    className="w-16 px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-center shadow-sm"
                  />
                  <span className="text-xs font-bold text-slate-500 uppercase">Minutes</span>
                </div>

                <button
                  onClick={handleGenerateStudyPlan}
                  disabled={isGeneratingPlan}
                  className="px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold rounded-xl shadow-md transition-colors disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                >
                  {isGeneratingPlan ? 'Generating Schedule...' : 'Regenerate Study Plan'}
                  <Sparkles className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Plan Display */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <h3 className="text-base font-bold text-slate-800 mb-6 flex items-center gap-2">
                <Calendar className="h-5 w-5 text-violet-600" /> Today's Recommended Schedule
              </h3>

              <div className="space-y-4">
                {studyPlanItems.map(item => (
                  <div 
                    key={item.id} 
                    className={`p-4 border rounded-xl flex items-start gap-4 transition-all ${
                      item.completed 
                        ? 'border-slate-200 bg-slate-50/50 opacity-60' 
                        : 'border-slate-200 bg-white hover:border-violet-200'
                    }`}
                  >
                    {/* Checkbox */}
                    <button
                      onClick={() => handleTogglePlanItem(item.id, !item.completed)}
                      className={`h-5 w-5 rounded-md border flex items-center justify-center shrink-0 mt-0.5 cursor-pointer transition-colors ${
                        item.completed 
                          ? 'border-violet-600 bg-violet-600 text-white' 
                          : 'border-slate-300 hover:border-violet-400 bg-white'
                      }`}
                    >
                      {item.completed && <Check className="h-3.5 w-3.5 stroke-[3px]" />}
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                        <span className={`font-bold text-sm ${item.completed ? 'text-slate-500 line-through' : 'text-slate-800'}`}>
                          {item.concept_name}
                        </span>
                        
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Priority {item.priority}</span>
                          <span className="text-xs bg-violet-50 text-violet-700 px-2 py-0.5 rounded font-bold flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {item.suggested_minutes} mins
                          </span>
                        </div>
                      </div>

                      {/* Motivation reason */}
                      {item.ai_reason && (
                        <p className="text-xs text-slate-500 mt-1 italic font-medium">
                          💡 {item.ai_reason}
                        </p>
                      )}

                      {!item.completed && (
                        <div className="mt-3.5 flex justify-end">
                          <button
                            onClick={() => {
                              // Find concept
                              const found = concepts.find(c => c.id === item.concept_id)
                              if (found) {
                                setCurrentConcept(found)
                                setActiveTab('study')
                              } else {
                                // Fallback search in masteries or fetch
                                alert('Please navigate to the study tab and pick this concept from the list!')
                              }
                            }}
                            className="px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            Go to Concept <ArrowRight className="h-2.5 w-2.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {studyPlanItems.length === 0 && (
                  <div className="text-center py-12 text-slate-400 text-sm">
                    No tasks scheduled. Select your daily budget above and click "Regenerate Study Plan" to map out your tasks!
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB: TESTS & INVITES (TEACHER ONLY) */}
        {activeTab === 'tests' && userRole === 'teacher' && (
          <div className="space-y-8 animate-fadeIn">
            {/* Create Test Section */}
            <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm">
              <h2 className="text-xl font-bold text-slate-800 mb-2">Create a Test / Training Assessment</h2>
              <p className="text-xs text-slate-500 mb-6">
                Select your subject material, choose the question type format (Objective, Theory, Essay, or Mix), and generate an assessment code for students to take.
              </p>

              <form 
                onSubmit={async (e) => {
                  e.preventDefault()
                  if (!newTestTitle.trim() || !newTestSubjectId) {
                    alert('Please provide a test title and select a subject.')
                    return
                  }
                  setIsCreatingTest(true)
                  try {
                    // 1. Create test and generate code
                    const newTest = await dbCreateTest(
                      session.user.id,
                      newTestTitle.trim(),
                      newTestSubjectId,
                      newTestQuestionCount,
                      newTestDisableGuidance,
                      newTestQuestionType
                    )

                    // 2. Ensure questions matching this type are available for the subject
                    try {
                      const subjectConcepts = await dbFetchConcepts(newTestSubjectId)
                      let matchingQs: Question[] = []
                      for (const c of subjectConcepts) {
                        const qs = await dbFetchQuestions(c.id)
                        const filtered = qs.filter(q => {
                          if (newTestQuestionType === 'objective') return q.question_type === 'mcq' || q.sub_type === 'objective'
                          if (newTestQuestionType === 'theory') return q.sub_type === 'theory' || (q.question_type === 'short_answer' && q.sub_type !== 'body')
                          if (newTestQuestionType === 'body') return q.sub_type === 'body'
                          return true
                        })
                        matchingQs.push(...filtered)
                      }

                      // If fewer questions of this type than requested, auto-generate them from materials!
                      if (matchingQs.length < newTestQuestionCount && subjectConcepts.length > 0) {
                        const mats = await dbFetchMaterials(newTestSubjectId)
                        if (mats.length > 0 && mats[0].raw_text) {
                          const needed = Math.max(newTestQuestionCount - matchingQs.length, 5)
                          const extractedConcepts: ExtractedConcept[] = subjectConcepts.map(c => ({
                            name: c.name,
                            summary: c.summary,
                            simple_explanation: c.simple_explanation
                          }))
                          const generated = await generateQuestionsFromMaterial(
                            mats[0].title,
                            mats[0].raw_text,
                            needed,
                            newTestQuestionType,
                            extractedConcepts
                          )
                          for (let i = 0; i < generated.length; i++) {
                            const gq = generated[i]
                            const targetConcept = subjectConcepts.find(c => c.name.toLowerCase() === gq.concept_name?.toLowerCase()) || subjectConcepts[i % subjectConcepts.length]
                            await dbCreateQuestions([gq], targetConcept.id)
                          }
                        }
                      }
                    } catch (genErr) {
                      console.warn('Note: could not pre-generate extra questions for test:', genErr)
                    }

                    alert(`🎉 Test Created Successfully!\n\n📋 Title: "${newTest.title}"\n🔑 Student Invitation Code: ${newTest.code}\n📝 Format: ${newTestQuestionType.toUpperCase()}\n🔢 Questions: ${newTestQuestionCount}\n\nStudents can now enter this code on their dashboard to take the test!`)
                    setNewTestTitle('')
                    setNewTestDisableGuidance(false)
                    loadUserData()
                  } catch (err: any) {
                    alert('Failed to create test: ' + (err.message || err))
                  } finally {
                    setIsCreatingTest(false)
                  }
                }}
                className="grid grid-cols-1 md:grid-cols-2 gap-5"
              >
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Test Title
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Computer Studies Midterm Exam"
                      value={newTestTitle}
                      onChange={(e) => setNewTestTitle(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs shadow-sm focus:ring-violet-500 focus:border-violet-500 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Select Subject / Material
                    </label>
                    <select
                      value={newTestSubjectId}
                      onChange={(e) => setNewTestSubjectId(e.target.value)}
                      required
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs shadow-sm focus:ring-violet-500 focus:border-violet-500 font-medium bg-white text-slate-700"
                    >
                      <option value="">-- Choose a Subject --</option>
                      {subjects.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Number of Questions per Student
                    </label>
                    <input
                      type="number"
                      required
                      min={1}
                      max={50}
                      value={newTestQuestionCount}
                      onChange={(e) => setNewTestQuestionCount(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs shadow-sm focus:ring-violet-500 focus:border-violet-500 font-medium"
                    />
                  </div>

                  <div className="flex items-center gap-2.5 pt-4">
                    <button
                      type="button"
                      onClick={() => setNewTestDisableGuidance(!newTestDisableGuidance)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        newTestDisableGuidance ? 'bg-violet-600' : 'bg-slate-200'
                      }`}
                    >
                      <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        newTestDisableGuidance ? 'translate-x-5' : 'translate-x-0'
                      }`} />
                    </button>
                    <div className="text-left">
                      <span className="text-xs font-bold text-slate-700 block">Disable Socratic Guidance</span>
                      <span className="text-[10px] text-slate-400 block leading-tight">Students won't receive analogies or Socratic hints during the test.</span>
                    </div>
                  </div>
                </div>

                {/* Question Type Selection (Obj, Theory, Essay, Mix) */}
                <div className="md:col-span-2 space-y-2 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">
                      Question Type Format
                    </label>
                    <span className="text-[11px] text-indigo-600 font-semibold">
                      Selected: {
                        newTestQuestionType === 'objective' ? 'Objective (MCQ)' :
                        newTestQuestionType === 'theory' ? 'Theory (Conceptual)' :
                        newTestQuestionType === 'body' ? 'Essay (Body/Analytical)' : 'Mix (Obj + Theory + Essay)'
                      }
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {[
                      {
                        id: 'objective',
                        title: 'Obj (Multiple Choice)',
                        badge: 'MCQ',
                        desc: 'Multiple-choice questions with 4 distinct options & automated grading.',
                        icon: CheckCircle
                      },
                      {
                        id: 'theory',
                        title: 'Theory (Conceptual)',
                        badge: 'Short Answer',
                        desc: 'Conceptual questions testing core principles, definitions & key mechanisms.',
                        icon: Brain
                      },
                      {
                        id: 'body',
                        title: 'Essay (Body)',
                        badge: 'Analytical',
                        desc: 'Structured, in-depth analytical questions testing comprehensive mastery.',
                        icon: FileText
                      },
                      {
                        id: 'mixed',
                        title: 'Mix (All Types)',
                        badge: 'Recommended',
                        desc: 'Balanced combination of Objective MCQs + Theory & Essay questions.',
                        icon: Sparkles
                      }
                    ].map(t => {
                      const IconComp = t.icon
                      const isSelected = newTestQuestionType === t.id
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setNewTestQuestionType(t.id as QuestionSettingType)}
                          className={`text-left p-3.5 rounded-xl border text-xs transition-all cursor-pointer flex flex-col justify-between ${
                            isSelected
                              ? 'border-indigo-600 bg-indigo-50/80 ring-2 ring-indigo-500/20 shadow-sm'
                              : 'border-slate-200 bg-white hover:bg-slate-50'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <div className={`p-1.5 rounded-lg ${isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                                <IconComp className="h-4 w-4" />
                              </div>
                              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                                isSelected ? 'bg-indigo-200/60 text-indigo-900' : 'bg-slate-100 text-slate-500'
                              }`}>
                                {t.badge}
                              </span>
                            </div>
                            <h4 className={`font-bold text-sm mb-1 ${isSelected ? 'text-indigo-950' : 'text-slate-800'}`}>{t.title}</h4>
                            <p className="text-[11px] text-slate-500 leading-snug">{t.desc}</p>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="md:col-span-2 pt-2">
                  <button
                    type="submit"
                    disabled={isCreatingTest}
                    className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm cursor-pointer disabled:opacity-50 transition-all hover:-translate-y-0.5"
                  >
                    {isCreatingTest ? 'Creating Test & Generating Code...' : 'Create Test & Generate Code'}
                  </button>
                </div>
              </form>
            </div>

            {/* Created Tests List */}
            <div className="space-y-4">
              <h3 className="text-base font-bold text-slate-800">Your Tests & Assessment Codes</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {tests.map(test => (
                  <div key={test.id} className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow">
                    <div>
                      <div className="flex justify-between items-start mb-4">
                        <div className="max-w-[65%]">
                          <h4 className="text-base font-bold text-slate-800 truncate">{test.title}</h4>
                          <p className="text-xs text-slate-400 mt-0.5">Subject: {test.subject_name}</p>
                        </div>
                        <div className="text-right flex flex-col items-end gap-1">
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                            test.question_type === 'objective' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                            test.question_type === 'theory' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                            test.question_type === 'body' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                            'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}>
                            {test.question_type === 'objective' ? 'Obj (MCQ)' :
                             test.question_type === 'theory' ? 'Theory' :
                             test.question_type === 'body' ? 'Essay' : 'Mix (All)'}
                          </span>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-violet-600 bg-violet-50 px-2 py-0.5 rounded">
                            {test.question_count} Questions
                          </span>
                          {test.disable_guidance && (
                            <span className="text-[9px] font-bold uppercase tracking-wider text-rose-600 bg-rose-50 px-2 py-0.5 rounded block">
                              Guidance Disabled
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Large Invitation Code Display */}
                      <div className="mb-4 bg-slate-50 border border-slate-100 rounded-xl p-4 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block leading-tight">Student Invitation Code</span>
                          <span className="text-2xl font-black text-slate-900 tracking-wider mt-0.5 block">{test.code}</span>
                        </div>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(test.code)
                            alert(`Invitation code "${test.code}" copied to clipboard!`)
                          }}
                          className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 shadow-sm cursor-pointer transition-colors"
                        >
                          Copy Code
                        </button>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 mt-2">
                      <button
                        disabled={isLoadingScores === test.id}
                        onClick={async () => {
                          setIsLoadingScores(test.id)
                          try {
                            const scores = await dbFetchTestScores(test.id)
                            setViewingTestScores({ test, scores })
                            setScoresSearchQuery('')
                          } catch (err: any) {
                            console.error('Failed to load scores:', err)
                            setViewingTestScores({ test, scores: [] })
                          } finally {
                            setIsLoadingScores(null)
                          }
                        }}
                        className="w-full py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition-colors cursor-pointer text-center flex items-center justify-center gap-1.5 disabled:opacity-50"
                      >
                        {isLoadingScores === test.id ? (
                          <span>Loading Student Scores...</span>
                        ) : (
                          <>
                            <Users className="h-3.5 w-3.5" />
                            <span>View Student Results & Scores</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ))}

                {tests.length === 0 && (
                  <div className="col-span-full bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-sm">
                    <FileText className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                    <h3 className="text-lg font-bold text-slate-800">No tests created yet</h3>
                    <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
                      Fill out the form above to create an assessment and generate an invitation code for your students.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        {/* TAB: PROFILE SETTINGS */}
        {activeTab === 'profile' && (
          <div className="space-y-8 animate-fadeIn max-w-2xl mx-auto">
            <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
              <div>
                <h2 className="text-xl font-bold text-slate-800">Profile Settings</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Customize your learning profile image and details.
                </p>
              </div>

              <form
                onSubmit={async (e) => {
                  e.preventDefault()
                  if (!session) return
                  
                  const targetInstitution = (e.currentTarget.elements.namedItem('institution') as HTMLInputElement).value
                  const avatarInput = e.currentTarget.elements.namedItem('avatar_file') as HTMLInputElement
                  let avatarBase64 = userProfile?.avatar_url || null
                  
                  const file = avatarInput.files?.[0]
                  if (file) {
                    const reader = new FileReader()
                    const readPromise = new Promise<string>((resolve, reject) => {
                      reader.onload = (event) => resolve(event.target?.result as string)
                      reader.onerror = (err) => reject(err)
                    })
                    reader.readAsDataURL(file)
                    try {
                      avatarBase64 = await readPromise
                    } catch (err) {
                      alert('Failed to read image file.')
                      return
                    }
                  }
                  
                  try {
                    const updated = await dbUpdateUserProfile(
                      session.user.id,
                      targetInstitution.trim() || null,
                      avatarBase64
                    )
                    setUserProfile(updated)
                    alert('Profile updated successfully!')
                  } catch (err: any) {
                    alert('Failed to update profile: ' + err.message)
                  }
                }}
                className="space-y-5"
              >
                {/* Avatar upload */}
                <div className="flex flex-col sm:flex-row items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="relative shrink-0">
                    {userProfile?.avatar_url ? (
                      <img 
                        src={userProfile.avatar_url} 
                        className="h-20 w-20 object-cover rounded-full border-2 border-violet-200" 
                        alt="Avatar Preview" 
                        id="avatar-preview-img"
                      />
                    ) : (
                      <div className="h-20 w-20 bg-slate-200 text-slate-600 rounded-full flex items-center justify-center border-2 border-slate-300 shrink-0">
                        <User className="h-10 w-10" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 text-center sm:text-left space-y-1">
                    <span className="text-xs font-bold text-slate-700 block">Profile Picture</span>
                    <input 
                      type="file" 
                      name="avatar_file" 
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) {
                          const reader = new FileReader()
                          reader.onload = (event) => {
                            const img = document.getElementById('avatar-preview-img') as HTMLImageElement
                            if (img) img.src = event.target?.result as string
                          }
                          reader.readAsDataURL(file)
                        }
                      }}
                      className="text-xs text-slate-500 max-w-xs block mx-auto sm:mx-0"
                    />
                    <span className="text-[10px] text-slate-400 block">PNG, JPG, or GIF up to 2MB.</span>
                    {userProfile?.avatar_url && (
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm('Remove profile picture?')) {
                            dbUpdateUserProfile(session.user.id, userProfile.institution || null, null).then(updated => {
                              setUserProfile(updated)
                            })
                          }
                        }}
                        className="text-[10px] text-red-500 font-bold hover:underline cursor-pointer"
                      >
                        Remove Image
                      </button>
                    )}
                  </div>
                </div>

                {/* Email (Read only) */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    disabled
                    value={session.user.email}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-400 bg-slate-50"
                  />
                </div>

                {/* Role (Read only) */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                    User Role
                  </label>
                  <input
                    type="text"
                    disabled
                    value={userRole === 'teacher' ? 'Teacher / Instructor' : 'Student / Learner'}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-400 bg-slate-50"
                  />
                </div>

                {/* Institution/Organization */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Institution / Organization
                  </label>
                  <input
                    type="text"
                    name="institution"
                    defaultValue={userProfile?.institution || ''}
                    placeholder="e.g. Harvard University, Acme Corp"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs shadow-sm focus:ring-violet-500 focus:border-violet-500 font-medium text-slate-700 bg-white"
                  />
                </div>

                <div className="pt-2 flex gap-3">
                  <button
                    type="submit"
                    className="flex-1 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm cursor-pointer transition-all hover:-translate-y-0.5"
                  >
                    Save Changes
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('dashboard')}
                    className="px-4 py-2.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold shadow-sm transition-colors cursor-pointer"
                  >
                    Back to Dashboard
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ADD SUBJECT MODAL */}
        {isAddSubjectModalOpen && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4 animate-scaleUp">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-base font-bold text-slate-800">Add New Subject</h3>
                  <p className="text-xs text-slate-500 mt-1">Enter the name of your new study subject.</p>
                </div>
                <button 
                  onClick={() => setIsAddSubjectModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleModalCreateSubject} className="space-y-4">
                <input
                  type="text"
                  required
                  placeholder="e.g. Organic Chemistry, Marketing 101"
                  value={modalSubjectName}
                  onChange={(e) => setModalSubjectName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm shadow-sm focus:ring-violet-500 focus:border-violet-500 font-medium text-slate-700 bg-white"
                />

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAddSubjectModalOpen(false)}
                    className="px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCreatingSubject}
                    className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold rounded-xl shadow-md disabled:opacity-50 cursor-pointer transition-colors"
                  >
                    {isCreatingSubject ? 'Creating...' : 'Create Subject'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* VIEW & EXPORT STUDENT SCORES MODAL */}
        {viewingTestScores && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-3 md:p-6 animate-fadeIn overflow-y-auto">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-4xl w-full my-auto flex flex-col max-h-[90vh] animate-scaleUp overflow-hidden">
              {/* Modal Header */}
              <div className="p-5 md:p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-xl font-bold text-slate-800">
                      {viewingTestScores.test.title}
                    </h3>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 rounded-full">
                      Code: {viewingTestScores.test.code}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                      {viewingTestScores.test.question_type?.toUpperCase() || 'MIXED'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Student performance overview, score logs, and grade report exports.
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap shrink-0">
                  <button
                    onClick={() => handleExportCSV(viewingTestScores.test, viewingTestScores.scores)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors cursor-pointer"
                    title="Export as Excel / CSV spreadsheet"
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                    <span>Export Excel (CSV)</span>
                  </button>

                  <button
                    onClick={() => handlePrintPDF(viewingTestScores.test, viewingTestScores.scores)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors cursor-pointer"
                    title="Print or Save as Document / PDF"
                  >
                    <Printer className="h-4 w-4" />
                    <span>Print / PDF</span>
                  </button>

                  <button 
                    onClick={() => setViewingTestScores(null)}
                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                    aria-label="Close"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-5 md:p-6 overflow-y-auto space-y-5">
                {/* Summary KPI Cards */}
                {(() => {
                  const total = viewingTestScores.scores.length
                  const completed = viewingTestScores.scores.filter(s => s.completed).length
                  const inProgress = total - completed
                  const completedWithScores = viewingTestScores.scores.filter(s => s.completed && s.score !== null && s.score !== undefined)
                  const avgScore = completedWithScores.length > 0
                    ? Math.round(completedWithScores.reduce((acc, curr) => acc + Number(curr.score || 0), 0) / completedWithScores.length)
                    : 0

                  return (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Total Enrolled</span>
                        <span className="text-xl font-black text-slate-800 mt-1 block">{total}</span>
                      </div>
                      <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-xl p-3.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">Completed</span>
                        <span className="text-xl font-black text-emerald-800 mt-1 block">{completed}</span>
                      </div>
                      <div className="bg-amber-50/60 border border-amber-200/80 rounded-xl p-3.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 block">In Progress</span>
                        <span className="text-xl font-black text-amber-800 mt-1 block">{inProgress}</span>
                      </div>
                      <div className="bg-indigo-50/60 border border-indigo-200/80 rounded-xl p-3.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 block">Class Average</span>
                        <span className="text-xl font-black text-indigo-900 mt-1 block">{avgScore}%</span>
                      </div>
                    </div>
                  )
                })()}

                {/* Search Bar */}
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search students by email or status..."
                      value={scoresSearchQuery}
                      onChange={(e) => setScoresSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    />
                  </div>
                  {scoresSearchQuery && (
                    <button
                      onClick={() => setScoresSearchQuery('')}
                      className="text-xs text-slate-500 hover:text-slate-800 font-semibold cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Table of Scores */}
                {(() => {
                  const filtered = viewingTestScores.scores.filter(s => {
                    if (!scoresSearchQuery.trim()) return true
                    const q = scoresSearchQuery.toLowerCase()
                    const email = (s.student_email || s.student_id).toLowerCase()
                    const status = s.completed ? 'completed' : 'in progress'
                    const scoreStr = s.score !== null && s.score !== undefined ? `${s.score}%` : ''
                    return email.includes(q) || status.includes(q) || scoreStr.includes(q)
                  })

                  if (viewingTestScores.scores.length === 0) {
                    return (
                      <div className="border border-dashed border-slate-200 rounded-2xl p-8 text-center bg-slate-50/50">
                        <Users className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                        <h4 className="text-sm font-bold text-slate-700">No students enrolled yet</h4>
                        <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                          Share the invitation code below with your students so they can join and take this assessment.
                        </p>
                        <div className="mt-4 inline-flex items-center gap-3 bg-white border border-slate-200 px-4 py-2 rounded-xl shadow-sm">
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Code:</span>
                          <span className="text-base font-black text-indigo-600 tracking-widest">{viewingTestScores.test.code}</span>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(viewingTestScores.test.code)
                              alert(`Code ${viewingTestScores.test.code} copied!`)
                            }}
                            className="text-xs font-bold text-slate-600 hover:text-slate-900 ml-1 underline cursor-pointer"
                          >
                            Copy
                          </button>
                        </div>
                      </div>
                    )
                  }

                  if (filtered.length === 0) {
                    return (
                      <div className="p-8 text-center text-xs text-slate-500">
                        No students match "{scoresSearchQuery}".
                      </div>
                    )
                  }

                  return (
                    <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                            <tr>
                              <th className="py-3 px-4">Student</th>
                              <th className="py-3 px-4">Status</th>
                              <th className="py-3 px-4">Score</th>
                              <th className="py-3 px-4 hidden sm:table-cell">Started</th>
                              <th className="py-3 px-4">Completed</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                            {filtered.map(s => {
                              const isComp = s.completed
                              const scoreVal = s.score !== null && s.score !== undefined ? Number(s.score) : 0
                              const scoreBadgeClass = scoreVal >= 70
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : scoreVal >= 50
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-rose-50 text-rose-700 border-rose-200'

                              return (
                                <tr key={s.id || s.student_id} className="hover:bg-slate-50/70 transition-colors">
                                  <td className="py-3 px-4">
                                    <div className="flex items-center gap-2">
                                      <div className="h-7 w-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0">
                                        {(s.student_email || 'S')[0].toUpperCase()}
                                      </div>
                                      <div className="truncate max-w-[200px] md:max-w-xs font-semibold text-slate-900">
                                        {s.student_email || s.student_id}
                                      </div>
                                    </div>
                                  </td>
                                  <td className="py-3 px-4">
                                    {isComp ? (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                                        <CheckCircle2 className="h-3 w-3 text-indigo-600" />
                                        Completed
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                        <Clock className="h-3 w-3 text-slate-400" />
                                        In Progress
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-3 px-4">
                                    {isComp ? (
                                      <span className={`inline-block px-2.5 py-0.5 rounded-lg text-xs font-black border ${scoreBadgeClass}`}>
                                        {scoreVal}%
                                      </span>
                                    ) : (
                                      <span className="text-slate-400 font-bold">-</span>
                                    )}
                                  </td>
                                  <td className="py-3 px-4 text-slate-500 hidden sm:table-cell">
                                    {s.started_at ? new Date(s.started_at).toLocaleDateString() : '-'}
                                  </td>
                                  <td className="py-3 px-4 text-slate-500">
                                    {s.completed_at ? (
                                      <span>
                                        {new Date(s.completed_at).toLocaleDateString()} {new Date(s.completed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                      </span>
                                    ) : '-'}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )
                })()}
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  Showing {viewingTestScores.scores.length} student submission(s)
                </span>
                <button
                  onClick={() => setViewingTestScores(null)}
                  className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors shadow-sm cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  )
}
