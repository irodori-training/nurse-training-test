// ========== グローバル変数 ==========
let testData = {};
let currentSection = 'section1';
let currentQuestionIndex = 0;
let userAnswers = {};
let userName = '';
let facilityName = '';
let testStartTime = null;
let testEndTime = null;

// ✅ 修正：ローカルから読み込む
const GITHUB_RAW_URL = './';

// Google Apps Script の Web Apps URL（後で設定）
const GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/d/https://script.google.com/macros/s/AKfycbxjiGLKNUe5gTMxTg9_YM_vgDFX_Y0GOXkZ9_6wQe2QlHANFM-2qRkR1j3xwk5pp74Q1A/exec/usercopy';

// ========== 初期化 ==========
document.addEventListener('DOMContentLoaded', async function() {
    console.log('ページロード完了');
    
    // JSON ファイルを読み込む
    await loadAllSections();
    
    // イベントリスナー登録
    setupEventListeners();
});

// ========== JSON ファイル読み込み ==========
async function loadAllSections() {
    const sections = ['section1', 'section2', 'section3', 'section4'];
    
    console.log('JSON ファイルを読み込み中...');
    
    for (const section of sections) {
        try {
            const url = `${GITHUB_RAW_URL}data/questions/${section}.json`;
            console.log(`読み込み: ${url}`);
            
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            testData[section] = data;
            console.log(`✅ ${section} を読み込み完了:`, data);
        } catch (error) {
            console.error(`❌ ${section} の読み込みに失敗:`, error);
            alert(`エラー: ${section}.json が読み込めません。\n${error.message}\n\nフォルダ構造を確認してください。`);
        }
    }
    
    console.log('すべての JSON ファイルを読み込み完了', testData);
}

// ========== イベントリスナー設定 ==========
function setupEventListeners() {
    // ログイン
    document.getElementById('loginForm').addEventListener('submit', function(e) {
        e.preventDefault();
        userName = document.getElementById('username').value;
        facilityName = document.getElementById('facility').value;
        startTest();
    });

    // テスト画面のボタン
    document.getElementById('prevBtn').addEventListener('click', previousQuestion);
    document.getElementById('nextBtn').addEventListener('click', nextQuestion);
    document.getElementById('submitBtn').addEventListener('click', submitAnswer);
    document.getElementById('showExplanationBtn').addEventListener('click', showExplanation);
    document.getElementById('exitBtn').addEventListener('click', exitTest);

    // セクション選択
    document.querySelectorAll('.section-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            changeSection(this.getAttribute('data-section'));
        });
    });

    // 結果画面のボタン
    document.getElementById('retryBtn').addEventListener('click', startTest);
    document.getElementById('homeBtn').addEventListener('click', goHome);
    
    // 前回の結果を見るボタン（ログイン画面）
    const prevResultsBtn = document.getElementById('prevResultsBtn');
    if (prevResultsBtn) {
        prevResultsBtn.addEventListener('click', showPreviousResults);
    }
}

// ========== テスト開始 ==========
function startTest() {
    userAnswers = {};
    currentSection = 'section1';
    currentQuestionIndex = 0;
    testStartTime = new Date();
    testEndTime = null;
    
    switchScreen('testScreen');
    displayQuestion();
    updateSectionButtons();
    
    document.getElementById('userName').textContent = userName;
}

// ========== 画面切り替え ==========
function switchScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');
}

