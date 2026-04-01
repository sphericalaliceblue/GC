// ============================================================
// Notifier.gs — 期限チェックと通知送信
// 毎朝自動で動き、今日通知すべきタスクをLINEワークスに送る
// ============================================================

/**
 * 毎朝自動で実行される期限チェック関数
 * GASのトリガーで毎朝9時に呼び出すよう設定する
 */
function checkDeadlines() {
  console.log('期限チェック開始:', formatDate(new Date()));

  const tasks = getTasksToNotifyToday();

  if (tasks.length === 0) {
    console.log('今日通知するタスクはありません');
    return;
  }

  console.log(`通知対象タスク数: ${tasks.length}`);

  for (const task of tasks) {
    try {
      sendTaskNotification(
        task.replyTo,
        task.taskId,
        task.taskName,
        task.deadline,
        task.daysLeft,
        task.isChannel
      );
      console.log(`通知送信完了: ${task.taskId}`);
      Utilities.sleep(1000); // 連続送信の間隔を空ける
    } catch (err) {
      console.error(`通知失敗 ${task.taskId}:`, err.toString());
    }
  }

  console.log('期限チェック完了');
}

/**
 * 手動でテスト通知を送りたいときに使う関数
 * GASの「実行」ボタンから手動で呼び出せる
 */
function testNotification() {
  sendTaskNotification(
    CONFIG.LINE_WORKS.CHANNEL_ID,
    'T000',
    'テストタスク',
    formatDate(new Date()),
    0
  );
  console.log('テスト通知を送信しました');
}
