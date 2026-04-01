// ============================================================
// DifyAPI.gs — Difyとの連携
// 「やらなきゃ」などの自然な文章をタスク情報に変換する
// ============================================================

/**
 * Difyにテキストを送り、タスク情報を取得する
 * @param {string} userMessage - ユーザーが送ったメッセージ
 * @returns {Object|null} { taskName, deadline, assignee } または null（解析失敗時）
 */
function callDify(userMessage) {
  const url = `${CONFIG.DIFY.API_BASE}/chat-messages`;

  const body = {
    inputs:        { today: Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd') },
    query:         userMessage,
    response_mode: 'blocking',
    user:          CONFIG.DIFY.USER_ID,
  };

  const options = {
    method:             'POST',
    headers: {
      'Authorization':  `Bearer ${CONFIG.DIFY.API_KEY}`,
      'Content-Type':   'application/json',
    },
    payload:            JSON.stringify(body),
    muteHttpExceptions: true,
  };

  const response     = UrlFetchApp.fetch(url, options);
  const responseText = response.getContentText();

  if (response.getResponseCode() !== 200) {
    console.error('Dify APIエラー:', responseText);
    return null;
  }

  const result = JSON.parse(responseText);
  const answer = result.answer || '';

  // DifyからJSON形式で返ってくることを期待
  // Dify側のプロンプトで「必ずJSON形式で返すこと」と指示しておく
  return parseDifyResponse(answer);
}

/**
 * DifyのレスポンスからタスクJSONを取り出す（内部用）
 * Difyが返すテキストの中からJSONブロックを探して解析する
 */
function parseDifyResponse(answer) {
  try {
    // コードブロック（```json ... ```）があれば取り出す
    const jsonMatch = answer.match(/```json\s*([\s\S]*?)```/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1].trim());
    }

    // コードブロックがなければ全体をJSONとして解析
    return JSON.parse(answer.trim());

  } catch (e) {
    console.error('Difyレスポンス解析エラー:', e.toString(), '原文:', answer);
    return null;
  }
}

// ============================================================
// 【Dify側に設定するプロンプト（参考）】
//
// あなたはタスク管理アシスタントです。
// ユーザーのメッセージからタスク情報を読み取り、
// 必ず以下のJSON形式のみで返答してください。
//
// ```json
// {
//   "taskName": "タスクの名前（簡潔に）",
//   "deadline": "YYYY-MM-DD（日付が不明なら null）",
//   "assignee": "担当者名（不明なら null）"
// }
// ```
//
// 例：
// 入力：「来週金曜までに企画書作らなきゃ」
// 出力：{"taskName": "企画書作成", "deadline": "2026-04-10", "assignee": null}
//
// 今日の日付は {{today}} です。
// ============================================================