// ========== 問題表示 ==========
function displayQuestion() {
    const section = testData[currentSection];
    if (!section || !section.questions) {
        alert('セクションデータが見つかりません');
        return;
    }

    const questions = section.questions;
    const question = questions[currentQuestionIndex];

    // タイトル更新
    document.getElementById('sectionTitle').textContent = section.title;
    
    // 問題数更新
    document.getElementById('currentQuestion').textContent = currentQuestionIndex + 1;
    document.getElementById('totalQuestions').textContent = questions.length;

    // 問題テキスト表示
    const questionDiv = document.createElement('div');
    questionDiv.innerHTML = `
        <div class="question-text">
            問題${currentQuestionIndex + 1}: ${question.text}
        </div>
        <div class="difficulty">
            難易度: ${getDifficultyLabel(question.difficulty)}
        </div>
    `;
    document.getElementById('questionContent').innerHTML = questionDiv.innerHTML;

    // 選択肢表示
    const optionsDiv = document.getElementById('optionsContent');
    optionsDiv.innerHTML = '';
    
    question.options.forEach((option) => {
        const optionDiv = document.createElement('div');
        optionDiv.className = 'option';
        optionDiv.innerHTML = `
            <input type="radio" name="answer" value="${option.letter}" id="option_${option.letter}">
            <label for="option_${option.letter}">
                <strong>${option.letter}:</strong> ${option.text}
            </label>
        `;
        optionsDiv.appendChild(optionDiv);

        // クリックイベント
        optionDiv.addEventListener('click', function() {
            document.querySelectorAll('.option').forEach(opt => opt.classList.remove('selected'));
            optionDiv.classList.add('selected');
            document.getElementById(`option_${option.letter}`).checked = true;
        });

        // 前の回答を復元
        const answerId = `${currentSection}_${currentQuestionIndex}`;
        if (userAnswers[answerId] === option.letter) {
            optionDiv.classList.add('selected');
            document.getElementById(`option_${option.letter}`).checked = true;
        }
    });

    // 解説非表示
    document.getElementById('explanationContent').classList.add('hidden');

    // ボタン有効/無効
    document.getElementById('prevBtn').disabled = currentQuestionIndex === 0;
    document.getElementById('nextBtn').disabled = currentQuestionIndex === questions.length - 1;
    document.getElementById('submitBtn').disabled = false;
    document.getElementById('showExplanationBtn').disabled = true;
}

// ========== 回答送信 ==========
function submitAnswer() {
    const checked = document.querySelector('input[name="answer"]:checked');
    
    if (!checked) {
        alert('選択肢を選んでください');
        return;
    }

    const answerId = `${currentSection}_${currentQuestionIndex}`;
    userAnswers[answerId] = checked.value;

    const section = testData[currentSection];
    const question = section.questions[currentQuestionIndex];
    const isCorrect = checked.value === question.correct_answer;

    // ビジュアルフィードバック：クラスをリセット
    document.querySelectorAll('.option').forEach(opt => {
        opt.classList.remove('selected', 'correct', 'incorrect');
        const input = opt.querySelector('input');
        if (input.value === question.correct_answer) {
            opt.classList.add('correct');
        }
        if (input.checked && !isCorrect) {
            opt.classList.add('incorrect');
        }
    });

    // ボタン状態を更新
    const questions = section.questions;
    document.getElementById('submitBtn').disabled = true;
    document.getElementById('showExplanationBtn').disabled = false;
    document.getElementById('prevBtn').disabled = currentQuestionIndex === 0;
    document.getElementById('nextBtn').disabled = currentQuestionIndex === questions.length - 1;

    alert(isCorrect ? '✅ 正解です！' : '❌ 不正解です');
}

// ========== 解説表示 ==========
function showExplanation() {
    const section = testData[currentSection];
    const question = section.questions[currentQuestionIndex];
    
    const explanationDiv = document.getElementById('explanationContent');
    explanationDiv.innerHTML = `
        <h4>解説</h4>
        <p><strong>要約:</strong> ${question.explanation.summary}</p>
        <p><strong>詳細:</strong> ${question.explanation.detailed}</p>
    `;
    explanationDiv.classList.remove('hidden');
}

// ========== 次へ ==========
function nextQuestion() {
    const section = testData[currentSection];
    const maxIndex = section.questions.length - 1;
    
    if (currentQuestionIndex < maxIndex) {
        currentQuestionIndex++;
        displayQuestion();
    } else {
        alert(`セクション1が終了しました。別のセクションを選択してください。`);
    }
}

// ========== 前へ ==========
function previousQuestion() {
    if (currentQuestionIndex > 0) {
        currentQuestionIndex--;
        displayQuestion();
    }
}

// ========== セクション変更 ==========
function changeSection(sectionId) {
    if (!testData[sectionId]) {
        alert(`セクション ${sectionId} が見つかりません`);
        return;
    }

    currentSection = sectionId;
    currentQuestionIndex = 0;
    displayQuestion();
    updateSectionButtons();
}

