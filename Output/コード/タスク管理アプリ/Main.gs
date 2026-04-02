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

    // ユーザーがBotとのトークを開始したとき → ウェルカムメッセージを返してタスク登録はしない
    if (eventType === 'follow') {
      const userId = data.source && data.source.userId;
      if (userId) {
        sendTextMessage(
          'こんにちは！タスク管理Botです。\n「〇〇を△日までにやる」のように送ってもらえればタスクを登録します。',
          userId,
          false
        );
      }

    } else if (eventType === 'message' && data.content && data.content.type === 'text') {
      // userIdがない場合はシステムメッセージとみなして無視する
      if (!data.source || !data.source.userId) return;

      let text        = data.content.text;
      const userId    = data.source.userId;
      // 返信先：グループチャットならそのチャンネル、DMなら送信者本人
      const isChannel = !!data.source.channelId;
      const replyTo   = isChannel ? data.source.channelId : userId;

      // LINEワークスがBot追加時に自動送信するシステムメッセージは無視する
      const SYSTEM_MESSAGES = ['利用開始'];
      if (SYSTEM_MESSAGES.includes(text.trim())) return;

      // ボタンタップ由来のメッセージ（extend|... / on_track|... / complete|... / issue|... / suspend|...）はPostbackとして処理
      if (/^(extend|on_track|complete|issue|suspend)\|/.test(text)) {
        handlePostback(text, userId, replyTo, isChannel);
      } else {
        // グループトークはBotへのメンションがある場合のみ処理
        if (isChannel) {
          if (!isBotMentioned(data.content)) return;
          text = stripMentions(text);
        }
        handleTextMessage(text, userId, replyTo, isChannel);
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
 * Botがメンションされているかどうかをチェックする
 * LINEワークスはメンションをテキスト先頭に "@Bot名" として埋め込む
 * @param {Object} content - メッセージのcontentオブジェクト
 * @returns {boolean}
 */
function isBotMentioned(content) {
  return content.text.includes('@' + CONFIG.LINE_WORKS.BOT_NAME);
}

/**
 * テキスト先頭の "@Bot名 " 部分を除去して返す
 * 例: "@タスク管理アプリ \n\nタスク内容" → "タスク内容"
 * @param {string} text - 元のメッセージテキスト
 * @returns {string} メンションを除いたテキスト
 */
function stripMentions(text) {
  return text.replace(/^@[^\n]+\n+/, '').trim();
}

/**
 * テキストメッセージを受け取ったときの処理
 * Difyに渡してタスク情報を抽出し、スプレッドシートに保存する
 */
function handleTextMessage(text, userId, replyTo, isChannel) {
  // Difyでタスク情報を解析
  const taskInfo = callDify(text);

  if (!taskInfo || !taskInfo.taskName) {
    // タスクとして認識できなかった場合
    sendTextMessage('申し訳ありません、タスクの内容を読み取れませんでした。\n「〇〇を△日までにやる」のように教えていただけますか？', replyTo, isChannel);
    return;
  }

  // スプレッドシートに保存（担当者未指定の場合は送信者IDをセット）
  if (!taskInfo.assignee) taskInfo.assignee = userId;
  taskInfo.replyTo   = replyTo;
  taskInfo.isChannel = isChannel;
  const taskId = addTask(taskInfo);

  // 登録完了を返信（送信元チャンネル or ユーザーへ）
  const deadline = taskInfo.deadline || '未設定';
  const reply =
    `タスクを登録しました！\n\n` +
    `${taskInfo.taskName}\n` +
    `期限：${deadline}\n` +
    `ID：${taskId}\n\n` +
    `期限が近づいたらお知らせします。`;

  sendTextMessage(reply, replyTo, isChannel);
}

/**
 * ボタンがタップされたときの処理
 * データ形式：「アクション|値|タスクID」（例: extend|3|T001）
 */
function handlePostback(postbackData, userId, replyTo, isChannel) {
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

  } else if (action === 'issue') {
    // 問題発生に更新
    updateTaskStatus(taskId, STATUS.ISSUE);
    replyText = `${taskId} のステータスを「問題発生」にしました。対応状況はお知らせください。`;

  } else if (action === 'suspend') {
    // 中断に更新
    updateTaskStatus(taskId, STATUS.SUSPENDED);
    replyText = `${taskId} を「中断」にしました。再開の際はお知らせください。`;
  }

  if (replyText) {
    sendTextMessage(replyText, replyTo, isChannel);
  }
}
