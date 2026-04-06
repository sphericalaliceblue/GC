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

      // ボタンタップ由来のメッセージはPostbackとして処理
      if (/^(extend|on_track|complete|issue|suspend|confirm_ok|change_deadline|view_msg)\|/.test(text)) {
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
 * 期限入力待ち状態の場合はそちらを優先し、それ以外はDifyでタスク解析する
 */
function handleTextMessage(text, userId, replyTo, isChannel) {
  // 期限入力待ち状態をチェック
  const pendingKey  = 'pending_' + userId;
  const pendingJson = CacheService.getScriptCache().get(pendingKey);
  if (pendingJson) {
    const pending = JSON.parse(pendingJson);
    if (pending.state === 'awaiting_deadline') {
      handleDeadlineInput(text, userId, replyTo, isChannel, pending, pendingKey);
      return;
    }
  }

  // Difyでタスク情報を解析
  const taskInfo = callDify(text);

  if (!taskInfo || !taskInfo.taskName) {
    sendTextMessage('申し訳ありません、タスクの内容を読み取れませんでした。\n「〇〇を△日までにやる」のように教えていただけますか？', replyTo, isChannel);
    return;
  }

  // 担当者未指定の場合は送信者IDをセット
  if (!taskInfo.assignee) taskInfo.assignee = userId;
  taskInfo.replyTo      = replyTo;
  taskInfo.isChannel    = isChannel;
  taskInfo.originalText = text; // 元の依頼文を保持

  // キャッシュに一時保存して確認ステップへ（有効期限10分）
  const pending = { state: 'awaiting_confirmation', taskInfo: taskInfo };
  CacheService.getScriptCache().put(pendingKey, JSON.stringify(pending), 600);

  // 確認ボタン付きメッセージを送信
  sendTaskConfirmation(replyTo, isChannel, taskInfo, userId);
}

/**
 * 期限変更フロー：ユーザーが入力した日付テキストを受け取って処理する
 */
function handleDeadlineInput(text, userId, replyTo, isChannel, pending, pendingKey) {
  // 日付らしい文字列を抽出（YYYY-MM-DD または YYYY/MM/DD）
  const match = text.match(/\d{4}[-\/]\d{1,2}[-\/]\d{1,2}/);
  if (!match) {
    sendTextMessage('日付の形式で入力してください。\n例：2026-04-15', replyTo, isChannel);
    return;
  }

  const newDeadline = match[0].replace(/\//g, '-');
  pending.taskInfo.deadline = newDeadline;
  pending.state = 'awaiting_confirmation';
  CacheService.getScriptCache().put(pendingKey, JSON.stringify(pending), 600);

  // 変更した内容で再度確認メッセージを送信
  sendTaskConfirmation(replyTo, isChannel, pending.taskInfo, userId);
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

  } else if (action === 'confirm_ok') {
    // タスク登録確認OK → キャッシュから取得して正式登録
    const pendingKey  = 'pending_' + value; // value = userId
    const pendingJson = CacheService.getScriptCache().get(pendingKey);
    if (!pendingJson) {
      replyText = '登録情報の有効期限が切れました。\nもう一度タスクを送信してください。';
    } else {
      const pending    = JSON.parse(pendingJson);
      const registeredTaskId = addTask(pending.taskInfo);
      CacheService.getScriptCache().remove(pendingKey);
      const deadline = pending.taskInfo.deadline || '未設定';
      replyText =
        `タスクを登録しました！\n\n` +
        `${pending.taskInfo.taskName}\n` +
        `期限：${deadline}\n` +
        `ID：${registeredTaskId}\n\n` +
        `期限が近づいたらお知らせします。`;
    }

  } else if (action === 'change_deadline') {
    // 期限変更モードへ → 次のメッセージを日付入力として受け取る
    const pendingKey  = 'pending_' + value; // value = userId
    const pendingJson = CacheService.getScriptCache().get(pendingKey);
    if (!pendingJson) {
      replyText = '登録情報の有効期限が切れました。\nもう一度タスクを送信してください。';
    } else {
      const pending = JSON.parse(pendingJson);
      pending.state = 'awaiting_deadline';
      CacheService.getScriptCache().put(pendingKey, JSON.stringify(pending), 600);
      replyText = '新しい期限を入力してください。\n例：2026-04-15';
    }

  } else if (action === 'view_msg') {
    // 元の依頼文を表示（taskId = parts[2]）
    const original = getOriginalMessage(taskId);
    replyText = original
      ? `【依頼時の文章】\n${original}`
      : '依頼時の文章が記録されていません。';
  }

  if (replyText) {
    sendTextMessage(replyText, replyTo, isChannel);
  }
}
