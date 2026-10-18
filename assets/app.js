const STORE_KEY = "reshad-du-prep-v1-results";
const LOCAL_QUESTIONS_KEY = "reshad-du-prep-local-questions-v1";
const CORRECT_MARK = 1;
const WRONG_MARK = -0.25;
// After deploying backend/worker.js, paste its public URL here. Never put an AI API key in this file.
const AI_API_URL = "";
let questionBank = [];
let chapterCatalogue = [];
let practiceQuestions = [];
let examQuestions = [];
let examAnswers = {};
let reviewFlags = new Set();
let currentExamIndex = 0;
let examEndAt = null;
let timerHandle = null;
let pendingSubmit = false;
let toastHandle = null;
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

async function init() {
  try {
    const res = await fetch("data/questions.json");
    if (!res.ok) throw new Error("Question bank could not be loaded.");
    const bundledQuestions = await res.json();
    let localQuestions = [];
    try { const parsed = JSON.parse(localStorage.getItem(LOCAL_QUESTIONS_KEY) || "[]"); if (Array.isArray(parsed)) localQuestions = parsed; } catch (_) {}
    questionBank = [...bundledQuestions, ...localQuestions.filter(q => !bundledQuestions.some(base => base.id === q.id))];
    const chapterRes = await fetch("data/chapters.json");
    if (!chapterRes.ok) throw new Error("Chapter catalogue could not be loaded.");
    const chapterData = await chapterRes.json();
    chapterCatalogue = chapterData.chapters || [];
  } catch (err) {
    showToast("Could not load questions. Open this site through GitHub Pages or a local web server.");
    console.error(err);
  }
  bindNavigation();
  bindPractice();
  bindExam();
  bindChapterSelectors();
  bindResults();
  bindHelp();
  bindAITutor();
  bindAdmin();
  updateDashboard();
  renderResults();
  loadPractice();
}