// ========== セクションボタン更新 ==========
function updateSectionButtons() {
    document.querySelectorAll('.section-btn').forEach(btn => {
        if (btn.getAttribute('data-section') === currentSection) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

// ========== テスト終了 ==========
function exitTest() {
    if (confirm('テストを終了しますか？')) {
        testEndTime = new Date();
        showResults();
    }
}

// ========== 結果表示 ==========
function showResults() {
    switchScreen('resultScreen');
    calculateResults();
}

// ========== 結果計算 ==========
function calculateResults() {
    let totalCorrect = 0;
    let totalQuestions = 0;
    const sectionResults = {};

    // セクションごとに集計
    Object.keys(testData).forEach(sectionId => {
        const section = testData[sectionId];
        let sectionCorrect = 0;
        let sectionTotal = section.questions.length;

        section.questions.forEach((question, index) => {
            const answerId = `${sectionId}_${index}`;
            if (userAnswers[answerId] === question.correct_answer) {
                sectionCorrect++;
            }
        });

        totalCorrect += sectionCorrect;
        totalQuestions += sectionTotal;

        sectionResults[sectionId] = {
            name: section.title,
            correct: sectionCorrect,
            total: sectionTotal,
            percentage: Math.round((sectionCorrect / sectionTotal) * 100)
        };
    });

    // スコア計算
    const score = Math.round((totalCorrect / totalQuestions) * 100);

    // 結果メッセージ
    let message = '';
    let messageClass = '';
    if (score >= 80) {
        message = '🎉 優秀です！';
        messageClass = 'excellent';
    } else if (score >= 70) {
        message = '👍 良好です';
        messageClass = 'good';
    } else if (score >= 60) {
        message = '📚 もう少しです。復習をおすすめします。';
        messageClass = 'fair';
    } else {
        message = '🔄 もう一度チャレンジしましょう。';
        messageClass = 'poor';
    }

    // 表示
    document.getElementById('finalScore').textContent = score;
    document.getElementById('correctCount').textContent = totalCorrect;
    document.getElementById('totalCount').textContent = totalQuestions;
    
    const resultMessage = document.getElementById('resultMessage');
    resultMessage.textContent = message;
    resultMessage.className = `result-message ${messageClass}`;

    // セクション別結果
    const sectionResultsDiv = document.getElementById('sectionResults');
    sectionResultsDiv.innerHTML = '';
    Object.values(sectionResults).forEach(result => {
        const resultDiv = document.createElement('div');
        resultDiv.className = 'section-result';
        resultDiv.innerHTML = `
            <span class="section-result-name">${result.name}</span>
            <span class="section-result-score">${result.correct} / ${result.total} (${result.percentage}%)</span>
        `;
        sectionResultsDiv.appendChild(resultDiv);
    });

    // 詳細解答
    displayDetailedAnswers();
    
    // 結果を保存
    saveResultToLocalStorage(score, totalCorrect, totalQuestions, sectionResults);
    
    // Google Sheet に送信
    sendResultToGoogleSheet(score, totalCorrect, totalQuestions, sectionResults);
}

// ========== 詳細解答表示 ==========
function displayDetailedAnswers() {
    const detailDiv = document.getElementById('detailAnswers');
    detailDiv.innerHTML = '';

    Object.keys(testData).forEach(sectionId => {
        const section = testData[sectionId];
        const sectionTitle = document.createElement('h4');
        sectionTitle.textContent = section.title;
        detailDiv.appendChild(sectionTitle);

        section.questions.forEach((question, index) => {
            const answerId = `${sectionId}_${index}`;
            const userAnswer = userAnswers[answerId];
            const isCorrect = userAnswer === question.correct_answer;

            const answerDiv = document.createElement('div');
            answerDiv.className = `answer-item ${isCorrect ? 'correct' : 'incorrect'}`;
            
            const answerText = userAnswer
                ? question.options.find(opt => opt.letter === userAnswer)?.text
                : '未回答';
            
            const correctText = question.options.find(opt => opt.letter === question.correct_answer)?.text;

            answerDiv.innerHTML = `
                <div class="answer-question">問題${index + 1}: ${question.text}</div>
                <div class="answer-user">あなたの回答: ${userAnswer || '未回答'}</div>
                <div class="answer-correct">正解: ${question.correct_answer}</div>
            `;
            detailDiv.appendChild(answerDiv);
        });
    });
}

// ========== LocalStorage に結果を保存 ==========
function saveResultToLocalStorage(score, totalCorrect, totalQuestions, sectionResults) {
    try {
        // 既存の結果を取得
        const resultsKey = `testResults_${userName}`;
        let results = [];
        
        const existing = localStorage.getItem(resultsKey);
        if (existing) {
            results = JSON.parse(existing);
        }
        
        // 新しい結果を作成
        const newResult = {
            date: new Date().toLocaleString('ja-JP'),
            score: score,
            correct: totalCorrect,
            total: totalQuestions,
            sectionResults: sectionResults,
            facility: facilityName
        };
        
        // 結果を追加（最新 5 回を保持）
        results.unshift(newResult);
        if (results.length > 5) {
            results = results.slice(0, 5);
        }
        
        // LocalStorage に保存
        localStorage.setItem(resultsKey, JSON.stringify(results));
        console.log('✅ 結果をローカルストレージに保存しました');
        
    } catch (error) {
        console.error('❌ LocalStorage 保存に失敗:', error);
    }
}

// ========== Google Sheet に結果を送信 ==========
function sendResultToGoogleSheet(score, totalCorrect, totalQuestions, sectionResults) {
    try {
        // Google Apps Script の URL が設定されているか確認
        if (GOOGLE_APPS_SCRIPT_URL.includes('{スクリプトID}')) {
            console.log('⚠️ Google Apps Script URL がまだ設定されていません');
            return;
        }
        
        // 送信データを作成
        const data = {
            name: userName,
            facility: facilityName,
            date: new Date().toLocaleString('ja-JP'),
            score: score,
            correct: totalCorrect,
            total: totalQuestions,
            section1: sectionResults.section1?.percentage || 0,
            section2: sectionResults.section2?.percentage || 0,
            section3: sectionResults.section3?.percentage || 0,
            section4: sectionResults.section4?.percentage || 0
        };
        
        // Google Apps Script に POST
        fetch(GOOGLE_APPS_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify(data)
        })
        .then(() => {
            console.log('✅ 結果を Google Sheet に送信しました');
        })
        .catch(error => {
            console.error('❌ Google Sheet 送信に失敗:', error);
        });
        
    } catch (error) {
        console.error('❌ エラー:', error);
    }
}

// ========== 前回の結果を見る ==========
function showPreviousResults() {
    try {
        const resultsKey = `testResults_${userName}`;
        const existing = localStorage.getItem(resultsKey);
        
        if (!existing) {
            alert('まだ前回の結果がありません。\nテストを開始してください。');
            return;
        }
        
        const results = JSON.parse(existing);
        
        // 結果を表示するHTML を作成
        let resultsHTML = '<div style="max-height: 500px; overflow-y: auto; padding: 20px;">';
        resultsHTML += `<h3>${userName} さんの過去 5 回の成績</h3>`;
        
        results.forEach((result, index) => {
            resultsHTML += `
                <div style="border: 1px solid #ddd; padding: 15px; margin-bottom: 10px; border-radius: 8px;">
                    <strong>第 ${index + 1} 回</strong> - ${result.date}<br>
                    スコア: <strong>${result.score}%</strong> (${result.correct}/${result.total} 問)<br>
                    施設: ${result.facility}<br>
                    <div style="font-size: 0.9em; margin-top: 10px; color: #666;">
                        セクション1: ${result.sectionResults.section1?.percentage}% | 
                        セクション2: ${result.sectionResults.section2?.percentage}% | 
                        セクション3: ${result.sectionResults.section3?.percentage}% | 
                        セクション4: ${result.sectionResults.section4?.percentage}%
                    </div>
                </div>
            `;
        });
        
        resultsHTML += '</div>';
        
        // モーダルで表示（または新しいウィンドウ）
        const win = window.open('', 'previousResults', 'width=600,height=600');
        win.document.write(`
            <html>
                <head>
                    <title>前回の結果</title>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 20px; background: #f5f5f5; }
                        h3 { color: #333; }
                    </style>
                </head>
                <body>
                    ${resultsHTML}
                </body>
            </html>
        `);
        
    } catch (error) {
        console.error('❌ 前回の結果表示に失敗:', error);
        alert('前回の結果を表示できませんでした。');
    }
}

// ========== ホームに戻る ==========
function goHome() {
    switchScreen('loginScreen');
}

// ========== ユーティリティ関数 ==========
function getDifficultyLabel(difficulty) {
    const labels = {
        'M': '中',
        'H': '高',
        'L': '低'
    };
    return labels[difficulty] || difficulty;
}

// ========== デバッグ用ログ ==========
console.log('app.js ロード完了');
