// ============================================================
// Main.gs — 受け取り窓口
// LINEワークスからの通信をすべてここで受け取り、振り分ける
// ============================================================

/**
 * LINEワークスからメッセージやボタン操作が届いたときに自動で呼ばれる関数
 * GASをウェブアプリとして公開すると、このURLにデータが送られてくる
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const eventType = data.type;

    if (eventType === 'message' && data.content && data.content.type === 'text') {
      const text    = data.content.text;
      const userId  = data.source.userId;
      // ボタンタップ由来のメッセージ（extend|... / on_track|... / complete|...）はPostbackとして処理
      if (/^(extend|on_track|complete)\|/.test(text)) {
        handlePostback(text, userId);
      } else {
        // 通常のテキストメッセージ → Difyで解析してタスク登録
        handleTextMessage(text, userId);
      }

    }

  } catch (err) {
    console.error('doPost エラー:', err.toString());
  }

  // LINEワークスへの応答（常に200 OKを返す）
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok' }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * テキストメッセージを受け取ったときの処理
 * Difyに渡してタスク情報を抽出し、スプレッドシートに保存する
 */
function handleTextMessage(text, userId) {
  // Difyでタスク情報を解析
  const taskInfo = callDify(text);

  if (!taskInfo || !taskInfo.taskName) {
    // タスクとして認識できなかった場合
    sendTextMessage('申し訳ありません、タスクの内容を読み取れませんでした。\n「〇〇を△日までにやる」のように教えていただけますか？');
    return;
  }

  // スプレッドシートに保存（担当者未指定の場合は送信者IDをセット）
  if (!taskInfo.assignee) taskInfo.assignee = userId;
  const taskId = addTask(taskInfo);

  // 登録完了をグループチャンネルに返信
  const deadline = taskInfo.deadline || '未設定';
  const reply =
    `タスクを登録しました！\n\n` +
    `${taskInfo.taskName}\n` +
    `期限：${deadline}\n` +
    `ID：${taskId}\n\n` +
    `期限が近づいたらお知らせします。`;

  sendTextMessage(reply);
}

/**
 * ボタンがタップされたときの処理
 * データ形式：「アクション|値|タスクID」（例: extend|3|T001）
 */
function handlePostback(postbackData, userId) {
  const parts  = postbackData.split('|');
  const action = parts[0];
  const value  = parts[1];
  const taskId = parts[2];

  let replyText = '';

  if (action === 'extend') {
    // 期限を延期する
    const days = parseInt(value);
    const newDeadline = extendDeadline(taskId, days);
    replyText = `${taskId} の期限を ${days}日 延ばしました。\n新しい期限：${newDeadline}`;

  } else if (action === 'on_track') {
    // 順調に更新
    updateTaskStatus(taskId, STATUS.ON_TRACK);
    replyText = `${taskId} のステータスを「順調」に更新しました！`;

  } else if (action === 'complete') {
    // 完了に更新
    updateTaskStatus(taskId, STATUS.COMPLETE);
    replyText = `${taskId} が完了しました！お疲れ様でした！`;
  }

  if (replyText) {
    sendTextMessage(replyText);
  }
}
