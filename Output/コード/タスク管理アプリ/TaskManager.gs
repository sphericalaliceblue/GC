// ============================================================
// TaskManager.gs — タスクの保存・更新・取得
// スプレッドシートへの読み書きをまとめて管理する
// ============================================================

/**
 * スプレッドシートのシートを取得する（内部用）
 */
function getSheet() {
  return SpreadsheetApp
    .openById(CONFIG.SPREADSHEET_ID)
    .getSheetByName(CONFIG.SHEET_NAME);
}

/**
 * タスクを新規登録する
 * @param {Object} taskInfo - { taskName, deadline, requester, assignee }
 * @returns {string} 採番されたタスクID（例: T001）
 */
function addTask(taskInfo) {
  const sheet   = getSheet();
  const today   = formatDate(new Date());
  const lastRow = sheet.getLastRow();

  // IDを採番（T001, T002...）
  const taskNum = lastRow; // ヘッダー行があるので行数 = 連番
  const taskId  = 'T' + String(taskNum).padStart(3, '0');

  // 通知予定日を計算
  const notifyDates = calculateNotifyDates(today, taskInfo.deadline);

  const row = [
    taskId,
    taskInfo.taskName    || '',
    taskInfo.deadline    || '',
    STATUS.IN_PROGRESS,
    taskInfo.requester   || 'ユーザー',
    taskInfo.assignee    || '',
    today,
    today,
    JSON.stringify(notifyDates),
    taskInfo.replyTo     || CONFIG.LINE_WORKS.CHANNEL_ID,
    taskInfo.isChannel   !== undefined ? taskInfo.isChannel : true,
    taskInfo.originalText || '',
  ];

  sheet.appendRow(row);
  console.log(`タスク登録: ${taskId} - ${taskInfo.taskName}`);
  return taskId;
}

/**
 * タスクのステータスを更新する
 * @param {string} taskId - タスクID（例: T001）
 * @param {string} newStatus - 新しいステータス
 */
function updateTaskStatus(taskId, newStatus) {
  const sheet = getSheet();
  const row   = findRowByTaskId(sheet, taskId);
  if (!row) {
    console.error(`タスクが見つかりません: ${taskId}`);
    return;
  }

  sheet.getRange(row, COL.STATUS + 1).setValue(newStatus);
  sheet.getRange(row, COL.UPDATED_AT + 1).setValue(formatDate(new Date()));
  console.log(`ステータス更新: ${taskId} → ${newStatus}`);
}

/**
 * タスクの期限を延期する
 * @param {string} taskId - タスクID
 * @param {number} days - 延ばす日数
 * @returns {string} 新しい期限日（YYYY-MM-DD）
 */
function extendDeadline(taskId, days) {
  const sheet = getSheet();
  const row   = findRowByTaskId(sheet, taskId);
  if (!row) {
    console.error(`タスクが見つかりません: ${taskId}`);
    return '';
  }

  // 現在の期限を取得
  // getValue()はDate型・文字列・数値のいずれかで返るため、必ずformatDateで文字列化してから処理する
  const rawValue           = sheet.getRange(row, COL.DEADLINE + 1).getValue();
  const currentDeadlineStr = formatDate(rawValue instanceof Date ? rawValue : new Date(String(rawValue)));

  // 文字列をパーツに分解して日数を加算（タイムゾーンに依存しない確実な方法）
  const parts = currentDeadlineStr.split('-');
  const currentDeadline = new Date(
    parseInt(parts[0]),
    parseInt(parts[1]) - 1,
    parseInt(parts[2]) + days
  );

  const newDeadlineStr = formatDate(currentDeadline);

  // 通知予定日を再計算
  const today       = formatDate(new Date());
  const notifyDates = calculateNotifyDates(today, newDeadlineStr);

  sheet.getRange(row, COL.DEADLINE + 1).setValue(newDeadlineStr);
  sheet.getRange(row, COL.NOTIFY_DATES + 1).setValue(JSON.stringify(notifyDates));
  sheet.getRange(row, COL.UPDATED_AT + 1).setValue(today);

  console.log(`期限延期: ${taskId} → ${newDeadlineStr}`);
  return newDeadlineStr;
}