function bindNavigation() {
  $$(".nav-link").forEach(btn => btn.addEventListener("click", () => showPage(btn.dataset.page)));
  $$("[data-go]").forEach(btn => btn.addEventListener("click", () => showPage(btn.dataset.go)));
  $$(".subject-card").forEach(btn => btn.addEventListener("click", () => {
    $("#practice-subject").value = btn.dataset.subject;
    loadPractice();
    showPage("practice");
  }));
}
function showPage(name) {
  $$(".page").forEach(p => p.classList.toggle("active", p.id === `page-${name}`));
  $$(".nav-link").forEach(b => b.classList.toggle("active", b.dataset.page === name));
  const titles = {dashboard:"Dashboard",practice:"Practice mode",exam:"Exam mode",results:"Results & analysis",tutor:"AI Tutor & Solver",admin:"Admin · Add MCQs"};
  $("#page-title").innerHTML = `${titles[name] || "Dashboard"}<span class="title-dot">.</span>`;
  window.scrollTo({top:0,behavior:"smooth"});
  if (name === "results") renderResults();
  if (name === "admin") renderAdminRecent();
}
function shuffle(list) {
  const a = [...list];
  for (let i=a.length-1;i>0;i--) { const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
  return a;
}
function filterQuestions(subject, difficulty="All", paper="All", chapter="All", topic="All") {
  return questionBank.filter(q => (subject === "All subjects" || q.subject === subject) &&
    (paper === "All" || q.paper === paper) &&
    (chapter === "All" || q.chapterId === chapter) &&
    (topic === "All" || q.topic === topic) &&
    (difficulty === "All" || q.difficulty === difficulty));
}
function updateChapterOptions(prefix) {
  const subject = $(`#${prefix}-subject`).value;
  const paper = $(`#${prefix}-paper`).value;
  const chapterSelect = $(`#${prefix}-chapter`);
  const previous = chapterSelect.value;
  const chapters = chapterCatalogue.filter(c => (subject === "All subjects" || c.subject === subject) && (paper === "All" || c.paper === paper));
  chapterSelect.innerHTML = `<option value="All">All chapters</option>` + chapters.map(c => `<option value="${esc(c.id)}">${esc(c.paper)} · ${esc(c.name)}</option>`).join("");
  if ([...chapterSelect.options].some(o=>o.value===previous)) chapterSelect.value=previous;
  updateTopicOptions(prefix);
}
function updateTopicOptions(prefix) {
  const chapterId = $(`#${prefix}-chapter`).value;
  const topicSelect = $(`#${prefix}-topic`);
  const previous = topicSelect.value;
  let topics = [];
  if (chapterId !== "All") {
    const chapter = chapterCatalogue.find(c=>c.id===chapterId);
    topics = chapter ? chapter.topics : [];
  } else {
    const subject = $(`#${prefix}-subject`).value;
    const paper = $(`#${prefix}-paper`).value;
    topics = [...new Set(questionBank.filter(q=>(subject==="All subjects"||q.subject===subject)&&(paper==="All"||q.paper===paper)).map(q=>q.topic))].sort();
  }
  topicSelect.innerHTML = `<option value="All">All topics</option>` + topics.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join("");
  if ([...topicSelect.options].some(o=>o.value===previous)) topicSelect.value=previous;
}
function bindChapterSelectors() {
  ["practice","exam"].forEach(prefix=>{
    updateChapterOptions(prefix);
    $(`#${prefix}-subject`).addEventListener("change",()=>updateChapterOptions(prefix));
    $(`#${prefix}-paper`).addEventListener("change",()=>updateChapterOptions(prefix));
    $(`#${prefix}-chapter`).addEventListener("change",()=>updateTopicOptions(prefix));
  });
}
function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function bindPractice() {
  $("#load-practice").addEventListener("click", loadPractice);
  $("#practice-subject").addEventListener("change", loadPractice);
  $("#practice-difficulty").addEventListener("change", loadPractice);
  $("#practice-paper").addEventListener("change", loadPractice);
  $("#practice-chapter").addEventListener("change", loadPractice);
  $("#practice-topic").addEventListener("change", loadPractice);
  $("#practice-order").addEventListener("change", loadPractice);
}
function loadPractice() {
  const subject = $("#practice-subject").value;
  const difficulty = $("#practice-difficulty").value;
  practiceQuestions = filterQuestions(subject,difficulty,$("#practice-paper").value,$("#practice-chapter").value,$("#practice-topic").value);
  if ($("#practice-order").value === "mixed") practiceQuestions = shuffle(practiceQuestions);
  renderPractice();
}
function renderPractice() {
  const root = $("#practice-area");
  if (!practiceQuestions.length) {
    root.innerHTML = `<div class="result-empty glass"><h3>No questions in this filter yet</h3><p>Add more questions to data/questions.json or choose another subject/difficulty.</p></div>`;
    return;
  }
  root.innerHTML = practiceQuestions.map((q,i) => `
    <article class="practice-question glass" data-qid="${esc(q.id)}">
      <div class="question-card-top"><div class="question-tags"><span class="tag">${esc(q.subject)}</span><span class="tag">${esc(q.paper || "Paper not tagged")}</span><span class="tag">${esc(q.chapter)}</span><span class="tag">${esc(q.topic)}</span><span class="tag ${q.difficulty.toLowerCase()}">${esc(q.difficulty)}</span></div><span class="question-number">Q${i+1} / ${practiceQuestions.length}</span></div>
      <p class="question-text">${esc(q.question)}</p>
      <div class="options">${q.options.map((o,j)=>`<label class="option"><input type="radio" name="practice-${esc(q.id)}" value="${j}"><span><b>${String.fromCharCode(65+j)}.</b> ${esc(o)}</span></label>`).join("")}</div>
      <div class="practice-actions"><button class="btn btn-ghost" data-action="hint">Show hint</button><button class="btn btn-ghost" data-action="check">Check answer</button><button class="btn btn-ghost" data-action="explain">Explain solution</button></div>
      <div class="hint-box hidden" data-box="hint"><strong>Hint:</strong> ${esc(q.hint)}</div>
      <div class="explanation-box hidden" data-box="explain"></div>
    </article>`).join("");
  root.querySelectorAll("[data-action]").forEach(btn => btn.addEventListener("click", () => {
    const card = btn.closest(".practice-question");
    const q = practiceQuestions.find(x=>x.id===card.dataset.qid);
    const box = card.querySelector(`[data-box="${btn.dataset.action==="hint"?"hint":"explain"}"]`);
    if (btn.dataset.action==="hint") { box.classList.toggle("hidden"); return; }
    if (btn.dataset.action==="explain") {
      box.innerHTML = `<strong>Solution:</strong> ${esc(q.explanation)}<br><span class="subtle-text">Correct answer: ${String.fromCharCode(65+q.answer)}. ${esc(q.options[q.answer])}</span>`;
      box.classList.remove("hidden"); return;
    }
    const chosen = card.querySelector(`input[name="practice-${CSS.escape(q.id)}"]:checked`);
    if (!chosen) { showToast("Choose an option first."); return; }
    card.querySelectorAll(".option").forEach((label,j)=>{
      label.classList.toggle("correct",j===q.answer);
      label.classList.toggle("incorrect",j===Number(chosen.value)&&j!==q.answer);
    });
    box.innerHTML = `${Number(chosen.value)===q.answer?"Correct!":"Not quite."} ${esc(q.explanation)}<br><span class="subtle-text">Answer: ${String.fromCharCode(65+q.answer)}. ${esc(q.options[q.answer])}</span>`;
    box.classList.remove("hidden");
  }));
}

function bindExam() {
  $("#start-exam").addEventListener("click", startExam);
  $("#prev-question").addEventListener("click", ()=>moveExam(-1));
  $("#next-question").addEventListener("click", ()=>moveExam(1));
  $("#mark-review").addEventListener("click", toggleReview);
  $("#submit-exam").addEventListener("click", requestSubmit);
  $("#cancel-submit").addEventListener("click", ()=>showConfirm(false));
  $("#confirm-submit").addEventListener("click", ()=>finishExam("manual"));
}
function startExam() {
  const subject = $("#exam-subject").value;
  let pool = shuffle(filterQuestions(subject,"All",$("#exam-paper").value,$("#exam-chapter").value,$("#exam-topic") ? $("#exam-topic").value : "All"));
  if (!pool.length) { showToast("No questions match these subject/paper/chapter filters yet. Try a broader filter or add more questions."); return; }
  const countVal = $("#exam-count").value;
  const count = countVal==="all" ? pool.length : Number(countVal);
  examQuestions = pool.slice(0,count);
  examAnswers = {};
  reviewFlags = new Set();
  currentExamIndex = 0;
  pendingSubmit = false;
  examEndAt = Date.now() + Number($("#exam-duration").value)*60*1000;
  $("#exam-setup").classList.add("hidden");
  $("#exam-confirm").classList.add("hidden");
  $("#exam-area").classList.remove("hidden");
  renderPalette();
  renderExamQuestion();
  updateTimer();
  clearInterval(timerHandle);
  timerHandle = setInterval(updateTimer,250);
}
function updateTimer() {
  if (!examEndAt) return;
  const seconds = Math.max(0,Math.ceil((examEndAt-Date.now())/1000));
  $("#timer").textContent = `${String(Math.floor(seconds/60)).padStart(2,"0")}:${String(seconds%60).padStart(2,"0")}`;
  $("#timer").classList.toggle("urgent",seconds<=60);
  if (seconds<=0) finishExam("timeout");
}
function renderPalette() {
  $("#question-palette").innerHTML = examQuestions.map((q,i)=>`<button data-index="${i}" aria-label="Question ${i+1}">${i+1}</button>`).join("");
  $("#question-palette").querySelectorAll("button").forEach(btn=>btn.addEventListener("click",()=>{
    currentExamIndex=Number(btn.dataset.index);renderExamQuestion();
  }));
  updatePalette();
}
function updatePalette() {
  $("#question-palette").querySelectorAll("button").forEach((btn,i)=>{
    btn.classList.toggle("current",i===currentExamIndex);
    btn.classList.toggle("answered",examAnswers[examQuestions[i].id]!==undefined);
    btn.classList.toggle("review",reviewFlags.has(examQuestions[i].id));
  });
}
function renderExamQuestion() {
  const q = examQuestions[currentExamIndex];
  if (!q) return;
  $("#exam-q-count").textContent = `Question ${currentExamIndex+1} of ${examQuestions.length}`;
  $("#exam-subject-label").textContent = `${q.subject} · ${q.paper || ""} · ${q.chapter} · ${q.difficulty}`;
  $("#exam-question-text").textContent = q.question;
  $("#exam-options").innerHTML = q.options.map((o,j)=>`<label class="option ${examAnswers[q.id]===j?"selected":""}"><input type="radio" name="exam-answer" value="${j}" ${examAnswers[q.id]===j?"checked":""}><span><b>${String.fromCharCode(65+j)}.</b> ${esc(o)}</span></label>`).join("");
  $("#exam-options").querySelectorAll("input").forEach(input=>input.addEventListener("change",()=>{
    examAnswers[q.id]=Number(input.value);
    renderExamQuestion();
    updatePalette();
  }));
  $("#prev-question").disabled=currentExamIndex===0;
  $("#prev-question").style.opacity=currentExamIndex===0?".4":"1";
  $("#next-question").textContent=currentExamIndex===examQuestions.length-1?"Last question":"Next →";
  $("#mark-review").textContent=reviewFlags.has(q.id)?"★ Marked for review":"☆ Mark for review";
  $("#exam-progress-bar").style.width=`${((currentExamIndex+1)/examQuestions.length)*100}%`;
  updatePalette();
}
function moveExam(delta) {
  currentExamIndex=Math.min(examQuestions.length-1,Math.max(0,currentExamIndex+delta));
  renderExamQuestion();
}
function toggleReview() {
  const id=examQuestions[currentExamIndex].id;
  reviewFlags.has(id)?reviewFlags.delete(id):reviewFlags.add(id);
  renderExamQuestion();
}
function requestSubmit() {
  const unanswered=examQuestions.filter(q=>examAnswers[q.id]===undefined).length;
  $("#submit-summary").textContent=unanswered?`${unanswered} question(s) are unanswered. You can go back or submit now.`:"All questions have an answer. Submit when you're ready.";
  showConfirm(true);
}
function showConfirm(show) {
  $("#exam-confirm").classList.toggle("hidden",!show);
  $("#exam-area").classList.toggle("hidden",show);
}
function finishExam(reason) {
  if (!examQuestions.length || !examEndAt) return;
  clearInterval(timerHandle);
  timerHandle=null;
  const answers = examQuestions.map(q=>({questionId:q.id,subject:q.subject,paper:q.paper,chapter:q.chapter,topic:q.topic,difficulty:q.difficulty,question:q.question,options:q.options,correctAnswer:q.answer,userAnswer:examAnswers[q.id]===undefined?null:examAnswers[q.id],explanation:q.explanation,hint:q.hint}));
  const correct=answers.filter(a=>a.userAnswer===a.correctAnswer).length;
  const wrong=answers.filter(a=>a.userAnswer!==null&&a.userAnswer!==a.correctAnswer).length;
  const skipped=answers.filter(a=>a.userAnswer===null).length;
  const raw=correct*CORRECT_MARK+wrong*WRONG_MARK;
  const max=answers.length*CORRECT_MARK;
  const net=Math.max(0,raw);
  const scorePct=max?Math.round(net/max*100):0;
  const accuracy=(correct+wrong)?Math.round(correct/(correct+wrong)*100):0;
  const result={id:`${Date.now()}`,date:new Date().toISOString(),subject:$("#exam-subject").value,paper:$("#exam-paper").value,chapter:$("#exam-chapter").value,durationMinutes:Number($("#exam-duration").value),elapsedSeconds:Math.max(0,Math.round((Number($("#exam-duration").value)*60-Math.max(0,(examEndAt-Date.now())/1000)))),reason,questionCount:answers.length,correct,wrong,skipped,rawScore:raw,netScore:net,maxScore:max,scorePct,accuracy,answers,reviewed:[...reviewFlags]};
  const history=getHistory();history.unshift(result);
  try{localStorage.setItem(STORE_KEY,JSON.stringify(history.slice(0,100)));}catch(e){console.warn("Could not save results",e);}
  examEndAt=null;examQuestions=[];
  $("#exam-area").classList.add("hidden");$("#exam-confirm").classList.add("hidden");$("#exam-setup").classList.remove("hidden");
  updateDashboard();renderResults();
  showPage("results");
  showToast(reason==="timeout"?"Time is up. Your exam was submitted.":"Exam submitted. Let's review your mistakes.");
}
function getHistory() {
  try { const x=JSON.parse(localStorage.getItem(STORE_KEY)||"[]");return Array.isArray(x)?x:[]; } catch(e){return [];}
}
function updateDashboard() {
  const h=getHistory();
  $("#stat-sessions").textContent=h.length;
  $("#stat-accuracy").textContent=h.length?`${Math.round(h.reduce((s,r)=>s+r.accuracy,0)/h.length)}%`:"—";
  $("#stat-best").textContent=h.length?`${Math.max(...h.map(r=>r.scorePct))}%`:"—";
}
function bindResults() {
  $("#clear-results").addEventListener("click",()=>{
    if(!confirm("Clear all saved exam history from this browser? This cannot be undone."))return;
    localStorage.removeItem(STORE_KEY);updateDashboard();renderResults();showToast("History cleared.");
  });
}
function renderResults() {
  const history=getHistory(),latest=history[0];
  $("#latest-result").classList.toggle("hidden",!!latest);
  $("#result-content").classList.toggle("hidden",!latest);
  if(!latest)return;
  $("#result-title").textContent=`${latest.subject} · ${latest.questionCount} questions`;
  $("#result-date").textContent=new Date(latest.date).toLocaleString();
  $("#result-score").textContent=`${latest.scorePct}%`;
  $("#score-ring").style.setProperty("--score",`${latest.scorePct}%`);
  $("#result-correct").textContent=latest.correct;
  $("#result-wrong").textContent=latest.wrong;
  $("#result-skipped").textContent=latest.skipped;
  $("#result-accuracy").textContent=`${latest.accuracy}%`;
  const groups={};
  latest.answers.forEach(a=>{
    const key=`${a.subject} · ${a.paper||"Paper"} · ${a.chapter||"Uncategorised"}`;
    if(!groups[key])groups[key]={total:0,correct:0,wrong:0,skipped:0};
    const g=groups[key];g.total++;
    if(a.userAnswer===null)g.skipped++;else if(a.userAnswer===a.correctAnswer)g.correct++;else g.wrong++;
  });
  $("#subject-breakdown").innerHTML=Object.entries(groups).map(([s,g])=>{
    const pct=Math.round(g.correct/g.total*100);
    return `<div class="breakdown-row"><div class="breakdown-top"><strong>${esc(s)}</strong><span>${g.correct}/${g.total} correct · ${pct}%</span></div><div class="breakdown-track"><span style="width:${pct}%"></span></div><div class="subtle-text" style="margin-top:6px">${g.wrong} wrong · ${g.skipped} skipped</div></div>`;
  }).join("");
  $("#answer-review").innerHTML=latest.answers.map((a,i)=>{
    const status=a.userAnswer===null?"skipped":a.userAnswer===a.correctAnswer?"correct":"incorrect";
    const statusText=status==="correct"?"Correct":status==="incorrect"?"Incorrect":"Unanswered";
    const your=a.userAnswer===null?"No answer":`${String.fromCharCode(65+a.userAnswer)}. ${a.options[a.userAnswer]}`;
    const right=`${String.fromCharCode(65+a.correctAnswer)}. ${a.options[a.correctAnswer]}`;
    return `<div class="review-item"><strong>${i+1}. ${esc(a.question)}</strong><p>Your answer: ${esc(your)}<br>Correct: ${esc(right)}<br>${esc(a.explanation)}</p><span class="review-status ${status}">${statusText}</span></div>`;
  }).join("");
  $("#history-list").innerHTML=history.slice(0,10).map(r=>`<div class="history-row"><div><strong>${esc(r.subject)}</strong><small>${new Date(r.date).toLocaleDateString()} · ${r.questionCount} questions</small></div><span>${r.correct} correct / ${r.wrong} wrong</span><span class="history-score">${r.scorePct}%</span></div>`).join("");
}
function bindHelp() {
  const dialog=$("#help-dialog");
  $("#theme-help").addEventListener("click",()=>dialog.showModal());
  $("#close-help").addEventListener("click",()=>dialog.close());
  $("#close-help-bottom").addEventListener("click",()=>dialog.close());
  dialog.addEventListener("click",e=>{if(e.target===dialog)dialog.close();});
}
function showToast(message) {
  const t=$("#toast");t.textContent=message;t.classList.add("show");
  clearTimeout(toastHandle);toastHandle=setTimeout(()=>t.classList.remove("show"),2800);
}
init();


// AI Tutor / Problem Solver. Requests go only to a user-deployed backend; no secret is stored here.

function bindAdmin() {
  if (!$("#admin-question-form")) return;
  const updateAdminChapters = () => {
    const subject = $("#admin-subject").value;
    const paper = $("#admin-paper").value;
    const matches = chapterCatalogue.filter(c => c.subject === subject && c.paper === paper);
    $("#admin-chapter").innerHTML = matches.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join("");
    if (!matches.length) $("#admin-chapter").innerHTML = `<option value="">No chapters available</option>`;
  };
  $("#admin-subject").addEventListener("change", updateAdminChapters);
  $("#admin-paper").addEventListener("change", updateAdminChapters);
  updateAdminChapters();
  $("#admin-question-form").addEventListener("submit", e => {
    e.preventDefault();
    const chapterId = $("#admin-chapter").value;
    const chapter = chapterCatalogue.find(c => c.id === chapterId);
    if (!chapter) { showToast("Choose a valid chapter first."); return; }
    const question = {
      id: `custom-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
      subject: $("#admin-subject").value,
      chapter: chapter.name,
      topic: $("#admin-topic").value.trim(),
      difficulty: $("#admin-difficulty").value,
      question: $("#admin-question").value.trim(),
      options: [0,1,2,3].map(i => $(`#admin-opt${i}`).value.trim()),
      answer: Number($("#admin-answer").value),
      hint: $("#admin-hint").value.trim() || "Try identifying the key concept or formula.",
      explanation: $("#admin-explanation").value.trim(),
      paper: chapter.paper,
      chapterId: chapter.id,
      sourceType: "user_added"
    };
    if (question.options.some(o => !o)) { showToast("Fill in all four options."); return; }
    let local = [];
    try { local = JSON.parse(localStorage.getItem(LOCAL_QUESTIONS_KEY) || "[]"); if (!Array.isArray(local)) local = []; } catch (_) { local = []; }
    local.push(question);
    try { localStorage.setItem(LOCAL_QUESTIONS_KEY, JSON.stringify(local)); }
    catch (_) { showToast("Browser storage is full. Export the bank and remove some local data."); return; }
    questionBank.push(question);
    $("#admin-question-form").reset();
    updateAdminChapters();
    updateDashboard();
    loadPractice();
    renderAdminRecent();
    showToast("Question saved on this device. Export the bank to publish it.");
  });
  $("#admin-export").addEventListener("click", exportQuestionBank);
  $("#admin-import-trigger").addEventListener("click", () => $("#admin-import-file").click());
  $("#admin-import-file").addEventListener("change", importQuestionBank);
  $("#admin-clear-local").addEventListener("click", () => {
    if (!confirm("Remove all questions added locally on this device? Export first if you need a backup.")) return;
    localStorage.removeItem(LOCAL_QUESTIONS_KEY);
    const baseIds = new Set();
    fetch("data/questions.json").then(r=>r.json()).then(base=>{
      base.forEach(q=>baseIds.add(q.id));
      questionBank = questionBank.filter(q=>baseIds.has(q.id));
      updateDashboard(); loadPractice(); renderAdminRecent(); showToast("Local additions cleared.");
    }).catch(()=>showToast("Could not reload the bundled question bank."));
  });
  renderAdminRecent();
}
function renderAdminRecent() {
  const root = $("#admin-recent");
  if (!root) return;
  const local = (() => { try { const x=JSON.parse(localStorage.getItem(LOCAL_QUESTIONS_KEY)||"[]"); return Array.isArray(x)?x:[]; } catch (_) { return []; } })();
  $("#admin-count").textContent = `${questionBank.length} questions loaded`;
  root.innerHTML = local.length ? local.slice(-8).reverse().map((q,i)=>`<div class="admin-recent-row"><div><strong>${esc(q.question)}</strong><small>${esc(q.subject)} · ${esc(q.paper)} · ${esc(q.chapter)} · ${esc(q.difficulty)}</small></div><span>${String.fromCharCode(65+q.answer)} ✓</span></div>`).join("") : `<p class="admin-empty">No local additions yet. Add your first MCQ above.</p>`;
}
function exportQuestionBank() {
  const blob = new Blob([JSON.stringify(questionBank, null, 2)], {type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href=url; a.download="questions.json"; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  showToast("Downloaded questions.json. Upload it to data/questions.json in GitHub to publish changes.");
}
async function importQuestionBank(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    if (!Array.isArray(parsed) || !parsed.every(q=>q && typeof q.question==="string" && Array.isArray(q.options) && q.options.length===4 && Number.isInteger(q.answer) && q.answer>=0 && q.answer<=3 && q.id)) throw new Error("Invalid question bank format");
    const bundledResponse = await fetch("data/questions.json");
    const bundled = await bundledResponse.json();
    const bundledIds = new Set(bundled.map(q=>q.id));
    const local = parsed.filter(q=>!bundledIds.has(q.id));
    localStorage.setItem(LOCAL_QUESTIONS_KEY, JSON.stringify(local));
    questionBank = [...bundled, ...local];
    updateDashboard(); loadPractice(); renderAdminRecent();
    showToast(`Imported ${parsed.length} questions successfully.`);
  } catch (err) { showToast("Import failed. Use a valid questions.json exported from this website."); }
  event.target.value = "";
}

function bindAITutor() {
  const ask = $("#ask-ai");
  if (!ask) return;
  ask.addEventListener("click", askAI);
  $("#clear-ai").addEventListener("click", () => {
    $("#tutor-question").value = "";
    $("#tutor-image").value = "";
    $("#ai-response").innerHTML = '<div class="answer-placeholder"><span>✧</span><strong>Your explanation will appear here</strong><p>Write a question and press Ask AI.</p></div>';
    $("#ai-response-title").textContent = "Ready when you are";
    $("#ai-status").textContent = AI_API_URL ? "Connected" : "Not connected";
  });
}
async function askAI() {
  const question = $("#tutor-question").value.trim();
  const file = $("#tutor-image").files[0];
  const mode = document.querySelector('input[name="tutor-mode"]:checked')?.value || "tutor";
  if (!question && !file) { showToast("Write a question or attach a question image first."); return; }
  if (!AI_API_URL) {
    $("#ai-status").textContent = "Setup required";
    $("#ai-response-title").textContent = "Backend not connected yet";
    $("#ai-response").innerHTML = '<div class="answer-placeholder"><span>⚙</span><strong>One-time setup needed</strong><p>Deploy the Worker in the backend folder, save your API key as a server-side secret, then paste the Worker URL into AI_API_URL in assets/app.js. Refresh the website afterwards.</p></div>';
    $("#ai-footnote").textContent = "No API request was sent. Your API key should never be pasted into this website.";
    return;
  }
  if (file && !["image/png","image/jpeg","image/webp"].includes(file.type)) { showToast("Use a PNG, JPG or WebP image."); return; }
  if (file && file.size > 4*1024*1024) { showToast("Image is larger than 4 MB. Crop or compress it first."); return; }
  const btn = $("#ask-ai");
  btn.disabled = true; btn.textContent = "Thinking…";
  $("#ai-status").textContent = "Working";
  $("#ai-response-title").textContent = mode === "solve" ? "Solving step by step…" : "Preparing your hint…";
  $("#ai-response").innerHTML = '<div class="answer-placeholder"><span class="thinking-dot">•••</span><strong>Working on your question</strong><p>This can take a few seconds.</p></div>';
  try {
    const payload = {mode,subject:$("#tutor-subject").value,level:$("#tutor-level").value,paper:$("#tutor-paper").value,question};
    if (file) payload.imageDataUrl = await readFileAsDataURL(file);
    const res = await fetch(AI_API_URL, {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
    const data = await res.json().catch(()=>({}));
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status}).`);
    if (!data.answer) throw new Error("The backend returned an empty answer.");
    $("#ai-response-title").textContent = mode === "solve" ? "Worked solution" : "Tutor response";
    $("#ai-response").textContent = data.answer;
    $("#ai-status").textContent = "Response ready";
    $("#ai-footnote").textContent = "Check important formulas and answers against your textbook or teacher. AI can make mistakes.";
  } catch (err) {
    $("#ai-status").textContent = "Request failed";
    $("#ai-response-title").textContent = "Could not get a response";
    $("#ai-response").textContent = `${err.message || "Network error"}

Check that the backend is deployed, its allowed origin matches your GitHub Pages site, and its API secret is configured.`;
    $("#ai-footnote").textContent = "Do not share your API key in chat, GitHub, or frontend code.";
  } finally { btn.disabled = false; btn.innerHTML = 'Ask AI <span>↗</span>'; }
}
function readFileAsDataURL(file) {
  return new Promise((resolve,reject)=>{ const reader=new FileReader(); reader.onload=()=>resolve(reader.result); reader.onerror=()=>reject(new Error("Could not read the image.")); reader.readAsDataURL(file); });
}