/**
 * 今日通知すべきタスクを全件取得する
 * @returns {Array} 通知対象タスクの配列
 */
function getTasksToNotifyToday() {
  const sheet  = getSheet();
  const data   = sheet.getDataRange().getValues();
  const today  = formatDate(new Date());
  const result = [];

  for (let i = 1; i < data.length; i++) { // 1行目はヘッダーなのでスキップ
    const row    = data[i];
    const status = row[COL.STATUS];

    // 完了・中断タスクはスキップ
    if (status === STATUS.COMPLETE || status === STATUS.SUSPENDED) continue;

    // 通知予定日リストに今日が含まれているか確認
    let notifyDates = [];
    try {
      notifyDates = JSON.parse(row[COL.NOTIFY_DATES] || '[]');
    } catch (e) {
      continue;
    }

    if (notifyDates.includes(today)) {
      const rawDeadline = row[COL.DEADLINE];
      const deadline    = formatDate(rawDeadline instanceof Date ? rawDeadline : new Date(String(rawDeadline)));
      const daysLeft    = calcDaysLeft(row[COL.DEADLINE]);

      result.push({
        rowIndex:   i + 1, // スプレッドシートの実際の行番号
        taskId:     row[COL.ID],
        taskName:   row[COL.TASK_NAME],
        deadline:   deadline,
        daysLeft:   daysLeft,
        status:     status,
        replyTo:    row[COL.REPLY_TO]    || CONFIG.LINE_WORKS.CHANNEL_ID,
        isChannel:  row[COL.REPLY_IS_CH] !== false, // 未設定の場合はチャンネル宛とみなす
      });
    }
  }

  return result;
}

/**
 * タスクIDから元の依頼メッセージを取得する
 * @param {string} taskId - タスクID（例: T001）
 * @returns {string} 元のメッセージテキスト（なければ空文字）
 */
function getOriginalMessage(taskId) {
  const sheet = getSheet();
  const row   = findRowByTaskId(sheet, taskId);
  if (!row) return '';
  return sheet.getRange(row, COL.ORIGINAL_MSG + 1).getValue() || '';
}

/**
 * タスクIDから行番号を探す（内部用）
 */
function findRowByTaskId(sheet, taskId) {
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][COL.ID] === taskId) return i + 1;
  }
  return null;
}

/**
 * 通知予定日を計算する
 * @param {string} createdAt - 作成日（YYYY-MM-DD）
 * @param {string} deadline  - 期限（YYYY-MM-DD）
 * @returns {string[]} 通知する日付の配列（YYYY-MM-DD）
 */
function calculateNotifyDates(createdAt, deadline) {
  if (!deadline) return [];

  const created  = new Date(createdAt);
  const due      = new Date(deadline);
  const today    = new Date();
  today.setHours(0, 0, 0, 0);
  created.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);

  const totalDays = Math.round((due - created) / 86400000);
  const dates     = [];

  // 当日（すべての区分で必ず通知）
  dates.push(formatDate(due));

  // 前日（2日以上の場合）
  if (totalDays >= 2) {
    const prev = new Date(due);
    prev.setDate(prev.getDate() - 1);
    dates.push(formatDate(prev));
  }

  // 中間日（6日以上の場合）
  if (totalDays >= 6) {
    const midDaysFromDue = Math.ceil(totalDays / 2);
    const mid            = new Date(due);
    mid.setDate(mid.getDate() - midDaysFromDue);

    // 中間日が今日以降の場合のみ追加
    if (mid >= today) {
      dates.push(formatDate(mid));
    }
  }

  return dates;
}

/**
 * 期限までの残り日数を計算する
 */
function calcDaysLeft(deadlineStr) {
  const today    = new Date();
  const deadline = new Date(deadlineStr);
  today.setHours(0, 0, 0, 0);
  deadline.setHours(0, 0, 0, 0);
  return Math.round((deadline - today) / 86400000);
}

/**
 * 日付をYYYY-MM-DD形式の文字列に変換する
 */
function formatDate(date) {
  return Utilities.formatDate(new Date(date), 'Asia/Tokyo', 'yyyy-MM-dd');
}
